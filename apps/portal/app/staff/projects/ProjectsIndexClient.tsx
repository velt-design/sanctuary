'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Project, ProjectStatus } from '@/lib/types/project';
import { PROJECT_STATUS_ORDER, projectStatusLabel } from '@/lib/types/project';
import styles from './projects.module.css';
import PageHeader from '@/components/layout/PageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import ListCountBanner from '@/components/ui/listBanner/ListCountBanner';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { useQueryClient } from '@tanstack/react-query';
import { ProjectRowTooltip, useProjectRowTooltip } from './ProjectRowTooltip';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import Modal from '@/components/ui/modal/Modal';
import { PIPELINE_MODAL_ACTION_CLASSES, PipelineModal } from '@/components/ui/PipelineModal';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { deleteProject } from '@/lib/repo/projectsRepo';
import {
  PIPELINE_STAGE_LABELS,
  normalizePipelineStageKey,
  requiresStageConfirmation,
  stageKeyToStatus,
  type PipelineStageKey,
} from '@/lib/projects/pipelineDefinition';
import {
  invalidateProjectsIndexCaches,
  removeProjectListItem,
} from '@/lib/queries/projectCache';
import { preloadProjectOpen, projectDetailHref } from '@/lib/queries/projectOpenPreload';
import { useProjectInstantOpen } from './ProjectInstantOpen';
import {
  buildContactsById,
  filterProjectsForIndex,
  parseProjectsIndexFilters,
  todayYmd,
  type ArchiveFilter,
  type ProjectsIndexFilters,
} from './projectIndexFilters';
import { useProjectsIndexData } from './useProjectsIndexData';
import { useProjectsIndexMutations } from './useProjectsIndexMutations';
import type { ProjectIndexEditableField } from './projectsIndexMutations';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import {
  ButtonLink,
  DataStatePanel,
  LoadingSkeleton,
  ProjectStageBadge,
  SearchFilterBar,
} from '@/components/ui/foundation';

type EditingState = { id: string; field: ProjectIndexEditableField; value: string } | null;
type StatusConfirmState = {
  projectId: string;
  current: PipelineStageKey;
  next: PipelineStageKey;
  label: string;
} | null;

const EXTRA_DELETE_CONFIRM_STAGES = new Set<Project['status']>(['DEPOSIT', 'SCHEDULED', 'COMPLETED', 'PAID']);

function requiredDeleteConfirmation(projectId: string, status: Project['status'] | null | undefined): string {
  const normalized = (status ?? 'NEW') as Project['status'];
  return EXTRA_DELETE_CONFIRM_STAGES.has(normalized) ? `DELETE ${projectId}` : 'DELETE';
}

