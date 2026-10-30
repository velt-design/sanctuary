import "server-only";
import { jsonError, jsonOk } from "@/lib/api/staffApi";
import {
  studioPackageContext,
  packageRpc,
} from "./clientPackageContext.server";
import { readStudioPackage } from "./clientPackageState.server";
import { parseStudioPackageDraft } from "./clientPackage";
import { readStudioRequestBody } from "./readRequestBody.server";
import { assertStudioSeparateFiles } from "./clientPackageFiles.server";
export async function studioPackageRequest(
  request: Request,
  quoteVersionId: string,
) {
  const context = await studioPackageContext(request, quoteVersionId);
  if (!context.ok) return context.response;
  try {
    if (request.method === "PUT") {
      const body = (await readStudioRequestBody(request, 16000)) as {
        revision: number;
        value: unknown;
      };
      if (
        !body ||
        Object.keys(body).sort().join(",") !== "revision,value" ||
        !Number.isSafeInteger(body.revision) ||
        body.revision < 0
      )
        return jsonError("Invalid package revision", 400);
      const value = parseStudioPackageDraft(body.value);
      await assertStudioSeparateFiles(context, value.fileIds);
      await packageRpc(context, "studio_client_package_save", {
        p_expected_revision: body.revision,
        p_value: value,
      });
    }
    return jsonOk({
      package: await readStudioPackage(
        context,
        new URL(request.url).searchParams.get("status") !== "1",
      ),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "The client package could not be loaded.",
      409,
    );
  }
}
