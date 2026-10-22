'use client';
import { useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { discardProjectPreviews, reconcileFolderPreviews, reconcileRootPreviews, setPreviewOwner } from './projectFilePreviewCache';
import { PortalAuthContext } from '@/components/auth/PortalAuthProvider';
import { Button, ButtonLink, DataStatePanel, Input, LoadingSkeleton, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/foundation';
import { ProjectFilesReadError, projectFileOpenHref } from '@/lib/projects/sharePointFiles/client';
import { useProjectFilesExplorer } from './useProjectFilesExplorer';
import { useProjectFilesListPosition } from './useProjectFilesListPosition';
import ProjectFilePreview from './ProjectFilePreview';
import { formatFileSize, ProjectFileIcon } from './projectFilePresentation';
import styles from './ProjectSharePointFilesPanel.module.css';

const states = {
  disabled: ['SharePoint files are not connected yet', 'Website enquiry files remain available.'],
  unlinked: ['No SharePoint folder linked yet', 'This project does not have a verified folder link.'],
  pending: ['Project folder is being prepared', 'Refresh shortly to see the new project folders.'],
  needs_attention: ['Project folder needs attention', 'Folder setup has not finished. Existing files remain safe.'],
} as const;
export default function ProjectSharePointFilesPanel(props: { projectId: string; host: string; disabled?: boolean; websiteFiles?: ReactNode; workspace?: boolean }) {
  const auth = useContext(PortalAuthContext);
  // Production uses the existing authenticated-owner QueryClient boundary. Isolated fixtures may omit the context; HTTP authorization is never bypassed.
  return <Explorer key={`${props.host}:${auth?.user?.id ?? 'fixture'}:${props.projectId}`} {...props} ownerId={auth?.user?.id ?? null} allowed={!auth || (auth.status === 'authenticated' && (auth.role === 'staff' || auth.role === 'admin'))} />;
}
function Explorer({ projectId, host, disabled = false, websiteFiles, ownerId, allowed, workspace = false }: { projectId: string; host: string; disabled?: boolean; websiteFiles?: ReactNode; ownerId: string | null; allowed: boolean; workspace?: boolean }) {
  const client = useQueryClient();
  const previewOwner = ownerId && allowed ? JSON.stringify([host, ownerId]) : null;
  const model = useProjectFilesExplorer(projectId, host, ownerId, !disabled && allowed);
  const { navigation: nav, query, roots, first, rootPage, allItems, rootFolders, scope } = model;
  const [expanded, setExpanded] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const wasExpanded = useRef(false);
  const [compact, setCompact] = useState(false);
  const rootId = first?.rootId ?? nav.rootId;
  const denied = !allowed || Boolean(rootPage && rootId && !rootPage.roots.some(root => root.id === rootId)) || [query.error, roots.error].some(error => error instanceof ProjectFilesReadError && [401, 403].includes(error.status));
  const sourceFailed = query.isError || roots.isError;
  const items = denied || sourceFailed || first?.state !== 'ready' ? [] : allItems;
  const selected = items.find(item => item.kind === 'file' && item.id === nav.selectedId);
  useEffect(() => { setPreviewOwner(client, previewOwner); }, [client, previewOwner]);
  useEffect(() => {
    if (!previewOwner) return;
    if (rootPage) reconcileRootPreviews(client, previewOwner, projectId, rootPage.roots.map(root => root.id));
    if (denied || sourceFailed || first && first.state !== 'ready') discardProjectPreviews(client, previewOwner, projectId);
    else if (first?.state === 'ready' && rootId) reconcileFolderPreviews(client, previewOwner, projectId, rootId, first.folderId ?? '', allItems, !query.hasNextPage);
  }, [client, previewOwner, projectId, denied, sourceFailed, query.dataUpdatedAt, roots.dataUpdatedAt, first, rootId, query.hasNextPage]);
  const term = nav.term.trim().toLocaleLowerCase();
  const matches = items.filter(item => !term || item.name.toLocaleLowerCase().includes(term));
  const photos = items.filter(item => item.viewable && item.contentType?.startsWith('image/'));
  useLayoutEffect(() => {
    const node = panelRef.current;
    if (!node) return;
    const measure = () => setCompact(node.clientWidth <= 960);
    measure(); const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const scrollScope = nav.term ? `${scope}:find:${nav.term}` : scope;
  const listPosition = useProjectFilesListPosition({ listRef, scope: scrollScope, savedTop: nav.scrolls[scrollScope] ?? 0,
    ready: model.hydrated && !query.isFetching && !query.isError && ((query.data?.pages.length ?? 0) >= Math.min(nav.pageCounts[scope] ?? 1, 10) || !query.hasNextPage),
    hasMore: Boolean(query.hasNextPage), save: top => model.update(value => ({ ...value, scrolls: { ...value.scrolls, [scrollScope]: top } })) });
  useEffect(() => {
    // Modal cleanup restores its original trigger first. Gallery changes should
    // then return to the current row/control, never a removed previous file.
    if (wasExpanded.current && !expanded) {
      const target = compact ? listRef.current?.querySelector<HTMLButtonElement>('button[aria-current="true"]') : expandButtonRef.current;
      target?.focus({ preventScroll: true });
    }
    wasExpanded.current = expanded;
  }, [expanded, compact]);
  const select = (id: string) => { listPosition.takeControl(); model.update(value => ({ ...value, selectedId: id })); if (compact) setExpanded(true); };
  const navigate: typeof model.navigate = (...args) => { setExpanded(false); model.navigate(...args); };
  const refresh = () => { setPreviewRevision(value => value + 1); model.refresh(); };
  if (disabled) return null;
  const hasMore = query.hasNextPage;
  const readError = (query.error ?? roots.error) instanceof Error ? (query.error ?? roots.error)!.message : 'Try again. Your folder position is kept.';
  const unavailable = denied || sourceFailed || first?.state !== 'ready';
  const visibleRoots = denied ? [] : rootPage?.roots ?? [];
  return <section ref={panelRef} className={`${styles.panel} ${workspace ? styles.workspace : ''}`} aria-label="SharePoint project files">
    <header className={styles.header}><div><h3>Files</h3><p className={styles.metadata}>{nav.source === 'website' ? 'Website enquiry attachments' : 'SharePoint'}{query.isFetching ? ' · Updating…' : query.dataUpdatedAt ? ` · Checked ${new Date(query.dataUpdatedAt).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}` : ''}</p></div><div className={styles.headerControls}>
      <Select aria-label="Project folder" value={nav.source === 'website' ? 'website' : nav.rootId ?? rootPage?.rootId ?? ''} onChange={event => { if (event.target.value === 'website') { setExpanded(false); model.update(value => ({ ...value, source: 'website' })); } else navigate([], event.target.value); }}>
        {!visibleRoots.length && <option value={nav.rootId ?? ''}>Project folder</option>}{visibleRoots.map(root => <option key={root.id} value={root.id}>{root.label}</option>)}{websiteFiles && <option value="website">Website enquiry files</option>}
      </Select><Button variant="quiet" size="small" onClick={refresh} disabled={query.isFetching || nav.source === 'website'}>Refresh files</Button></div></header>
    <div className={styles.explorer}>
      <nav className={styles.rail} aria-label="Project folders"><Button variant="quiet" size="small" aria-current={!nav.trail.length && nav.source === 'sharepoint' ? 'page' : undefined} onClick={() => navigate([])}>Project folder</Button>
        {!denied && rootFolders.map(folder => <Button key={folder.id} variant="quiet" size="small" aria-current={nav.source === 'sharepoint' && nav.trail[0]?.id === folder.id ? 'page' : undefined} onPointerEnter={() => model.prepareFolder(folder.id)} onFocus={() => model.prepareFolder(folder.id)} onClick={() => navigate([{ id: folder.id, name: folder.name }])}><ProjectFileIcon folder />{folder.name}</Button>)}
        {!denied && nav.trail.slice(1).map((part, index) => <Button key={part.id} variant="quiet" size="small" onClick={() => navigate(nav.trail.slice(0, index + 2))}><ProjectFileIcon folder />{part.name}</Button>)}
        {!denied && roots.hasNextPage && <Button size="small" variant="quiet" disabled={roots.isFetching} onClick={() => void roots.fetchNextPage()}>More project folders</Button>}
        {websiteFiles && <Button size="small" variant="quiet" aria-current={nav.source === 'website' ? 'page' : undefined} onClick={() => { setExpanded(false); model.update(value => ({ ...value, source: 'website' })); }}>Website enquiry files</Button>}
      </nav>
      {nav.source === 'website' ? <div className={styles.website}>{websiteFiles}</div> : <>
        <div className={styles.browser}>
          <div className={styles.toolbar}><nav className={styles.breadcrumbs} aria-label="Folder path"><Button size="small" variant="quiet" onClick={() => navigate([])}>Project folder</Button>{!denied && nav.trail.map((part, index) => <span key={part.id}>/<Button size="small" variant="quiet" onClick={() => navigate(nav.trail.slice(0, index + 1))}>{part.name}</Button></span>)}</nav><Input aria-label="Find in this folder" placeholder="Find in this folder" value={nav.term} maxLength={200} onChange={event => model.find(event.target.value)} /></div>
          {nav.trail.length > 0 && <Button size="small" variant="quiet" onClick={() => navigate(nav.trail.slice(0, -1))}>Back to {nav.trail.length > 1 ? nav.trail.at(-2)!.name : 'project folder'}</Button>}
          {denied ? <DataStatePanel state="error" title="File access is unavailable" description="The staff file request was denied. Refresh to check current access." onRetry={model.refresh} />
            : !model.hydrated || query.isPending ? <div className={styles.state}><LoadingSkeleton rows={5} columns={2} label="Loading project files" /></div>
              : sourceFailed ? <div className={styles.state}><DataStatePanel state="error" title="SharePoint files could not be loaded" description={readError} onRetry={model.refresh} /></div>
                : first && first.state !== 'ready' ? <div className={styles.state}><DataStatePanel state="empty" title={states[first.state][0]} description={states[first.state][1]} /></div>
                  : <><div className={styles.finding} role="status">{term ? `${matches.length} matches · ${items.length} items checked${hasMore ? ' · More files remain' : ' · Folder complete'}` : `${items.length} items${hasMore ? ' loaded · More files available' : ' · Folder complete'}`}{model.scanning ? ' · Finding…' : ''}</div>
                    <div ref={listRef} className={styles.list} aria-label="Files list" tabIndex={0} onScroll={listPosition.onScroll} onWheel={listPosition.takeControl} onTouchMove={listPosition.takeControl} onPointerDown={event => { if (event.target === event.currentTarget) listPosition.takeControl(); }} onKeyDown={event => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) listPosition.takeControl(); }}>
                      {matches.length ? <Table className={styles.filesTable}><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Size</TableHead><TableHead><span className={styles.srOnly}>Download</span></TableHead></TableRow></TableHeader><TableBody>{matches.map(item => <TableRow key={item.id} className={nav.selectedId === item.id ? styles.selected : undefined}>
                        <TableCell><button type="button" className={styles.filename} onPointerEnter={() => { if (item.kind === 'folder') model.prepareFolder(item.id); }} onFocus={() => { if (item.kind === 'folder') model.prepareFolder(item.id); }} aria-current={nav.selectedId === item.id ? 'true' : undefined} onClick={() => item.kind === 'folder' ? navigate([...nav.trail, { id: item.id, name: item.name }]) : select(item.id)}><span className={styles.fileIcon}><ProjectFileIcon folder={item.kind === 'folder'} /></span><span>{item.name}<small>{item.kind === 'folder' ? 'Folder' : item.viewable ? 'Preview available' : 'Original download'}</small></span></button></TableCell>
                        <TableCell>{item.kind === 'file' ? formatFileSize(item.size) : ''}</TableCell><TableCell>{item.kind === 'file' && rootId ? <ButtonLink href={projectFileOpenHref(projectId, rootId, item.id, 'download')} prefetch={false} target="_blank" rel="noopener noreferrer" variant="quiet" size="small" aria-label={`Download ${item.name}`}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg></ButtonLink> : null}</TableCell>
                      </TableRow>)}</TableBody></Table> : <p className={styles.empty}>{term ? hasMore ? 'No matches in the files checked so far. More files remain.' : 'No files match this name in this folder.' : 'This folder is empty.'}</p>}
                      {hasMore && <div className={styles.paging}><Button variant="secondary" size="small" disabled={query.isFetching || model.scanning} onClick={() => void (term ? model.loadBatch() : query.fetchNextPage())}>{query.isFetching ? 'Loading files…' : term ? 'Continue finding in this folder' : 'Load more files'}</Button></div>}
                    </div></>}
        </div>
        {!unavailable && selected && rootId ? <ProjectFilePreview key={rootId} item={selected} rootId={rootId} projectId={projectId} expanded={expanded} onExpandedChange={setExpanded} expandButtonRef={expandButtonRef} photos={photos} onSelect={select} revision={previewRevision} onSourceChanged={model.refresh} previewScope={previewOwner ? { owner: previewOwner, projectId, rootId, itemId: selected.id, folderId: first!.folderId ?? '' } : null} /> : <aside className={styles.inspector}><p className={styles.empty}>{nav.selectedId && hasMore ? 'Load more files to restore the selected file.' : 'Select a file to preview or download.'}</p></aside>}
      </>}
    </div>
  </section>;
}
