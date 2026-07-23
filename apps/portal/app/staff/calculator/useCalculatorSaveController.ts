'use client';

import { useState } from 'react';

import type { DesignRequestPriorityTier } from '@/lib/designPackages/types';
import type { EstimateDetail } from '@/lib/estimates/types';
import type { CalculatorResultFreshness } from './calculatorResultFreshness';
import {
  saveCalculatorEstimate,
  type CalculatorEstimateSaveOutcome,
} from './calculatorEstimateSave';
import { resolveGenerateDesignPreflight } from './calculatorQuoteStatusUi';

export type CalculatorSaveContext = Omit<
  Parameters<typeof saveCalculatorEstimate>[0],
  'callbacks' | 'request'
>;

type CalculatorSaveEstimate = typeof saveCalculatorEstimate;

export function useCalculatorSaveController({
  saveContext,
  suggestedDesignRequestTier,
  preflight,
  setLoadedEstimateDetail,
  onError,
  onSaved,
  saveEstimate = saveCalculatorEstimate,
}: {
  saveContext: CalculatorSaveContext;
  suggestedDesignRequestTier: DesignRequestPriorityTier;
  preflight: {
    projectId: string;
    hasProject: boolean;
    readyToCalculate: boolean;
    hasStatusBlockers: boolean;
    resultFreshness: CalculatorResultFreshness;
  };
  setLoadedEstimateDetail: (estimate: EstimateDetail) => void;
  onError: (message: string) => void;
  onSaved: (outcome: CalculatorEstimateSaveOutcome) => void;
  saveEstimate?: CalculatorSaveEstimate;
}) {
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAcknowledgeWarnings, setConfirmAcknowledgeWarnings] = useState(false);
  const [pricingPreserveReason, setPricingPreserveReason] = useState('');
  const [confirmRequestDesign, setConfirmRequestDesign] = useState(false);
  const [confirmRequestDesignPriority, setConfirmRequestDesignPriority] =
    useState<DesignRequestPriorityTier>('UNPRICED');
  const [saveOutcome, setSaveOutcome] = useState<CalculatorEstimateSaveOutcome | null>(null);

  const openSaveConfirmation = () => {
    setGenerateError(null);
    const result = resolveGenerateDesignPreflight(preflight);
    if (result.kind === 'error') {
      setGenerateError(result.message);
      return;
    }
    setConfirmAcknowledgeWarnings(false);
    setConfirmRequestDesign(false);
    setConfirmRequestDesignPriority(suggestedDesignRequestTier);
    setConfirmOpen(true);
  };

  const closeSaveConfirmation = () => {
    setConfirmOpen(false);
    setPricingPreserveReason('');
    setGenerateError(null);
  };

  const setConfirmRequestDesignChecked = (checked: boolean) => {
    setConfirmRequestDesign(checked);
    if (checked) setConfirmRequestDesignPriority(suggestedDesignRequestTier);
  };

  const saveDesign = async ({
    createDesignRequest = null,
    saveMode,
    preserveReason,
  }: Parameters<CalculatorSaveEstimate>[0]['request'] = {}) => {
    setGenerateError(null);
    const outcome = await saveEstimate({
      ...saveContext,
      callbacks: {
        fail: (message) => {
          setGenerateError(message);
          onError(message);
        },
        setGenerating: setIsGenerating,
        setLoadedEstimateDetail,
      },
      request: {
        createDesignRequest,
        saveMode,
        preserveReason,
      },
    });
    if (!outcome) return;
    setConfirmOpen(false);
    setSaveOutcome(outcome);
    onSaved(outcome);
  };

  const saveConfirmed = () =>
    saveDesign({
      createDesignRequest: confirmRequestDesign
        ? { priorityTier: confirmRequestDesignPriority }
        : null,
      saveMode: saveContext.isEditingDesign ? 'preserve_current' : 'reprice_latest',
      preserveReason: saveContext.isEditingDesign ? pricingPreserveReason : undefined,
    });

  const repriceLatest = () => saveDesign({ saveMode: 'reprice_latest' });
  const dismissSaveOutcome = () => setSaveOutcome(null);

  return {
    generateError,
    isGenerating,
    generateLabel: isGenerating ? 'Saving…' : 'Save',
    openSaveConfirmation,
    confirmOpen,
    closeSaveConfirmation,
    confirmAcknowledgeWarnings,
    setConfirmAcknowledgeWarnings,
    pricingPreserveReason,
    setPricingPreserveReason,
    confirmRequestDesign,
    setConfirmRequestDesignChecked,
    confirmRequestDesignPriority,
    setConfirmRequestDesignPriority,
    saveConfirmed,
    repriceLatest,
    saveOutcome,
    dismissSaveOutcome,
  };
}
