import "server-only";

import { jsonError } from "@/lib/api/staffApi";
import { DesignBookletRequestError } from "./request";
import { ProjectDesignBookletError } from "./projectPersistence";
import { DesignBookletImageProcessorUnavailableError } from "./sharpRuntime";

export function privateProjectDesignBookletResponse(
  response: Response,
): Response {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export function projectDesignBookletErrorResponse(
  error: unknown,
  fallbackMessage: string,
): Response {
  if (error instanceof ProjectDesignBookletError) {
    return privateProjectDesignBookletResponse(
      jsonError(error.message, error.status, null, { code: error.code }),
    );
  }
  if (error instanceof DesignBookletRequestError) {
    return privateProjectDesignBookletResponse(
      jsonError(error.message, error.status, null, {
        code: "invalid_booklet_draft",
      }),
    );
  }
  if (error instanceof DesignBookletImageProcessorUnavailableError) {
    return privateProjectDesignBookletResponse(
      jsonError(error.message, 503, null, {
        code: "image_processor_unavailable",
      }),
    );
  }
  console.error("[design-booklets]", error);
  return privateProjectDesignBookletResponse(jsonError(fallbackMessage, 500));
}
