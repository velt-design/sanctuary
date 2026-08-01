import {
  jsonError,
  jsonOk,
  parseJsonBody,
  requireAdminContext,
} from "@/lib/api/adminApi";
import {
  createRouteDiagnostics,
  logPortalServerError,
} from "@/lib/api/routeDiagnostics";
import { recordProjectLostConversion } from "@/lib/projects/workItems/lostConversion";
import { appIdFromUuid, isRecord, isUuid, uuidFromAppId } from "@/lib/supabase/mappers";

export const runtime = "nodejs";
const INACTIVE_DAYS = 30;

type ReportRow = {
  project_id: string;
  project_name: string;
  pipeline_stage: string;
  operational_state: string;
  waiting_until: string | null;
  owner_key: string | null;
  last_activity_at: string;
  last_activity_source: string;
  inactive_for_days: number;
  protected_by_future_wait: boolean;
  evidence_fingerprint: string;
};

function dateTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
}

function databaseError(error: unknown): { status: number; message: string } {
  const value = isRecord(error) ? error : {};
  const code = typeof value.code === "string" ? value.code : "";
  const message = typeof value.message === "string" ? value.message : "";
  if (code === "40001" || message.includes("STALE_REVIEW")) {
    return {
      status: 409,
      message: "The selected enquiry evidence changed. Refresh and review the exact list again.",
    };
  }
  if (code === "42501") return { status: 403, message: "Forbidden" };
  if (code === "22023" || code === "22P02") {
    return { status: 400, message: "Invalid stale-enquiry close command." };
  }
  return { status: 500, message: "Could not process the stale-enquiry review." };
}

export async function GET(req: Request) {
  const diagnostics = createRouteDiagnostics(
    req,
    "/api/admin/project-work/inactive-enquiries",
  );
  const auth = await requireAdminContext(diagnostics);
  if (!auth.ok) return auth.response;
  const reportAsOf = new Date().toISOString();
  const result = await auth.supabase.rpc("project_enquiry_inactivity_report_v1", {
    p_as_of: reportAsOf,
    p_inactive_days: INACTIVE_DAYS,
  });
  if (result.error) {
    logPortalServerError(diagnostics, {
      status: 500,
      message: "Failed to load inactive enquiry report",
      error: result.error,
    });
    return jsonError("Could not load the stale-enquiry review.", 500, diagnostics);
  }
  const rows = (result.data ?? []) as ReportRow[];
  return jsonOk(
    {
      reportAsOf,
      inactiveDays: INACTIVE_DAYS,
      candidateCount: rows.filter((row) => !row.protected_by_future_wait).length,
      candidates: rows.map((row) => ({
        projectId: appIdFromUuid("proj", row.project_id),
        projectName: row.project_name,
        pipelineStage: row.pipeline_stage,
        operationalState: row.operational_state,
        waitingUntil: dateTime(row.waiting_until),
        ownerKey: row.owner_key,
        lastActivityAt: dateTime(row.last_activity_at)!,
        lastActivitySource: row.last_activity_source,
        inactiveForDays: row.inactive_for_days,
        protectedByFutureWait: row.protected_by_future_wait,
        evidenceFingerprint: row.evidence_fingerprint,
      })),
    },
    200,
    diagnostics,
  );
}

export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(
    req,
    "/api/admin/project-work/inactive-enquiries",
  );
  const auth = await requireAdminContext(diagnostics);
  if (!auth.ok) return auth.response;
  const bodyResult = await parseJsonBody(req);
  if (!bodyResult.ok) return bodyResult.response;
  const body = isRecord(bodyResult.body) ? bodyResult.body : {};
  const reportAsOf = dateTime(body.reportAsOf);
  const commandId = typeof body.commandId === "string" ? body.commandId : "";
  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  if (
    !isUuid(commandId) ||
    !reportAsOf ||
    body.inactiveDays !== INACTIVE_DAYS ||
    candidates.length < 1 ||
    candidates.length > 100
  ) {
    return jsonError("Invalid stale-enquiry close command.", 400, diagnostics);
  }

  const dbCandidates: Array<Record<string, string>> = [];
  try {
    for (const raw of candidates) {
      if (!isRecord(raw)) throw new Error("invalid candidate");
      const projectId = typeof raw.projectId === "string" ? raw.projectId : "";
      const evidenceFingerprint =
        typeof raw.evidenceFingerprint === "string" ? raw.evidenceFingerprint : "";
      const lastActivityAt = dateTime(raw.lastActivityAt);
      const lastActivitySource =
        typeof raw.lastActivitySource === "string" ? raw.lastActivitySource.trim() : "";
      if (
        !/^[0-9a-f]{32}$/i.test(evidenceFingerprint) ||
        !lastActivityAt ||
        !lastActivitySource
      ) {
        throw new Error("invalid candidate");
      }
      dbCandidates.push({
        project_id: uuidFromAppId(projectId, "proj"),
        evidence_fingerprint: evidenceFingerprint,
        last_activity_at: lastActivityAt,
        last_activity_source: lastActivitySource,
      });
    }
  } catch {
    return jsonError("Invalid stale-enquiry candidate evidence.", 400, diagnostics);
  }

  try {
    const rpc = await auth.supabase.rpc("project_enquiry_bulk_close_v1", {
      p_command_id: commandId,
      p_report_as_of: reportAsOf,
      p_inactive_days: INACTIVE_DAYS,
      p_candidates: dbCandidates,
    });
    if (rpc.error) throw rpc.error;
    const raw = rpc.data as Record<string, unknown>;
    const projects = Array.isArray(raw.projects)
      ? raw.projects.filter(isRecord)
      : [];
    for (const project of projects) {
      await recordProjectLostConversion({
        supabase: auth.supabase,
        projectId: String(project.project_id),
        commandId: String(project.command_id),
        outcome: "LOST_NO_RESPONSE",
        replayed: Boolean(raw.replayed),
      });
    }
    return jsonOk(
      {
        command: {
          id: commandId,
          committed: true as const,
          replayed: Boolean(raw.replayed),
        },
        result: {
          reportAsOf: dateTime(raw.report_as_of) ?? reportAsOf,
          revalidatedAt: dateTime(raw.revalidated_at) ?? new Date().toISOString(),
          inactiveDays: Number(raw.inactive_days),
          closedCount: Number(raw.closed_count),
          projects: projects.map((project) => ({
            projectId: appIdFromUuid("proj", String(project.project_id)),
            commandId: String(project.command_id),
            rowVersion: Number(project.row_version),
            cancelledCount: Number(project.cancelled_count),
          })),
        },
      },
      200,
      diagnostics,
    );
  } catch (error) {
    const mapped = databaseError(error);
    if (mapped.status === 500) {
      logPortalServerError(diagnostics, {
        status: 500,
        message: "Failed to close inactive enquiries",
        error,
      });
    }
    return jsonError(mapped.message, mapped.status, diagnostics);
  }
}
