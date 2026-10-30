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
import { parseStudioQuoteReviewCommand } from "./quoteReviewCommand";
type StudioQuoteReviewCommand = Extract<
  ReturnType<typeof parseStudioQuoteReviewCommand>,
  { ok: true }
>["value"];

export type QuoteReviewSaveScope = {
  actorId: string;
  projectId: string;
  estimateId: string;
};
export type QuoteReviewSaveReceipt = {
  reviewId: string;
  contentDigest: string;
  savedAt: string;
  alreadyExisted: boolean;
};
type Journal = {
  schemaVersion: "studio_quote_review_pending.v1";
  scope: QuoteReviewSaveScope;
  body: string;
  receipt: QuoteReviewSaveReceipt | null;
  rejectedCode: QuoteReviewRejectionCode | null;
};
export type QuoteReviewSaveRead =
  | { state: "absent" }
  | {
      state: "valid";
      body: string;
      command: StudioQuoteReviewCommand;
      receipt: QuoteReviewSaveReceipt | null;
      rejectedCode: QuoteReviewRejectionCode | null;
    }
  | { state: "blocked" | "unavailable"; message: string };
export type QuoteReviewSaveOutcome =
  | {
      state: "confirmed";
      body: string;
      receipt: QuoteReviewSaveReceipt;
      receiptStored: boolean;
    }
  | {
      state: "uncertain" | "rejected" | "blocked" | "owner-changed";
      message: string;
    };
const VERSION = "studio_quote_review_pending.v1";
export type QuoteReviewRejectionCode =
  | "STUDIO_REVIEW_STALE"
  | "STUDIO_REVIEW_REJECTED";
const terminal: readonly string[] = [
  "STUDIO_REVIEW_STALE",
  "STUDIO_REVIEW_REJECTED",
];
const sameReceipt = (a: QuoteReviewSaveReceipt, b: QuoteReviewSaveReceipt) =>
  a.reviewId === b.reviewId &&
  a.contentDigest === b.contentDigest &&
  a.savedAt === b.savedAt;
function scopeValue(value: QuoteReviewSaveScope): QuoteReviewSaveScope {
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
    throw Error("Invalid quote review save scope.");
  return {
    actorId: value.actorId,
    projectId: value.projectId,
    estimateId: value.estimateId,
  };
}
const owner = (scope: QuoteReviewSaveScope) =>
  getLocalFirstStoreOwner() === scope.actorId;
