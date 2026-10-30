import { beforeEach, expect, it, vi } from "vitest";
const owner = vi.hoisted(() => ({
  id: "10000000-0000-4000-8000-000000000001",
}));
vi.mock("@/lib/localFirst/store", () => ({
  getLocalFirstStoreOwner: () => owner.id,
}));
import {
  readStudioPackageLocalDraft,
  writeStudioPackageLocalDraft,
  clearStudioPackageLocalDraft,
} from "./clientPackageLocalDraft";
const scope = {
  actorId: "10000000-0000-4000-8000-000000000001",
  quoteId: "qv_10000000-0000-4000-8000-000000000002",
};
const value = {
  to: "qa@example.test",
  subject: "Quote",
  message: "First paragraph\n\nSecond paragraph",
  includeBooklet: true,
  renderFileIds: [],
  fileIds: [],
};
beforeEach(() => {
  sessionStorage.clear();
  owner.id = scope.actorId;
});
it("retains bounded exact local inputs, and an old acknowledgement cannot remove newer accepted edits", () => {
  writeStudioPackageLocalDraft(scope, 1, value);
  writeStudioPackageLocalDraft(scope, 1, { ...value, message: "Newer input" });
  clearStudioPackageLocalDraft(scope, value);
  expect(readStudioPackageLocalDraft(scope)?.value.message).toBe("Newer input");
  clearStudioPackageLocalDraft(scope, { ...value, message: "Newer input" });
  expect(readStudioPackageLocalDraft(scope)).toBeNull();
});
it("refuses another signed-in owner and preserves corrupt recovery rather than replacing it", () => {
  writeStudioPackageLocalDraft(scope, 1, value);
  owner.id = "10000000-0000-4000-8000-000000000003";
  expect(() => readStudioPackageLocalDraft(scope)).toThrow("owner changed");
  expect(sessionStorage.length).toBe(1);
  owner.id = scope.actorId;
  const storageKey = sessionStorage.key(0)!;
  sessionStorage.setItem(storageKey, "damaged original");
  expect(() => writeStudioPackageLocalDraft(scope, 1, value)).toThrow();
  expect(sessionStorage.getItem(storageKey)).toBe("damaged original");
});
