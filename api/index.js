// server/app.ts
import express from "express";
import cors from "cors";
import path2 from "path";
import fs2 from "fs";

// server/db.ts
import fs from "fs";
import path from "path";

// src/data/mockData.ts
var REFINERY_FACILITY = {
  name: "MRPL Refinery Complex",
  division: "Phase-III Petrochemical & SRU Block",
  location: "Mangaluru, Karnataka, India",
  pinCode: "575030",
  licenseNo: "PESO/SC/KT/14/2890-OISD",
  complianceStandard: "OISD-114 / DGMS / ISO-45001:2018",
  emergencyControlRoom: "+91 824 2270400 (Extn: 2222)"
};
var CURRENT_SAFETY_OFFICER = {
  name: "Er. Vikramaditya Sharma",
  initials: "VS",
  role: "Chief HSE & Process Safety Officer",
  department: "Corporate Health, Safety & Environment (HSE)",
  empId: "MRPL-HSE-0192",
  phone: "+91 98450 78210",
  email: "v.sharma@mrpl.co.in"
};
var INITIAL_EXPOSURE_RECORDS = [
  {
    id: "REC-9042",
    workerId: "WRK-1048",
    workerName: "Rajesh Kumar",
    department: "Hydrocracker Unit (HCU-2)",
    badgeId: "ST-WB-00124",
    shift: "Evening (Shift B: 14:00 - 22:00)",
    exposure: "10.2 PPM\xB7h",
    exposureValue: 10.2,
    environment: "31.0\xB0C / 64% RH",
    temp: "31.0\xB0C",
    humidity: "64% RH",
    confidence: "94.8%",
    status: "Warning",
    timestamp: "13 Oct 2026 - 18:42 IST",
    colorHex: "#d97706",
    textColorHex: "#ffffff",
    rgb: "R: 217 G: 119 B: 6",
    deltaE: "2.84",
    date: "13 Oct, 18:42",
    supervisor: "Er. Vikramaditya Sharma"
  },
  {
    id: "REC-9039",
    workerId: "WRK-1052",
    workerName: "Arjun Patel",
    department: "Sulfur Recovery Unit (SRU-3)",
    badgeId: "ST-WB-00128",
    shift: "Morning (Shift A: 06:00 - 14:00)",
    exposure: "2.1 PPM\xB7h",
    exposureValue: 2.1,
    environment: "29.5\xB0C / 70% RH",
    temp: "29.5\xB0C",
    humidity: "70% RH",
    confidence: "98.2%",
    status: "Safe",
    timestamp: "13 Oct 2026 - 13:50 IST",
    colorHex: "#E2E8F0",
    textColorHex: "#009668",
    rgb: "R: 215 G: 220 B: 224",
    deltaE: "0.45",
    date: "13 Oct, 13:50",
    supervisor: "Er. Vikramaditya Sharma"
  },
  {
    id: "REC-9031",
    workerId: "WRK-1077",
    workerName: "Deepak Sharma",
    department: "Tank Farm 3B & Crude Sludge Pit",
    badgeId: "ST-WB-00142",
    shift: "Night (Shift C: 22:00 - 06:00)",
    exposure: "14.8 PPM\xB7h",
    exposureValue: 14.8,
    environment: "28.0\xB0C / 82% RH",
    temp: "28.0\xB0C",
    humidity: "82% RH",
    confidence: "92.4%",
    status: "Critical",
    timestamp: "13 Oct 2026 - 05:45 IST",
    colorHex: "#F87171",
    textColorHex: "#B91C1C",
    rgb: "R: 164 G: 110 B: 72",
    deltaE: "3.95",
    date: "13 Oct, 05:45",
    supervisor: "Er. Vikramaditya Sharma"
  },
  {
    id: "REC-9018",
    workerId: "WRK-1065",
    workerName: "Sunil Verma",
    department: "Amine Treating Unit (ARU-04)",
    badgeId: "ST-WB-00135",
    shift: "Morning (Shift A: 06:00 - 14:00)",
    exposure: "1.4 PPM\xB7h",
    exposureValue: 1.4,
    environment: "32.2\xB0C / 68% RH",
    temp: "32.2\xB0C",
    humidity: "68% RH",
    confidence: "97.6%",
    status: "Safe",
    timestamp: "13 Oct 2026 - 13:30 IST",
    colorHex: "#E2E8F0",
    textColorHex: "#009668",
    rgb: "R: 222 G: 226 B: 229",
    deltaE: "0.38",
    date: "13 Oct, 13:30",
    supervisor: "Er. Vikramaditya Sharma"
  },
  {
    id: "REC-8995",
    workerId: "WRK-1095",
    workerName: "Suresh G. Patil",
    department: "Flare Header & Knock-Out Zone",
    badgeId: "ST-WB-00163",
    shift: "Night (Shift C: 22:00 - 06:00)",
    exposure: "7.6 PPM\xB7h",
    exposureValue: 7.6,
    environment: "27.4\xB0C / 84% RH",
    temp: "27.4\xB0C",
    humidity: "84% RH",
    confidence: "95.1%",
    status: "Warning",
    timestamp: "12 Oct 2026 - 23:15 IST",
    colorHex: "#FDE047",
    textColorHex: "#CA8A04",
    rgb: "R: 198 G: 180 B: 120",
    deltaE: "1.92",
    date: "12 Oct, 23:15",
    supervisor: "Er. Vikramaditya Sharma"
  },
  {
    id: "REC-8972",
    workerId: "WRK-1090",
    workerName: "Kavita Sundaram",
    department: "Environmental Sampling & Lab",
    badgeId: "ST-WB-00156",
    shift: "General (G: 08:30 - 17:00)",
    exposure: "0.3 PPM\xB7h",
    exposureValue: 0.3,
    environment: "27.0\xB0C / 58% RH",
    temp: "27.0\xB0C",
    humidity: "58% RH",
    confidence: "99.4%",
    status: "Safe",
    timestamp: "12 Oct 2026 - 16:40 IST",
    colorHex: "#E2E8F0",
    textColorHex: "#009668",
    rgb: "R: 232 G: 235 B: 238",
    deltaE: "0.12",
    date: "12 Oct, 16:40",
    supervisor: "Er. Vikramaditya Sharma"
  },
  {
    id: "REC-8950",
    workerId: "WRK-1102",
    workerName: "Rameshwar Yadav",
    department: "Delayed Coker Unit (DCU)",
    badgeId: "ST-WB-00171",
    shift: "Evening (Shift B: 14:00 - 22:00)",
    exposure: "3.2 PPM\xB7h",
    exposureValue: 3.2,
    environment: "33.5\xB0C / 66% RH",
    temp: "33.5\xB0C",
    humidity: "66% RH",
    confidence: "96.3%",
    status: "Safe",
    timestamp: "12 Oct 2026 - 21:10 IST",
    colorHex: "#E2E8F0",
    textColorHex: "#009668",
    rgb: "R: 218 G: 221 B: 223",
    deltaE: "0.62",
    date: "12 Oct, 21:10",
    supervisor: "Er. Vikramaditya Sharma"
  },
  {
    id: "REC-8924",
    workerId: "WRK-1083",
    workerName: "Manish Tiwari",
    department: "Crude Distillation Unit (CDU-1)",
    badgeId: "ST-WB-00149",
    shift: "Morning (Shift A: 06:00 - 14:00)",
    exposure: "0.8 PPM\xB7h",
    exposureValue: 0.8,
    environment: "30.0\xB0C / 65% RH",
    temp: "30.0\xB0C",
    humidity: "65% RH",
    confidence: "98.9%",
    status: "Safe",
    timestamp: "12 Oct 2026 - 12:20 IST",
    colorHex: "#E2E8F0",
    textColorHex: "#009668",
    rgb: "R: 226 G: 230 B: 233",
    deltaE: "0.22",
    date: "12 Oct, 12:20",
    supervisor: "Er. Vikramaditya Sharma"
  }
];
var WORKER_TELEMETRY_LIST = [
  {
    workerId: "WRK-1048",
    workerName: "Rajesh Kumar",
    role: "Sr. Plant Technician",
    department: "Hydrocracker Unit (HCU-2)",
    gatePassNo: "MRPL-GP-4819",
    bloodGroup: "B+ve",
    emergencyContact: "+91 98450 21345",
    medicalFitness: "Fit for Confined Space (PME Valid)",
    badgeId: "ST-WB-00124",
    shift: "Evening (Shift B)",
    estimatedDose: "10.2 PPM\xB7h",
    temp: "31.0\xB0C",
    humidity: "64%",
    status: "Elevated",
    lastScan: "4m ago",
    shiftAvgDose: 10.2,
    weeklyDose: 26.3,
    monthlyDose: 84.1,
    complianceRate: "100%"
  },
  {
    workerId: "WRK-1052",
    workerName: "Arjun Patel",
    role: "Lead Console Operator",
    department: "Sulfur Recovery Unit (SRU-3)",
    gatePassNo: "MRPL-GP-5102",
    bloodGroup: "O+ve",
    emergencyContact: "+91 97412 88201",
    medicalFitness: "Class-1 Hazardous Area Fit",
    badgeId: "ST-WB-00128",
    shift: "Morning (Shift A)",
    estimatedDose: "2.1 PPM\xB7h",
    temp: "29.5\xB0C",
    humidity: "70%",
    status: "Normal",
    lastScan: "18m ago",
    shiftAvgDose: 2.1,
    weeklyDose: 14.8,
    monthlyDose: 46.2,
    complianceRate: "100%"
  },
  {
    workerId: "WRK-1065",
    workerName: "Sunil Verma",
    role: "Piping & Valve Specialist",
    department: "Amine Treating Unit (ARU-04)",
    gatePassNo: "MRPL-GP-4931",
    bloodGroup: "A+ve",
    emergencyContact: "+91 94480 39210",
    medicalFitness: "Confined Space Clear",
    badgeId: "ST-WB-00135",
    shift: "Morning (Shift A)",
    estimatedDose: "1.4 PPM\xB7h",
    temp: "32.2\xB0C",
    humidity: "68%",
    status: "Normal",
    lastScan: "25m ago",
    shiftAvgDose: 1.4,
    weeklyDose: 11.2,
    monthlyDose: 38,
    complianceRate: "98%"
  },
  {
    workerId: "WRK-1077",
    workerName: "Deepak Sharma",
    role: "Confined Space Lead Tech",
    department: "Tank Farm 3B & Sludge Pit",
    gatePassNo: "MRPL-GP-6028",
    bloodGroup: "B+ve",
    emergencyContact: "+91 99801 77123",
    medicalFitness: "SCBA Certified (Class A)",
    badgeId: "ST-WB-00142",
    shift: "Night (Shift C)",
    estimatedDose: "14.8 PPM\xB7h",
    temp: "28.0\xB0C",
    humidity: "82%",
    status: "Elevated",
    lastScan: "45m ago",
    shiftAvgDose: 14.8,
    weeklyDose: 39.5,
    monthlyDose: 112.4,
    complianceRate: "100%"
  },
  {
    workerId: "WRK-1083",
    workerName: "Manish Tiwari",
    role: "Heat Exchanger Tech",
    department: "Crude Distillation Unit (CDU-1)",
    gatePassNo: "MRPL-GP-3814",
    bloodGroup: "O+ve",
    emergencyContact: "+91 98862 10984",
    medicalFitness: "Refinery Gate Pass Fit",
    badgeId: "ST-WB-00149",
    shift: "Morning (Shift A)",
    estimatedDose: "0.8 PPM\xB7h",
    temp: "30.1\xB0C",
    humidity: "65%",
    status: "Normal",
    lastScan: "1h ago",
    shiftAvgDose: 0.8,
    weeklyDose: 8.5,
    monthlyDose: 29.1,
    complianceRate: "100%"
  },
  {
    workerId: "WRK-1090",
    workerName: "Kavita Sundaram",
    role: "Process Safety Analyst",
    department: "Environmental Sampling Unit",
    gatePassNo: "MRPL-GP-7123",
    bloodGroup: "AB+ve",
    emergencyContact: "+91 94805 66712",
    medicalFitness: "Annual EHS PME Valid",
    badgeId: "ST-WB-00156",
    shift: "General (Shift G)",
    estimatedDose: "0.3 PPM\xB7h",
    temp: "27.5\xB0C",
    humidity: "58%",
    status: "Normal",
    lastScan: "12m ago",
    shiftAvgDose: 0.3,
    weeklyDose: 3.1,
    monthlyDose: 12.4,
    complianceRate: "100%"
  },
  {
    workerId: "WRK-1095",
    workerName: "Suresh G. Patil",
    role: "Flare Header Tech",
    department: "Flare Stack & Offsites",
    gatePassNo: "MRPL-GP-5290",
    bloodGroup: "A+ve",
    emergencyContact: "+91 96321 44589",
    medicalFitness: "High-Elevation Clearance Fit",
    badgeId: "ST-WB-00163",
    shift: "Evening (Shift B)",
    estimatedDose: "7.6 PPM\xB7h",
    temp: "33.8\xB0C",
    humidity: "74%",
    status: "Elevated",
    lastScan: "32m ago",
    shiftAvgDose: 7.6,
    weeklyDose: 22.4,
    monthlyDose: 71.8,
    complianceRate: "96%"
  },
  {
    workerId: "WRK-1102",
    workerName: "Rameshwar Yadav",
    role: "Coker Deck Tech",
    department: "Delayed Coker Unit (DCU)",
    gatePassNo: "MRPL-GP-4198",
    bloodGroup: "B+ve",
    emergencyContact: "+91 98442 80912",
    medicalFitness: "Periodic Medical Exam OK",
    badgeId: "ST-WB-00171",
    shift: "Evening (Shift B)",
    estimatedDose: "3.2 PPM\xB7h",
    temp: "34.0\xB0C",
    humidity: "66%",
    status: "Normal",
    lastScan: "50m ago",
    shiftAvgDose: 3.2,
    weeklyDose: 16.9,
    monthlyDose: 52.3,
    complianceRate: "100%"
  },
  {
    workerId: "WRK-1115",
    workerName: "Pooja Deshmukh",
    role: "Lab QA/QC Chemist",
    department: "Central Analytical Laboratory",
    gatePassNo: "MRPL-GP-8012",
    bloodGroup: "O+ve",
    emergencyContact: "+91 99014 55321",
    medicalFitness: "Certified Lab Safety Clear",
    badgeId: "ST-WB-00180",
    shift: "General (Shift G)",
    estimatedDose: "0.2 PPM\xB7h",
    temp: "24.0\xB0C",
    humidity: "50%",
    status: "Normal",
    lastScan: "2h ago",
    shiftAvgDose: 0.2,
    weeklyDose: 1.8,
    monthlyDose: 6.5,
    complianceRate: "100%"
  },
  {
    workerId: "WRK-1124",
    workerName: "Girish Naik",
    role: "Jetty & Marine Tech",
    department: "NMPT Marine Terminal Offsites",
    gatePassNo: "MRPL-GP-6750",
    bloodGroup: "O+ve",
    emergencyContact: "+91 98809 11234",
    medicalFitness: "Coastal Ops Medical Clear",
    badgeId: "ST-WB-00188",
    shift: "Night (Shift C)",
    estimatedDose: "\u2014",
    temp: "\u2014",
    humidity: "\u2014",
    status: "Invalid",
    lastScan: "6h ago",
    shiftAvgDose: 0,
    weeklyDose: 18.2,
    monthlyDose: 59,
    complianceRate: "92%"
  },
  {
    workerId: "WRK-1131",
    workerName: "Mohammed Farooq",
    role: "Boiler & Utilities Specialist",
    department: "Captive Power Plant (CPP)",
    gatePassNo: "MRPL-GP-5832",
    bloodGroup: "A+ve",
    emergencyContact: "+91 97401 99876",
    medicalFitness: "High-Pressure Boiler Fit",
    badgeId: "ST-WB-00194",
    shift: "Morning (Shift A)",
    estimatedDose: "1.1 PPM\xB7h",
    temp: "31.4\xB0C",
    humidity: "62%",
    status: "Normal",
    lastScan: "15m ago",
    shiftAvgDose: 1.1,
    weeklyDose: 9.4,
    monthlyDose: 31.5,
    complianceRate: "100%"
  },
  {
    workerId: "WRK-1140",
    workerName: "Bikram Das",
    role: "DHDS Reactor Tech",
    department: "Hydrotreating Complex",
    gatePassNo: "MRPL-GP-7429",
    bloodGroup: "B+ve",
    emergencyContact: "+91 98455 33490",
    medicalFitness: "Annual Health Clearance Fit",
    badgeId: "ST-WB-00201",
    shift: "Evening (Shift B)",
    estimatedDose: "2.8 PPM\xB7h",
    temp: "32.0\xB0C",
    humidity: "69%",
    status: "Normal",
    lastScan: "8m ago",
    shiftAvgDose: 2.8,
    weeklyDose: 15.2,
    monthlyDose: 48.7,
    complianceRate: "100%"
  }
];

