/**
 * SulfiTrack Optical & Chemometric Computer Vision Utilities
 * 
 * Implements automated strip boundary detection, layout identification
 * (Standard Strip with Left Window vs Wristband Enclosure with Center Aperture),
 * outlier-resistant ROI color extraction, and in-situ D65 white-point normalization.
 */

import jsQR from 'jsqr';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ROI {
  x: number; // Top-left x in image pixels
  y: number; // Top-left y in image pixels
  width: number;
  height: number;
}

export interface NormalizedROI {
  xPct: number; // 0 to 100% of image width
  yPct: number; // 0 to 100% of image height
  widthPct: number;
  heightPct: number;
}

export interface DecodedQRInfo {
  detected: boolean;
  rawText: string | null;
  badgeId: string | null;
  workerId: string | null;
  workerName: string | null;
  department: string | null;
  shift?: string | null;
  confidence: number;
  location?: NormalizedROI;
}

export type DosimeterLayout = 'standard-strip' | 'wristband-center' | 'legacy-left';

export interface ReferenceSwatch {
  id: string;
  letter: string;
  label: string;
  ppmH: number;
  hex: string;
  rgb: RGB;
  normalizedHex: string;
  normalizedRgb: RGB;
  roiNormalized: NormalizedROI;
}

export interface DosimeterValidationResult {
  isValid: boolean;
  score: number;
  rejectionReason?: string;
  checks: {
    substrate: boolean;
    aspect: boolean;
    brandTitle: boolean;
    centerFeature: boolean;
    qrPattern: boolean;
  };
}

export interface DosimeterCVResult {
  cardBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
  layout: DosimeterLayout;
  layoutLabel: string;
  patchRoi: ROI;
  patchRoiNormalized: NormalizedROI;
  whiteRefRoi: ROI;
  whiteRefRoiNormalized: NormalizedROI;
  referenceSwatches?: ReferenceSwatch[];
  sampledRgb: RGB;
  sampledHex: string;
  whiteRefRgb: RGB;
  whiteRefHex: string;
  normalizedRgb: RGB;
  normalizedHex: string;
  estimatedExposure: number;
  status: 'Safe' | 'Warning' | 'Critical';
  deltaE: number;
  qrInfo?: DecodedQRInfo;
  validation: DosimeterValidationResult;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Robust area sampling from HTML5 Canvas with outlier (glare & shadow line) rejection
 */
export function sampleAreaRGB(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  canvasW: number,
  canvasH: number
): RGB {
  const safeX = Math.max(0, Math.min(canvasW - 1, Math.floor(x)));
  const safeY = Math.max(0, Math.min(canvasH - 1, Math.floor(y)));
  const safeW = Math.max(1, Math.min(canvasW - safeX, Math.floor(w)));
  const safeH = Math.max(1, Math.min(canvasH - safeY, Math.floor(h)));

  const imgData = ctx.getImageData(safeX, safeY, safeW, safeH).data;
  const rList: number[] = [];
  const gList: number[] = [];
  const bList: number[] = [];

  for (let i = 0; i < imgData.length; i += 4) {
    const r = imgData[i];
    const g = imgData[i + 1];
    const b = imgData[i + 2];

    // Exclude extreme specular glare highlights
    if (r > 252 && g > 252 && b > 252) continue;
    // Exclude deep edge drop-shadows / border lines
    if (r < 12 && g < 12 && b < 12) continue;

    rList.push(r);
    gList.push(g);
    bList.push(b);
  }

  if (rList.length === 0) {
    // If all excluded, take straight center average
    const centerIdx = (Math.floor(safeH / 2) * safeW + Math.floor(safeW / 2)) * 4;
    return {
      r: imgData[centerIdx] || 128,
      g: imgData[centerIdx + 1] || 128,
      b: imgData[centerIdx + 2] || 128
    };
  }

  // Median / trimmed mean for chemometric robustness
  rList.sort((a, b) => a - b);
  gList.sort((a, b) => a - b);
  bList.sort((a, b) => a - b);

  const trimStart = Math.floor(rList.length * 0.15);
  const trimEnd = Math.max(trimStart + 1, Math.floor(rList.length * 0.85));

  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  for (let i = trimStart; i < trimEnd; i++) {
    sumR += rList[i];
    sumG += gList[i];
    sumB += bList[i];
    count++;
  }

  return {
    r: Math.round(sumR / count),
    g: Math.round(sumG / count),
    b: Math.round(sumB / count)
  };
}

/**
 * Apply in-situ D65 white-point normalization
 * Normalizes sample color against the factory reference paper baseline (245, 243, 236)
 */
export function normalizeWithWhiteRef(sample: RGB, whiteRef: RGB): RGB {
  if (whiteRef.r < 30 || whiteRef.g < 30 || whiteRef.b < 30) {
    return sample;
  }
  const baseline = { r: 245, g: 243, b: 236 };
  return {
    r: Math.min(255, Math.max(0, Math.round((sample.r / whiteRef.r) * baseline.r))),
    g: Math.min(255, Math.max(0, Math.round((sample.g / whiteRef.g) * baseline.g))),
    b: Math.min(255, Math.max(0, Math.round((sample.b / whiteRef.b) * baseline.b)))
  };
}

/**
 * Convert RGB to CIELAB coordinates
 */
export function rgbToCielab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  let rLin = r / 255;
  let gLin = g / 255;
  let bLin = b / 255;

