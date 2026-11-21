import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ScreenId, ScanContextData, WorkerTelemetry } from '../types';
import { REFINERY_FACILITY } from '../data/mockData';
import { api } from '../services/api';
import {
  detectDosimeterPatch,
  sampleAreaRGB,
  normalizeWithWhiteRef,
  quickEstimateExposure,
  rgbToHex,
  scanDosimeterQR,
  playQRSound,
  DosimeterCVResult,
  NormalizedROI,
  DecodedQRInfo
} from '../utils/imageAnalysis';

interface ScanScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onStartAnalysis: (context: ScanContextData) => void;
  currentWorkers?: WorkerTelemetry[];
}

// Pre-configured hardware dosimeter test strips for presentation demonstrations
const PRESET_HARDWARE_STRIPS = [
  {
    id: 'rajesh-warning',
    name: 'Shift B Elevated (HCU-2)',
    worker: 'Rajesh Kumar',
    workerId: 'WRK-1048',
    unit: 'Hydrocracker Unit (HCU-2)',
    badgeId: 'ST-WB-00124',
    shift: 'Evening (Shift B)',
    colorHex: '#d97706',
    rgb: { r: 217, g: 119, b: 6 },
    expectedDose: '10.2 PPM·h',
    status: 'Warning',
    description: 'Amber sulfide tint after 8h shift near high-pressure separator'
  },
  {
    id: 'arjun-safe',
    name: 'Shift A Safe (SRU-3)',
    worker: 'Arjun Patel',
    workerId: 'WRK-1052',
    unit: 'Sulfur Recovery Unit (SRU-3)',
    badgeId: 'ST-WB-00128',
    shift: 'Morning (Shift A)',
    colorHex: '#e2e8f0',
    rgb: { r: 226, g: 232, b: 240 },
    expectedDose: '2.1 PPM·h',
    status: 'Safe',
    description: 'Pristine paper strip with negligible diffuse discoloration'
  },
  {
    id: 'deepak-critical',
    name: 'Shift C Critical (Tank 3B)',
    worker: 'Deepak Sharma',
    workerId: 'WRK-1077',
    unit: 'Tank Farm 3B & Crude Sludge Pit',
    badgeId: 'ST-WB-00142',
    shift: 'Night (Shift C)',
    colorHex: '#78350f',
    rgb: { r: 120, g: 53, b: 15 },
    expectedDose: '14.8 PPM·h',
    status: 'Critical',
    description: 'Heavy dark bismuth sulfide precipitation exceeding shift TWA ceiling'
  },
  {
    id: 'unexposed-blank',
    name: 'Factory Unexposed Blank',
    worker: 'Pre-Shift Calibration',
    workerId: 'WRK-CAL-01',
    unit: 'Clean QA Bench',
    badgeId: 'ST-WB-00000',
    shift: 'Zero Exposure Standard',
    colorHex: '#f8fafc',
    rgb: { r: 245, g: 243, b: 236 },
    expectedDose: '0.2 PPM·h',
    status: 'Safe',
    description: 'Fresh impregnated substrate showing baseline factory white point'
  }
];

