import type { InfillLineItem } from '@/lib/types/calculator';
import {
  INFILL_SHEET_MAX_RUN_M,
  INFILL_SHEET_MAX_SHORT_SIDE_M,
  INFILL_STRIP_MAX_RUN_M,
  INFILL_STRIP_MAX_SHORT_SIDE_M,
  acrylicSourceLabel,
  maxRunForAcrylicSource,
  type InfillUiEstimate,
} from './calculatorInfillUi';

type InfillSummaryUiState = {
  estimate: Pick<
    InfillUiEstimate,
    | 'acrylicSourceAutoSwitched'
    | 'acrylicSourceUsed'
    | 'estimatedMullionsTotal'
    | 'internalJoinerLinesEach'
    | 'maxCentreM'
    | 'panelCountEach'
    | 'panelCountTotal'
    | 'preferredAcrylicSource'
    | 'runSideM'
    | 'sheetAreaEachM2'
  >;
};

type InfillLocationCounts = Record<InfillLineItem['location'], number>;

type InfillSummaryChip = {
  key: string;
  label: string;
  count: number;
};

type CalculatorInfillSummary = {
  totals: {
    panels: number;
    mullions: number;
  };
  locationCounts: InfillLocationCounts;
  systemSummary: string;
  usedSpacingSummary: string;
  hasInfills: boolean;
  line1: string;
  line2: string;
  line3: string | null;
  text: string;
  chips: InfillSummaryChip[];
};

type SelectedInfillSummaryCopy = {
  selectedDraftGhostLine: string | null;
  infillRunConstraintLine: string;
  infillSpacingConstraintLine: string;
  selectedAutoSwitchInlineHint: string | null;
};

function formatMaybeNumber(n: number | undefined, digits = 2): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function makeEmptyLocationCounts(): InfillLocationCounts {
  return {
    front: 0,
    house: 0,
    side: 0,
    gable_end: 0,
    wall: 0,
    custom: 0,
  };
}

export function buildCalculatorInfillSummary(
  items: InfillLineItem[],
  uiById: ReadonlyMap<string, InfillSummaryUiState>,
): CalculatorInfillSummary {
  const totals = items.reduce(
    (acc, entry) => {
      const ui = uiById.get(entry.id);
      if (!ui) return acc;
      acc.panels += ui.estimate.panelCountTotal;
      acc.mullions += ui.estimate.estimatedMullionsTotal;
      return acc;
    },
    { panels: 0, mullions: 0 },
  );

  const locationCounts = makeEmptyLocationCounts();
  for (const item of items) locationCounts[item.location] += 1;

  const hasSheets = items.some((item) => (uiById.get(item.id)?.estimate.acrylicSourceUsed ?? 'sheet_panels') === 'sheet_panels');
  const hasStrips = items.some((item) => (uiById.get(item.id)?.estimate.acrylicSourceUsed ?? 'sheet_panels') === 'strip_620');
  const systemSummary = hasSheets && hasStrips ? 'Mixed systems' : hasStrips ? '620 strips' : hasSheets ? 'Sheet panels' : 'Not configured';

  const usedSpacingValues = items
    .map((item) => uiById.get(item.id)?.estimate.maxCentreM)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  const usedSpacingSummary = (() => {
    if (!usedSpacingValues.length) return '—';
    const minSpacing = Math.min(...usedSpacingValues);
    const maxSpacing = Math.max(...usedSpacingValues);
    if (Math.abs(maxSpacing - minSpacing) <= 0.0001) return `${formatMaybeNumber(maxSpacing, 2)}m`;
    return `${formatMaybeNumber(minSpacing, 2)}m to ${formatMaybeNumber(maxSpacing, 2)}m`;
  })();

  const hasInfills = items.length > 0;
  const line1 = `${items.length} infill${items.length === 1 ? '' : 's'} added`;
  const line2 = [
    `Front ${locationCounts.front}`,
    `Side ${locationCounts.side}`,
    `Gable ${locationCounts.gable_end}`,
    locationCounts.house > 0 ? `House ${locationCounts.house}` : null,
    locationCounts.wall > 0 ? `Wall ${locationCounts.wall}` : null,
    locationCounts.custom > 0 ? `Custom ${locationCounts.custom}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const line3 = hasInfills ? `System: ${systemSummary} · Panels: ${totals.panels} · New supports: ${totals.mullions}` : null;
  const text = hasInfills ? line1 : 'No infills added yet';
  const chips = [
    { key: 'front', label: 'Front', count: locationCounts.front },
    { key: 'side', label: 'Side', count: locationCounts.side },
    { key: 'gable', label: 'Gable', count: locationCounts.gable_end },
    { key: 'house', label: 'House', count: locationCounts.house },
    { key: 'wall', label: 'Wall', count: locationCounts.wall },
    { key: 'custom', label: 'Custom', count: locationCounts.custom },
  ].filter((chip) => chip.count > 0);

  return {
    totals,
    locationCounts,
    systemSummary,
    usedSpacingSummary,
    hasInfills,
    line1,
    line2,
    line3,
    text,
    chips,
  };
}

export function buildSelectedInfillSummaryCopy({
  selectedInfillEstimate,
  selectedInfillIsDraft,
  selectedLastValidEstimate,
}: {
  selectedInfillEstimate: InfillUiEstimate | null;
  selectedInfillIsDraft: boolean;
  selectedLastValidEstimate: InfillUiEstimate | null;
}): SelectedInfillSummaryCopy {
  const selectedDraftGhostLine =
    selectedInfillIsDraft && selectedLastValidEstimate
      ? `Last valid: ${selectedLastValidEstimate.panelCountEach} panels each, ${selectedLastValidEstimate.internalJoinerLinesEach} internal joiners, ${formatMaybeNumber(
          selectedLastValidEstimate.sheetAreaEachM2,
          2,
        )}m2 area each.`
      : null;

  const infillRunConstraintLine = `Max run: ${formatMaybeNumber(INFILL_SHEET_MAX_RUN_M, 2)}m (sheet), ${formatMaybeNumber(INFILL_STRIP_MAX_RUN_M, 2)}m (strips).`;
  const infillSpacingConstraintLine = `Max bay spacing: ${formatMaybeNumber(INFILL_SHEET_MAX_SHORT_SIDE_M, 2)}m (sheet), ${formatMaybeNumber(
    INFILL_STRIP_MAX_SHORT_SIDE_M,
    2,
  )}m (strips).`;
  const selectedAutoSwitchInlineHint =
    selectedInfillEstimate?.acrylicSourceAutoSwitched && selectedInfillEstimate
      ? `Will auto-switch to ${acrylicSourceLabel(selectedInfillEstimate.acrylicSourceUsed)} because run ${formatMaybeNumber(
          selectedInfillEstimate.runSideM,
          2,
        )}m exceeds ${formatMaybeNumber(maxRunForAcrylicSource(selectedInfillEstimate.preferredAcrylicSource), 2)}m.`
      : null;

  return {
    selectedDraftGhostLine,
    infillRunConstraintLine,
    infillSpacingConstraintLine,
    selectedAutoSwitchInlineHint,
  };
}
