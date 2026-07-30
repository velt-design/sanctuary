import "server-only";

import { getDesignBookletContentCatalog } from "./marketingContent";
import { designBookletPdfFilename, generateDesignBookletPdf } from "./pdf";
import {
  DESIGN_BOOKLET_MAX_REQUEST_BODY_BYTES,
  DesignBookletRequestError,
  parseDesignBookletFormData,
} from "./request";

function assertRequestBodySize(request: Request): void {
  const contentLength = request.headers.get("content-length");
  if (contentLength === null) return;

  const parsedLength = Number(contentLength);
  if (
    !/^\d+$/.test(contentLength) ||
    !Number.isSafeInteger(parsedLength) ||
    parsedLength < 0
  ) {
    throw new DesignBookletRequestError(
      "The design booklet request size is invalid.",
    );
  }
  if (parsedLength > DESIGN_BOOKLET_MAX_REQUEST_BODY_BYTES) {
    throw new DesignBookletRequestError(
      "The design booklet request is too large.",
      413,
    );
  }
}

export async function handleDesignBookletPdfRequest(
  request: Request,
): Promise<Response> {
  try {
    assertRequestBodySize(request);
    const formData = await request.formData();
    const input = await parseDesignBookletFormData(formData);
    const pdfBytes = await generateDesignBookletPdf({
      ...input,
      content: getDesignBookletContentCatalog(),
    });
    const filename = designBookletPdfFilename(input.draft.customerName);

    return new Response(pdfBytes as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Length": String(pdfBytes.byteLength),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const isRequestError = error instanceof DesignBookletRequestError;
    return Response.json(
      {
        error: isRequestError
          ? error.message
          : "The design booklet PDF could not be generated.",
      },
      {
        status: isRequestError ? error.status : 500,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }
}
