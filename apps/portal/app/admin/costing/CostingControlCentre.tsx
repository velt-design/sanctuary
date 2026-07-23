'use client';

import { useMemo, useState } from 'react';
import type { CostingControlActionMinutesV1, CostingControlConfigV1 } from '@sp/costing';
import type {
  CostingConfigurationVersion,
  CostingConfigurationVersionSummary,
} from '@/lib/costing/configurationTypes';
import type {
  CostingConfigurationComparison,
  CostingConfigurationOverview,
} from '@/lib/costing/configurationAdmin';
import styles from './costingControl.module.css';

type Catalog = {
  materials: Array<{ id: string; label: string; unit: string; category: string }>;
  actions: Array<{ id: string; label: string }>;
};

type EditorPayload = {
  version: CostingConfigurationVersion;
  comparison: CostingConfigurationComparison | null;
  catalog: Catalog;
};

type Section = 'materials' | 'labour' | 'overheads' | 'rules' | 'comparison';

const OVERHEAD_FIELDS: Array<[keyof CostingControlConfigV1['overheads'], string]> = [
  ['crewDayHours', 'Crew day hours'],
  ['opsFixedPerJobExGst', 'Operations fixed per job (ex GST)'],
  ['opsVariablePerCrewDayExGst', 'Operations per crew day (ex GST)'],
  ['gableStartupPerPergolaExGst', 'Gable startup per pergola (ex GST)'],
  ['boxPerimeterStartupPerPergolaExGst', 'Box perimeter startup per pergola (ex GST)'],
  ['timberPerRoundedCrewDayExGst', 'Timber allowance per rounded crew day (ex GST)'],
  ['salesPerJobExGst', 'Sales/design per job (ex GST)'],
  ['salesExtraModuleFactor', 'Sales/design extra module factor'],
];

const RULE_FIELDS: Array<[Exclude<keyof CostingControlConfigV1['rules'], 'stockLengthPreferenceM'>, string]> = [
  ['overhangDefaultM', 'Default overhang (m)'],
  ['overhangMinM', 'Minimum overhang (m)'],
  ['overhangMaxM', 'Maximum overhang (m)'],
  ['boxBeamDepthMm', 'Box beam depth (mm)'],
  ['boxRafterDepthMm', 'Box rafter depth (mm)'],
  ['boxRoofAllowanceAboveRafterMm', 'Box roof allowance above rafter (mm)'],
  ['boxMaxFallMm', 'Box maximum fall (mm)'],
  ['boxMinPitchDeg', 'Box minimum pitch (degrees)'],
  ['boxPitchedHouseSetbackMm', 'Pitched house setback (mm)'],
  ['boxPitchedOuterSetbackMm', 'Pitched outer setback (mm)'],
  ['boxGableEaveSetbackMm', 'Gable eave setback (mm)'],
  ['boxGableRidgeAllowanceMm', 'Gable ridge allowance (mm)'],
  ['acrylicMaxSlopeM', 'Acrylic maximum slope length (m)'],
  ['cedarCoverM', 'Cedar cover (m)'],
  ['cedarWasteFactor', 'Cedar waste factor'],
];

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(String(data?.error ?? 'Request failed')) as Error & { issues?: unknown[] };
    error.issues = Array.isArray(data?.issues) ? data.issues : undefined;
    throw error;
  }
  return data as T;
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

function NumberField(props: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className={styles.field}>
      <span>{props.label}</span>
      <input
        className={styles.input}
        type="number"
        step="any"
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (Number.isFinite(value)) props.onChange(value);
        }}
      />
    </label>
  );
}