  rLin = rLin > 0.04045 ? Math.pow((rLin + 0.055) / 1.055, 2.4) : rLin / 12.92;
  gLin = gLin > 0.04045 ? Math.pow((gLin + 0.055) / 1.055, 2.4) : gLin / 12.92;
  bLin = bLin > 0.04045 ? Math.pow((bLin + 0.055) / 1.055, 2.4) : bLin / 12.92;

  const X = (rLin * 0.4124564 + gLin * 0.3575761 + bLin * 0.1804375) * 100;
  const Y = (rLin * 0.2126729 + gLin * 0.7151522 + bLin * 0.0721750) * 100;
  const Z = (rLin * 0.0193339 + gLin * 0.1191920 + bLin * 0.9503041) * 100;

  const xr = X / 95.047;
  const yr = Y / 100.0;
  const zr = Z / 108.883;

  const eps = 0.008856;
  const kap = 903.3;

  const fx = xr > eps ? Math.cbrt(xr) : (kap * xr + 16) / 116;
  const fy = yr > eps ? Math.cbrt(yr) : (kap * yr + 16) / 116;
  const fz = zr > eps ? Math.cbrt(zr) : (kap * zr + 16) / 116;

  const L = Math.max(0, 116 * fy - 16);
  const a = 500 * (fx - fy);
  const bVal = 200 * (fy - fz);

  return { L, a, b: bVal };
}

/**
 * Fast client-side estimate of dosage based on normalized RGB
 */
export function quickEstimateExposure(
  normRgb: RGB,
  tempC = 31.0,
  humidityRH = 64.0
): { dose: number; status: 'Safe' | 'Warning' | 'Critical'; deltaE: number } {
  const baseLab = rgbToCielab(245, 243, 236);
  const sampleLab = rgbToCielab(normRgb.r, normRgb.g, normRgb.b);

  const dL = baseLab.L - sampleLab.L;
  const da = baseLab.a - sampleLab.a;
  const db = baseLab.b - sampleLab.b;
  const rawDeltaE = Math.sqrt(dL * dL + da * da + db * db);

  const deltaLightness = Math.max(0, baseLab.L - sampleLab.L);
  let normDeltaE = rawDeltaE / 27.8;
  if (deltaLightness > 35) {
    normDeltaE += (deltaLightness - 35) * 0.035;
  }
  normDeltaE = parseFloat(normDeltaE.toFixed(2));

  const kineticFactor = (1.0 + 0.012 * (tempC - 25.0)) * (1.0 + 0.003 * (humidityRH - 50.0));

  let baseDose = 0;
  if (normDeltaE <= 0.25) {
    // Pristine unexposed white baseline
    baseDose = Math.max(0.1, normDeltaE * 1.5);
  } else if (normDeltaE <= 0.8) {
    baseDose = 0.4 + (normDeltaE - 0.25) * 2.8;
  } else if (normDeltaE <= 1.8) {
    baseDose = 1.9 + (normDeltaE - 0.8) * 3.2;
  } else if (normDeltaE <= 3.2) {
    baseDose = 5.1 + (normDeltaE - 1.8) * 3.5;
  } else {
    // Saturated chemical darkening or Swatch E/Black
    baseDose = 10.0 + (normDeltaE - 3.2) * 4.6;
  }

  const dose = parseFloat((baseDose * kineticFactor).toFixed(1));
  const status: 'Safe' | 'Warning' | 'Critical' =
    dose >= 10.0 ? 'Critical' : dose >= 5.0 ? 'Warning' : 'Safe';

  return { dose, status, deltaE: normDeltaE };
}

/**
 * Main Computer Vision Detection Algorithm
 * Analyzes canvas pixels, finds dosimeter card boundaries, classifies strip layout,
 * locates the active sensing window and in-situ white reference, and extracts normalized color.
 */
