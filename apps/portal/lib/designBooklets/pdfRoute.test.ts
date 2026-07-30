// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { DESIGN_BOOKLET_MAX_REQUEST_BODY_BYTES } from "./request";
import { handleDesignBookletPdfRequest } from "./pdfRoute";

function declaredSizeRequest(contentLength: string): {
  formData: ReturnType<typeof vi.fn>;
  request: Request;
} {
  const formData = vi.fn(async () => new FormData());
  return {
    formData,
    request: {
      headers: new Headers({ "content-length": contentLength }),
      formData,
    } as unknown as Request,
  };
}

describe("design booklet PDF request boundary", () => {
  it("returns 413 before parsing multipart data when Content-Length exceeds the request ceiling", async () => {
    const { formData, request } = declaredSizeRequest(
      String(DESIGN_BOOKLET_MAX_REQUEST_BODY_BYTES + 1),
    );

    const response = await handleDesignBookletPdfRequest(request);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: "The design booklet request is too large.",
    });
    expect(formData).not.toHaveBeenCalled();
  });

  it("allows multipart parsing at the request ceiling", async () => {
    const { formData, request } = declaredSizeRequest(
      String(DESIGN_BOOKLET_MAX_REQUEST_BODY_BYTES),
    );

    const response = await handleDesignBookletPdfRequest(request);

    expect(response.status).toBe(400);
    expect(formData).toHaveBeenCalledOnce();
  });

  it("rejects a malformed declared request size before multipart parsing", async () => {
    const { formData, request } = declaredSizeRequest("not-a-number");

    const response = await handleDesignBookletPdfRequest(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "The design booklet request size is invalid.",
    });
    expect(formData).not.toHaveBeenCalled();
  });
});
