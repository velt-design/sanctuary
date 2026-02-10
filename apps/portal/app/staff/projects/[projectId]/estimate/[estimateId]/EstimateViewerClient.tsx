'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useEffect, useRef } from 'react';
import { deleteEstimate, getEstimate } from '@/lib/repo/estimatesRepo';
import type { Estimate } from '@/lib/types/estimate';
import styles from '../../../projects.module.css';
import { downloadCsv } from '@/lib/export/csv';
import { mapBOMLinesToCsvRows, mapInstallActionsToCsvRows } from '@/lib/export/mappers';
import { downloadJson, importExportFile, makeEstimateExportFile, readJsonFile } from '@/lib/export/json';
import { persistImportResultToDb } from '@/lib/export/importPersist';
import EstimateWarnings from '@/components/estimates/EstimateWarnings';
import { isCalculatorInputsV2, isLegacyCalculatorInputsV1 } from '@/lib/types/calculator';
import { buildJobPack } from '@/lib/outputs/jobPack';
import OutputsPanel from '@/components/outputs/OutputsPanel';
import PageHeader from '@/components/layout/PageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import MoreMenu from '@/components/portal/MoreMenu';
import { useToast } from '@/components/ui/toast/ToastProvider';
import Modal from '@/components/ui/modal/Modal';
import type { CalculatorInputs } from '@/lib/types/calculator';
import { createQuoteFromEstimate } from '@/lib/repo/quotesRepo';
import { quoteLabel } from '@/lib/types/quote';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';

type SectionKey = 'overview' | 'materials' | 'install' | 'overheads' | 'inputs' | 'warnings' | 'outputs';

function formatMoney(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return `$${n.toFixed(2)}`;
}

type WarningLike = { level: 'critical' | 'info'; message: string };

function normaliseWarnings(value: unknown): WarningLike[] {
  if (!Array.isArray(value)) return [];

  const out: WarningLike[] = [];
  for (const item of value) {
    if (typeof item === 'string') out.push({ level: 'info', message: item });
    else if (item && typeof item === 'object') {
      const level = (item as any).level === 'critical' ? 'critical' : 'info';
      const message = String((item as any).message ?? '').trim();
      if (message) out.push({ level, message });
    }
  }
  return out;
}

function formatInputValue(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v == null) return '';
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function formatModuleSummary(m: any): string {
  if (!m || typeof m !== 'object') return '—';
  if (m.pergolaStyle === 'hip_corner') {
    return `${m.pergolaStyle}, ${m.roofMaterial}, A:${m.lengthM}×${m.projectionM} B:${m.hipCornerLengthBM}×${m.hipCornerProjectionBM}m`;
  }
  return `${m.pergolaStyle}, ${m.roofMaterial}, ${m.lengthM}×${m.projectionM}m`;
}

function formatRoofSummary(inputs: unknown, derived: unknown): string {
  const pitch = (derived as any)?.roof_pitch_deg_used;
  const pitchLabel = typeof pitch === 'number' && Number.isFinite(pitch) ? `${pitch.toFixed(0)}°` : '';

  let base = '—';
  if (isCalculatorInputsV2(inputs)) {
    const mods = inputs.modules ?? [];
    base = mods.length > 1 ? `${mods.length} modules · ${formatModuleSummary(mods[0])}` : formatModuleSummary(mods[0]);
  } else if (isLegacyCalculatorInputsV1(inputs)) {
    base = `${inputs.pergolaStyle}, ${inputs.roofMaterial}, ${inputs.lengthM}×${inputs.projectionM}m`;
  }

  return pitchLabel ? `${base}, ${pitchLabel}` : base;
}