export const ScanScreen: React.FC<ScanScreenProps> = ({
  onNavigate,
  onStartAnalysis,
  currentWorkers = []
}) => {
  // Mode selection: 'camera' vs 'upload'
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');

  // Camera state
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState<boolean>(false);
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);

  // Upload state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Active sampled color & worker context
  const [selectedPresetId, setSelectedPresetId] = useState<string>('rajesh-warning');
  const [sampledRgb, setSampledRgb] = useState<{ r: number; g: number; b: number }>({ r: 217, g: 119, b: 6 });
  const [sampledHex, setSampledHex] = useState<string>('#d97706');

  // Advanced Computer Vision & In-Situ Normalization State
  const [cvResult, setCvResult] = useState<DosimeterCVResult | null>(null);
  const [detectedLayout, setDetectedLayout] = useState<'standard-left' | 'wristband-center'>('standard-left');
  const [patchRoiNorm, setPatchRoiNorm] = useState<NormalizedROI>({ xPct: 8, yPct: 33, widthPct: 18, heightPct: 28 });
  const [whiteRefRoiNorm, setWhiteRefRoiNorm] = useState<NormalizedROI>({ xPct: 68, yPct: 36, widthPct: 9, heightPct: 16 });
  const [whiteRefRgb, setWhiteRefRgb] = useState<{ r: number; g: number; b: number }>({ r: 245, g: 243, b: 236 });
  const [normalizedRgb, setNormalizedRgb] = useState<{ r: number; g: number; b: number }>({ r: 217, g: 119, b: 6 });
  const [normalizedHex, setNormalizedHex] = useState<string>('#d97706');
  const [liveEstimate, setLiveEstimate] = useState<{ dose: number; status: 'Safe' | 'Warning' | 'Critical'; deltaE: number }>({
    dose: 10.2,
    status: 'Warning',
    deltaE: 2.84
  });

  // Automated Hardware QR Code Detection State
  const [detectedQr, setDetectedQr] = useState<DecodedQRInfo | null>(null);
  const [qrScanNotice, setQrScanNotice] = useState<string | null>(null);

  const imageElementRef = useRef<HTMLImageElement>(null);

  // Environmental sliders
  const [tempC, setTempC] = useState<number>(31.0);
  const [humidityRH, setHumidityRH] = useState<number>(64);

  // Worker assignment
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('WRK-1048');
  const [customBadgeId, setCustomBadgeId] = useState<string>('ST-WB-00124');

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Current worker details
  const activeWorker = currentWorkers.find((w) => w.workerId === selectedWorkerId) || {
    workerId: 'WRK-1048',
    workerName: 'Rajesh Kumar',
    department: 'Hydrocracker Unit (HCU-2)',
    badgeId: 'ST-WB-00124',
    shift: 'Evening (Shift B)'
  };

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  // Start live camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access API is not supported in this browser environment. You can use the File Upload option.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {
          // auto-play handled
        });
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('[Camera] Failed to initialize video feed:', err);
      // Fallback try without facingMode constraints
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play().catch(() => {});
        }
        setIsCameraActive(true);
      } catch (fallbackErr: any) {
        setCameraError('Camera access unavailable or permission denied. Please grant camera permission or use the File Upload tab below.');
        setIsCameraActive(false);
      }
    }
  }, [cameraFacing, stopCamera]);

  // Manage camera on tab change or cameraFacing flip
  useEffect(() => {
    if (activeTab === 'camera' && !capturedSnapshot) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab, cameraFacing, capturedSnapshot, startCamera, stopCamera]);

  // Toggle flash/torch if supported
  const toggleFlash = async () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        try {
          const capabilities = (videoTrack.getCapabilities && videoTrack.getCapabilities()) as any;
          if (capabilities && capabilities.torch) {
            await (videoTrack as any).applyConstraints({
              advanced: [{ torch: !flashOn }]
            });
          }
        } catch {
          // Torch not supported on some desktop webcams
        }
      }
    }
    setFlashOn(!flashOn);
  };

  // Flip front/back camera
  const switchCameraFacing = () => {
    setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Live continuous camera QR code background detection
  useEffect(() => {
    if (!isCameraActive || capturedSnapshot || activeTab !== 'camera') return;

    let isScanning = false;
    const interval = setInterval(async () => {
      if (isScanning || !videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      if (video.readyState < 2) return;

      isScanning = true;
      try {
        const offCanvas = canvasRef.current;
        const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const scanW = 640;
          const scanH = Math.round((video.videoHeight / (video.videoWidth || 1)) * 640) || 480;
          offCanvas.width = scanW;
          offCanvas.height = scanH;
          ctx.drawImage(video, 0, 0, scanW, scanH);

          const qr = await scanDosimeterQR(offCanvas, currentWorkers);
          if (qr.detected && (!detectedQr || detectedQr.rawText !== qr.rawText)) {
            setDetectedQr(qr);
            playQRSound();
            if (qr.workerId) setSelectedWorkerId(qr.workerId);
            if (qr.badgeId) setCustomBadgeId(qr.badgeId);
            setQrScanNotice(`Live QR Locked: ${qr.rawText} · ${qr.workerName} (${qr.badgeId})`);
            setTimeout(() => setQrScanNotice(null), 4000);
          }
        }
      } catch {
        // ignore frame scan exceptions
      } finally {
        isScanning = false;
      }
    }, 320);

    return () => clearInterval(interval);
  }, [isCameraActive, capturedSnapshot, activeTab, currentWorkers, detectedQr]);

  // Snap image from live camera feed
  const handleSnapFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const snapshotDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedSnapshot(snapshotDataUrl);

    // Run smart CV detection on captured frame
    const cv = detectDosimeterPatch(canvas);
    setCvResult(cv);
    setDetectedLayout(cv.layout);
    setPatchRoiNorm(cv.patchRoiNormalized);
    setWhiteRefRoiNorm(cv.whiteRefRoiNormalized);
    setSampledRgb(cv.sampledRgb);
    setSampledHex(cv.sampledHex);
    setWhiteRefRgb(cv.whiteRefRgb);
    setNormalizedRgb(cv.normalizedRgb);
    setNormalizedHex(cv.normalizedHex);
    setLiveEstimate({ dose: cv.estimatedExposure, status: cv.status, deltaE: cv.deltaE });

    // Run full QR scan on snapshot
    scanDosimeterQR(canvas, currentWorkers).then((qr) => {
      if (qr.detected) {
        setDetectedQr(qr);
        playQRSound();
        if (qr.workerId) setSelectedWorkerId(qr.workerId);
        if (qr.badgeId) setCustomBadgeId(qr.badgeId);
        setQrScanNotice(`QR Code Verified: ${qr.rawText} · Linked to ${qr.workerName} (${qr.badgeId})`);
        setTimeout(() => setQrScanNotice(null), 5000);
      }
    });

    // Pause video
    stopCamera();
  };

  // Retake photo
  const handleRetakeCamera = () => {
    setCapturedSnapshot(null);
    setDetectedQr(null);
    setQrScanNotice(null);
    startCamera();
  };

  // Handle uploaded file with full computer-vision detection
  const processUploadedFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setUploadedImage(dataUrl);

      // Create an image element to run full CV dosimeter detection
      const img = new Image();
      img.onload = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Run smart computer-vision detection
        const cv = detectDosimeterPatch(canvas);
        setCvResult(cv);
        setDetectedLayout(cv.layout);
        setPatchRoiNorm(cv.patchRoiNormalized);
        setWhiteRefRoiNorm(cv.whiteRefRoiNormalized);
        setSampledRgb(cv.sampledRgb);
        setSampledHex(cv.sampledHex);
        setWhiteRefRgb(cv.whiteRefRgb);
        setNormalizedRgb(cv.normalizedRgb);
        setNormalizedHex(cv.normalizedHex);
        setLiveEstimate({ dose: cv.estimatedExposure, status: cv.status, deltaE: cv.deltaE });

        // Run full QR detection across native & enhanced passes
        scanDosimeterQR(canvas, currentWorkers).then((qr) => {
          if (qr.detected) {
            setDetectedQr(qr);
            playQRSound();
            if (qr.workerId) setSelectedWorkerId(qr.workerId);
            if (qr.badgeId) setCustomBadgeId(qr.badgeId);
            setQrScanNotice(`Hardware QR Verified: ${qr.rawText} · Auto-Assigned to ${qr.workerName} (${qr.badgeId})`);
            setTimeout(() => setQrScanNotice(null), 6000);
          } else if (cv.qrInfo?.detected) {
            setDetectedQr(cv.qrInfo);
            playQRSound();
            if (cv.qrInfo.workerId) setSelectedWorkerId(cv.qrInfo.workerId);
            if (cv.qrInfo.badgeId) setCustomBadgeId(cv.qrInfo.badgeId);
            setQrScanNotice(`Hardware QR Verified: ${cv.qrInfo.rawText} · Auto-Assigned to ${cv.qrInfo.workerName} (${cv.qrInfo.badgeId})`);
            setTimeout(() => setQrScanNotice(null), 6000);
          } else {
            setDetectedQr(null);
          }
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Switch dosimeter layout format manually
  const handleSelectLayout = (layout: 'standard-left' | 'wristband-center') => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const cv = detectDosimeterPatch(canvas, layout);
    setCvResult(cv);
    setDetectedLayout(cv.layout);
    setPatchRoiNorm(cv.patchRoiNormalized);
    setWhiteRefRoiNorm(cv.whiteRefRoiNormalized);
    setSampledRgb(cv.sampledRgb);
    setSampledHex(cv.sampledHex);
    setWhiteRefRgb(cv.whiteRefRgb);
    setNormalizedRgb(cv.normalizedRgb);
    setNormalizedHex(cv.normalizedHex);
    setLiveEstimate({ dose: cv.estimatedExposure, status: cv.status, deltaE: cv.deltaE });
  };

  // Interactive click on uploaded image to reposition sampling reticle
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const imgEl = imageElementRef.current;
    const canvas = canvasRef.current;
    if (!imgEl || !canvas) return;

    const rect = imgEl.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (clickX < 0 || clickX > rect.width || clickY < 0 || clickY > rect.height) return;

    const normX = Math.max(0, Math.min(1, clickX / rect.width));
    const normY = Math.max(0, Math.min(1, clickY / rect.height));

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const actualX = normX * canvas.width;
    const actualY = normY * canvas.height;
    const sampleSize = Math.max(12, Math.floor(canvas.width * 0.05));

    const patch = sampleAreaRGB(
      ctx,
      actualX - sampleSize / 2,
      actualY - sampleSize / 2,
      sampleSize,
      sampleSize,
      canvas.width,
      canvas.height
    );

    const normRgb = normalizeWithWhiteRef(patch, whiteRefRgb);
    const est = quickEstimateExposure(normRgb, tempC, humidityRH);

    setSampledRgb(patch);
    setSampledHex(rgbToHex(patch.r, patch.g, patch.b));
    setNormalizedRgb(normRgb);
    setNormalizedHex(rgbToHex(normRgb.r, normRgb.g, normRgb.b));

    const halfW = 6;
    const halfH = 7;
    setPatchRoiNorm({
      xPct: parseFloat(Math.max(0, Math.min(100 - halfW * 2, normX * 100 - halfW)).toFixed(1)),
      yPct: parseFloat(Math.max(0, Math.min(100 - halfH * 2, normY * 100 - halfH)).toFixed(1)),
      widthPct: halfW * 2,
      heightPct: halfH * 2
    });

    setLiveEstimate(est);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processUploadedFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  // Choose a hardware preset test strip
  const handleSelectPreset = (preset: (typeof PRESET_HARDWARE_STRIPS)[0]) => {
    setSelectedPresetId(preset.id);
    setSampledRgb(preset.rgb);
    setSampledHex(preset.colorHex);
    setNormalizedRgb(preset.rgb);
    setNormalizedHex(preset.colorHex);
    setWhiteRefRgb({ r: 245, g: 243, b: 236 });
    setCustomBadgeId(preset.badgeId);

    // If matching worker exists, select them
    if (preset.workerId) {
      setSelectedWorkerId(preset.workerId);
    }
  };

  // Run the full SpectroCV analysis pipeline
  const handleRunAnalysis = () => {
    const activeImage =
      activeTab === 'camera'
        ? capturedSnapshot || 'https://lh3.googleusercontent.com/aida-public/AB6AXuCRcQitauIBBmBNkxwZV2N7bT1S6bnhk2ERfey9nsdsqH8_1PcLFbLSOTxpVp3NXDeeCYs9xB6tkoxTzxXqm89Wk5uqzK0oiVMusUAxZxiQ9IE4vD0eLAa3gtXfYuwTzzfoAOSuM-Rv8ZEBhYwkjWey69kHvy4Z4v-M8i1ngUNYE3e_7gduRx3Iu59J-bp1o9dgj3DSzFzmu4-GxEGng1nyRTggw4-9u9O8wvGir2_rXsrWNKU8rhJAoA'
        : uploadedImage || 'https://lh3.googleusercontent.com/aida-public/AB6AXuCRcQitauIBBmBNkxwZV2N7bT1S6bnhk2ERfey9nsdsqH8_1PcLFbLSOTxpVp3NXDeeCYs9xB6tkoxTzxXqm89Wk5uqzK0oiVMusUAxZxiQ9IE4vD0eLAa3gtXfYuwTzzfoAOSuM-Rv8ZEBhYwkjWey69kHvy4Z4v-M8i1ngUNYE3e_7gduRx3Iu59J-bp1o9dgj3DSzFzmu4-GxEGng1nyRTggw4-9u9O8wvGir2_rXsrWNKU8rhJAoA';

    const scanContext: ScanContextData = {
      imageUrl: activeImage,
      sampledRgb,
      whiteRefRgb,
      normalizedRgb,
      roi: cvResult?.patchRoi,
      detectedLayout,
      badgeId: customBadgeId || activeWorker.badgeId || 'ST-WB-00124',
      workerId: activeWorker.workerId || 'WRK-1048',
      workerName: activeWorker.workerName || 'Rajesh Kumar',
      department: activeWorker.department || 'Hydrocracker Unit (HCU-2)',
      shift: activeWorker.shift || 'Evening (Shift B)',
      tempC,
      humidityRH,
      deviceSource: activeTab === 'camera' ? 'camera' : 'upload'
    };

    onStartAnalysis(scanContext);
    onNavigate('analysis');
  };

  // Calculate live kinetic multiplier
  const liveKineticFactor = parseFloat(((1.0 + 0.012 * (tempC - 25.0)) * (1.0 + 0.003 * (humidityRH - 50.0))).toFixed(3));

  return (
    <div className="flex flex-col w-full pb-16 space-y-4 animate-fadeIn">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Title & Facility Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h1 className="text-2xl font-bold text-slate-900">Dosimeter SpectroCV Optical Scanner</h1>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
            Capture or upload passive wristband dosimeter for automated exposure quantification.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-xs font-semibold flex items-center gap-1 shadow-xs">
            <span className="material-symbols-outlined text-[14px]">videocam</span>
            SpectroCV Engine v4.2
          </span>
          <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs font-semibold hidden sm:inline-block">
            {REFINERY_FACILITY.name}
          </span>
        </div>
      </div>

      {/* Input Mode Selector: Live Camera vs Upload Image */}
      <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('camera')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'camera'
              ? 'bg-white text-orange-600 shadow-xs border border-slate-200 font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">photo_camera</span>
          <span>Direct Camera Capture</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'upload'
              ? 'bg-white text-orange-600 shadow-xs border border-slate-200 font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">upload_file</span>
          <span>Upload Image / File</span>
        </button>
      </div>

      {/* Hardware Evaluation Presets for Live Demonstrations */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-700 font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-orange-600">science</span>
            Hardware Evaluation Demo Strips (Quick Test Profiles):
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Click to preview chemical shifts</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRESET_HARDWARE_STRIPS.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`p-2 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-orange-600 bg-orange-50/60 shadow-xs ring-1 ring-orange-500'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="w-4 h-4 rounded-full border border-slate-400 shadow-xs"
                    style={{ backgroundColor: preset.colorHex }}
                  />
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                      preset.status === 'Critical'
                        ? 'bg-red-100 text-red-800'
                        : preset.status === 'Warning'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {preset.expectedDose}
                  </span>
                </div>
                <span className="font-bold text-[11px] text-slate-900 truncate">{preset.name}</span>
                <span className="text-[10px] text-slate-500 truncate">{preset.worker}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Viewfinder / Scanner Area */}
      {activeTab === 'camera' ? (
        <div className="relative w-full h-[400px] rounded-2xl overflow-hidden bg-slate-950 shadow-md border border-slate-800 flex flex-col justify-between p-4">
          {/* Flash screen effect */}
          {flashOn && (
            <div className="absolute inset-0 bg-white/40 pointer-events-none z-30 transition-opacity"></div>
          )}

          {/* Video Feed or Captured Preview */}
          {capturedSnapshot ? (
            <img
              src={capturedSnapshot}
              alt="Captured Dosimeter Frame"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />
          )}

          {/* Fallback scrim if camera failed */}
          {cameraError && !capturedSnapshot && (
            <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-6 text-center z-20">
              <span className="material-symbols-outlined text-amber-500 text-4xl mb-2">videocam_off</span>
              <p className="text-white text-xs sm:text-sm font-medium mb-3 max-w-md">{cameraError}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-orange-700"
                >
                  Retry Camera
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="px-3 py-1.5 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-700"
                >
                  Switch to Upload Mode
                </button>
              </div>
            </div>
          )}

          {/* Contrast scrim */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80 pointer-events-none z-10"></div>

          {/* Top Camera Controls Header inside Viewfinder */}
          <div className="relative z-20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-full text-white border border-slate-700">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isCameraActive || capturedSnapshot ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                ></span>
                <span className="font-mono text-xs text-emerald-300 font-medium">
                  {capturedSnapshot ? 'Frame Captured (Ready for CV)' : isCameraActive ? 'Optical CMOS Stream Active' : 'Sensor Ready'}
                </span>
              </div>

              {detectedQr && (
                <div className="hidden sm:flex items-center gap-1.5 bg-emerald-950/90 border border-emerald-400/80 px-2.5 py-1 rounded-full text-emerald-300 text-[11px] font-mono font-bold animate-pulse shadow-md">
                  <span className="material-symbols-outlined text-[14px] text-emerald-400">qr_code_scanner</span>
                  <span>QR LOCKED: #{detectedQr.badgeId} ({detectedQr.workerName})</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center transition-colors cursor-pointer border ${
                  flashOn
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-bold'
                    : 'bg-slate-900/70 border-slate-700 text-white hover:bg-slate-800'
                }`}
                onClick={toggleFlash}
                title={flashOn ? 'Turn Flash Off' : 'Turn Flash On'}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {flashOn ? 'flash_on' : 'flash_off'}
                </span>
              </button>

              <button
                type="button"
                className="w-9 h-9 rounded-full bg-slate-900/70 border border-slate-700 backdrop-blur-md flex items-center justify-center text-white hover:bg-slate-800 transition-colors cursor-pointer"
                onClick={switchCameraFacing}
                title="Switch Camera (Front/Rear)"
              >
                <span className="material-symbols-outlined text-[18px]">cameraswitch</span>
              </button>
            </div>
          </div>

          {/* Central Targeting Reticle & Chemical Patch Guide */}
          <div className="absolute inset-x-8 top-16 bottom-16 border-2 border-dashed border-orange-400/80 rounded-xl pointer-events-none flex flex-col justify-between p-3 z-20">
            {/* Corner Markers */}
            <div className="absolute -top-1.5 -left-1.5 w-6 h-6 border-t-3 border-l-3 border-orange-400"></div>
            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 border-t-3 border-r-3 border-orange-400"></div>
            <div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-3 border-l-3 border-orange-400"></div>
            <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-3 border-r-3 border-orange-400"></div>

            {/* Top labels */}
            <div className="flex justify-between items-start">
              <div className="bg-slate-900/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-orange-400 font-mono border border-orange-500/40">
                H₂S CHEMICAL STRIP TARGET
              </div>
              <div className="bg-slate-900/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-slate-200 font-mono border border-slate-700">
                CALIBRATION RING INDEX
              </div>
            </div>

            {/* Center target ring */}
            <div className="self-center my-auto flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-full border-2 border-orange-400/70 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs relative">
                <div
                  className="w-10 h-10 rounded-full border-2 border-white shadow-md transition-colors"
                  style={{ backgroundColor: sampledHex }}
                  title="Current Sampled Reagent Color"
                ></div>
                <div className="absolute inset-x-0 h-0.5 bg-orange-500 shadow-[0_0_8px_#ea580c] animate-pulse"></div>
              </div>
              <span className="font-mono text-[10px] text-white mt-1 bg-slate-900/80 px-2 py-0.5 rounded">
                Sample: {sampledHex.toUpperCase()}
              </span>
            </div>

            {/* Bottom labels */}
            <div className="flex justify-between items-end">
              <div className="bg-slate-900/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-emerald-400 font-mono border border-emerald-500/30 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">verified</span>
                <span>VALIDITY DOT: VERIFIED</span>
              </div>
              <span className="font-mono text-[10px] text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded">
                Badge: #{customBadgeId}
              </span>
            </div>
          </div>

          {/* Bottom Capture / Retake Controls */}
          <div className="relative z-20 flex items-center justify-center gap-3">
            {capturedSnapshot ? (
              <button
                type="button"
                onClick={handleRetakeCamera}
                className="px-4 py-2 bg-slate-800/90 hover:bg-slate-700 text-white font-mono text-xs font-semibold rounded-lg border border-slate-600 flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <span className="material-symbols-outlined text-[16px]">replay</span>
                <span>Retake Photo</span>
              </button>
            ) : (
              <button
                id="camera-snap-btn"
                type="button"
                onClick={handleSnapFromCamera}
                className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-orange-950/40 cursor-pointer active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">camera</span>
                <span>Snap & Freeze Frame</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Upload Mode View with Smart CV Targeting & Interactive Reticle */
        <div className="flex flex-col gap-3">
          {uploadedImage ? (
            <div className="flex flex-col gap-3">
              {/* Interactive Viewfinder with Targeting Reticle */}
              <div
                className="relative w-full h-[400px] rounded-2xl overflow-hidden bg-slate-950 shadow-md border border-slate-800 flex items-center justify-center cursor-crosshair group select-none"
                onClick={handleImageClick}
                title="Click anywhere to position sampling reticle on the chemical strip"
              >
                {/* Image element */}
                <img
                  ref={imageElementRef}
                  src={uploadedImage}
                  alt="Uploaded Dosimeter"
                  className="w-full h-full object-contain pointer-events-none"
                />

                {/* Top Telemetry Scrim */}
                <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 via-black/30 to-transparent p-3 pointer-events-none flex items-center justify-between z-20">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-xs font-mono font-bold text-white bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-700">
                      {detectedLayout === 'wristband-center'
                        ? 'Wristband Casing (Center Aperture Detected)'
                        : 'Standard Test Strip (Left Reagent Patch Detected)'}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono font-semibold text-orange-300 bg-orange-950/80 px-2 py-0.5 rounded border border-orange-500/40">
                    Click image to fine-tune
                  </span>
                </div>

                {/* Reticle: Active Chemical Patch Target Box */}
                <div
                  className="absolute border-2 border-orange-400 bg-orange-500/20 rounded-md transition-all duration-150 pointer-events-none z-10 shadow-[0_0_15px_rgba(249,115,22,0.6)]"
                  style={{
                    left: `${patchRoiNorm.xPct}%`,
                    top: `${patchRoiNorm.yPct}%`,
                    width: `${patchRoiNorm.widthPct}%`,
                    height: `${patchRoiNorm.heightPct}%`
                  }}
                >
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-white"></div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white"></div>
                  <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white"></div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-white"></div>

                  {/* Center reticle dot */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-white shadow-md animate-ping"
                      style={{ backgroundColor: sampledHex }}
                    ></div>
                    <div
                      className="w-2.5 h-2.5 rounded-full border border-white shadow-md"
                      style={{ backgroundColor: sampledHex }}
                    ></div>
                  </div>

                  {/* Floating label */}
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-orange-600 text-white font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-sm border border-orange-300">
                    H₂S CHEMICAL PATCH
                  </div>
                </div>

                {/* Reticle: In-situ D65 White Reference Box */}
                <div
                  className="absolute border-2 border-dashed border-cyan-400/80 bg-cyan-500/10 rounded-md transition-all duration-150 pointer-events-none z-10"
                  style={{
                    left: `${whiteRefRoiNorm.xPct}%`,
                    top: `${whiteRefRoiNorm.yPct}%`,
                    width: `${whiteRefRoiNorm.widthPct}%`,
                    height: `${whiteRefRoiNorm.heightPct}%`
                  }}
                >
                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-cyan-900/90 text-cyan-200 font-mono text-[8px] font-bold px-1.5 py-0.2 rounded border border-cyan-500/40">
                    D65 WHITE REF
                  </div>
                </div>

                {/* Reticle: Hardware QR Code Target Box */}
                {detectedQr && detectedQr.location && (
                  <div
                    className="absolute border-2 border-emerald-400 bg-emerald-500/20 rounded-md pointer-events-none z-10 shadow-[0_0_15px_rgba(16,185,129,0.8)] transition-all duration-150 animate-pulse"
                    style={{
                      left: `${detectedQr.location.xPct}%`,
                      top: `${detectedQr.location.yPct}%`,
                      width: `${detectedQr.location.widthPct}%`,
                      height: `${detectedQr.location.heightPct}%`
                    }}
                  >
                    <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-300"></div>
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-emerald-300"></div>
                    <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-emerald-300"></div>
                    <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-emerald-300"></div>

                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-emerald-600 text-white font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-sm border border-emerald-300 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[10px]">qr_code_2</span>
                      <span>QR: {detectedQr.rawText}</span>
                    </div>
                  </div>
                )}

                {/* Bottom guidance banner */}
                <div className="absolute bottom-2 inset-x-3 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-[11px] text-slate-300 flex items-center justify-between z-20 pointer-events-none">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-orange-400">touch_app</span>
                    <span>Click or tap anywhere on the strip to position the target reticle</span>
                  </span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    In-situ D65 Balance Active
                  </span>
                </div>
              </div>

              {/* Hardware QR Code Verified Status Card */}
              {detectedQr && (
                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-xs shadow-xs animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-emerald-950">Hardware Dosimeter QR Verified:</span>
                        <span className="font-mono bg-emerald-200/90 text-emerald-950 px-1.5 py-0.2 rounded font-bold text-[11px]">
                          {detectedQr.rawText}
                        </span>
                        <span className="text-[10px] text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 rounded font-bold">
                          ✓ Auto-Assigned
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        Matched personnel: <strong>{detectedQr.workerName}</strong> (ID: {detectedQr.workerId} · Badge: #{detectedQr.badgeId} · {detectedQr.department})
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDetectedQr(null);
                      setQrScanNotice(null);
                    }}
                    className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold px-2 py-1 rounded hover:bg-emerald-100 cursor-pointer transition-colors"
                  >
                    Clear Match
                  </button>
                </div>
              )}

              {/* Layout Switcher & Image Change Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-orange-600">tune</span>
                    <span>Format Preset:</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      if (!canvasRef.current) return;
                      const cv = detectDosimeterPatch(canvasRef.current);
                      setCvResult(cv);
                      setDetectedLayout(cv.layout);
                      setPatchRoiNorm(cv.patchRoiNormalized);
                      setWhiteRefRoiNorm(cv.whiteRefRoiNormalized);
                      setSampledRgb(cv.sampledRgb);
                      setSampledHex(cv.sampledHex);
                      setWhiteRefRgb(cv.whiteRefRgb);
                      setNormalizedRgb(cv.normalizedRgb);
                      setNormalizedHex(cv.normalizedHex);
                      setLiveEstimate({ dose: cv.estimatedExposure, status: cv.status, deltaE: cv.deltaE });
                    }}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100 cursor-pointer flex items-center gap-1"
                    title="Auto-scan image to find chemical patch"
                  >
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                    <span>Auto-Detect</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectLayout('standard-left')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border cursor-pointer flex items-center gap-1 transition-colors ${
                      detectedLayout === 'standard-left'
                        ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Standard strip with patch on the left (e.g. taped strip / paper strip)"
                  >
                    <span className="material-symbols-outlined text-[14px]">west</span>
                    <span>Standard Strip (Left)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectLayout('wristband-center')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border cursor-pointer flex items-center gap-1 transition-colors ${
                      detectedLayout === 'wristband-center'
                        ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Wristband holder with center viewing window"
                  >
                    <span className="material-symbols-outlined text-[14px]">crop_free</span>
                    <span>Wristband (Center)</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">file_upload</span>
                  <span>Upload Another Image</span>
                </button>
              </div>

              {/* Live Colorimetry & Estimated Exposure Diagnostic Card */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Sampled Sensor Color */}
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div
                    className="w-10 h-10 rounded-lg border border-slate-300 shadow-xs shrink-0"
                    style={{ backgroundColor: sampledHex }}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-slate-700">Raw Sensor Color</span>
                    <span className="font-mono text-xs font-bold text-slate-900">{sampledHex.toUpperCase()}</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      R:{sampledRgb.r} G:{sampledRgb.g} B:{sampledRgb.b}
                    </span>
                  </div>
                </div>

                {/* D65 In-Situ Calibrated Color */}
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-200">
                  <div
                    className="w-10 h-10 rounded-lg border border-emerald-300 shadow-xs shrink-0"
                    style={{ backgroundColor: normalizedHex }}
                  />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-bold text-slate-700">D65 Normalized</span>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1 rounded">D65</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-900">{normalizedHex.toUpperCase()}</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      ΔE: {liveEstimate.deltaE.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Live Projected Exposure */}
                <div
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    liveEstimate.status === 'Critical'
                      ? 'bg-red-50 border-red-200 text-red-900'
                      : liveEstimate.status === 'Warning'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600">
                      Projected Exposure
                    </span>
                    <span className="font-mono text-lg font-black">{liveEstimate.dose.toFixed(1)} PPM·h</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                      liveEstimate.status === 'Critical'
                        ? 'bg-red-600 text-white border-red-700'
                        : liveEstimate.status === 'Warning'
                        ? 'bg-amber-500 text-slate-950 border-amber-600'
                        : 'bg-emerald-600 text-white border-emerald-700'
                    }`}
                  >
                    {liveEstimate.status}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative w-full h-[400px] rounded-2xl overflow-hidden border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-all ${
                isDragging ? 'border-orange-500 bg-orange-50/20' : 'border-slate-300 bg-slate-900 text-white'
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-orange-600/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                  <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Upload Dosimeter Photo</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Drag and drop a photo of the wristband dosimeter, or select a file from your device (JPG, PNG, WEBP).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">folder_open</span>
                  <span>Select Image from Files</span>
                </button>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInputChange}
          />
        </div>
      )}

      {/* Worker Assignment & Plant Telemetry Settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Worker & Badge Selection */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-orange-600">badge</span>
              Worker & Badge Association
            </span>
            {detectedQr ? (
              <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">verified</span>
                QR Synced: {detectedQr.rawText}
              </span>
            ) : (
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Shift Active
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-600">Refinery Personnel:</label>
            <select
              value={selectedWorkerId}
              onChange={(e) => {
                setSelectedWorkerId(e.target.value);
                const w = currentWorkers.find((item) => item.workerId === e.target.value);
                if (w) {
                  setCustomBadgeId(w.badgeId);
                }
              }}
              className="px-3 py-1.5 bg-slate-50 text-slate-900 text-xs font-semibold rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
            >
              {currentWorkers.map((w) => (
                <option key={w.workerId} value={w.workerId}>
                  {w.workerName} ({w.workerId}) — {w.department}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Badge ID:</label>
              <input
                type="text"
                value={customBadgeId}
                onChange={(e) => setCustomBadgeId(e.target.value)}
                className="w-full px-2.5 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Assigned Shift:</label>
              <span className="block px-2.5 py-1 bg-slate-100 rounded text-slate-700 font-medium text-xs truncate">
                {activeWorker.shift || 'Shift B'}
              </span>
            </div>
          </div>
        </div>

        {/* Plant Micro-Climate Controls */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-orange-600">thermostat</span>
              Plant Environmental Kinetics Factors
            </span>
            <span className="font-mono text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
              Bias: {liveKineticFactor}x
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium">Ambient Temperature:</span>
                <span className="font-mono font-bold text-slate-900">{tempC.toFixed(1)}°C</span>
              </div>
              <input
                type="range"
                min="15"
                max="50"
                step="0.5"
                value={tempC}
                onChange={(e) => setTempC(parseFloat(e.target.value))}
                className="w-full accent-orange-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium">Relative Humidity:</span>
                <span className="font-mono font-bold text-slate-900">{humidityRH}% RH</span>
              </div>
              <input
                type="range"
                min="20"
                max="95"
                step="1"
                value={humidityRH}
                onChange={(e) => setHumidityRH(parseInt(e.target.value))}
                className="w-full accent-orange-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="text-[10px] text-slate-500 font-mono bg-slate-50 p-1.5 rounded border border-slate-200">
            Kinetics adjust Arrhenius reaction velocity & membrane gas diffusion coefficient.
          </div>
        </div>
      </div>

      {/* Pre-Scan Quality Verification Checklist */}
      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-col space-y-2 border border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-slate-900">Pre-Scan Spectrophotometric Protocol</span>
            <span className="text-[10px] text-slate-500 font-mono">ISO-45001</span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] text-emerald-600">check</span>
            Ready for SpectroCV Analysis
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
            <span className="text-slate-800 font-medium text-[11px]">Wristband in Frame</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
            <span className="text-slate-800 font-medium text-[11px]">Reference Scale OK</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
            <span className="text-slate-800 font-medium text-[11px]">D65 White Point</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
            <span className="text-slate-800 font-medium text-[11px]">Zero Specular Glare</span>
          </div>
        </div>
      </div>

      {/* Primary Action Button: Run SpectroCV Analysis */}
      <div className="pt-1">
        <button
          id="capture-analyse-btn"
          type="button"
          onClick={handleRunAnalysis}
          className="w-full h-13 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-orange-950/20 transition-all active:scale-[0.98] cursor-pointer text-sm"
        >
          <span className="material-symbols-outlined text-[22px]">analytics</span>
          <span>Run SpectroCV Chemical & Exposure Analysis</span>
        </button>
      </div>

      {/* Floating Hardware QR Audio/Visual Confirmation Toast */}
      {qrScanNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl border border-emerald-400 shadow-2xl flex items-center gap-3 animate-bounce">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
            <span className="material-symbols-outlined text-[20px]">check</span>
          </div>
          <div className="text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-emerald-400">Hardware QR Auto-Assigned</span>
              <span className="text-[9px] bg-emerald-900 text-emerald-300 font-mono px-1 rounded">MATCHED</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5 max-w-xs">{qrScanNotice}</p>
          </div>
        </div>
      )}
    </div>
  );
};
