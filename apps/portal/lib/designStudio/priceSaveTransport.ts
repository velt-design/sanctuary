"use client";

import { get, update } from "idb-keyval";
import { getLocalFirstStoreOwner } from "@/lib/localFirst/store";
import { ApiError, apiJson } from "@/lib/repo/apiClient";
import { isStudioObject } from "./contracts";
import {
  parseStudioPriceCommand,
  studioPriceDigest,
  studioPriceExactKeys,
  studioPriceTimestamp,
  studioPriceUuid,
  type StudioPriceCommand,
} from "./pricedCandidate";

export type PriceSaveScope = {
  actorId: string;
  projectId: string;
  estimateId: string;
  designId: string;
};
export type PriceSaveReceipt = {
  priceId: string;
  revision: number;
  sourceToken: string;
  savedAt: string;
  alreadyExisted: boolean;
};
type Journal = {
  schemaVersion: "studio_price_pending.v1";
  scope: PriceSaveScope;
  body: string;
  receipt: PriceSaveReceipt | null;
  rejectedStatus: number | null;
};
export type PriceSaveRead =
  | { state: "absent" }
  | {
      state: "valid";
      body: string;
      command: StudioPriceCommand;
      receipt: PriceSaveReceipt | null;
      rejectedStatus: number | null;
    }
  | { state: "blocked" | "unavailable"; message: string };
export type PriceSaveOutcome =
  | {
      state: "confirmed";
      body: string;
      receipt: PriceSaveReceipt;
      receiptStored: boolean;
    }
  | {
      state: "uncertain" | "rejected" | "blocked" | "owner-changed";
      message: string;
    };
const VERSION = "studio_price_pending.v1";
const terminal = [400, 409, 422];
const sameReceipt = (a: PriceSaveReceipt, b: PriceSaveReceipt) =>
  a.priceId === b.priceId &&
  a.revision === b.revision &&
  a.sourceToken === b.sourceToken &&
  a.savedAt === b.savedAt;
function scopeValue(value: PriceSaveScope): PriceSaveScope {
  if (
    !isStudioObject(value) ||
    !studioPriceExactKeys(value, [
      "actorId",
      "projectId",
      "estimateId",
      "designId",
    ]) ||
    !studioPriceUuid(value.actorId) ||
    typeof value.projectId !== "string" ||
    !value.projectId.startsWith("proj_") ||
    !studioPriceUuid(value.projectId.slice(5)) ||
    typeof value.estimateId !== "string" ||
    !value.estimateId.startsWith("est_") ||
    !studioPriceUuid(value.estimateId.slice(4)) ||
    typeof value.designId !== "string" ||
    !value.designId.trim() ||
    value.designId.length > 200
  )
    throw Error("Invalid price save scope.");
  return {
    actorId: value.actorId,
    projectId: value.projectId,
    estimateId: value.estimateId,
    designId: value.designId,
  };
}
const owner = (scope: PriceSaveScope) =>
  getLocalFirstStoreOwner() === scope.actorId;
