'use client';

import type { SiteOutputV1 } from '@sp/costing';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { EstimateDetail } from '@/lib/estimates/types';
import { deriveSiteResultWarnings } from '@/lib/estimates/costingPayload';
import type {
  BlindLineItem,
  CalculatorInputs,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import { buildCalculatorBlindsUi } from './calculatorBlindUi';
import { buildCalculatorPricingComparison } from './calculatorPricingComparison';
import { useCalculatorPricingPreview } from './calculatorPricingPreview';
import type { CalculatorPricingSummaryProps } from './CalculatorPricingSummary';
import type { CalculatorResultFreshness } from './calculatorResultFreshness';
import type { SaveDialogSummary } from './CalculatorSaveDialogs';
import { computeHasOurGutter } from './calculatorInputs';
import { buildImpactDiff, type ImpactDiff } from './diff';
import {
  canEditHouseFootprintPlan,
  type ModuleViewsStatus,
  type ModuleViewsTab,
} from './ModuleViewsCard';
import { buildModulePlanModel, buildModuleSectionModel } from './moduleViews';

type CalculatorModuleRoute = {
  pergolaId: string;
  localModuleIndex: number;
};

type CalculatorModuleFieldSetter = <K extends keyof CalculatorModuleInputs>(
  key: K,
  next: CalculatorModuleInputs[K],
) => void;

type UseCalculatorResultPresentationOptions = {
  result: SiteOutputV1 | null;
  values: CalculatorInputs;
  activeModule: CalculatorModuleInputs;
  activeModuleIndex: number;
  activeModuleLabel: string;
  moduleRoutes: CalculatorModuleRoute[];
  moduleViewsTab: ModuleViewsTab;
  engineError: string | null;
  isCalculating: boolean;
  blindItems: BlindLineItem[];
  loadedEstimateDetail: EstimateDetail | null;
  isEditingDesign: boolean;
  resultFreshness: CalculatorResultFreshness;
  canViewInternalCosts: boolean;
  issuesCount: number;
  openIssues: () => void;
  setModuleField: CalculatorModuleFieldSetter;
};

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '$0.00';
  return `$${value.toFixed(2)}`;
}

function formatMaybeMoney(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return formatMoney(value);
}

function formatMaybeNumber(value: number | undefined, digits = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

function inferStockLengthFromLabel(label: string): number | null {
  const match = String(label ?? '').match(/(\d+(?:\.\d+)?)m\b/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1] ?? '');
  return Number.isFinite(value) ? value : null;
}

