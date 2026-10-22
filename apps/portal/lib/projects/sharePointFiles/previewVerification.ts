import { strongFileVersion } from './fileVersion';

export const PREVIEW_VERSION_REQUEST_HEADER = 'x-project-file-preview-version';
export type PreviewVerification = {
  kind: 'project-file-current-v1'; projectId: string; rootId: string; itemId: string;
  version: string; name: string; contentType: string; size: number;
};
const keys = ['kind', 'projectId', 'rootId', 'itemId', 'version', 'name', 'contentType', 'size'];
/** A protected JSON receipt, never an HTTP304 or an unverified body's ETag. */
export async function readPreviewVerification(response: Response): Promise<PreviewVerification> {
  const reader = response.body?.getReader(); if (!reader) throw new Error('Preview verification is unavailable.');
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 8192) throw new Error('Preview verification is unavailable.'); chunks.push(part.value); }
  } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('Preview verification is unavailable.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Preview verification is unavailable.');
  const data = value as Record<string, unknown>;
  if (Object.keys(data).length !== keys.length || !keys.every(key => Object.hasOwn(data, key)) || data.kind !== 'project-file-current-v1'
    || !['projectId', 'rootId', 'itemId', 'name', 'contentType'].every(key => typeof data[key] === 'string' && data[key].length > 0 && data[key].length <= 400 && !/[\x00-\x1f\x7f]/.test(data[key]))
    || typeof data.version !== 'string' || !strongFileVersion(data.version) || typeof data.size !== 'number' || !Number.isSafeInteger(data.size) || data.size < 0 || data.size > 50_000_000) throw new Error('Preview verification is unavailable.');
  return data as PreviewVerification;
}