export default function ProjectsIndexClient({
  initialFilters,
  initialTodayYmd,
}: {
  initialFilters?: ProjectsIndexFilters;
  initialTodayYmd?: string;
}) {
  const router = useRouter();
  const { finishInstantRoute } = usePortalRouteTransition();
  const { openProject } = useProjectInstantOpen();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { role } = usePortalSession();
  const isAdmin = role === 'admin';
  const initialFiltersRef = useRef(initialFilters ?? parseProjectsIndexFilters(searchParams));
  const currentTodayYmd = initialTodayYmd ?? todayYmd();
  const [query, setQuery] = useState(initialFiltersRef.current.query);
  const [statusFilter, setStatusFilter] = useState<NonNullable<Project['status']> | 'all'>(initialFiltersRef.current.statusFilter ?? 'all');
  const [dueFilter, setDueFilter] = useState<'all' | 'due' | 'overdue' | 'today'>(initialFiltersRef.current.dueFilter);
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>(initialFiltersRef.current.archiveFilter);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleteBusy, setIsDeleteBusy] = useState(false);
  const { visibleInfo, onRowEnter: handleRowMouseEnter, onRowLeave: handleRowMouseLeave } = useProjectRowTooltip();
  const [editing, setEditing] = useState<EditingState>(null);
  const [statusConfirm, setStatusConfirm] = useState<StatusConfirmState>(null);
  const [statusConfirmText, setStatusConfirmText] = useState('');
  const [statusReason, setStatusReason] = useState('');

  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);

  const queryClient = useQueryClient();
  const projectMutations = useProjectsIndexMutations(host);
  const projectsIndex = useProjectsIndexData(host, archiveFilter);
  const projects = projectsIndex.data?.projects.rows ?? [];
  const contacts = projectsIndex.data?.contacts.rows ?? [];

  useEffect(() => {
    finishInstantRoute('projects-index');
  }, [finishInstantRoute, searchParams]);

  useEffect(() => {
    const nextFilters = parseProjectsIndexFilters(searchParams);
    setStatusFilter(nextFilters.statusFilter ?? 'all');
    setQuery(nextFilters.query);
    setDueFilter(nextFilters.dueFilter);
    setArchiveFilter(nextFilters.archiveFilter);
  }, [searchParams]);

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
      currentTodayYmd,
    );
  }, [archiveFilter, contactsById, currentTodayYmd, dueFilter, projects, query, statusFilter]);

  const prepareProjectOpen = useCallback(
    (projectId: string) => {
      void preloadProjectOpen(queryClient, router, host, projectId);
    },
    [host, queryClient, router],
  );

  const closeDeleteModal = () => {
    if (isDeleteBusy) return;
    setDeleteTarget(null);
    setDeleteConfirmText('');
    setDeleteReason('');
  };

  const beginEdit = useCallback((project: Project, field: ProjectIndexEditableField, currentValue: string) => {
    if (projectMutations.isCellPending(project.id, field)) return;
    setEditing({ id: project.id, field, value: currentValue });
  }, [projectMutations]);

  const cancelEdit = useCallback(() => {
    setEditing(null);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editing) return;
    const project = projects.find((p) => p.id === editing.id);
    if (!project) {
      setEditing(null);
      return;
    }

    const trimmed = editing.value.trim();
    const field = editing.field;

    if (field === 'name' && !trimmed) {
      toast.error('Project name is required.');
      return;
    }

    let originalValue = '';
    if (field === 'name') originalValue = (project.projectName ?? project.name ?? '').trim();
    else if (field === 'address') originalValue = (project.siteAddress ?? project.address ?? '').trim();
    else if (field === 'phone') {
      const contact = project.contactId ? contactsById.get(project.contactId) : null;
      originalValue = (contact?.phone ?? (project as { phone?: string }).phone ?? '').trim();
    }

    if (trimmed === originalValue) {
      setEditing(null);
      return;
    }

    if (field === 'phone' && !project.contactId) {
      toast.error('Add a contact to this project before editing the phone number.');
      setEditing(null);
      return;
    }

    const contact = project.contactId ? contactsById.get(project.contactId) ?? null : null;
    void projectMutations.saveInlineEdit({ project, contact, field, value: trimmed });
    setEditing(null);
  }, [contactsById, editing, projectMutations, projects, toast]);

  const handleEditKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        void commitEdit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelEdit();
      }
    },
    [cancelEdit, commitEdit],
  );

  const applyStageCorrection = useCallback(
    (projectId: string, nextStage: PipelineStageKey, label: string, reasonText: string | null) => {
      const project = projects.find((entry) => entry.id === projectId);
      if (!project) return;
      void projectMutations.correctStage(project, { projectId, nextStage, reason: reasonText }, label);
    },
    [projectMutations, projects],
  );

  const handleStatusChange = useCallback(
    (project: Project, rawNext: string) => {
      const currentStage = normalizePipelineStageKey(project.status ?? 'NEW');
      const nextStage = normalizePipelineStageKey(rawNext);
      if (!currentStage || !nextStage || currentStage === nextStage) return;
      const label = PIPELINE_STAGE_LABELS[nextStage] ?? rawNext;

      if (!requiresStageConfirmation(currentStage, nextStage)) {
        void applyStageCorrection(project.id, nextStage, label, null);
        return;
      }

      setStatusConfirm({
        projectId: project.id,
        current: currentStage,
        next: nextStage,
        label,
      });
      setStatusConfirmText('');
      setStatusReason('');
    },
    [applyStageCorrection],
  );

  const closeStatusConfirm = () => {
    setStatusConfirm(null);
    setStatusConfirmText('');
    setStatusReason('');
  };

  const isStatusRollback = Boolean(
    statusConfirm &&
      PROJECT_STATUS_ORDER.indexOf(stageKeyToStatus(statusConfirm.next) as ProjectStatus) <
        PROJECT_STATUS_ORDER.indexOf(stageKeyToStatus(statusConfirm.current) as ProjectStatus),
  );

  const toggleArchive = (project: Project) => {
    if (projectMutations.isArchivePending(project.id)) return;
    void projectMutations.setArchived(project, !project.isArchived);
  };

  const requiredDeleteText = deleteTarget ? requiredDeleteConfirmation(deleteTarget.id, deleteTarget.status ?? 'NEW') : '';

  const visibleProject = visibleInfo ? filteredProjects.find((p) => p.id === visibleInfo.projectId) ?? null : null;
  const visibleFallback = visibleProject
    ? (() => {
        const c = visibleProject.contactId ? contactsById.get(visibleProject.contactId) : null;
        return c?.displayName ?? visibleProject.clientName ?? '';
      })()
    : '';

  return (
    <main
      className={styles.page}
      data-projects-index-state={projectsIndex.state}
      data-projects-index-background-ready={projectsIndex.backgroundReady ? 'true' : 'false'}
    >
      <PageHeader
        title="Projects"
        variant="index"
        description="Search, update and continue work across the project pipeline."
        count={`${projectsIndex.data?.projects.totalCount ?? projects.length} projects`}
        primaryAction={{ label: 'New project', href: '/staff/projects/new' }}
        right={
          <HeaderActions>
            <ButtonLink variant="tertiary" href="/staff/projects/design-packages">Drafting Queue</ButtonLink>
            <ButtonLink variant="secondary" href="/staff/projects/running-jobs">Running Jobs</ButtonLink>
          </HeaderActions>
        }
      />

      <ListCountBanner
        totalCount={projectsIndex.data?.projects.totalCount ?? null}
        visibleCount={projects.length}
        entityLabelSingular="project"
        entityLabelPlural="projects"
        truncated={projectsIndex.data?.projects.truncated ?? false}
      />
      <ListCountBanner
        totalCount={projectsIndex.data?.contacts.totalCount ?? null}
        visibleCount={contacts.length}
        entityLabelSingular="contact"
        entityLabelPlural="contacts"
        truncated={projectsIndex.data?.contacts.truncated ?? false}
      />

      <div className={styles.stack}>
        <section className={styles.section} aria-label="Filters">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Filters</h2>
          </div>
          <div className={styles.sectionBody}>
            <SearchFilterBar
              query={query}
              onQueryChange={setQuery}
              searchId="projectSearch"
              queryPlaceholder="Name, client, phone or address…"
              filters={[
                { id: 'projectStatusFilter', label: 'Status', value: statusFilter, onChange: (value) => setStatusFilter(value as NonNullable<Project['status']> | 'all'), options: [{ value: 'all', label: 'All statuses' }, ...PROJECT_STATUS_ORDER.map((status) => ({ value: status, label: projectStatusLabel(status) ?? status }))] },
                { id: 'projectArchiveFilter', label: 'Archive', value: archiveFilter, onChange: (value) => setArchiveFilter(value as ArchiveFilter), options: [{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }, { value: 'all', label: 'All' }] },
                { id: 'projectDueFilter', label: 'Next action', value: dueFilter, onChange: (value) => setDueFilter(value as typeof dueFilter), options: [{ value: 'all', label: 'Any date' }, { value: 'due', label: 'Due today or overdue' }, { value: 'overdue', label: 'Overdue' }, { value: 'today', label: 'Due today' }] },
              ]}
              onClearAll={() => { setQuery(''); setStatusFilter('all'); setArchiveFilter('active'); setDueFilter('all'); }}
            />
          </div>
        </section>

        <section className={styles.section} aria-label="Projects list">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>All Projects</h2>
            <div className={styles.muted} suppressHydrationWarning>
              {projectsIndex.state === 'pending' || projectsIndex.state === 'cached' ? 'Updating…' : null}
              {projectsIndex.state === 'fresh' ? `${filteredProjects.length} shown` : null}
              {projectsIndex.state === 'unavailable' ? 'Access unavailable' : null}
              {projectsIndex.state === 'refresh-failed' ? (
                <>
                  {projects.length ? 'Refresh failed · ' : null}
                  <button type="button" className={styles.link} onClick={() => void projectsIndex.retry()}>
                    Retry
                  </button>
                </>
              ) : null}
            </div>
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
                      const nameValue = (p.projectName ?? p.name ?? '').trim();
                      const phoneValue = (contact?.phone ?? (p as { phone?: string }).phone ?? '').trim();
                      const addressValue = (p.siteAddress ?? p.address ?? '').trim();
                      const isArchiveBusy = projectMutations.isArchivePending(p.id);
                      const isStatusBusyRow = projectMutations.isStagePending(p.id);
                      const phoneEditable = Boolean(p.contactId);

                      const renderEditable = (
                        field: ProjectIndexEditableField,
                        currentValue: string,
                        placeholder: string,
                        editable: boolean,
                      ) => {
                        const isEditing = editing?.id === p.id && editing.field === field;
                        const isSavingCell = projectMutations.isCellPending(p.id, field);

                        if (isEditing) {
                          return (
                            <input
                              type={field === 'phone' ? 'tel' : 'text'}
                              autoFocus
                              size={1}
                              className={styles.editableCellInput}
                              value={editing.value}
                              placeholder={placeholder}
                              disabled={isSavingCell}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setEditing({ id: p.id, field, value: e.target.value })}
                              onBlur={() => {
                                void commitEdit();
                              }}
                              onKeyDown={handleEditKeyDown}
                            />
                          );
                        }

                        if (!editable) {
                          return <span className={styles.muted}>{currentValue || '—'}</span>;
                        }

                        return (
                          <button
                            type="button"
                            className={styles.editableCell}
                            onClick={(e) => {
                              e.stopPropagation();
                              beginEdit(p, field, currentValue);
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            {currentValue || <span className={styles.muted}>{placeholder}</span>}
                            {isSavingCell ? <span className={styles.syncStatus}>Saving…</span> : null}
                          </button>
                        );
                      };

                      const rowEl = (
                        <tr
                          key={p.id}
                          className={styles.rowClickable}
                          tabIndex={0}
                          onClick={() => {
                            prepareProjectOpen(p.id);
                            openProject(p.id);
                          }}
                          onMouseEnter={(e) => {
                            prepareProjectOpen(p.id);
                            handleRowMouseEnter(p.id, e);
                          }}
                          onMouseLeave={() => handleRowMouseLeave()}
                          onFocus={() => prepareProjectOpen(p.id)}
                          onPointerDown={() => prepareProjectOpen(p.id)}
                          onTouchStart={() => prepareProjectOpen(p.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              prepareProjectOpen(p.id);
                              openProject(p.id);
                            }
                          }}
                        >
                          <td>{renderEditable('name', nameValue, 'Project name', true)}</td>
                          <td className={styles.muted}>{clientLabel}</td>
                          <td>
                            {renderEditable(
                              'phone',
                              phoneValue,
                              phoneEditable ? 'Add phone' : 'No contact linked',
                              phoneEditable,
                            )}
                          </td>
                          <td>{renderEditable('address', addressValue, 'Add address', true)}</td>
                          <td>
                            <ProjectStageBadge stage={normalizePipelineStageKey(p.status ?? 'NEW') ?? 'new'} compact />
                            <select
                              className={styles.inlineSelect}
                              value={(p.status ?? 'NEW') as ProjectStatus}
                              disabled={isStatusBusyRow}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleStatusChange(p, e.target.value);
                              }}
                            >
                              {PROJECT_STATUS_ORDER.map((status) => (
                                <option key={status} value={status}>
                                  {projectStatusLabel(status)}
                                </option>
                              ))}
                            </select>
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
                                href={projectDetailHref(p.id)}
                                prefetch={false}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                                  e.preventDefault();
                                  prepareProjectOpen(p.id);
                                  openProject(p.id);
                                }}
                                onFocus={() => prepareProjectOpen(p.id)}
                                onMouseEnter={() => prepareProjectOpen(p.id)}
                                onPointerDown={() => prepareProjectOpen(p.id)}
                                onTouchStart={() => prepareProjectOpen(p.id)}
                              >
                                Open
                              </Link>
                              <button
                                type="button"
                                className={styles.link}
                                disabled={isArchiveBusy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleArchive(p);
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

                      return rowEl;
                    })}
                  </tbody>
                </table>
              </div>
            ) : projectsIndex.state === 'pending' || projectsIndex.state === 'cached' ? (
              <LoadingSkeleton rows={5} columns={4} label="Updating projects…" />
            ) : projectsIndex.state === 'unavailable' ? (
              <DataStatePanel state="unavailable" />
            ) : projectsIndex.state === 'refresh-failed' ? (
              <DataStatePanel state={projects.length ? 'stale' : 'error'} onRetry={() => void projectsIndex.retry()} />
            ) : (
              <DataStatePanel
                state={projects.length ? 'filtered-empty' : 'empty'}
                onClear={projects.length ? () => { setQuery(''); setStatusFilter('all'); setArchiveFilter('active'); setDueFilter('all'); } : undefined}
              />
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
                    removeProjectListItem(queryClient, host, deleteTarget.id);
                    await invalidateProjectsIndexCaches(queryClient, host);
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

      {statusConfirm ? (
        <PipelineModal
          open
          onOpenChange={(open) => {
            if (!open) closeStatusConfirm();
          }}
          title="Correct stage"
          description={`Correct from ${PIPELINE_STAGE_LABELS[statusConfirm.current]} to ${statusConfirm.label}.`}
          actions={
            <>
              <button
                type="button"
                className={PIPELINE_MODAL_ACTION_CLASSES.primary}
                disabled={isStatusRollback && statusConfirmText.trim().toUpperCase() !== 'RESET'}
                onClick={() => {
                  if (!statusConfirm) return;
                  applyStageCorrection(
                    statusConfirm.projectId,
                    statusConfirm.next,
                    statusConfirm.label,
                    statusReason.trim() || null,
                  );
                  setStatusConfirm(null);
                  setStatusConfirmText('');
                  setStatusReason('');
                }}
              >
                {`Move to ${statusConfirm.label}`}
              </button>
              <button
                type="button"
                className={PIPELINE_MODAL_ACTION_CLASSES.secondary}
                onClick={closeStatusConfirm}
              >
                Cancel
              </button>
            </>
          }
        >
          <p className={styles.note}>Silent correction only: this does not trigger automations or customer comms.</p>

          {isStatusRollback ? (
            <>
              <p className={styles.note} style={{ marginTop: 10 }}>
                Rollback: manual task checkmarks from this stage and later stages will be reset.
              </p>
              <div className={styles.field} style={{ marginTop: 10 }}>
                <label htmlFor="index-stage-confirm-text">Type RESET to confirm rollback</label>
                <input
                  id="index-stage-confirm-text"
                  className={styles.inlineInput}
                  value={statusConfirmText}
                  onChange={(e) => setStatusConfirmText(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </>
          ) : null}

          <div className={styles.field} style={{ marginTop: 10 }}>
            <label htmlFor="index-stage-reason">Reason (optional)</label>
            <input
              id="index-stage-reason"
              className={styles.inlineInput}
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
            />
          </div>
        </PipelineModal>
      ) : null}

      <ProjectRowTooltip host={host} visibleInfo={visibleInfo} fallbackClientName={visibleFallback} />

    </main>
  );
}
