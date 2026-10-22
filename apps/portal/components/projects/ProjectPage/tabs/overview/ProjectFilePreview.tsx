'use client';
import { lazy, Suspense, useEffect, useState, type RefObject } from 'react';
import Modal from '@/components/ui/modal/Modal';
import { Button, ButtonLink, DataStatePanel } from '@/components/ui/foundation';
import type { ProjectFilesPage } from '@/lib/projects/sharePointFiles/types';
import { projectFileOpenHref } from '@/lib/projects/sharePointFiles/client';
import styles from './ProjectSharePointFilesPanel.module.css';
import { formatFileSize } from './projectFilePresentation';

const PdfPreview = lazy(() => import('../QuotePdfInlinePreview'));
type Item = ProjectFilesPage['items'][number];
type Result = { url: string; data?: Uint8Array; image?: string; error?: string };
const INLINE_LIMIT = 50_000_000;
const rasterTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
function useFilePreview(url: string | null, revision: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const identity = `${url}:${revision}:${attempt}`;
  useEffect(() => {
    setResult(null);
    if (!url) return;
    const controller = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => { controller.abort(); if (!disposed) setResult({ url: identity, error: 'The preview timed out. Retry or download the original.' }); }, 50_000);
    let objectUrl: string | undefined;
    void (async () => {
      try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'File access is unavailable. Refresh Files to check access.' : response.status === 404 ? 'This file has moved or is no longer available. Refresh the folder.' : 'The preview could not be loaded. Retry or download the original.');
        const mime = response.headers.get('content-type')?.split(';')[0].trim() ?? '';
        if (mime !== 'application/pdf' && !rasterTypes.has(mime)) throw new Error('Download the original to open this file.');
        if (Number(response.headers.get('content-length') ?? 0) > INLINE_LIMIT) throw new Error('This preview exceeds 50 MB. Download the original instead.');
        const reader = response.body?.getReader();
        if (!reader) throw new Error('The preview body was unavailable.');
        let length = 0;
        const chunks: Uint8Array[] = [];
        try { for (;;) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength; if (length > INLINE_LIMIT) throw new Error('This preview exceeds 50 MB. Download the original instead.'); chunks.push(part.value); } }
        catch (error) { await reader.cancel().catch(() => undefined); throw error; }
        if (controller.signal.aborted || disposed) return;
        const data = new Uint8Array(length); let offset = 0;
        for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
        if (mime === 'application/pdf') setResult({ url: identity, data });
        else { objectUrl = URL.createObjectURL(new Blob([data], { type: mime })); setResult({ url: identity, image: objectUrl }); }
      } catch (error) { if (!disposed && !controller.signal.aborted) setResult({ url: identity, error: error instanceof Error ? error.message : 'Preview unavailable.' }); }
      finally { clearTimeout(timeout); }
    })();
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url, identity]);
  return { result: result?.url === identity ? result : null, retry: () => setAttempt(value => value + 1), imageError: () => setResult({ url: identity, error: 'The image could not be displayed. Retry or download the original.' }) };
}
export default function ProjectFilePreview({ item, rootId, projectId, expanded, onExpandedChange, expandButtonRef, photos, onSelect, revision }: {
  item: Item; rootId: string; projectId: string; expanded: boolean; onExpandedChange: (open: boolean) => void; expandButtonRef: RefObject<HTMLButtonElement | null>; photos: Item[]; onSelect: (id: string) => void; revision: number;
}) {
  const inline = item.viewable && item.size <= INLINE_LIMIT;
  const href = projectFileOpenHref(projectId, rootId, item.id, 'download');
  const { result, retry, imageError } = useFilePreview(inline ? projectFileOpenHref(projectId, rootId, item.id, 'view') : null, `${revision}:${item.modifiedAt ?? ''}`);
  const position = photos.findIndex(photo => photo.id === item.id);
  const body = !inline ? <p className={styles.previewNotice}>{item.size > INLINE_LIMIT ? 'Above the 50 MB preview limit. Download the original to open it.' : 'Download the original to open it in its own app.'}</p>
    : result?.error ? <DataStatePanel state="error" title="Preview unavailable" description={result.error} onRetry={retry} />
      : result?.data ? <Suspense fallback={<p role="status">Preparing PDF viewer…</p>}><PdfPreview data={result.data} /></Suspense>
        : result?.image ? <img className={styles.image} src={result.image} alt={item.name} onError={imageError} />
          : <p className={styles.previewNotice} role="status">Loading preview…</p>;
  const actions = (includeExpand = false) => <div className={styles.actions}><ButtonLink href={href} prefetch={false} target="_blank" rel="noopener noreferrer" variant="secondary" size="small">Download original</ButtonLink>{inline && includeExpand ? <Button ref={expandButtonRef} variant="tertiary" size="small" onClick={() => onExpandedChange(true)}>Expand preview</Button> : null}</div>;
  const gallery = position >= 0 && photos.length > 1 ? <div className={styles.actions} aria-label="Photo navigation"><Button size="small" variant="secondary" disabled={position === 0} onClick={() => onSelect(photos[position - 1].id)}>Previous photo</Button><span>{position + 1} / {photos.length} loaded</span><Button size="small" variant="secondary" disabled={position === photos.length - 1} onClick={() => onSelect(photos[position + 1].id)}>Next photo</Button></div> : null;
  return <><aside className={styles.inspector} aria-label="Selected file"><h4>{item.name}</h4><p className={styles.metadata}>{formatFileSize(item.size)}{item.modifiedAt ? ` · ${new Date(item.modifiedAt).toLocaleDateString('en-NZ')}` : ''}</p>{actions(true)}<div className={styles.previewBody}>{expanded ? <p>Preview open</p> : body}</div>{gallery}</aside>
    <Modal open={expanded} onClose={() => onExpandedChange(false)} ariaLabel={`Preview ${item.name}`} maxWidthPx={1160} panelClassName={styles.previewModal}><div className={styles.previewHeader}><div><h3>{item.name}</h3>{actions()}</div><Button variant="tertiary" size="small" onClick={() => onExpandedChange(false)}>Close preview</Button></div><div className={styles.modalBody}>{body}</div>{gallery}</Modal></>;
}
