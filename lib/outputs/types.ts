import type { InstallActionV1, MaterialsLineV1 } from '@/src/costing/engine/types';

export type PowdercoatLine = {
  profile: string;
  colour: string;
  stock_length_m: number;
  unit: string;
  qty: number;
  notes?: string;
};

export type AcrylicLine = {
  item: string;
  profile?: string;
  colour?: string;
  stock_length_m?: number;
  unit: string;
  qty: number;
  notes?: string;
};

export type HardwareLine = {
  item: string;
  unit: string;
  qty: number;
  notes?: string;
};

export type InstallPhase = {
  phaseId: string;
  label: string;
  minutes: number;
  costExGst: number;
  actions: InstallActionV1[];
};

export type JobPack = {
  summary: {
    projectName?: string;
    siteAddress?: string;
    createdAt: string;
    roofType: string;
    roofMaterialMode: string;
    pitchDeg?: number;
    moduleCount?: number;
    lengthM?: number;
    projectionM?: number;
    totals: {
      materialsExGst: number;
      installExGst: number;
      overheadExGst: number;
      trueCostExGst: number;
    };
  };
  orderLists: {
    powdercoat: PowdercoatLine[];
    acrylic: AcrylicLine[];
    hardware: HardwareLine[];
  };
  installPhases: {
    phases: InstallPhase[];
    totals: { minutes: number; crewHours: number; siteDaysAt9h: number };
  };
  specText: string;
  assumptions: string[];
};

export type JobPackSource = {
  materials: MaterialsLineV1[];
  install: InstallActionV1[];
};

