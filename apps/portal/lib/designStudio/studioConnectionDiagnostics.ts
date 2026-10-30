/** Measurements from the existing connection solve, never an alternative fit rule. */
export type StudioConnectionMeasurements = {
  availableSpanMm: number; targetAttachmentHeightMm: number;
  requiredSpanMm: number;
  authoredWidthMm: number;
  alongEdgeMm: number;
  supportDatumMm?: number;
  roofClearanceMm?: number;
  requestedRoofClearanceMm?: number;
  fitConstraint?: StudioConnectionFitConstraint;
  target: { start: { x: number; y: number }; end: { x: number; y: number } };
};

/** A measured, recoverable contact constraint. Explicit method changes may use
 * it to adjust the house model, while ordinary solves remain read-only. */
export type StudioConnectionFitConstraint =
  | { kind: 'support-range'; supportDatumMm: number; minimumMm: number; maximumMm: number }
  | { kind: 'fascia-depth'; requiredDepthMm: number };

export class StudioContactFitError extends Error {
  constructor(message: string, readonly constraint: StudioConnectionFitConstraint) {
    super(message);
  }
}

export class StudioConnectionError extends Error {
  constructor(message: string, readonly measurements: StudioConnectionMeasurements | null) {
    super(message);
    this.name = 'StudioConnectionError';
  }
}