export function useCalculatorResultPresentation({
  result,
  values,
  activeModule,
  activeModuleIndex,
  activeModuleLabel,
  moduleRoutes,
  moduleViewsTab,
  engineError,
  isCalculating,
  blindItems,
  loadedEstimateDetail,
  isEditingDesign,
  resultFreshness,
  canViewInternalCosts,
  issuesCount,
  openIssues,
  setModuleField,
}: UseCalculatorResultPresentationOptions) {
  const baselineResultRef = useRef<SiteOutputV1 | null>(null);
  const [impactDiff, setImpactDiff] = useState<ImpactDiff | null>(null);
  const resultModules = useMemo(
    () => (result?.pergolas ?? []).flatMap((pergola) => pergola.modules ?? []),
    [result],
  );
  const moduleResult = useMemo(() => {
    const route = moduleRoutes[activeModuleIndex] ?? moduleRoutes[0];
    if (!route) return resultModules[0] ?? null;
    const fallbackPergola = result?.pergolas?.[0];
    const pergola = result?.pergolas?.find((entry) => entry.id === route.pergolaId) ?? fallbackPergola;
    return pergola?.modules?.[route.localModuleIndex]
      ?? resultModules[activeModuleIndex]
      ?? resultModules[0]
      ?? null;
  }, [activeModuleIndex, moduleRoutes, result, resultModules]);

  const modulePlanModel = useMemo(
    () => buildModulePlanModel(activeModule, moduleResult),
    [activeModule, moduleResult],
  );
  const moduleSectionModel = useMemo(
    () => buildModuleSectionModel(activeModule, moduleResult),
    [activeModule, moduleResult],
  );
  const rafterCutLengthExplanation =
    moduleResult?.derived.rafter_cut_length_explanation ?? null;
  const canEditActiveHouseFootprint = canEditHouseFootprintPlan(modulePlanModel);
  const activeViewHasModel = moduleViewsTab === 'plan'
    ? Boolean(modulePlanModel)
    : Boolean(moduleSectionModel);
  const activeViewSource = moduleViewsTab === 'plan'
    ? modulePlanModel?.dataSource
    : moduleSectionModel?.dataSource;
  const moduleViewsStatus: ModuleViewsStatus =
    isCalculating && !activeViewHasModel
      ? 'loading'
      : activeViewHasModel
        ? 'ready'
        : engineError
          ? 'error'
          : 'empty';
  const moduleViewsStatusDetail =
    moduleViewsStatus === 'error'
      ? engineError ?? undefined
      : moduleViewsStatus === 'empty'
        ? 'Enter valid module dimensions to hydrate the view.'
        : moduleViewsStatus === 'ready'
          ? activeViewSource === 'derived'
            ? `Using derived geometry. Active style: ${activeModule.pergolaStyle}${activeModule.boxPerimeterEnabled ? ' (box perimeter)' : ''}`
            : `Using input fallback geometry. Active style: ${activeModule.pergolaStyle}${activeModule.boxPerimeterEnabled ? ' (box perimeter)' : ''}`
          : undefined;

  useEffect(() => {
    if (!result) return;
    const baseline = baselineResultRef.current;
    if (!baseline) {
      baselineResultRef.current = result;
      setImpactDiff(null);
      return;
    }
    setImpactDiff(buildImpactDiff(baseline, result));
  }, [result]);

  const resetImpactBaseline = () => {
    if (!result) return;
    baselineResultRef.current = result;
    setImpactDiff(null);
  };

  const derivedArea = moduleResult?.derived.area_m2;
  const derivedRoofArea = moduleResult?.derived.roof_surface_area_m2;
  const derivedPitchUsed = moduleResult?.derived.roof_pitch_deg_used;
  const derivedAcrylicArea = moduleResult?.derived.acrylic_area_m2;
  const derivedTimberArea = (moduleResult?.derived as any)?.timber_area_m2 as number | undefined;
  const derivedAcrylicBaysTotal = (moduleResult?.derived as any)?.acrylic_bays_total as number | undefined;
  const derivedSlopeLength = moduleResult?.derived.rafter_length_m;
  const derivedBoxPitch = (moduleResult?.derived as any)?.box_pitch_deg_used as number | undefined;
  const derivedBoxRiseMm = (moduleResult?.derived as any)?.box_rise_mm as number | undefined;
  const derivedBoxMaxFallMm = (moduleResult?.derived as any)?.box_max_fall_mm as number | undefined;
  const derivedHasOurGutter = (moduleResult?.derived as any)?.has_our_gutter as boolean | undefined;
  const roofType = moduleResult?.inputs_normalized.roof_type;
  const rafterCount = moduleResult?.derived.rafter_count;
  const hipRafterCount = moduleResult?.derived.hip_rafter_count;
  const bracketCount = moduleResult?.derived.bracket_count;
  const rafterProfile = moduleResult?.inputs_normalized.rafter_profile;
  const crewHours = result?.install.totals.crew_hours;
  const siteDays = moduleResult?.derived?.site_days ?? resultModules?.[0]?.derived?.site_days;
  const hasOurGutterUi = typeof derivedHasOurGutter === 'boolean'
    ? derivedHasOurGutter
    : computeHasOurGutter(activeModule);
  const crewDays = typeof siteDays === 'number' ? siteDays : undefined;

  const materialsEx = result?.materials.totals.materials_ex_gst;
  const installEx = result?.install.totals.install_ex_gst;
  const overheadEx = result?.overhead.total_ex_gst;
  const totalEx = result?.totals.cost_ex_gst;
  const totalInc = result?.totals.cost_inc_gst;
  const blindsUi = useMemo(() => buildCalculatorBlindsUi(blindItems), [blindItems]);
  const pricingPreview = useCalculatorPricingPreview({
    result,
    inputs: values,
    blindPricing: blindsUi.pricing,
    estimateSnapshot: loadedEstimateDetail?.calculatorSnapshot,
    resultFreshness,
  });
  const pricingComparison = useMemo(
    () => isEditingDesign
      ? buildCalculatorPricingComparison({
          estimate: loadedEstimateDetail,
          values,
          liveResult: result,
        })
      : null,
    [isEditingDesign, loadedEstimateDetail, result, values],
  );
  const engineWarningsRaw = useMemo(
    () => (result ? deriveSiteResultWarnings(result) : []),
    [result],
  );

  useEffect(() => {
    if (hasOurGutterUi) return;
    if (activeModule.downpipeElbowCount === '0') return;
    setModuleField('downpipeElbowCount', '0');
  }, [activeModule.downpipeElbowCount, activeModuleIndex, hasOurGutterUi]);

  const roofingProcurementSummary = useMemo(() => {
    const lines = moduleResult?.materials?.lines ?? [];
    if (!Array.isArray(lines) || !lines.length) return '—';

    const cedar = lines.find(
      (line: any) => String(line?.id ?? '') === 'roofing-timber_cedar_sarking_wrc_110cover_12mm_lm',
    );
    const cedarPart = cedar && typeof cedar.qty === 'number' && Number.isFinite(cedar.qty)
      ? `Timber: ${formatMaybeNumber(cedar.qty, 2)} lm cedar sarking`
      : null;

    const sheet = lines.find((line: any) => String(line?.profile ?? '') === 'Plexi sheet 3050×2030');
    const sheetPart = sheet && typeof sheet.qty === 'number' && Number.isFinite(sheet.qty)
      ? `Acrylic: ${Math.round(sheet.qty)} × 3050×2030 sheet(s)`
      : null;

    const stripGroups = new Map<number, number>();
    for (const line of lines as any[]) {
      if (String(line?.profile ?? '') !== 'Crystalite 620mm') continue;
      const length = inferStockLengthFromLabel(String(line?.label ?? '')) ?? 0;
      if (!length) continue;
      const quantity = typeof line?.qty === 'number' && Number.isFinite(line.qty) ? line.qty : 0;
      stripGroups.set(length, (stripGroups.get(length) ?? 0) + quantity);
    }
    const stripPart = stripGroups.size > 0
      ? `Acrylic: ${Array.from(stripGroups.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([length, quantity]) => `${Math.round(quantity)} × 620mm strip(s) @ ${length}m`)
          .join(', ')}`
      : null;

    const parts = [sheetPart ?? stripPart, cedarPart].filter(Boolean);
    return parts.length ? (parts as string[]).join(' · ') : '—';
  }, [moduleResult]);

  const rafterCountTotal =
    typeof rafterCount === 'number'
      ? roofType === 'gable' || roofType === 'low_gable' || roofType === 'hip'
        ? rafterCount * 2
        : rafterCount
      : null;
  const rafterHelperText =
    typeof rafterCount === 'number' && (roofType === 'gable' || roofType === 'low_gable')
      ? `Per side: ${rafterCount}`
      : typeof rafterCount === 'number' && roofType === 'hip'
        ? `Per side: ${rafterCount}${typeof hipRafterCount === 'number' && hipRafterCount > 0 ? ` (+${hipRafterCount} hip)` : ''}`
        : undefined;

  const bomPreview = useMemo(() => {
    const lines = result?.materials?.lines ?? [];
    if (!Array.isArray(lines) || lines.length === 0) return [];
    return lines
      .slice()
      .sort((a, b) => (b.line_cost_ex_gst ?? 0) - (a.line_cost_ex_gst ?? 0))
      .slice(0, 10);
  }, [result]);

  const labourPreview = useMemo(() => {
    const actions = result?.install?.actions ?? [];
    if (!Array.isArray(actions) || actions.length === 0) return [];
    return actions.slice().sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0));
  }, [result]);

  const saveDialogSummary: SaveDialogSummary = {
    modules: String(values.modules.length),
    activeModule: `${activeModuleLabel}: ${activeModule.pergolaStyle}${activeModule.boxPerimeterEnabled ? ' + box perimeter' : ''}`,
    roofSize: activeModule.pergolaStyle === 'hip_corner'
      ? `A: ${activeModule.lengthM}×${activeModule.projectionM}m, B: ${activeModule.hipCornerLengthBM}×${activeModule.hipCornerProjectionBM}m`
      : `${activeModule.lengthM}m × ${activeModule.projectionM}m`,
    roofMaterial: activeModule.roofMaterial,
    roofPitch: typeof derivedPitchUsed === 'number'
      ? `${derivedPitchUsed.toFixed(0)}°`
      : activeModule.roofPitchDeg.trim()
        ? `${activeModule.roofPitchDeg}°`
        : '—',
    materialsEx: formatMaybeMoney(materialsEx),
    installEx: formatMaybeMoney(installEx),
    overheadEx: formatMaybeMoney(overheadEx),
    trueCostEx: formatMaybeMoney(totalEx),
    blindCustomerEx: formatMaybeMoney(blindsUi.totalEx),
    customerTotalInc: formatMaybeMoney(pricingPreview.totalIncGstCents / 100),
  };

  const pricingSummaryProps: CalculatorPricingSummaryProps = {
    resultFreshness,
    issuesCount,
    onOpenIssues: openIssues,
    customerTotalIncGstCents: pricingPreview.totalIncGstCents,
    customerTotalExGstCents: pricingPreview.totalExGstCents,
    undiscountedTotalIncGstCents: pricingPreview.undiscountedTotalIncGstCents,
    quoteDiscountPct: pricingPreview.discountPct,
    unpricedItemCount: pricingPreview.unpricedItemCount,
    hasCustomerPricing: pricingPreview.hasCorePricing,
    canViewInternalCosts,
    internalTrueCostExGst: totalEx,
    internalTrueCostIncGst: totalInc,
    materialsExGst: materialsEx,
    installExGst: installEx,
    overheadExGst: overheadEx,
    crewHours,
    installDays: crewDays,
  };

  const structureOutputRows = [
    { label: 'Area (m²)', value: formatMaybeNumber(derivedArea) },
    { label: 'Roof area (m²)', value: formatMaybeNumber(derivedRoofArea) },
    { label: 'Acrylic area (m²)', value: formatMaybeNumber(derivedAcrylicArea) },
    { label: 'Timber area (m²)', value: formatMaybeNumber(derivedTimberArea) },
    { label: 'Pitch used (deg)', value: typeof derivedPitchUsed === 'number' ? derivedPitchUsed.toFixed(0) : '—' },
    { label: 'Slope length (m)', value: formatMaybeNumber(derivedSlopeLength) },
    { label: 'Rafters', value: rafterCountTotal && rafterProfile ? `${rafterCountTotal} × ${rafterProfile}` : '—' },
    { label: 'Brackets', value: typeof bracketCount === 'number' ? String(bracketCount) : '—' },
  ];

  return {
    resultModules,
    moduleResult,
    modulePlanModel,
    moduleSectionModel,
    rafterCutLengthExplanation,
    canEditActiveHouseFootprint,
    moduleViewsStatus,
    moduleViewsStatusDetail,
    impactDiff,
    resetImpactBaseline,
    derivedArea,
    derivedRoofArea,
    derivedPitchUsed,
    derivedAcrylicArea,
    derivedTimberArea,
    derivedAcrylicBaysTotal,
    derivedSlopeLength,
    derivedBoxPitch,
    derivedBoxRiseMm,
    derivedBoxMaxFallMm,
    hasOurGutterUi,
    roofType,
    rafterCount,
    hipRafterCount,
    bracketCount,
    rafterProfile,
    crewHours,
    crewDays,
    materialsEx,
    installEx,
    overheadEx,
    totalEx,
    totalInc,
    blindsUi,
    pricingPreview,
    pricingComparison,
    engineWarningsRaw,
    roofingProcurementSummary,
    rafterCountTotal,
    rafterHelperText,
    bomPreview,
    labourPreview,
    saveDialogSummary,
    pricingSummaryProps,
    structureOutputRows,
  };
}
