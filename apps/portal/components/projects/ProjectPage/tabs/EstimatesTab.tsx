'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ModuleViewsCard, { type ModuleViewsStatus, type ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import { apiJson } from '@/lib/repo/apiClient';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import type { EstimateDetail, EstimateMeta, EstimateStatus, EstimateSummary } from '@/lib/estimates/types';
import { isCalculatorInputsV2, isLegacyCalculatorInputsV1 } from '@/lib/types/calculator';
import { createQuoteFromEstimate } from '@/lib/quotes/quotesRepo';
import type { QuoteStatus, QuoteVersion } from '@/lib/quotes/types';
import { useToast } from '@/components/ui/toast/ToastProvider';
import RequestDesignModal from '@/components/designPackages/RequestDesignModal';
import legacy from '@/app/staff/projects/projects.module.css';
import styles from './EstimatesTab.module.css';
import EstimateVersionTabs from './_components/EstimateVersionTabs';
import { estimateDetailQueryOptions, estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import { quoteVersionsByProjectQueryOptions } from '@/lib/queries/quotes';
import { qk } from '@/lib/queries/keys';
import { invalidateProjectReadCaches } from '@/lib/queries/projectCache';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

function formatMoney(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `${value.toFixed(1)}%`;
}

function formatDateShort(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString();
}

function formatDateLong(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatSavedLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return 'Saved';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'Saved just now';
  const time = formatTime(value);
  return time ? `Saved ${time}` : 'Saved';
}

function renderValue(value: string | null | undefined): ReactNode {
  if (!value || value === '—') return <span className={styles.mutedValue}>Not set</span>;
  return value;
}

function formatStatusLabel(status: EstimateStatus): string {
  switch (status) {
    case 'archived':
      return 'Archived';
    default:
      return 'Draft';
  }
}

function statusClass(status: EstimateStatus): string {
  switch (status) {
    case 'archived':
      return styles.statusMuted;
    default:
      return styles.statusDraft;
  }
}

function formatMargin(summary?: EstimateSummary): string {
  if (!summary) return '—';
  const value = summary.marginValue;
  const pct = summary.marginPct;
  if (typeof value === 'number' && Number.isFinite(value) && typeof pct === 'number' && Number.isFinite(pct)) {
    const pctText = formatPercent(pct);
    const valueText = formatMoney(value);
    if (pctText && valueText) return `${pctText} · ${valueText}`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return formatMoney(value) ?? '—';
  if (typeof pct === 'number' && Number.isFinite(pct)) return formatPercent(pct) ?? '—';
  return '—';
}

function summaryTotal(summary?: EstimateSummary): number | null {
  if (!summary) return null;
  if (typeof summary.total === 'number' && Number.isFinite(summary.total)) return summary.total;
  if (typeof summary.cost === 'number' && Number.isFinite(summary.cost)) return summary.cost;
  return null;
}

type BreakdownRow = {
  label: string;
  qty?: number | null;
  unit?: string | null;
  cost?: number | null;
  note?: string | null;
};

type BreakdownCategory = {
  id: string;
  title: string;
  total?: number | null;
  rows: BreakdownRow[];
};

type BreakdownTotal = {
  id: string;
  title: string;
  total?: number | null;
};

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (m) => m.toUpperCase())
    .trim();
}

function formatModulesCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return `${value} module${value === 1 ? '' : 's'}`;
}

function formatSize(length: unknown, projection: unknown, prefix?: string): string {
  const len = typeof length === 'number' ? length : typeof length === 'string' ? Number.parseFloat(length) : null;
  const proj = typeof projection === 'number' ? projection : typeof projection === 'string' ? Number.parseFloat(projection) : null;
  if (!Number.isFinite(len ?? NaN) || !Number.isFinite(proj ?? NaN)) return '';
  const label = `${len}m × ${proj}m`;
  return prefix ? `${prefix}${label}` : label;
}

type ModuleSpec = {
  style?: string | null;
  lengthM?: number | null;
  spanM?: number | null;
  roofRaw?: string | null;
};

function normalizeRoofType(raw?: string | null): 'Acrylic' | 'Timber' | 'Combination' | undefined {
  const value = (raw ?? '').toLowerCase();
  if (!value) return undefined;
  if ((value.includes('acrylic') && value.includes('timber')) || value.includes('mixed') || value.includes('comb')) {
    return 'Combination';
  }
  if (value.includes('acrylic')) return 'Acrylic';
  if (value.includes('timber')) return 'Timber';
  return undefined;
}