export function quoteReviewSaveKey(raw: QuoteReviewSaveScope) {
  const scope = scopeValue(raw);
  return `sanctuary-studio-quote-review-pending:v1:${[scope.actorId, scope.projectId, scope.estimateId].map(encodeURIComponent).join(":")}`;
}
export function parseQuoteReviewSaveReceipt(
  value: unknown,
  command: StudioQuoteReviewCommand,
): QuoteReviewSaveReceipt | null {
  return isStudioObject(value) &&
    studioPriceExactKeys(value, [
      "reviewId",
      "contentDigest",
      "savedAt",
      "alreadyExisted",
    ]) &&
    studioPriceUuid(value.reviewId) &&
    value.contentDigest === command.expectedContentDigest &&
    studioPriceDigest(value.contentDigest) &&
    studioPriceTimestamp(value.savedAt) &&
    typeof value.alreadyExisted === "boolean"
    ? (structuredClone(value) as QuoteReviewSaveReceipt)
    : null;
}
function inspect(
  raw: unknown,
  scope: QuoteReviewSaveScope,
): QuoteReviewSaveRead {
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
        "A saved quote review request needs recovery. It has been kept unchanged.",
    };
  }
  try {
    const command = parseStudioQuoteReviewCommand(JSON.parse(raw.body));
    if (
      !command.ok ||
      (raw.receipt !== null &&
        (!parseQuoteReviewSaveReceipt(raw.receipt, command.value) ||
          raw.rejectedCode !== null))
    )
      throw Error();
    return {
      state: "valid",
      body: raw.body,
      command: command.value,
      receipt: raw.receipt as QuoteReviewSaveReceipt | null,
      rejectedCode: raw.rejectedCode as QuoteReviewRejectionCode | null,
    };
  } catch {
    return {
      state: "blocked",
      message:
        "The saved quote review request is damaged. It has been kept unchanged.",
    };
  }
}
export async function readQuoteReviewSave(
  raw: QuoteReviewSaveScope,
): Promise<QuoteReviewSaveRead> {
  try {
    const scope = scopeValue(raw);
    if (!owner(scope)) throw Error();
    const stored = await get(quoteReviewSaveKey(scope));
    if (!owner(scope)) throw Error();
    return inspect(stored, scope);
  } catch {
    return {
      state: "unavailable",
      message:
        "Quote review recovery is unavailable for this signed-in account.",
    };
  }
}
/** One atomic journal slot per actor/estimate. Never replace an unresolved command. */
export async function stageQuoteReviewSave(
  raw: QuoteReviewSaveScope,
  input: unknown,
  canAct: () => boolean = () => true,
): Promise<QuoteReviewSaveRead> {
  try {
    const scope = scopeValue(raw),
      command = parseStudioQuoteReviewCommand(input);
    if (!command.ok || !owner(scope) || !canAct()) throw Error();
    const body = JSON.stringify(command.value);
    await update(quoteReviewSaveKey(scope), (stored) => {
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
    return readQuoteReviewSave(scope);
  } catch {
    return {
      state: "blocked",
      message:
        "The quote review request could not be safely saved in this browser. Existing recovery data is unchanged.",
    };
  }
}
export async function retryQuoteReviewSave(
  raw: QuoteReviewSaveScope,
  canAct: () => boolean = () => true,
): Promise<QuoteReviewSaveOutcome> {
  let scope: QuoteReviewSaveScope;
  try {
    scope = scopeValue(raw);
  } catch {
    return { state: "blocked", message: "Invalid quote review save identity." };
  }
  const retained = await readQuoteReviewSave(scope);
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
        "This quote review request was not accepted. Reload the latest design before calculating again.",
    };
  try {
    const response = await apiJson<unknown>(
      `/api/projects/${scope.projectId}/estimates/${scope.estimateId}/studio-quote-reviews`,
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
      response.status === "persisted_not_quote_ready"
        ? parseQuoteReviewSaveReceipt(response.receipt, retained.command)
        : null;
    if (!receipt) throw Error("Unverified response");
    let committed = receipt;
    try {
      await update(quoteReviewSaveKey(scope), (stored) => {
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
    const code: QuoteReviewRejectionCode | null =
      error instanceof ApiError &&
      isStudioObject(error.body) &&
      typeof error.body.code === "string" &&
      terminal.includes(error.body.code)
        ? (error.body.code as QuoteReviewRejectionCode)
        : null;
    let winner: QuoteReviewSaveReceipt | null = null;
    try {
      await update(quoteReviewSaveKey(scope), (stored) => {
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
            "The saved review request was not accepted. Reload the review before starting another request.",
        }
      : {
          state: "uncertain",
          message:
            "The quote review save could not be confirmed. Retry the saved request.",
        };
  }
}
/** Clear only verified receipt or explicitly acknowledged terminal rejection.
 * Caller must read authoritative saved state before acknowledging a receipt. */
export async function acknowledgeQuoteReviewSave(
  raw: QuoteReviewSaveScope,
  expected: {
    body: string;
    receipt: QuoteReviewSaveReceipt | null;
    rejectedCode: QuoteReviewRejectionCode | null;
  },
  canAct: () => boolean = () => true,
): Promise<boolean> {
  try {
    const scope = scopeValue(raw);
    expected = structuredClone(expected);
    let cleared = false;
    if (!owner(scope) || !canAct()) return false;
    await update(quoteReviewSaveKey(scope), (stored) => {
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