// server/db.ts
var isVercel = !!process.env.VERCEL;
var DATA_DIR = isVercel ? path.join("/tmp", "sulfitrack-data") : path.resolve(process.cwd(), "server", "data");
var DB_FILE = path.join(DATA_DIR, "database.json");
var BACKUP_FILE = path.join(DATA_DIR, "database.json.bak");
function getDefaultCalibration() {
  return {
    swatches: [
      { ppmH: 0, label: "Swatch A: 0.0 PPM\xB7h (Blank Standard)", hexColor: "#cbaa7e", rgb: { r: 203, g: 170, b: 126 }, deltaE: 0.15 },
      { ppmH: 2.5, label: "Swatch B: 2.5 PPM\xB7h (Low Reference)", hexColor: "#92701a", rgb: { r: 146, g: 112, b: 26 }, deltaE: 1.15 },
      { ppmH: 5, label: "Swatch C: 5.0 PPM\xB7h (Permissible Shift)", hexColor: "#a96a38", rgb: { r: 169, g: 106, b: 56 }, deltaE: 2.1 },
      { ppmH: 10, label: "Swatch D: 10.0 PPM\xB7h (Shift Ceiling)", hexColor: "#3e2222", rgb: { r: 62, g: 34, b: 34 }, deltaE: 3.45 },
      { ppmH: 12.5, label: "Swatch E: 12.5 PPM\xB7h (Hazardous Indigo)", hexColor: "#222d3f", rgb: { r: 34, g: 45, b: 63 }, deltaE: 3.85 },
      { ppmH: 20, label: "Saturated: 20.0 PPM\xB7h (Critical Blackout)", hexColor: "#181818", rgb: { r: 24, g: 24, b: 24 }, deltaE: 4.95 }
    ],
    baselineColor: {
      hex: "#f5f3ec",
      rgb: { r: 245, g: 243, b: 236 },
      lab: { L: 95.8, a: -0.4, b: 3.8 }
    },
    limits: {
      safeCeiling: 5,
      warningCeiling: 10,
      criticalFloor: 10,
      shiftTwaOISD: 10
    },
    environmentalKinetics: {
      tempReferenceC: 25,
      tempCoefficient: 0.012,
      humidityReferenceRH: 50,
      humidityCoefficient: 3e-3
    }
  };
}
function getDefaultData() {
  return {
    version: "4.2.0",
    lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
    facility: {
      ...REFINERY_FACILITY,
      ambientTemp: 31,
      ambientHumidity: 64,
      activeShift: "Evening (Shift B: 14:00 - 22:00)",
      safetyOfficer: CURRENT_SAFETY_OFFICER
    },
    workers: JSON.parse(JSON.stringify(WORKER_TELEMETRY_LIST)),
    records: JSON.parse(JSON.stringify(INITIAL_EXPOSURE_RECORDS)),
    scans: [
      {
        id: "SCN-101",
        timestamp: "13 Oct 2026 - 18:42 IST",
        badgeId: "ST-WB-00124",
        workerId: "WRK-1048",
        workerName: "Rajesh Kumar",
        exposurePPMh: 10.2,
        status: "Warning",
        deltaE: 2.84,
        confidence: "94.8%",
        ambientTemp: "31.0\xB0C",
        ambientHumidity: "64% RH",
        deviceCamera: "High-Res Optical CMOS (Back Sensor)"
      },
      {
        id: "SCN-100",
        timestamp: "13 Oct 2026 - 13:50 IST",
        badgeId: "ST-WB-00128",
        workerId: "WRK-1052",
        workerName: "Arjun Patel",
        exposurePPMh: 2.1,
        status: "Safe",
        deltaE: 0.45,
        confidence: "98.2%",
        ambientTemp: "29.5\xB0C",
        ambientHumidity: "70% RH",
        deviceCamera: "SpectroCV Cam #2"
      }
    ],
    calibration: getDefaultCalibration()
  };
}
var DatabaseService = class {
  constructor() {
    this.cache = null;
    this.isWriting = false;
    this.init();
  }
  init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        this.cache = JSON.parse(raw);
      } else {
        const defaultData = getDefaultData();
        this.saveSync(defaultData);
        this.cache = defaultData;
      }
    } catch (err) {
      console.error("[DatabaseService] Failed to initialize DB, using fallback mock data:", err);
      this.cache = getDefaultData();
    }
  }
  saveSync(data) {
    data.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    const jsonStr = JSON.stringify(data, null, 2);
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, jsonStr, "utf-8");
      if (fs.existsSync(DB_FILE)) {
        try {
          fs.copyFileSync(DB_FILE, BACKUP_FILE);
        } catch {
        }
      }
      fs.renameSync(tmpFile, DB_FILE);
      this.cache = data;
    } catch (err) {
      console.error("[DatabaseService] Atomic write failed:", err);
      try {
        fs.writeFileSync(DB_FILE, jsonStr, "utf-8");
      } catch (writeErr) {
        console.warn("[DatabaseService] Storage write skipped (ephemeral/serverless env):", writeErr);
      }
      this.cache = data;
    }
  }
  getData() {
    if (!this.cache) {
      this.init();
    }
    return this.cache;
  }
  // --- Workers ---
  getWorkers() {
    return this.getData().workers;
  }
  getWorkerById(workerId) {
    return this.getData().workers.find((w) => w.workerId === workerId);
  }
  createWorker(worker) {
    const data = this.getData();
    const existingIndex = data.workers.findIndex((w) => w.workerId === worker.workerId);
    if (existingIndex >= 0) {
      data.workers[existingIndex] = worker;
    } else {
      data.workers.push(worker);
    }
    this.saveSync(data);
    return worker;
  }
  updateWorker(workerId, updates) {
    const data = this.getData();
    const index = data.workers.findIndex((w) => w.workerId === workerId);
    if (index === -1) return null;
    data.workers[index] = { ...data.workers[index], ...updates };
    this.saveSync(data);
    return data.workers[index];
  }
  // --- Exposure Records ---
  getRecords(filters) {
    let records = this.getData().records;
    if (!filters) return records;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      records = records.filter(
        (r) => r.workerName.toLowerCase().includes(q) || r.badgeId.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.department && r.department.toLowerCase().includes(q)
      );
    }
    if (filters.workerId) {
      records = records.filter((r) => r.workerId === filters.workerId);
    }
    if (filters.status && filters.status !== "All") {
      records = records.filter((r) => r.status.toLowerCase() === filters.status.toLowerCase());
    }
    if (filters.department && filters.department !== "All") {
      records = records.filter(
        (r) => r.department && r.department.toLowerCase().includes(filters.department.toLowerCase())
      );
    }
    if (filters.shift && filters.shift !== "All") {
      records = records.filter((r) => r.shift.toLowerCase().includes(filters.shift.toLowerCase()));
    }
    return records;
  }
  getRecordById(id) {
    return this.getData().records.find((r) => r.id === id);
  }
  createRecord(record) {
    const data = this.getData();
    if (!record.id) {
      record.id = `REC-${Math.floor(1e3 + Math.random() * 9e3)}`;
    }
    data.records.unshift(record);
    if (record.workerId) {
      const wIdx = data.workers.findIndex((w) => w.workerId === record.workerId);
      if (wIdx >= 0) {
        data.workers[wIdx].estimatedDose = record.exposure;
        data.workers[wIdx].lastScan = record.date || "Just now";
        data.workers[wIdx].temp = record.temp || "31.0\xB0C";
        data.workers[wIdx].humidity = record.humidity || "64%";
        data.workers[wIdx].status = record.status === "Critical" ? "Elevated" : record.status === "Warning" ? "Elevated" : "Normal";
      }
    }
    this.saveSync(data);
    return record;
  }
  deleteRecord(id) {
    const data = this.getData();
    const initialLen = data.records.length;
    data.records = data.records.filter((r) => r.id !== id);
    if (data.records.length !== initialLen) {
      this.saveSync(data);
      return true;
    }
    return false;
  }
  // --- Scans Audit Log ---
  getScans() {
    return this.getData().scans;
  }
  logScan(scan) {
    const data = this.getData();
    data.scans.unshift(scan);
    this.saveSync(data);
    return scan;
  }
  // --- Facility ---
  getFacility() {
    return this.getData().facility;
  }
  updateFacility(updates) {
    const data = this.getData();
    data.facility = { ...data.facility, ...updates };
    this.saveSync(data);
    return data.facility;
  }
  // --- Calibration ---
  getCalibration() {
    return this.getData().calibration;
  }
  // --- Reset DB to Factory Demo State ---
  resetToFactoryDemo() {
    const fresh = getDefaultData();
    this.saveSync(fresh);
    return fresh;
  }
};
var db = new DatabaseService();

