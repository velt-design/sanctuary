import "server-only";

import { jsonError } from "@/lib/api/staffApi";
import { DesignBookletRequestError } from "./request";
import { ProjectDesignBookletError } from "./projectPersistence";

export function projectDesignBookletErrorResponse(
  error: unknown,
  fallbackMessage: string,
): Response {
  if (error instanceof ProjectDesignBookletError) {
    return jsonError(error.message, error.status, null, { code: error.code });
  }
  if (error instanceof DesignBookletRequestError) {
    return jsonError(error.message, error.status, null, {
      code: "invalid_booklet_draft",
    });
  }
  console.error("[design-booklets]", error);
  return jsonError(fallbackMessage, 500);
}
