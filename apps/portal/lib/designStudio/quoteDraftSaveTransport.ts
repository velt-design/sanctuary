"use client";

import { get, update } from "idb-keyval";
import { getLocalFirstStoreOwner } from "@/lib/localFirst/store";
import { ApiError, apiJson } from "@/lib/repo/apiClient";
import { isStudioObject } from "./contracts";
import {
  studioPriceDigest,
  studioPriceExactKeys,
  studioPriceTimestamp,
  studioPriceUuid,
} from "./pricedCandidate";
import { parseStudioQuoteDraftCommand } from "./quoteDraftCommand";
type StudioQuoteDraftCommand = Extract<
  ReturnType<typeof parseStudioQuoteDraftCommand>,
  { ok: true }
>["value"];

export type QuoteDraftSaveScope = {
  actorId: string;
  projectId: string;
  estimateId: string;
};
export type QuoteDraftSaveReceipt = {
  quoteId: string;
  quoteVersionId: string;
  reviewId: string;
  contentDigest: string;
  createdAt: string;
  alreadyExisted: boolean;
};
type Journal = {
  schemaVersion: "studio_quote_draft_pending.v1";
  scope: QuoteDraftSaveScope;
  body: string;
  receipt: QuoteDraftSaveReceipt | null;
  rejectedCode: QuoteDraftRejectionCode | null;
};
export type QuoteDraftSaveRead =
  | { state: "absent" }
  | {
      state: "valid";
      body: string;
      command: StudioQuoteDraftCommand;
      receipt: QuoteDraftSaveReceipt | null;
      rejectedCode: QuoteDraftRejectionCode | null;
    }
  | { state: "blocked" | "unavailable"; message: string };
export type QuoteDraftSaveOutcome =
  | {
      state: "confirmed";
      body: string;
      receipt: QuoteDraftSaveReceipt;
      receiptStored: boolean;
    }
  | {
      state: "uncertain" | "rejected" | "blocked" | "owner-changed";
      message: string;
    };
const VERSION = "studio_quote_draft_pending.v1";
export type QuoteDraftRejectionCode =
  | "STUDIO_DRAFT_STALE"
  | "STUDIO_DRAFT_REJECTED";
const terminal: readonly string[] = [
  "STUDIO_DRAFT_STALE",
  "STUDIO_DRAFT_REJECTED",
];
const sameReceipt = (a: QuoteDraftSaveReceipt, b: QuoteDraftSaveReceipt) =>
  a.quoteId === b.quoteId &&
  a.quoteVersionId === b.quoteVersionId &&
  a.reviewId === b.reviewId &&
  a.contentDigest === b.contentDigest &&
  a.createdAt === b.createdAt;
function scopeValue(value: QuoteDraftSaveScope): QuoteDraftSaveScope {
  if (
    !isStudioObject(value) ||
    !studioPriceExactKeys(value, ["actorId", "projectId", "estimateId"]) ||
    !studioPriceUuid(value.actorId) ||
    typeof value.projectId !== "string" ||
    !value.projectId.startsWith("proj_") ||
    !studioPriceUuid(value.projectId.slice(5)) ||
    typeof value.estimateId !== "string" ||
    !value.estimateId.startsWith("est_") ||
    !studioPriceUuid(value.estimateId.slice(4))
  )
    throw Error("Invalid quote draft save scope.");
  return {
    actorId: value.actorId,
    projectId: value.projectId,
    estimateId: value.estimateId,
  };
}
const owner = (scope: QuoteDraftSaveScope) =>
  getLocalFirstStoreOwner() === scope.actorId;
