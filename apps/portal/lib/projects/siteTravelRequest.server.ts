import "server-only";
import {
  travelDrivingCostPerRoundTripCents,
  STUDIO_TRAVEL_POLICY,
} from "@sp/costing";
import { jsonError, jsonOk, requireStaffContext } from "@/lib/api/staffApi";
import { uuidFromAppId, isUuid, appIdFromUuid } from "@/lib/supabase/mappers";
import {
  parseStudioTravelAllowance,
  type StudioSelectedAddressProof,
} from "@/lib/designStudio/studioTravelAllowance";
import {
  assertStudioTravelSigningAvailable,
  signStudioTravelReceipt,
  signStudioSelectedAddress,
  verifyStudioSelectedAddress,
  verifyStudioTravelReceipt,
} from "@/lib/designStudio/studioTravelReceipt.server";
import { readProjectSiteAddress } from "./siteAddress.server";
import { googleSiteAddressProvider } from "./siteAddressProvider.server";
import { googleSiteTravelProvider } from "./siteTravelProvider.server";
import { readStudioRequestBody } from "@/lib/designStudio/readRequestBody.server";

async function handle(request: Request, projectId: string) {
  let response: Response;
  try {
    if (process.env.ENABLE_PORTAL_DESIGN_STUDIO !== "1")
      return jsonError("Not found", 404);
    const auth = await requireStaffContext();
    if (!auth.ok) return auth.response;
    if (!["staff", "admin"].includes(auth.session.role))
      return jsonError("Staff access required", 403);
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return jsonError("Request origin is not allowed", 403);
    const uuid = uuidFromAppId(projectId, "proj");
    if (!isUuid(uuid)) return jsonError("Invalid project", 400);
    projectId = appIdFromUuid("proj", uuid);
    const body = await readStudioRequestBody(request, 8192);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some(
        (key) => !["selectedAddressProof", "allowance"].includes(key),
      )
    )
      return jsonError("Invalid travel request", 400);
    const command = body as Record<string, unknown>;
    const current = await readProjectSiteAddress(
        auth.supabase,
        uuid,
        request.signal,
      ),
      destination = current.site_address ?? "";
    assertStudioTravelSigningAvailable();
    let placeId: string;
    let selectedAddressProof: StudioSelectedAddressProof | undefined;
    let revalidate = true;
    if (command.selectedAddressProof) {
      const selected =
        command.selectedAddressProof as StudioSelectedAddressProof;
      verifyStudioSelectedAddress(selected, projectId, destination, false);
      placeId = selected.placeId;
      selectedAddressProof = selected;
      revalidate = Date.now() - selected.issuedAt > 30 * 60 * 1000;
    } else {
      const basis = parseStudioTravelAllowance(command.allowance);
      if (
        basis.mode === "manual" ||
        (basis.mode === "pending" &&
          (!basis.placeId || !basis.destinationCanonical))
      )
        throw Error(
          "Choose a physical New Zealand site address before calculating travel.",
        );
      if (basis.mode === "automatic") {
        verifyStudioTravelReceipt(basis.receipt);
        if (
          basis.receipt.projectId !== projectId ||
          basis.receipt.destinationCanonical !== destination
        )
          throw Error(
            "The site address changed. Choose its physical address before calculating travel.",
          );
        placeId = basis.receipt.placeId;
      } else {
        if (basis.destinationCanonical !== destination)
          throw Error(
            "The site address changed. Choose its physical address before calculating travel.",
          );
        placeId = basis.placeId!;
      }
    }
    if (revalidate) {
      await googleSiteAddressProvider().validateSelection(
        {
          action: "select",
          requestId: crypto.randomUUID(),
          placeId,
          address: destination,
          sessionToken: crypto.randomUUID(),
          expectedUpdatedAt: current.updated_at,
        },
        request.signal,
      );
      selectedAddressProof = signStudioSelectedAddress({
        projectId,
        destinationCanonical: destination,
        placeId,
      });
    }
    const route = await googleSiteTravelProvider()(placeId, request.signal);
    // A late Project change must not issue an allowance for the previous destination.
    const latest = await readProjectSiteAddress(
      auth.supabase,
      uuid,
      request.signal,
    );
    if (latest.site_address !== destination)
      return jsonError(
        "The site address changed. Calculate travel again.",
        409,
      );
    const receipt = signStudioTravelReceipt({
      projectId,
      destinationCanonical: destination,
      placeId,
      drivingCostPerRoundTripCents: travelDrivingCostPerRoundTripCents(
        route.outboundSeconds,
        route.returnSeconds,
      ),
      overnightEligible:
        route.outboundSeconds > STUDIO_TRAVEL_POLICY.overnightPromptSeconds,
    });
    response = jsonOk({ receipt, selectedAddressProof, ...route });
  } catch (error) {
    response = jsonError(
      error instanceof Error
        ? error.message
        : "Travel calculation is unavailable. Retry.",
      422,
    );
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export async function projectSiteTravelRequest(
  request: Request,
  projectId: string,
) {
  const response = await handle(request, projectId);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