export default function CostingControlCentre({ initialOverview }: { initialOverview: CostingConfigurationOverview }) {
  const [overview, setOverview] = useState(initialOverview);
  const [editor, setEditor] = useState<EditorPayload | null>(null);
  const [config, setConfig] = useState<CostingControlConfigV1 | null>(null);
  const [section, setSection] = useState<Section>('materials');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Array<{ path?: string; message?: string }>>([]);
  const [publishNote, setPublishNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const refreshOverview = async () => {
    setOverview(await requestJson<CostingConfigurationOverview>('/api/admin/costing/configurations'));
  };

  const openVersion = async (versionId: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await requestJson<EditorPayload>(
        `/api/admin/costing/configurations/${encodeURIComponent(versionId)}`,
      );
      setEditor(next);
      setConfig(structuredClone(next.version.config));
      setDirty(false);
      setSection(next.version.status === 'draft' ? 'materials' : 'comparison');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to open configuration');
    } finally {
      setBusy(false);
    }
  };

  const createDraft = async (sourceVersionId?: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await requestJson<{ version: CostingConfigurationVersion }>(
        '/api/admin/costing/configurations',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sourceVersionId: sourceVersionId ?? null }),
        },
      );
      await refreshOverview();
      await openVersion(created.version.id);
      setMessage(`Draft v${created.version.versionNumber} created.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to create draft');
      setBusy(false);
    }
  };

  const updateConfig = (mutate: (next: CostingControlConfigV1) => void) => {
    if (!config || editor?.version.status !== 'draft') return;
    const next = structuredClone(config);
    mutate(next);
    setConfig(next);
    setDirty(true);
    setMessage(null);
    setIssues([]);
  };

  const saveDraft = async () => {
    if (!editor || !config) return;
    setBusy(true);
    setError(null);
    setIssues([]);
    try {
      const saved = await requestJson<EditorPayload>(
        `/api/admin/costing/configurations/${encodeURIComponent(editor.version.id)}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedContentHash: editor.version.contentHash,
            config,
          }),
        },
      );
      setEditor(saved);
      setConfig(structuredClone(saved.version.config));
      setDirty(false);
      setMessage('Draft saved, validated and previewed.');
      await refreshOverview();
    } catch (caught) {
      const value = caught as Error & { issues?: Array<{ path?: string; message?: string }> };
      setError(value.message);
      setIssues(value.issues ?? []);
    } finally {
      setBusy(false);
    }
  };

  const publishDraft = async () => {
    if (!editor || dirty || !confirmed) return;
    if (!window.confirm('Publish this costing configuration? Future calculations will use it immediately.')) return;
    setBusy(true);
    setError(null);
    try {
      const result = await requestJson<{ version: CostingConfigurationVersion }>(
        `/api/admin/costing/configurations/${encodeURIComponent(editor.version.id)}/publish`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedContentHash: editor.version.contentHash,
            expectedCurrentVersionId: editor.comparison?.currentVersionId ?? null,
            publishNote,
          }),
        },
      );
      setMessage(`Version ${result.version.versionNumber} published.`);
      setConfirmed(false);
      setPublishNote('');
      await refreshOverview();
      await openVersion(result.version.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to publish');
    } finally {
      setBusy(false);
    }
  };

  const materialRows = useMemo(() => {
    if (!editor) return [];
    const needle = search.trim().toLowerCase();
    return editor.catalog.materials.filter((item) => (
      !needle || `${item.label} ${item.id} ${item.category}`.toLowerCase().includes(needle)
    ));
  }, [editor, search]);

  const actionLabels = useMemo(
    () => new Map(editor?.catalog.actions.map((item) => [item.id, item.label]) ?? []),
    [editor],
  );
  const readOnly = editor?.version.status !== 'draft';

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Calculator Brain</h1>
          <p className={styles.lede}>
            Draft, validate and preview supported costing refinements before they affect future estimates.
            Published versions are immutable; formulas remain owned by the costing package.
          </p>
        </div>
        <button className={styles.button} type="button" disabled={busy} onClick={() => createDraft()}>
          Create draft from current
        </button>
      </header>

      <div className={styles.notice}>
        Active source: <strong>{overview.currentSource === 'published' ? 'published version' : 'legacy effective configuration'}</strong>
        {overview.currentVersionId ? ` · ${overview.currentVersionId}` : ' · no version has been published yet'}
      </div>
      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {message ? <div className={styles.success} role="status">{message}</div> : null}
      {issues.length ? (
        <div className={styles.error}>
          <strong>Fix these validation issues:</strong>
          <ul className={styles.issueList}>
            {issues.map((issue, index) => <li key={`${issue.path}-${index}`}><code>{issue.path}</code>: {issue.message}</li>)}
          </ul>
        </div>
      ) : null}

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>Configuration versions</h2>
          <span className={styles.muted}>{overview.versions.length} versions</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Version</th><th>Status</th><th>Based on</th><th>Updated / published</th><th>Actor</th><th>Action</th></tr></thead>
            <tbody>
              {overview.versions.map((version) => (
                <VersionRow
                  key={version.id}
                  version={version}
                  current={version.id === overview.currentVersionId}
                  busy={busy}
                  onOpen={() => openVersion(version.id)}
                  onClone={() => createDraft(version.id)}
                />
              ))}
              {overview.versions.length === 0 ? <tr><td colSpan={6}>No versioned configurations yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      {editor && config ? (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Version {editor.version.versionNumber}</h2>
              <div className={styles.muted}>
                Hash {editor.version.contentHash.slice(0, 12)}… · manifest {editor.version.baseManifestVersion}
              </div>
            </div>
            <span className={`${styles.badge} ${readOnly ? styles.published : styles.draft}`}>
              {editor.version.status}{editor.version.id === overview.currentVersionId ? ' · current' : ''}
            </span>
          </div>
          {editor.version.publishNote ? (
            <div className={styles.notice}>
              <strong>Publication note:</strong> {editor.version.publishNote}
              {' · '}{editor.version.publishedByEmail} · {formatDate(editor.version.publishedAt)}
            </div>
          ) : null}

          <div className={styles.tabs} role="tablist" aria-label="Costing configuration sections">
            {([
              ['materials', 'Materials'],
              ['labour', 'Labour & allowances'],
              ['overheads', 'Overheads'],
              ['rules', 'Supported rules'],
              ['comparison', 'Diff & impact'],
            ] as Array<[Section, string]>).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={section === key}
                className={`${styles.tab} ${section === key ? styles.tabActive : ''}`}
                onClick={() => setSection(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {section === 'materials' ? (
            <div className={styles.section}>
              <input
                className={styles.search}
                placeholder="Search material, ID or category"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Material</th><th>Category</th><th>Unit</th><th>Rate ex GST</th></tr></thead>
                  <tbody>
                    {materialRows.map((item) => (
                      <tr key={item.id}>
                        <td>{item.label}<div className={styles.muted}>{item.id}</div></td>
                        <td>{item.category}</td>
                        <td>{item.unit}</td>
                        <td>
                          <input
                            className={styles.input}
                            type="number"
                            step="any"
                            disabled={readOnly}
                            value={config.materialRatesExGst[item.id]}
                            aria-label={`${item.label} rate ex GST`}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              if (Number.isFinite(value)) updateConfig((next) => { next.materialRatesExGst[item.id] = value; });
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {section === 'labour' ? (
            <LabourEditor
              config={config}
              readOnly={readOnly}
              actionLabels={actionLabels}
              updateConfig={updateConfig}
            />
          ) : null}

          {section === 'overheads' ? (
            <div className={styles.grid}>
              {OVERHEAD_FIELDS.map(([key, label]) => (
                <NumberField
                  key={key}
                  label={label}
                  value={config.overheads[key]}
                  disabled={readOnly}
                  onChange={(value) => updateConfig((next) => { next.overheads[key] = value; })}
                />
              ))}
            </div>
          ) : null}

          {section === 'rules' ? (
            <div className={styles.section}>
              <p className={styles.muted}>
                These are named, bounded parameters consumed by package-owned rules. Predicates and formulas are not editable here.
              </p>
              <div className={styles.grid}>
                {RULE_FIELDS.map(([key, label]) => (
                  <NumberField
                    key={key}
                    label={label}
                    value={config.rules[key]}
                    disabled={readOnly}
                    onChange={(value) => updateConfig((next) => { next.rules[key] = value; })}
                  />
                ))}
                {config.rules.stockLengthPreferenceM.map((length, index) => (
                  <NumberField
                    key={index}
                    label={`Stock length preference ${index + 1} (m)`}
                    value={length}
                    disabled={readOnly}
                    onChange={(value) => updateConfig((next) => { next.rules.stockLengthPreferenceM[index] = value; })}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {section === 'comparison' ? <Comparison comparison={editor.comparison} version={editor.version} /> : null}

          {!readOnly ? (
            <>
              <div className={styles.toolbar}>
                <div className={dirty ? styles.dirty : styles.muted}>
                  {dirty ? 'Unsaved changes — save to refresh the diff and preview.' : 'Draft is saved and validated.'}
                </div>
                <button className={styles.buttonSecondary} type="button" disabled={busy || !dirty} onClick={saveDraft}>
                  Save and preview
                </button>
              </div>
              <div className={styles.publishPanel}>
                <h3>Publish safely</h3>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Audit note (required)</span>
                  <textarea
                    className={styles.textarea}
                    value={publishNote}
                    maxLength={1000}
                    onChange={(event) => setPublishNote(event.target.value)}
                    placeholder="Why is this change being published?"
                  />
                </label>
                <label className={styles.checkbox}>
                  <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                  I reviewed the saved diff and all representative-scenario impacts.
                </label>
                <div className={styles.publishRow}>
                  <span className={styles.muted}>Publishing affects future calculations only. Existing estimates keep their provenance.</span>
                  <button
                    className={styles.button}
                    type="button"
                    disabled={busy || dirty || !confirmed || publishNote.trim().length < 3 || !editor.comparison?.diff.length}
                    onClick={publishDraft}
                  >
                    Publish version
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.toolbar}>
              <span className={styles.muted}>Published versions are read-only.</span>
              <button className={styles.buttonSecondary} type="button" disabled={busy} onClick={() => createDraft(editor.version.id)}>
                Clone as new draft
              </button>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}

function VersionRow(props: {
  version: CostingConfigurationVersionSummary;
  current: boolean;
  busy: boolean;
  onOpen: () => void;
  onClone: () => void;
}) {
  const { version } = props;
  return (
    <tr>
      <td>v{version.versionNumber}{props.current ? ' · current' : ''}</td>
      <td><span className={`${styles.badge} ${version.status === 'published' ? styles.published : styles.draft}`}>{version.status}</span></td>
      <td>{version.basedOnVersionId ? version.basedOnVersionId.slice(0, 8) : 'Legacy/base'}</td>
      <td>{formatDate(version.publishedAt ?? version.updatedAt)}</td>
      <td>{version.publishedByEmail ?? version.updatedByEmail}</td>
      <td>
        <button className={styles.buttonSecondary} type="button" disabled={props.busy} onClick={props.onOpen}>Open</button>
        {version.status === 'published' ? (
          <> <button className={styles.buttonSecondary} type="button" disabled={props.busy} onClick={props.onClone}>Clone</button></>
        ) : null}
      </td>
    </tr>
  );
}

function LabourEditor(props: {
  config: CostingControlConfigV1;
  readOnly: boolean;
  actionLabels: Map<string, string>;
  updateConfig: (mutate: (next: CostingControlConfigV1) => void) => void;
}) {
  const actionEntries = Object.entries(props.config.labour.actionBaseMinutes);
  return (
    <div className={styles.section}>
      <div className={styles.grid}>
        <NumberField
          label="Crew hour rate (ex GST)"
          value={props.config.labour.crewHourRateExGst}
          disabled={props.readOnly}
          onChange={(value) => props.updateConfig((next) => { next.labour.crewHourRateExGst = value; })}
        />
      </div>
      <div className={styles.subsection}>
        <h4>Action base minutes</h4>
        <div className={styles.grid}>
          {actionEntries.flatMap(([actionId, minutes]) => actionMinuteFields(
            actionId,
            minutes,
            props.actionLabels.get(actionId) ?? actionId,
            props,
          ))}
        </div>
      </div>
      <div className={styles.subsection}>
        <h4>Named multiplier values</h4>
        <div className={styles.grid}>
          {Object.entries(props.config.labour.multiplierValues).flatMap(([group, values]) => (
            Object.entries(values).map(([key, value]) => (
              <NumberField
                key={`${group}.${key}`}
                label={`${group} · ${key}`}
                value={value}
                disabled={props.readOnly}
                onChange={(nextValue) => props.updateConfig((next) => {
                  next.labour.multiplierValues[group]![key] = nextValue;
                })}
              />
            ))
          ))}
        </div>
      </div>
      <div className={styles.subsection}>
        <h4>Rafter length loading curve</h4>
        <div className={styles.grid}>
          {props.config.labour.rafterLengthLoadingCurve.flatMap((point, index) => [
            <NumberField
              key={`${index}.length`}
              label={`Point ${index + 1} length (m)`}
              value={point.length_m}
              disabled={props.readOnly}
              onChange={(value) => props.updateConfig((next) => {
                next.labour.rafterLengthLoadingCurve[index]!.length_m = value;
              })}
            />,
            <NumberField
              key={`${index}.minutes`}
              label={`Point ${index + 1} minutes per m`}
              value={point.minutes_per_m}
              disabled={props.readOnly}
              onChange={(value) => props.updateConfig((next) => {
                next.labour.rafterLengthLoadingCurve[index]!.minutes_per_m = value;
              })}
            />,
          ])}
        </div>
      </div>
    </div>
  );
}

function actionMinuteFields(
  actionId: string,
  minutes: CostingControlActionMinutesV1,
  label: string,
  props: Parameters<typeof LabourEditor>[0],
) {
  if (typeof minutes === 'number') {
    return [(
      <NumberField
        key={actionId}
        label={label}
        value={minutes}
        disabled={props.readOnly}
        onChange={(value) => props.updateConfig((next) => { next.labour.actionBaseMinutes[actionId] = value; })}
      />
    )];
  }
  return Object.entries(minutes.minutes_by_profile).map(([profile, value]) => (
    <NumberField
      key={`${actionId}.${profile}`}
      label={`${label} · ${profile}`}
      value={value}
      disabled={props.readOnly}
      onChange={(nextValue) => props.updateConfig((next) => {
        const action = next.labour.actionBaseMinutes[actionId];
        if (typeof action !== 'number' && action) action.minutes_by_profile[profile] = nextValue;
      })}
    />
  ));
}

function Comparison(props: {
  comparison: CostingConfigurationComparison | null;
  version: CostingConfigurationVersion;
}) {
  const diff = props.comparison?.diff ?? props.version.publicationDiff ?? [];
  const impact = props.comparison?.impact ?? props.version.publicationImpact ?? [];
  return (
    <div className={styles.section}>
      <div>
        <h3>Configuration diff</h3>
        <p className={styles.muted}>{diff.length} changed values against the version that was current at comparison time.</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Setting</th><th>Current</th><th>Draft</th></tr></thead>
            <tbody>
              {diff.map((entry) => (
                <tr key={entry.path}>
                  <td className={styles.diffPath}>{entry.path}</td>
                  <td>{String(entry.before ?? '—')}</td>
                  <td>{String(entry.after ?? '—')}</td>
                </tr>
              ))}
              {diff.length === 0 ? <tr><td colSpan={3}>No differences.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
      <div className={styles.subsection}>
        <h3>Representative scenario impact</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Scenario</th><th>Current ex GST</th><th>Draft ex GST</th><th>Change</th></tr></thead>
            <tbody>
              {impact.map((row) => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td>${row.beforeTotalExGst.toFixed(2)}</td>
                  <td>${row.afterTotalExGst.toFixed(2)}</td>
                  <td className={row.deltaExGst > 0 ? styles.positive : row.deltaExGst < 0 ? styles.negative : undefined}>
                    {row.deltaExGst >= 0 ? '+' : ''}${row.deltaExGst.toFixed(2)}
                    {row.deltaPercent === null ? '' : ` (${row.deltaPercent >= 0 ? '+' : ''}${row.deltaPercent.toFixed(2)}%)`}
                  </td>
                </tr>
              ))}
              {impact.length === 0 ? <tr><td colSpan={4}>Save a changed draft to generate impact results.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
