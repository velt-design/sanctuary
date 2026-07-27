import type {
  RafterCutLengthExplanationV1,
  RafterCutLengthPlaneExplanationV1,
} from '@sp/costing';

import {
  calculatorResultFreshnessLabel,
  type CalculatorResultFreshness,
} from './calculatorResultFreshness';
import styles from './CalculatorRafterExplanation.module.css';

type CalculatorRafterExplanationProps = {
  moduleLabel: string;
  explanation: RafterCutLengthExplanationV1 | null;
  resultFreshness: CalculatorResultFreshness;
};

function formatMillimetres(valueM: number): string {
  return `${Math.round(valueM * 1000).toLocaleString('en-NZ')} mm`;
}

function formatMetres(valueM: number): string {
  return `${valueM.toFixed(3)} m`;
}

function measurement(valueM: number): string {
  return `${formatMillimetres(valueM)} (${formatMetres(valueM)})`;
}

function roofTypeLabel(value: RafterCutLengthExplanationV1['roof_type']): string {
  if (value === 'low_gable') return 'Low gable';
  if (value === 'hip_corner') return 'Hip corner';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function PlaneWorking({
  plane,
  explanation,
}: {
  plane: RafterCutLengthPlaneExplanationV1;
  explanation: RafterCutLengthExplanationV1;
}) {
  return (
    <article
      className={styles.plane}
      aria-label={`${plane.label} calculation`}
      data-rafter-plane={plane.id}
      data-rafter-cut-length-mm={Math.round(plane.cut_length_m * 1000)}
    >
      <div className={styles.planeHeading}>
        <div>
          <h4 className={styles.planeTitle}>{plane.label}</h4>
          <p className={styles.planeScope}>
            {plane.diagram_side === 'both' ? 'Both roof planes' : 'Shown on the Section diagram'}
          </p>
        </div>
        <div className={styles.result}>
          <span>Final cut length</span>
          <strong>{formatMillimetres(plane.cut_length_m)}</strong>
          <small>{formatMetres(plane.cut_length_m)}</small>
        </div>
      </div>

      <ol className={styles.steps}>
        <li>
          <span>Entered roof span</span>
          <strong>{measurement(explanation.entered_span_m)}</strong>
        </li>
        <li>
          <span>{plane.base_projected_run_m === explanation.entered_span_m ? 'Starting projected run' : 'Run for this roof plane'}</span>
          <strong>{measurement(plane.base_projected_run_m)}</strong>
        </li>
        {plane.deductions.map((item) => (
          <li key={item.id}>
            <span>Less: {item.label}</span>
            <strong>{measurement(item.value_m)}</strong>
          </li>
        ))}
        <li className={styles.keyStep}>
          <span>Effective projected run</span>
          <strong>{measurement(plane.effective_projected_run_m)}</strong>
        </li>
        <li>
          <span>Pitch adjustment at {explanation.pitch_deg_used.toFixed(1)} deg</span>
          <strong>{measurement(plane.sloped_length_before_allowance_m)}</strong>
        </li>
        <li>
          <span>Plus: angle-cut allowance</span>
          <strong>{measurement(plane.angle_cut_allowance_m)}</strong>
        </li>
        <li className={styles.finalStep}>
          <span>Final rafter cut length</span>
          <strong>{measurement(plane.cut_length_m)}</strong>
        </li>
      </ol>
    </article>
  );
}

export default function CalculatorRafterExplanation({
  moduleLabel,
  explanation,
  resultFreshness,
}: CalculatorRafterExplanationProps) {
  const isCurrent = resultFreshness === 'current';
  const freshnessLabel = calculatorResultFreshnessLabel(resultFreshness);

  return (
    <section
      className={styles.card}
      aria-label="Rafter cut length workings"
      data-rafter-explanation-status={explanation?.status ?? 'unavailable'}
      data-result-freshness={resultFreshness}
    >
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Selected module</p>
          <h3 className={styles.title}>How the rafter cut length was calculated</h3>
          <p className={styles.module}>{moduleLabel}</p>
        </div>
        <span className={isCurrent ? styles.freshnessCurrent : styles.freshnessRetained}>
          {freshnessLabel}
        </span>
      </div>

      {!explanation ? (
        <p className={styles.unavailable}>
          This result predates the authoritative rafter explanation. Recalculate the module to generate it.
        </p>
      ) : explanation.status !== 'ready' ? (
        <div className={styles.unavailable}>
          <strong>Authoritative explanation unavailable</strong>
          <span>{explanation.unavailable_reason}</span>
        </div>
      ) : (
        <>
          {!isCurrent ? (
            <p className={styles.staleNotice}>
              These are the last successfully calculated inputs and may not match unsaved edits.
            </p>
          ) : null}

          <dl className={styles.context}>
            <div>
              <dt>Roof</dt>
              <dd>{roofTypeLabel(explanation.roof_type)}</dd>
            </div>
            <div>
              <dt>Pitch used</dt>
              <dd>{explanation.pitch_deg_used.toFixed(1)} deg</dd>
            </div>
            <div>
              <dt>Rafter profile</dt>
              <dd>{explanation.rafter_profile}</dd>
            </div>
            <div>
              <dt>Rafter count</dt>
              <dd>{explanation.rafter_count}</dd>
            </div>
          </dl>

          <div className={styles.formula}>
            <span>Engine rule</span>
            <code>{explanation.formula}</code>
          </div>

          <div className={styles.planes}>
            {explanation.planes.map((planeItem) => (
              <PlaneWorking
                key={planeItem.id}
                plane={planeItem}
                explanation={explanation}
              />
            ))}
          </div>

          <details className={styles.assumptions}>
            <summary>Assumptions, source and rounding</summary>
            <ul>
              {explanation.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
            <p>
              Rounding: {explanation.rounding.method} {explanation.rounding.display_increment_mm}{' '}
              mm; engine values remain {explanation.rounding.engine_values}.
            </p>
            <p>
              Source: <code>{explanation.source}</code>
            </p>
          </details>
        </>
      )}
    </section>
  );
}
