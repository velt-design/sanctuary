'use client';

import type { CostInputsV1, MaterialsExplainV1 } from '@sp/costing';
import { useEffect, useMemo, useState } from 'react';

type MaterialsExplainApiResponse = {
  output: {
    materials: {
      lines: Array<{
        id: string;
        label: string;
        unit: string;
        qty: number;
        unit_cost_ex_gst: number;
        line_cost_ex_gst: number;
      }>;
    };
  };
  materials_explain: MaterialsExplainV1;
};

export function useCalculatorMaterialsDebug({
  available,
  isAdvancedUi,
  activeModuleIndex,
  readyToCalculate,
  activeModulePayload,
  onSuccess,
  onError,
}: {
  available: boolean;
  isAdvancedUi: boolean;
  activeModuleIndex: number;
  readyToCalculate: boolean;
  activeModulePayload: CostInputsV1 | null;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [detail, setDetail] = useState<'summary' | 'full'>('summary');
  const [focusLineIndex, setFocusLineIndex] = useState<number | null>(null);
  const [data, setData] = useState<MaterialsExplainApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFocusLineIndex(null);
  }, [activeModuleIndex]);

  useEffect(() => {
    if (available) return;
    setEnabled(false);
    setData(null);
    setError(null);
  }, [available]);

  useEffect(() => {
    if (isAdvancedUi) return;
    setEnabled(false);
  }, [isAdvancedUi]);

  useEffect(() => {
    if (!enabled || !available || !readyToCalculate || !activeModulePayload) {
      setLoading(false);
      if (!enabled) {
        setData(null);
        setError(null);
      }
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set('detail', detail);
        if (focusLineIndex !== null) params.set('focus_line_index', String(focusLineIndex));

        const response = await fetch(`/api/staff/costing/v1/materials-explain?${params.toString()}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(activeModulePayload),
          signal: controller.signal,
        });
        const json = await response.json();
        if (!response.ok) throw new Error(String(json?.error ?? 'Materials explain failed'));
        setData(json as MaterialsExplainApiResponse);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(requestError instanceof Error ? requestError.message : 'Materials explain failed');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [activeModulePayload, available, detail, enabled, focusLineIndex, readyToCalculate]);

  const materialsExplain = data?.materials_explain ?? null;
  const materialsLines = data?.output.materials.lines ?? [];
  const selectedExplainLine =
    focusLineIndex !== null && focusLineIndex >= 0
      ? materialsExplain?.lines[String(focusLineIndex)] ?? null
      : null;
  const selectedMaterialLine =
    focusLineIndex !== null && focusLineIndex >= 0
      ? materialsLines[focusLineIndex] ?? null
      : null;
  const materialsExplainJson = useMemo(
    () => (materialsExplain ? JSON.stringify(materialsExplain, null, 2) : ''),
    [materialsExplain],
  );
  const selectedExplainJson = useMemo(
    () => (selectedExplainLine ? JSON.stringify(selectedExplainLine, null, 2) : ''),
    [selectedExplainLine],
  );

  const copyJson = async () => {
    if (!materialsExplainJson) return;
    try {
      await navigator.clipboard.writeText(materialsExplainJson);
      onSuccess('Materials trace JSON copied.');
    } catch {
      onError('Failed to copy materials trace JSON.');
    }
  };

  const downloadJson = () => {
    if (!materialsExplainJson) return;
    try {
      const blob = new Blob([materialsExplainJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `materials-explain-${Date.now()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      onError('Failed to download materials trace JSON.');
    }
  };

  return {
    available,
    enabled,
    setEnabled,
    detail,
    setDetail,
    focusLineIndex,
    setFocusLineIndex,
    loading,
    error,
    materialsExplain,
    materialsLines,
    selectedExplainLine,
    selectedMaterialLine,
    selectedExplainJson,
    copyJson,
    downloadJson,
  };
}

export type CalculatorMaterialsDebugController = ReturnType<typeof useCalculatorMaterialsDebug>;
