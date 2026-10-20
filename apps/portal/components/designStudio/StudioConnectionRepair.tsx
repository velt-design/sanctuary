import type { StudioConnectionMeasurements } from '@/lib/designStudio/studioConnectionDiagnostics';
import { studioMillimetres as mm } from '@/lib/designStudio/studioConnectionPresentation';
import css from './StudioConnection.module.css';

export default function StudioConnectionRepair({ error, measurements, edgeLabel, onHouse, onPergola, onHighlight }: {
  error: string; measurements: StudioConnectionMeasurements | null; edgeLabel: string;
  onHouse: () => void; onPergola: () => void; onHighlight: () => void;
}) {
  return <section className={css.repair} aria-label="Connection repair">
    <strong>{edgeLabel}</strong><p role="alert">{error}</p>
    {measurements && <dl>
      <div><dt>Available house edge</dt><dd>{mm(measurements.availableSpanMm)}</dd></div>
      <div><dt>Required physical connection</dt><dd>{mm(measurements.requiredSpanMm)}</dd></div>
      <div><dt>House contact height</dt><dd>{mm(measurements.targetAttachmentHeightMm)}</dd></div>
      <div><dt>Entered pergola width</dt><dd>{mm(measurements.authoredWidthMm)}</dd></div>
      {measurements.alongEdgeMm !== 0 && <div><dt>Along-edge offset</dt><dd>{mm(measurements.alongEdgeMm)}</dd></div>}
      {measurements.supportDatumMm !== undefined && <div><dt>Proposed support underside</dt><dd>{mm(measurements.supportDatumMm)}</dd></div>}
    </dl>}
    {measurements && Math.abs(measurements.requiredSpanMm - measurements.authoredWidthMm) > .1 && <p>The selected roof and connection detail determine the physical span. It can differ from the entered width.</p>}
    <div className={css.actions}><button onClick={onHighlight}>Show affected edge in Plan</button><button onClick={onHouse}>Check house dimensions</button><button onClick={onPergola}>Check pergola size and roof</button></div>
    <small>Your choices and retained model are kept. Correct an actual dimension or choose a different connection; nothing is resized automatically.</small>
  </section>;
}
