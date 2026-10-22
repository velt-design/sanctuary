'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, ButtonLink, DataStatePanel, LoadingSkeleton, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/foundation';
import type { ProjectFilesPage } from '@/lib/projects/sharePointFiles/types';
import styles from './ProjectEnquiryFilesPanel.module.css';
import layout from './ProjectSharePointFilesPanel.module.css';

const states = {
  disabled: ['SharePoint files are not connected yet', 'Website enquiry files are available below.'],
  unlinked: ['No SharePoint folder linked yet', 'Existing folders need a verified project match.'],
  pending: ['Project folder is being prepared', 'Refresh shortly to see the new project folders.'],
  needs_attention: ['Project folder needs attention', 'Folder setup has not finished. Contact an administrator; existing files remain safe.'],
} as const;
export default function ProjectSharePointFilesPanel({ projectId, host, disabled = false }: { projectId: string; host: string; disabled?: boolean }) {
  const [rootId, setRootId] = useState<string>();
  const [trail, setTrail] = useState<{ id: string; name: string }[]>([]);
  const [cursors, setCursors] = useState<string[]>([]);
  const folderId = trail.at(-1)?.id;
  const query = useQuery({
    queryKey: ['project-sharepoint-files', host, projectId, rootId, folderId, cursors.at(-1)],
    enabled: !disabled, retry: false, staleTime: 30000,
    queryFn: async (): Promise<ProjectFilesPage> => {
      const params = new URLSearchParams();
      if (rootId) params.set('rootId', rootId);
      if (folderId) params.set('folderId', folderId);
      if (cursors.length) params.set('cursor', cursors.at(-1)!);
      const response = await fetch(`/api/staff/v1/projects/${encodeURIComponent(projectId)}/files?${params}`, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Files unavailable');
      return response.json();
    },
  });
  if (disabled) return null;
  if (query.isPending) return <LoadingSkeleton rows={3} columns={3} label="Loading SharePoint files" />;
  if (query.isError) return <DataStatePanel state="error" title="SharePoint files could not be loaded" description="Your files have not changed. Try again, or ask an administrator to check the connection." onRetry={() => void query.refetch()} />;
  const page = query.data;
  if (page.state !== 'ready') return <div className={styles.panel}><DataStatePanel state="empty" title={states[page.state][0]} description={states[page.state][1]} /><Button variant="tertiary" size="small" onClick={() => void query.refetch()}>Refresh files</Button></div>;
  const href = (id: string, mode: string) => `/api/staff/v1/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(id)}/open?${new URLSearchParams({ rootId: page.rootId!, mode })}`;
  return <section className={styles.panel} aria-label="SharePoint project files">
    <h3>Project files</h3>
    {page.roots.length > 1 ? <Select label="Project folder" aria-label="Project folder" value={page.rootId ?? ''} onChange={event => { setRootId(event.target.value); setTrail([]); setCursors([]); }}>{page.roots.map(root => <option key={root.id} value={root.id}>{root.label}</option>)}</Select> : <p>{page.roots[0]?.label}</p>}
    <div className={styles.actions}>
      {trail.length > 0 && <Button variant="secondary" size="small" onClick={() => { setTrail(trail.slice(0, -1)); setCursors([]); }}>Back to {trail.length > 1 ? trail[trail.length - 2].name : 'project folder'}</Button>}
      <Button variant="tertiary" size="small" onClick={() => void query.refetch()}>Refresh files</Button>
    </div>
    {trail.length > 0 && <p aria-live="polite">{trail.map(part => part.name).join(' / ')}</p>}
    {page.items.length ? <Table className={layout.filesTable}><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Size</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>
      {page.items.map(item => <TableRow key={item.id}><TableCell>{item.kind === 'folder' ? <Button variant="tertiary" size="small" onClick={() => { setRootId(page.rootId!); setTrail([...trail, { id: item.id, name: item.name }]); setCursors([]); }}>{item.name}</Button> : <strong className={styles.filename}>{item.name}</strong>}</TableCell><TableCell>{item.kind === 'file' ? `${(item.size / 1048576).toFixed(1)} MB` : 'Folder'}</TableCell><TableCell>{item.kind === 'file' && <div className={styles.actions}>{item.viewable && <ButtonLink href={href(item.id, 'view')} prefetch={false} target="_blank" rel="noopener noreferrer" variant="secondary" size="small">View</ButtonLink>}<ButtonLink href={href(item.id, 'download')} prefetch={false} target="_blank" rel="noopener noreferrer" variant="tertiary" size="small">Download</ButtonLink></div>}</TableCell></TableRow>)}
    </TableBody></Table> : <p>This folder is empty.</p>}
    <div className={styles.actions}>{cursors.length > 0 && <Button variant="secondary" size="small" onClick={() => setCursors(cursors.slice(0, -1))}>Previous page</Button>}{page.cursor && <Button variant="secondary" size="small" onClick={() => { setRootId(page.rootId!); setCursors([...cursors, page.cursor!]); }}>Next page</Button>}</div>
    <h3>Website enquiry files</h3>
  </section>;
}
