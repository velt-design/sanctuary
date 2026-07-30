import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { appIdFromUuid, isUuid } from '@/lib/supabase/mappers';
import {
  LEGACY_CONTACTED_RECOMMENDATIONS,
  type LegacyContactedCursor,
  type LegacyContactedEvidence,
  type LegacyContactedProject,
  type LegacyContactedReasonCode,
  type LegacyContactedRecommendation,
  type LegacyContactedReview,
  type LegacyContactedScope,
} from './types';

type Row = Record<string, unknown>;

function record(value: unknown): Row {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Row;
  }
  return {};
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function isoInstant(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  const parsed = new Date(candidate);
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
}

function integer(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function bool(value: unknown): boolean {
  return value === true;
}

function recommendation(value: unknown): LegacyContactedRecommendation {
  const candidate = text(value);
  if (
    candidate
    && LEGACY_CONTACTED_RECOMMENDATIONS.includes(
      candidate as LegacyContactedRecommendation,
    )
  ) {
    return candidate as LegacyContactedRecommendation;
  }
  throw new Error('Legacy Contacted classifier returned an unknown recommendation');
}

function mapEvidence(value: unknown): LegacyContactedEvidence {
  const row = record(value);
  return {
    currentQuote: bool(row.currentQuote),
    currentInvoice: bool(row.currentInvoice),
    currentDesign: bool(row.currentDesign),
    currentSchedule: bool(row.currentSchedule),
    runningJob: bool(row.runningJob),
    openObligation: bool(row.openObligation),
    sentEmail: bool(row.sentEmail),
  };
}

function mapProject(value: unknown): LegacyContactedProject {
  const row = record(value);
  const projectUuid = text(row.projectId);
  const projectName = text(row.projectName);
  const updatedAt = isoInstant(row.updatedAt);
  const evidenceFingerprint = text(row.evidenceFingerprint)?.toLowerCase();
  if (
    !projectUuid
    || !isUuid(projectUuid)
    || !projectName
    || !updatedAt
    || !evidenceFingerprint
    || !/^[0-9a-f]{64}$/.test(evidenceFingerprint)
  ) {
    throw new Error('Legacy Contacted classifier returned an incomplete project');
  }
  return {
    projectId: appIdFromUuid('proj', projectUuid),
    projectName,
    pipelineStage: text(row.pipelineStage) ?? 'contacted',
    updatedAt,
    evidenceFingerprint,
    followUpDate: text(row.followUpDate),
    recommendation: recommendation(row.recommendation),
    reasonCodes: Array.isArray(row.reasonCodes)
      ? row.reasonCodes
          .map(text)
          .filter((entry): entry is LegacyContactedReasonCode => entry !== null)
      : [],
    evidence: mapEvidence(row.evidence),
  };
}

function mapCursor(value: unknown): LegacyContactedCursor | null {
  const row = record(value);
  const dueRank = Number(row.dueRank);
  const updatedAt = isoInstant(row.updatedAt);
  const projectId = text(row.projectId);
  const scope = text(row.scope);
  if (
    !Number.isInteger(dueRank)
    || !updatedAt
    || !projectId
    || !isUuid(projectId)
    || (scope !== 'due' && scope !== 'all')
  ) {
    return null;
  }
  return {
    dueRank,
    followUpDate: text(row.followUpDate),
    updatedAt,
    projectId,
    scope,
  };
}

export async function getLegacyContactedReview(
  supabase: SupabaseClient,
  input: {
    asOf?: string | null;
    limit?: number;
    cursor?: LegacyContactedCursor | null;
    scope?: LegacyContactedScope;
  } = {},
): Promise<LegacyContactedReview> {
  const result = await supabase.rpc('project_work_classify_legacy_contacted_v1', {
    p_as_of: input.asOf ?? null,
    p_limit: input.limit ?? 50,
    p_cursor: input.cursor ?? null,
    p_scope: input.scope ?? 'due',
  });
  if (result.error) {
    throw Object.assign(
      new Error(result.error.message ?? 'Failed to classify old Contacted projects'),
      result.error,
    );
  }

  const payload = record(Array.isArray(result.data) ? result.data[0] : result.data);
  const summary = record(payload.summary);
  const byRecommendation = record(summary.byRecommendation);
  const generatedAt = isoInstant(payload.generatedAt);
  if (!generatedAt) {
    throw new Error('Legacy Contacted classifier returned no generation time');
  }

  return {
    projects: Array.isArray(payload.projects) ? payload.projects.map(mapProject) : [],
    summary: {
      total: integer(summary.total),
      due: integer(summary.due),
      archived: integer(summary.archived),
      byRecommendation: {
        ACTIVE_EVIDENCE: integer(byRecommendation.ACTIVE_EVIDENCE),
        WAITING_CANDIDATE: integer(byRecommendation.WAITING_CANDIDATE),
        LOST_NO_RESPONSE_CANDIDATE: integer(
          byRecommendation.LOST_NO_RESPONSE_CANDIDATE,
        ),
        MANUAL_CLASSIFICATION: integer(
          byRecommendation.MANUAL_CLASSIFICATION,
        ),
      },
    },
    generatedAt,
    nextCursor: mapCursor(payload.nextCursor),
  };
}
