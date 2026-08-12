'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { LocalFirstEntityKey } from '@/lib/localFirst/types';
import type { CalculatorInputs } from '@/lib/types/calculator';
import {
  makeEmptyAddOnCalculatorInputs,
  makeDefaultCalculatorInputs,
  normalizeCalculatorInputsForUi,
  type CalculatorDraftSessionSnapshot,
} from './calculatorInputs';
import {
  calculatorDraftPersistence,
  type CalculatorDraftPersistence,
  type CalculatorDraftRestoreSource,
} from './calculatorDraftPersistence';

export type CalculatorLocalDraftStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'restored'; source: CalculatorDraftRestoreSource }
  | { kind: 'error' };

type UseCalculatorDraftSessionOptions = {
  draftEntityKey: LocalFirstEntityKey;
  draftSessionKey: string;
  awaitsExternalDraft: boolean;
  allowEmptyDesign?: boolean;
  persistence?: CalculatorDraftPersistence;
};

type UseCalculatorDraftSessionResult = {
  values: CalculatorInputs;
  setValues: Dispatch<SetStateAction<CalculatorInputs>>;
  activeModuleIndex: number;
  setActiveModuleIndex: Dispatch<SetStateAction<number>>;
  draftHydrated: boolean;
  restoredFromLocalDraft: boolean;
  localDraftStatus: CalculatorLocalDraftStatus;
  acceptExternalDraft: (values: CalculatorInputs, activeModuleIndex?: number) => void;
};

function draftFingerprint(values: CalculatorInputs, activeModuleIndex: number): string {
  return JSON.stringify({ activeModuleIndex, values });
}

function safeModuleIndex(values: CalculatorInputs, activeModuleIndex: unknown): number {
  const parsed = Number.isFinite(Number(activeModuleIndex)) ? Math.trunc(Number(activeModuleIndex)) : 0;
  return Math.max(0, Math.min(values.modules.length - 1, parsed));
}

export function useCalculatorDraftSession({
  draftEntityKey,
  draftSessionKey,
  awaitsExternalDraft,
  allowEmptyDesign = false,
  persistence = calculatorDraftPersistence,
}: UseCalculatorDraftSessionOptions): UseCalculatorDraftSessionResult {
  const draftKey = `${draftEntityKey}\u0000${draftSessionKey}`;
  const currentDraftKeyRef = useRef(draftKey);
  currentDraftKeyRef.current = draftKey;

  const [values, setValues] = useState<CalculatorInputs>(makeDefaultCalculatorInputs);
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [persistenceReadyKey, setPersistenceReadyKey] = useState<string | null>(null);
  const [restoredKey, setRestoredKey] = useState<string | null>(null);
  const [statusState, setStatusState] = useState<{ key: string; status: CalculatorLocalDraftStatus }>({
    key: draftKey,
    status: { kind: 'idle' },
  });
  const lastScheduledFingerprintRef = useRef<{ key: string; fingerprint: string | null }>({
    key: draftKey,
    fingerprint: null,
  });
  const writeGenerationRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    writeGenerationRef.current += 1;
    setHydratedKey(null);
    setPersistenceReadyKey(null);
    setRestoredKey(null);
    setStatusState({ key: draftKey, status: { kind: 'idle' } });
    lastScheduledFingerprintRef.current = { key: draftKey, fingerprint: null };

    void (async () => {
      let restored = null;
      try {
        restored = await persistence.restore({
          entityKey: draftEntityKey,
          sessionKey: draftSessionKey,
        });
      } catch {
        restored = null;
      }
      if (cancelled || currentDraftKeyRef.current !== draftKey) return;

      if (restored) {
        const normalized = normalizeCalculatorInputsForUi(restored.snapshot.values, { allowEmpty: allowEmptyDesign });
        const nextActiveModuleIndex = safeModuleIndex(normalized, restored.snapshot.activeModuleIndex);
        setValues(normalized);
        setActiveModuleIndex(nextActiveModuleIndex);
        setRestoredKey(draftKey);
        setPersistenceReadyKey(draftKey);
        setStatusState({ key: draftKey, status: { kind: 'restored', source: restored.source } });
        lastScheduledFingerprintRef.current = {
          key: draftKey,
          fingerprint: draftFingerprint(normalized, nextActiveModuleIndex),
        };
      } else if (!awaitsExternalDraft) {
        const initialValues = allowEmptyDesign
          ? makeEmptyAddOnCalculatorInputs()
          : makeDefaultCalculatorInputs();
        setValues(initialValues);
        setActiveModuleIndex(0);
        setPersistenceReadyKey(draftKey);
      }

      setHydratedKey(draftKey);
    })();

    return () => {
      cancelled = true;
    };
  }, [allowEmptyDesign, awaitsExternalDraft, draftEntityKey, draftKey, draftSessionKey, persistence]);

  const acceptExternalDraft = useCallback(
    (externalValues: CalculatorInputs, externalActiveModuleIndex = 0) => {
      if (currentDraftKeyRef.current !== draftKey) return;
      const normalized = normalizeCalculatorInputsForUi(externalValues, { allowEmpty: allowEmptyDesign });
      const nextActiveModuleIndex = safeModuleIndex(normalized, externalActiveModuleIndex);
      setValues(normalized);
      setActiveModuleIndex(nextActiveModuleIndex);
      setRestoredKey(null);
      setPersistenceReadyKey(draftKey);
      setStatusState({ key: draftKey, status: { kind: 'idle' } });
      lastScheduledFingerprintRef.current = { key: draftKey, fingerprint: null };
    },
    [allowEmptyDesign, draftKey],
  );

  useEffect(() => {
    if (hydratedKey !== draftKey || persistenceReadyKey !== draftKey) return;

    const fingerprint = draftFingerprint(values, activeModuleIndex);
    if (
      lastScheduledFingerprintRef.current.key === draftKey &&
      lastScheduledFingerprintRef.current.fingerprint === fingerprint
    ) {
      return;
    }
    lastScheduledFingerprintRef.current = { key: draftKey, fingerprint };

    const snapshot: CalculatorDraftSessionSnapshot = {
      activeModuleIndex,
      updatedAt: Date.now(),
      values,
    };
    const writeGeneration = ++writeGenerationRef.current;
    setStatusState({ key: draftKey, status: { kind: 'saving' } });

    void persistence
      .persist({
        entityKey: draftEntityKey,
        sessionKey: draftSessionKey,
        snapshot,
      })
      .then((result) => {
        if (currentDraftKeyRef.current !== draftKey || writeGenerationRef.current !== writeGeneration) return;
        setStatusState({
          key: draftKey,
          status:
            result.sessionStored || result.workingCopyStored
              ? { kind: 'saved' }
              : { kind: 'error' },
        });
      })
      .catch(() => {
        if (currentDraftKeyRef.current !== draftKey || writeGenerationRef.current !== writeGeneration) return;
        setStatusState({ key: draftKey, status: { kind: 'error' } });
      });
  }, [activeModuleIndex, draftEntityKey, draftKey, draftSessionKey, hydratedKey, persistence, persistenceReadyKey, values]);

  useEffect(() => {
    setActiveModuleIndex((current) => Math.min(current, Math.max(0, values.modules.length - 1)));
  }, [values.modules.length]);

  return {
    values,
    setValues,
    activeModuleIndex,
    setActiveModuleIndex,
    draftHydrated: hydratedKey === draftKey,
    restoredFromLocalDraft: restoredKey === draftKey,
    localDraftStatus: statusState.key === draftKey ? statusState.status : { kind: 'idle' },
    acceptExternalDraft,
  };
}
