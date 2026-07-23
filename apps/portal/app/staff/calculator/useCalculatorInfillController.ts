'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { InfillLineItem } from '@/lib/types/calculator';
import { INFILL_DELETE_UNDO_MS } from './calculatorInfillUi';
import type { InfillConfiguratorStage } from './infillConfiguratorPresentation';
import type { InfillDraftEntry, InfillDraftFieldKey } from './infillCompute';

type InfillDeletedState = {
  infill: InfillLineItem;
  index: number;
  expiresAt: number;
  draft?: InfillDraftEntry;
};

type DeleteInfillStateInput = {
  infill: InfillLineItem;
  index: number;
  nextSelectionId: string | null;
};

export function useCalculatorInfillController({ items }: { items: readonly InfillLineItem[] }) {
  const [infillsOpen, setInfillsOpen] = useState(false);
  const [selectedInfillId, setSelectedInfillId] = useState<string | null>(null);
  const [pendingInfillSelectionId, setPendingInfillSelectionId] = useState<string | null>(null);
  const [infillDraftById, setInfillDraftById] = useState<Record<string, InfillDraftEntry>>({});
  const [infillStage, setInfillStage] = useState<InfillConfiguratorStage>('opening');
  const [deletedInfill, setDeletedInfill] = useState<InfillDeletedState | null>(null);
  const [infillDuplicateOpen, setInfillDuplicateOpen] = useState(false);
  const [infillCostDetailsOpen, setInfillCostDetailsOpen] = useState(false);
  const infillRowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const infillListContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pendingInfillSelectionId) return;
    if (!items.some((item) => item.id === pendingInfillSelectionId)) return;
    setSelectedInfillId(pendingInfillSelectionId);
    setPendingInfillSelectionId(null);
  }, [items, pendingInfillSelectionId]);

  useEffect(() => {
    if (!infillsOpen || !selectedInfillId) return;
    const selectedRow = infillRowRefs.current.get(selectedInfillId);
    if (!selectedRow) return;
    selectedRow.scrollIntoView({ block: 'nearest' });
  }, [infillsOpen, items, selectedInfillId]);

  useEffect(() => {
    if (!infillsOpen) return;
    if (pendingInfillSelectionId) return;
    if (!items.length) {
      if (selectedInfillId !== null) setSelectedInfillId(null);
      return;
    }
    if (!selectedInfillId || !items.some((item) => item.id === selectedInfillId)) {
      setSelectedInfillId(items[0].id);
    }
  }, [infillsOpen, items, pendingInfillSelectionId, selectedInfillId]);

  useEffect(() => {
    const validIds = new Set(items.map((item) => item.id));
    setInfillDraftById((previous) => {
      let changed = false;
      const next: Record<string, InfillDraftEntry> = {};
      Object.entries(previous).forEach(([id, draft]) => {
        if (validIds.has(id)) {
          next[id] = draft;
        } else {
          changed = true;
        }
      });
      return changed ? next : previous;
    });
  }, [items]);

  useEffect(() => {
    if (!deletedInfill) return;
    const remainingMs = deletedInfill.expiresAt - Date.now();
    if (remainingMs <= 0) {
      setDeletedInfill(null);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setDeletedInfill((current) => {
        if (!current) return null;
        return current.expiresAt <= Date.now() ? null : current;
      });
    }, remainingMs);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [deletedInfill]);

  const openInfills = useCallback(() => setInfillsOpen(true), []);

  const closeInfills = useCallback(() => {
    setInfillsOpen(false);
    setInfillCostDetailsOpen(false);
  }, []);

  const selectInfill = useCallback((id: string | null) => {
    setSelectedInfillId(id);
  }, []);

  const requestInfillSelection = useCallback((id: string) => {
    setPendingInfillSelectionId(id);
    setSelectedInfillId(id);
  }, []);

  const setInfillDraftValue = useCallback((infillId: string, field: InfillDraftFieldKey, raw: string) => {
    setInfillDraftById((previous) => {
      const current = previous[infillId] ?? {};
      return { ...previous, [infillId]: { ...current, [field]: raw } };
    });
  }, []);

  const clearInfillDraftField = useCallback((infillId: string, field: InfillDraftFieldKey) => {
    setInfillDraftById((previous) => {
      const current = previous[infillId];
      if (!current || current[field] === undefined) return previous;
      const nextDraft = { ...current };
      delete nextDraft[field];
      const next = { ...previous };
      if (Object.keys(nextDraft).length === 0) {
        delete next[infillId];
      } else {
        next[infillId] = nextDraft;
      }
      return next;
    });
  }, []);

  const clearInfillDraft = useCallback((infillId: string) => {
    setInfillDraftById((previous) => {
      if (!previous[infillId]) return previous;
      const next = { ...previous };
      delete next[infillId];
      return next;
    });
  }, []);

  const getInfillDraftValue = useCallback(
    (infill: InfillLineItem, field: InfillDraftFieldKey): string => {
      const override = infillDraftById[infill.id]?.[field];
      if (typeof override === 'string') return override;
      if (field === 'widthM') return infill.shape.widthM;
      if (field === 'heightM') return infill.shape.type === 'rect' ? infill.shape.heightM : '';
      if (field === 'heightLowM') return infill.shape.type === 'mono_slope' ? infill.shape.heightLowM : '';
      return infill.shape.type === 'mono_slope' ? infill.shape.heightHighM : '';
    },
    [infillDraftById],
  );

  const deleteInfillState = useCallback(
    ({ infill, index, nextSelectionId }: DeleteInfillStateInput) => {
      const deletedDraft = infillDraftById[infill.id];
      if (selectedInfillId === infill.id) setSelectedInfillId(nextSelectionId);
      clearInfillDraft(infill.id);
      setDeletedInfill({
        infill,
        index,
        expiresAt: Date.now() + INFILL_DELETE_UNDO_MS,
        draft: deletedDraft,
      });
    },
    [clearInfillDraft, infillDraftById, selectedInfillId],
  );

  const restoreDeletedInfill = useCallback((): InfillDeletedState | null => {
    if (!deletedInfill) return null;
    if (deletedInfill.draft) {
      setInfillDraftById((previous) => ({
        ...previous,
        [deletedInfill.infill.id]: deletedInfill.draft as InfillDraftEntry,
      }));
    }
    requestInfillSelection(deletedInfill.infill.id);
    setInfillStage('opening');
    setDeletedInfill(null);
    return deletedInfill;
  }, [deletedInfill, requestInfillSelection]);

  const setInfillRowRef = useCallback((id: string, node: HTMLButtonElement | null) => {
    if (node) infillRowRefs.current.set(id, node);
    else infillRowRefs.current.delete(id);
  }, []);

  const openInfillDuplicate = useCallback(() => setInfillDuplicateOpen(true), []);
  const closeInfillDuplicate = useCallback(() => setInfillDuplicateOpen(false), []);

  return {
    infillsOpen,
    openInfills,
    closeInfills,
    selectedInfillId,
    selectInfill,
    requestInfillSelection,
    infillDraftById,
    setInfillDraftValue,
    clearInfillDraftField,
    clearInfillDraft,
    getInfillDraftValue,
    infillStage,
    setInfillStage,
    deletedInfill,
    deleteInfillState,
    restoreDeletedInfill,
    infillDuplicateOpen,
    openInfillDuplicate,
    closeInfillDuplicate,
    infillCostDetailsOpen,
    setInfillCostDetailsOpen,
    infillListContainerRef,
    setInfillRowRef,
  };
}
