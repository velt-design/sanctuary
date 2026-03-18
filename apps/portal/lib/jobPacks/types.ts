export type JobPackPowdercoatRowSource = 'base' | 'manual';

export type JobPackPowdercoatStoredRow = {
  id: string;
  source: JobPackPowdercoatRowSource;
  baseRowId: string | null;
  profile: string;
  colour: string;
  stockLengthM: number | null;
  qty: number;
  unit: string;
  notes: string;
};

export type JobPackPowdercoatOverrideState = {
  version: string | null;
  rows: JobPackPowdercoatStoredRow[];
};

export type JobPackPowdercoatOption = {
  profile: string;
  stockLengthsM: number[];
};

export type JobPackPowdercoatSheetResponse = {
  overrides: JobPackPowdercoatOverrideState;
  options: JobPackPowdercoatOption[];
};

export type JobPackPowdercoatUpdateRequest = {
  estimateId: string;
  expectedVersion: string | null;
  rows: JobPackPowdercoatStoredRow[];
};

export type JobPackPowdercoatUpdateResponse = {
  ok: true;
  overrides: JobPackPowdercoatOverrideState;
};
