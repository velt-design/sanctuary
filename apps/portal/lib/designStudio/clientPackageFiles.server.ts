import "server-only";
import type { StudioPackageContext } from "./clientPackageContext.server";
import type { StudioPackageFile } from "./clientPackage";
/** Generated documents have their own package controls, never a second loose-file selection. */
export async function classifyStudioPackageFiles(
  context: StudioPackageContext,
  files: StudioPackageFile[],
  selected: string[] = [],
) {
  if (!files.length) return files;
  const result = await context.service
    .from("file_artifacts")
    .select("id,created_by")
    .eq("project_id", context.projectId)
    .in(
      "id",
      files.map((file) => file.id),
    );
  if (result.error)
    throw Error("Project file identities could not be checked.");
  return files
    .map((file) => {
      const row = result.data?.find((item: any) => item.id === file.id);
      if (!row) throw Error("A selected project file is unavailable.");
      return {
        ...file,
        separateEligible:
          file.id !== context.financialFileId &&
          row.created_by !== "background:studio-documents",
      };
    })
    .filter((file) => file.separateEligible || selected.includes(file.id));
}
export async function assertStudioSeparateFiles(
  context: StudioPackageContext,
  ids: string[],
) {
  if (!ids.length) return;
  const result = await context.service
    .from("file_artifacts")
    .select("id,created_by")
    .eq("project_id", context.projectId)
    .in("id", ids);
  if (result.error || result.data?.length !== ids.length)
    throw Error("A selected project file is unavailable.");
  if (
    result.data.some(
      (row: any) =>
        row.id === context.financialFileId ||
        row.created_by === "background:studio-documents",
    )
  )
    throw Error(
      "Quote and design booklet documents use their own controls. Remove their duplicate Project file selection.",
    );
}