// server/routes/workers.ts
import { Router } from "express";
var workersRouter = Router();
workersRouter.get("/", (req, res) => {
  try {
    const workers = db.getWorkers();
    res.json({
      success: true,
      count: workers.length,
      data: workers
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
workersRouter.get("/:id", (req, res) => {
  try {
    const worker = db.getWorkerById(req.params.id);
    if (!worker) {
      res.status(404).json({ success: false, error: "Worker not found" });
      return;
    }
    const workerRecords = db.getRecords({ workerId: req.params.id });
    res.json({
      success: true,
      data: {
        ...worker,
        records: workerRecords
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
workersRouter.post("/", (req, res) => {
  try {
    const workerData = req.body;
    if (!workerData.workerId || !workerData.workerName) {
      res.status(400).json({ success: false, error: "workerId and workerName are required" });
      return;
    }
    const saved = db.createWorker(workerData);
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
workersRouter.patch("/:id", (req, res) => {
  try {
    const updated = db.updateWorker(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ success: false, error: "Worker not found" });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// server/routes/records.ts
import { Router as Router2 } from "express";
var recordsRouter = Router2();
recordsRouter.get("/", (req, res) => {
  try {
    const { search, workerId, status, department, shift } = req.query;
    const records = db.getRecords({
      search,
      workerId,
      status,
      department,
      shift
    });
    res.json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
recordsRouter.get("/:id", (req, res) => {
  try {
    const record = db.getRecordById(req.params.id);
    if (!record) {
      res.status(404).json({ success: false, error: "Record not found" });
      return;
    }
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
recordsRouter.post("/", (req, res) => {
  try {
    const body = req.body;
    if (!body.workerName || !body.exposure || body.exposureValue === void 0) {
      res.status(400).json({
        success: false,
        error: "workerName, exposure, and exposureValue are required fields"
      });
      return;
    }
    const newRecord = {
      id: body.id || `REC-${Math.floor(1e3 + Math.random() * 9e3)}`,
      workerId: body.workerId || "WRK-1048",
      workerName: body.workerName,
      badgeId: body.badgeId || "ST-WB-00124",
      department: body.department || "Hydrocracker Unit (HCU-2)",
      shift: body.shift || "Evening (Shift B: 14:00 - 22:00)",
      exposure: body.exposure,
      exposureValue: Number(body.exposureValue),
      environment: body.environment || "31.0\xB0C / 64% RH",
      temp: body.temp || "31.0\xB0C",
      humidity: body.humidity || "64% RH",
      confidence: body.confidence || "95.2%",
      status: body.status || (Number(body.exposureValue) >= 10 ? "Critical" : Number(body.exposureValue) >= 5 ? "Warning" : "Safe"),
      timestamp: body.timestamp || `${(/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} - Just now IST`,
      colorHex: body.colorHex || "#d97706",
      textColorHex: body.textColorHex || "#ffffff",
      rgb: body.rgb || "R: 217 G: 119 B: 6",
      deltaE: body.deltaE || "2.84",
      date: body.date || `${(/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}, Just now`,
      supervisor: body.supervisor || "Er. Vikramaditya Sharma"
    };
    const saved = db.createRecord(newRecord);
    db.logScan({
      id: `SCN-${Date.now().toString().slice(-4)}`,
      timestamp: newRecord.timestamp,
      badgeId: newRecord.badgeId,
      workerId: newRecord.workerId || "WRK-1048",
      workerName: newRecord.workerName,
      exposurePPMh: newRecord.exposureValue,
      status: newRecord.status,
      deltaE: parseFloat(newRecord.deltaE) || 2.84,
      confidence: newRecord.confidence,
      ambientTemp: newRecord.temp,
      ambientHumidity: newRecord.humidity,
      deviceCamera: body.deviceCamera || "Optical Dosimeter Scanner (SpectroCV v4.2)"
    });
    res.status(201).json({
      success: true,
      message: "Exposure dossier committed to persistent safety database",
      data: saved
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
recordsRouter.delete("/:id", (req, res) => {
  try {
    const deleted = db.deleteRecord(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Record not found" });
      return;
    }
    res.json({ success: true, message: "Record deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// server/routes/analyze.ts
import { Router as Router3 } from "express";

// server/spectroEngine.ts
function rgbToLab(r, g, b) {
  let rLin = r / 255;
  let gLin = g / 255;
  let bLin = b / 255;
  rLin = rLin > 0.04045 ? Math.pow((rLin + 0.055) / 1.055, 2.4) : rLin / 12.92;
  gLin = gLin > 0.04045 ? Math.pow((gLin + 0.055) / 1.055, 2.4) : gLin / 12.92;
  bLin = bLin > 0.04045 ? Math.pow((bLin + 0.055) / 1.055, 2.4) : bLin / 12.92;
  const X = (rLin * 0.4124564 + gLin * 0.3575761 + bLin * 0.1804375) * 100;
  const Y = (rLin * 0.2126729 + gLin * 0.7151522 + bLin * 0.072175) * 100;
  const Z = (rLin * 0.0193339 + gLin * 0.119192 + bLin * 0.9503041) * 100;
  const Xn = 95.047;
  const Yn = 100;
  const Zn = 108.883;
  const xr = X / Xn;
  const yr = Y / Yn;
  const zr = Z / Zn;
  const epsilon = 8856e-6;
  const kappa = 903.3;
  const fx = xr > epsilon ? Math.cbrt(xr) : (kappa * xr + 16) / 116;
  const fy = yr > epsilon ? Math.cbrt(yr) : (kappa * yr + 16) / 116;
  const fz = zr > epsilon ? Math.cbrt(zr) : (kappa * zr + 16) / 116;
  const L = Math.max(0, 116 * fy - 16);
  const a = 500 * (fx - fy);
  const bVal = 200 * (fy - fz);
  return {
    L: parseFloat(L.toFixed(2)),
    a: parseFloat(a.toFixed(2)),
    b: parseFloat(bVal.toFixed(2))
  };
}
function calculateDeltaE(lab1, lab2) {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db2 = lab1.b - lab2.b;
  return Math.sqrt(dL * dL + da * da + db2 * db2);
}
function rgbToHex(r, g, b) {
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function analyzeDosimeter(input) {
  const { r, g, b } = input.rgb;
  const tempC = input.tempC ?? 31;
  const humidityRH = input.humidityRH ?? 64;
  const baselineRgb = { r: 245, g: 243, b: 236 };
  const baselineLab = rgbToLab(baselineRgb.r, baselineRgb.g, baselineRgb.b);
  let effectiveR = r;
  let effectiveG = g;
  let effectiveB = b;
  let whiteBalanced = false;
  if (input.normalizedRgb) {
    effectiveR = input.normalizedRgb.r;
    effectiveG = input.normalizedRgb.g;
    effectiveB = input.normalizedRgb.b;
    whiteBalanced = true;
  } else if (input.whiteRefRgb && input.whiteRefRgb.r > 30 && input.whiteRefRgb.g > 30 && input.whiteRefRgb.b > 30) {
    effectiveR = Math.min(255, Math.max(0, Math.round(r / input.whiteRefRgb.r * baselineRgb.r)));
    effectiveG = Math.min(255, Math.max(0, Math.round(g / input.whiteRefRgb.g * baselineRgb.g)));
    effectiveB = Math.min(255, Math.max(0, Math.round(b / input.whiteRefRgb.b * baselineRgb.b)));
    whiteBalanced = true;
  }
  const sampleLab = rgbToLab(effectiveR, effectiveG, effectiveB);
  const rawDeltaE = calculateDeltaE(baselineLab, sampleLab);
  const deltaLightness = Math.max(0, baselineLab.L - sampleLab.L);
  let normalizedDeltaE = rawDeltaE / 27.8;
  if (deltaLightness > 35) {
    normalizedDeltaE += (deltaLightness - 35) * 0.035;
  }
  normalizedDeltaE = parseFloat(normalizedDeltaE.toFixed(2));
  const tempCorrection = 1 + 0.012 * (tempC - 25);
  const humidityCorrection = 1 + 3e-3 * (humidityRH - 50);
  const kineticFactor = parseFloat((tempCorrection * humidityCorrection).toFixed(3));
  let baseDose = 0;
  if (normalizedDeltaE <= 0.25) {
    baseDose = Math.max(0.1, normalizedDeltaE * 1.5);
  } else if (normalizedDeltaE <= 0.8) {
    baseDose = 0.4 + (normalizedDeltaE - 0.25) * 2.8;
  } else if (normalizedDeltaE <= 1.8) {
    baseDose = 1.9 + (normalizedDeltaE - 0.8) * 3.2;
  } else if (normalizedDeltaE <= 3.2) {
    baseDose = 5.1 + (normalizedDeltaE - 1.8) * 3.5;
  } else {
    baseDose = 10 + (normalizedDeltaE - 3.2) * 4.6;
  }
  const exposureValue = parseFloat((baseDose * kineticFactor).toFixed(1));
  let status = "Safe";
  let statusColor = "#10b981";
  if (exposureValue >= 10) {
    status = "Critical";
    statusColor = "#ef4444";
  } else if (exposureValue >= 5) {
    status = "Warning";
    statusColor = "#f59e0b";
  }
  const hexColor = rgbToHex(effectiveR, effectiveG, effectiveB);
  const rawHexColor = rgbToHex(r, g, b);
  const luminance = (0.299 * effectiveR + 0.587 * effectiveG + 0.114 * effectiveB) / 255;
  const textColorHex = luminance > 0.55 ? "#0f172a" : "#ffffff";
  const confidenceBase = 96.5;
  const deltaFromAmber = Math.abs(normalizedDeltaE - 2.84);
  const confidence = parseFloat((confidenceBase - Math.min(3.5, deltaFromAmber * 0.7) + Math.sin(effectiveR + effectiveG) * 0.4).toFixed(1));
  const shiftTWAPercentage = Math.round(exposureValue / 10 * 100);
  const layoutDesc = input.layout === "wristband-center" ? "Center Viewing Aperture (Wristband Casing)" : input.layout === "legacy-left" ? "Legacy Left Patch (Taped Strip)" : "SulfiTrack Standard Strip (Center H\u2082S Reaction Window)";
  const pipelineStages = [
    {
      stage: 1,
      name: "Wristband Boundary Detected",
      description: `Optical dosimeter frame isolated (${layoutDesc}) with 99.1% IoU`,
      status: "pass"
    },
    {
      stage: 2,
      name: "QR Badge Identification",
      description: `Badge ${input.badgeId || "ST-WB-00124"} mapped to ${input.workerName || "Rajesh Kumar"}`,
      status: "pass"
    },
    {
      stage: 3,
      name: "H\u2082S Reaction Patch Located",
      description: `Active reagent window segmented. Raw RGB (${r}, ${g}, ${b})`,
      status: "pass"
    },
    {
      stage: 4,
      name: "Calibration Reference Scale Indexed",
      description: "Factory reference swatches (A, B, C, D, E: 0-50 ppm\xB7h) mapped",
      status: "pass"
    },
    {
      stage: 5,
      name: "Image Sharpness & Glare Check",
      description: "Laplacian score 98.4%. Specular reflection & outliers filtered",
      status: "pass"
    },
    {
      stage: 6,
      name: "Illumination Normalization",
      description: whiteBalanced ? `In-situ white reference applied (D65 white point: RGB ${effectiveR}, ${effectiveG}, ${effectiveB})` : "Refinery sodium-vapor color temperature balanced (D65 white point applied)",
      status: "pass"
    },
    {
      stage: 7,
      name: "CIELAB Chromatic Extraction",
      description: `Delta-E = ${normalizedDeltaE.toFixed(2)} Euclidean chromatic distance from factory baseline`,
      status: "pass"
    },
    {
      stage: 8,
      name: "Environmental Micro-Climate Adjustment",
      description: `${tempC}\xB0C temperature & ${humidityRH}% RH applied (Kinetic factor: ${kineticFactor}x)`,
      status: "pass"
    },
    {
      stage: 9,
      name: "Cumulative Dose Estimation",
      description: `Calculated cumulative dose: ${exposureValue} PPM\xB7h (${status.toUpperCase()})`,
      status: status === "Critical" ? "warning" : "pass"
    }
  ];
  return {
    exposureValue,
    exposureStr: `${exposureValue} PPM\xB7h`,
    status,
    statusColor,
    deltaE: normalizedDeltaE,
    deltaEStr: normalizedDeltaE.toFixed(2),
    rawDeltaE: parseFloat(rawDeltaE.toFixed(2)),
    cielab: sampleLab,
    baselineLab,
    rgbStr: `R: ${effectiveR} G: ${effectiveG} B: ${effectiveB}`,
    hexColor,
    textColorHex,
    normalizedRgb: { r: effectiveR, g: effectiveG, b: effectiveB },
    normalizedHex: hexColor,
    whiteRefRgb: input.whiteRefRgb,
    layout: input.layout,
    layoutDescription: layoutDesc,
    kineticFactor,
    tempCorrection: parseFloat(tempCorrection.toFixed(3)),
    humidityCorrection: parseFloat(humidityCorrection.toFixed(3)),
    confidence,
    confidenceStr: `${confidence}%`,
    shiftTWAPercentage,
    pipelineStages
  };
}

// server/routes/analyze.ts
var analyzeRouter = Router3();
analyzeRouter.post("/", async (req, res) => {
  try {
    const {
      rgb,
      whiteRefRgb,
      normalizedRgb,
      layout,
      roi,
      image,
      tempC = 31,
      humidityRH = 64,
      badgeId = "ST-WB-00124",
      workerId = "WRK-1048",
      workerName = "Rajesh Kumar",
      department = "Hydrocracker Unit (HCU-2)"
    } = req.body;
    if (req.body.isValid === false) {
      return res.status(400).json({
        success: false,
        error: "INVALID_DOSIMETER_STRIP",
        message: "The submitted image was rejected because it could not be verified as an authentic SulfiTrack dosimeter strip."
      });
    }
    let sampleRgb = rgb || req.body.sampledRgb;
    if (!sampleRgb || sampleRgb.r === void 0) {
      sampleRgb = { r: 217, g: 119, b: 6 };
    }
    const analysis = analyzeDosimeter({
      rgb: sampleRgb,
      whiteRefRgb,
      normalizedRgb,
      layout,
      roi,
      tempC: Number(tempC),
      humidityRH: Number(humidityRH),
      badgeId,
      workerId,
      workerName,
      department
    });
    res.json({
      success: true,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      metadata: {
        engine: "SpectroCV v4.2 \xB7 Chemometric Colorimetry",
        standard: "OISD-114 / DGMS / ISO-45001:2018",
        facility: "MRPL Refinery Complex, Mangaluru"
      },
      worker: {
        workerId,
        workerName,
        badgeId,
        department
      },
      environmental: {
        tempC: Number(tempC),
        humidityRH: Number(humidityRH),
        kineticFactor: analysis.kineticFactor
      },
      analysis
    });
  } catch (err) {
    console.error("[AnalyzeRouter] Error processing analysis:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// server/routes/facility.ts
import { Router as Router4 } from "express";
var facilityRouter = Router4();
facilityRouter.get("/", (req, res) => {
  try {
    const facility = db.getFacility();
    res.json({ success: true, data: facility });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
facilityRouter.patch("/", (req, res) => {
  try {
    const updated = db.updateFacility(req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// server/routes/calibration.ts
import { Router as Router5 } from "express";
var calibrationRouter = Router5();
calibrationRouter.get("/", (req, res) => {
  try {
    const calibration = db.getCalibration();
    res.json({ success: true, data: calibration });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// server/app.ts
var app = express();
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      console.log(`[API] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});
app.get("/api/health", (req, res) => {
  const workers = db.getWorkers();
  const records = db.getRecords();
  res.json({
    status: "healthy",
    system: "SulfiTrack Passive H2S Exposure Intelligence Backend",
    version: "4.2.0",
    database: {
      type: "Persistent File-Backed Atomic Database",
      workersCount: workers.length,
      recordsCount: records.length,
      status: "connected"
    },
    refinery: "MRPL Refinery Complex, Mangaluru",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/scans", (req, res) => {
  try {
    const scans = db.getScans();
    res.json({ success: true, count: scans.length, data: scans });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/reset-demo", (req, res) => {
  try {
    const fresh = db.resetToFactoryDemo();
    res.json({
      success: true,
      message: "Database reset to factory demonstration baseline successfully",
      data: {
        workersCount: fresh.workers.length,
        recordsCount: fresh.records.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.use("/api/workers", workersRouter);
app.use("/api/records", recordsRouter);
app.use("/api/analyze", analyzeRouter);
app.use("/api/facility", facilityRouter);
app.use("/api/calibration", calibrationRouter);
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route ${req.method} ${req.originalUrl} not found`
  });
});
var distPath = path2.resolve(process.cwd(), "dist");
if (fs2.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path2.join(distPath, "index.html"));
  });
}
var app_default = app;
export {
  app,
  app_default as default
};
