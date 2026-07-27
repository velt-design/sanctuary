'use client';

import type {
  TrustedLabourBreakdownV1,
  TrustedMaterialsBreakdownV1,
  TrustedQuantityExplanationV1,
} from '@sp/costing';

import {
  calculatorResultFreshnessLabel,
  type CalculatorResultFreshness,
} from './calculatorResultFreshness';
import styles from './CalculatorTrustedBreakdowns.module.css';

type SharedBreakdownProps = {
  canViewInternalCosts: boolean;
  resultFreshness: CalculatorResultFreshness;
};

export type CalculatorMaterialsBreakdownProps = SharedBreakdownProps & {
  breakdown: TrustedMaterialsBreakdownV1 | null;
  materialsExGst: number | undefined;
};

export type CalculatorLabourBreakdownProps = SharedBreakdownProps & {
  breakdown: TrustedLabourBreakdownV1 | null;
};

function formatQuantity(value: number): string {
  return value.toLocaleString('en-NZ', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function formatMoney(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('en-NZ', {
        style: 'currency',
        currency: 'NZD',
      })
    : '--';
}

function formatMinutes(value: number): string {
  return `${value.toLocaleString('en-NZ', { maximumFractionDigits: 0 })} min`;
}

function formatHours(value: number): string {
  return `${value.toLocaleString('en-NZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} crew hr`;
}

function formatFactValue(value: string | number, unit?: string): string {
  const formatted = typeof value === 'number' ? formatQuantity(value) : value;
  return unit ? `${formatted} ${unit}` : formatted;
}

function Freshness({
  value,
}: {
  value: CalculatorResultFreshness;
}) {
  const current = value === 'current';
  return (
    <span className={current ? styles.freshnessCurrent : styles.freshnessRetained}>
      {calculatorResultFreshnessLabel(value)}
    </span>
  );
}

function RetainedNotice({
  resultFreshness,
}: {
  resultFreshness: CalculatorResultFreshness;
}) {
  if (resultFreshness === 'current') return null;
  return (
    <p className={styles.retainedNotice}>
      This breakdown belongs to the last successfully calculated job and may not match unsaved edits.
    </p>
  );
}

function QuantityExplanation({
  explanation,
}: {
  explanation: TrustedQuantityExplanationV1;
}) {
  return (
    <details className={styles.explanation}>
      <summary>Why this quantity?</summary>
      <div className={styles.explanationBody}>
        <p>{explanation.summary}</p>
        {explanation.facts.length ? (
          <dl className={styles.facts}>
            {explanation.facts.map((fact) => (
              <div key={`${fact.label}-${String(fact.value)}`}>
                <dt>{fact.label}</dt>
                <dd>{formatFactValue(fact.value, fact.unit)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {explanation.assumptions.length ? (
          <ul className={styles.assumptions}>
            {explanation.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        ) : null}
        {explanation.rounding ? (
          <p className={styles.rounding}>
            <strong>Rounding:</strong> {explanation.rounding}
          </p>
        ) : null}
        <p className={styles.source}>
          Source: <code>{explanation.source}</code>
        </p>
      </div>
    </details>
  );
}

function Unavailable({
  noun,
}: {
  noun: 'material' | 'labour';
}) {
  return (
    <p className={styles.unavailable}>
      This result predates the trusted {noun} breakdown. Recalculate the job to generate it.
    </p>
  );
}

export function CalculatorMaterialsBreakdown({
  breakdown,
  canViewInternalCosts,
  materialsExGst,
  resultFreshness,
}: CalculatorMaterialsBreakdownProps) {
  return (
    <section
      className={styles.card}
      aria-label="Materials breakdown"
      data-trusted-materials-status={breakdown?.status ?? 'unavailable'}
      data-result-freshness={resultFreshness}
    >
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Whole job procurement</p>
          <h2 className={styles.title}>Materials breakdown</h2>
          <p className={styles.context}>
            {breakdown
              ? `${breakdown.row_count} material line${breakdown.row_count === 1 ? '' : 's'}, grouped by purpose`
              : 'Authoritative material quantities'}
          </p>
        </div>
        <Freshness value={resultFreshness} />
      </div>

      <RetainedNotice resultFreshness={resultFreshness} />

      {!breakdown ? (
        <Unavailable noun="material" />
      ) : breakdown.status === 'empty' ? (
        <p className={styles.unavailable}>No material lines were produced for this job.</p>
      ) : (
        <div className={styles.groups}>
          {breakdown.groups.map((group) => (
            <section
              key={group.id}
              className={styles.group}
              aria-labelledby={`material-group-${group.id}`}
            >
              <div className={styles.groupHeading}>
                <h3 id={`material-group-${group.id}`}>{group.label}</h3>
                <span>{group.rows.length}</span>
              </div>
              <div className={styles.rows}>
                {group.rows.map((row) => (
                  <article
                    key={row.instance_id}
                    className={styles.row}
                    data-material-breakdown-row={row.id}
                  >
                    <div className={styles.rowHeading}>
                      <div>
                        <h4>{row.label}</h4>
                        <p>
                          {row.owner.label}
                          {row.profile ? ` · ${row.profile}` : ''}
                        </p>
                      </div>
                      <div className={styles.quantity}>
                        <strong>{formatQuantity(row.quantity)}</strong>
                        <span>{row.unit}</span>
                      </div>
                    </div>
                    {canViewInternalCosts ? (
                      <div className={styles.internalCost} data-internal-material-cost>
                        <span>Internal cost, ex GST</span>
                        <strong>{formatMoney(row.internal_cost_ex_gst)}</strong>
                      </div>
                    ) : null}
                    {row.explanation ? (
                      <QuantityExplanation explanation={row.explanation} />
                    ) : (
                      <p className={styles.noExplanation}>
                        A compact quantity explanation is not yet available for this line.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {breakdown ? (
        <details className={styles.contract}>
          <summary>Breakdown assumptions and source</summary>
          <ul>
            {breakdown.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
          <p>
            Source: <code>{breakdown.source}</code>
          </p>
        </details>
      ) : null}

      {canViewInternalCosts && breakdown?.status === 'ready' ? (
        <div className={styles.total}>
          <span>Total materials, ex GST</span>
          <strong>{formatMoney(materialsExGst)}</strong>
        </div>
      ) : null}
    </section>
  );
}

export function CalculatorLabourBreakdown({
  breakdown,
  canViewInternalCosts,
  resultFreshness,
}: CalculatorLabourBreakdownProps) {
  return (
    <section
      className={styles.card}
      aria-label="Labour breakdown"
      data-trusted-labour-status={breakdown?.status ?? 'unavailable'}
      data-result-freshness={resultFreshness}
    >
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Whole job crew estimate</p>
          <h2 className={styles.title}>Labour breakdown</h2>
          <p className={styles.context}>
            {breakdown
              ? `${breakdown.action_count} activit${breakdown.action_count === 1 ? 'y' : 'ies'} · ${formatHours(breakdown.total_crew_hours)}`
              : 'Authoritative labour activities'}
          </p>
        </div>
        <Freshness value={resultFreshness} />
      </div>

      <RetainedNotice resultFreshness={resultFreshness} />

      {!breakdown ? (
        <Unavailable noun="labour" />
      ) : breakdown.status === 'empty' ? (
        <p className={styles.unavailable}>No labour activities were produced for this job.</p>
      ) : (
        <div className={styles.groups}>
          {breakdown.groups.map((group) => (
            <section
              key={group.id}
              className={styles.group}
              aria-labelledby={`labour-group-${group.id}`}
            >
              <div className={styles.groupHeading}>
                <h3 id={`labour-group-${group.id}`}>{group.label}</h3>
                <span>{formatHours(group.crew_hours)}</span>
              </div>
              <div className={styles.rows}>
                {group.rows.map((row) => (
                  <article
                    key={row.instance_id}
                    className={styles.row}
                    data-labour-breakdown-row={row.id}
                  >
                    <div className={styles.rowHeading}>
                      <div>
                        <h4>{row.label}</h4>
                        <p>{row.owner.label}</p>
                      </div>
                      <div className={styles.quantity}>
                        <strong>{formatQuantity(row.quantity)}</strong>
                        <span>{row.unit}</span>
                      </div>
                    </div>
                    <div className={styles.time}>
                      <span>{formatMinutes(row.minutes)}</span>
                      <span>{formatHours(row.crew_hours)}</span>
                      {canViewInternalCosts ? (
                        <strong data-internal-labour-cost>
                          {formatMoney(row.internal_cost_ex_gst)} ex GST
                        </strong>
                      ) : null}
                    </div>
                    {row.relevant_multipliers.length ? (
                      <div className={styles.multipliers} aria-label="Applied labour loadings">
                        {row.relevant_multipliers.map((multiplier) => (
                          <span key={multiplier.id}>
                            {multiplier.label} {formatQuantity(multiplier.factor)}x
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.neutralLoading}>No additional labour loading</p>
                    )}
                    <QuantityExplanation explanation={row.explanation} />
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {breakdown ? (
        <details className={styles.contract}>
          <summary>Breakdown assumptions and source</summary>
          <ul>
            {breakdown.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
          <p>
            Source: <code>{breakdown.source}</code>
          </p>
        </details>
      ) : null}
    </section>
  );
}
