'use client';

import type { Dispatch, SetStateAction } from 'react';

import type {
  CalculatorInputs,
  CalculatorModuleInputs,
  InfillLineItem,
  InfillMonoSlopeAnchorInput,
  InfillMonoSlopeModeInput,
  InfillSupportInput,
} from '@/lib/types/calculator';
import {
  buildInfillItemsForPreset,
  buildInfillPreset,
  formatInputNumber,
  makeDefaultInfillItem,
  makeDefaultModule,
  makeInfillId,
  normalizeInfillsStateForUi,
  type InfillPresetKey,
} from './calculatorInputs';
import {
  INFILL_PRESETS,
  maxCentreForAcrylicSource,
} from './calculatorInfillUi';
import type { InfillConfiguratorStage } from './infillConfiguratorPresentation';
import {
  resolveMonoSlopeShape,
  type InfillDraftFieldKey,
  type InfillUiState,
} from './infillCompute';
import {
  applyInfillOpeningTemplate,
  syncInfillMonoSlopeDraft,
  type InfillOpeningTemplate,
} from './infillOpeningTemplates';
import { explicitInfillSelectionPatch } from './infillSupportPresentation';
import { trackInfillEvent } from './infillTelemetry';
import { useCalculatorInfillInteractions } from './useCalculatorInfillInteractions';

type DeletedInfillSnapshot = {
  infill: InfillLineItem;
  index: number;
};

type UseCalculatorInfillActionsOptions = {
  activeModule: CalculatorModuleInputs;
  activeModuleIndex: number;
  activePergolaId: string;
  infills: readonly InfillLineItem[];
  setValues: Dispatch<SetStateAction<CalculatorInputs>>;
  selectedInfill: InfillLineItem | null;
  selectedInfillEstimate: InfillUiState['estimate'] | null;
  selectedCanOfferRafterMatching: boolean;
  selectedWarningCount: number;
  infillsOpen: boolean;
  infillDuplicateOpen: boolean;
  openInfills: () => void;
  closeInfills: () => void;
  openInfillDuplicate: () => void;
  closeInfillDuplicate: () => void;
  requestInfillSelection: (id: string) => void;
  setInfillStage: (stage: InfillConfiguratorStage) => void;
  setInfillDraftValue: (infillId: string, field: InfillDraftFieldKey, raw: string) => void;
  clearInfillDraftField: (infillId: string, field: InfillDraftFieldKey) => void;
  clearInfillDraft: (infillId: string) => void;
  getInfillDraftValue: (infill: InfillLineItem, field: InfillDraftFieldKey) => string;
  deleteInfillState: (input: {
    infill: InfillLineItem;
    index: number;
    nextSelectionId: string | null;
  }) => void;
  restoreDeletedInfill: () => DeletedInfillSnapshot | null;
  flashClassName: string;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
};

