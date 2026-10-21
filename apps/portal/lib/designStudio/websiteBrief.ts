export type StudioWebsiteBrief = {
  schemaVersion: 'studio_website_brief.v1';
  sourceEstimateId: string;
  summary: string;
  dimensionsMm?: { widthMm: number; projectionMm: number };
  selections: Array<{label:string;value:string}>;
  reopenUrl: string;
  importable: boolean;
  importFamily?: 'mono' | 'gable' | 'facade';
  reason: string | null;
};
