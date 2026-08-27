import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ENQUIRY_ATTACHMENT_BUCKET,
  classifyProjectEnquiryAttachments,
  type ExistingAttachment,
  type HistoricalEnquiry,
  type StoredObject,
} from "./project-enquiry-attachments-backfill-lib";

const ROOT = path.resolve(process.cwd());
const PAGE_SIZE = 1_000;
const APPLY_CONFIRMATION = "I_HAVE_REVIEWED_THE_ATTACHMENT_REPORT";

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]!]) continue;
    let value = match[2]!.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]!] = value;
  }
}

for (const name of [".env.agent.local", ".env.local", "apps/portal/.env.local"]) {
  loadEnvFile(path.resolve(ROOT, name));
}

function flag(name: string): string | null {
  const prefix = `${name}=`;
  return process.argv.slice(2).find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function requiredFlag(name: string): string {
  const value = flag(name)?.trim();
  if (!value) throw new Error(`${name}=... is required.`);
  return value;
}

function requiredEnv(name: "SUPABASE_SERVICE_ROLE_KEY"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function projectRef(url: string): string {
  const match = new URL(url).hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
  if (!match) throw new Error("The Supabase URL does not contain a recognizable project ref.");
  return match[1]!;
}

function outputOutsideRepository(value: string): string {
  const output = path.resolve(value);
  const relative = path.relative(ROOT, output);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new Error("The report must be written outside the repository so customer evidence cannot be committed.");
  }
  return output;
}

async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await supabase.from(table).select(columns).range(offset, offset + PAGE_SIZE - 1);
    if (response.error) throw new Error(`Unable to read ${table}: ${response.error.message}`);
    const page = (response.data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function listAllStorageObjects(supabase: SupabaseClient): Promise<StoredObject[]> {
  const objects: StoredObject[] = [];
  const prefixes = [""];
  while (prefixes.length) {
    const prefix = prefixes.shift()!;
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const response = await supabase.storage.from(ENQUIRY_ATTACHMENT_BUCKET).list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (response.error) throw new Error(`Unable to list private Storage at ${prefix || "/"}: ${response.error.message}`);
      const page = response.data ?? [];
      for (const entry of page) {
        const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null || entry.id === undefined) {
          prefixes.push(entryPath);
        } else {
          const metadataSize = Number(entry.metadata?.size);
          objects.push({ path: entryPath, sizeBytes: Number.isFinite(metadataSize) ? metadataSize : null });
        }
      }
      if (page.length < PAGE_SIZE) break;
    }
  }
  return objects;
}

async function dryRun(supabase: SupabaseClient, target: string, ref: string): Promise<void> {
  const outputPath = outputOutsideRepository(requiredFlag("--output"));
  const [enquiries, projects, existingAttachments, storedObjects] = await Promise.all([
    fetchAll<HistoricalEnquiry>(supabase, "enquiry_requests", "id,project_id,submission_id,files,created_at"),
    fetchAll<{ id: string }>(supabase, "projects", "id"),
    fetchAll<ExistingAttachment>(
      supabase,
      "project_enquiry_attachments",
      "enquiry_request_id,project_id,submission_id,file_ordinal,storage_bucket,storage_path,original_filename,content_type,size_bytes",
    ),
    listAllStorageObjects(supabase),
  ]);
  const classification = classifyProjectEnquiryAttachments({
    enquiries,
    projectIds: projects.map((project) => project.id),
    existingAttachments,
    storedObjects,
  });
  const report = {
    reportVersion: 1,
    mode: "dry-run",
    generatedAt: new Date().toISOString(),
    target,
    projectRef: ref,
    bucket: ENQUIRY_ATTACHMENT_BUCKET,
    mutationsPerformed: false,
    storageObjectsMovedRenamedOrDeleted: false,
    summary: {
      linkableFiles: classification.candidates.length,
      alreadyLinkedFiles: classification.alreadyLinkedFiles.length,
      missingObjects: classification.missingObjects.length,
      unmatchedObjects: classification.unmatchedObjects.length,
      ambiguousMatches: classification.ambiguousMatches.length,
      projectsMergedOrChanged: classification.projectsMergedOrChanged.length,
    },
    ...classification,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(`Attachment backfill dry run for ${target} (${ref})`);
  console.table(report.summary);
  console.log(`Review-only report written to ${outputPath}. No rows or Storage objects were changed.`);
}

async function applyApprovedReport(supabase: SupabaseClient, target: string, ref: string): Promise<void> {
  const approvedReportPath = outputOutsideRepository(requiredFlag("--approved-report"));
  const runId = requiredFlag("--run-id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) {
    throw new Error("--run-id must be a UUID chosen for this reviewed run.");
  }
  if (process.env.PROJECT_ENQUIRY_ATTACHMENT_BACKFILL_APPROVED !== APPLY_CONFIRMATION) {
    throw new Error(`Set PROJECT_ENQUIRY_ATTACHMENT_BACKFILL_APPROVED=${APPLY_CONFIRMATION} after review.`);
  }
  const report = JSON.parse(fs.readFileSync(approvedReportPath, "utf8")) as Record<string, unknown>;
  if (
    report.reportVersion !== 1
    || report.mode !== "dry-run"
    || report.target !== target
    || report.projectRef !== ref
    || report.mutationsPerformed !== false
    || !Array.isArray(report.candidates)
    || !Array.isArray(report.missingObjects)
    || !Array.isArray(report.unmatchedObjects)
    || !Array.isArray(report.ambiguousMatches)
    || !Array.isArray(report.projectsMergedOrChanged)
  ) {
    throw new Error("The approved report does not match this target or the supported report contract.");
  }
  const exceptionCount = report.missingObjects.length
    + report.unmatchedObjects.length
    + report.ambiguousMatches.length
    + report.projectsMergedOrChanged.length;
  if (exceptionCount > 0 && !process.argv.includes("--accept-reviewed-exceptions")) {
    throw new Error(
      "The report contains exceptions. Review them and pass --accept-reviewed-exceptions only if the exact candidate subset is approved.",
    );
  }
  if (report.candidates.length === 0) {
    console.log("The approved report has no linkable candidates. No database or Storage changes were made.");
    return;
  }
  const response = await supabase.rpc("project_enquiry_attachment_backfill_apply", {
    p_run_id: runId,
    p_candidates: report.candidates,
  });
  if (response.error) throw new Error(`Backfill refused: ${response.error.message}`);
  console.log("Reviewed attachment backfill completed. Storage objects were not moved, renamed, or deleted.");
  console.table(response.data ?? []);
}

async function main(): Promise<void> {
  const target = requiredFlag("--target");
  if (target !== "staging" && target !== "production") {
    throw new Error("--target must be staging or production.");
  }
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (!supabaseUrl) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.");
  const actualRef = projectRef(supabaseUrl);
  const confirmedRef = requiredFlag("--confirm-project-ref");
  if (actualRef !== confirmedRef) throw new Error("--confirm-project-ref does not match the configured Supabase URL.");
  const supabase = createClient(supabaseUrl, requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  if (process.argv.includes("--apply")) {
    await applyApprovedReport(supabase, target, actualRef);
  } else {
    await dryRun(supabase, target, actualRef);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Attachment backfill failed.");
  process.exitCode = 1;
});
