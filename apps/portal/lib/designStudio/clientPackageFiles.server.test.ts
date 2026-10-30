import { expect, it, vi } from "vitest";
import {
  classifyStudioPackageFiles,
  assertStudioSeparateFiles,
} from "./clientPackageFiles.server";
import type { StudioPackageContext } from "./clientPackageContext.server";
const rows = [
  { id: "financial", created_by: "staff" },
  { id: "booklet", created_by: "background:studio-documents" },
  { id: "site-plan", created_by: "staff" },
];
function context() {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(async (_column: string, ids: string[]) => ({
      data: rows.filter((row) => ids.includes(row.id)),
      error: null,
    })),
  };
  return {
    service: { from: () => chain },
    projectId: "project",
    financialFileId: "financial",
  } as unknown as StudioPackageContext;
}
const files = rows.map((row) => ({
  id: row.id,
  filename: row.id + ".pdf",
  contentType: "application/pdf",
  sizeBytes: 100,
  sha256: "a".repeat(64),
  renderEligible: false,
}));
it("offers only genuinely separate files and retains an existing invalid selection visibly so it can be removed", async () => {
  expect(
    (await classifyStudioPackageFiles(context(), files)).map((file) => file.id),
  ).toEqual(["site-plan"]);
  const selected = await classifyStudioPackageFiles(context(), files, [
    "booklet",
  ]);
  expect(selected.find((file) => file.id === "booklet")?.separateEligible).toBe(
    false,
  );
  expect(selected.map((file) => file.id)).toEqual(["booklet", "site-plan"]);
});
it("rejects duplicate financial and generated-booklet selections at the server boundary, without silently dropping them", async () => {
  await expect(
    assertStudioSeparateFiles(context(), ["financial"]),
  ).rejects.toThrow("duplicate");
  await expect(
    assertStudioSeparateFiles(context(), ["booklet"]),
  ).rejects.toThrow("duplicate");
  await expect(
    assertStudioSeparateFiles(context(), ["site-plan"]),
  ).resolves.toBeUndefined();
});
