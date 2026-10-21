/** Measurements from the existing connection solve, never an alternative fit rule. */
export type StudioConnectionMeasurements = {
  availableSpanMm: number; targetAttachmentHeightMm: number;
  requiredSpanMm: number;
  authoredWidthMm: number;
  alongEdgeMm: number;
  supportDatumMm?: number;
  target: { start: { x: number; y: number }; end: { x: number; y: number } };
};

export class StudioConnectionError extends Error {
  constructor(message: string, readonly measurements: StudioConnectionMeasurements | null) {
    super(message);
    this.name = 'StudioConnectionError';
  }
}