function getSnapshot(estimate: Estimate): { contact: { displayName: string; email: string; phone: string }; project: { projectName: string; region?: string; siteAddress?: string; quoteRef?: string } } {
  const snap = (estimate as any).snapshot;
  if (snap && typeof snap === 'object' && snap.contact && snap.project) {
    const contact = snap.contact as any;
    const project = snap.project as any;
    const projectName = typeof project.projectName === 'string' ? project.projectName : '';
    if (projectName.trim()) {
      return {
        contact: {
          displayName: String(contact.displayName ?? ''),
          email: String(contact.email ?? ''),
          phone: String(contact.phone ?? ''),
        },
        project: {
          projectName,
          region: typeof project.region === 'string' ? project.region : undefined,
          siteAddress: typeof project.siteAddress === 'string' ? project.siteAddress : undefined,
          quoteRef: typeof project.quoteRef === 'string' ? project.quoteRef : undefined,
        },
      };
    }
  }

  const legacy = (estimate as any).projectSnapshot as any;
  return {
    contact: {
      displayName: typeof legacy?.clientName === 'string' ? legacy.clientName : '',
      email: typeof legacy?.email === 'string' ? legacy.email : '',
      phone: typeof legacy?.phone === 'string' ? legacy.phone : '',
    },
    project: {
      projectName: typeof legacy?.name === 'string' ? legacy.name : (estimate as any).inputs?.projectName ?? '—',
      region: typeof legacy?.region === 'string' ? legacy.region : undefined,
      siteAddress: typeof legacy?.address === 'string' ? legacy.address : undefined,
      quoteRef: typeof legacy?.quoteRef === 'string' ? legacy.quoteRef : undefined,
    },
  };
}

function tryCopyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return Promise.reject(new Error('Clipboard not available'));
}

function titleForSection(key: SectionKey): string {
  switch (key) {
    case 'overview':
      return 'Overview';
    case 'materials':
      return 'Materials';
    case 'install':
      return 'Install';
    case 'overheads':
      return 'Overheads';
    case 'outputs':
      return 'Outputs';
    case 'inputs':
      return 'Inputs';
    case 'warnings':
      return 'Warnings';
    default:
      return key;
  }
}

function buildReadableInputs(inputs: unknown): {
  modules: Array<{
    title: string;
    rows: Array<{ label: string; value: string }>;
  }>;
  jobRows: Array<{ label: string; value: string }>;
} {
  if (!inputs) return { modules: [], jobRows: [] };

  if (isCalculatorInputsV2(inputs)) {
    const job = inputs as CalculatorInputs;
    const jobRows: Array<{ label: string; value: string }> = [
      { label: 'Access', value: String(job.access ?? '—') },
      { label: 'Height', value: String(job.height ?? '—') },
      { label: 'Travel (ex‑GST)', value: String(job.travelExGst ?? '0') },
      { label: 'Extras allowance (ex‑GST)', value: String(job.extrasAllowanceExGst ?? '0') },
      { label: 'Discount (%)', value: String(job.quoteDiscountPct ?? '0') },
    ];

    const modules = (job.modules ?? []).map((m, idx) => {
      const title = `Module ${idx + 1}`;
      const rows: Array<{ label: string; value: string }> = [
        { label: 'Style', value: String(m.pergolaStyle ?? '—') },
        { label: 'Roof material', value: String(m.roofMaterial ?? '—') },
        { label: 'Extrusion colour', value: String(m.extrusionColour ?? '—') },
        { label: 'Roof length (m)', value: String(m.lengthM ?? '—') },
        { label: 'Roof span (eave‑to‑eave) (m)', value: String(m.projectionM ?? '—') },
        ...(m.pergolaStyle === 'hip_corner'
          ? [
              { label: 'Roof length B (m)', value: String((m as any).hipCornerLengthBM ?? '—') },
              { label: 'Roof span B (m)', value: String((m as any).hipCornerProjectionBM ?? '—') },
            ]
          : []),
        { label: 'Roof pitch (deg)', value: String(m.roofPitchDeg?.trim() ? m.roofPitchDeg : 'default') },
        { label: 'House connection', value: String(m.houseConnectionType ?? '—') },
        { label: 'Post connection', value: String(m.postConnectionType ?? '—') },
        { label: 'Post count', value: String(m.postCount ?? '—') },
      ];
      return { title, rows };
    });

    return { modules, jobRows };
  }

  if (isLegacyCalculatorInputsV1(inputs)) {
    const jobRows: Array<{ label: string; value: string }> = [
      { label: 'Access', value: String(inputs.access ?? '—') },
      { label: 'Height', value: String(inputs.height ?? '—') },
      { label: 'Travel (ex‑GST)', value: String(inputs.travelExGst ?? '0') },
      { label: 'Extras allowance (ex‑GST)', value: String(inputs.extrasAllowanceExGst ?? '0') },
      { label: 'Discount (%)', value: String(inputs.quoteDiscountPct ?? '0') },
    ];

    const modules = [
      {
        title: 'Module 1',
        rows: [
          { label: 'Style', value: String(inputs.pergolaStyle ?? '—') },
          { label: 'Roof material', value: String(inputs.roofMaterial ?? '—') },
          { label: 'Extrusion colour', value: String(inputs.extrusionColour ?? '—') },
          { label: 'Roof length (m)', value: String(inputs.lengthM ?? '—') },
          { label: 'Roof span (eave‑to‑eave) (m)', value: String(inputs.projectionM ?? '—') },
          { label: 'Roof pitch (deg)', value: String(inputs.roofPitchDeg?.trim() ? inputs.roofPitchDeg : 'default') },
          { label: 'House connection', value: String(inputs.houseConnectionType ?? '—') },
          { label: 'Post connection', value: String(inputs.postConnectionType ?? '—') },
          { label: 'Post count', value: String(inputs.postCount ?? '—') },
        ],
      },
    ];

    return { modules, jobRows };
  }

  return { modules: [], jobRows: [] };
}

