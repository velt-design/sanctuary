'use client';

import { useEffect, useRef } from 'react';

import type { InfillLineItem } from '@/lib/types/calculator';
import {
  stageForInfillWarning,
  type InfillConfiguratorStage,
} from './infillConfiguratorPresentation';
import {
  infillFieldId,
  type InfillUiState,
  type InfillWarningItem,
} from './infillCompute';
import { trackInfillEvent } from './infillTelemetry';
import { useInfillClipboard } from './useInfillClipboard';
import { useInfillHotkeys } from './useInfillHotkeys';

type UseCalculatorInfillInteractionsOptions = {
  activeModuleIndex: number;
  infills: readonly InfillLineItem[];
  selectedInfill: InfillLineItem | null;
  selectedInfillEstimate: InfillUiState['estimate'] | null;
  selectedWarningCount: number;
  infillsOpen: boolean;
  infillDuplicateOpen: boolean;
  openInfills: () => void;
  closeInfills: () => void;
  openInfillDuplicate: () => void;
  requestInfillSelection: (id: string) => void;
  setInfillStage: (stage: InfillConfiguratorStage) => void;
  handleInfillStageChange: (stage: InfillConfiguratorStage) => void;
  changeSelectedItem: (patch: Partial<InfillLineItem>) => void;
  duplicateInfill: (id: string) => void;
  moveInfill: (id: string, direction: -1 | 1) => void;
  flashClassName: string;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
};

export function useCalculatorInfillInteractions({
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
}: UseCalculatorInfillInteractionsOptions) {
  const infillLastSelectionEventRef = useRef<string | null>(null);
  const infillModalOpenTrackedRef = useRef(false);
  const pendingInfillWarningJumpRef = useRef<{ infillId: string; warning: InfillWarningItem } | null>(null);
  const {
    hasClipboard,
    copyGeometry,
    pasteGeometry,
  } = useInfillClipboard();

  const handleCopyInfillGeometry = async () => {
    if (!selectedInfill) return;
    await copyGeometry(selectedInfill);
    trackInfillEvent('infill_copy_geometry', {
      infill_id: selectedInfill.id,
      location: selectedInfill.location,
      shape: selectedInfill.shape.type,
    });
    notifySuccess('Geometry copied.');
  };

  const handlePasteInfillGeometry = () => {
    if (!selectedInfill) return;
    const patch = pasteGeometry(selectedInfill);
    if (!patch) {
      notifyError('No geometry copied yet.');
      return;
    }
    changeSelectedItem(patch);
    setInfillStage('opening');
    trackInfillEvent('infill_paste_geometry', {
      infill_id: selectedInfill.id,
      location: selectedInfill.location,
      shape: selectedInfill.shape.type,
    });
    notifySuccess('Geometry pasted.');
  };

  const flashInfillTarget = (element: HTMLElement | null) => {
    if (!element) return;
    element.classList.add(flashClassName);
    window.setTimeout(() => {
      element.classList.remove(flashClassName);
    }, 900);
  };

  const jumpToInfillWarningTarget = (warning: InfillWarningItem) => {
    if (!selectedInfill) return;
    const targetStage = stageForInfillWarning(warning);
    handleInfillStageChange(targetStage);
    trackInfillEvent('infill_warning_clicked', {
      infill_id: selectedInfill.id,
      warning_id: warning.id,
      severity: warning.severity,
      section: targetStage,
    });
    window.requestAnimationFrame(() => {
      const fieldId = infillFieldId(selectedInfill.id, warning.target.fieldKey);
      const element = document.getElementById(fieldId) as HTMLElement | null;
      if (!element) return;
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
      try {
        element.focus({ preventScroll: true });
      } catch {
        element.focus();
      }
      flashInfillTarget(element);
    });
  };

  const jumpToInfillWarningGlobal = (infillId: string, warning: InfillWarningItem) => {
    openInfills();
    requestInfillSelection(infillId);
    pendingInfillWarningJumpRef.current = { infillId, warning };
  };

  useEffect(() => {
    const pending = pendingInfillWarningJumpRef.current;
    if (!pending) return;
    if (!infillsOpen) return;
    if (selectedInfill?.id !== pending.infillId) return;
    pendingInfillWarningJumpRef.current = null;
    jumpToInfillWarningTarget(pending.warning);
  }, [infillsOpen, selectedInfill?.id]);

  const focusInfillPrimaryField = (infillId: string) => {
    setInfillStage('opening');
    window.requestAnimationFrame(() => {
      const field = document.getElementById(`infill-${infillId}-label`) as HTMLElement | null;
      if (!field) return;
      try {
        field.focus({ preventScroll: true });
      } catch {
        field.focus();
      }
    });
  };

  useEffect(() => {
    if (!infillsOpen) {
      infillLastSelectionEventRef.current = null;
      infillModalOpenTrackedRef.current = false;
      return;
    }
    if (infillModalOpenTrackedRef.current) return;
    infillModalOpenTrackedRef.current = true;
    trackInfillEvent('infill_modal_open', {
      infill_count: infills.length,
      module_index: activeModuleIndex + 1,
    });
  }, [activeModuleIndex, infills.length, infillsOpen]);

  useEffect(() => {
    if (!infillsOpen || !selectedInfill) return;
    if (infillLastSelectionEventRef.current === selectedInfill.id) return;
    infillLastSelectionEventRef.current = selectedInfill.id;
    trackInfillEvent('infill_select', {
      infill_id: selectedInfill.id,
      location: selectedInfill.location,
      shape: selectedInfill.shape.type,
      panel_count: selectedInfillEstimate?.panelCountEach ?? 0,
      joiners: selectedInfillEstimate?.internalJoinerLinesEach ?? 0,
    });
  }, [
    infillsOpen,
    selectedInfill,
    selectedInfillEstimate?.internalJoinerLinesEach,
    selectedInfillEstimate?.panelCountEach,
  ]);

  const closeInfillModal = () => {
    trackInfillEvent('infill_done', {
      infill_count: infills.length,
      warnings: selectedWarningCount,
    });
    closeInfills();
  };

  const duplicateSelectedInfill = () => {
    if (!selectedInfill) return;
    duplicateInfill(selectedInfill.id);
  };

  const moveSelectedInfill = (direction: -1 | 1) => {
    if (!selectedInfill) return;
    moveInfill(selectedInfill.id, direction);
  };

  useInfillHotkeys({
    enabled: infillsOpen && Boolean(selectedInfill),
    disableEsc: infillDuplicateOpen,
    onDuplicate: duplicateSelectedInfill,
    onDuplicateBulk: openInfillDuplicate,
    onCopyGeometry: () => { void handleCopyInfillGeometry(); },
    onPasteGeometry: handlePasteInfillGeometry,
    onMoveUp: () => moveSelectedInfill(-1),
    onMoveDown: () => moveSelectedInfill(1),
    onClose: closeInfillModal,
    onDone: closeInfillModal,
  });

  return {
    hasClipboard,
    duplicateSelectedInfill,
    handleCopyInfillGeometry,
    handlePasteInfillGeometry,
    moveSelectedInfill,
    jumpToInfillWarningTarget,
    jumpToInfillWarningGlobal,
    focusInfillPrimaryField,
    closeInfillModal,
  };
}