function formatDimension(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function getModuleSpecs(snapshot: Record<string, unknown> | null): ModuleSpec[] {
  if (!snapshot) return [];
  const directModules = Array.isArray((snapshot as any).modules) ? (snapshot as any).modules : null;
  if (directModules && directModules.length) {
    return directModules.map((module: any) => ({
      style: typeof module?.pergolaStyle === 'string' ? toTitleCase(module.pergolaStyle) : null,
      lengthM: readNumber(module, ['lengthM']),
      spanM: readNumber(module, ['projectionM']),
      roofRaw: typeof module?.roofMaterial === 'string' ? module.roofMaterial : null,
    }));
  }

  const inputs = (snapshot as any).inputs ?? (snapshot as any).calculator_snapshot?.inputs ?? null;
  if (!inputs || typeof inputs !== 'object') return [];

  if (isCalculatorInputsV2(inputs)) {
    return inputs.modules.map((module) => ({
      style: typeof module.pergolaStyle === 'string' ? toTitleCase(module.pergolaStyle) : null,
      lengthM: readNumber(module, ['lengthM']),
      spanM: readNumber(module, ['projectionM']),
      roofRaw: typeof module.roofMaterial === 'string' ? module.roofMaterial : null,
    }));
  }

  if (isLegacyCalculatorInputsV1(inputs)) {
    return [
      {
        style: typeof inputs.pergolaStyle === 'string' ? toTitleCase(inputs.pergolaStyle) : null,
        lengthM: readNumber(inputs, ['lengthM']),
        spanM: readNumber(inputs, ['projectionM']),
        roofRaw: typeof inputs.roofMaterial === 'string' ? inputs.roofMaterial : null,
      },
    ];
  }

  return [];
}

function formatModuleLine(spec: ModuleSpec, index: number): string {
  const parts: string[] = [`M${index + 1}`];
  if (spec.style) parts.push(spec.style);
  const length = formatDimension(spec.lengthM ?? null);
  const span = formatDimension(spec.spanM ?? null);
  if (length && span) {
    parts.push(`${length}m x ${span}m`);
  }
  const roofType = normalizeRoofType(spec.roofRaw ?? null);
  if (roofType) parts.push(roofType);
  if (parts.length === 1) return `${parts[0]} - Details not set`;
  return parts.join(' - ');
}

function getPergolaSpecs(snapshot: Record<string, unknown> | null): string | null {
  if (!snapshot) return null;
  const inputs = (snapshot as any).inputs ?? (snapshot as any).calculator_snapshot?.inputs ?? null;
  if (!inputs || typeof inputs !== 'object') return null;

  let modulesCount: number | null = null;
  let style: string | null = null;
  let size: string | null = null;

  if (isCalculatorInputsV2(inputs)) {
    modulesCount = inputs.modules.length;
    const module = inputs.modules[0];
    if (module) {
      style = typeof module.pergolaStyle === 'string' ? toTitleCase(module.pergolaStyle) : null;
      const base = formatSize(module.lengthM, module.projectionM);
      if (module.pergolaStyle === 'hip_corner') {
        const secondary = formatSize((module as any).hipCornerLengthBM, (module as any).hipCornerProjectionBM, 'B ');
        size = [base && `A ${base}`, secondary].filter(Boolean).join(' • ') || base || secondary || null;
      } else {
        size = base || null;
      }
    }
  } else if (isLegacyCalculatorInputsV1(inputs)) {
    modulesCount = 1;
    style = typeof inputs.pergolaStyle === 'string' ? toTitleCase(inputs.pergolaStyle) : null;
    size = formatSize(inputs.lengthM, inputs.projectionM) || null;
  }

  const parts = [style, size, modulesCount ? formatModulesCount(modulesCount) : ''].filter(Boolean);
  return parts.length ? parts.join(' • ') : null;
}

function normalizeNotes(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          const msg = String((item as any).message ?? '').trim();
          return msg;
        }
        return '';
      })
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|\s*;\s*/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function readNumber(source: unknown, path: string[]): number | null {
  let cursor: any = source;
  for (const key of path) {
    if (!cursor || typeof cursor !== 'object') return null;
    cursor = cursor[key];
  }
  if (typeof cursor === 'number' && Number.isFinite(cursor)) return cursor;
  if (typeof cursor === 'string') {
    const parsed = Number.parseFloat(cursor);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildBreakdown(snapshot: Record<string, unknown> | null): BreakdownCategory[] {
  if (!snapshot) return [];
  const outputs = (snapshot as any).outputs ?? null;
  const materialsLines = Array.isArray(outputs?.materials?.lines) ? outputs.materials.lines : [];
  const installActions = Array.isArray(outputs?.install?.actions) ? outputs.install.actions : [];
  const overhead = outputs?.overhead ?? null;

  const categories: BreakdownCategory[] = [];

  if (materialsLines.length) {
    const rows: BreakdownRow[] = materialsLines.map((line: any) => ({
      label: String(line?.label ?? line?.id ?? 'Line item'),
      qty: typeof line?.qty === 'number' ? line.qty : null,
      unit: typeof line?.unit === 'string' ? line.unit : null,
      cost: typeof line?.line_cost_ex_gst === 'number' ? line.line_cost_ex_gst : null,
      note: typeof line?.notes === 'string' ? line.notes : null,
    }));
    const total = rows.reduce((sum, row) => sum + (typeof row.cost === 'number' ? row.cost : 0), 0);
    categories.push({ id: 'materials', title: 'Materials', total, rows });
  }

  if (installActions.length) {
    const grouped = new Map<string, BreakdownRow[]>();
    for (const action of installActions) {
      const rawCategory = typeof action?.category === 'string' && action.category.trim() ? action.category.trim() : 'Other';
      const key = rawCategory.toLowerCase();
      const list = grouped.get(key) ?? [];
      list.push({
        label: String(action?.label ?? action?.id ?? 'Install action'),
        qty: typeof action?.qty === 'number' ? action.qty : null,
        unit: typeof action?.unit === 'string' ? action.unit : null,
        cost: typeof action?.cost_ex_gst === 'number' ? action.cost_ex_gst : null,
        note: typeof action?.scope === 'string' ? `Scope: ${action.scope}` : null,
      });
      grouped.set(key, list);
    }

    Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([category, rows]) => {
        const total = rows.reduce((sum, row) => sum + (typeof row.cost === 'number' ? row.cost : 0), 0);
        categories.push({
          id: `install-${category}`,
          title: `Install: ${toTitleCase(category)}`,
          total,
          rows,
        });
      });
  }

  const overheadTotal = typeof overhead?.total_ex_gst === 'number' ? overhead.total_ex_gst : null;
  if (overheadTotal !== null) {
    categories.push({
      id: 'overhead',
      title: 'Overhead',
      total: overheadTotal,
      rows: [
        {
          label: typeof overhead?.method === 'string' ? overhead.method : 'Overhead allocation',
          qty: null,
          unit: null,
          cost: overheadTotal,
        },
      ],
    });
  }

  return categories;
}

function buildBreakdownTotals(snapshot: Record<string, unknown> | null): BreakdownTotal[] {
  if (!snapshot) return [];
  const outputs = (snapshot as any).outputs ?? null;
  const totals: BreakdownTotal[] = [];

  const materialsTotal = outputs?.materials?.totals?.materials_ex_gst;
  if (typeof materialsTotal === 'number' && Number.isFinite(materialsTotal)) {
    totals.push({ id: 'materials', title: 'Materials', total: materialsTotal });
  }

  const installTotal = outputs?.install?.totals?.install_ex_gst;
  if (typeof installTotal === 'number' && Number.isFinite(installTotal)) {
    totals.push({ id: 'install', title: 'Install', total: installTotal });
  }

  const overheadTotal = outputs?.overhead?.total_ex_gst;
  if (typeof overheadTotal === 'number' && Number.isFinite(overheadTotal)) {
    totals.push({ id: 'overhead', title: 'Overhead', total: overheadTotal });
  }

  if (!totals.length) {
    const detailed = buildBreakdown(snapshot);
    const materials = detailed.find((c) => c.id === 'materials')?.total ?? null;
    const overhead = detailed.find((c) => c.id === 'overhead')?.total ?? null;
    const install = detailed
      .filter((c) => c.id.startsWith('install-'))
      .reduce((sum, c) => sum + (typeof c.total === 'number' ? c.total : 0), 0);

    if (materials !== null) totals.push({ id: 'materials', title: 'Materials', total: materials });
    if (install) totals.push({ id: 'install', title: 'Install', total: install });
    if (overhead !== null) totals.push({ id: 'overhead', title: 'Overhead', total: overhead });
  }

  return totals;
}

type FocusGroup = {
  key: string;
  label: string;
  rows: BreakdownRow[];
  total?: number | null;
};

function quoteStatusLabel(status: QuoteStatus): string {
  switch (status) {
    case 'SENT':
      return 'SENT';
    case 'ACCEPTED':
      return 'ACCEPTED';
    case 'DECLINED':
      return 'DECLINED';
    default:
      return 'DRAFT';
  }
}

function quoteStatusClass(status: QuoteStatus): string {
  switch (status) {
    case 'SENT':
      return styles.quoteStatusSent;
    case 'ACCEPTED':
      return styles.quoteStatusAccepted;
    case 'DECLINED':
      return styles.quoteStatusDeclined;
    default:
      return styles.quoteStatusDraft;
  }
}

function buildFocusGroups(categories: BreakdownCategory[]): FocusGroup[] {
  if (!categories.length) return [];
  const groups = new Map<string, FocusGroup>();

  const ensure = (key: string, label: string) => {
    const existing = groups.get(key);
    if (existing) return existing;
    const created: FocusGroup = { key, label, rows: [], total: 0 };
    groups.set(key, created);
    return created;
  };

  for (const category of categories) {
    if (category.id === 'materials') {
      const group = ensure('materials', 'Materials');
      group.rows.push(...category.rows);
      group.total = (group.total ?? 0) + (typeof category.total === 'number' ? category.total : 0);
      continue;
    }

    if (category.id.startsWith('install-')) {
      const group = ensure('install', 'Install');
      group.rows.push(...category.rows);
      group.total = (group.total ?? 0) + (typeof category.total === 'number' ? category.total : 0);
      continue;
    }

    if (category.id === 'overhead') {
      const group = ensure('overhead', 'Overheads');
      group.rows.push(...category.rows);
      group.total = (group.total ?? 0) + (typeof category.total === 'number' ? category.total : 0);
      continue;
    }

    const group = ensure(category.id, category.title);
    group.rows.push(...category.rows);
    group.total = (group.total ?? 0) + (typeof category.total === 'number' ? category.total : 0);
  }

  const orderedKeys = ['materials', 'install', 'overhead'];
  const remaining = Array.from(groups.values()).filter((g) => !orderedKeys.includes(g.key));
  remaining.sort((a, b) => a.label.localeCompare(b.label));

  return [
    ...orderedKeys.map((key) => groups.get(key)).filter((g): g is FocusGroup => Boolean(g)),
    ...remaining,
  ];
}

function detailToMeta(detail: EstimateDetail): EstimateMeta {
  return {
    id: detail.id,
    projectId: detail.projectId,
    createdAt: detail.createdAt,
    status: detail.status,
    summary: detail.summary,
    createdBy: detail.createdBy,
    versionLabel: detail.versionLabel,
  };
}

function formatEstimateLockMessage(detail: EstimateDetail | null): string | null {
  const editability = detail?.editability;
  if (!editability?.isLocked) return null;
  const quoteLabel = editability.lockedByQuoteRef
    ? `${editability.lockedByQuoteRef}${editability.lockedByQuoteVersionNumber ? ` V${editability.lockedByQuoteVersionNumber}` : ''}`
    : editability.lockedByQuoteVersionNumber
      ? `quote version V${editability.lockedByQuoteVersionNumber}`
      : 'a related quote';
  const lockedDate = formatDateLong(editability.lockedAt);
  return lockedDate ? `Locked after ${quoteLabel} was sent on ${lockedDate}.` : `Locked after ${quoteLabel} was sent.`;
}

function formatDraftQuoteEditWarning(detail: EstimateDetail | null): string | null {
  const editability = detail?.editability;
  if (!editability || editability.isLocked || !editability.hasDraftQuotes) return null;
  if (editability.draftQuoteCount === 1) {
    return 'This estimate has 1 draft quote. Editing it will not update that draft automatically.';
  }
  return `This estimate has ${editability.draftQuoteCount} draft quotes. Editing it will not update those drafts automatically.`;
}

type ModeKey = 'general' | 'focus';

export default function EstimatesTab({ projectId, mode }: { projectId: string; mode: ModeKey }) {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const isFocus = mode === 'focus';

  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);

  const estimatesKey = useMemo(() => qk.estimates.metaByProject(hostKey, projectId), [hostKey, projectId]);
  const cachedEstimates = queryClient.getQueryData<EstimateMeta[]>(estimatesKey) ?? [];

  const [selectedId, setSelectedId] = useState(() => cachedEstimates[0]?.id ?? '');
  const [actionBusy, setActionBusy] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSavedAt, setNotesSavedAt] = useState<string | null>(null);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [focusCategory, setFocusCategory] = useState('');
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [requestDesignOpen, setRequestDesignOpen] = useState(false);
  const [drawingView, setDrawingView] = useState<ModuleViewsTab>('plan');
  const [drawingModuleIndex, setDrawingModuleIndex] = useState(0);

  const urlEstimateId = useMemo(() => {
    const raw = searchParams?.get('estimateId') ?? '';
    return raw.trim();
  }, [searchParams]);

  const estimatesQuery = useQuery(estimateMetasByProjectQueryOptions(hostKey, projectId));
  const quotesQuery = useQuery(quoteVersionsByProjectQueryOptions(hostKey, projectId));

  const estimates = estimatesQuery.data ?? [];
  const quoteVersions = quotesQuery.data ?? [];
  const quotesLoading = quotesQuery.isPending;
  const quotesError =
    quotesQuery.error instanceof Error ? quotesQuery.error.message : quotesQuery.error ? String(quotesQuery.error) : null;

  const selectedEstimateDetailQuery = useQuery({
    ...estimateDetailQueryOptions(hostKey, selectedId),
    enabled: Boolean(selectedId),
  });

  const detailLoading = Boolean(selectedId) && selectedEstimateDetailQuery.isPending;
  const selectedDetail = selectedEstimateDetailQuery.data ?? null;

  const updateParams = useCallback(
    (next: { tab?: string; quoteId?: string | null }) => {
      const qs = new URLSearchParams(searchParams.toString());
      if (next.tab) qs.set('tab', next.tab);
      if (next.quoteId === null) qs.delete('quoteId');
      else if (next.quoteId) qs.set('quoteId', next.quoteId);
      router.replace(`?${qs.toString()}`);
    },
    [router, searchParams],
  );

  useEffect(() => {
    if (!estimates.length) {
      setSelectedId('');
      return;
    }
    setSelectedId((prev) => {
      const preferred = urlEstimateId && estimates.some((e) => e.id === urlEstimateId) ? urlEstimateId : '';
      if (preferred) return preferred;
      if (prev && estimates.some((e) => e.id === prev)) return prev;
      return estimates[0]?.id ?? '';
    });
  }, [estimates, urlEstimateId]);

  const selectedMeta = useMemo(
    () => (selectedId ? estimates.find((e) => e.id === selectedId) ?? null : null),
    [estimates, selectedId],
  );

  const upsertEstimate = useCallback(
    (detail: EstimateDetail, opts?: { prepend?: boolean }) => {
      queryClient.setQueryData(qk.estimates.detail(hostKey, detail.id), detail);
      queryClient.setQueryData<EstimateMeta[]>(qk.estimates.metaByProject(hostKey, projectId), (prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const nextMeta = detailToMeta(detail);
        const idx = list.findIndex((e) => e.id === detail.id);
        if (idx >= 0) {
          const next = list.slice();
          next[idx] = nextMeta;
          return next;
        }
        return opts?.prepend ? [nextMeta, ...list] : [...list, nextMeta];
      });
    },
    [hostKey, projectId, queryClient],
  );

  useEffect(() => {
    if (!selectedDetail) return;
    setNotesDraft(selectedDetail.internalNotes ?? '');
    setNotesDirty(false);
    setNotesSavedAt(null);
    setWarningsOpen(isFocus);
  }, [isFocus, selectedDetail?.id]);

  useEffect(() => {
    if (isFocus) setWarningsOpen(true);
  }, [isFocus]);

  const summary = selectedDetail?.summary ?? selectedMeta?.summary;
  const breakdown = useMemo(() => buildBreakdown(selectedDetail?.calculatorSnapshot ?? null), [selectedDetail?.id]);
  const breakdownTotals = useMemo(() => buildBreakdownTotals(selectedDetail?.calculatorSnapshot ?? null), [selectedDetail?.id]);
  const focusGroups = useMemo(() => buildFocusGroups(breakdown), [breakdown]);
  const jobPackUrl = selectedMeta
    ? `/staff/projects/${encodeURIComponent(projectId)}/estimate/${encodeURIComponent(selectedMeta.id)}`
    : '';
  const breakdownCount = isFocus ? focusGroups.length : breakdownTotals.length;
  const pergolaSpecs = useMemo(() => getPergolaSpecs(selectedDetail?.calculatorSnapshot ?? null), [selectedDetail?.id]);
  const moduleLines = useMemo(() => {
    const specs = getModuleSpecs(selectedDetail?.calculatorSnapshot ?? null);
    return specs.map((spec, idx) => formatModuleLine(spec, idx));
  }, [selectedDetail?.id]);
  const drawingModules = useMemo(
    () => buildEstimateDrawingModules(selectedDetail?.calculatorSnapshot ?? null),
    [selectedDetail?.id],
  );
  const salesPerson = selectedMeta?.createdBy ?? null;
  const activeDrawingModule = drawingModules[drawingModuleIndex] ?? null;
  const drawingStatus: ModuleViewsStatus =
    activeDrawingModule && (activeDrawingModule.planModel || activeDrawingModule.sectionModel) ? 'ready' : 'empty';
  const drawingModuleLabel = moduleLines[drawingModuleIndex] ?? activeDrawingModule?.label ?? 'Module';
  const estimateLockMessage = useMemo(() => formatEstimateLockMessage(selectedDetail), [selectedDetail]);
  const draftQuoteEditWarning = useMemo(() => formatDraftQuoteEditWarning(selectedDetail), [selectedDetail]);
  const isEstimateLocked = Boolean(selectedDetail?.editability?.isLocked);

  useEffect(() => {
    setDrawingModuleIndex(0);
  }, [selectedDetail?.id]);

  useEffect(() => {
    if (!drawingModules.length) {
      setDrawingModuleIndex(0);
      return;
    }
    if (drawingModuleIndex >= drawingModules.length) {
      setDrawingModuleIndex(0);
    }
  }, [drawingModuleIndex, drawingModules]);

  useEffect(() => {
    if (!focusGroups.length) {
      setFocusCategory('');
      return;
    }
    if (!focusCategory || !focusGroups.some((group) => group.key === focusCategory)) {
      setFocusCategory(focusGroups[0].key);
    }
  }, [focusCategory, focusGroups]);

  const activeFocusGroup = focusGroups.find((group) => group.key === focusCategory) ?? focusGroups[0] ?? null;
  const activeFocusSubtotal = useMemo(() => {
    if (!activeFocusGroup) return null;
    if (typeof activeFocusGroup.total === 'number' && Number.isFinite(activeFocusGroup.total)) return activeFocusGroup.total;
    return activeFocusGroup.rows.reduce((sum, row) => sum + (typeof row.cost === 'number' ? row.cost : 0), 0);
  }, [activeFocusGroup]);

  const totals = useMemo(() => {
    const snapshot: any = selectedDetail?.calculatorSnapshot ?? null;
    if (!snapshot) return { totalEx: null, totalInc: null };
    const outputs = snapshot.outputs ?? null;
    return {
      totalEx: readNumber(outputs, ['totals', 'cost_ex_gst']) ?? readNumber(snapshot, ['total_true_cost_ex_gst']),
      totalInc: readNumber(outputs, ['totals', 'cost_inc_gst']) ?? readNumber(snapshot, ['total_true_cost_inc_gst']),
    };
  }, [selectedDetail?.id]);

  const gstAmount = useMemo(() => {
    if (totals.totalInc !== null && totals.totalEx !== null) {
      return totals.totalInc - totals.totalEx;
    }
    if (typeof summary?.total === 'number' && typeof summary?.cost === 'number') {
      return summary.total - summary.cost;
    }
    return null;
  }, [summary?.cost, summary?.total, totals.totalEx, totals.totalInc]);

  const gstPercent = useMemo(() => {
    const base = totals.totalInc ?? summary?.total ?? null;
    if (base === null || gstAmount === null) return null;
    if (base === 0) return 0;
    return (gstAmount / base) * 100;
  }, [gstAmount, summary?.total, totals.totalInc]);

  const totalPrimary = useMemo(() => {
    if (totals.totalInc !== null) {
      return { label: 'Total (inc GST)', value: totals.totalInc, secondaryLabel: 'Ex GST', secondaryValue: totals.totalEx };
    }
    if (totals.totalEx !== null) {
      return { label: 'Total (ex GST)', value: totals.totalEx, secondaryLabel: null, secondaryValue: null };
    }
    if (summary?.total !== null && summary?.total !== undefined) {
      return { label: 'Total', value: summary.total, secondaryLabel: null, secondaryValue: null };
    }
    return { label: 'Total', value: null, secondaryLabel: null, secondaryValue: null };
  }, [summary?.total, totals.totalEx, totals.totalInc]);

  const marginValue = summary?.marginValue ?? null;
  const marginPct = summary?.marginPct ?? null;
  const marginLooksLikeGst = useMemo(() => {
    if (gstAmount === null) return false;
    if (typeof marginValue === 'number' && Math.abs(marginValue - gstAmount) < 0.02) return true;
    if (typeof marginPct === 'number' && typeof gstPercent === 'number' && Math.abs(marginPct - gstPercent) < 0.3) return true;
    return false;
  }, [gstAmount, gstPercent, marginPct, marginValue]);

  const showMargin = (typeof marginValue === 'number' || typeof marginPct === 'number') && !marginLooksLikeGst;
  const showGst = isFocus && gstAmount !== null;

  const costValue = summary?.cost ?? null;
  const showCost =
    isFocus &&
    typeof costValue === 'number' &&
    (totalPrimary.value === null || totalPrimary.label.includes('inc') || Math.abs(costValue - (totalPrimary.value ?? 0)) > 0.02);

  const warnings = useMemo(() => {
    const snapshot: any = selectedDetail?.calculatorSnapshot ?? null;
    if (!snapshot) return [] as string[];
    const outputs = snapshot.outputs ?? {};
    return normalizeNotes(outputs.warnings ?? outputs?.totals?.warnings ?? outputs?.totals?.notes_and_warnings);
  }, [selectedDetail?.id]);

  const assumptions = useMemo(() => {
    const snapshot: any = selectedDetail?.calculatorSnapshot ?? null;
    if (!snapshot) return [] as string[];
    return normalizeNotes(snapshot.assumptions);
  }, [selectedDetail?.id]);

  const exclusions = useMemo(() => {
    const snapshot: any = selectedDetail?.calculatorSnapshot ?? null;
    if (!snapshot) return [] as string[];
    return normalizeNotes(snapshot.exclusions);
  }, [selectedDetail?.id]);

  const warningItems = useMemo(
    () => [
      ...warnings.map((text) => ({ type: 'Warning', text })),
      ...assumptions.map((text) => ({ type: 'Assumption', text })),
      ...exclusions.map((text) => ({ type: 'Exclusion', text })),
    ],
    [assumptions, exclusions, warnings],
  );

  const createdMeta = selectedMeta
    ? [formatDateShort(selectedMeta.createdAt), formatTime(selectedMeta.createdAt), selectedMeta.createdBy]
        .filter(Boolean)
        .join(' · ')
    : '';

  const relatedQuotes = useMemo(() => {
    if (!selectedMeta) return [];
    return quoteVersions.filter((quote) => quote.sourceEstimateVersionId === selectedMeta.id);
  }, [quoteVersions, selectedMeta]);

  const relatedQuotesSorted = useMemo(() => {
    return [...relatedQuotes].sort((a, b) => {
      if (a.versionNumber !== b.versionNumber) return b.versionNumber - a.versionNumber;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [relatedQuotes]);

  const relatedQuotesPreview = relatedQuotesSorted.slice(0, 3);

  const calculatorHref = `/staff/calculator?projectId=${encodeURIComponent(projectId)}`;
  const handleCreateFromTabs = useCallback(() => {
    router.push(calculatorHref);
  }, [calculatorHref, router]);
  const handleEditEstimate = useCallback(() => {
    if (!selectedDetail || selectedDetail.editability.isLocked) return;
    router.push(
      `/staff/calculator?projectId=${encodeURIComponent(projectId)}&editEstimateId=${encodeURIComponent(selectedDetail.id)}`,
    );
  }, [projectId, router, selectedDetail]);

  const handleDuplicate = async () => {
    if (!selectedId || actionBusy) return;
    setActionBusy(true);
    try {
      const res = await apiJson<{ estimate: EstimateDetail }>(`/api/estimates/${encodeURIComponent(selectedId)}/duplicate`, {
        method: 'POST',
      });
      if (!res.estimate) throw new Error('Estimate not duplicated');
      upsertEstimate(res.estimate, { prepend: true });
      setSelectedId(res.estimate.id);
      toast.success('Estimate duplicated.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to duplicate estimate';
      toast.error(msg);
    } finally {
      setActionBusy(false);
    }
  };

  const handleCreateQuote = async () => {
    if (!selectedMeta || quoteBusy) return;
    setQuoteBusy(true);
    try {
      const created = await createQuoteFromEstimate(projectId, selectedMeta.id);
      queryClient.setQueryData(qk.quotes.detail(hostKey, created.id), created);
      await invalidateProjectReadCaches(queryClient, hostKey, projectId, {
        includeQuotes: true,
        includeEstimates: true,
      });
      updateParams({ tab: 'quotes', quoteId: created.id });
      toast.success('Draft quote created.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create quote';
      toast.error(msg);
    } finally {
      setQuoteBusy(false);
    }
  };

  const handleViewAllQuotes = () => {
    updateParams({ tab: 'quotes', quoteId: null });
  };

  const handleOpenQuote = (quoteId: string) => {
    updateParams({ tab: 'quotes', quoteId });
  };

  const handleSaveNotes = async () => {
    if (!selectedId || actionBusy) return;
    setActionBusy(true);
    try {
      const res = await apiJson<{ estimate: EstimateDetail }>(`/api/estimates/${encodeURIComponent(selectedId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ internal_notes: notesDraft }),
        },
      );
      if (!res.estimate) throw new Error('Notes not saved');
      upsertEstimate(res.estimate);
      setNotesDirty(false);
      setNotesSavedAt(new Date().toISOString());
      toast.success('Notes saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save notes';
      toast.error(msg);
    } finally {
      setActionBusy(false);
    }
  };

  const listError =
    estimatesQuery.error instanceof Error
      ? estimatesQuery.error.message
      : estimatesQuery.error
        ? String(estimatesQuery.error)
        : null;

  if (estimatesQuery.isPending) {
    return <p className={legacy.note}>Loading estimates…</p>;
  }

  if (listError) {
    return <p className={legacy.note}>{listError}</p>;
  }

  if (!estimates.length) {
    return (
      <div className={styles.emptyState}>
        <h3 className={styles.emptyTitle}>No estimates yet</h3>
        <p className={legacy.note}>Run calculator first if no data is available.</p>
        <Link className={legacy.button} href={calculatorHref}>
          Create estimate
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {isFocus ? (
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>Estimates</h3>
            <p className={styles.subtitle}>Versions and estimate detail snapshots.</p>
          </div>
          <div className={legacy.actions}>
            <Link className={legacy.button} href={calculatorHref}>
              Create estimate
            </Link>
            <button
              type="button"
              className={legacy.buttonSecondary}
              onClick={handleDuplicate}
              disabled={!selectedId || actionBusy}
            >
              Duplicate
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.generalTopBar}>
          <EstimateVersionTabs
            estimates={estimates.map((estimate) => ({
              id: estimate.id,
              label: estimate.versionLabel,
              status: estimate.status,
            }))}
            activeEstimateId={selectedId}
            onSelect={setSelectedId}
            onCreateEstimate={handleCreateFromTabs}
          />
        </div>
      )}

      <div className={`${styles.mainGrid} ${isFocus ? styles.mainGridFocus : styles.mainGridGeneral}`}>
        {isFocus ? (
          <div className={styles.versionsPanel}>
            <div className={styles.versionsList}>
              {estimates.map((estimate) => {
                const isActive = estimate.id === selectedId;
                return (
                  <button
                    type="button"
                    key={estimate.id}
                    className={`${styles.versionRow} ${isActive ? styles.versionRowActive : ''}`}
                    onClick={() => setSelectedId(estimate.id)}
                  >
                    <div className={styles.versionRowTop}>
                      <span className={styles.versionLabel}>{estimate.versionLabel}</span>
                      <span className={`${legacy.statusPill} ${statusClass(estimate.status)}`}>
                        {formatStatusLabel(estimate.status)}
                      </span>
                    </div>
                    <div className={styles.versionRowBottom}>
                      <div className={styles.versionMeta}>{renderValue(formatDateShort(estimate.createdAt))}</div>
                      <div className={styles.versionTotal}>{renderValue(formatMoney(summaryTotal(estimate.summary)))}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className={styles.detailPanel}>
          {!selectedMeta ? <p className={legacy.note}>Select an estimate to view details.</p> : null}
          {selectedMeta && detailLoading ? <p className={legacy.note}>Loading estimate details…</p> : null}

          {selectedMeta && !detailLoading ? (
            <div className={styles.detailStack}>
              <section className={styles.card}>
                <div className={styles.summaryHeader}>
                  <div>
                    <div className={styles.summaryHeaderTitle}>
                      <span className={styles.summaryHeaderLabel}>Estimate {selectedMeta.versionLabel}</span>
                      <span className={`${legacy.statusPill} ${statusClass(selectedMeta.status)}`}>
                        {formatStatusLabel(selectedMeta.status)}
                      </span>
                    </div>
                    {createdMeta ? <div className={styles.summaryHeaderMeta}>Created {createdMeta}</div> : null}
                  </div>
                  <div className={styles.summaryHeaderActions}>
                    {!isEstimateLocked ? (
                      <button type="button" className={legacy.buttonSecondary} onClick={handleEditEstimate} disabled={!selectedDetail}>
                        Edit estimate
                      </button>
                    ) : null}
                    {jobPackUrl ? (
                      <a className={legacy.buttonSecondary} href={jobPackUrl} target="_blank" rel="noreferrer">
                        Open Job Pack <span className={styles.externalIcon} aria-hidden="true">↗</span>
                      </a>
                    ) : null}
                  </div>
                </div>
                {estimateLockMessage ? <div className={styles.lockNotice}>{estimateLockMessage}</div> : null}
                {draftQuoteEditWarning ? <div className={styles.infoNotice}>{draftQuoteEditWarning}</div> : null}
                {isFocus ? (
                  <div className={styles.summaryPrimary}>
                    <div className={styles.summaryTotalBlock}>
                      <div className={styles.summaryLabel}>{totalPrimary.label}</div>
                      <div className={styles.summaryPrimaryValue}>{renderValue(formatMoney(totalPrimary.value))}</div>
                      {totalPrimary.secondaryLabel ? (
                        <div className={styles.summarySubValue}>
                          {totalPrimary.secondaryLabel} {renderValue(formatMoney(totalPrimary.secondaryValue ?? null))}
                        </div>
                      ) : null}
                    </div>
                    {(pergolaSpecs || salesPerson) ? (
                      <div className={styles.summaryMeta}>
                        {pergolaSpecs ? (
                          <div className={styles.summaryMetaRow}>
                            <span className={styles.summaryMetaLabel}>Pergola</span>
                            <span className={styles.summaryMetaValue}>{pergolaSpecs}</span>
                          </div>
                        ) : null}
                        {salesPerson ? (
                          <div className={styles.summaryMetaRow}>
                            <span className={styles.summaryMetaLabel}>Sales</span>
                            <span className={`${styles.summaryMetaValue} ${styles.summaryMetaValueTruncate}`} title={salesPerson}>
                              {salesPerson}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {showGst ? (
                      <div className={styles.summaryStat}>
                        <div className={styles.summaryLabel}>GST (incl)</div>
                        <div className={styles.summaryValue}>{renderValue(formatMoney(gstAmount))}</div>
                        {gstPercent !== null ? (
                          <div className={styles.summarySubValue}>{renderValue(formatPercent(gstPercent))} of total</div>
                        ) : null}
                      </div>
                    ) : null}
                    {showMargin ? (
                      <div className={styles.summaryStat}>
                        <div className={styles.summaryLabel}>Margin</div>
                        <div className={styles.summaryValue}>{renderValue(formatMargin(summary))}</div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className={`${styles.summaryPrimary} ${styles.summaryPrimaryStacked}`}>
                    <div className={styles.summaryTopGrid}>
                      <div className={styles.summaryInfoColumn}>
                        <div className={styles.summarySpecBox}>
                          <div className={styles.summaryLabel}>Pergola</div>
                          <div className={styles.summaryModuleList}>
                            {moduleLines.length ? (
                              moduleLines.map((line, idx) => (
                                <div key={`${line}-${idx}`} className={styles.summaryModuleLine}>
                                  {line}
                                </div>
                              ))
                            ) : (
                              <div className={`${styles.summaryModuleLine} ${styles.mutedValue}`}>M1 - Details not set</div>
                            )}
                          </div>
                          {salesPerson ? (
                            <div className={styles.summarySpecMeta}>
                              <span className={styles.summaryMetaLabel}>Sales</span>
                              <span className={`${styles.summaryMetaValue} ${styles.summaryMetaValueTruncate}`} title={salesPerson}>
                                {salesPerson}
                              </span>
                            </div>
                          ) : null}
                        </div>
                        <div className={`${styles.summaryTotalBlock} ${styles.summaryTotalBoxLeft}`}>
                          <div className={styles.summaryLabel}>{totalPrimary.label}</div>
                          <div className={styles.summaryPrimaryValue}>{renderValue(formatMoney(totalPrimary.value))}</div>
                          {totalPrimary.secondaryLabel ? (
                            <div className={styles.summarySubValue}>
                              {totalPrimary.secondaryLabel} {renderValue(formatMoney(totalPrimary.secondaryValue ?? null))}
                            </div>
                          ) : null}
                        </div>
                        {showMargin ? (
                          <div className={styles.summaryInfoStats}>
                            <div className={`${styles.summaryStat} ${styles.summaryInfoStatCard}`}>
                              <div className={styles.summaryLabel}>Margin</div>
                              <div className={styles.summaryValue}>{renderValue(formatMargin(summary))}</div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className={styles.summaryDrawingColumn}>
                        {drawingModules.length > 1 ? (
                          <div className={styles.segmentedControl}>
                            {drawingModules.map((module, index) => (
                              <button
                                type="button"
                                key={module.id}
                                className={`${styles.segmentedItem} ${index === drawingModuleIndex ? styles.segmentedItemActive : ''}`}
                                onClick={() => setDrawingModuleIndex(index)}
                              >
                                {module.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <div className={styles.summaryDrawingArea}>
                          {activeDrawingModule ? (
                            <ModuleViewsCard
                              moduleLabel={drawingModuleLabel}
                              view={drawingView}
                              onViewChange={setDrawingView}
                              status={drawingStatus}
                              planModel={activeDrawingModule.planModel}
                              sectionModel={activeDrawingModule.sectionModel}
                            />
                          ) : (
                            <div className={styles.drawingEmpty}>No plan or section drawing is available for this estimate.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {isFocus ? (
                  <div className={styles.summarySecondary}>
                    {showCost ? (
                      <div className={styles.summaryStat}>
                        <div className={styles.summaryLabel}>True cost (ex GST)</div>
                        <div className={styles.summaryValue}>{renderValue(formatMoney(costValue))}</div>
                      </div>
                    ) : null}
                    <div className={styles.summaryStat}>
                      <div className={styles.summaryLabel}>Deposit</div>
                      <div className={styles.summaryValue}>{renderValue(formatMoney(summary?.deposit ?? null))}</div>
                    </div>
                    <div className={styles.summaryStat}>
                      <div className={styles.summaryLabel}>Valid until</div>
                      <div className={styles.summaryValue}>{renderValue(formatDateShort(summary?.validityDate ?? null))}</div>
                    </div>
                    <div className={styles.summaryStat}>
                      <div className={styles.summaryLabel}>Lead time</div>
                      <div className={styles.summaryValue}>{renderValue(summary?.leadTime ?? null)}</div>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderGroup}>
                    <h4 className={styles.cardTitle}>Quote</h4>
                    <span className={styles.cardSubTitle}>From this estimate</span>
                  </div>
                </div>
                {quotesLoading ? <p className={legacy.note}>Loading quotes…</p> : null}
                {quotesError ? <p className={legacy.error}>{quotesError}</p> : null}

                {relatedQuotesPreview.length ? (
                  <div className={styles.quoteList}>
                    {relatedQuotesPreview.map((quote) => (
                      <button
                        type="button"
                        key={quote.id}
                        className={styles.quoteRow}
                        onClick={() => handleOpenQuote(quote.id)}
                      >
                        <div className={styles.quoteRowLabel}>{`${quote.quoteRef} • V${quote.versionNumber}`}</div>
                        <span className={`${styles.quoteStatusPill} ${quoteStatusClass(quote.status)}`}>
                          {quoteStatusLabel(quote.status)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={styles.quoteEmpty}>Create a quote from this estimate.</p>
                )}

                <div className={styles.quoteActions}>
                  {relatedQuotesPreview.length ? (
                    <button type="button" className={legacy.buttonSecondary} onClick={handleViewAllQuotes}>
                      View all quotes
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={legacy.buttonSecondary}
                    onClick={() => setRequestDesignOpen(true)}
                    disabled={!selectedMeta}
                  >
                    Request Design
                  </button>
                  <button type="button" className={legacy.button} onClick={handleCreateQuote} disabled={quoteBusy}>
                    {quoteBusy ? 'Creating…' : 'Create quote'}
                  </button>
                </div>
              </section>

              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderGroup}>
                    <h4 className={styles.cardTitle}>Breakdown</h4>
                    <span className={styles.cardSubTitle}>{breakdownCount ? `${breakdownCount} categories` : 'No data'}</span>
                  </div>
                </div>
                {isFocus ? (
                  focusGroups.length && activeFocusGroup ? (
                    <>
                      {focusGroups.length > 1 ? (
                        <div className={styles.segmentedControl}>
                          {focusGroups.map((group) => (
                            <button
                              type="button"
                              key={group.key}
                              className={`${styles.segmentedItem} ${
                                group.key === activeFocusGroup.key ? styles.segmentedItemActive : ''
                              }`}
                              onClick={() => setFocusCategory(group.key)}
                            >
                              {group.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <div className={styles.detailTableWrap}>
                        <table className={`${legacy.table} ${styles.detailTable}`}>
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th className={styles.detailQty}>Qty</th>
                              <th className={styles.detailNumeric}>Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeFocusGroup.rows.map((row, idx) => {
                              const qtyText =
                                typeof row.qty === 'number'
                                  ? `${row.qty}${row.unit ? ` ${row.unit}` : ''}`
                                  : null;
                              return (
                                <tr key={`${activeFocusGroup.key}-${idx}`}>
                                  <td>
                                    <div className={styles.detailItemLabel}>{row.label}</div>
                                    {row.note ? <div className={styles.detailItemNote}>{row.note}</div> : null}
                                  </td>
                                  <td className={styles.detailQty}>{renderValue(qtyText)}</td>
                                  <td className={styles.detailNumeric}>{renderValue(formatMoney(row.cost ?? null))}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={2} className={styles.detailSubtotalLabel}>
                                {activeFocusGroup.label} subtotal
                              </td>
                              <td className={`${styles.detailNumeric} ${styles.detailSubtotalValue}`}>
                                {renderValue(formatMoney(activeFocusSubtotal))}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className={legacy.note}>No breakdown data available for this snapshot.</p>
                  )
                ) : breakdownTotals.length ? (
                  <div className={styles.breakdownTotals}>
                    {breakdownTotals.map((category) => {
                      const rowContent = (
                        <div className={styles.breakdownRowContent}>
                          <div>
                            <div className={styles.breakdownLabel}>{category.title}</div>
                            <div className={styles.breakdownValue}>{renderValue(formatMoney(category.total ?? null))}</div>
                          </div>
                          <span className={styles.breakdownChevron} aria-hidden="true">
                            &gt;
                          </span>
                        </div>
                      );
                      return jobPackUrl ? (
                        <a
                          key={category.id}
                          className={styles.breakdownRowLink}
                          href={jobPackUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {rowContent}
                        </a>
                      ) : (
                        <div key={category.id} className={`${styles.breakdownRowLink} ${styles.breakdownRowDisabled}`}>
                          {rowContent}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={legacy.note}>No breakdown data available for this snapshot.</p>
                )}
              </section>

              {warningItems.length ? (
                <section className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardHeaderGroup}>
                      <h4 className={styles.cardTitle}>Warnings &amp; Assumptions ({warningItems.length})</h4>
                    </div>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => setWarningsOpen((prev) => !prev)}
                    >
                      {warningsOpen ? 'Collapse' : 'View all'}
                    </button>
                  </div>
                  {!warningsOpen ? (
                    <ul className={styles.previewList}>
                      {warningItems.slice(0, 2).map((item, idx) => (
                        <li key={`warning-preview-${idx}`}>
                          <span className={styles.tag}>[{item.type}]</span> {item.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className={styles.noteList}>
                      {warningItems.map((item, idx) => (
                        <li key={`warning-full-${idx}`}>
                          <span className={styles.tag}>[{item.type}]</span> {item.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}

              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <h4 className={styles.cardTitle}>Internal notes</h4>
                </div>
                <textarea
                  className={styles.textarea}
                  value={notesDraft}
                  onChange={(e) => {
                    setNotesDraft(e.target.value);
                    setNotesDirty(true);
                    setNotesSavedAt(null);
                  }}
                  rows={4}
                  placeholder="Add internal notes for this estimate..."
                />
                <div className={styles.cardFooter}>
                  {notesSavedAt ? <span className={styles.savedHint}>{formatSavedLabel(notesSavedAt)}</span> : null}
                  {notesDirty ? (
                    <button
                      type="button"
                      className={legacy.buttonSecondary}
                      onClick={handleSaveNotes}
                      disabled={actionBusy}
                    >
                      Save
                    </button>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>

      {selectedMeta ? (
        <RequestDesignModal
          open={requestDesignOpen}
          onOpenChange={setRequestDesignOpen}
          projectId={projectId}
          estimateId={selectedMeta.id}
          estimateLabel={selectedMeta.versionLabel}
          requestSource="estimates_tab"
          onCreated={async () => {
            await queryClient.invalidateQueries({ queryKey: qk.designPackages.list(hostKey) });
          }}
        />
      ) : null}
    </div>
  );
}
