'use client';

import { isValidElement } from 'react';
import type { CostingControlConfigV1 } from '@sp/costing';
import {
  findIssue,
  LABOUR_FIELD_METADATA,
  OVERHEAD_FIELDS,
  RULE_FIELDS,
  STOCK_LENGTH_METADATA,
  titleCaseKey,
  type NumberFieldMetadata,
  type ValidationIssue,
} from './costingControlModel';
import styles from './costingControl.module.css';

type CatalogMaterial = {
  id: string;
  label: string;
  unit: string;
  category: string;
  supplier: string | null;
  product: string | null;
  note: string | null;
  assumption: boolean;
};

type UpdateConfig = (mutate: (next: CostingControlConfigV1) => void) => void;

type SharedEditorProps = {
  config: CostingControlConfigV1;
  baseline: CostingControlConfigV1;
  readOnly: boolean;
  showChangedOnly: boolean;
  issues: ValidationIssue[];
  updateConfig: UpdateConfig;
};

function valuesDiffer(left: number, right: number): boolean {
  return !Object.is(left, right);
}

function fieldId(path: string): string {
  return `costing-${path.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function NumberField(props: {
  path: string;
  metadata: NumberFieldMetadata;
  value: number;
  baselineValue: number;
  disabled?: boolean;
  issue?: ValidationIssue;
  onChange: (value: number) => void;
  onReset: () => void;
}) {
  const changed = valuesDiffer(props.value, props.baselineValue);
  const inputId = fieldId(props.path);
  const errorId = `${inputId}-error`;
  const descriptionId = `${inputId}-description`;
  return (
    <div className={`${styles.fieldCard} ${changed ? styles.fieldChanged : ''}`}>
      <div className={styles.fieldHeading}>
        <label className={styles.fieldLabelStrong} htmlFor={inputId}>{props.metadata.label}</label>
        {changed ? <span className={styles.changedBadge}>Changed</span> : null}
      </div>
      <p className={styles.fieldDescription} id={descriptionId}>{props.metadata.description}</p>
      <div className={styles.inputWithUnit}>
        <input
          id={inputId}
          className={styles.input}
          type="number"
          step={props.metadata.step ?? 'any'}
          min={props.metadata.min}
          max={props.metadata.max}
          value={props.value}
          disabled={props.disabled}
          aria-invalid={Boolean(props.issue)}
          aria-describedby={`${descriptionId}${props.issue ? ` ${errorId}` : ''}`}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isFinite(value)) props.onChange(value);
          }}
        />
        <span className={styles.inputUnit}>{props.metadata.unit}</span>
      </div>
      <div className={styles.fieldFooter}>
        <span>{props.disabled ? 'Version' : 'Active'} value: <strong>{props.baselineValue}</strong> {props.metadata.unit}</span>
        {!props.disabled && changed ? (
          <button className={styles.resetButton} type="button" onClick={props.onReset}>
            Reset to active
          </button>
        ) : null}
      </div>
      {props.issue ? (
        <div className={styles.fieldError} id={errorId} role="alert">
          {props.issue.message ?? 'Review this value.'}
        </div>
      ) : null}
    </div>
  );
}

function SectionHeading(props: {
  title: string;
  description: string;
  readOnly: boolean;
  changed: boolean;
  onReset: () => void;
}) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        <h3>{props.title}</h3>
        <p className={styles.muted}>{props.description}</p>
      </div>
      {!props.readOnly && props.changed ? (
        <button className={styles.buttonSecondary} type="button" onClick={props.onReset}>
          Reset section
        </button>
      ) : null}
    </div>
  );
}

function EmptyChangedState() {
  return (
    <div className={styles.emptyInline}>
      No values in this section differ from the active pricing configuration.
    </div>
  );
}

function groupedFields(
  fields: React.ReactNode[],
  prefix: string,
): React.ReactNode[] {
  return fields.filter((field) => (
    isValidElement(field) && String(field.key ?? '').startsWith(prefix)
  ));
}

function changedFieldCount(fields: React.ReactNode[]): number {
  return fields.filter((field) => (
    isValidElement<{ value: number; baselineValue: number }>(field)
    && valuesDiffer(field.props.value, field.props.baselineValue)
  )).length;
}

function ProgressiveFieldGroup(props: {
  title: string;
  description: string;
  fields: React.ReactNode[];
  readOnly: boolean;
  defaultOpen?: boolean;
  onReset: () => void;
}) {
  if (!props.fields.length) return null;
  const changedCount = changedFieldCount(props.fields);
  return (
    <details className={styles.editorGroup} open={props.defaultOpen || changedCount > 0}>
      <summary>
        <span>
          <strong>{props.title}</strong>
          <small>{props.description}</small>
        </span>
        <span className={styles.groupSummaryActions}>
          {changedCount ? <span className={styles.changedBadge}>{changedCount} changed</span> : null}
        </span>
      </summary>
      {!props.readOnly && changedCount ? (
        <div className={styles.groupToolbar}>
          <button className={styles.resetButton} type="button" onClick={props.onReset}>
            Reset group
          </button>
        </div>
      ) : null}
      <div className={styles.fieldGrid}>{props.fields}</div>
    </details>
  );
}

export function MaterialsEditor(props: SharedEditorProps & {
  materials: CatalogMaterial[];
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const needle = props.search.trim().toLowerCase();
  const changedCount = props.materials.filter((item) => (
    valuesDiffer(
      props.config.materialRatesExGst[item.id]!,
      props.baseline.materialRatesExGst[item.id]!,
    )
  )).length;
  const rows = props.materials.filter((item) => {
    const matchesSearch = !needle || [
      item.label,
      item.id,
      item.category,
      item.supplier,
      item.product,
      item.note,
    ].filter(Boolean).join(' ').toLowerCase().includes(needle);
    const changed = valuesDiffer(
      props.config.materialRatesExGst[item.id]!,
      props.baseline.materialRatesExGst[item.id]!,
    );
    return matchesSearch && (!props.showChangedOnly || changed);
  });
  const groups = [...rows.reduce((grouped, item) => {
    const group = grouped.get(item.category) ?? [];
    group.push(item);
    grouped.set(item.category, group);
    return grouped;
  }, new Map<string, CatalogMaterial[]>())]
    .sort(([left], [right]) => left.localeCompare(right));
  const changedByCategory = props.materials.reduce((counts, item) => {
    if (valuesDiffer(
      props.config.materialRatesExGst[item.id]!,
      props.baseline.materialRatesExGst[item.id]!,
    )) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    return counts;
  }, new Map<string, number>());

  return (
    <div className={styles.section}>
      <SectionHeading
        title="Material rates"
        description="Supplier and stock rates used by the package-owned bill of materials. All amounts exclude GST."
        readOnly={props.readOnly}
        changed={changedCount > 0}
        onReset={() => props.updateConfig((next) => {
          next.materialRatesExGst = structuredClone(props.baseline.materialRatesExGst);
        })}
      />
      <div className={styles.filterRow}>
        <label className={styles.searchLabel}>
          <span>Find a material</span>
          <input
            className={styles.search}
            type="search"
            placeholder="Search by name, category or internal ID"
            value={props.search}
            onChange={(event) => props.onSearchChange(event.target.value)}
          />
        </label>
        <span className={styles.resultCount}>
          {rows.length} shown · {changedCount} changed
        </span>
      </div>
      {rows.length ? (
        <div className={styles.groupStack}>
          {groups.map(([category, items]) => {
            const categoryChanged = changedByCategory.get(category) ?? 0;
            return (
              <details
                className={styles.editorGroup}
                key={category}
                open={Boolean(needle || props.showChangedOnly || categoryChanged)}
              >
                <summary>
                  <span>
                    <strong>{titleCaseKey(category)}</strong>
                    <small>{items.length} shown</small>
                  </span>
                  {categoryChanged ? <span className={styles.changedBadge}>{categoryChanged} changed</span> : null}
                </summary>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Material</th>
                        <th>Source context</th>
                        <th>{props.readOnly ? 'Version rate' : 'Active rate'}</th>
                        <th>Draft rate</th>
                        {!props.readOnly ? <th>Reset</th> : null}
                      </tr>
                    </thead>
                    <tbody>
              {items.map((item) => {
                const path = `materialRatesExGst.${item.id}`;
                const value = props.config.materialRatesExGst[item.id]!;
                const baselineValue = props.baseline.materialRatesExGst[item.id]!;
                const changed = valuesDiffer(value, baselineValue);
                const issue = findIssue(props.issues, path);
                return (
                  <tr key={item.id} className={changed ? styles.changedRow : undefined}>
                    <td>
                      <div className={styles.materialName}>
                        <strong>{item.label}</strong>
                        {changed ? <span className={styles.changedBadge}>Changed</span> : null}
                      </div>
                      <span className={styles.muted}>per {item.unit || 'item'}</span>
                      {item.assumption ? <span className={styles.assumptionBadge}>Supplier confirmation needed</span> : null}
                    </td>
                    <td>
                      <strong>{item.supplier || item.product || 'Package pricebook'}</strong>
                      {item.note ? (
                        <details className={styles.inlineTechnical}>
                          <summary>Pricing note</summary>
                          <span>{item.note}</span>
                        </details>
                      ) : null}
                    </td>
                    <td className={styles.moneyValue}>${baselineValue.toFixed(2)}</td>
                    <td>
                      <input
                        className={styles.input}
                        type="number"
                        min={0}
                        max={10_000_000}
                        step="0.01"
                        disabled={props.readOnly}
                        value={value}
                        aria-label={`${item.label} ${props.readOnly ? 'version' : 'draft'} rate ex GST`}
                        aria-invalid={Boolean(issue)}
                        onChange={(event) => {
                          const nextValue = Number(event.target.value);
                          if (Number.isFinite(nextValue)) {
                            props.updateConfig((next) => {
                              next.materialRatesExGst[item.id] = nextValue;
                            });
                          }
                        }}
                      />
                      {issue ? <div className={styles.fieldError}>{issue.message}</div> : null}
                    </td>
                    {!props.readOnly ? (
                      <td>
                        {changed ? (
                          <button
                            className={styles.resetButton}
                            type="button"
                            aria-label={`Reset ${item.label} to active rate`}
                            onClick={() => props.updateConfig((next) => {
                              next.materialRatesExGst[item.id] = baselineValue;
                            })}
                          >
                            Reset
                          </button>
                        ) : '—'}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyInline}>
          {props.showChangedOnly
            ? 'No material rates differ from the active pricing configuration.'
            : needle
              ? `No materials match “${props.search.trim()}”. Try a broader name or category.`
              : 'No material rates are available in this package manifest.'}
        </div>
      )}
    </div>
  );
}

export function LabourEditor(props: SharedEditorProps & {
  actionLabels: Map<string, string>;
}) {
  const labourChanged = JSON.stringify(props.config.labour) !== JSON.stringify(props.baseline.labour);
  const visibleFields: React.ReactNode[] = [];
  const pushField = (
    path: string,
    metadata: NumberFieldMetadata,
    value: number,
    baselineValue: number,
    onChange: (value: number) => void,
    onReset: () => void,
  ) => {
    if (props.showChangedOnly && !valuesDiffer(value, baselineValue)) return;
    visibleFields.push(
      <NumberField
        key={path}
        path={path}
        metadata={metadata}
        value={value}
        baselineValue={baselineValue}
        disabled={props.readOnly}
        issue={findIssue(props.issues, path)}
        onChange={onChange}
        onReset={onReset}
      />,
    );
  };

  pushField(
    'labour.crewHourRateExGst',
    LABOUR_FIELD_METADATA.crewHourRateExGst,
    props.config.labour.crewHourRateExGst,
    props.baseline.labour.crewHourRateExGst,
    (value) => props.updateConfig((next) => { next.labour.crewHourRateExGst = value; }),
    () => props.updateConfig((next) => {
      next.labour.crewHourRateExGst = props.baseline.labour.crewHourRateExGst;
    }),
  );

  for (const [actionId, minutes] of Object.entries(props.config.labour.actionBaseMinutes)) {
    const baselineMinutes = props.baseline.labour.actionBaseMinutes[actionId];
    const label = props.actionLabels.get(actionId) ?? titleCaseKey(actionId);
    if (typeof minutes === 'number' && typeof baselineMinutes === 'number') {
      pushField(
        `labour.actionBaseMinutes.${actionId}`,
        { label, ...LABOUR_FIELD_METADATA.actionMinutes },
        minutes,
        baselineMinutes,
        (value) => props.updateConfig((next) => { next.labour.actionBaseMinutes[actionId] = value; }),
        () => props.updateConfig((next) => { next.labour.actionBaseMinutes[actionId] = baselineMinutes; }),
      );
      continue;
    }
    if (typeof minutes !== 'number' && typeof baselineMinutes !== 'number') {
      for (const [profile, value] of Object.entries(minutes.minutes_by_profile)) {
        const baselineValue = baselineMinutes.minutes_by_profile[profile]!;
        const path = `labour.actionBaseMinutes.${actionId}.minutes_by_profile.${profile}`;
        pushField(
          path,
          { label: `${label} — ${titleCaseKey(profile)}`, ...LABOUR_FIELD_METADATA.actionMinutes },
          value,
          baselineValue,
          (nextValue) => props.updateConfig((next) => {
            const action = next.labour.actionBaseMinutes[actionId];
            if (typeof action !== 'number' && action) action.minutes_by_profile[profile] = nextValue;
          }),
          () => props.updateConfig((next) => {
            const action = next.labour.actionBaseMinutes[actionId];
            if (typeof action !== 'number' && action) action.minutes_by_profile[profile] = baselineValue;
          }),
        );
      }
    }
  }

  for (const [group, values] of Object.entries(props.config.labour.multiplierValues)) {
    for (const [key, value] of Object.entries(values)) {
      const baselineValue = props.baseline.labour.multiplierValues[group]![key]!;
      const path = `labour.multiplierValues.${group}.${key}`;
      pushField(
        path,
        {
          label: `${titleCaseKey(group)} — ${titleCaseKey(key)}`,
          ...LABOUR_FIELD_METADATA.multiplier,
        },
        value,
        baselineValue,
        (nextValue) => props.updateConfig((next) => {
          next.labour.multiplierValues[group]![key] = nextValue;
        }),
        () => props.updateConfig((next) => {
          next.labour.multiplierValues[group]![key] = baselineValue;
        }),
      );
    }
  }

  props.config.labour.rafterLengthLoadingCurve.forEach((point, index) => {
    const baselinePoint = props.baseline.labour.rafterLengthLoadingCurve[index]!;
    pushField(
      `labour.rafterLengthLoadingCurve.${index}.length_m`,
      { label: `Loading point ${index + 1} length`, ...LABOUR_FIELD_METADATA.curveLength },
      point.length_m,
      baselinePoint.length_m,
      (value) => props.updateConfig((next) => {
        next.labour.rafterLengthLoadingCurve[index]!.length_m = value;
      }),
      () => props.updateConfig((next) => {
        next.labour.rafterLengthLoadingCurve[index]!.length_m = baselinePoint.length_m;
      }),
    );
    pushField(
      `labour.rafterLengthLoadingCurve.${index}.minutes_per_m`,
      { label: `Loading point ${index + 1} rate`, ...LABOUR_FIELD_METADATA.curveMinutes },
      point.minutes_per_m,
      baselinePoint.minutes_per_m,
      (value) => props.updateConfig((next) => {
        next.labour.rafterLengthLoadingCurve[index]!.minutes_per_m = value;
      }),
      () => props.updateConfig((next) => {
        next.labour.rafterLengthLoadingCurve[index]!.minutes_per_m = baselinePoint.minutes_per_m;
      }),
    );
  });

  const rateFields = groupedFields(visibleFields, 'labour.crewHourRateExGst');
  const actionFields = groupedFields(visibleFields, 'labour.actionBaseMinutes.');
  const multiplierFields = groupedFields(visibleFields, 'labour.multiplierValues.');
  const curveFields = groupedFields(visibleFields, 'labour.rafterLengthLoadingCurve.');

  return (
    <div className={styles.section}>
      <SectionHeading
        title="Labour rates and allowances"
        description="Crew rates, action time allowances and supported installation multipliers."
        readOnly={props.readOnly}
        changed={labourChanged}
        onReset={() => props.updateConfig((next) => {
          next.labour = structuredClone(props.baseline.labour);
        })}
      />
      {visibleFields.length ? (
        <div className={styles.groupStack}>
          <ProgressiveFieldGroup
            title="Crew rate"
            description="The base hourly cost for the installation crew."
            fields={rateFields}
            readOnly={props.readOnly}
            defaultOpen
            onReset={() => props.updateConfig((next) => {
              next.labour.crewHourRateExGst = props.baseline.labour.crewHourRateExGst;
            })}
          />
          <ProgressiveFieldGroup
            title="Action time allowances"
            description="Minutes assigned to package-owned installation actions."
            fields={actionFields}
            readOnly={props.readOnly}
            onReset={() => props.updateConfig((next) => {
              next.labour.actionBaseMinutes = structuredClone(props.baseline.labour.actionBaseMinutes);
            })}
          />
          <ProgressiveFieldGroup
            title="Installation multipliers"
            description="Typed factors for supported access, height and job conditions."
            fields={multiplierFields}
            readOnly={props.readOnly}
            onReset={() => props.updateConfig((next) => {
              next.labour.multiplierValues = structuredClone(props.baseline.labour.multiplierValues);
            })}
          />
          <ProgressiveFieldGroup
            title="Rafter-length loading"
            description="The constrained time-loading curve consumed by the engine."
            fields={curveFields}
            readOnly={props.readOnly}
            onReset={() => props.updateConfig((next) => {
              next.labour.rafterLengthLoadingCurve = structuredClone(
                props.baseline.labour.rafterLengthLoadingCurve,
              );
            })}
          />
        </div>
      ) : <EmptyChangedState />}
    </div>
  );
}

export function OverheadsEditor(props: SharedEditorProps) {
  const changed = JSON.stringify(props.config.overheads) !== JSON.stringify(props.baseline.overheads);
  const fields = OVERHEAD_FIELDS.filter((field) => (
    !props.showChangedOnly
    || valuesDiffer(props.config.overheads[field.key], props.baseline.overheads[field.key])
  ));
  return (
    <div className={styles.section}>
      <SectionHeading
        title="Business overhead allowances"
        description="Operations, delivery, timber and sales allowances applied by the costing engine."
        readOnly={props.readOnly}
        changed={changed}
        onReset={() => props.updateConfig((next) => {
          next.overheads = structuredClone(props.baseline.overheads);
        })}
      />
      {fields.length ? (
        <div className={styles.fieldGrid}>
          {fields.map((field) => {
            const path = `overheads.${field.key}`;
            return (
              <NumberField
                key={field.key}
                path={path}
                metadata={field}
                value={props.config.overheads[field.key]}
                baselineValue={props.baseline.overheads[field.key]}
                disabled={props.readOnly}
                issue={findIssue(props.issues, path)}
                onChange={(value) => props.updateConfig((next) => { next.overheads[field.key] = value; })}
                onReset={() => props.updateConfig((next) => {
                  next.overheads[field.key] = props.baseline.overheads[field.key];
                })}
              />
            );
          })}
        </div>
      ) : <EmptyChangedState />}
    </div>
  );
}

export function RulesEditor(props: SharedEditorProps) {
  const changed = JSON.stringify(props.config.rules) !== JSON.stringify(props.baseline.rules);
  const ruleFields = RULE_FIELDS.filter((field) => (
    !props.showChangedOnly
    || valuesDiffer(props.config.rules[field.key], props.baseline.rules[field.key])
  ));
  const stockFields = props.config.rules.stockLengthPreferenceM.flatMap((value, index) => {
    const baselineValue = props.baseline.rules.stockLengthPreferenceM[index]!;
    return props.showChangedOnly && !valuesDiffer(value, baselineValue)
      ? []
      : [{ value, baselineValue, index }];
  });
  return (
    <div className={styles.section}>
      <SectionHeading
        title="Supported rule parameters"
        description="Bounded parameters consumed by package-owned rules. Predicates and formulas cannot be edited here."
        readOnly={props.readOnly}
        changed={changed}
        onReset={() => props.updateConfig((next) => {
          next.rules = structuredClone(props.baseline.rules);
        })}
      />
      {ruleFields.length || stockFields.length ? (
        <div className={styles.fieldGrid}>
          {ruleFields.map((field) => {
            const path = `rules.${field.key}`;
            return (
              <NumberField
                key={field.key}
                path={path}
                metadata={field}
                value={props.config.rules[field.key]}
                baselineValue={props.baseline.rules[field.key]}
                disabled={props.readOnly}
                issue={findIssue(props.issues, path)}
                onChange={(value) => props.updateConfig((next) => { next.rules[field.key] = value; })}
                onReset={() => props.updateConfig((next) => {
                  next.rules[field.key] = props.baseline.rules[field.key];
                })}
              />
            );
          })}
          {stockFields.map(({ value, baselineValue, index }) => {
            const path = `rules.stockLengthPreferenceM.${index}`;
            return (
              <NumberField
                key={path}
                path={path}
                metadata={{ label: `Stock length preference ${index + 1}`, ...STOCK_LENGTH_METADATA }}
                value={value}
                baselineValue={baselineValue}
                disabled={props.readOnly}
                issue={findIssue(props.issues, path)}
                onChange={(nextValue) => props.updateConfig((next) => {
                  next.rules.stockLengthPreferenceM[index] = nextValue;
                })}
                onReset={() => props.updateConfig((next) => {
                  next.rules.stockLengthPreferenceM[index] = baselineValue;
                })}
              />
            );
          })}
        </div>
      ) : <EmptyChangedState />}
    </div>
  );
}
