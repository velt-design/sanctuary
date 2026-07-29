import 'server-only';

import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { POST as submitEnquiry } from '../route';
import { buildEnquiryFallbackPayload } from '../../../../lib/enquiryFallback';
import { isAllowedMarketingOrigin } from '../../../../lib/marketingPublicRequest';

const MAX_FALLBACK_BODY_BYTES = 128 * 1024;

async function readBoundedBody(req: Request): Promise<ArrayBuffer | null> {
  const reader = req.body?.getReader();
  if (!reader) return new ArrayBuffer(0);

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_FALLBACK_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

function failureDocument(status: number): string {
  const isRateLimited = status === 429;
  const heading = isRateLimited
    ? 'Please wait before trying again.'
    : 'Your enquiry was not sent.';
  const detail = isRateLimited
    ? 'We received several recent attempts. Please wait a few minutes, then return to the form.'
    : 'Use your browser’s Back button to return to the form. Most browsers will keep what you entered.';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Enquiry not sent | Sanctuary Pergolas</title>
  <style>
    :root{color-scheme:light}
    *{box-sizing:border-box}
    body{margin:0;background:#eceee9;color:#171916;font-family:Arial,sans-serif}
    main{width:min(42rem,calc(100% - 2rem));margin:12vh auto;padding:clamp(1.5rem,5vw,3rem);border:1px solid #b8bcb4;background:#f8f8f5}
    h1{margin:0 0 1rem;font-size:clamp(2rem,7vw,4rem);line-height:.95}
    p{font-size:1.05rem;line-height:1.55}
    a{color:inherit;text-underline-offset:.2em}
  </style>
</head>
<body>
  <main>
    <h1>${heading}</h1>
    <p>${detail}</p>
    <p>You can also call <a href="tel:+64228545633">022 854 5633</a> or email <a href="mailto:info@sanctuarypergolas.co.nz">info@sanctuarypergolas.co.nz</a>.</p>
    <p><a href="/contact#contact-form">Return to the enquiry form</a></p>
  </main>
</body>
</html>`;
}

function htmlFailure(status: number): Response {
  return new Response(failureDocument(status), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function forwardedHeaders(req: Request): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  for (const name of [
    'cookie',
    'origin',
    'referer',
    'user-agent',
    'x-forwarded-for',
    'x-real-ip',
  ]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

export async function POST(req: Request) {
  if (!isAllowedMarketingOrigin(req)) return htmlFailure(403);

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (
    Number.isFinite(contentLength)
    && contentLength > MAX_FALLBACK_BODY_BYTES
  ) {
    return htmlFailure(413);
  }

  const contentType = (req.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/x-www-form-urlencoded')) {
    return htmlFailure(415);
  }

  let body: ArrayBuffer | null;
  try {
    body = await readBoundedBody(req);
  } catch {
    return htmlFailure(400);
  }
  if (!body) return htmlFailure(413);

  let formData: FormData;
  try {
    formData = await new Request(req.url, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    }).formData();
  } catch {
    return htmlFailure(400);
  }

  const payload = buildEnquiryFallbackPayload(formData, randomUUID());
  let result: Response;
  try {
    result = await submitEnquiry(new Request(
      new URL('/api/enquiry', req.url),
      {
        method: 'POST',
        headers: forwardedHeaders(req),
        body: JSON.stringify(payload),
      },
    ));
  } catch {
    return htmlFailure(503);
  }
  const resultBody = await result.json().catch(() => null);

  if (result.ok && resultBody?.ok === true) {
    return NextResponse.redirect(new URL('/contact/thanks', req.url), 303);
  }

  return htmlFailure(result.status >= 400 ? result.status : 503);
}
