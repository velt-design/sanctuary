'use client';

import type { CostInputsV1, CostOutputV1 } from '@sp/costing';
import { useEffect, useMemo, useState } from 'react';

import type { InfillLineItem } from '@/lib/types/calculator';
import {
  applyAcrylicVariantToInfillPayload,
  buildModulePayloadWithInfills,
  diffModuleCost,
  fetchModuleCost,
  removeInfillFromInfills,
  replaceInfillInPayload,
} from './infillDecision';
import { makeDefaultInfillItem, toNumber } from './calculatorInputs';
import { resolveInfillUiState, type InfillDraftEntry } from './infillCompute';

type FetchModuleCost = typeof fetchModuleCost;

export function useCalculatorInfillCostComparison({
  canViewInternalCosts,
  infillsOpen,
  detailsOpen,
  activeModulePayload,
  readyToCalculate,
  isCalculating,
  engineError,
  selectedInfill,
  moduleLengthM,
  roofRafterSpacingM,
  selectedInfillDraft,
  fetchCost = fetchModuleCost,
}: {
  canViewInternalCosts: boolean;
  infillsOpen: boolean;
  detailsOpen: boolean;
  activeModulePayload: CostInputsV1 | null;
  readyToCalculate: boolean;
  isCalculating: boolean;
  engineError: string | null | undefined;
  selectedInfill: InfillLineItem | null;
  moduleLengthM: string;
  roofRafterSpacingM: number;
  selectedInfillDraft: InfillDraftEntry | undefined;
  fetchCost?: FetchModuleCost;
}) {
  const [moduleBaseline, setModuleBaseline] = useState<CostOutputV1 | null>(null);
  const [moduleBaselineLoading, setModuleBaselineLoading] = useState(false);
  const [moduleBaselineError, setModuleBaselineError] = useState<string | null>(null);
  const [optionLoading, setOptionLoading] = useState(false);
  const [optionError, setOptionError] = useState<string | null>(null);
  const [withoutInfillCost, setWithoutInfillCost] = useState<CostOutputV1 | null>(null);
  const [sheetCost, setSheetCost] = useState<CostOutputV1 | null>(null);
  const [stripCost, setStripCost] = useState<CostOutputV1 | null>(null);

  const enabled =
    canViewInternalCosts &&
    infillsOpen &&
    detailsOpen &&
    Boolean(activeModulePayload) &&
    readyToCalculate &&
    !isCalculating &&
    !engineError;

  useEffect(() => {
    if (!enabled || !activeModulePayload) {
      setModuleBaseline(null);
      setModuleBaselineError(null);
      setModuleBaselineLoading(false);
      setWithoutInfillCost(null);
      setSheetCost(null);
      setStripCost(null);
      setOptionError(null);
      setOptionLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setModuleBaselineLoading(true);
      setModuleBaselineError(null);
      try {
        const output = await fetchCost(activeModulePayload, controller.signal);
        if (!controller.signal.aborted) setModuleBaseline(output);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setModuleBaselineError(
          requestError instanceof Error ? requestError.message : 'Failed to fetch module baseline',
        );
      } finally {
        if (!controller.signal.aborted) setModuleBaselineLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [activeModulePayload, enabled, fetchCost]);

  useEffect(() => {
    const selectedInfillId = selectedInfill?.id ?? null;
    if (!enabled || !activeModulePayload || !moduleBaseline || !selectedInfillId) {
      setWithoutInfillCost(null);
      setSheetCost(null);
      setStripCost(null);
      setOptionError(null);
      setOptionLoading(false);
      return;
    }

    const sourceInfills = activeModulePayload.infills;
    if (!Array.isArray(sourceInfills) || !sourceInfills.some((entry) => String(entry.id) === selectedInfillId)) {
      setWithoutInfillCost(null);
      setSheetCost(null);
      setStripCost(null);
      setOptionError(null);
      setOptionLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setOptionLoading(true);
      setOptionError(null);
      try {
        const withoutPayload = buildModulePayloadWithInfills(
          activeModulePayload,
          removeInfillFromInfills(sourceInfills, selectedInfillId),
        );
        const sheetPayload = buildModulePayloadWithInfills(
          activeModulePayload,
          replaceInfillInPayload(sourceInfills, selectedInfillId, (entry) =>
            applyAcrylicVariantToInfillPayload(entry, 'sheet_panels'),
          ),
        );
        const stripPayload = buildModulePayloadWithInfills(
          activeModulePayload,
          replaceInfillInPayload(sourceInfills, selectedInfillId, (entry) =>
            applyAcrylicVariantToInfillPayload(entry, 'strip_620'),
          ),
        );

        const [withoutOutput, sheetOutput, stripOutput] = await Promise.all([
          fetchCost(withoutPayload, controller.signal),
          fetchCost(sheetPayload, controller.signal),
          fetchCost(stripPayload, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setWithoutInfillCost(withoutOutput);
        setSheetCost(sheetOutput);
        setStripCost(stripOutput);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setOptionError(requestError instanceof Error ? requestError.message : 'Failed to compare infill options');
      } finally {
        if (!controller.signal.aborted) setOptionLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [activeModulePayload, enabled, fetchCost, moduleBaseline, selectedInfill?.id]);

  const marginalDelta = useMemo(
    () => diffModuleCost(moduleBaseline, withoutInfillCost),
    [moduleBaseline, withoutInfillCost],
  );
  const sheetDelta = useMemo(() => diffModuleCost(sheetCost, moduleBaseline), [moduleBaseline, sheetCost]);
  const stripDelta = useMemo(() => diffModuleCost(stripCost, moduleBaseline), [moduleBaseline, stripCost]);

  const complexityEstimate = (source: 'sheet_panels' | 'strip_620') => {
    if (!selectedInfill) return null;
    const panelWidthM = source === 'sheet_panels' ? '1.2' : '0.64';
    const variant = makeDefaultInfillItem({
      ...selectedInfill,
      id: selectedInfill.id,
      acrylicSource: source,
      targetPanelWidthM: panelWidthM,
      maxPanelWidthM: panelWidthM,
    });
    return resolveInfillUiState(
      variant,
      roofRafterSpacingM,
      selectedInfillDraft,
      toNumber(moduleLengthM),
    )?.estimate ?? null;
  };

  const sheetComplexityEstimate = useMemo(
    () => complexityEstimate('sheet_panels'),
    [moduleLengthM, roofRafterSpacingM, selectedInfill, selectedInfillDraft],
  );
  const stripComplexityEstimate = useMemo(
    () => complexityEstimate('strip_620'),
    [moduleLengthM, roofRafterSpacingM, selectedInfill, selectedInfillDraft],
  );

  return {
    moduleBaselineLoading,
    moduleBaselineError,
    optionLoading,
    optionError,
    marginalDelta,
    sheetDelta,
    stripDelta,
    sheetComplexityEstimate,
    stripComplexityEstimate,
  };
}

export type CalculatorInfillCostComparison = ReturnType<typeof useCalculatorInfillCostComparison>;