export function priceSaveKey(raw: PriceSaveScope) {
  const scope = scopeValue(raw);
  return `sanctuary-studio-price-pending:v1:${[scope.actorId, scope.projectId, scope.estimateId, scope.designId].map(encodeURIComponent).join(":")}`;
}
export function parsePriceSaveReceipt(
  value: unknown,
  command: StudioPriceCommand,
): PriceSaveReceipt | null {
  return isStudioObject(value) &&
    studioPriceExactKeys(value, [
      "priceId",
      "revision",
      "sourceToken",
      "savedAt",
      "alreadyExisted",
    ]) &&
    studioPriceUuid(value.priceId) &&
    value.revision === command.expectedRevision &&
    value.sourceToken === command.expectedSourceToken &&
    studioPriceDigest(value.sourceToken) &&
    studioPriceTimestamp(value.savedAt) &&
    typeof value.alreadyExisted === "boolean"
    ? (structuredClone(value) as PriceSaveReceipt)
    : null;
}
function inspect(raw: unknown, scope: PriceSaveScope): PriceSaveRead {
  if (raw === undefined) return { state: "absent" };
  if (
    !isStudioObject(raw) ||
    !studioPriceExactKeys(raw, [
      "schemaVersion",
      "scope",
      "body",
      "receipt",
      "rejectedStatus",
    ]) ||
    raw.schemaVersion !== VERSION ||
    JSON.stringify(raw.scope) !== JSON.stringify(scope) ||
    typeof raw.body !== "string" ||
    raw.body.length > 4096 ||
    !(
      raw.rejectedStatus === null ||
      (typeof raw.rejectedStatus === "number" &&
        terminal.includes(raw.rejectedStatus))
    )
  ) {
    return {
      state: "blocked",
      message:
        "A saved price request needs recovery. It has been kept unchanged.",
    };
  }
  try {
    const command = parseStudioPriceCommand(JSON.parse(raw.body));
    if (
      !command.ok ||
      (raw.receipt !== null &&
        (!parsePriceSaveReceipt(raw.receipt, command.value) ||
          raw.rejectedStatus !== null))
    )
      throw Error();
    return {
      state: "valid",
      body: raw.body,
      command: command.value,
      receipt: raw.receipt as PriceSaveReceipt | null,
      rejectedStatus: raw.rejectedStatus as number | null,
    };
  } catch {
    return {
      state: "blocked",
      message:
        "The saved price request is damaged. It has been kept unchanged.",
    };
  }
}
export async function readPriceSave(
  raw: PriceSaveScope,
): Promise<PriceSaveRead> {
  try {
    const scope = scopeValue(raw);
    if (!owner(scope)) throw Error();
    const stored = await get(priceSaveKey(scope));
    if (!owner(scope)) throw Error();
    return inspect(stored, scope);
  } catch {
    return {
      state: "unavailable",
      message: "Price recovery is unavailable for this signed-in account.",
    };
  }
}
/** One atomic journal slot per actor/design. Never replace an unresolved command. */
export async function stagePriceSave(
  raw: PriceSaveScope,
  input: unknown,
  canAct: () => boolean = () => true,
): Promise<PriceSaveRead> {
  try {
    const scope = scopeValue(raw),
      command = parseStudioPriceCommand(input);
    if (!command.ok || !owner(scope) || !canAct()) throw Error();
    const body = JSON.stringify(command.value);
    await update(priceSaveKey(scope), (stored) => {
      if (!owner(scope) || !canAct()) throw Error();
      const current = inspect(stored, scope);
      if (current.state === "absent")
        return {
          schemaVersion: VERSION,
          scope,
          body,
          receipt: null,
          rejectedStatus: null,
        } satisfies Journal;
      if (current.state !== "valid" || current.body !== body) throw Error();
      return stored;
    });
    if (!owner(scope) || !canAct()) throw Error();
    return readPriceSave(scope);
  } catch {
    return {
      state: "blocked",
      message:
        "The price request could not be safely saved in this browser. Existing recovery data is unchanged.",
    };
  }
}
export async function retryPriceSave(
  raw: PriceSaveScope,
  canAct: () => boolean = () => true,
): Promise<PriceSaveOutcome> {
  let scope: PriceSaveScope;
  try {
    scope = scopeValue(raw);
  } catch {
    return { state: "blocked", message: "Invalid price save identity." };
  }
  const retained = await readPriceSave(scope);
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
  if (retained.rejectedStatus !== null)
    return {
      state: "rejected",
      message:
        "This price request was not accepted. Reload the latest design before calculating again.",
    };
  try {
    const response = await apiJson<unknown>(
      `/api/projects/${scope.projectId}/estimates/${scope.estimateId}/studio-price`,
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
        ? parsePriceSaveReceipt(response.receipt, retained.command)
        : null;
    if (!receipt) throw Error("Unverified response");
    let committed = receipt;
    try {
      await update(priceSaveKey(scope), (stored) => {
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
          rejectedStatus: null,
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
    const status =
      error instanceof ApiError && terminal.includes(error.status)
        ? error.status
        : null;
    let winner: PriceSaveReceipt | null = null;
    try {
      await update(priceSaveKey(scope), (stored) => {
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
          rejectedStatus: status ?? current.rejectedStatus,
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
    return status !== null
      ? {
          state: "rejected",
          message:
            "The saved design or pricebook changed. Reload before calculating again.",
        }
      : {
          state: "uncertain",
          message:
            "The price save could not be confirmed. Retry the saved request.",
        };
  }
}
/** Clear only verified receipt or explicitly acknowledged terminal rejection.
 * Caller must read authoritative saved state before acknowledging a receipt. */
export async function acknowledgePriceSave(
  raw: PriceSaveScope,
  expected: {
    body: string;
    receipt: PriceSaveReceipt | null;
    rejectedStatus: number | null;
  },
  canAct: () => boolean = () => true,
): Promise<boolean> {
  try {
    const scope = scopeValue(raw);
    expected = structuredClone(expected);
    let cleared = false;
    if (!owner(scope) || !canAct()) return false;
    await update(priceSaveKey(scope), (stored) => {
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
        current.rejectedStatus !== null &&
        current.rejectedStatus === expected.rejectedStatus;
      if (!confirmed && !rejected) return stored;
      cleared = true;
      return undefined;
    });
    return owner(scope) && cleared;
  } catch {
    return false;
  }
}
