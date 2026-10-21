import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { documentDiagnosticsEnabled, readDocumentDiagnostics } from './documentDiagnostics';

// This cache shares only the diagnostic scope in one RSC render, alongside the
// existing auth cache. Route handlers do not gain cached access from it.
export const getDocumentRenderDiagnostics = cache(async () => {
  if (!documentDiagnosticsEnabled()) return null;
  try { return readDocumentDiagnostics(new Headers(await headers())); }
  catch { return null; }
});
