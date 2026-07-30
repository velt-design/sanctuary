import "server-only";

import { isUuid } from "@/lib/supabase/mappers";
import {
  LEGACY_CONTACTED_CLOSED_OUTCOMES,
  LEGACY_CONTACTED_DISPOSITIONS,
  type ConfirmationCorrectionInput,
  type ConfirmationCorrectionReviewInput,
  type LegacyContactedCursor,
  type LegacyContactedMigrationInput,
  type LegacyContactedScope,
} from "./types";
import { PROJECT_WORK_RESPONSIBILITY_AREAS } from "../types";

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function evidenceFingerprint(value: unknown): string | null {
  const candidate = text(value)?.toLowerCase() ?? null;
  return candidate && /^[0-9a-f]{64}$/.test(candidate) ? candidate : null;
}

function isoInstant(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  const parsed = new Date(candidate);
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
}

function isoDate(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return null;
  const parsed = new Date(`${candidate}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === candidate
    ? candidate
    : null;
}

export function parseLegacyContactedReviewQuery(
  req: Request,
): ValidationResult<{
  asOf: string | null;
  limit: number;
  cursor: LegacyContactedCursor | null;
  scope: LegacyContactedScope;
}> {
  const params = new URL(req.url).searchParams;
  const rawScope = params.get("scope")?.trim().toLowerCase() ?? "due";
  if (rawScope !== "due" && rawScope !== "all") {
    return { ok: false, error: "Scope must be due or all." };
  }

  const rawLimit = params.get("limit");
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return { ok: false, error: "Limit must be between 1 and 100." };
  }

  const rawAsOf = params.get("asOf");
  const asOf = rawAsOf === null ? null : isoDate(rawAsOf);
  if (rawAsOf !== null && !asOf) {
    return { ok: false, error: "asOf must be a calendar date." };
  }

  let cursor: LegacyContactedCursor | null = null;
  const rawCursor = params.get("cursor");
  if (rawCursor) {
    try {
      const parsed = record(JSON.parse(rawCursor));
      const dueRank = Number(parsed?.dueRank);
      const updatedAt = isoInstant(parsed?.updatedAt);
      const projectId = text(parsed?.projectId);
      const cursorScope = text(parsed?.scope);
      const followUpRaw = parsed?.followUpDate;
      const followUpDate =
        followUpRaw === null || followUpRaw === undefined
          ? null
          : isoDate(followUpRaw);
      if (
        !parsed ||
        !Number.isInteger(dueRank) ||
        dueRank < 0 ||
        dueRank > 2 ||
        !updatedAt ||
        !projectId ||
        !isUuid(projectId) ||
        cursorScope !== rawScope ||
        (followUpRaw !== null && followUpRaw !== undefined && !followUpDate)
      ) {
        return { ok: false, error: "Cursor is invalid for this review." };
      }
      cursor = {
        dueRank,
        followUpDate,
        updatedAt,
        projectId,
        scope: rawScope,
      };
    } catch {
      return { ok: false, error: "Cursor is invalid for this review." };
    }
  }

  return {
    ok: true,
    value: { asOf, limit, cursor, scope: rawScope },
  };
}

export function parseLegacyContactedMigrationBody(
  value: unknown,
): ValidationResult<LegacyContactedMigrationInput> {
  const body = record(value);
  if (!body) return { ok: false, error: "A review decision is required." };

  const commandId = text(body.commandId);
  const expectedUpdatedAt = isoInstant(body.expectedUpdatedAt);
  const expectedEvidenceFingerprint = evidenceFingerprint(
    body.expectedEvidenceFingerprint,
  );
  const disposition = text(body.disposition)?.toUpperCase();
  const reason = text(body.reason);
  if (!commandId || !isUuid(commandId)) {
    return { ok: false, error: "A valid command id is required." };
  }
  if (!expectedUpdatedAt) {
    return { ok: false, error: "The reviewed project version is required." };
  }
  if (!expectedEvidenceFingerprint) {
    return {
      ok: false,
      error: "The reviewed evidence fingerprint is required.",
    };
  }
  if (
    !disposition ||
    !LEGACY_CONTACTED_DISPOSITIONS.includes(
      disposition as (typeof LEGACY_CONTACTED_DISPOSITIONS)[number],
    )
  ) {
    return { ok: false, error: "Choose a valid reviewed disposition." };
  }
  if (!reason || reason.length > 1000) {
    return { ok: false, error: "Record a reason of 1 to 1000 characters." };
  }

  const title = text(body.title);
  const responsibilityArea =
    text(body.responsibilityArea)?.toUpperCase() ?? null;
  const dueAt = isoInstant(body.dueAt);
  const waitingUntil = isoInstant(body.waitingUntil);
  const closedOutcome = text(body.closedOutcome)?.toUpperCase() ?? null;

  if (
    disposition === "ACTIVE_WORK" &&
    (!title ||
      title.length > 160 ||
      !responsibilityArea ||
      !PROJECT_WORK_RESPONSIBILITY_AREAS.includes(
        responsibilityArea as (typeof PROJECT_WORK_RESPONSIBILITY_AREAS)[number],
      ) ||
      !dueAt)
  ) {
    return {
      ok: false,
      error: "Active work requires a title, responsibility, and due time.",
    };
  }
  if (
    disposition === "WAITING" &&
    (!waitingUntil || Date.parse(waitingUntil) <= Date.now())
  ) {
    return { ok: false, error: "Waiting requires a future wake-up time." };
  }
  if (
    disposition === "CLOSED" &&
    (!closedOutcome ||
      !LEGACY_CONTACTED_CLOSED_OUTCOMES.includes(
        closedOutcome as (typeof LEGACY_CONTACTED_CLOSED_OUTCOMES)[number],
      ))
  ) {
    return { ok: false, error: "Closed requires a valid outcome." };
  }

  return {
    ok: true,
    value: {
      commandId,
      expectedUpdatedAt,
      expectedEvidenceFingerprint,
      disposition: disposition as LegacyContactedMigrationInput["disposition"],
      reason,
      title: disposition === "ACTIVE_WORK" ? title : null,
      responsibilityArea:
        disposition === "ACTIVE_WORK"
          ? (responsibilityArea as LegacyContactedMigrationInput["responsibilityArea"])
          : null,
      dueAt: disposition === "ACTIVE_WORK" ? dueAt : null,
      waitingUntil: disposition === "WAITING" ? waitingUntil : null,
      closedOutcome:
        disposition === "CLOSED"
          ? (closedOutcome as LegacyContactedMigrationInput["closedOutcome"])
          : null,
    },
  };
}

export function parseConfirmationCorrectionBody(
  value: unknown,
): ValidationResult<ConfirmationCorrectionInput> {
  const body = record(value);
  if (!body) return { ok: false, error: "A correction is required." };
  const projectId = text(body.projectId);
  const commandId = text(body.commandId);
  const confirmationEventId = text(body.confirmationEventId);
  const reason = text(body.reason);
  if (!projectId) return { ok: false, error: "Project is required." };
  if (!commandId || !isUuid(commandId)) {
    return { ok: false, error: "A valid command id is required." };
  }
  if (!confirmationEventId || !isUuid(confirmationEventId)) {
    return { ok: false, error: "Choose a valid confirmation." };
  }
  if (!reason || reason.length > 1000) {
    return {
      ok: false,
      error: "Record a correction reason of 1 to 1000 characters.",
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
  if (!body) return { ok: false, error: "A correction review is required." };
  const projectId = text(body.projectId);
  const repairSignalId = text(body.repairSignalId);
  const expectedSignalRowVersion = positiveInteger(
    body.expectedSignalRowVersion,
  );
  const commandId = text(body.commandId);
  const reason = text(body.reason);
  if (!projectId) return { ok: false, error: "Project is required." };
  if (!repairSignalId || !isUuid(repairSignalId)) {
    return { ok: false, error: "A valid correction review signal is required." };
  }
  if (!expectedSignalRowVersion) {
    return {
      ok: false,
      error: "The reviewed correction signal version is required.",
    };
  }
  if (!commandId || !isUuid(commandId)) {
    return { ok: false, error: "A valid command id is required." };
  }
  if (!reason || reason.length > 1000) {
    return {
      ok: false,
      error: "Record a review reason of 1 to 1000 characters.",
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
