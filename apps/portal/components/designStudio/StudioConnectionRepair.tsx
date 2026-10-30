import type { StudioConnectionMeasurements } from '@/lib/designStudio/studioConnectionDiagnostics';
import { studioMillimetres as mm } from '@/lib/designStudio/studioConnectionPresentation';
import css from './StudioConnection.module.css';
import {CUSTOMER_DIMENSION_BOUNDS} from '@sp/configurator/core';

export default function StudioConnectionRepair({ error, measurements, edgeLabel, onHouse, onPergola, onHighlight }: {
  error: string; measurements: StudioConnectionMeasurements | null; edgeLabel: string;
  onHouse: () => void; onPergola: () => void; onHighlight: () => void;
}) {
  const heightIssue = measurements?.supportDatumMm !== undefined &&
    (measurements.supportDatumMm < CUSTOMER_DIMENSION_BOUNDS.clearHeightMm.minimum || measurements.supportDatumMm > CUSTOMER_DIMENSION_BOUNDS.clearHeightMm.maximum);
  const spanIssue = measurements && measurements.requiredSpanMm > measurements.availableSpanMm + 0.1;
  return <section className={css.repair} aria-label="Connection repair">
    <strong>{edgeLabel}</strong><p role="alert">{error}</p>
    <div className={css.actions}><button onClick={onHouse}>{heightIssue ? 'Check house height' : 'Check house dimensions'}</button></div>
    {measurements && <dl>
      {(!heightIssue || spanIssue) && <>
        <div><dt>Available house edge</dt><dd>{mm(measurements.availableSpanMm)}</dd></div>
        <div><dt>Required connection span</dt><dd>{mm(measurements.requiredSpanMm)}</dd></div>
      </>}
      <div><dt>House contact height</dt><dd>{mm(measurements.targetAttachmentHeightMm)}</dd></div>
      {!heightIssue && measurements.alongEdgeMm !== 0 && <div><dt>Along-edge offset</dt><dd>{mm(measurements.alongEdgeMm)}</dd></div>}
      {measurements.supportDatumMm !== undefined && <div><dt>Proposed support underside</dt><dd>{mm(measurements.supportDatumMm)}</dd></div>}
      {heightIssue && <div><dt>Supported height range</dt><dd>{mm(CUSTOMER_DIMENSION_BOUNDS.clearHeightMm.minimum)}–{mm(CUSTOMER_DIMENSION_BOUNDS.clearHeightMm.maximum)}</dd></div>}
    </dl>}
    {measurements && Math.abs(measurements.requiredSpanMm - measurements.authoredWidthMm) > .1 && <p>The selected roof and connection detail determine the physical span. It can differ from the entered width.</p>}
    <div className={css.actions}><button onClick={onPergola}>Check pergola size and roof</button><button onClick={onHighlight}>Show affected edge in Plan</button></div>
    <small>Your choices are kept. Use the measured house dimensions or choose another connection.</small>
  </section>;
}