export function quoteDraftSaveKey(raw: QuoteDraftSaveScope) {
  const scope = scopeValue(raw);
  return `sanctuary-studio-quote-draft-pending:v1:${[scope.actorId, scope.projectId, scope.estimateId].map(encodeURIComponent).join(":")}`;
}
export function parseQuoteDraftSaveReceipt(
  value: unknown,
  command: StudioQuoteDraftCommand,
): QuoteDraftSaveReceipt | null {
  return isStudioObject(value) &&
    studioPriceExactKeys(value, [
      "quoteId",
      "quoteVersionId",
      "reviewId",
      "contentDigest",
      "createdAt",
      "alreadyExisted",
    ]) &&
    studioPriceUuid(value.quoteId) &&
    studioPriceUuid(value.quoteVersionId) &&
    studioPriceUuid(value.reviewId) &&
    value.reviewId === command.reviewId &&
    value.contentDigest === command.expectedContentDigest &&
    studioPriceDigest(value.contentDigest) &&
    studioPriceTimestamp(value.createdAt) &&
    typeof value.alreadyExisted === "boolean"
    ? (structuredClone(value) as QuoteDraftSaveReceipt)
    : null;
}
function inspect(
  raw: unknown,
  scope: QuoteDraftSaveScope,
): QuoteDraftSaveRead {
  if (raw === undefined) return { state: "absent" };
  if (
    !isStudioObject(raw) ||
    !studioPriceExactKeys(raw, [
      "schemaVersion",
      "scope",
      "body",
      "receipt",
      "rejectedCode",
    ]) ||
    raw.schemaVersion !== VERSION ||
    JSON.stringify(raw.scope) !== JSON.stringify(scope) ||
    typeof raw.body !== "string" ||
    raw.body.length > 4096 ||
    !(
      raw.rejectedCode === null ||
      (typeof raw.rejectedCode === "string" &&
        terminal.includes(raw.rejectedCode))
    )
  ) {
    return {
      state: "blocked",
      message:
        "A saved quote draft request needs recovery. It has been kept unchanged.",
    };
  }
  try {
    const command = parseStudioQuoteDraftCommand(JSON.parse(raw.body));
    if (
      !command.ok ||
      (raw.receipt !== null &&
        (!parseQuoteDraftSaveReceipt(raw.receipt, command.value) ||
          raw.rejectedCode !== null))
    )
      throw Error();
    return {
      state: "valid",
      body: raw.body,
      command: command.value,
      receipt: raw.receipt as QuoteDraftSaveReceipt | null,
      rejectedCode: raw.rejectedCode as QuoteDraftRejectionCode | null,
    };
  } catch {
    return {
      state: "blocked",
      message:
        "The saved quote draft request is damaged. It has been kept unchanged.",
    };
  }
}
export async function readQuoteDraftSave(
  raw: QuoteDraftSaveScope,
): Promise<QuoteDraftSaveRead> {
  try {
    const scope = scopeValue(raw);
    if (!owner(scope)) throw Error();
    const stored = await get(quoteDraftSaveKey(scope));
    if (!owner(scope)) throw Error();
    return inspect(stored, scope);
  } catch {
    return {
      state: "unavailable",
      message:
        "Quote draft recovery is unavailable for this signed-in account.",
    };
  }
}
/** One atomic journal slot per actor/estimate. Never replace an unresolved command. */
export async function stageQuoteDraftSave(
  raw: QuoteDraftSaveScope,
  input: unknown,
  canAct: () => boolean = () => true,
): Promise<QuoteDraftSaveRead> {
  try {
    const scope = scopeValue(raw),
      command = parseStudioQuoteDraftCommand(input);
    if (!command.ok || !owner(scope) || !canAct()) throw Error();
    const body = JSON.stringify(command.value);
    await update(quoteDraftSaveKey(scope), (stored) => {
      if (!owner(scope) || !canAct()) throw Error();
      const current = inspect(stored, scope);
      if (current.state === "absent")
        return {
          schemaVersion: VERSION,
          scope,
          body,
          receipt: null,
          rejectedCode: null,
        } satisfies Journal;
      if (current.state !== "valid" || current.body !== body) throw Error();
      return stored;
    });
    if (!owner(scope) || !canAct()) throw Error();
    return readQuoteDraftSave(scope);
  } catch {
    return {
      state: "blocked",
      message:
        "The quote draft request could not be safely saved in this browser. Existing recovery data is unchanged.",
    };
  }
}
export async function retryQuoteDraftSave(
  raw: QuoteDraftSaveScope,
  canAct: () => boolean = () => true,
): Promise<QuoteDraftSaveOutcome> {
  let scope: QuoteDraftSaveScope;
  try {
    scope = scopeValue(raw);
  } catch {
    return { state: "blocked", message: "Invalid quote draft save identity." };
  }
  const retained = await readQuoteDraftSave(scope);
  if (!owner(scope) || !canAct())
    return {
      state: "owner-changed",
      message: "The signed-in account changed.",
    };
  if (retained.state !== "valid")
    return {
      state: "blocked",
      message:
        retained.state === "blocked"
          ? retained.message
          : "No saved request is available.",
    };
  if (retained.receipt)
    return {
      state: "confirmed",
      body: retained.body,
      receipt: retained.receipt,
      receiptStored: true,
    };
  if (retained.rejectedCode !== null)
    return {
      state: "rejected",
      message:
        "This quote draft request was not accepted. Reload the latest design before starting another draft request.",
    };
  try {
    const response = await apiJson<unknown>(
      `/api/projects/${scope.projectId}/estimates/${scope.estimateId}/studio-quote-drafts`,
      { method: "POST", body: retained.body },
    );
    if (!owner(scope) || !canAct())
      return {
        state: "owner-changed",
        message: "The signed-in account changed.",
      };
    const receipt =
      isStudioObject(response) &&
      studioPriceExactKeys(response, ["receipt", "status"]) &&
      response.status === "protected_draft_not_sendable"
        ? parseQuoteDraftSaveReceipt(response.receipt, retained.command)
        : null;
    if (!receipt) throw Error("Unverified response");
    let committed = receipt;
    try {
      await update(quoteDraftSaveKey(scope), (stored) => {
        if (!owner(scope) || !canAct()) throw Error();
        const current = inspect(stored, scope);
        if (
          current.state !== "valid" ||
          current.body !== retained.body ||
          (current.receipt && !sameReceipt(current.receipt, receipt))
        )
          throw Error();
        committed = current.receipt ?? receipt;
        return {
          ...(stored as Journal),
          receipt: committed,
          rejectedCode: null,
        };
      });
    } catch {
      if (!owner(scope) || !canAct())
        return {
          state: "owner-changed",
          message: "The signed-in account changed.",
        };
      return {
        state: "confirmed",
        body: retained.body,
        receipt,
        receiptStored: false,
      };
    }
    if (!owner(scope) || !canAct())
      return {
        state: "owner-changed",
        message: "The signed-in account changed.",
      };
    return {
      state: "confirmed",
      body: retained.body,
      receipt: committed,
      receiptStored: true,
    };
  } catch (error) {
    if (!owner(scope) || !canAct())
      return {
        state: "owner-changed",
        message: "The signed-in account changed.",
      };
    const code: QuoteDraftRejectionCode | null =
      error instanceof ApiError &&
      (error.status === 409 || error.status === 422) &&
      isStudioObject(error.body) &&
      typeof error.body.code === "string" &&
      terminal.includes(error.body.code)
        ? (error.body.code as QuoteDraftRejectionCode)
        : null;
    let winner: QuoteDraftSaveReceipt | null = null;
    try {
      await update(quoteDraftSaveKey(scope), (stored) => {
        if (!owner(scope) || !canAct()) throw Error();
        const current = inspect(stored, scope);
        if (current.state !== "valid" || current.body !== retained.body)
          throw Error();
        if (current.receipt) {
          winner = current.receipt;
          return stored;
        }
        return {
          ...(stored as Journal),
          rejectedCode: code ?? current.rejectedCode,
        };
      });
    } catch {
      /* The already-durable command remains exact-retryable. */
    }
    if (!owner(scope) || !canAct())
      return {
        state: "owner-changed",
        message: "The signed-in account changed.",
      };
    if (winner)
      return {
        state: "confirmed",
        body: retained.body,
        receipt: winner,
        receiptStored: true,
      };
    return code !== null
      ? {
          state: "rejected",
          message:
            "The saved draft request was not accepted. Reload the review before starting another request.",
        }
      : {
          state: "uncertain",
          message:
            "The quote draft save could not be confirmed. Retry the saved request.",
        };
  }
}
/** Clear only verified receipt or explicitly acknowledged terminal rejection.
 * Caller must read authoritative saved state before acknowledging a receipt. */
export async function acknowledgeQuoteDraftSave(
  raw: QuoteDraftSaveScope,
  expected: {
    body: string;
    receipt: QuoteDraftSaveReceipt | null;
    rejectedCode: QuoteDraftRejectionCode | null;
  },
  canAct: () => boolean = () => true,
): Promise<boolean> {
  try {
    const scope = scopeValue(raw);
    expected = structuredClone(expected);
    let cleared = false;
    if (!owner(scope) || !canAct()) return false;
    await update(quoteDraftSaveKey(scope), (stored) => {
      if (!owner(scope) || !canAct()) throw Error();
      const current = inspect(stored, scope);
      if (current.state !== "valid" || current.body !== expected.body)
        return stored;
      const confirmed =
        current.receipt &&
        expected.receipt &&
        sameReceipt(current.receipt, expected.receipt);
      const rejected =
        !current.receipt &&
        !expected.receipt &&
        current.rejectedCode !== null &&
        current.rejectedCode === expected.rejectedCode;
      if (!confirmed && !rejected) return stored;
      cleared = true;
      return undefined;
    });
    return owner(scope) && canAct() && cleared;
  } catch {
    return false;
  }
}
