'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useState } from 'react';

import type { BlindLineItem, CalculatorInputs } from '@/lib/types/calculator';
import {
  makeBlindId,
  makeDefaultBlindItem,
  normalizeBlindsStateForUi,
} from './calculatorInputs';
import {
  formatBlindMetresInput,
  parseBlindMetresInputToMmString,
} from './calculatorBlindUi';

type BlindDimensionField = 'widthMm' | 'coverLengthMm';

type UseCalculatorBlindsControllerOptions = {
  values: CalculatorInputs;
  setValues: Dispatch<SetStateAction<CalculatorInputs>>;
};

function blindDimensionDraftKey(id: string, field: BlindDimensionField): string {
  return `${id}:${field}`;
}

export function useCalculatorBlindsController({
  values,
  setValues,
}: UseCalculatorBlindsControllerOptions) {
  const [dimensionDraftsM, setDimensionDraftsM] = useState<Record<string, string>>({});
  const state = normalizeBlindsStateForUi(values.blinds);

  useEffect(() => {
    if (values.blinds !== state) {
      setValues((prev) => ({ ...prev, blinds: state }));
    }
  }, [setValues, state, values.blinds]);

  useEffect(() => {
    setDimensionDraftsM((prev) => {
      const validKeys = new Set(
        state.items.flatMap((item) => [
          blindDimensionDraftKey(item.id, 'widthMm'),
          blindDimensionDraftKey(item.id, 'coverLengthMm'),
        ]),
      );
      const nextEntries = Object.entries(prev).filter(([key]) => validKeys.has(key));
      if (nextEntries.length === Object.keys(prev).length) return prev;
      return Object.fromEntries(nextEntries);
    });
  }, [state.items]);

  const setItem = (id: string, patch: Partial<BlindLineItem>) => {
    setValues((prev) => {
      const current = normalizeBlindsStateForUi(prev.blinds);
      const items = current.items.map((item) => (item.id === id ? { ...item, ...patch } : item));
      return { ...prev, blinds: { items } };
    });
  };

  const updateDimensionInput = (
    id: string,
    field: BlindDimensionField,
    nextMetresValue: string,
  ) => {
    const draftKey = blindDimensionDraftKey(id, field);
    setDimensionDraftsM((prev) => {
      if (prev[draftKey] === nextMetresValue) return prev;
      return { ...prev, [draftKey]: nextMetresValue };
    });
    setItem(id, {
      [field]: parseBlindMetresInputToMmString(nextMetresValue),
    } as Pick<BlindLineItem, BlindDimensionField>);
  };

  const commitDimensionInput = (id: string, field: BlindDimensionField) => {
    const draftKey = blindDimensionDraftKey(id, field);
    setDimensionDraftsM((prev) => {
      if (!(draftKey in prev)) return prev;
      const next = { ...prev };
      delete next[draftKey];
      return next;
    });
  };

  const displayDimensionInput = (item: BlindLineItem, field: BlindDimensionField) => {
    const draftKey = blindDimensionDraftKey(item.id, field);
    return dimensionDraftsM[draftKey] ?? formatBlindMetresInput(item[field]);
  };

  const add = (seed?: Partial<BlindLineItem>) => {
    setValues((prev) => {
      const current = normalizeBlindsStateForUi(prev.blinds);
      const nextItem = makeDefaultBlindItem(seed);
      return { ...prev, blinds: { items: [...current.items, nextItem] } };
    });
  };

  const duplicate = (id: string) => {
    const current = state.items.find((item) => item.id === id);
    if (!current) return;
    add({
      ...current,
      id: makeBlindId(),
      label: current.label ? `${current.label} (copy)` : undefined,
    });
  };

  const remove = (id: string) => {
    setValues((prev) => {
      const current = normalizeBlindsStateForUi(prev.blinds);
      const items = current.items.filter((item) => item.id !== id);
      return { ...prev, blinds: { items } };
    });
  };

  return {
    state,
    setItem,
    updateDimensionInput,
    commitDimensionInput,
    displayDimensionInput,
    add,
    duplicate,
    remove,
  };
}