export function detectDosimeterPatch(
  canvas: HTMLCanvasElement,
  userOverrideLayout?: DosimeterLayout
): DosimeterCVResult {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;

  if (!ctx || w === 0 || h === 0) {
    const fallbackRgb = { r: 245, g: 243, b: 236 };
    return {
      cardBounds: { minX: 0, maxX: w, minY: 0, maxY: h, width: w, height: h },
      layout: 'standard-strip',
      layoutLabel: 'SulfiTrack Standard Strip (Center H₂S Reaction Window)',
      patchRoi: { x: w * 0.34, y: h * 0.35, width: w * 0.34, height: h * 0.35 },
      patchRoiNormalized: { xPct: 34, yPct: 35, widthPct: 34, heightPct: 35 },
      whiteRefRoi: { x: w * 0.16, y: h * 0.16, width: w * 0.09, height: h * 0.10 },
      whiteRefRoiNormalized: { xPct: 16, yPct: 16, widthPct: 9, heightPct: 10 },
      sampledRgb: fallbackRgb,
      sampledHex: rgbToHex(fallbackRgb.r, fallbackRgb.g, fallbackRgb.b),
      whiteRefRgb: { r: 245, g: 243, b: 236 },
      whiteRefHex: '#f5f3ec',
      normalizedRgb: fallbackRgb,
      normalizedHex: rgbToHex(fallbackRgb.r, fallbackRgb.g, fallbackRgb.b),
      estimatedExposure: 0.2,
      status: 'Safe',
      deltaE: 0.15,
      validation: {
        isValid: false,
        score: 0,
        rejectionReason: 'Invalid image dimensions or empty canvas buffer.',
        checks: {
          substrate: false,
          aspect: false,
          brandTitle: false,
          centerFeature: false,
          qrPattern: false
        }
      }
    };
  }

  // 1. Scan vertical profiles to isolate card area
  let minY = 0;
  let maxY = h - 1;
  let foundTop = false;

  for (let y = 0; y < h; y += 4) {
    const rowData = ctx.getImageData(0, y, w, 1).data;
    let brightCount = 0;
    const total = w;

    for (let x = 0; x < w; x += 6) {
      const idx = x * 4;
      const r = rowData[idx];
      const g = rowData[idx + 1];
      const b = rowData[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const diff = Math.max(r, g, b) - Math.min(r, g, b);

      if (lum > 95 && diff < 45) {
        brightCount++;
      }
    }

    const ratio = brightCount / (total / 6);
    if (!foundTop && ratio > 0.18) {
      minY = y;
      foundTop = true;
    }
    if (foundTop && ratio > 0.18) {
      maxY = y;
    }
  }

  let cardH = maxY - minY;
  if (cardH < h * 0.25) {
    minY = 0;
    maxY = h - 1;
    cardH = h;
  }

  const midY = Math.floor((minY + maxY) / 2);

  // 2. Scan horizontal profile along midY to find card X bounds
  const midRowData = ctx.getImageData(0, midY, w, 1).data;
  let minX = 0;
  let maxX = w - 1;

  for (let x = 0; x < w; x += 4) {
    const idx = x * 4;
    const lum = 0.299 * midRowData[idx] + 0.587 * midRowData[idx + 1] + 0.114 * midRowData[idx + 2];
    if (lum > 85) {
      minX = x;
      break;
    }
  }

  for (let x = w - 1; x >= 0; x -= 4) {
    const idx = x * 4;
    const lum = 0.299 * midRowData[idx] + 0.587 * midRowData[idx + 1] + 0.114 * midRowData[idx + 2];
    if (lum > 85) {
      maxX = x;
      break;
    }
  }

  let cardW = maxX - minX;
  if (cardW < w * 0.3) {
    minX = 0;
    maxX = w - 1;
    cardW = w;
  }

  // 3. Layout Detection: Official SulfiTrack Standard Strip is primary
  let layout: DosimeterLayout = userOverrideLayout || 'standard-strip';

  if (!userOverrideLayout) {
    // Check if the image has thick dark wristband bezel at the very top/bottom
    const topOuter = sampleAreaRGB(ctx, w * 0.5, Math.max(2, minY * 0.4), 25, 10, w, h);
    if (topOuter.r < 40 && topOuter.g < 40 && topOuter.b < 40 && minY > h * 0.15) {
      layout = 'wristband-center';
    } else {
      layout = 'standard-strip';
    }
  }

  // 4. Position active chemical patch and white reference ROIs
  let patchRoi: ROI;
  let whiteRefRoi: ROI;
  let layoutLabel = 'SulfiTrack Standard Strip (Center H₂S Reaction Window)';

  if (layout === 'legacy-left') {
    layoutLabel = 'Legacy Prototype Strip (Left Reagent Patch)';
    patchRoi = {
      x: Math.round(minX + cardW * 0.08),
      y: Math.round(minY + cardH * 0.33),
      width: Math.round(cardW * 0.18),
      height: Math.round(cardH * 0.28)
    };
    whiteRefRoi = {
      x: Math.round(minX + cardW * 0.68),
      y: Math.round(minY + cardH * 0.36),
      width: Math.round(cardW * 0.09),
      height: Math.round(cardH * 0.16)
    };
  } else if (layout === 'wristband-center') {
    layoutLabel = 'Wristband Enclosure (Center Viewing Aperture)';
    patchRoi = {
      x: Math.round(minX + cardW * 0.39),
      y: Math.round(minY + cardH * 0.33),
      width: Math.round(cardW * 0.23),
      height: Math.round(cardH * 0.26)
    };
    whiteRefRoi = {
      x: Math.round(minX + cardW * 0.18),
      y: Math.round(minY + cardH * 0.20),
      width: Math.round(cardW * 0.10),
      height: Math.round(cardH * 0.12)
    };
  } else {
    // Official SulfiTrack Standard Strip (Exact geometry from hardware production strips)
    layoutLabel = 'SulfiTrack Standard Strip (Center H₂S Reaction Window)';
    patchRoi = {
      x: Math.round(minX + cardW * 0.34),
      y: Math.round(minY + cardH * 0.35),
      width: Math.round(cardW * 0.34),
      height: Math.round(cardH * 0.35)
    };
    whiteRefRoi = {
      x: Math.round(minX + cardW * 0.16),
      y: Math.round(minY + cardH * 0.16),
      width: Math.round(cardW * 0.09),
      height: Math.round(cardH * 0.09)
    };
  }

  // 5. Extract sampled colors with area averaging
  const sampledRgb = sampleAreaRGB(ctx, patchRoi.x, patchRoi.y, patchRoi.width, patchRoi.height, w, h);
  let whiteRefRgb = sampleAreaRGB(ctx, whiteRefRoi.x, whiteRefRoi.y, whiteRefRoi.width, whiteRefRoi.height, w, h);

  // If white reference sampled too dark (e.g. hit text or shadow), fallback to upper card background
  if (whiteRefRgb.r < 90 || whiteRefRgb.g < 90 || whiteRefRgb.b < 90) {
    whiteRefRgb = sampleAreaRGB(ctx, minX + cardW * 0.5, minY + cardH * 0.12, cardW * 0.15, cardH * 0.08, w, h);
  }

  // 6. Compute in-situ D65 normalized RGB
  const normalizedRgb = normalizeWithWhiteRef(sampledRgb, whiteRefRgb);
  const sampledHex = rgbToHex(sampledRgb.r, sampledRgb.g, sampledRgb.b);
  const whiteRefHex = rgbToHex(whiteRefRgb.r, whiteRefRgb.g, whiteRefRgb.b);
  const normalizedHex = rgbToHex(normalizedRgb.r, normalizedRgb.g, normalizedRgb.b);

  // 7. Calculate estimated dosage
  const { dose, status, deltaE } = quickEstimateExposure(normalizedRgb);

  // 8. Sample the 5 Physical Reference Swatches (A, B, C, D, E) for internal validation
  const sampleSwatch = (
    id: string,
    letter: string,
    xPct: number,
    yPct: number,
    wPct: number,
    hPct: number,
    label: string,
    ppmH: number
  ): ReferenceSwatch => {
    const sx = Math.round(minX + cardW * xPct);
    const sy = Math.round(minY + cardH * yPct);
    const sw = Math.round(cardW * wPct);
    const sh = Math.round(cardH * hPct);
    const raw = sampleAreaRGB(ctx, sx, sy, sw, sh, w, h);
    const norm = normalizeWithWhiteRef(raw, whiteRefRgb);
    return {
      id,
      letter,
      label,
      ppmH,
      rgb: raw,
      hex: rgbToHex(raw.r, raw.g, raw.b),
      normalizedRgb: norm,
      normalizedHex: rgbToHex(norm.r, norm.g, norm.b),
      roiNormalized: {
        xPct: parseFloat(((sx / w) * 100).toFixed(1)),
        yPct: parseFloat(((sy / h) * 100).toFixed(1)),
        widthPct: parseFloat(((sw / w) * 100).toFixed(1)),
        heightPct: parseFloat(((sh / h) * 100).toFixed(1))
      }
    };
  };

  const referenceSwatches: ReferenceSwatch[] = [
    sampleSwatch('swatch-a', 'A', 0.085, 0.46, 0.045, 0.11, 'Swatch A: Blank Standard (0 PPM·h)', 0.0),
    sampleSwatch('swatch-b', 'B', 0.150, 0.46, 0.045, 0.11, 'Swatch B: Low Exposure (2.5 PPM·h)', 2.5),
    sampleSwatch('swatch-c', 'C', 0.215, 0.46, 0.045, 0.11, 'Swatch C: Shift Permissible (5.0 PPM·h)', 5.0),
    sampleSwatch('swatch-d', 'D', 0.715, 0.46, 0.045, 0.11, 'Swatch D: Shift Ceiling (10.0 PPM·h)', 10.0),
    sampleSwatch('swatch-e', 'E', 0.780, 0.46, 0.045, 0.11, 'Swatch E: Hazardous Saturated (12.5 PPM·h)', 12.5)
  ];

  // 9. Auto-Scan QR Badge if visible on canvas
  const qrInfo = scanDosimeterQRSync(canvas);

  // 10. Run Automated Dosimeter Authenticity Validation
  const validation = validateDosimeterImage(canvas);
  // If QR code was verified by jsQR, ensure validation passes
  if (qrInfo?.detected) {
    validation.isValid = true;
    validation.checks.qrPattern = true;
  }

  return {
    cardBounds: { minX, maxX, minY, maxY, width: cardW, height: cardH },
    layout,
    layoutLabel,
    patchRoi,
    patchRoiNormalized: {
      xPct: parseFloat(((patchRoi.x / w) * 100).toFixed(1)),
      yPct: parseFloat(((patchRoi.y / h) * 100).toFixed(1)),
      widthPct: parseFloat(((patchRoi.width / w) * 100).toFixed(1)),
      heightPct: parseFloat(((patchRoi.height / h) * 100).toFixed(1))
    },
    whiteRefRoi,
    whiteRefRoiNormalized: {
      xPct: parseFloat(((whiteRefRoi.x / w) * 100).toFixed(1)),
      yPct: parseFloat(((whiteRefRoi.y / h) * 100).toFixed(1)),
      widthPct: parseFloat(((whiteRefRoi.width / w) * 100).toFixed(1)),
      heightPct: parseFloat(((whiteRefRoi.height / h) * 100).toFixed(1))
    },
    referenceSwatches,
    sampledRgb,
    sampledHex,
    whiteRefRgb,
    whiteRefHex,
    normalizedRgb,
    normalizedHex,
    estimatedExposure: dose,
    status,
    deltaE,
    qrInfo,
    validation
  };
}

/**
 * Rigorously validates whether an image/frame depicts an authentic SulfiTrack dosimeter strip
 * or wristband, rejecting non-strip images (faces, screenshots, random objects, etc.)
 */
export function validateDosimeterImage(canvas: HTMLCanvasElement): DosimeterValidationResult {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || w < 20 || h < 20) {
    return {
      isValid: false,
      score: 0,
      rejectionReason: 'Invalid image dimensions or rendering context',
      checks: { substrate: false, aspect: false, brandTitle: false, centerFeature: false, qrPattern: false }
    };
  }

  const imgData = ctx.getImageData(0, 0, w, h).data;

  // 1. Scan vertical profile to find card bounds
  let foundTop = false, minY = 0, maxY = h - 1;
  for (let y = 0; y < h; y += 4) {
    let brightCount = 0;
    for (let x = 0; x < w; x += 8) {
      const idx = (y * w + x) * 4;
      const r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const diff = Math.max(r, g, b) - Math.min(r, g, b);
      if (lum > 95 && diff < 48) brightCount++;
    }
    const ratio = brightCount / (w / 8);
    if (!foundTop && ratio > 0.18) { minY = y; foundTop = true; }
    if (foundTop && ratio > 0.18) { maxY = y; }
  }

  const cardH = maxY - minY;
  const midY = Math.floor((minY + maxY) / 2);
  let minX = 0, maxX = w - 1;

  for (let x = 0; x < w; x += 4) {
    const idx = (midY * w + x) * 4;
    const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
    if (lum > 85) { minX = x; break; }
  }
  for (let x = w - 1; x >= 0; x -= 4) {
    const idx = (midY * w + x) * 4;
    const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
    if (lum > 85) { maxX = x; break; }
  }

  const cardW = maxX - minX;
  const cardAspect = cardW / Math.max(1, cardH);

  // 2. Measure substrate white density inside card bounds
  let cardPixels = 0, cardWhiteCount = 0;
  for (let y = minY; y <= maxY; y += 4) {
    for (let x = minX; x <= maxX; x += 4) {
      const idx = (y * w + x) * 4;
      const r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const diff = Math.max(r, g, b) - Math.min(r, g, b);
      cardPixels++;
      if (lum > 105 && diff < 48) cardWhiteCount++;
    }
  }

  const whiteDensity = cardPixels > 0 ? cardWhiteCount / cardPixels : 0;

  // 3. Scan brand text 'SULFITRACK' in upper-left
  let brandEdges = 0;
  const bY1 = Math.round(minY + cardH * 0.08);
  const bY2 = Math.round(minY + cardH * 0.26);
  const bX1 = Math.round(minX + cardW * 0.03);
  const bX2 = Math.round(minX + cardW * 0.32);

  for (let y = bY1; y <= bY2; y += 3) {
    for (let x = bX1; x <= bX2; x += 2) {
      const idx1 = (y * w + x) * 4;
      const idx2 = (y * w + (x + 2)) * 4;
      const l1 = 0.299 * imgData[idx1] + 0.587 * imgData[idx1 + 1] + 0.114 * imgData[idx1 + 2];
      const l2 = 0.299 * imgData[idx2] + 0.587 * imgData[idx2 + 1] + 0.114 * imgData[idx2 + 2];
      if (Math.abs(l1 - l2) > 40) brandEdges++;
    }
  }

  // 4. Scan center text 'H2S PASSIVE STRIP' / aperture border
  let centerFeatureEdges = 0;
  const cY1 = Math.round(minY + cardH * 0.15);
  const cY2 = Math.round(minY + cardH * 0.36);
  const cX1 = Math.round(minX + cardW * 0.33);
  const cX2 = Math.round(minX + cardW * 0.68);

  for (let y = cY1; y <= cY2; y += 3) {
    for (let x = cX1; x <= cX2; x += 2) {
      const idx1 = (y * w + x) * 4;
      const idx2 = (y * w + (x + 2)) * 4;
      const l1 = 0.299 * imgData[idx1] + 0.587 * imgData[idx1 + 1] + 0.114 * imgData[idx1 + 2];
      const l2 = 0.299 * imgData[idx2] + 0.587 * imgData[idx2 + 1] + 0.114 * imgData[idx2 + 2];
      if (Math.abs(l1 - l2) > 40) centerFeatureEdges++;
    }
  }

  // 5. Scan QR pattern density in right quadrant
  let qrEdges = 0;
  const qY1 = Math.round(minY + cardH * 0.30);
  const qY2 = Math.round(minY + cardH * 0.75);
  const qX1 = Math.round(minX + cardW * 0.78);
  const qX2 = Math.round(minX + cardW * 0.98);

  for (let y = qY1; y <= qY2; y += 3) {
    for (let x = qX1; x <= qX2; x += 2) {
      const idx1 = (y * w + x) * 4;
      const idx2 = (y * w + (x + 2)) * 4;
      const l1 = 0.299 * imgData[idx1] + 0.587 * imgData[idx1 + 1] + 0.114 * imgData[idx1 + 2];
      const l2 = 0.299 * imgData[idx2] + 0.587 * imgData[idx2 + 1] + 0.114 * imgData[idx2 + 2];
      if (Math.abs(l1 - l2) > 40) qrEdges++;
    }
  }

  const hasSubstrate = whiteDensity >= 0.26;
  const hasAspect = cardAspect >= 1.1 && cardAspect <= 4.5;
  const hasBrand = brandEdges >= 90;
  const hasCenterFeature = centerFeatureEdges >= 70;
  const hasQRPattern = qrEdges >= 105;

  let markerCount = 0;
  if (hasBrand) markerCount++;
  if (hasCenterFeature) markerCount++;
  if (hasQRPattern) markerCount++;

  let score = 0;
  if (hasSubstrate) score += 30;
  if (hasAspect) score += 20;
  if (hasBrand) score += 25;
  if (hasCenterFeature) score += 25;
  if (hasQRPattern) score += 25;

  const isValid = hasSubstrate && hasAspect && (markerCount >= 2 || (hasQRPattern && markerCount >= 1));

  let rejectionReason: string | undefined;
  if (!isValid) {
    if (!hasSubstrate) {
      rejectionReason = 'No dosimeter card substrate detected. Please ensure the white dosimeter card is clearly visible.';
    } else if (!hasAspect) {
      rejectionReason = 'Invalid card aspect ratio. The dosimeter strip must be positioned horizontally in the frame.';
    } else {
      rejectionReason = 'Missing SulfiTrack strip markings (brand title, H2S aperture, or calibration QR code not detected).';
    }
  }

  return {
    isValid,
    score,
    rejectionReason,
    checks: {
      substrate: hasSubstrate,
      aspect: hasAspect,
      brandTitle: hasBrand,
      centerFeature: hasCenterFeature,
      qrPattern: hasQRPattern
    }
  };
}

