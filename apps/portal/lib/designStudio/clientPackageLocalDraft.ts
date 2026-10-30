"use client";
import { getLocalFirstStoreOwner } from "@/lib/localFirst/store";
import {
  studioPackageDraftKey,
  type StudioPackageDraftValue,
} from "./clientPackage";
export type StudioPackageLocalScope = { actorId: string; quoteId: string };
type LocalDraft = {
  schemaVersion: "studio_client_package_local.v1";
  scope: StudioPackageLocalScope;
  baseRevision: number;
  value: StudioPackageDraftValue;
};
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
function key(scope: StudioPackageLocalScope) {
  if (
    !/^[a-f0-9-]{36}$/i.test(scope.actorId) ||
    !/^qv_[a-f0-9-]{36}$/i.test(scope.quoteId) ||
    getLocalFirstStoreOwner() !== scope.actorId
  )
    throw Error("The signed-in package owner changed.");
  return (
    "sanctuary-studio-package-local:v1:" + scope.actorId + ":" + scope.quoteId
  );
}
function parse(raw: string, scope: StudioPackageLocalScope): LocalDraft {
  if (raw.length > 65536) throw Error("Local package copy exceeds its bound.");
  const row = JSON.parse(raw) as LocalDraft,
    v = row?.value;
  if (
    row?.schemaVersion !== "studio_client_package_local.v1" ||
    !same(row.scope, scope) ||
    !Number.isSafeInteger(row.baseRevision) ||
    row.baseRevision < 0 ||
    !v ||
    Object.keys(v).sort().join(",") !==
      "fileIds,includeBooklet,message,renderFileIds,subject,to" ||
    typeof v.to !== "string" ||
    v.to.length > 320 ||
    typeof v.subject !== "string" ||
    v.subject.length > 200 ||
    typeof v.message !== "string" ||
    v.message.length > 10000 ||
    typeof v.includeBooklet !== "boolean" ||
    !Array.isArray(v.renderFileIds) ||
    v.renderFileIds.length > 8 ||
    !Array.isArray(v.fileIds) ||
    v.fileIds.length > 9 ||
    [...v.renderFileIds, ...v.fileIds].some(
      (id) => typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id),
    )
  )
    throw Error(
      "The existing local package copy could not be read. It has been kept.",
    );
  return row;
}
/** Same actor/quote only. A draft copy is recovery, never newer server authority. */
export function readStudioPackageLocalDraft(
  scope: StudioPackageLocalScope,
): LocalDraft | null {
  const raw = sessionStorage.getItem(key(scope));
  return raw === null ? null : parse(raw, scope);
}
export function writeStudioPackageLocalDraft(
  scope: StudioPackageLocalScope,
  baseRevision: number,
  value: StudioPackageDraftValue,
) {
  const storageKey = key(scope),
    prior = sessionStorage.getItem(storageKey);
  if (prior !== null) parse(prior, scope);
  const record: LocalDraft = {
      schemaVersion: "studio_client_package_local.v1",
      scope,
      baseRevision,
      value: structuredClone(value),
    },
    raw = JSON.stringify(record);
  parse(raw, scope);
  sessionStorage.setItem(storageKey, raw);
}
/** An old acknowledgement cannot retire more recent accepted inputs. */
export function clearStudioPackageLocalDraft(
  scope: StudioPackageLocalScope,
  value: StudioPackageDraftValue,
) {
  const storageKey = key(scope),
    raw = sessionStorage.getItem(storageKey);
  if (raw === null) return;
  const row = parse(raw, scope);
  if (
    studioPackageDraftKey(row.value) === studioPackageDraftKey(value) &&
    sessionStorage.getItem(storageKey) === raw
  )
    sessionStorage.removeItem(storageKey);
}
