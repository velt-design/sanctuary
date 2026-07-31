'use client';

import { apiJson } from '@/lib/repo/apiClient';
import type {
  AdminProjectWorkCommandResponse,
  ConfirmationCorrectionInput,
  ConfirmationCorrectionResult,
  ConfirmationCorrectionReviewInput,
  ConfirmationCorrectionReviewResult,
} from './types';

export function correctProjectConfirmation(
  input: ConfirmationCorrectionInput,
): Promise<AdminProjectWorkCommandResponse<ConfirmationCorrectionResult>> {
  return apiJson('/api/admin/project-work/confirmations/correct', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function reconcileProjectConfirmationCorrection(
  input: ConfirmationCorrectionReviewInput,
): Promise<AdminProjectWorkCommandResponse<ConfirmationCorrectionReviewResult>> {
  return apiJson('/api/admin/project-work/confirmations/reconcile', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
