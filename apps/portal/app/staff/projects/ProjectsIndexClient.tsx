'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { PROJECT_STATUS_ORDER, projectStatusLabel } from '@/lib/types/project';
import styles from './projects.module.css';
import PageHeader from '@/components/layout/PageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsListQueryOptions } from '@/lib/queries/contacts';
import { projectPageSnapshotQueryOptions, projectsListQueryOptions } from '@/lib/queries/projects';
import { qk } from '@/lib/queries/keys';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import Modal from '@/components/ui/modal/Modal';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { deleteProject } from '@/lib/repo/projectsRepo';
import {
  buildContactsById,
  filterProjectsForIndex,
  parseProjectsIndexFilters,
  type ArchiveFilter,
  type ProjectsIndexFilters,
} from './projectIndexFilters';

const EXTRA_DELETE_CONFIRM_STAGES = new Set<Project['status']>(['DEPOSIT', 'SCHEDULED', 'COMPLETED', 'PAID']);

function requiredDeleteConfirmation(projectId: string, status: Project['status'] | null | undefined): string {
  const normalized = (status ?? 'NEW') as Project['status'];
  return EXTRA_DELETE_CONFIRM_STAGES.has(normalized) ? `DELETE ${projectId}` : 'DELETE';
}

export default function ProjectsIndexClient({
  initialProjects,
  initialContacts,
  initialFilters,
  initialTodayYmd,
}: {
  initialProjects: Project[];
  initialContacts: Contact[];
  initialFilters: ProjectsIndexFilters;
  initialTodayYmd: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { role } = usePortalSession();
  const isAdmin = role === 'admin';
  const [query, setQuery] = useState(initialFilters.query);
  const [statusFilter, setStatusFilter] = useState<Project['status'] | 'all'>(initialFilters.statusFilter);
  const [dueFilter, setDueFilter] = useState<'all' | 'due' | 'overdue' | 'today'>(initialFilters.dueFilter);
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>(initialFilters.archiveFilter);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleteBusy, setIsDeleteBusy] = useState(false);
  const [archiveBusyId, setArchiveBusyId] = useState<string | null>(null);

  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const queryClient = useQueryClient();
  const prefetchedSnapshotsRef = useRef(new Set<string>());

  const includeArchived = archiveFilter !== 'active';
  const { data: projectsData, error: projectsError } = useQuery({
    ...projectsListQueryOptions(host, { includeArchived }),
    initialData: initialProjects,
  });
  const { data: contactsData, error: contactsError } = useQuery({
    ...contactsListQueryOptions(host),
    initialData: initialContacts,
  });

  const projects = projectsData ?? [];
  const contacts = contactsData ?? [];

  useEffect(() => {
    const nextFilters = parseProjectsIndexFilters(searchParams);
    setStatusFilter(nextFilters.statusFilter);
    setQuery(nextFilters.query);
    setDueFilter(nextFilters.dueFilter);
    setArchiveFilter(nextFilters.archiveFilter);
  }, [searchParams]);

  useEffect(() => {
    if (!projectsError) return;
    if (projects.length) {
      toast.error("Couldn't refresh projects (showing last saved).");
      return;
    }
    const msg = projectsError instanceof Error ? projectsError.message : 'Failed to load projects.';
    toast.error(msg);
  }, [projects.length, projectsError, toast]);

  useEffect(() => {
    if (!contactsError) return;
    if (contacts.length) {
      toast.error("Couldn't refresh contacts (showing last saved).");
      return;
    }
    const msg = contactsError instanceof Error ? contactsError.message : 'Failed to load contacts.';
    toast.error(msg);
  }, [contacts.length, contactsError, toast]);

  useEffect(() => {
    const t = searchParams.get('toast');
    if (t === 'project_deleted') {
      toast.success('Project deleted.');
      router.replace('/staff/projects');
    }
  }, [router, searchParams, toast]);

  const contactsById = useMemo(() => {
    return buildContactsById(contacts);
  }, [contacts]);

  const filteredProjects = useMemo(() => {
    return filterProjectsForIndex(
      projects,
      contactsById,
      {
        query,
        statusFilter,
        dueFilter,
        archiveFilter,
      },
      initialTodayYmd,
    );
  }, [archiveFilter, contactsById, dueFilter, initialTodayYmd, projects, query, statusFilter]);

  const prefetchProjectSnapshot = (projectId: string) => {
    const token = `${host}:${projectId}`;
    if (prefetchedSnapshotsRef.current.has(token)) return;
    prefetchedSnapshotsRef.current.add(token);
    void queryClient.prefetchQuery(projectPageSnapshotQueryOptions(host, projectId));
  };

  useEffect(() => {
    if (!filteredProjects.length) return;
    for (const project of filteredProjects.slice(0, 3)) {
      prefetchProjectSnapshot(project.id);
    }
  }, [filteredProjects]);

  const closeDeleteModal = () => {
    if (isDeleteBusy) return;
    setDeleteTarget(null);
    setDeleteConfirmText('');
    setDeleteReason('');
  };

  const toggleArchive = async (project: Project) => {
    if (archiveBusyId) return;
    const willArchive = !project.isArchived;
    setArchiveBusyId(project.id);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}/details`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          project: { archivedAt: willArchive ? new Date().toISOString() : null },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = typeof body?.error === 'string' ? body.error : willArchive ? 'Failed to archive project' : 'Failed to unarchive project';
        throw new Error(msg);
      }
      toast.success(willArchive ? 'Project archived.' : 'Project restored.');
      await queryClient.invalidateQueries({ queryKey: qk.projects.listPrefix(host) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update archive state';
      toast.error(msg);
    } finally {
      setArchiveBusyId(null);
    }
  };

  const requiredDeleteText = deleteTarget ? requiredDeleteConfirmation(deleteTarget.id, deleteTarget.status ?? 'NEW') : '';

  return (
    <main className={styles.page}>
      <PageHeader
        title="Projects"
        right={
          <HeaderActions>
            <Link className={styles.button} href="/staff/projects/design-packages">
              Drafting Queue
            </Link>
            <Link className={styles.button} href="/staff/projects/running-jobs">
              Running Jobs
            </Link>
            <Link className={styles.button} href="/staff/projects/new">
              New Project
            </Link>
          </HeaderActions>
        }
      />

      <div className={styles.stack}>
        <section className={styles.section} aria-label="Filters">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Filters</h2>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="projectSearch">Search</label>
                <input
                  id="projectSearch"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name, client, phone, address…"
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="projectStatusFilter">Status</label>
                <select id="projectStatusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                  <option value="all">All</option>
                  {PROJECT_STATUS_ORDER.map((status) => (
                    <option key={status} value={status}>
                      {projectStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="projectArchiveFilter">Archive</label>
                <select
                  id="projectArchiveFilter"
                  value={archiveFilter}
                  onChange={(e) => setArchiveFilter(e.target.value as ArchiveFilter)}
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                  <option value="all">All</option>
                </select>
              </div>

              <div className={styles.field} style={{ display: 'flex', flexDirection: 'column' }}>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={dueFilter !== 'all'}
                    onChange={(e) => setDueFilter(e.target.checked ? 'due' : 'all')}
                  />
                  <span className={styles.checkboxText}>Next action due (today + overdue)</span>
                </label>
                <div className={styles.muted} style={{ marginTop: 6, fontSize: 12 }}>
                  {dueFilter === 'overdue'
                    ? 'Shows overdue actions only'
                    : dueFilter === 'today'
                      ? 'Shows actions due today'
                      : 'Shows projects with next action date ≤ today'}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-label="Projects list">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>All Projects</h2>
            <span className={styles.muted} suppressHydrationWarning>
              {filteredProjects.length} shown
            </span>
          </div>
          <div className={styles.sectionBody}>
            {filteredProjects.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Client</th>
                      <th>Phone</th>
                      <th>Address</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((p) => {
                      const contact = p.contactId ? contactsById.get(p.contactId) : null;
                      const clientLabel = contact?.displayName ?? p.clientName ?? '—';
                      const phoneLabel = contact?.phone || (p as { phone?: string }).phone || '—';
                      const addressLabel = p.siteAddress ?? p.address ?? '—';
                      const isArchiveBusy = archiveBusyId === p.id;
                      return (
                        <tr
                          key={p.id}
                          className={styles.rowClickable}
                          tabIndex={0}
                          onClick={() => {
                            prefetchProjectSnapshot(p.id);
                            router.push(`/staff/projects/${encodeURIComponent(p.id)}`);
                          }}
                          onMouseEnter={() => prefetchProjectSnapshot(p.id)}
                          onFocus={() => prefetchProjectSnapshot(p.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') router.push(`/staff/projects/${encodeURIComponent(p.id)}`);
                          }}
                        >
                          <td>{p.projectName ?? p.name ?? '—'}</td>
                          <td className={styles.muted}>{clientLabel}</td>
                          <td className={styles.muted}>{phoneLabel}</td>
                          <td className={styles.muted}>{addressLabel}</td>
                          <td>
                            <span className={styles.statusPill}>{projectStatusLabel(p.status ?? 'NEW')}</span>
                            {p.isLost ? (
                              <span className={styles.dueBadge} style={{ marginLeft: 8 }}>
                                Lost
                              </span>
                            ) : null}
                            {p.isArchived ? (
                              <span className={styles.dueBadge} style={{ marginLeft: 8 }}>
                                Archived
                              </span>
                            ) : null}
                          </td>
                          <td>
                            <div className={styles.rowActions}>
                              <Link
                                className={styles.link}
                                href={`/staff/projects/${encodeURIComponent(p.id)}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                Open
                              </Link>
                              <button
                                type="button"
                                className={styles.link}
                                disabled={isArchiveBusy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void toggleArchive(p);
                                }}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                {isArchiveBusy
                                  ? p.isArchived
                                    ? 'Restoring…'
                                    : 'Archiving…'
                                  : p.isArchived
                                    ? 'Unarchive'
                                    : 'Archive'}
                              </button>
                              {isAdmin ? (
                                <button
                                  type="button"
                                  className={styles.linkDanger}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteTarget(p);
                                    setDeleteConfirmText('');
                                    setDeleteReason('');
                                  }}
                                  onKeyDown={(e) => e.stopPropagation()}
                                >
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.note}>
                {projects.length ? 'No projects match this filter.' : 'No projects yet. Click “New Project” to create one.'}
              </p>
            )}
          </div>
        </section>
      </div>

      {deleteTarget ? (
        <Modal
          open
          ariaLabel="Delete project confirmation"
          onClose={closeDeleteModal}
          overlayClassName={styles.modalOverlay}
          panelClassName={styles.modal}
          maxWidthPx={560}
        >
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Delete project?</h2>
            <button type="button" className={styles.modalClose} onClick={closeDeleteModal}>
              Close
            </button>
          </div>

          <p className={styles.note}>
            This is a hard delete. Project data and linked records are permanently removed.
          </p>
          <p className={styles.note} style={{ marginTop: 8 }}>
            Stage: <strong>{projectStatusLabel(deleteTarget.status ?? 'NEW')}</strong>
          </p>
          <p className={styles.note} style={{ marginTop: 8 }}>
            Type <strong>{requiredDeleteText}</strong> to confirm.
          </p>

          <div className={styles.field} style={{ marginTop: 12 }}>
            <label htmlFor="delete-project-confirm-text">Confirmation</label>
            <input
              id="delete-project-confirm-text"
              className={styles.inlineInput}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className={styles.field} style={{ marginTop: 10 }}>
            <label htmlFor="delete-project-reason">Reason (optional)</label>
            <input
              id="delete-project-reason"
              className={styles.inlineInput}
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            />
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.buttonSecondary} onClick={closeDeleteModal} disabled={isDeleteBusy}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.buttonDanger}
              disabled={isDeleteBusy || deleteConfirmText.trim().toUpperCase() !== requiredDeleteText.toUpperCase()}
              onClick={() => {
                if (!deleteTarget || isDeleteBusy) return;
                setIsDeleteBusy(true);
                void (async () => {
                  try {
                    await deleteProject(deleteTarget.id, {
                      confirmText: deleteConfirmText.trim(),
                      reason: deleteReason.trim() || null,
                    });
                    toast.success('Project deleted.');
                    setDeleteTarget(null);
                    setDeleteConfirmText('');
                    setDeleteReason('');
                    await queryClient.invalidateQueries({ queryKey: qk.projects.listPrefix(host) });
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Failed to delete project';
                    toast.error(msg);
                  } finally {
                    setIsDeleteBusy(false);
                  }
                })();
              }}
            >
              {isDeleteBusy ? 'Deleting...' : 'Delete project'}
            </button>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