/**
 * Pleasant Web Audio API scanner chime for successful QR detection
 */
export function playQRSound(): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12); // A6 octave chirp

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch {
    // Audio autostart restrictions or unsupported browser
  }
}

function calculateQRBoundingBoxPct(
  loc: any,
  frameW: number,
  frameH: number,
  offsetX = 0,
  offsetY = 0,
  totalW = frameW,
  totalH = frameH
): NormalizedROI | undefined {
  if (!loc || !loc.topLeftCorner) return undefined;
  const xs = [loc.topLeftCorner.x, loc.topRightCorner.x, loc.bottomRightCorner.x, loc.bottomLeftCorner.x];
  const ys = [loc.topLeftCorner.y, loc.topRightCorner.y, loc.bottomRightCorner.y, loc.bottomLeftCorner.y];
  const minX = Math.min(...xs) + offsetX;
  const maxX = Math.max(...xs) + offsetX;
  const minY = Math.min(...ys) + offsetY;
  const maxY = Math.max(...ys) + offsetY;

  return {
    xPct: parseFloat(Math.max(0, Math.min(100, (minX / totalW) * 100)).toFixed(1)),
    yPct: parseFloat(Math.max(0, Math.min(100, (minY / totalH) * 100)).toFixed(1)),
    widthPct: parseFloat(Math.max(2, Math.min(100, ((maxX - minX) / totalW) * 100)).toFixed(1)),
    heightPct: parseFloat(Math.max(2, Math.min(100, ((maxY - minY) / totalH) * 100)).toFixed(1))
  };
}

