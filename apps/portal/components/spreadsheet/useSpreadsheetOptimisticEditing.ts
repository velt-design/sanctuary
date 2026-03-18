'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast/ToastProvider';
import type {
  SpreadsheetAdapter,
  SpreadsheetOptimisticEditOutcome,
  SpreadsheetPreparedOptimisticEdit,
} from './types';

type QueuedSpreadsheetEdit<TEditableKey extends string, TConfirmedModel> = {
  rowId: string;
  cellId: string;
  key: TEditableKey;
  edit: SpreadsheetPreparedOptimisticEdit<TConfirmedModel>;
};

type PendingSpreadsheetModelState<TEditableKey extends string, TConfirmedModel> = {
  confirmedModel: TConfirmedModel;
  queue: Array<QueuedSpreadsheetEdit<TEditableKey, TConfirmedModel>>;
  running: boolean;
};

function setInRecord(record: Record<string, boolean>, key: string, value: boolean): Record<string, boolean> {
  if (value) return { ...record, [key]: true };
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

export function useSpreadsheetOptimisticEditing<
  TRow,
  TKey extends string,
  TEditableKey extends TKey,
  TEditorValue,
  TConfirmedModel,
>(
  adapter: SpreadsheetAdapter<TRow, TKey, TEditableKey, TEditorValue, TConfirmedModel>,
): {
  savingCells: Record<string, boolean>;
  conflictCells: Record<string, boolean>;
  commitEdit: (row: TRow, key: TEditableKey, value: TEditorValue) => Promise<boolean>;
} | null {
  const controller = adapter.optimisticEditing;
  const toast = useToast();
  const [savingCellCounts, setSavingCellCounts] = useState<Record<string, number>>({});
  const [conflictCells, setConflictCells] = useState<Record<string, boolean>>({});
  const pendingModelsRef = useRef(new Map<string, PendingSpreadsheetModelState<TEditableKey, TConfirmedModel>>());
  const conflictTimersRef = useRef(new Map<string, number>());

  const conflictDurationMs = controller?.conflictDurationMs ?? 4000;

  const savingCells = useMemo<Record<string, boolean>>(
    () => Object.fromEntries(Object.keys(savingCellCounts).map((id) => [id, true])),
    [savingCellCounts],
  );

  useEffect(() => {
    return () => {
      for (const handle of conflictTimersRef.current.values()) {
        window.clearTimeout(handle);
      }
      conflictTimersRef.current.clear();
    };
  }, []);

  const changeSavingCellCount = useCallback((id: string, delta: number) => {
    setSavingCellCounts((prev) => {
      const nextCount = Math.max(0, (prev[id] ?? 0) + delta);
      if (nextCount === (prev[id] ?? 0)) return prev;
      const next = { ...prev };
      if (nextCount > 0) next[id] = nextCount;
      else delete next[id];
      return next;
    });
  }, []);

  const clearConflictLater = useCallback(
    (id: string) => {
      const existing = conflictTimersRef.current.get(id);
      if (typeof existing === 'number') {
        window.clearTimeout(existing);
      }
      const handle = window.setTimeout(() => {
        setConflictCells((prev) => setInRecord(prev, id, false));
        conflictTimersRef.current.delete(id);
      }, conflictDurationMs);
      conflictTimersRef.current.set(id, handle);
    },
    [conflictDurationMs],
  );

  const applyQueuedModel = useCallback(
    (confirmedModel: TConfirmedModel, queue: Array<QueuedSpreadsheetEdit<TEditableKey, TConfirmedModel>>) =>
      queue.reduce((currentModel, queuedEdit) => queuedEdit.edit.applyToModel(currentModel), confirmedModel),
    [],
  );

  const syncDisplayedModel = useCallback(
    (queueKey: string) => {
      if (!controller) return;
      const state = pendingModelsRef.current.get(queueKey);
      if (!state) return;
      const displayedModel = state.queue.length ? applyQueuedModel(state.confirmedModel, state.queue) : state.confirmedModel;
      controller.displayModel(queueKey, displayedModel);
    },
    [applyQueuedModel, controller],
  );

  const processQueuedModel = useCallback(
    (queueKey: string) => {
      if (!controller) return;
      const existing = pendingModelsRef.current.get(queueKey);
      if (!existing || existing.running) return;
      existing.running = true;

      void (async () => {
        try {
          while (true) {
            const state = pendingModelsRef.current.get(queueKey);
            if (!state || !state.queue.length) break;

            const queuedEdit = state.queue[0];
            const outcome = await queuedEdit.edit.persist(state.confirmedModel);

            state.queue.shift();
            changeSavingCellCount(queuedEdit.cellId, -1);

            if (outcome.confirmedModel !== undefined) {
              state.confirmedModel = outcome.confirmedModel;
            }

            if (outcome.conflict) {
              setConflictCells((prev) => setInRecord(prev, queuedEdit.cellId, true));
              clearConflictLater(queuedEdit.cellId);
            }

            if (outcome.message) {
              toast.error(outcome.message);
            }

            await controller.onEditOutcome?.({
              rowId: queuedEdit.rowId,
              cellId: queuedEdit.cellId,
              key: queuedEdit.key,
              queueKey,
              outcome,
              confirmedModel: state.confirmedModel,
            });

            if (state.queue.length) {
              syncDisplayedModel(queueKey);
            } else {
              controller.displayModel(queueKey, state.confirmedModel);
            }
          }
        } finally {
          const state = pendingModelsRef.current.get(queueKey);
          if (state) {
            state.running = false;
            if (!state.queue.length) {
              pendingModelsRef.current.delete(queueKey);
            } else {
              processQueuedModel(queueKey);
            }
          }
        }
      })();
    },
    [changeSavingCellCount, clearConflictLater, controller, syncDisplayedModel, toast],
  );

  const commitEdit = useCallback(
    async (row: TRow, key: TEditableKey, value: TEditorValue): Promise<boolean> => {
      if (!controller) {
        if (!adapter.commitEdit) return false;
        return adapter.commitEdit(row, key, value);
      }

      const rowId = adapter.getRowId(row);
      const cellId = `${rowId}:${key}`;
      const queueKey = controller.getQueueKey?.(rowId, row) ?? rowId;
      const existingState = pendingModelsRef.current.get(queueKey);
      const confirmedModel =
        existingState?.confirmedModel ??
        controller.getLatestConfirmedModel({
          rowId,
          row,
        });

      if (confirmedModel === null) {
        toast.error('This row could not be prepared for editing.');
        return false;
      }

      const displayedModel = existingState ? applyQueuedModel(confirmedModel, existingState.queue) : confirmedModel;
      const prepared = controller.prepareEdit({
        row,
        rowId,
        cellId,
        key,
        value,
        confirmedModel,
        displayedModel,
      });

      if (prepared.kind === 'error') {
        toast.error(prepared.message);
        return false;
      }

      if (prepared.kind === 'noop') {
        return true;
      }

      setConflictCells((prev) => setInRecord(prev, cellId, false));

      const state = pendingModelsRef.current.get(queueKey);
      if (state) {
        if (!state.queue.length) {
          state.confirmedModel = confirmedModel;
        }
        state.queue.push({ rowId, cellId, key, edit: prepared.edit });
      } else {
        pendingModelsRef.current.set(queueKey, {
          confirmedModel,
          queue: [{ rowId, cellId, key, edit: prepared.edit }],
          running: false,
        });
      }

      changeSavingCellCount(cellId, 1);
      syncDisplayedModel(queueKey);
      processQueuedModel(queueKey);
      return true;
    },
    [adapter, applyQueuedModel, changeSavingCellCount, controller, processQueuedModel, syncDisplayedModel, toast],
  );

  if (!controller) return null;

  return {
    savingCells,
    conflictCells,
    commitEdit,
  };
}
