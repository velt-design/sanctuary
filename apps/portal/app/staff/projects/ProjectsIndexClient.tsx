'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Contact } from '@/lib/types/contact';
import type { Project, ProjectStatus } from '@/lib/types/project';
import { PROJECT_STATUS_ORDER, projectStatusLabel } from '@/lib/types/project';
import styles from './projects.module.css';
import PageHeader from '@/components/layout/PageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsListQueryOptions } from '@/lib/queries/contacts';
import {
  projectPageSnapshotQueryOptions,
  projectTooltipSummaryQueryOptions,
  projectsListQueryOptions,
} from '@/lib/queries/projects';
import { qk } from '@/lib/queries/keys';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import Modal from '@/components/ui/modal/Modal';
import { PIPELINE_MODAL_ACTION_CLASSES, PipelineModal } from '@/components/ui/PipelineModal';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { correctProjectStage, deleteProject } from '@/lib/repo/projectsRepo';
import {
  PIPELINE_STAGE_LABELS,
  normalizePipelineStageKey,
  requiresStageConfirmation,
  stageKeyToStatus,
  type PipelineStageKey,
} from '@/lib/projects/pipelineDefinition';
import { patchProjectListItem } from '@/lib/queries/projectCache';
import {
  buildContactsById,
  filterProjectsForIndex,
  parseProjectsIndexFilters,
  type ArchiveFilter,
  type ProjectsIndexFilters,
} from './projectIndexFilters';

const NZD_FORMATTER = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  maximumFractionDigits: 0,
});

function formatTotalCents(cents: number | null | undefined): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents) || cents <= 0) return '—';
  return NZD_FORMATTER.format(cents / 100);
}

function ProjectRowTooltipBody({
  host,
  projectId,
  fallbackClientName,
}: {
  host: string;
  projectId: string;
  fallbackClientName: string;
}) {
  const { data, isLoading, isError } = useQuery({
    ...projectTooltipSummaryQueryOptions(host, projectId),
  });

  if (isLoading) {
    return <div className={styles.tooltipBody}>Loading…</div>;
  }
  if (isError) {
    return <div className={styles.tooltipBody}>Couldn’t load summary.</div>;
  }

  const clientLine = data?.clientName?.trim() || fallbackClientName.trim() || '—';
  const styleLine = data?.roofStyleLabel ?? '—';
  const materialLine = data?.materialLabel ?? '—';
  const totalLine = formatTotalCents(data?.totalCents ?? null);

  return (
    <div className={styles.tooltipBody}>
      <div className={styles.tooltipClient}>{clientLine}</div>
      <div className={styles.tooltipLine}>{styleLine}</div>
      <div className={styles.tooltipLine}>{materialLine}</div>
      <div className={styles.tooltipPrice}>{totalLine}</div>
    </div>
  );
}

const TOOLTIP_OFFSET = 14;
const TOOLTIP_VIEWPORT_PADDING = 8;

