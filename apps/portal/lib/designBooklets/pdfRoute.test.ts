// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createToniDesignBookletDraft } from "./defaults";
import { DESIGN_BOOKLET_MAX_REQUEST_BODY_BYTES } from "./request";
import { handleDesignBookletPdfRequest } from "./pdfRoute";
import { DesignBookletImageProcessorUnavailableError } from "./sharpRuntime";

const { generateDesignBookletPdfMock } = vi.hoisted(() => ({
  generateDesignBookletPdfMock: vi.fn(),
}));

vi.mock("./pdf", () => ({
  designBookletPdfFilename: vi.fn(() => "design-booklet.pdf"),
  generateDesignBookletPdf: generateDesignBookletPdfMock,
}));

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
  beforeEach(() => {
    generateDesignBookletPdfMock.mockReset();
  });

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

  it("returns a controlled 503 when the native image processor is unavailable", async () => {
    const formData = new FormData();
    formData.set("draft", JSON.stringify(createToniDesignBookletDraft()));
    generateDesignBookletPdfMock.mockRejectedValueOnce(
      new DesignBookletImageProcessorUnavailableError(),
    );

    const response = await handleDesignBookletPdfRequest(
      new Request("http://localhost/api/design-booklet", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Image processing is temporarily unavailable.",
    });
  });
});