/**
 * Match decoded QR payload to known worker profiles and dosimeter badge conventions
 */
export function parseDecodedQRText(
  rawText: string,
  workers: Array<{ workerId: string; workerName: string; badgeId: string; department?: string; shift?: string }> = [],
  location?: NormalizedROI,
  confidence = 0.95
): DecodedQRInfo {
  const clean = (rawText || '').trim();

  // 1. JSON payload: e.g. {"badgeId":"ST-WB-00124","workerId":"WRK-1048"}
  if (clean.startsWith('{') && clean.endsWith('}')) {
    try {
      const parsed = JSON.parse(clean);
      const bId = parsed.badgeId || parsed.badge || parsed.id || null;
      const wId = parsed.workerId || parsed.worker || null;
      const matched = workers.find((w) => (bId && w.badgeId === bId) || (wId && w.workerId === wId));
      return {
        detected: true,
        rawText: clean,
        badgeId: bId || matched?.badgeId || 'ST-WB-00124',
        workerId: wId || matched?.workerId || 'WRK-1048',
        workerName: matched?.workerName || 'Rajesh Kumar',
        department: matched?.department || 'Hydrocracker Unit (HCU-2)',
        shift: matched?.shift || 'Evening (Shift B)',
        confidence,
        location
      };
    } catch {
      // Not JSON, continue
    }
  }

  // 2. URL parameters: e.g. https://sulfitrack.vercel.app/?badge=ST-WB-00124
  if (clean.includes('http://') || clean.includes('https://') || clean.includes('?')) {
    try {
      const url = new URL(clean.startsWith('http') ? clean : `https://dummy.com/${clean}`);
      const bParam = url.searchParams.get('badge') || url.searchParams.get('badgeId');
      const wParam = url.searchParams.get('worker') || url.searchParams.get('workerId');
      if (bParam || wParam) {
        const matched = workers.find((w) => (bParam && w.badgeId === bParam) || (wParam && w.workerId === wParam));
        return {
          detected: true,
          rawText: clean,
          badgeId: bParam || matched?.badgeId || 'ST-WB-00124',
          workerId: wParam || matched?.workerId || 'WRK-1048',
          workerName: matched?.workerName || 'Rajesh Kumar',
          department: matched?.department || 'Hydrocracker Unit (HCU-2)',
          shift: matched?.shift || 'Evening (Shift B)',
          confidence,
          location
        };
      }
    } catch {
      // Continue
    }
  }

  // 3. Regex for ST-WB-XXXXX
  const badgeMatch = clean.match(/ST-WB-[0-9A-Z]+/i);
  if (badgeMatch) {
    const badgeId = badgeMatch[0].toUpperCase();
    const matched = workers.find((w) => w.badgeId.toUpperCase() === badgeId);
    return {
      detected: true,
      rawText: clean,
      badgeId,
      workerId: matched?.workerId || 'WRK-1048',
      workerName: matched?.workerName || 'Rajesh Kumar',
      department: matched?.department || 'Hydrocracker Unit (HCU-2)',
      shift: matched?.shift || 'Evening (Shift B)',
      confidence,
      location
    };
  }

  // 4. Regex for WRK-XXXX
  const workerMatch = clean.match(/WRK-[0-9A-Z]+/i);
  if (workerMatch) {
    const workerId = workerMatch[0].toUpperCase();
    const matched = workers.find((w) => w.workerId.toUpperCase() === workerId);
    return {
      detected: true,
      rawText: clean,
      badgeId: matched?.badgeId || 'ST-WB-00124',
      workerId,
      workerName: matched?.workerName || 'Rajesh Kumar',
      department: matched?.department || 'Hydrocracker Unit (HCU-2)',
      shift: matched?.shift || 'Evening (Shift B)',
      confidence,
      location
    };
  }

  // 5. Match physical test strip hardware standard "ST-DEMO-02" or "DEMO 02"
  if (/DEMO/i.test(clean)) {
    if (/02|2/i.test(clean)) {
      const matched = workers.find((w) => w.badgeId === 'ST-WB-00124') || workers[0];
      return {
        detected: true,
        rawText: clean,
        badgeId: matched?.badgeId || 'ST-WB-00124',
        workerId: matched?.workerId || 'WRK-1048',
        workerName: matched?.workerName || 'Rajesh Kumar',
        department: matched?.department || 'Hydrocracker Unit (HCU-2)',
        shift: matched?.shift || 'Evening (Shift B)',
        confidence,
        location
      };
    } else {
      const matched = workers.find((w) => w.badgeId === 'ST-WB-00128') || workers[1];
      return {
        detected: true,
        rawText: clean,
        badgeId: matched?.badgeId || 'ST-WB-00128',
        workerId: matched?.workerId || 'WRK-1052',
        workerName: matched?.workerName || 'Arjun Patel',
        department: matched?.department || 'Sulfur Recovery Unit (SRU-3)',
        shift: matched?.shift || 'Morning (Shift A)',
        confidence,
        location
      };
    }
  }

  // 6. Generic string fallback
  const matched = workers.find((w) => w.badgeId === clean || w.workerId === clean);
  return {
    detected: true,
    rawText: clean,
    badgeId: matched?.badgeId || clean,
    workerId: matched?.workerId || 'WRK-1048',
    workerName: matched?.workerName || 'Rajesh Kumar',
    department: matched?.department || 'Hydrocracker Unit (HCU-2)',
    shift: matched?.shift || 'Evening (Shift B)',
    confidence: 0.85,
    location
  };
}

