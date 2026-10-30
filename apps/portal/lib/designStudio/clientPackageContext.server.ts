import "server-only";
import { requireStaffContext, jsonError } from "@/lib/api/staffApi";
import { getSupabaseServiceRole } from "@/lib/supabaseClient";
import { studioIdentifier } from "./identifiers";
/** Auth-bound quote visibility precedes every privileged package operation. */
export async function studioPackageContext(
  request: Request,
  quoteVersionId: string,
) {
  if (process.env.ENABLE_PORTAL_DESIGN_STUDIO !== "1")
    return { ok: false as const, response: jsonError("Not found", 404) };
  const auth = await requireStaffContext();
  if (!auth.ok) return auth;
  if (!["staff", "admin"].includes(auth.session.role))
    return {
      ok: false as const,
      response: jsonError("Staff access required", 403),
    };
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return {
      ok: false as const,
      response: jsonError("Request origin is not allowed", 403),
    };
  let id;
  try {
    id = studioIdentifier(quoteVersionId, "qv");
  } catch {
    return { ok: false as const, response: jsonError("Quote not found", 404) };
  }
  const visible = await auth.supabase
    .from("quote_versions")
    .select("id,commercial_revision,pdf_file_id,quotes!inner(project_id)")
    .eq("id", id.uuid)
    .abortSignal(request.signal)
    .maybeSingle();
  if (visible.error)
    return {
      ok: false as const,
      response: jsonError("Could not verify quote access", 503),
    };
  const quote = visible.data as unknown as {
    id: string;
    commercial_revision: number;
    pdf_file_id?: string | null;
    quotes: { project_id: string } | { project_id: string }[];
  } | null;
  const project = Array.isArray(quote?.quotes)
    ? quote.quotes[0]
    : quote?.quotes;
  if (!quote || quote.id !== id.uuid || !project?.project_id)
    return { ok: false as const, response: jsonError("Quote not found", 404) };
  return {
    ok: true as const,
    id,
    projectId: project.project_id,
    commercialRevision: quote.commercial_revision,
    financialFileId: quote.pdf_file_id ?? null,
    actorId: auth.session.user.id,
    auth,
    service: getSupabaseServiceRole(),
  };
}
export type StudioPackageContext = Extract<
  Awaited<ReturnType<typeof studioPackageContext>>,
  { ok: true }
>;
export async function packageRpc(
  context: StudioPackageContext,
  name: string,
  extra: Record<string, unknown> = {},
) {
  const result = await context.service.rpc(name, {
    p_quote_version_id: context.id.uuid,
    p_actor_user_id: context.actorId,
    ...extra,
  });
  if (result.error)
    throw Error(
      result.error.message?.includes("stale")
        ? "This package changed in another window. Reload it before editing."
        : result.error.message?.includes("prepared")
          ? "Edit the prepared package before changing its contents."
          : result.error.message?.includes("ready")
            ? "The selected design booklet is still being prepared."
            : result.error.message?.includes("too_large")
              ? "The selected views are too large. Choose fewer or smaller images."
              : "The package could not be updated. Check its current state and retry.",
    );
  return result.data;
}
