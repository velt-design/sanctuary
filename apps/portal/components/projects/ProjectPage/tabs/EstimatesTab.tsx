'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ModuleViewsStatus, type ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import { mapEngineLevel } from '@/app/staff/calculator/warnings';
import DrawingWorkbench from '@/components/drawings/workbench/DrawingWorkbench';
import { buildEstimateDrawingModuleInfoRows, buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import {
  applyEstimateDrawingFootprintEdit,
  applyEstimateDrawingFieldEdit,
  buildEstimateDrawingDraftFromSnapshot,
  buildEstimateDrawingSheetMetaOverrides,
  deriveEstimateDrawingEditableFields,
  estimateDrawingDraftMatchesSnapshot,
  estimateDrawingDraftTouchesGeometry,
  mergeEstimateDrawingDraftIntoSnapshot,
  type EstimateDrawingDraft,
  type EstimateDrawingField,
  type EstimateDrawingFootprintEdit,
} from '@/lib/estimates/drawingEdits';
import {
  type EstimateSaveMode,
  buildEstimatePayloadPreservingCurrentPricing,
  buildEstimatePayloadFromSiteCosting,
  buildSiteInputsFromCalculatorInputs,
  deriveSiteResultWarnings,
  hasPricingAffectingCalculatorInputChanges,
} from '@/lib/estimates/costingPayload';
import type { EstimateDetail, EstimateMeta, EstimateSummary } from '@/lib/estimates/types';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import { isCalculatorInputsV2, isLegacyCalculatorInputsV1, type CalculatorModuleInputs, type LegacyCalculatorInputsV1 } from '@/lib/types/calculator';
import type { QuoteStatus, QuoteVersion } from '@/lib/quotes/types';
import { calculateSiteCostV1, getCostingMeta } from '@/lib/costing/costEngine';
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
import { useAliasedEntitySyncState } from '@/lib/localFirst/useEntitySyncState';
import { useLocalWorkingCopy } from '@/lib/localFirst/useLocalWorkingCopy';
import { useResolvedLocalFirstId } from '@/lib/localFirst/useResolvedLocalFirstId';
import {
  PORTAL_LOCAL_FIRST_MUTATIONS,
  buildEstimateEntityKey,
  buildEstimateDrawingDraftEntityKey,
  buildEstimateNotesDraftEntityKey,
  buildEstimatePayloadFromDetail,
  buildNextEstimateVersionLabel,
  buildOptimisticEstimateDetail,
  buildOptimisticQuoteDetail,
  buildQuoteEntityKey,
  createLocalEstimateId,
  createLocalQuoteId,
  isLocalQuoteId,
  type PortalEstimateCreateMutationPayload,
  type PortalEstimateNotesMutationPayload,
  type PortalEstimateUpdateMutationPayload,
  type PortalQuoteCreateMutationPayload,
  upsertQuoteDetailCache,
} from '@/lib/localFirst/portalEntities';
import { enqueueAndProcessLocalFirstMutation } from '@/lib/localFirst/queue';
import { discardLocalFirstEntityQueue, listAliasedLocalFirstEntityKeys, writeLocalFirstWorkingCopy } from '@/lib/localFirst/store';
import {
  createDrawingWorkbenchUiState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';

function formatMoney(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `$${value.toFixed(2)}`;
}

const QUOTE_MARGIN_MULTIPLIER = 1.25;

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

function estimateStateLabel(detail: EstimateDetail | null): string {
  return detail?.editability?.isLocked ? 'Locked' : 'Draft';
}

function estimateStateClass(detail: EstimateDetail | null): string {
  return detail?.editability?.isLocked ? styles.statusLocked : styles.statusDraft;
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

function getActiveDrawingModuleInput(
  snapshot: Record<string, unknown> | null,
  moduleIndex: number,
): CalculatorModuleInputs | LegacyCalculatorInputsV1 | null {
  if (!snapshot) return null;
  const directModules = Array.isArray((snapshot as any).modules) ? (snapshot as any).modules : null;
  if (directModules && directModules.length) {
    return (directModules[moduleIndex] as CalculatorModuleInputs | undefined) ?? null;
  }

  const inputs = (snapshot as any).inputs ?? (snapshot as any).calculator_snapshot?.inputs ?? null;
  if (!inputs || typeof inputs !== 'object') return null;

  if (isCalculatorInputsV2(inputs)) {
    return inputs.modules[moduleIndex] ?? null;
  }

  if (isLegacyCalculatorInputsV1(inputs)) {
    return moduleIndex === 0 ? inputs : null;
  }

  return null;
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
    isActiveDraft: detail.isActiveDraft,
    hasSentQuote: detail.hasSentQuote,
    jobPackEligible: detail.jobPackEligible,
    jobPackGeneratedAt: detail.jobPackGeneratedAt,
    jobPackQuoteVersionId: detail.jobPackQuoteVersionId,
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
  return `Locked after ${quoteLabel} was sent.`;
}

export default function EstimatesTab({
  projectId,
  projectSnapshot,
}: {
  projectId: string;
  projectSnapshot: ProjectPageSnapshot;
}) {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);

  const estimatesKey = useMemo(() => qk.estimates.metaByProject(hostKey, projectId), [hostKey, projectId]);
  const cachedEstimates = queryClient.getQueryData<EstimateMeta[]>(estimatesKey) ?? [];

  const [selectedId, setSelectedId] = useState(() => cachedEstimates[0]?.id ?? '');
  const [actionBusy, setActionBusy] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [focusCategory, setFocusCategory] = useState('');
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [requestDesignOpen, setRequestDesignOpen] = useState(false);
  const [drawingWorkbenchUi, setDrawingWorkbenchUi] = useState(() => createDrawingWorkbenchUiState());
  const [drawingSaveMode, setDrawingSaveMode] = useState<EstimateSaveMode | null>(null);
  const resolvedSelectedId = useResolvedLocalFirstId(selectedId);

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
      const activeDraft = estimates.find((e) => e.isActiveDraft)?.id ?? '';
      const preferred = urlEstimateId && estimates.some((e) => e.id === urlEstimateId) ? urlEstimateId : '';
      if (preferred) return preferred;
      if (activeDraft) return activeDraft;
      if (prev && estimates.some((e) => e.id === prev)) return prev;
      return estimates[0]?.id ?? '';
    });
  }, [estimates, urlEstimateId]);

  useEffect(() => {
    if (!resolvedSelectedId || resolvedSelectedId === selectedId) return;
    setSelectedId(resolvedSelectedId);
  }, [resolvedSelectedId, selectedId]);

  const selectedMeta = useMemo(
    () => (selectedId ? estimates.find((e) => e.id === selectedId) ?? null : null),
    [estimates, selectedId],
  );
  const activeDraftMeta = useMemo(() => estimates.find((estimate) => estimate.isActiveDraft) ?? null, [estimates]);
  const notesDraftEntityKey = useMemo(
    () => buildEstimateNotesDraftEntityKey(selectedId || '__estimate-none__'),
    [selectedId],
  );
  const drawingDraftEntityKey = useMemo(
    () => buildEstimateDrawingDraftEntityKey(selectedId || '__estimate-none__'),
    [selectedId],
  );
  const notesWorkingCopy = useLocalWorkingCopy<string>(notesDraftEntityKey, selectedDetail?.internalNotes ?? '');
  const drawingWorkingCopy = useLocalWorkingCopy<EstimateDrawingDraft | null>(
    drawingDraftEntityKey,
    buildEstimateDrawingDraftFromSnapshot(selectedDetail?.calculatorSnapshot ?? null),
  );
  const notesSaveTimerRef = useRef<number | null>(null);
  const notesDraftRef = useRef(notesDraft);
  const selectedEstimateSyncState = useAliasedEntitySyncState(
    selectedMeta?.id,
    buildEstimateEntityKey,
    'estimate:detail:__estimate-none__',
  );
  const selectedEstimateSyncPending = Boolean(selectedMeta && selectedEstimateSyncState.pendingCount > 0);
  const currentDrawingDraft = useMemo(
    () => buildEstimateDrawingDraftFromSnapshot(selectedDetail?.calculatorSnapshot ?? null),
    [selectedDetail?.calculatorSnapshot],
  );
  const drawingDraft = drawingWorkingCopy.hasLocalCopy ? drawingWorkingCopy.value : currentDrawingDraft;
  const drawingSaveBusy = drawingSaveMode !== null;
  const drawingDirty = Boolean(selectedDetail) && !estimateDrawingDraftMatchesSnapshot(drawingDraft, selectedDetail?.calculatorSnapshot ?? null);
  const drawingGeometryDirty =
    Boolean(selectedDetail) && estimateDrawingDraftTouchesGeometry(drawingDraft, selectedDetail?.calculatorSnapshot ?? null);
  const drawingSnapshot = useMemo(
    () => mergeEstimateDrawingDraftIntoSnapshot(selectedDetail?.calculatorSnapshot ?? null, drawingDraft),
    [drawingDraft, selectedDetail?.calculatorSnapshot],
  );
  const drawingDetail = useMemo(
    () => (selectedDetail && drawingSnapshot ? { ...selectedDetail, calculatorSnapshot: drawingSnapshot } : selectedDetail),
    [drawingSnapshot, selectedDetail],
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
    notesDraftRef.current = notesDraft;
  }, [notesDraft]);

  useEffect(() => {
    if (!selectedDetail) return;
    if (notesWorkingCopy.hasLocalCopy) {
      setNotesDraft(notesWorkingCopy.value);
    } else {
      setNotesDraft(selectedDetail.internalNotes ?? '');
    }
    setWarningsOpen(false);
  }, [notesWorkingCopy.hasLocalCopy, notesWorkingCopy.value, selectedDetail?.id]);

  useEffect(() => {
    if (!notesWorkingCopy.hasLocalCopy) return;
    if (selectedEstimateSyncPending) return;
    if ((notesWorkingCopy.value ?? '') !== (selectedDetail?.internalNotes ?? '')) return;
    void notesWorkingCopy.clearWorkingCopy();
  }, [notesWorkingCopy, selectedDetail?.internalNotes, selectedEstimateSyncPending]);

  useEffect(() => {
    if (!drawingWorkingCopy.hasLocalCopy) return;
    if (selectedEstimateSyncPending) return;
    if (!estimateDrawingDraftMatchesSnapshot(drawingWorkingCopy.value, selectedDetail?.calculatorSnapshot ?? null)) return;
    void drawingWorkingCopy.clearWorkingCopy();
  }, [drawingWorkingCopy, selectedDetail?.calculatorSnapshot, selectedEstimateSyncPending]);

  useEffect(() => {
    if (!selectedId || !notesWorkingCopy.hasLocalCopy) return;
    if (selectedEstimateSyncState.status !== 'conflict') return;
    if (selectedEstimateSyncState.lastError) {
      toast.error(selectedEstimateSyncState.lastError);
    }
    void Promise.all(
      listAliasedLocalFirstEntityKeys(selectedId, buildEstimateEntityKey).map((entityKey) => discardLocalFirstEntityQueue(entityKey)),
    );
  }, [notesWorkingCopy.hasLocalCopy, selectedEstimateSyncState.lastError, selectedEstimateSyncState.status, selectedId, toast]);

  useEffect(() => {
    if (!selectedId || !drawingWorkingCopy.hasLocalCopy) return;
    if (selectedEstimateSyncState.status !== 'conflict') return;
    toast.error(selectedEstimateSyncState.lastError || 'This design was locked before your drawing edits could sync.');
    void Promise.all(
      listAliasedLocalFirstEntityKeys(selectedId, buildEstimateEntityKey).map((entityKey) => discardLocalFirstEntityQueue(entityKey)),
    );
    void drawingWorkingCopy.clearWorkingCopy();
    void queryClient.invalidateQueries({ queryKey: qk.estimates.detail(hostKey, selectedId) });
  }, [
    drawingWorkingCopy,
    hostKey,
    queryClient,
    selectedEstimateSyncState.lastError,
    selectedEstimateSyncState.status,
    selectedId,
    toast,
  ]);

  useEffect(() => {
    return () => {
      if (notesSaveTimerRef.current !== null) {
        window.clearTimeout(notesSaveTimerRef.current);
      }
    };
  }, []);

  const summary = selectedDetail?.summary ?? selectedMeta?.summary;
  const breakdown = useMemo(() => buildBreakdown(selectedDetail?.calculatorSnapshot ?? null), [selectedDetail?.calculatorSnapshot]);
  const breakdownTotals = useMemo(() => buildBreakdownTotals(selectedDetail?.calculatorSnapshot ?? null), [selectedDetail?.calculatorSnapshot]);
  const focusGroups = useMemo(() => buildFocusGroups(breakdown), [breakdown]);
  const jobPackUrlForSheet = useCallback(
    (sheet: 'materials' | 'labour' | 'overheads') =>
      selectedMeta && (selectedDetail?.jobPackGeneratedAt ?? selectedMeta.jobPackGeneratedAt)
        ? `/staff/projects/${encodeURIComponent(projectId)}?tab=job-packs&estimateId=${encodeURIComponent(
            selectedMeta.id,
          )}&sheet=${encodeURIComponent(sheet)}`
        : '',
    [projectId, selectedDetail?.jobPackGeneratedAt, selectedMeta],
  );
  const jobPackUrl = jobPackUrlForSheet('materials');
  const breakdownCount = breakdownTotals.length;
  const pergolaSpecs = useMemo(() => getPergolaSpecs(selectedDetail?.calculatorSnapshot ?? null), [selectedDetail?.calculatorSnapshot]);
  const moduleLines = useMemo(() => {
    const specs = getModuleSpecs(drawingDetail?.calculatorSnapshot ?? null);
    return specs.map((spec, idx) => formatModuleLine(spec, idx));
  }, [drawingDetail?.calculatorSnapshot]);
  const drawingWorkbenchStore = useMemo(
    () =>
      buildDrawingWorkbenchStore({
        snapshot: drawingDetail?.calculatorSnapshot ?? null,
        ui: drawingWorkbenchUi,
        ignoreModuleResults: drawingGeometryDirty,
        moduleLabels: moduleLines,
      }),
    [drawingDetail?.calculatorSnapshot, drawingGeometryDirty, drawingWorkbenchUi, moduleLines],
  );
  const salesPerson = selectedMeta?.createdBy ?? null;
  const drawingView: ModuleViewsTab = drawingWorkbenchStore.ui.activeView;
  const drawingModuleIndex = drawingWorkbenchStore.derived.activeModuleIndex;
  const drawingViewportMode = drawingWorkbenchStore.ui.viewportMode;
  const drawingModules = drawingWorkbenchStore.persisted.modules;
  const activeDrawingModule = drawingWorkbenchStore.derived.activeModule;
  const drawingStatus: ModuleViewsStatus = drawingWorkbenchStore.derived.status;
  const drawingModuleLabel = drawingWorkbenchStore.derived.activeModuleLabel;
  const drawingMetaOverrides = useMemo(
    () =>
      buildEstimateDrawingSheetMetaOverrides({
        moduleLabel: drawingModuleLabel,
        moduleIndex: drawingModuleIndex,
        draft: drawingDraft,
      }),
    [drawingDraft, drawingModuleIndex, drawingModuleLabel],
  );
  const drawingSheetMeta = useMemo(
    () =>
      buildEstimateDrawingSheetMeta({
        moduleLabel: drawingModuleLabel,
        moduleTitleOverride: drawingMetaOverrides.moduleTitle,
        noteOverride: drawingMetaOverrides.note,
        moduleInfoRows: buildEstimateDrawingModuleInfoRows(
          getActiveDrawingModuleInput(drawingDetail?.calculatorSnapshot ?? null, drawingModuleIndex),
        ),
        view: drawingView,
        versionLabel: selectedMeta?.versionLabel ?? selectedDetail?.versionLabel ?? null,
        estimateDate: selectedDetail?.createdAt ?? selectedMeta?.createdAt ?? null,
        projectName: projectSnapshot.project.name,
        siteAddress: projectSnapshot.project.siteAddress ?? null,
        clientName: projectSnapshot.project.contactName ?? null,
      }),
    [
      drawingModuleLabel,
      drawingMetaOverrides.moduleTitle,
      drawingMetaOverrides.note,
      drawingDetail?.calculatorSnapshot,
      drawingView,
      drawingModuleIndex,
      projectSnapshot.project.contactName,
      projectSnapshot.project.name,
      projectSnapshot.project.siteAddress,
      selectedDetail?.createdAt,
      selectedDetail?.versionLabel,
      selectedMeta?.createdAt,
      selectedMeta?.versionLabel,
    ],
  );
  const estimateLockMessage = useMemo(() => formatEstimateLockMessage(selectedDetail), [selectedDetail]);
  const isEstimateLocked = Boolean(selectedDetail?.editability?.isLocked);
  const drawingEditableFields = useMemo(
    () =>
      !selectedDetail || isEstimateLocked
        ? []
        : deriveEstimateDrawingEditableFields({
            draft: drawingDraft,
            moduleIndex: drawingModuleIndex,
            moduleLabel: drawingModuleLabel,
            view: drawingView,
            planModel: activeDrawingModule?.planModel,
            sectionModel: activeDrawingModule?.sectionModel,
          }),
    [
      activeDrawingModule?.planModel,
      activeDrawingModule?.sectionModel,
      drawingDraft,
      drawingModuleIndex,
      drawingModuleLabel,
      drawingView,
      isEstimateLocked,
      selectedDetail,
    ],
  );

  useEffect(() => {
    setDrawingWorkbenchUi((current) => ({ ...current, activeModuleIndex: 0 }));
  }, [selectedDetail?.calculatorSnapshot]);

  useEffect(() => {
    if (drawingWorkbenchStore.ui.activeModuleIndex === drawingWorkbenchUi.activeModuleIndex) return;
    setDrawingWorkbenchUi((current) => ({
      ...current,
      activeModuleIndex: drawingWorkbenchStore.ui.activeModuleIndex,
    }));
  }, [drawingWorkbenchStore.ui.activeModuleIndex, drawingWorkbenchUi.activeModuleIndex]);

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
  }, [selectedDetail?.calculatorSnapshot]);

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

  const quoteCostToUs = useMemo(() => {
    if (totals.totalInc !== null) return totals.totalInc;
    if (typeof summary?.total === 'number' && Number.isFinite(summary.total)) return summary.total;
    if (totals.totalEx !== null) return totals.totalEx;
    return null;
  }, [summary?.total, totals.totalEx, totals.totalInc]);
  const quoteCostIncludesGst = totals.totalInc !== null || (typeof summary?.total === 'number' && Number.isFinite(summary.total));
  const quoteSellPrice = useMemo(
    () => (typeof quoteCostToUs === 'number' && Number.isFinite(quoteCostToUs) ? quoteCostToUs * QUOTE_MARGIN_MULTIPLIER : null),
    [quoteCostToUs],
  );

  const marginValue = summary?.marginValue ?? null;
  const marginPct = summary?.marginPct ?? null;
  const marginLooksLikeGst = useMemo(() => {
    if (gstAmount === null) return false;
    if (typeof marginValue === 'number' && Math.abs(marginValue - gstAmount) < 0.02) return true;
    if (typeof marginPct === 'number' && typeof gstPercent === 'number' && Math.abs(marginPct - gstPercent) < 0.3) return true;
    return false;
  }, [gstAmount, gstPercent, marginPct, marginValue]);

  const showMargin = (typeof marginValue === 'number' || typeof marginPct === 'number') && !marginLooksLikeGst;
  const showGst = gstAmount !== null;

  const costValue = summary?.cost ?? null;
  const showCost =
    typeof costValue === 'number' &&
    (totalPrimary.value === null || totalPrimary.label.includes('inc') || Math.abs(costValue - (totalPrimary.value ?? 0)) > 0.02);

  const warnings = useMemo(() => {
    const snapshot: any = selectedDetail?.calculatorSnapshot ?? null;
    if (!snapshot) return [] as string[];
    const outputs = snapshot.outputs ?? {};
    return normalizeNotes(outputs.warnings ?? outputs?.totals?.warnings ?? outputs?.totals?.notes_and_warnings);
  }, [selectedDetail?.calculatorSnapshot]);

  const assumptions = useMemo(() => {
    const snapshot: any = selectedDetail?.calculatorSnapshot ?? null;
    if (!snapshot) return [] as string[];
    return normalizeNotes(snapshot.assumptions);
  }, [selectedDetail?.calculatorSnapshot]);

  const exclusions = useMemo(() => {
    const snapshot: any = selectedDetail?.calculatorSnapshot ?? null;
    if (!snapshot) return [] as string[];
    return normalizeNotes(snapshot.exclusions);
  }, [selectedDetail?.calculatorSnapshot]);

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
  const designEditorHref = activeDraftMeta
    ? `/staff/calculator?projectId=${encodeURIComponent(projectId)}&editEstimateId=${encodeURIComponent(activeDraftMeta.id)}`
    : isEstimateLocked && selectedMeta
      ? `/staff/calculator?projectId=${encodeURIComponent(projectId)}&fromEstimateId=${encodeURIComponent(selectedMeta.id)}`
      : calculatorHref;
  const handleCreateFromTabs = useCallback(() => {
    router.push(designEditorHref);
  }, [designEditorHref, router]);
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
      const sourceEstimate =
        selectedDetail ??
        queryClient.getQueryData<EstimateDetail>(qk.estimates.detail(hostKey, selectedId)) ??
        (await queryClient.fetchQuery(estimateDetailQueryOptions(hostKey, selectedId)));
      const estimatePayload = buildEstimatePayloadFromDetail(sourceEstimate);
      const localEstimateId = createLocalEstimateId();
      const optimisticEstimateBase = buildOptimisticEstimateDetail({
        estimateId: localEstimateId,
        projectId,
        estimatePayload,
        versionLabel: buildNextEstimateVersionLabel(estimates),
        createdBy: sourceEstimate.createdBy ?? null,
      });
      const optimisticEstimate: EstimateDetail = {
        ...optimisticEstimateBase,
        internalNotes: sourceEstimate.internalNotes ?? null,
      };

      upsertEstimate(optimisticEstimate, { prepend: true });
      await writeLocalFirstWorkingCopy({
        entityKey: buildEstimateEntityKey(localEstimateId),
        data: optimisticEstimate,
      });

      const mutationPayload: PortalEstimateCreateMutationPayload = {
        localEstimateId,
        projectId,
        estimatePayload,
      };
      await enqueueAndProcessLocalFirstMutation({
        entityKey: buildEstimateEntityKey(localEstimateId),
        mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.estimateCreate,
        payload: mutationPayload,
      });

      setSelectedId(localEstimateId);
      toast.success('Design revision created locally. Syncing in the background.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create design revision';
      toast.error(msg);
    } finally {
      setActionBusy(false);
    }
  };

  const handleCreateQuote = async () => {
    if (!selectedMeta || quoteBusy) return;
    setQuoteBusy(true);
    try {
      const estimateDetail =
        selectedDetail ??
        queryClient.getQueryData<EstimateDetail>(qk.estimates.detail(hostKey, selectedMeta.id)) ??
        (await queryClient.fetchQuery(estimateDetailQueryOptions(hostKey, selectedMeta.id)));
      const localQuoteId = createLocalQuoteId();
      const optimisticDetail = buildOptimisticQuoteDetail({
        quoteVersionId: localQuoteId,
        projectId,
        estimateDetail,
        existingQuotes: quoteVersions,
      });

      upsertQuoteDetailCache(queryClient, hostKey, projectId, optimisticDetail, { prepend: true });
      await writeLocalFirstWorkingCopy({
        entityKey: buildQuoteEntityKey(localQuoteId),
        data: optimisticDetail,
      });

      const mutationPayload: PortalQuoteCreateMutationPayload = {
        localQuoteId,
        projectId,
        estimateId: selectedMeta.id,
      };
      await enqueueAndProcessLocalFirstMutation({
        entityKey: buildQuoteEntityKey(localQuoteId),
        mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.quoteCreateFromEstimate,
        payload: mutationPayload,
      });

      updateParams({ tab: 'quotes', quoteId: null });
      toast.success('Draft quote created locally. Syncing in the background.');
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
    updateParams({ tab: 'quotes', quoteId: isLocalQuoteId(quoteId) ? null : quoteId });
  };

  const discardDrawingDraft = useCallback(async () => {
    await drawingWorkingCopy.clearWorkingCopy();
  }, [drawingWorkingCopy]);

  const confirmDiscardDrawingDraft = useCallback(
    async (message?: string) => {
      if (!drawingDirty) return true;
      const shouldDiscard = window.confirm(message ?? 'You have unsaved drawing changes. Discard them and continue?');
      if (!shouldDiscard) return false;
      await discardDrawingDraft();
      return true;
    },
    [discardDrawingDraft, drawingDirty],
  );

  const runWithDrawingDraftGuard = useCallback(
    async (action: () => void | Promise<void>, message?: string) => {
      if (drawingSaveBusy) return;
      const allowed = await confirmDiscardDrawingDraft(message);
      if (!allowed) return;
      await action();
    },
    [confirmDiscardDrawingDraft, drawingSaveBusy],
  );

  const persistDrawingDraftLocally = useCallback(
    async (nextDraft: EstimateDrawingDraft) => {
      if (estimateDrawingDraftMatchesSnapshot(nextDraft, selectedDetail?.calculatorSnapshot ?? null)) {
        await drawingWorkingCopy.clearWorkingCopy();
      } else {
        await drawingWorkingCopy.setWorkingCopy(nextDraft);
      }
    },
    [drawingWorkingCopy, selectedDetail?.calculatorSnapshot],
  );

  const commitDrawingField = useCallback(
    async (field: EstimateDrawingField, nextValue: string) => {
      if (!drawingDraft) {
        return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
      }
      const result = applyEstimateDrawingFieldEdit({
        draft: drawingDraft,
        field,
        nextValue,
      });
      if (!result.ok) return result;

      await persistDrawingDraftLocally(result.draft);

      return { ok: true as const };
    },
    [drawingDraft, persistDrawingDraftLocally],
  );

  const commitDrawingFootprintEdit = useCallback(
    async (edit: EstimateDrawingFootprintEdit) => {
      if (!drawingDraft) {
        return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
      }
      const result = applyEstimateDrawingFootprintEdit({
        draft: drawingDraft,
        moduleIndex: drawingModuleIndex,
        edit,
      });
      if (!result.ok) return result;

      await persistDrawingDraftLocally(result.draft);
      return { ok: true as const };
    },
    [drawingDraft, drawingModuleIndex, persistDrawingDraftLocally],
  );

  const saveDrawingDraft = useCallback(async (saveMode: EstimateSaveMode = 'preserve_current') => {
    if (!selectedDetail) return;
    const activeDraft = drawingDraft ?? currentDrawingDraft;
    if (!activeDraft) return;
    if (saveMode === 'preserve_current' && !drawingDirty) return;
    if (selectedDetail.editability.isLocked) {
      toast.error('This design is locked because it has been sent with a quote and can no longer be edited.');
      return;
    }

    if (
      relatedQuotesSorted.length > 0 &&
      !window.confirm(
        'This design already has quote versions. Saving drawing changes will update the design snapshot and may leave existing quote drafts out of date. Continue?',
      )
    ) {
      return;
    }

    setDrawingSaveMode(saveMode);
    try {
      const saveSourceDetail: EstimateDetail =
        drawingSnapshot && drawingSnapshot !== selectedDetail.calculatorSnapshot
          ? { ...selectedDetail, calculatorSnapshot: drawingSnapshot }
          : selectedDetail;
      const basePayload = buildEstimatePayloadFromDetail(saveSourceDetail);
      const currentInputs = currentDrawingDraft?.inputs ?? activeDraft.inputs;
      const pricingChanged = hasPricingAffectingCalculatorInputChanges(currentInputs, activeDraft.inputs);
      const estimatePayload =
        saveMode === 'reprice_latest'
          ? await (async () => {
              const siteResult = await calculateSiteCostV1(buildSiteInputsFromCalculatorInputs(activeDraft.inputs));
              const warnings = deriveSiteResultWarnings(siteResult);
              const criticalWarnings = warnings.filter((warning) => mapEngineLevel(warning.level) === 'critical');
              const reviewWarnings = warnings.filter((warning) => mapEngineLevel(warning.level) === 'review');

              if (criticalWarnings.length > 0) {
                toast.error('Resolve critical warnings before repricing this design.');
                return null;
              }

              if (
                reviewWarnings.length > 0 &&
                !window.confirm(
                  `Review warnings were returned:\n\n${reviewWarnings.map((warning) => `- ${warning.message}`).join('\n')}\n\nReprice anyway?`,
                )
              ) {
                return null;
              }

              const meta = await getCostingMeta();
              return buildEstimatePayloadFromSiteCosting({
                basePayload,
                inputs: activeDraft.inputs,
                siteResult,
                configVersions: meta.configVersions as Record<string, unknown>,
                moduleIndex: drawingModuleIndex,
                warnings,
              });
            })()
          : buildEstimatePayloadPreservingCurrentPricing({
              basePayload,
              inputs: activeDraft.inputs,
              pricingChanged,
            });
      if (!estimatePayload) return;

      const optimisticEstimateBase = buildOptimisticEstimateDetail({
        estimateId: selectedDetail.id,
        projectId,
        estimatePayload,
        versionLabel: selectedDetail.versionLabel,
        createdBy: selectedDetail.createdBy ?? null,
        createdAt: selectedDetail.createdAt,
      });
      const optimisticEstimate: EstimateDetail = {
        ...optimisticEstimateBase,
        internalNotes: selectedDetail.internalNotes ?? optimisticEstimateBase.internalNotes,
        editability: selectedDetail.editability ?? optimisticEstimateBase.editability,
        isActiveDraft: selectedDetail.isActiveDraft,
        hasSentQuote: selectedDetail.hasSentQuote,
        jobPackEligible: selectedDetail.jobPackEligible,
        jobPackGeneratedAt: selectedDetail.jobPackGeneratedAt,
        jobPackQuoteVersionId: selectedDetail.jobPackQuoteVersionId,
      };

      upsertEstimate(optimisticEstimate);
      await writeLocalFirstWorkingCopy({
        entityKey: buildEstimateEntityKey(selectedDetail.id),
        data: optimisticEstimate,
      });
      await drawingWorkingCopy.clearWorkingCopy();

      const mutationPayload: PortalEstimateUpdateMutationPayload = {
        estimateId: selectedDetail.id,
        estimatePayload,
      };
      await enqueueAndProcessLocalFirstMutation({
        entityKey: buildEstimateEntityKey(selectedDetail.id),
        mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.estimateUpdate,
        payload: mutationPayload,
      });

      toast.success(
        saveMode === 'reprice_latest'
          ? 'Estimate repriced locally. Syncing in the background.'
          : pricingChanged
            ? 'Drawing changes saved locally. Pricing was preserved. Use Reprice to latest to refresh costs.'
            : 'Drawing changes saved locally. Syncing in the background.',
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : saveMode === 'reprice_latest'
            ? 'Failed to reprice this design'
            : 'Failed to save drawing changes';
      toast.error(msg);
    } finally {
      setDrawingSaveMode(null);
    }
  }, [
    currentDrawingDraft,
    drawingDirty,
    drawingDraft,
    drawingModuleIndex,
    drawingSnapshot,
    drawingWorkingCopy,
    projectId,
    relatedQuotesSorted.length,
    selectedDetail,
    toast,
    upsertEstimate,
  ]);

  const notesDirty = Boolean(selectedDetail) && notesDraft !== (selectedDetail?.internalNotes ?? '');

  const saveNotesDraft = useCallback(async () => {
    if (!selectedId || !selectedDetail) return;
    const nextNotes = notesDraftRef.current;
    if (nextNotes === (selectedDetail.internalNotes ?? '')) {
      if (notesWorkingCopy.hasLocalCopy && !selectedEstimateSyncPending) {
        await notesWorkingCopy.clearWorkingCopy();
      }
      return;
    }

    queryClient.setQueryData<EstimateDetail>(qk.estimates.detail(hostKey, selectedId), {
      ...selectedDetail,
      internalNotes: nextNotes,
    });
    await notesWorkingCopy.setWorkingCopy(nextNotes);

    const mutationPayload: PortalEstimateNotesMutationPayload = {
      estimateId: selectedId,
      projectId,
      internalNotes: nextNotes,
    };
    await enqueueAndProcessLocalFirstMutation({
      entityKey: buildEstimateEntityKey(selectedId),
      mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.estimateNotesUpdate,
      payload: mutationPayload,
    });
  }, [hostKey, notesWorkingCopy, projectId, queryClient, selectedDetail, selectedEstimateSyncPending, selectedId]);

  useEffect(() => {
    if (!selectedId || !selectedDetail || !notesDirty) return;
    if (notesSaveTimerRef.current !== null) {
      window.clearTimeout(notesSaveTimerRef.current);
    }
    notesSaveTimerRef.current = window.setTimeout(() => {
      void saveNotesDraft().catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to save notes';
        toast.error(msg);
      });
    }, 700);

    return () => {
      if (notesSaveTimerRef.current !== null) {
        window.clearTimeout(notesSaveTimerRef.current);
      }
    };
  }, [notesDirty, saveNotesDraft, selectedDetail, selectedId, toast]);

  useEffect(() => {
    if (!drawingDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [drawingDirty]);

  const listError =
    estimatesQuery.error instanceof Error
      ? estimatesQuery.error.message
      : estimatesQuery.error
        ? String(estimatesQuery.error)
        : null;

  if (estimatesQuery.isPending) {
    return <p className={legacy.note}>Loading designs…</p>;
  }

  if (listError) {
    return <p className={legacy.note}>{listError}</p>;
  }

  if (!estimates.length) {
    return (
      <div className={styles.emptyState}>
        <h3 className={styles.emptyTitle}>No designs yet</h3>
        <p className={legacy.note}>Run calculator first if no data is available.</p>
        <Link className={legacy.button} href={calculatorHref}>
          Create design
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.mainGrid} ${styles.mainGridGeneral}`}>

        <div className={styles.detailPanel}>
          {!selectedMeta ? <p className={legacy.note}>Select a design to view details.</p> : null}
          {selectedMeta && detailLoading ? <p className={legacy.note}>Loading design details…</p> : null}

          {selectedMeta && !detailLoading ? (
            <div className={styles.detailStack}>
              <section className={`${styles.card} ${styles.drawingCard}`}>
                <div className={styles.summaryHeader}>
                  <div className={styles.summaryHeaderPrimary}>
                    <div className={styles.summaryHeaderTopRow}>
                      <EstimateVersionTabs
                        estimates={estimates.map((estimate) => ({
                          id: estimate.id,
                          label: estimate.versionLabel,
                          isActiveDraft: estimate.isActiveDraft,
                        }))}
                        activeEstimateId={selectedId}
                        onSelect={(nextEstimateId) => {
                          if (nextEstimateId === selectedId) return;
                          void runWithDrawingDraftGuard(
                            () => setSelectedId(nextEstimateId),
                            'You have unsaved drawing changes. Discard them and switch design versions?',
                          );
                        }}
                        onCreateEstimate={() =>
                          void runWithDrawingDraftGuard(
                            handleCreateFromTabs,
                            'You have unsaved drawing changes. Discard them and open the design editor?',
                          )
                        }
                      />
                      <span className={`${legacy.statusPill} ${estimateStateClass(selectedDetail)}`}>
                        {estimateStateLabel(selectedDetail)}
                      </span>
                    </div>
                    {createdMeta ? <div className={styles.summaryHeaderMeta}>Created {createdMeta}</div> : null}
                    {estimateLockMessage ? <div className={styles.summaryHeaderLockMeta}>{estimateLockMessage}</div> : null}
                  </div>
                  <div className={styles.summaryHeaderActions}>
                    <div className={styles.summaryHeaderControls}>
                      {drawingDirty ? (
                        <>
                          <button
                            type="button"
                            className={`${legacy.buttonSecondary} ${styles.compactAction}`}
                            onClick={() => void discardDrawingDraft()}
                            disabled={drawingSaveBusy}
                          >
                            Discard
                          </button>
                          <button
                            type="button"
                            className={`${legacy.button} ${styles.compactAction}`}
                            onClick={() => void saveDrawingDraft('preserve_current')}
                            disabled={drawingSaveBusy}
                          >
                            {drawingSaveMode === 'preserve_current' ? 'Saving…' : 'Save changes'}
                          </button>
                        </>
                      ) : null}
                    </div>
                    {!isEstimateLocked ? (
                      <>
                        <button
                          type="button"
                          className={`${legacy.buttonSecondary} ${styles.compactAction}`}
                          onClick={() => void saveDrawingDraft('reprice_latest')}
                          disabled={!selectedDetail || drawingSaveBusy}
                        >
                          {drawingSaveMode === 'reprice_latest' ? 'Repricing…' : 'Reprice to latest'}
                        </button>
                        <button
                          type="button"
                          className={`${legacy.buttonSecondary} ${styles.compactAction}`}
                          onClick={() =>
                            void runWithDrawingDraftGuard(
                              handleEditEstimate,
                              'You have unsaved drawing changes. Discard them and open the design editor?',
                            )
                          }
                          disabled={!selectedDetail || drawingSaveBusy}
                        >
                          Edit design
                        </button>
                      </>
                    ) : null}
                    {jobPackUrl ? (
                      <button
                        type="button"
                        className={`${legacy.buttonSecondary} ${styles.compactAction}`}
                        onClick={() =>
                          void runWithDrawingDraftGuard(
                            () => router.push(jobPackUrl),
                            'You have unsaved drawing changes. Discard them and open the job pack?',
                          )
                        }
                        disabled={drawingSaveBusy}
                      >
                        Open Job Pack
                      </button>
                    ) : null}
                  </div>
                </div>
                {selectedEstimateSyncPending ? (
                  <div className={styles.infoNotice}>
                    Design is syncing in the background. You can keep editing, request drafting, and create a quote from the local snapshot now.
                  </div>
                ) : null}
                <div className={styles.focusSummaryLayout}>
                  {activeDrawingModule ? (
                    <DrawingWorkbench
                      moduleLabel={drawingModuleLabel}
                      modules={drawingModules.map((module, index) => ({
                        id: module.id,
                        label: moduleLines[index] ?? module.label,
                      }))}
                      activeModuleIndex={drawingModuleIndex}
                      onActiveModuleIndexChange={(index) =>
                        setDrawingWorkbenchUi((current) => ({
                          ...current,
                          activeModuleIndex: index,
                        }))
                      }
                      view={drawingView}
                      onViewChange={(nextView) =>
                        setDrawingWorkbenchUi((current) => ({
                          ...current,
                          activeView: nextView,
                        }))
                      }
                      viewportMode={drawingViewportMode}
                      onViewportModeChange={(nextMode) =>
                        setDrawingWorkbenchUi((current) => ({
                          ...current,
                          viewportMode: nextMode,
                        }))
                      }
                      status={drawingStatus}
                      planModel={activeDrawingModule.planModel}
                      sectionModel={activeDrawingModule.sectionModel}
                      meta={drawingSheetMeta}
                      editableFields={drawingEditableFields}
                      onCommitField={commitDrawingField}
                      onCommitFootprintEdit={!isEstimateLocked ? commitDrawingFootprintEdit : undefined}
                    />
                  ) : (
                    <div className={styles.drawingEmpty}>No plan or section drawing is available for this design.</div>
                  )}
                </div>
              </section>

              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderGroup}>
                    <h4 className={styles.cardTitle}>Quote</h4>
                    <span className={styles.cardSubTitle}>From this design</span>
                  </div>
                </div>
                {quotesLoading ? <p className={legacy.note}>Loading quotes…</p> : null}
                {quotesError ? <p className={legacy.error}>{quotesError}</p> : null}

                <div className={styles.quotePricingGrid}>
                  <div className={styles.quotePricingCard}>
                    <div className={styles.summaryLabel}>{quoteCostIncludesGst ? 'Cost to us (inc GST)' : 'Cost to us'}</div>
                    <div className={styles.quotePricingValue}>{renderValue(formatMoney(quoteCostToUs))}</div>
                    <div className={styles.quotePricingSubValue}>Current design snapshot</div>
                  </div>
                  <div className={styles.quotePricingCard}>
                    <div className={styles.summaryLabel}>{quoteCostIncludesGst ? 'Price with margin (inc GST)' : 'Price with margin'}</div>
                    <div className={styles.quotePricingValue}>{renderValue(formatMoney(quoteSellPrice))}</div>
                    <div className={styles.quotePricingSubValue}>1.25x multiplier - 20% margin</div>
                  </div>
                </div>

                {relatedQuotesPreview.length ? (
                  <div className={styles.quoteList}>
                    {relatedQuotesPreview.map((quote) => (
                      <button
                        type="button"
                        key={quote.id}
                        className={styles.quoteRow}
                        onClick={() =>
                          void runWithDrawingDraftGuard(
                            () => handleOpenQuote(quote.id),
                            'You have unsaved drawing changes. Discard them and open this quote?',
                          )
                        }
                      >
                        <div className={styles.quoteRowLabel}>{`${quote.quoteRef} • V${quote.versionNumber}`}</div>
                        <span className={`${styles.quoteStatusPill} ${quoteStatusClass(quote.status)}`}>
                          {quoteStatusLabel(quote.status)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={styles.quoteEmpty}>Create a quote from this design.</p>
                )}

                <div className={styles.quoteActions}>
                  {relatedQuotesPreview.length ? (
                    <button
                      type="button"
                      className={legacy.buttonSecondary}
                      onClick={() =>
                        void runWithDrawingDraftGuard(
                          handleViewAllQuotes,
                          'You have unsaved drawing changes. Discard them and open quotes?',
                        )
                      }
                    >
                      View all quotes
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={legacy.buttonSecondary}
                    onClick={() =>
                      void runWithDrawingDraftGuard(
                        () => setRequestDesignOpen(true),
                        'You have unsaved drawing changes. Discard them and request drafting?',
                      )
                    }
                    disabled={!selectedMeta || drawingSaveBusy}
                  >
                    Request Drafting
                  </button>
                  <button
                    type="button"
                    className={legacy.button}
                    onClick={() =>
                      void runWithDrawingDraftGuard(
                        handleCreateQuote,
                        'You have unsaved drawing changes. Discard them and create a quote?',
                      )
                    }
                    disabled={quoteBusy || drawingSaveBusy}
                  >
                    {quoteBusy ? 'Creating…' : 'Create quote'}
                  </button>
                </div>
              </section>

              <section className={`${styles.card} ${styles.quoteCard}`}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderGroup}>
                    <h4 className={styles.cardTitle}>Breakdown</h4>
                    <span className={styles.cardSubTitle}>{breakdownCount ? `${breakdownCount} categories` : 'No data'}</span>
                  </div>
                </div>
                {breakdownTotals.length ? (
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
                      const breakdownSheet = category.id === 'materials' ? 'materials' : category.id === 'overhead' ? 'overheads' : 'labour';
                      const categoryJobPackUrl = jobPackUrlForSheet(breakdownSheet);
                      return jobPackUrl ? (
                        <a key={category.id} className={styles.breakdownRowLink} href={categoryJobPackUrl}>
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
                    notesDraftRef.current = e.target.value;
                    void notesWorkingCopy.setWorkingCopy(e.target.value);
                  }}
                  onBlur={() => void saveNotesDraft().catch(() => undefined)}
                  rows={4}
                  placeholder="Add internal notes for this design..."
                />
                <div className={styles.cardFooter}>
                  {selectedEstimateSyncPending ? (
                    <span className={styles.savedHint}>Syncing…</span>
                  ) : selectedEstimateSyncState.lastSyncedAt ? (
                    <span className={styles.savedHint}>{formatSavedLabel(selectedEstimateSyncState.lastSyncedAt)}</span>
                  ) : notesDirty ? (
                    <span className={styles.savedHint}>Saving soon…</span>
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
          deferUntilSync={selectedEstimateSyncPending}
          estimateTotalCents={typeof selectedDetail?.summary?.total === 'number' ? Math.round(selectedDetail.summary.total * 100) : null}
          onCreated={async () => {
            await queryClient.invalidateQueries({ queryKey: qk.designPackages.list(hostKey) });
          }}
        />
      ) : null}
    </div>
  );
}
