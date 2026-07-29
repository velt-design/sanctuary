'use client';

import { apiJson } from '@/lib/repo/apiClient';
import type {
  AdminProjectWorkCommandResponse,
  ConfirmationCorrectionInput,
  ConfirmationCorrectionResult,
  ConfirmationCorrectionReviewInput,
  ConfirmationCorrectionReviewResult,
  LegacyContactedMigrationInput,
  LegacyContactedMigrationResult,
  LegacyContactedCursor,
  LegacyContactedReview,
  LegacyContactedScope,
} from './types';

export function fetchLegacyContactedReview(input: {
  scope: LegacyContactedScope;
  limit?: number;
  cursor?: LegacyContactedCursor | null;
}): Promise<LegacyContactedReview> {
  const params = new URLSearchParams({
    scope: input.scope,
    limit: String(input.limit ?? 50),
  });
  if (input.cursor) params.set('cursor', JSON.stringify(input.cursor));
  return apiJson(`/api/admin/project-work/legacy-contacted?${params.toString()}`);
}

export function migrateLegacyContactedProject(
  projectId: string,
  input: LegacyContactedMigrationInput,
): Promise<AdminProjectWorkCommandResponse<LegacyContactedMigrationResult>> {
  return apiJson(
    `/api/admin/project-work/legacy-contacted/${encodeURIComponent(projectId)}/migrate`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

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
