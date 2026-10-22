import { z } from 'zod';
import { graphId } from '../ids';

export const PREVIEW_BATCH_ITEMS = 8;
export const PREVIEW_BATCH_BYTES = 8 * 1024 * 1024;
export const PREVIEW_MEMORY_BYTES = 32 * 1024 * 1024;
export const PREVIEW_PHOTO_BYTES = 512 * 1024;
export const PREVIEW_PDF_BYTES = 5 * 1024 * 1024;
export const PREVIEW_SOURCE_BYTES = 10 * 1024 * 1024;
export const PREVIEW_SOURCE_BATCH_BYTES = 48 * 1024 * 1024;
export const PREVIEW_LEASE_MS = 5 * 60_000;
export const previewProfile = z.enum(['photo-v1', 'pdf-v1']);
const version = z.string().min(1).max(1024).regex(/^"[^"\r\n\x00-\x1f]+"$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const previewKnown = z.object({ version, hash, profile: previewProfile }).strict();
export const previewBatchRequest = z.object({
  rootId: z.uuid(), folderId: graphId,
  items: z.array(z.object({ id: graphId, known: previewKnown.optional() }).strict()).min(1).max(PREVIEW_BATCH_ITEMS),
}).strict().refine(value => new Set(value.items.map(item => item.id)).size === value.items.length);
export const cachedPreview = z.object({
  id: graphId, name: z.string().min(1).max(400), version, profile: previewProfile, hash,
  mime: z.enum(['image/jpeg', 'application/pdf']), size: z.number().int().positive().max(PREVIEW_PDF_BYTES),
  body: z.string().max(Math.ceil(PREVIEW_PDF_BYTES / 3) * 4).optional(),
}).strict().refine(value => value.profile === 'pdf-v1' ? value.mime === 'application/pdf' : value.mime === 'image/jpeg' && value.size <= PREVIEW_PHOTO_BYTES);
export type PreviewBatchRequest = z.infer<typeof previewBatchRequest>;
export type CachedPreview = z.infer<typeof cachedPreview>;