/**
 * Fast synchronous QR code scan using jsQR with multi-pass bounding (full frame & right quadrant)
 */
export function scanDosimeterQRSync(
  canvas: HTMLCanvasElement,
  workers: Array<{ workerId: string; workerName: string; badgeId: string; department?: string; shift?: string }> = []
): DecodedQRInfo {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width === 0 || canvas.height === 0) {
    return { detected: false, rawText: null, badgeId: null, workerId: null, workerName: null, department: null, confidence: 0 };
  }

  const w = canvas.width;
  const h = canvas.height;

  // Pass 1: Full Frame
  try {
    const fullImgData = ctx.getImageData(0, 0, w, h);
    const code = jsQR(fullImgData.data, w, h, { inversionAttempts: 'attemptBoth' });
    if (code && code.data) {
      const loc = calculateQRBoundingBoxPct(code.location, w, h);
      return parseDecodedQRText(code.data, workers, loc, 0.96);
    }
  } catch {
    // Continue to sub-region
  }

  // Pass 2: Right-hand dosimeter quadrant (where strip QR codes are positioned)
  try {
    const startX = Math.floor(w * 0.52);
    const startY = Math.floor(h * 0.10);
    const cropW = Math.floor(w * 0.48);
    const cropH = Math.floor(h * 0.80);

    const cropData = ctx.getImageData(startX, startY, cropW, cropH);
    const code = jsQR(cropData.data, cropW, cropH, { inversionAttempts: 'attemptBoth' });
    if (code && code.data) {
      const loc = calculateQRBoundingBoxPct(code.location, cropW, cropH, startX, startY, w, h);
      return parseDecodedQRText(code.data, workers, loc, 0.94);
    }

    // Pass 3: Contrast boosted right-hand quadrant
    const enhancedData = ctx.createImageData(cropW, cropH);
    for (let i = 0; i < cropData.data.length; i += 4) {
      const r = cropData.data[i];
      const g = cropData.data[i + 1];
      const b = cropData.data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const val = lum > 135 ? 250 : (lum < 85 ? 10 : Math.round((lum - 85) * (240 / 50)));
      enhancedData.data[i] = val;
      enhancedData.data[i + 1] = val;
      enhancedData.data[i + 2] = val;
      enhancedData.data[i + 3] = 255;
    }
    const enhancedCode = jsQR(enhancedData.data, cropW, cropH, { inversionAttempts: 'attemptBoth' });
    if (enhancedCode && enhancedCode.data) {
      const loc = calculateQRBoundingBoxPct(enhancedCode.location, cropW, cropH, startX, startY, w, h);
      return parseDecodedQRText(enhancedCode.data, workers, loc, 0.90);
    }
  } catch {
    // Ignore
  }

  return {
    detected: false,
    rawText: null,
    badgeId: null,
    workerId: null,
    workerName: null,
    department: null,
    confidence: 0
  };
}

/**
 * Universal async QR scanner: checks browser BarcodeDetector first, then jsQR multi-pass
 */
export async function scanDosimeterQR(
  canvas: HTMLCanvasElement,
  workers: Array<{ workerId: string; workerName: string; badgeId: string; department?: string; shift?: string }> = []
): Promise<DecodedQRInfo> {
  const w = canvas.width;
  const h = canvas.height;

  // 1. Native Hardware BarcodeDetector if supported
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      const barcodes = await detector.detect(canvas);
      if (barcodes && barcodes.length > 0) {
        const raw = barcodes[0].rawValue;
        const box = barcodes[0].boundingBox;
        const loc: NormalizedROI | undefined = box
          ? {
              xPct: parseFloat(((box.x / w) * 100).toFixed(1)),
              yPct: parseFloat(((box.y / h) * 100).toFixed(1)),
              widthPct: parseFloat(((box.width / w) * 100).toFixed(1)),
              heightPct: parseFloat(((box.height / h) * 100).toFixed(1))
            }
          : undefined;
        return parseDecodedQRText(raw, workers, loc, 0.98);
      }
    } catch {
      // Fallback to jsQR
    }
  }

  // 2. jsQR synchronous multi-pass
  return scanDosimeterQRSync(canvas, workers);
}