export default function EstimateViewerClient({
  projectId,
  estimateId,
  isAdmin: isAdminProp,
}: {
  projectId: string;
  estimateId: string;
  isAdmin?: boolean;
}) {
  const { role } = usePortalSession();
  const isAdmin = typeof isAdminProp === 'boolean' ? isAdminProp : (role ?? 'staff') === 'admin';

  const router = useRouter();
  const toast = useToast();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [active, setActive] = useState<SectionKey>('overview');
  const importRef = useRef<HTMLInputElement | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [createQuoteOpen, setCreateQuoteOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    void (async () => {
      setEstimate(await getEstimate(estimateId));
    })();
  }, [estimateId]);

  const inputRows = useMemo(() => {
    if (!estimate) return [];
    const inputs = (estimate as any).inputs as unknown;
    if (isCalculatorInputsV2(inputs)) {
      const rows: Array<[string, string]> = [];
      const entries = Object.entries(inputs as any).filter(([k]) => k !== 'modules');
      for (const [k, v] of entries) rows.push([k, formatInputValue(v)]);
      (inputs.modules ?? []).forEach((m: any, idx: number) => {
        for (const [k, v] of Object.entries(m ?? {})) rows.push([`module_${idx + 1}.${k}`, formatInputValue(v)]);
      });
      return rows;
    }
    if (isLegacyCalculatorInputsV1(inputs)) return Object.entries(inputs).map(([k, v]) => [k, formatInputValue(v)]);
    if (inputs && typeof inputs === 'object') return Object.entries(inputs as any).map(([k, v]) => [k, formatInputValue(v)]);
    return [];
  }, [estimate]);

  const jobPack = useMemo(() => {
    if (!estimate) return null;
    return buildJobPack(estimate);
  }, [estimate]);

  const rawInputsJson = useMemo(() => {
    if (!estimate) return '';
    try {
      return JSON.stringify((estimate as any).inputs, null, 2);
    } catch {
      return String((estimate as any).inputs ?? '');
    }
  }, [estimate]);

  if (!estimate) {
    return (
      <main className={styles.page}>
        <PageHeader
          title="Job pack"
          right={
            <HeaderActions>
              <Link className={styles.buttonSecondary} href={`/staff/projects/${encodeURIComponent(projectId)}`}>
                Project
              </Link>
            </HeaderActions>
          }
        />
        <p className={styles.note}>Ordering + install outputs (read-only snapshot).</p>
        <p className={styles.note}>This job pack doesn’t exist in the portal database.</p>
      </main>
    );
  }

  const warnings = normaliseWarnings(
    (estimate.outputs as any).warnings ?? (estimate.outputs.totals as any).warnings ?? (estimate.outputs.totals as any).notes_and_warnings,
  );
  const criticalWarnings = warnings.filter((w) => w.level === 'critical');
  const roofSummary = formatRoofSummary((estimate as any).inputs, (estimate as any).derived);
  const snapshot = getSnapshot(estimate);
  const readableInputs = buildReadableInputs((estimate as any).inputs);

  return (
    <main className={styles.page}>
      <PageHeader
        title="Job pack"
        right={
          <HeaderActions>
            <Link className={styles.buttonSecondary} href={`/staff/projects/${encodeURIComponent(projectId)}`}>
              Project
            </Link>
            <Link
              className={styles.button}
              href={`/staff/calculator?projectId=${encodeURIComponent(projectId)}&fromEstimateId=${encodeURIComponent(estimateId)}`}
            >
              Duplicate to Draft
            </Link>
            <MoreMenu
              items={[
                {
                  label: 'Create Quote',
                  onClick: () => {
                    setCreateQuoteOpen(true);
                  },
                  disabled: Boolean(busy),
                },
                {
                  label: 'Export Estimate JSON',
                  onClick: async () => {
                    try {
                      const file = await makeEstimateExportFile(estimate);
                      downloadJson(`estimate_${estimate.id}.json`, file);
                      toast.success('Estimate JSON exported.');
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Export failed';
                      toast.error(msg);
                    }
                  },
                  disabled: Boolean(busy),
                },
                {
                  label: 'Import JSON',
                  onClick: () => {
                    setDeleteError(null);
                    importRef.current?.click();
                  },
                  disabled: Boolean(busy),
                },
                {
                  label: 'Export BOM CSV',
                  onClick: () => {
                    const rows = mapBOMLinesToCsvRows(estimate.outputs.materials.lines);
                    downloadCsv(
                      `bom_${projectId}_${estimateId}.csv`,
                      rows,
                      [
                        { key: 'item', header: 'Item' },
                        { key: 'profile', header: 'Profile' },
                        { key: 'unit', header: 'Unit' },
                        { key: 'quantity', header: 'Quantity' },
                        { key: 'cost_ex_gst', header: 'Cost ex-GST' },
                        { key: 'notes', header: 'Notes' },
                      ],
                    );
                    toast.success('BOM CSV exported.');
                  },
                  disabled: Boolean(busy),
                },
                {
                  label: 'Export Install CSV',
                  onClick: () => {
                    const rows = mapInstallActionsToCsvRows(estimate.outputs.install.actions);
                    downloadCsv(
                      `install_${projectId}_${estimateId}.csv`,
                      rows,
                      [
                        { key: 'action', header: 'Action' },
                        { key: 'scope', header: 'Scope' },
                        { key: 'quantity', header: 'Quantity' },
                        { key: 'minutes', header: 'Minutes' },
                        { key: 'cost_ex_gst', header: 'Cost ex-GST' },
                      ],
                    );
                    toast.success('Install CSV exported.');
                  },
                  disabled: Boolean(busy),
                },
                ...(isAdmin
                  ? [
                      {
                        label: 'Delete Estimate',
                        danger: true,
                        onClick: () => {
                          setDeleteError(null);
                          setDeleteOpen(true);
                        },
                        disabled: Boolean(busy),
                      },
                    ]
                  : []),
              ]}
              disabled={Boolean(busy)}
            />
          </HeaderActions>
        }
      />

      <input
        ref={importRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setDeleteError(null);

          await run('importJson', async () => {
            try {
              const payload = await readJsonFile(file);
              const res = importExportFile(payload);
              await persistImportResultToDb(res);
              if (res.kind === 'project') {
                toast.success(`Imported project ${res.projectId} (${res.estimatesImported} estimate(s)).`);
                router.push(`/staff/projects/${encodeURIComponent(res.projectId)}`);
              } else {
                toast.success(`Imported estimate ${res.estimateId}.`);
                router.push(`/staff/projects/${encodeURIComponent(res.projectId)}/estimate/${encodeURIComponent(res.estimateId)}`);
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Import failed';
              setDeleteError(msg);
              toast.error(msg);
            }
          });
        }}
      />

      {deleteError ? <p className={styles.error}>{deleteError}</p> : null}

      <p className={styles.note}>Ordering + install outputs (read-only snapshot).</p>

      <section className={styles.section} aria-label="Job pack summary">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Summary</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={styles.muted}>
              Total ex‑GST: <strong>{formatMoney(estimate.outputs.totals.cost_ex_gst)}</strong>
            </span>
            <button
              type="button"
              className={styles.buttonSecondary}
              disabled={busy === 'copyTotals'}
              onClick={() => {
                run('copyTotals', async () => {
                  const text = [
                    `Total ex-GST: ${formatMoney(estimate.outputs.totals.cost_ex_gst)}`,
                    `Materials ex-GST: ${formatMoney(estimate.outputs.materials.totals.materials_ex_gst)}`,
                    `Install ex-GST: ${formatMoney(estimate.outputs.install.totals.install_ex_gst)}`,
                    `Overhead ex-GST: ${formatMoney(estimate.outputs.overhead.total_ex_gst)}`,
                  ].join('\n');
                  try {
                    await tryCopyText(text);
                    toast.success('Totals copied.');
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Copy failed';
                    toast.error(msg);
                  }
                });
              }}
            >
              {busy === 'copyTotals' ? 'Copying…' : 'Copy totals'}
            </button>
          </div>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <th>Total true cost (ex‑GST)</th>
                  <td>{formatMoney(estimate.outputs.totals.cost_ex_gst)}</td>
                  <th>Total true cost (inc‑GST)</th>
                  <td>{formatMoney(estimate.outputs.totals.cost_inc_gst)}</td>
                </tr>
                  <tr>
                    <th>Crew hours</th>
                    <td>{estimate.outputs.install.totals.crew_hours.toFixed(2)}</td>
                    <th>Warnings</th>
                  <td>
                    {warnings.length ? (
                      <>
                        {warnings.length}
                        {criticalWarnings.length ? <span className={styles.muted}> (critical: {criticalWarnings.length})</span> : null}
                      </>
                    ) : (
                      '0'
                    )}
                  </td>
                </tr>
                <tr>
                  <th>Materials (ex‑GST)</th>
                  <td>{formatMoney(estimate.outputs.materials.totals.materials_ex_gst)}</td>
                  <th>Install payout (ex‑GST)</th>
                  <td>{formatMoney(estimate.outputs.install.totals.install_ex_gst)}</td>
                </tr>
                <tr>
                  <th>Overhead (ex‑GST)</th>
                  <td>{formatMoney(estimate.outputs.overhead.total_ex_gst)}</td>
                  <th>Roof</th>
                  <td className={styles.muted}>{roofSummary}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className={styles.tabsBar} aria-label="Job pack sections">
        <div className={styles.tabsBarInner}>
          <div className={styles.tabsGroup}>
            {(['overview', 'materials', 'install', 'overheads', 'outputs', 'inputs', 'warnings'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={active === k ? styles.button : styles.buttonSecondary}
                onClick={() => setActive(k)}
              >
                {titleForSection(k)}
              </button>
            ))}
          </div>
          <div className={styles.muted} style={{ fontSize: 12 }}>
            Read‑only snapshot
          </div>
        </div>
      </div>

      <section className={styles.section} aria-label="Job pack section" style={{ marginTop: 14 }}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{titleForSection(active)}</h2>
        </div>
        <div className={styles.sectionBody}>
          {active === 'overview' ? (
            <>
              <p className={styles.note}>
                Read‑only snapshot. No recalculation happens on this page.
              </p>
              <div className={styles.tableWrap} style={{ marginTop: 12 }}>
                <table className={styles.table}>
                  <tbody>
                    <tr>
                      <th style={{ width: 220 }}>Snapshot (contact)</th>
                      <td>
                        <div>{snapshot.contact.displayName || '—'}</div>
                        <div className={styles.muted}>{snapshot.contact.email || '—'}</div>
                        <div className={styles.muted}>{snapshot.contact.phone || '—'}</div>
                      </td>
                    </tr>
                    <tr>
                      <th>Snapshot (project)</th>
                      <td>
                        <div>{snapshot.project.projectName}</div>
                        <div className={styles.muted}>{snapshot.project.siteAddress || '—'}</div>
                        <div className={styles.muted}>
                          {snapshot.project.region || '—'}
                          {snapshot.project.quoteRef ? ` · ${snapshot.project.quoteRef}` : ''}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className={styles.tableWrap} style={{ marginTop: 12 }}>
                <table className={styles.table}>
                  <tbody>
                    <tr>
                      <th style={{ width: 220 }}>Config (manifest)</th>
                      <td>{estimate.configVersions.manifest}</td>
                    </tr>
                    <tr>
                      <th>Rules</th>
                      <td>{estimate.configVersions.rules}</td>
                    </tr>
                    <tr>
                      <th>Pricebook</th>
                      <td>{estimate.configVersions.pricebook}</td>
                    </tr>
                    <tr>
                      <th>Install actions</th>
                      <td>{estimate.configVersions.installActions}</td>
                    </tr>
                    <tr>
                      <th>Overheads</th>
                      <td>{estimate.configVersions.overheads}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {active === 'materials' ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Profile</th>
                    <th>Unit</th>
                    <th>Quantity</th>
                    <th>Cost ex‑GST</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.outputs.materials.lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.label}</td>
                      <td className={styles.muted}>{l.profile ?? ''}</td>
                      <td className={styles.muted}>{l.unit}</td>
                      <td>{l.qty}</td>
                      <td>{formatMoney(l.line_cost_ex_gst)}</td>
                      <td className={styles.muted}>{l.notes ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {active === 'install' ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Scope</th>
                    <th>Quantity</th>
                    <th>Minutes</th>
                    <th>Cost ex‑GST</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.outputs.install.actions.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {a.label}
                        <div className={styles.muted}>{a.category}</div>
                      </td>
                      <td className={styles.muted}>{a.scope ?? ''}</td>
                      <td>{a.qty}</td>
                      <td>{a.minutes}</td>
                      <td>{formatMoney(a.cost_ex_gst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {active === 'overheads' ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <tbody>
                  <tr>
                    <th style={{ width: 220 }}>Method</th>
                    <td>{estimate.outputs.overhead.method}</td>
                  </tr>
                  <tr>
                    <th>Ops / delivery</th>
                    <td>{formatMoney(estimate.outputs.overhead.ops_ex_gst)}</td>
                  </tr>
                  <tr>
                    <th>Sales / design</th>
                    <td>{formatMoney(estimate.outputs.overhead.sales_ex_gst)}</td>
                  </tr>
                  <tr>
                    <th>Total overhead</th>
                    <td>{formatMoney(estimate.outputs.overhead.total_ex_gst)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}

          {active === 'inputs' ? (
            <>
              <h3 className={styles.sectionTitle} style={{ marginBottom: 10 }}>
                Readable inputs
              </h3>

              {readableInputs.jobRows.length ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <tbody>
                      {readableInputs.jobRows.map((row) => (
                        <tr key={row.label}>
                          <th style={{ width: 220 }}>{row.label}</th>
                          <td className={styles.muted}>{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {readableInputs.modules.map((mod) => (
                <div key={mod.title} className={styles.tableWrap} style={{ marginTop: 12 }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th colSpan={2}>{mod.title}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mod.rows.map((row) => (
                        <tr key={row.label}>
                          <th style={{ width: 220 }}>{row.label}</th>
                          <td className={styles.muted}>{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              <details style={{ marginTop: 12 }}>
                <summary className={styles.buttonSecondary} style={{ listStyle: 'none' }}>
                  Raw JSON
                </summary>
                <div className={styles.codePanel} style={{ marginTop: 10 }}>
                  <div className={styles.codeHeader}>
                    <p className={styles.codeTitle}>Inputs JSON</p>
                    <button
                      type="button"
                      className={styles.buttonSecondary}
                      disabled={busy === 'copyRawInputs'}
                      onClick={() => {
                        run('copyRawInputs', async () => {
                          try {
                            await tryCopyText(rawInputsJson);
                            toast.success('Inputs JSON copied.');
                          } catch (err) {
                            const msg = err instanceof Error ? err.message : 'Copy failed';
                            toast.error(msg);
                          }
                        });
                      }}
                    >
                      {busy === 'copyRawInputs' ? 'Copying…' : 'Copy'}
                    </button>
                  </div>
                  <pre className={styles.codePre}>{rawInputsJson}</pre>
                </div>
              </details>
            </>
          ) : null}

          {active === 'warnings' ? <EstimateWarnings warnings={warnings} /> : null}

          {active === 'outputs'
            ? jobPack
              ? <OutputsPanel estimate={estimate} jobPack={jobPack} />
              : <p className={styles.note}>Outputs unavailable.</p>
            : null}
        </div>
      </section>

      {deleteOpen ? (
        <Modal
          open
          ariaLabel="Delete estimate confirmation"
          onClose={() => {
            setDeleteError(null);
            setDeleteOpen(false);
          }}
          overlayClassName={styles.modalOverlay}
          panelClassName={styles.modal}
          maxWidthPx={520}
          closeOnBackdrop={busy !== 'deleteEstimate'}
          closeOnEsc={busy !== 'deleteEstimate'}
        >
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Delete estimate?</h2>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => {
                setDeleteError(null);
                setDeleteOpen(false);
              }}
              disabled={busy === 'deleteEstimate'}
            >
              Close
            </button>
          </div>
          <p className={styles.note}>This removes the estimate snapshot from the portal database.</p>
          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={() => {
                setDeleteError(null);
                setDeleteOpen(false);
              }}
              disabled={busy === 'deleteEstimate'}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.buttonDanger}
              onClick={() => {
                run('deleteEstimate', () => {
                  setDeleteError(null);
                  return (async () => {
                    try {
                      await deleteEstimate(estimateId);
                      toast.success('Estimate deleted.');
                      router.push(`/staff/projects/${encodeURIComponent(projectId)}`);
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Failed to delete estimate';
                      setDeleteError(msg);
                      toast.error(msg);
                    }
                  })();
                });
              }}
              disabled={busy === 'deleteEstimate'}
            >
              {busy === 'deleteEstimate' ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      ) : null}

      {createQuoteOpen ? (
        <Modal
          open
          ariaLabel="Create quote confirmation"
          onClose={() => setCreateQuoteOpen(false)}
          overlayClassName={styles.modalOverlay}
          panelClassName={styles.modal}
          maxWidthPx={520}
        >
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Create quote?</h2>
            <button type="button" className={styles.modalClose} onClick={() => setCreateQuoteOpen(false)}>
              Close
            </button>
          </div>
          <p className={styles.note}>This creates a draft quote by snapshotting this estimate’s outputs.</p>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.buttonSecondary} onClick={() => setCreateQuoteOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.button}
              disabled={Boolean(busy)}
              onClick={() => {
                run('createQuote', () => {
                  return (async () => {
                    try {
                      const quote = await createQuoteFromEstimate(projectId, estimateId);
                      toast.success(`${quoteLabel(quote)} created.`);
                      setCreateQuoteOpen(false);
                      router.push(`/staff/projects/${encodeURIComponent(projectId)}/quotes/${encodeURIComponent(quote.id)}`);
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Failed to create quote';
                      toast.error(msg);
                    }
                  })();
                });
              }}
            >
              Create
            </button>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