export function useCalculatorInfillActions({
  activeModule,
  activeModuleIndex,
  activePergolaId,
  infills,
  setValues,
  selectedInfill,
  selectedInfillEstimate,
  selectedCanOfferRafterMatching,
  selectedWarningCount,
  infillsOpen,
  infillDuplicateOpen,
  openInfills,
  closeInfills,
  openInfillDuplicate,
  closeInfillDuplicate,
  requestInfillSelection,
  setInfillStage,
  setInfillDraftValue,
  clearInfillDraftField,
  clearInfillDraft,
  getInfillDraftValue,
  deleteInfillState,
  restoreDeletedInfill,
  flashClassName,
  notifySuccess,
  notifyError,
}: UseCalculatorInfillActionsOptions) {
  const setInfillItems = (updater: (items: InfillLineItem[]) => InfillLineItem[]) => {
    setValues((previous) => {
      const modules = previous.modules.slice();
      const currentModule = modules[activeModuleIndex] ?? makeDefaultModule(activePergolaId);
      const currentInfills = normalizeInfillsStateForUi(currentModule.infills);
      const nextItems = updater(currentInfills.items).map((item) => makeDefaultInfillItem(item));
      modules[activeModuleIndex] = { ...currentModule, infills: { items: nextItems } };
      return { ...previous, modules };
    });
  };

  const setInfillItem = (id: string, patch: Partial<InfillLineItem>) => {
    setInfillItems((items) => items.map((item) => (
      item.id === id ? makeDefaultInfillItem({ ...item, ...patch, id }) : item
    )));
  };

  const setInfillLocation = (id: string, location: InfillLineItem['location']) => {
    setValues((previous) => {
      const modules = previous.modules.slice();
      const currentModule = modules[activeModuleIndex] ?? makeDefaultModule(activePergolaId);
      const currentInfills = normalizeInfillsStateForUi(currentModule.infills);
      const index = currentInfills.items.findIndex((item) => item.id === id);
      if (index < 0) return previous;

      const items = currentInfills.items.slice();
      const existing = items[index];
      const preset = buildInfillPreset(currentModule, location);
      items[index] = makeDefaultInfillItem({
        ...existing,
        ...preset,
        id: existing.id,
        location,
        support: { ...existing.support, ...(preset.support ?? {}) },
        shape: (preset.shape as InfillLineItem['shape'] | undefined) ?? existing.shape,
      });

      modules[activeModuleIndex] = { ...currentModule, infills: { items } };
      return { ...previous, modules };
    });
    clearInfillDraft(id);
    setInfillStage('opening');
  };

  const updateMonoSlopeShape = (
    infill: InfillLineItem,
    updater: (
      shape: Extract<InfillLineItem['shape'], { type: 'mono_slope' }>,
    ) => Extract<InfillLineItem['shape'], { type: 'mono_slope' }>,
  ) => {
    if (infill.shape.type !== 'mono_slope') return;
    setInfillItem(infill.id, { shape: syncInfillMonoSlopeDraft(updater(infill.shape)) });
  };

  const updateRequiredShapeField = (infill: InfillLineItem, field: InfillDraftFieldKey, raw: string) => {
    setInfillDraftValue(infill.id, field, raw);
  };

  const commitRequiredShapeField = (infill: InfillLineItem, field: InfillDraftFieldKey, rawInput?: string) => {
    const raw = typeof rawInput === 'string' ? rawInput : getInfillDraftValue(infill, field);
    if (raw.trim() === '') return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return;

    if (infill.shape.type === 'rect') {
      if (field === 'widthM') {
        setInfillItem(infill.id, { shape: { ...infill.shape, widthM: raw } });
        clearInfillDraftField(infill.id, field);
        return;
      }
      if (field === 'heightM') {
        setInfillItem(infill.id, { shape: { ...infill.shape, heightM: raw } });
        clearInfillDraftField(infill.id, field);
      }
      return;
    }

    if (field === 'widthM') {
      updateMonoSlopeShape(infill, (shape) => ({ ...shape, widthM: raw }));
      clearInfillDraftField(infill.id, field);
      return;
    }
    if (field === 'heightLowM') {
      updateMonoSlopeShape(infill, (shape) => ({ ...shape, heightLowM: raw }));
      clearInfillDraftField(infill.id, field);
      return;
    }
    if (field === 'heightHighM') {
      updateMonoSlopeShape(infill, (shape) => ({ ...shape, heightHighM: raw }));
      clearInfillDraftField(infill.id, field);
    }
  };

  const addInfillItems = (itemsToAdd: InfillLineItem[]) => {
    if (!itemsToAdd.length) return;
    const nextSelectedId = itemsToAdd[0]?.id ?? null;
    setInfillItems((items) => [...items, ...itemsToAdd]);
    setInfillStage('opening');
    if (nextSelectedId) requestInfillSelection(nextSelectedId);
  };

  const addInfill = (seed?: Partial<InfillLineItem>) => {
    addInfillItems([makeDefaultInfillItem(seed)]);
  };

  const addInfillPreset = (preset: InfillPresetKey) => {
    const additions = buildInfillItemsForPreset(activeModule, preset).map((item) =>
      makeDefaultInfillItem({
        ...item,
        targetPanelWidthM: formatInputNumber(maxCentreForAcrylicSource(item.acrylicSource), 2),
        maxPanelWidthM: formatInputNumber(maxCentreForAcrylicSource(item.acrylicSource), 2),
      }),
    );
    addInfillItems(additions);
    trackInfillEvent('infill_add', {
      source: preset === 'custom' ? 'custom' : 'preset',
      preset,
      count: additions.length,
    });
  };

  const duplicateInfill = (id: string) => {
    const current = infills.find((item) => item.id === id);
    if (!current) return;
    addInfill({
      ...current,
      id: makeInfillId(),
      label: current.label ? `${current.label} (copy)` : undefined,
    });
    trackInfillEvent('infill_duplicate', {
      infill_id: id,
      location: current.location,
      shape: current.shape.type,
    });
  };

  const duplicateInfillBulk = (id: string, count: number, labelPattern: string) => {
    const source = infills.find((item) => item.id === id);
    if (!source) return;

    const boundedCount = Math.max(1, Math.min(20, Math.round(count)));
    const sourceLabel = source.label?.trim() || 'Infill';
    const existingLabels = new Set(
      infills.map((item) => (item.label ?? '').trim().toLowerCase()).filter(Boolean),
    );
    const created: InfillLineItem[] = [];

    const makeUniqueLabel = (candidate: string): string => {
      const normalized = candidate.trim();
      if (!normalized) return '';
      let nextLabel = normalized;
      let suffix = 2;
      while (existingLabels.has(nextLabel.toLowerCase())) {
        nextLabel = `${normalized} (${suffix})`;
        suffix += 1;
      }
      existingLabels.add(nextLabel.toLowerCase());
      return nextLabel;
    };

    for (let index = 1; index <= boundedCount; index += 1) {
      const rawLabel = (labelPattern || '{original} (copy {i})')
        .replaceAll('{original}', sourceLabel)
        .replaceAll('{i}', String(index));
      const label = makeUniqueLabel(rawLabel || `${sourceLabel} (copy ${index})`);
      created.push(makeDefaultInfillItem({
        ...source,
        id: makeInfillId(),
        label,
      }));
    }

    if (!created.length) return;
    const nextSelectedId = created[created.length - 1]?.id ?? created[0]?.id ?? null;
    setInfillItems((items) => [...items, ...created]);
    if (nextSelectedId) requestInfillSelection(nextSelectedId);
    setInfillStage('opening');
    trackInfillEvent('infill_duplicate_bulk', {
      infill_id: id,
      count: created.length,
      location: source.location,
      shape: source.shape.type,
    });
  };

  const moveInfill = (id: string, direction: -1 | 1) => {
    const currentIndex = infills.findIndex((item) => item.id === id);
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= infills.length) return;

    setInfillItems((items) => {
      const next = items.slice();
      const [moved] = next.splice(currentIndex, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
    requestInfillSelection(id);
    trackInfillEvent('infill_reorder', {
      infill_id: id,
      from: currentIndex,
      to: nextIndex,
    });
  };

  const deleteInfill = (infillId: string) => {
    const currentIndex = infills.findIndex((item) => item.id === infillId);
    const infill = currentIndex >= 0 ? infills[currentIndex] : null;
    if (!infill) return;

    const nextSelection = currentIndex >= 0
      ? infills[currentIndex + 1]?.id ?? infills[currentIndex - 1]?.id ?? null
      : infills[0]?.id ?? null;

    setInfillItems((items) => items.filter((item) => item.id !== infill.id));
    deleteInfillState({ infill, index: currentIndex, nextSelectionId: nextSelection });
    trackInfillEvent('infill_delete', {
      infill_id: infill.id,
      location: infill.location,
      shape: infill.shape.type,
    });
  };

  const undoDeleteInfill = () => {
    const restored = restoreDeletedInfill();
    if (!restored) return;
    setInfillItems((items) => {
      const next = items.slice();
      const insertIndex = Math.max(0, Math.min(restored.index, next.length));
      next.splice(insertIndex, 0, restored.infill);
      return next;
    });
    trackInfillEvent('infill_undo_delete', {
      infill_id: restored.infill.id,
      location: restored.infill.location,
    });
  };

  const setInfillAcrylicPreference = (
    infillId: string,
    source: InfillLineItem['acrylicSource'],
  ) => {
    const targetWidth = source === 'strip_620' ? '0.64' : '1.2';
    setInfillItem(infillId, {
      acrylicSource: source,
      targetPanelWidthM: targetWidth,
      maxPanelWidthM: targetWidth,
    });
  };

  const handleInfillStageChange = (nextStage: InfillConfiguratorStage) => {
    if (nextStage !== 'opening' && selectedInfill && selectedInfillEstimate) {
      const explicitPatch = explicitInfillSelectionPatch(
        selectedInfill,
        selectedInfillEstimate.acrylicSourceUsed,
        selectedInfillEstimate.panelOrientationUsed,
      );
      if (explicitPatch) setInfillItem(selectedInfill.id, explicitPatch);
    }
    setInfillStage(nextStage);
  };

  const deleteSelectedInfill = () => {
    if (!selectedInfill) return;
    deleteInfill(selectedInfill.id);
  };

  const addCustomInfillFromOverview = (openModal = false) => {
    addInfillPreset('custom');
    if (openModal) openInfills();
  };

  const addInfillPresetFromOverview = (preset: InfillPresetKey, openModal = false) => {
    addInfillPreset(preset);
    if (openModal) openInfills();
  };

  const getSelectedDraftValue = (field: InfillDraftFieldKey) => (
    selectedInfill ? getInfillDraftValue(selectedInfill, field) : ''
  );

  const changeSelectedItem = (patch: Partial<InfillLineItem>) => {
    if (!selectedInfill) return;
    setInfillItem(selectedInfill.id, patch);
  };

  const changeSelectedLocation = (location: InfillLineItem['location']) => {
    if (!selectedInfill) return;
    setInfillLocation(selectedInfill.id, location);
  };

  const changeSelectedShapeTemplate = (template: InfillOpeningTemplate) => {
    if (!selectedInfill) return;
    const nextShape = applyInfillOpeningTemplate(selectedInfill.shape, template);
    if (nextShape === selectedInfill.shape) return;
    clearInfillDraft(selectedInfill.id);
    setInfillItem(selectedInfill.id, { shape: nextShape });
  };

  const changeSelectedDraft = (field: InfillDraftFieldKey, value: string) => {
    if (!selectedInfill) return;
    updateRequiredShapeField(selectedInfill, field, value);
  };

  const commitSelectedDraft = (field: InfillDraftFieldKey, value?: string) => {
    if (!selectedInfill) return;
    commitRequiredShapeField(selectedInfill, field, value);
  };

  const changeSelectedMonoMode = (nextMode: InfillMonoSlopeModeInput) => {
    if (!selectedInfill) return;
    updateMonoSlopeShape(selectedInfill, (shape) => {
      const resolved = resolveMonoSlopeShape(shape);
      return {
        ...shape,
        heightLowM: formatInputNumber(resolved.leftHeightM, 3),
        heightHighM: formatInputNumber(resolved.rightHeightM, 3),
        slopeMode: nextMode,
        slopeDeg: nextMode === 'pitch'
          ? resolved.slopeDeg !== null
            ? formatInputNumber(resolved.slopeDeg, 2)
            : shape.slopeDeg ?? ''
          : shape.slopeDeg ?? '',
        slopeAnchor: nextMode === 'pitch'
          ? resolved.leftHeightM <= resolved.rightHeightM ? 'left' : 'right'
          : shape.slopeAnchor ?? 'left',
      };
    });
  };

  const changeSelectedMonoAnchor = (anchor: InfillMonoSlopeAnchorInput) => {
    if (!selectedInfill) return;
    updateMonoSlopeShape(selectedInfill, (shape) => ({ ...shape, slopeAnchor: anchor }));
  };

  const changeSelectedMonoSlope = (slopeDeg: string) => {
    if (!selectedInfill) return;
    updateMonoSlopeShape(selectedInfill, (shape) => ({ ...shape, slopeDeg }));
  };

  const changeSelectedBottomOffset = (bottomOffsetM: string) => {
    if (!selectedInfill) return;
    setInfillItem(selectedInfill.id, {
      shape: { ...selectedInfill.shape, bottomOffsetM },
    });
  };

  const changeSelectedAcrylicSource = (source: InfillLineItem['acrylicSource']) => {
    if (!selectedInfill) return;
    setInfillAcrylicPreference(selectedInfill.id, source);
  };

  const changeSelectedPanelOrientation = (panelOrientation: InfillLineItem['panelOrientation']) => {
    changeSelectedItem({ panelOrientation });
  };

  const changeSelectedSupport = (support: InfillSupportInput) => {
    changeSelectedItem({ support });
  };

  const changeSelectedInternalMode = (
    nextMode: NonNullable<InfillSupportInput['internalSupportMode']>,
  ) => {
    if (!selectedInfill) return;
    setInfillItem(selectedInfill.id, {
      ...(nextMode !== 'match_roof_rafters'
        && !selectedCanOfferRafterMatching
        && selectedInfill.widthMode === 'match_roof_rafters'
        ? { widthMode: 'target_width' as const }
        : {}),
      support: { ...selectedInfill.support, internalSupportMode: nextMode },
    });
  };

  const changeSelectedCustomPositions = (internalSupportPositionsM: string[]) => {
    if (!selectedInfill) return;
    setInfillItem(selectedInfill.id, {
      support: { ...selectedInfill.support, internalSupportPositionsM },
    });
  };

  const confirmSelectedDuplicate = ({
    count,
    labelPattern,
  }: {
    count: number;
    labelPattern: string;
  }) => {
    if (!selectedInfill) return;
    duplicateInfillBulk(selectedInfill.id, count, labelPattern);
    closeInfillDuplicate();
  };

  const {
    hasClipboard,
    duplicateSelectedInfill,
    handleCopyInfillGeometry,
    handlePasteInfillGeometry,
    moveSelectedInfill,
    jumpToInfillWarningTarget,
    jumpToInfillWarningGlobal,
    focusInfillPrimaryField,
    closeInfillModal,
  } = useCalculatorInfillInteractions({
    activeModuleIndex,
    infills,
    selectedInfill,
    selectedInfillEstimate,
    selectedWarningCount,
    infillsOpen,
    infillDuplicateOpen,
    openInfills,
    closeInfills,
    openInfillDuplicate,
    requestInfillSelection,
    setInfillStage,
    handleInfillStageChange,
    changeSelectedItem,
    duplicateInfill,
    moveInfill,
    flashClassName,
    notifySuccess,
    notifyError,
  });

  return {
    presets: INFILL_PRESETS.filter((preset) => preset.key !== 'custom'),
    hasClipboard,
    addInfillPreset,
    addCustomInfillFromOverview,
    addInfillPresetFromOverview,
    duplicateSelectedInfill,
    confirmSelectedDuplicate,
    handleCopyInfillGeometry,
    handlePasteInfillGeometry,
    moveInfill,
    moveSelectedInfill,
    deleteSelectedInfill,
    undoDeleteInfill,
    handleInfillStageChange,
    jumpToInfillWarningTarget,
    jumpToInfillWarningGlobal,
    focusInfillPrimaryField,
    closeInfillModal,
    getSelectedDraftValue,
    changeSelectedItem,
    changeSelectedLocation,
    changeSelectedShapeTemplate,
    changeSelectedDraft,
    commitSelectedDraft,
    changeSelectedMonoMode,
    changeSelectedMonoAnchor,
    changeSelectedMonoSlope,
    changeSelectedBottomOffset,
    changeSelectedAcrylicSource,
    changeSelectedPanelOrientation,
    changeSelectedSupport,
    changeSelectedInternalMode,
    changeSelectedCustomPositions,
  };
}
