'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { normalizeProjectStatus, PROJECT_STATUS_ORDER, nextActionTypeLabel, projectStatusLabel } from '@/lib/types/project';
import styles from './projects.module.css';
import PageHeader from '@/components/layout/PageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsListQueryOptions } from '@/lib/queries/contacts';
import { projectPageSnapshotQueryOptions, projectsListQueryOptions } from '@/lib/queries/projects';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import Modal from '@/components/ui/modal/Modal';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { deleteProject } from '@/lib/repo/projectsRepo';

function toYmd(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

const EXTRA_DELETE_CONFIRM_STAGES = new Set<Project['status']>(['DEPOSIT', 'SCHEDULED', 'COMPLETED', 'PAID']);

function requiredDeleteConfirmation(projectId: string, status: Project['status'] | null | undefined): string {
  const normalized = (status ?? 'NEW') as Project['status'];
  return EXTRA_DELETE_CONFIRM_STAGES.has(normalized) ? `DELETE ${projectId}` : 'DELETE';
}

export default function ProjectsIndexClient({ mode }: { mode?: 'page' | 'loading' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { role } = usePortalSession();
  const isAdmin = role === 'admin';
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Project['status'] | 'all'>('all');
  const [dueFilter, setDueFilter] = useState<'all' | 'due' | 'overdue' | 'today'>('all');
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleteBusy, setIsDeleteBusy] = useState(false);

  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const queryClient = useQueryClient();
  const prefetchedSnapshotsRef = useRef(new Set<string>());

  const isLoadingMode = mode === 'loading';
  const { data: projectsData, error: projectsError, refetch: refetchProjects } = useQuery({
    ...projectsListQueryOptions(host),
    enabled: !isLoadingMode,
    refetchOnMount: !isLoadingMode,
  });
  const { data: contactsData, error: contactsError } = useQuery({
    ...contactsListQueryOptions(host),
    enabled: !isLoadingMode,
    refetchOnMount: !isLoadingMode,
  });

  const projects = projectsData ?? [];
  const contacts = contactsData ?? [];
  const hasLoadedProjectsOnce = typeof projectsData !== 'undefined';

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const statusParam = (searchParams.get('status') || '').trim();
    if (!statusParam) {
      setStatusFilter('all');
    } else if (statusParam.toLowerCase() === 'all') {
      setStatusFilter('all');
    } else {
      const normalized = normalizeProjectStatus(statusParam);
      setStatusFilter(normalized.status ?? 'all');
    }

    const queryParam = (searchParams.get('q') || '').trim();
    setQuery(queryParam);

    const dueParam = (searchParams.get('due') || '').trim().toLowerCase();
    const dueFlag = (searchParams.get('nextActionDue') || '').trim().toLowerCase();
    if (dueParam === 'overdue' || dueParam === 'today') {
      setDueFilter(dueParam as 'overdue' | 'today');
    } else if (['1', 'true', 'yes', 'y'].includes(dueFlag)) {
      setDueFilter('due');
    } else if (dueParam === 'due') {
      setDueFilter('due');
    } else {
      setDueFilter('all');
    }
  }, [searchParams]);

  useEffect(() => {
    if (isLoadingMode) return;
    if (!projectsError) return;
    if (projects.length) {
      toast.error("Couldn't refresh projects (showing last saved).");
      return;
    }
    const msg = projectsError instanceof Error ? projectsError.message : 'Failed to load projects.';
    toast.error(msg);
  }, [isLoadingMode, projects.length, projectsError, toast]);

  useEffect(() => {
    if (isLoadingMode) return;
    if (!contactsError) return;
    if (contacts.length) {
      toast.error("Couldn't refresh contacts (showing last saved).");
      return;
    }
    const msg = contactsError instanceof Error ? contactsError.message : 'Failed to load contacts.';
    toast.error(msg);
  }, [contacts.length, contactsError, isLoadingMode, toast]);

  useEffect(() => {
    const t = searchParams.get('toast');
    if (t === 'project_deleted') {
      toast.success('Project deleted.');
      router.replace('/staff/projects');
    }
  }, [router, searchParams, toast]);

  const contactsById = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const c of contacts) map.set(c.id, c);
    return map;
  }, [contacts]);

  const todayYmd = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const filteredProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return projects.filter((p) => {
      if (statusFilter !== 'all' && (p.status ?? 'NEW') !== statusFilter) return false;

      const nextAction = toYmd(p.nextActionDate ?? p.followUpDate);
      if (dueFilter !== 'all') {
        if (!nextAction) return false;
        if (dueFilter === 'due' && nextAction > todayYmd) return false;
        if (dueFilter === 'overdue' && nextAction >= todayYmd) return false;
        if (dueFilter === 'today' && nextAction !== todayYmd) return false;
      }

      if (!needle) return true;

      const contact = p.contactId ? contactsById.get(p.contactId) : null;
      const text = [
        p.projectName ?? p.name ?? '',
        p.clientName ?? '',
        contact?.displayName ?? '',
        contact?.email ?? '',
        p.region ?? '',
        p.siteAddress ?? p.address ?? '',
        p.quoteRef ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return text.includes(needle);
    });
  }, [contactsById, dueFilter, projects, query, statusFilter, todayYmd]);

  const prefetchProjectSnapshot = (projectId: string) => {
    const token = `${host}:${projectId}`;
    if (prefetchedSnapshotsRef.current.has(token)) return;
    prefetchedSnapshotsRef.current.add(token);
    void queryClient.prefetchQuery(projectPageSnapshotQueryOptions(host, projectId));
  };

  useEffect(() => {
    if (isLoadingMode || !filteredProjects.length) return;
    for (const project of filteredProjects.slice(0, 3)) {
      prefetchProjectSnapshot(project.id);
    }
  }, [filteredProjects, isLoadingMode]);

  const closeDeleteModal = () => {
    if (isDeleteBusy) return;
    setDeleteTarget(null);
    setDeleteConfirmText('');
    setDeleteReason('');
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
                  placeholder="Name, client, address…"
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
            {!hydrated ? (
              <p className={styles.note}>Loading projects…</p>
            ) : !hasLoadedProjectsOnce && !projectsError ? (
              <p className={styles.note}>Loading projects…</p>
            ) : filteredProjects.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Client</th>
                      <th>Region</th>
                      <th>Status</th>
                      <th>Next action</th>
                      <th>Last activity</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((p) => {
                      const nextActionDate = toYmd(p.nextActionDate ?? p.followUpDate) ?? '';
                      const due = nextActionDate ? nextActionDate <= todayYmd : false;
                      const overdue = nextActionDate ? nextActionDate < todayYmd : false;
                      const lastActivity = p.activity?.[0]?.createdAt ?? p.updatedAt ?? p.createdAt;
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
                          <td className={styles.muted}>
                            {(() => {
                              const contact = p.contactId ? contactsById.get(p.contactId) : null;
                              return contact?.displayName ?? p.clientName ?? '—';
                            })()}
                          </td>
                          <td className={styles.muted}>{p.region ?? '—'}</td>
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
                          <td className={styles.muted}>
                            {nextActionDate || '—'}
                            {p.nextActionType ? (
                              <span className={styles.muted} style={{ marginLeft: 8, fontSize: 12 }}>
                                {nextActionTypeLabel(p.nextActionType as any)}
                              </span>
                            ) : null}{' '}
                            {due ? <span className={styles.dueBadge}>{overdue ? 'Overdue' : 'Due today'}</span> : null}
                          </td>
                          <td className={styles.muted}>{new Date(lastActivity).toLocaleString()}</td>
                          <td>
                            <div className={styles.rowActions}>
                              <Link
                                className={styles.link}
                                href={`/staff/projects/${encodeURIComponent(p.id)}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                Open
                              </Link>
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
                    await refetchProjects();
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