function FloatingProjectTooltip({
  host,
  visibleInfo,
  fallbackClientName,
}: {
  host: string;
  visibleInfo: { projectId: string; x: number; y: number } | null;
  fallbackClientName: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastPositionRef = useRef<{ x: number; y: number }>({
    x: visibleInfo?.x ?? -9999,
    y: visibleInfo?.y ?? -9999,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let pending = false;
    const place = (x: number, y: number) => {
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = x + TOOLTIP_OFFSET;
      let top = y + TOOLTIP_OFFSET;
      if (left + rect.width > vw - TOOLTIP_VIEWPORT_PADDING) {
        left = Math.max(TOOLTIP_VIEWPORT_PADDING, x - TOOLTIP_OFFSET - rect.width);
      }
      if (top + rect.height > vh - TOOLTIP_VIEWPORT_PADDING) {
        top = Math.max(TOOLTIP_VIEWPORT_PADDING, y - TOOLTIP_OFFSET - rect.height);
      }
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    };

    const onMove = (event: globalThis.MouseEvent) => {
      lastPositionRef.current = { x: event.clientX, y: event.clientY };
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        place(lastPositionRef.current.x, lastPositionRef.current.y);
      });
    };

    document.addEventListener('mousemove', onMove);
    return () => {
      document.removeEventListener('mousemove', onMove);
    };
  }, []);

  useLayoutEffect(() => {
    if (!visibleInfo) return;
    lastPositionRef.current = { x: visibleInfo.x, y: visibleInfo.y };
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = visibleInfo.x + TOOLTIP_OFFSET;
    let top = visibleInfo.y + TOOLTIP_OFFSET;
    if (left + rect.width > vw - TOOLTIP_VIEWPORT_PADDING) {
      left = Math.max(TOOLTIP_VIEWPORT_PADDING, visibleInfo.x - TOOLTIP_OFFSET - rect.width);
    }
    if (top + rect.height > vh - TOOLTIP_VIEWPORT_PADDING) {
      top = Math.max(TOOLTIP_VIEWPORT_PADDING, visibleInfo.y - TOOLTIP_OFFSET - rect.height);
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [visibleInfo]);

  const isVisible = Boolean(visibleInfo);
  const className = isVisible
    ? `${styles.floatingTooltip} ${styles.floatingTooltipVisible}`
    : styles.floatingTooltip;

  return (
    <div ref={ref} className={className} role="tooltip" aria-hidden={!isVisible}>
      {visibleInfo ? (
        <ProjectRowTooltipBody host={host} projectId={visibleInfo.projectId} fallbackClientName={fallbackClientName} />
      ) : null}
    </div>
  );
}

type EditableField = 'name' | 'phone' | 'address';
type EditingState = { id: string; field: EditableField; value: string } | null;
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
  const [visibleInfo, setVisibleInfo] = useState<{ projectId: string; x: number; y: number } | null>(null);
  const isWarmRef = useRef(false);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [editing, setEditing] = useState<EditingState>(null);
  const [savingCellKey, setSavingCellKey] = useState<string | null>(null);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<StatusConfirmState>(null);
  const [statusConfirmText, setStatusConfirmText] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);

  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  const handleRowMouseEnter = useCallback((projectId: string, e: MouseEvent<HTMLTableRowElement>) => {
    const info = { projectId, x: e.clientX, y: e.clientY };
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (isWarmRef.current) {
      setVisibleInfo(info);
      return;
    }
    showTimerRef.current = window.setTimeout(() => {
      showTimerRef.current = null;
      isWarmRef.current = true;
      setVisibleInfo(info);
    }, 280);
  }, []);

  const handleRowMouseLeave = useCallback((_projectId: string) => {
    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      isWarmRef.current = false;
      setVisibleInfo(null);
    }, 140);
  }, []);
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

  const cellKey = (id: string, field: EditableField) => `${id}:${field}`;

  const beginEdit = useCallback((project: Project, field: EditableField, currentValue: string) => {
    if (savingCellKey) return;
    setEditing({ id: project.id, field, value: currentValue });
  }, [savingCellKey]);

  const cancelEdit = useCallback(() => {
    setEditing(null);
  }, []);

  const patchContactPhoneInCache = useCallback(
    (contactId: string, nextPhone: string) => {
      const queryKey = qk.contacts.list(host);
      queryClient.setQueryData<Contact[] | undefined>(queryKey, (current) => {
        if (!Array.isArray(current)) return current;
        return current.map((c) => (c.id === contactId ? { ...c, phone: nextPhone } : c));
      });
    },
    [host, queryClient],
  );

  const commitEdit = useCallback(async () => {
    if (!editing) return;
    const project = projects.find((p) => p.id === editing.id);
    if (!project) {
      setEditing(null);
      return;
    }

    const trimmed = editing.value.trim();
    const field = editing.field;
    const projectId = editing.id;

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

    const key = cellKey(projectId, field);
    setSavingCellKey(key);

    const body: Record<string, unknown> = {};
    if (field === 'name') body.project = { projectName: trimmed };
    else if (field === 'address') body.project = { siteAddress: trimmed };
    else if (field === 'phone') body.contact = { phone: trimmed };

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/details`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const msg = typeof errBody?.error === 'string' ? errBody.error : 'Failed to save change.';
        throw new Error(msg);
      }

      if (field === 'name') {
        patchProjectListItem(queryClient, host, projectId, (p) => ({ ...p, projectName: trimmed, name: trimmed }));
      } else if (field === 'address') {
        patchProjectListItem(queryClient, host, projectId, (p) => ({ ...p, siteAddress: trimmed, address: trimmed }));
      } else if (field === 'phone' && project.contactId) {
        patchContactPhoneInCache(project.contactId, trimmed);
      }

      await queryClient.invalidateQueries({ queryKey: qk.projects.listPrefix(host) });
      if (field === 'phone') {
        await queryClient.invalidateQueries({ queryKey: qk.contacts.list(host) });
      }
      setEditing(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save change.';
      toast.error(msg);
    } finally {
      setSavingCellKey(null);
    }
  }, [contactsById, editing, host, patchContactPhoneInCache, projects, queryClient, toast]);

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
    async (projectId: string, nextStage: PipelineStageKey, label: string, reasonText: string | null) => {
      setSavingStatusId(projectId);
      try {
        const result = await correctProjectStage(projectId, stageKeyToStatus(nextStage), {
          reason: reasonText,
        });
        if (result.rollback) {
          toast.success(`Stage corrected to ${label}. Reset ${result.resetManualTaskCount} manual checkmark(s).`);
        } else {
          toast.success(`Stage corrected to ${label}.`);
        }
        patchProjectListItem(queryClient, host, projectId, (p) => ({
          ...p,
          status: stageKeyToStatus(nextStage),
        }));
        await queryClient.invalidateQueries({ queryKey: qk.projects.listPrefix(host) });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update stage.';
        toast.error(msg);
        throw err;
      } finally {
        setSavingStatusId(null);
      }
    },
    [host, queryClient, toast],
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
    if (statusBusy) return;
    setStatusConfirm(null);
    setStatusConfirmText('');
    setStatusReason('');
  };

  const isStatusRollback = Boolean(
    statusConfirm &&
      PROJECT_STATUS_ORDER.indexOf(stageKeyToStatus(statusConfirm.next) as ProjectStatus) <
        PROJECT_STATUS_ORDER.indexOf(stageKeyToStatus(statusConfirm.current) as ProjectStatus),
  );

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

  const visibleProject = visibleInfo ? filteredProjects.find((p) => p.id === visibleInfo.projectId) ?? null : null;
  const visibleFallback = visibleProject
    ? (() => {
        const c = visibleProject.contactId ? contactsById.get(visibleProject.contactId) : null;
        return c?.displayName ?? visibleProject.clientName ?? '';
      })()
    : '';

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
                      const nameValue = (p.projectName ?? p.name ?? '').trim();
                      const phoneValue = (contact?.phone ?? (p as { phone?: string }).phone ?? '').trim();
                      const addressValue = (p.siteAddress ?? p.address ?? '').trim();
                      const isArchiveBusy = archiveBusyId === p.id;
                      const isStatusBusyRow = savingStatusId === p.id;
                      const phoneEditable = Boolean(p.contactId);

                      const renderEditable = (
                        field: EditableField,
                        currentValue: string,
                        placeholder: string,
                        editable: boolean,
                      ) => {
                        const key = cellKey(p.id, field);
                        const isEditing = editing?.id === p.id && editing.field === field;
                        const isSavingCell = savingCellKey === key;

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
                            {isSavingCell ? 'Saving…' : currentValue || (
                              <span className={styles.muted}>{placeholder}</span>
                            )}
                          </button>
                        );
                      };

                      const rowEl = (
                        <tr
                          key={p.id}
                          className={styles.rowClickable}
                          tabIndex={0}
                          onClick={() => {
                            prefetchProjectSnapshot(p.id);
                            router.push(`/staff/projects/${encodeURIComponent(p.id)}`);
                          }}
                          onMouseEnter={(e) => {
                            prefetchProjectSnapshot(p.id);
                            handleRowMouseEnter(p.id, e);
                          }}
                          onMouseLeave={() => handleRowMouseLeave(p.id)}
                          onFocus={() => prefetchProjectSnapshot(p.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') router.push(`/staff/projects/${encodeURIComponent(p.id)}`);
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
                            {isAdmin ? (
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
                            ) : (
                              <span className={styles.statusPill}>{projectStatusLabel(p.status ?? 'NEW')}</span>
                            )}
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

                      return rowEl;
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

      {statusConfirm ? (
        <PipelineModal
          open
          onOpenChange={(open) => {
            if (!open) closeStatusConfirm();
          }}
          title="Correct stage (admin)"
          description={`Correct from ${PIPELINE_STAGE_LABELS[statusConfirm.current]} to ${statusConfirm.label}.`}
          actions={
            <>
              <button
                type="button"
                className={PIPELINE_MODAL_ACTION_CLASSES.primary}
                disabled={statusBusy || (isStatusRollback && statusConfirmText.trim().toUpperCase() !== 'RESET')}
                onClick={() => {
                  if (!statusConfirm || statusBusy) return;
                  setStatusBusy(true);
                  void applyStageCorrection(
                    statusConfirm.projectId,
                    statusConfirm.next,
                    statusConfirm.label,
                    statusReason.trim() || null,
                  )
                    .then(() => {
                      setStatusConfirm(null);
                      setStatusConfirmText('');
                      setStatusReason('');
                    })
                    .catch(() => {
                      // toast surfaced by applyStageCorrection
                    })
                    .finally(() => setStatusBusy(false));
                }}
              >
                {statusBusy ? 'Applying…' : `Move to ${statusConfirm.label}`}
              </button>
              <button
                type="button"
                className={PIPELINE_MODAL_ACTION_CLASSES.secondary}
                disabled={statusBusy}
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

      {isMounted
        ? createPortal(
            <FloatingProjectTooltip
              host={host}
              visibleInfo={visibleInfo}
              fallbackClientName={visibleFallback}
            />,
            document.body,
          )
        : null}
    </main>
  );
}
