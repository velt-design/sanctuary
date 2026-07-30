import 'server-only';

import { getDesignBookletContentCatalog } from './marketingContent';
import {
  designBookletPdfFilename,
  generateDesignBookletPdf,
} from './pdf';
import {
  DesignBookletRequestError,
  parseDesignBookletFormData,
} from './request';

export async function handleDesignBookletPdfRequest(
  request: Request,
): Promise<Response> {
  try {
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
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'Content-Length': String(pdfBytes.byteLength),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const isRequestError = error instanceof DesignBookletRequestError;
    return Response.json(
      {
        error: isRequestError
          ? error.message
          : 'The design booklet PDF could not be generated.',
      },
      {
        status: isRequestError ? 400 : 500,
        headers: { 'Cache-Control': 'private, no-store, max-age=0' },
      },
    );
  }
}
