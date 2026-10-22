'use client';
import { lazy, Suspense, type RefObject } from 'react';
import Modal from '@/components/ui/modal/Modal';
import { Button, ButtonLink, DataStatePanel } from '@/components/ui/foundation';
import type { ProjectFilesPage } from '@/lib/projects/sharePointFiles/types';
import { projectFileOpenHref } from '@/lib/projects/sharePointFiles/client';
import styles from './ProjectSharePointFilesPanel.module.css';
import { formatFileSize } from './projectFilePresentation';
import { useProjectFilePreview } from './useProjectFilePreview';
import type { PreviewScope } from './projectFilePreviewCache';

const PdfPreview = lazy(() => import('../QuotePdfInlinePreview'));
type Item = ProjectFilesPage['items'][number];
const INLINE_LIMIT = 50_000_000;
export default function ProjectFilePreview({ item, rootId, projectId, expanded, onExpandedChange, expandButtonRef, photos, onSelect, revision, previewScope, onSourceChanged }: {
  item: Item; rootId: string; projectId: string; expanded: boolean; onExpandedChange: (open: boolean) => void; expandButtonRef: RefObject<HTMLButtonElement | null>; photos: Item[]; onSelect: (id: string) => void; revision: number; previewScope: PreviewScope | null; onSourceChanged: () => void;
}) {
  const inline = item.viewable && item.size <= INLINE_LIMIT;
  const href = projectFileOpenHref(projectId, rootId, item.id, 'download');
  const { result, retry, imageError } = useProjectFilePreview({ url: inline ? projectFileOpenHref(projectId, rootId, item.id, 'view') : null, item, scope: previewScope, revision, onChanged: onSourceChanged });
  const name = result?.name ?? item.name;
  const position = photos.findIndex(photo => photo.id === item.id);
  const body = !inline ? <p className={styles.previewNotice}>{item.size > INLINE_LIMIT ? 'Above the 50 MB preview limit. Download the original to open it.' : 'Download the original to open it in its own app.'}</p>
    : result?.error ? <DataStatePanel state="error" title="Preview unavailable" description={result.error} onRetry={retry} />
      : result?.stream ? <Suspense fallback={<p role="status">Preparing PDF viewer…</p>}><PdfPreview source={result.stream} /></Suspense>
      : result?.data ? <Suspense fallback={<p role="status">Preparing PDF viewer…</p>}><PdfPreview data={result.data} /></Suspense>
        : result?.image ? <img className={styles.image} src={result.image} alt={name} onError={imageError} />
          : <p className={styles.previewNotice} role="status">Loading preview…</p>;
  const actions = (includeExpand = false) => <div className={styles.actions}><ButtonLink href={href} prefetch={false} target="_blank" rel="noopener noreferrer" variant="secondary" size="small">Download original</ButtonLink>{inline && includeExpand ? <Button ref={expandButtonRef} variant="tertiary" size="small" onClick={() => onExpandedChange(true)}>Expand preview</Button> : null}</div>;
  const gallery = position >= 0 && photos.length > 1 ? <div className={styles.actions} aria-label="Photo navigation"><Button size="small" variant="secondary" disabled={position === 0} onClick={() => onSelect(photos[position - 1].id)}>Previous photo</Button><span>{position + 1} / {photos.length} loaded</span><Button size="small" variant="secondary" disabled={position === photos.length - 1} onClick={() => onSelect(photos[position + 1].id)}>Next photo</Button></div> : null;
  return <><aside className={styles.inspector} aria-label="Selected file"><h4>{name}</h4><p className={styles.metadata}>{formatFileSize(item.size)}{item.modifiedAt ? ` · ${new Date(item.modifiedAt).toLocaleDateString('en-NZ')}` : ''}</p>{actions(true)}{result?.checking ? <p className={styles.metadata} role="status">Checking latest…</p> : null}<div className={styles.previewBody}>{expanded ? <p>Preview open</p> : body}</div>{gallery}</aside>
    <Modal open={expanded} onClose={() => onExpandedChange(false)} ariaLabel={`Preview ${name}`} maxWidthPx={1160} panelClassName={styles.previewModal}><div className={styles.previewHeader}><div><h3>{name}</h3>{actions()}</div><Button variant="tertiary" size="small" onClick={() => onExpandedChange(false)}>Close preview</Button></div><div className={styles.modalBody}>{body}</div>{gallery}</Modal></>;
}
