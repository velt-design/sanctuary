import 'server-only';

import { isUuid } from '@/lib/supabase/mappers';
import type {
  ConfirmationCorrectionInput,
  ConfirmationCorrectionReviewInput,
} from './types';

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseConfirmationCorrectionBody(
  value: unknown,
): ValidationResult<ConfirmationCorrectionInput> {
  const body = record(value);
  if (!body) return { ok: false, error: 'A correction is required.' };
  const projectId = text(body.projectId);
  const commandId = text(body.commandId);
  const confirmationEventId = text(body.confirmationEventId);
  const reason = text(body.reason);
  if (!projectId) return { ok: false, error: 'Project is required.' };
  if (!commandId || !isUuid(commandId)) {
    return { ok: false, error: 'A valid command id is required.' };
  }
  if (!confirmationEventId || !isUuid(confirmationEventId)) {
    return { ok: false, error: 'Choose a valid confirmation.' };
  }
  if (!reason || reason.length > 1000) {
    return {
      ok: false,
      error: 'Record a correction reason of 1 to 1000 characters.',
    };
  }
  return {
    ok: true,
    value: { projectId, commandId, confirmationEventId, reason },
  };
}

export function parseConfirmationCorrectionReviewBody(
  value: unknown,
): ValidationResult<ConfirmationCorrectionReviewInput> {
  const body = record(value);
  if (!body) return { ok: false, error: 'A correction review is required.' };
  const projectId = text(body.projectId);
  const repairSignalId = text(body.repairSignalId);
  const expectedSignalRowVersion = positiveInteger(
    body.expectedSignalRowVersion,
  );
  const commandId = text(body.commandId);
  const reason = text(body.reason);
  if (!projectId) return { ok: false, error: 'Project is required.' };
  if (!repairSignalId || !isUuid(repairSignalId)) {
    return { ok: false, error: 'A valid correction review signal is required.' };
  }
  if (!expectedSignalRowVersion) {
    return {
      ok: false,
      error: 'The reviewed correction signal version is required.',
    };
  }
  if (!commandId || !isUuid(commandId)) {
    return { ok: false, error: 'A valid command id is required.' };
  }
  if (!reason || reason.length > 1000) {
    return {
      ok: false,
      error: 'Record a review reason of 1 to 1000 characters.',
    };
  }
  return {
    ok: true,
    value: {
      projectId,
      repairSignalId,
      expectedSignalRowVersion,
      commandId,
      reason,
    },
  };
}
