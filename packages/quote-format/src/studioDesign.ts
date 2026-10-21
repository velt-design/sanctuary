/** Customer-safe immutable design view. No authored payloads or private costing. */
export type StudioQuoteView = {
  schemaVersion: 'studio_quote_snapshot.v1';
  snapshotId: string;
  contentHash: string;
  designId: string;
  revision: number;
  publicationVersion: number;
  selections: Array<{ label: string; details: string[] }>;
  images: Array<{ kind: 'plan' | 'perspective'; dataUrl: string; sha256: string; width: number; height: number }>;
};
