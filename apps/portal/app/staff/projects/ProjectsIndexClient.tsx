'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Project, ProjectStatus } from '@/lib/types/project';
import { PROJECT_STATUS_ORDER, projectStatusLabel } from '@/lib/types/project';
import styles from './ProjectsIndexClient.module.css';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import ListCountBanner from '@/components/ui/listBanner/ListCountBanner';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { useQueryClient } from '@tanstack/react-query';
import { ProjectRowTooltip, useProjectRowTooltip } from './ProjectRowTooltip';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { PipelineModal } from '@/components/ui/PipelineModal';
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
  parseProjectsIndexFilters,
  PROJECT_JOURNEY_FILTER_OPTIONS,
  PROJECT_STAGE_FILTER_OPTIONS,
  PROJECT_STATE_FILTER_OPTIONS,
  type ArchiveFilter,
  type ProjectsIndexFilters,
} from './projectIndexFilters';
import { useProjectsIndexData } from './useProjectsIndexData';
import { useProjectsIndexMutations } from './useProjectsIndexMutations';
import ProjectIndexLifecycleCells from './ProjectIndexLifecycleCells';
import type { ProjectIndexEditableField } from './projectsIndexMutations';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import { useDebouncedValue } from '@/lib/list/useDebouncedValue';
import type {
  ProjectsIndexJourneyFilter,
  ProjectsIndexPageSize,
  ProjectsIndexSort,
  ProjectsIndexStateFilter,
} from '@/lib/projects/projectsIndexContract';
import {
  AlertBanner,
  Button,
  ButtonLink,
  Card,
  DataStatePanel,
  DestructiveConfirmation,
  Input,
  LoadingSkeleton,
  PageLayout,
  Pagination,
  SearchFilterBar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
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
}: {
  initialFilters?: ProjectsIndexFilters;
}) {
  const router = useRouter();
  const { finishInstantRoute } = usePortalRouteTransition();
  const { openProject } = useProjectInstantOpen();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { role } = usePortalSession();
  const isAdmin = role === 'admin';
  const initialFiltersRef = useRef(initialFilters ?? parseProjectsIndexFilters(searchParams));
  const [query, setQuery] = useState(initialFiltersRef.current.query);
  const [journeyFilter, setJourneyFilter] =
    useState<ProjectsIndexJourneyFilter>(initialFiltersRef.current.journeyFilter);
  const [stageFilter, setStageFilter] =
    useState<NonNullable<Project['status']> | 'all'>(initialFiltersRef.current.stageFilter);
  const [stateFilter, setStateFilter] =
    useState<ProjectsIndexStateFilter>(initialFiltersRef.current.stateFilter);
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>(initialFiltersRef.current.archiveFilter);
  const [sort, setSort] = useState<ProjectsIndexSort>('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<ProjectsIndexPageSize>(50);
  const debouncedQuery = useDebouncedValue(query, 180);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleteBusy, setIsDeleteBusy] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const { visibleInfo, onRowEnter: handleRowMouseEnter, onRowLeave: handleRowMouseLeave } = useProjectRowTooltip();
  const [editing, setEditing] = useState<EditingState>(null);
  const [statusConfirm, setStatusConfirm] = useState<StatusConfirmState>(null);
  const [statusConfirmText, setStatusConfirmText] = useState('');
  const [statusReason, setStatusReason] = useState('');

  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);

  const queryClient = useQueryClient();
  const projectMutations = useProjectsIndexMutations(host);
  const projectsIndex = useProjectsIndexData({
    archive: archiveFilter,
    search: debouncedQuery,
    status: stageFilter,
    journey: journeyFilter,
    state: stateFilter,
    page,
    pageSize,
    sort,
  });
  const projects = projectsIndex.data?.projects.rows ?? [];
  const contacts = projectsIndex.data?.contacts.rows ?? [];

  useEffect(() => {
    finishInstantRoute('projects-index');
  }, [finishInstantRoute, searchParams]);

  useEffect(() => {
    const nextFilters = parseProjectsIndexFilters(searchParams);
    setJourneyFilter(nextFilters.journeyFilter);
    setStageFilter(nextFilters.stageFilter);
    setStateFilter(nextFilters.stateFilter);
    setQuery(nextFilters.query);
    setArchiveFilter(nextFilters.archiveFilter);
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [archiveFilter, debouncedQuery, journeyFilter, pageSize, sort, stageFilter, stateFilter]);

  useEffect(() => {
    const totalPages = projectsIndex.data?.projects.totalPages;
    if (totalPages && page > totalPages) setPage(totalPages);
  }, [page, projectsIndex.data?.projects.totalPages]);

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

  const filteredProjects = projects;
  const totalCount = projectsIndex.data?.projects.totalCount ?? 0;
  const rangeStart = totalCount ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, totalCount);

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
    if (!isAdmin || projectMutations.isArchivePending(project.id)) return;
    setArchiveTarget(project);
    setArchiveReason('');
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
    <PageLayout
      width="full"
      density="compact"
      className={styles.page}
      data-projects-index-state={projectsIndex.state}
      data-projects-index-background-ready={projectsIndex.backgroundReady ? 'true' : 'false'}
    >
      <StaffPageHeader
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
      <div className={styles.stack}>
        <Card title="Filters" padding="compact" aria-label="Filters">
            <SearchFilterBar
              query={query}
              onQueryChange={setQuery}
              searchId="projectSearch"
              queryPlaceholder="Name, client, phone or address…"
              filters={[
                { id: 'projectJourneyFilter', label: 'Journey', value: journeyFilter, onChange: (value) => setJourneyFilter(value as ProjectsIndexJourneyFilter), options: [...PROJECT_JOURNEY_FILTER_OPTIONS] },
                { id: 'projectStageFilter', label: 'Stage', value: stageFilter, onChange: (value) => setStageFilter(value as NonNullable<Project['status']> | 'all'), options: [...PROJECT_STAGE_FILTER_OPTIONS] },
                { id: 'projectStateFilter', label: 'State', value: stateFilter, onChange: (value) => {
                  const nextState = value as ProjectsIndexStateFilter;
                  setStateFilter(nextState);
                  setArchiveFilter(nextState === 'ARCHIVED' ? 'archived' : 'active');
                }, options: [...PROJECT_STATE_FILTER_OPTIONS] },
                { id: 'projectSort', label: 'Sort', value: sort, onChange: (value) => setSort(value as ProjectsIndexSort), options: [{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'name_asc', label: 'Name A–Z' }, { value: 'name_desc', label: 'Name Z–A' }] },
                { id: 'projectPageSize', label: 'Rows', value: String(pageSize), onChange: (value) => setPageSize(Number(value) as ProjectsIndexPageSize), options: [{ value: '25', label: '25 rows' }, { value: '50', label: '50 rows' }, { value: '100', label: '100 rows' }] },
              ]}
              onClearAll={() => {
                setQuery('');
                setJourneyFilter('all');
                setStageFilter('all');
                setStateFilter('all');
                setArchiveFilter('active');
                setSort('newest');
                setPage(1);
              }}
            />
        </Card>

        <Card
          title="All Projects"
          padding="none"
          aria-label="Projects list"
          action={(
            <div className={styles.muted} suppressHydrationWarning>
              {projectsIndex.state === 'pending' || projectsIndex.state === 'cached' ? 'Updating…' : null}
              {projectsIndex.state === 'fresh' ? `${rangeStart}–${rangeEnd} of ${totalCount}` : null}
              {projectsIndex.state === 'unavailable' ? 'Access unavailable' : null}
              {projectsIndex.state === 'refresh-failed' ? 'Refresh failed' : null}
            </div>
          )}
        >
            {projectsIndex.state === 'refresh-failed' ? (
              <DataStatePanel
                state={projects.length ? 'stale' : 'error'}
                onRetry={() => void projectsIndex.retry()}
              />
            ) : null}
            {filteredProjects.length ? (
              <>
                <Table aria-label="Projects">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Journey</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
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
                        <TableRow
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
                          <TableCell data-column="Name">{renderEditable('name', nameValue, 'Project name', true)}</TableCell>
                          <TableCell data-column="Client" className={styles.muted}>{clientLabel}</TableCell>
                          <TableCell data-column="Phone">
                            {renderEditable(
                              'phone',
                              phoneValue,
                              phoneEditable ? 'Add phone' : 'No contact linked',
                              phoneEditable,
                            )}
                          </TableCell>
                          <TableCell data-column="Address">{renderEditable('address', addressValue, 'Add address', true)}</TableCell>
                          <ProjectIndexLifecycleCells
                            project={p}
                            projectName={nameValue}
                            stageBusy={isStatusBusyRow}
                            onStageChange={handleStatusChange}
                          />
                          <TableCell data-column="Actions">
                            <div className={styles.rowActions}>
                              <ButtonLink
                                variant="quiet"
                                size="small"
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
                              </ButtonLink>
                              {isAdmin ? (<>
                              <Button
                                type="button"
                                variant="quiet"
                                size="small"
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
                              </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteTarget(p);
                                    setDeleteConfirmText('');
                                    setDeleteReason('');
                                  }}
                                  onKeyDown={(e) => e.stopPropagation()}
                                >
                                  Delete
                                </Button>
                              </>) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );

                      return rowEl;
                    })}
                  </TableBody>
                </Table>
                <Pagination
                  currentPage={page}
                  totalPages={projectsIndex.data?.projects.totalPages ?? 1}
                  itemSummary={`${rangeStart}–${rangeEnd} of ${totalCount} projects`}
                  onPageChange={setPage}
                />
              </>
            ) : projectsIndex.state === 'pending' || projectsIndex.state === 'cached' ? (
              <LoadingSkeleton rows={5} columns={4} label="Updating projects…" />
            ) : projectsIndex.state === 'unavailable' ? (
              <DataStatePanel state="unavailable" />
            ) : projectsIndex.state === 'refresh-failed' ? (
              null
            ) : (
              <DataStatePanel
                state={
                  debouncedQuery
                  || journeyFilter !== 'all'
                  || stageFilter !== 'all'
                  || stateFilter !== 'all'
                    ? 'filtered-empty'
                    : 'empty'
                }
                onClear={
                  debouncedQuery
                  || journeyFilter !== 'all'
                  || stageFilter !== 'all'
                  || stateFilter !== 'all'
                    ? () => {
                        setQuery('');
                        setJourneyFilter('all');
                        setStageFilter('all');
                        setStateFilter('all');
                        setArchiveFilter('active');
                        setSort('newest');
                        setPage(1);
                      }
                    : undefined
                }
              />
            )}
        </Card>
      </div>

      <DestructiveConfirmation
        open={Boolean(deleteTarget)}
        title="Delete project?"
        description="Project data and linked records will be permanently removed."
        confirmationText={requiredDeleteText}
        value={deleteConfirmText}
        onValueChange={setDeleteConfirmText}
        pending={isDeleteBusy}
        onCancel={closeDeleteModal}
        consequences={deleteTarget ? <>This hard delete cannot be recovered. Current stage: <strong>{projectStatusLabel(deleteTarget.status ?? 'NEW')}</strong>.</> : null}
        additionalContent={(
          <Input
            id="delete-project-reason"
            label="Reason (optional)"
            value={deleteReason}
            onChange={(event) => setDeleteReason(event.target.value)}
            disabled={isDeleteBusy}
          />
        )}
        onConfirm={() => {
          if (!deleteTarget || isDeleteBusy || deleteConfirmText !== requiredDeleteText) return;
          const target = deleteTarget;
          setIsDeleteBusy(true);
          void (async () => {
            try {
              await deleteProject(target.id, {
                confirmText: deleteConfirmText.trim(),
                reason: deleteReason.trim() || null,
              });
              toast.success('Project deleted.');
              setDeleteTarget(null);
              setDeleteConfirmText('');
              setDeleteReason('');
              removeProjectListItem(queryClient, host, target.id);
              await invalidateProjectsIndexCaches(queryClient, host);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Failed to delete project');
            } finally {
              setIsDeleteBusy(false);
            }
          })();
        }}
      />

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
              <Button
                type="button"
                fullWidth
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
              </Button>
              <Button
                type="button"
                variant="tertiary"
                fullWidth
                onClick={closeStatusConfirm}
              >
                Cancel
              </Button>
            </>
          }
        >
          <div className={styles.modalContent}>
          <AlertBanner tone="info" title="Silent correction">
            This does not trigger automations or customer communications.
          </AlertBanner>

          {isStatusRollback ? (
            <Input
              id="index-stage-confirm-text"
              label="Type RESET to confirm rollback"
              value={statusConfirmText}
              onChange={(event) => setStatusConfirmText(event.target.value)}
              autoComplete="off"
            />
          ) : null}

          <Input
            id="index-stage-reason"
            label="Reason (optional)"
            value={statusReason}
            onChange={(event) => setStatusReason(event.target.value)}
          />
          </div>
        </PipelineModal>
      ) : null}

      {archiveTarget ? (
        <PipelineModal
          open
          onOpenChange={(open) => {
            if (!open && !projectMutations.isArchivePending(archiveTarget.id)) {
              setArchiveTarget(null);
              setArchiveReason('');
            }
          }}
          title={archiveTarget.isArchived ? 'Restore project' : 'Archive project'}
          description={archiveTarget.isArchived
            ? 'Restore this project to the active project lists.'
            : 'Remove this project from operational lists without changing its pipeline stage.'}
          actions={(
            <>
              <Button
                type="button"
                fullWidth
                loading={projectMutations.isArchivePending(archiveTarget.id)}
                disabled={!archiveReason.trim()}
                onClick={() => {
                  const target = archiveTarget;
                  void projectMutations
                    .setArchived(target, !target.isArchived, archiveReason.trim())
                    .then((saved) => {
                      if (!saved) return;
                      setArchiveTarget(null);
                      setArchiveReason('');
                    });
                }}
              >
                {archiveTarget.isArchived ? 'Restore project' : 'Archive project'}
              </Button>
              <Button
                type="button"
                variant="tertiary"
                fullWidth
                disabled={projectMutations.isArchivePending(archiveTarget.id)}
                onClick={() => {
                  setArchiveTarget(null);
                  setArchiveReason('');
                }}
              >
                Cancel
              </Button>
            </>
          )}
        >
          <div className={styles.modalContent}>
            <AlertBanner tone="info" title="Housekeeping only">
              Archiving does not mark the project lost, complete, or paid.
            </AlertBanner>
            <Textarea
              id="index-archive-reason"
              label="Reason"
              value={archiveReason}
              maxLength={500}
              onChange={(event) => setArchiveReason(event.target.value)}
            />
          </div>
        </PipelineModal>
      ) : null}

      <ProjectRowTooltip host={host} visibleInfo={visibleInfo} fallbackClientName={visibleFallback} />

    </PageLayout>
  );
}
