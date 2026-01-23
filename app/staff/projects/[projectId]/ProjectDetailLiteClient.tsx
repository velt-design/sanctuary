'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/portal/PageHeader';
import { useToast } from '@/components/ui/toast/ToastProvider';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { nextActionTypeLabel, type NextActionType, type ProjectStatus } from '@/lib/types/project';
import { addProjectActivity, deleteProject, getProject, setProjectFollowUpDate, setProjectStatus, updateProjectFields } from '@/lib/repo/projectsRepo';
import { getContact } from '@/lib/repo/contactsRepo';
import { listEstimates, updateEstimateStatus } from '@/lib/repo/estimatesRepo';
import type { Estimate } from '@/lib/types/estimate';
import styles from '../projects.module.css';
import PipelineStepper from './PipelineStepper';
import useSWR from 'swr';
import {
  getDesignTicket,
  listAuditEvents,
  listEmailOutbox,
  listFollowupTasks,
  listProjectTasks,
  setFollowupTaskDone,
  setTaskDone,
} from '@/lib/repo/automationRepo';
import { getSiteVisitEventForProject } from '@/lib/repo/siteVisitEventsRepo';
import type { AuditEvent, DesignTicket, EmailOutboxItem, FollowupTask, Task } from '@/lib/types/automation';
import { apiJson } from '@/lib/repo/apiClient';
import { useSession } from 'next-auth/react';
import { projectsSWRKey } from '@/lib/cache/projectsCache';
import type { Project as ProjectType } from '@/lib/types/project';
import { useCacheFirstResource } from '@/lib/ui/useCacheFirstResource';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

type Draft = {
  projectName: string;
  quoteRef: string;
  region: string;
  siteAddress: string;
  nextActionDate: string;
  nextActionType: string;
};

function toDraft(project: Project): Draft {
  return {
    projectName: project.projectName ?? project.name ?? '',
    quoteRef: project.quoteRef ?? '',
    region: project.region ?? '',
    siteAddress: project.siteAddress ?? project.address ?? '',
    nextActionDate: (project.nextActionDate ?? project.followUpDate ?? '') as string,
    nextActionType: (project.nextActionType ?? '') as string,
  };
}

function isValidYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export default function ProjectDetailLiteClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { data: session } = useSession();
  const isAdmin = (((session?.user as any)?.role ?? 'staff') as string) === 'admin';
  const [mounted, setMounted] = useState(false);

  const [project, setProject] = useState<Project | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [siteVisit, setSiteVisit] = useState<Awaited<ReturnType<typeof getSiteVisitEventForProject>>>(null);
  const [optimisticStage, setOptimisticStage] = useState<ProjectStatus | null>(null);
  const [isStageSaving, setIsStageSaving] = useState(false);
  const [stageSaveError, setStageSaveError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const taskTabFromUrl = useMemo(() => {
    const raw = (searchParams.get('taskTab') || '').trim().toLowerCase();
    return raw === 'completed' ? 'completed' : 'todo';
  }, [searchParams]);
  const [taskTab, setTaskTab] = useState<'todo' | 'completed'>(taskTabFromUrl);

  useLayoutEffect(() => setMounted(true), []);
  useEffect(() => {
    setOptimisticStage(null);
    setIsStageSaving(false);
    setStageSaveError(null);
  }, [projectId]);

  useEffect(() => {
    setTaskTab(taskTabFromUrl);
  }, [taskTabFromUrl]);

  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const tasksRes = useCacheFirstResource<Task[]>(`spcache:tasks:${hostKey}:${projectId}`, () => listProjectTasks(projectId));
  const ticketRes = useCacheFirstResource<DesignTicket | null>(`spcache:designTicket:${hostKey}:${projectId}`, () => getDesignTicket(projectId));
  const followupsRes = useCacheFirstResource<FollowupTask[]>(`spcache:followups:${hostKey}:${projectId}`, () => listFollowupTasks(projectId));
  const outboxRes = useCacheFirstResource<EmailOutboxItem[]>(`spcache:outbox:${hostKey}:${projectId}`, () => listEmailOutbox(projectId));
  const auditRes = useCacheFirstResource<AuditEvent[]>(`spcache:audit:${hostKey}:${projectId}`, () => listAuditEvents(projectId, 30));

  const tasks = tasksRes.data ?? [];
  const ticketData = ticketRes.data ?? null;
  const followups = followupsRes.data ?? [];
  const outbox = outboxRes.data ?? [];
  const auditData = auditRes.data ?? [];

  const todoTasks = useMemo(() => tasks.filter((t) => String(t.status).toUpperCase() !== 'DONE'), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => String(t.status).toUpperCase() === 'DONE'), [tasks]);
  const activeTasks = taskTab === 'completed' ? completedTasks : todoTasks;

  const cachedProjectsKey = useMemo(() => projectsSWRKey(), []);
  const { data: cachedProjects } = useSWR<ProjectType[]>(cachedProjectsKey, null);

  const run = async (key: string, fn: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const setTaskTabInUrl = (next: 'todo' | 'completed') => {
    setTaskTab(next);
    const qs = new URLSearchParams(searchParams.toString());
    if (next === 'todo') qs.delete('taskTab');
    else qs.set('taskTab', next);
    const query = qs.toString();
    router.replace(`/staff/projects/${encodeURIComponent(projectId)}${query ? `?${query}` : ''}`);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setError(null);
      const cached = Array.isArray(cachedProjects) ? cachedProjects.find((p) => p.id === projectId) ?? null : null;
      if (!project && cached) setProject(cached as any);

      const p = await getProject(projectId).catch(() => null);
      if (cancelled) return;
      setProject(p);
      setEstimates(await listEstimates(projectId).catch(() => []));
      setSiteVisit(p ? await getSiteVisitEventForProject(p.id).catch(() => null) : null);
      if (p?.contactId) {
        const c = await getContact(p.contactId).catch(() => null);
        if (cancelled) return;
        setContact(c);
      } else {
        setContact(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cachedProjects, projectId]);

  const canSave = useMemo(() => {
    if (!draft) return false;
    if (!draft.projectName.trim()) return false;
    if (draft.nextActionDate.trim() && !isValidYmd(draft.nextActionDate)) return false;
    return true;
  }, [draft]);

  if (!project) {
    return (
      <main className={styles.page}>
        <PageHeader title="Project" subtitle="Loading…" back={{ label: 'Projects', href: '/staff/projects' }} />
        <p className={styles.note}>Loading project details…</p>
      </main>
    );
  }

  const status = (project.status ?? 'NEW') as ProjectStatus;
  const displayStatus = (optimisticStage ?? status) as ProjectStatus;

  const refreshAutomation = async () => {
    await Promise.allSettled([tasksRes.refresh(), ticketRes.refresh(), followupsRes.refresh(), outboxRes.refresh(), auditRes.refresh()]);
  };

  const refreshProject = async () => {
    const p = await getProject(projectId).catch(() => null);
    setProject(p);
    if (p?.contactId) setContact(await getContact(p.contactId).catch(() => null));
    else setContact(null);
    if (p) setSiteVisit(await getSiteVisitEventForProject(p.id).catch(() => null));
    else setSiteVisit(null);
  };

  const refreshProjectDetailCaches = async () => {
    await Promise.allSettled([refreshProject(), refreshAutomation()]);
  };

  const runAction = async (key: string, fn: () => Promise<void>) => {
    await run(key, async () => {
      setError(null);
      try {
        await fn();
        void refreshProjectDetailCaches();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Request failed';
        setError(msg);
        toast.error(msg);
        throw err;
      }
    });
  };

  const runStageTransition = async (params: { key: string; toStage: ProjectStatus; action: () => Promise<void> }) => {
    if (isStageSaving) return;
    setStageSaveError(null);
    setOptimisticStage(params.toStage);
    setIsStageSaving(true);

    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;

    try {
      await params.action();
      const t1 = typeof performance !== 'undefined' ? performance.now() : 0;
      if (process.env.NODE_ENV !== 'production' && t1 && t0) {
        console.info(`[pipeline] ${params.key} stage endpoint ${(t1 - t0).toFixed(0)}ms`);
      }

      window.setTimeout(() => {
        void refreshProjectDetailCaches().then(() => setOptimisticStage(null));
      }, 250);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setOptimisticStage(null);
      setStageSaveError(msg);
      toast.error(msg);
    } finally {
      setIsStageSaving(false);
    }
  };

  return (
    <main className={styles.page}>
      <PageHeader
        title={project.projectName ?? project.name ?? 'Project'}
        subtitle={`Project ID: ${project.id}${
          (project.nextActionDate ?? project.followUpDate)
            ? ` · Next action: ${project.nextActionDate ?? project.followUpDate}${project.nextActionType ? ` (${nextActionTypeLabel(project.nextActionType as any)})` : ''}`
            : ''
        }`}
        back={{ label: 'Projects', href: '/staff/projects' }}
        primaryAction={
          isAdmin
            ? {
                label: 'Delete Project',
                onClick: () => {
                  void run('deleteProject', async () => {
                    if (typeof window !== 'undefined') {
                      const ok = window.confirm('Delete this project? This cannot be undone.');
                      if (!ok) return;
                    }
                    await deleteProject(project.id);
                    toast.success('Project deleted.');
                    router.push('/staff/projects?toast=project_deleted');
                  });
                },
              }
            : undefined
        }
      />

      {error ? <p className={styles.error}>{error}</p> : null}
      {stageSaveError ? <p className={styles.error}>{stageSaveError}</p> : null}

      <div className="sp-page-stack">
      <section className={styles.section} aria-label="Pipeline">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Pipeline</h2>
          {isStageSaving ? <span className={styles.muted}>Saving…</span> : null}
        </div>
        <div className={styles.sectionBody}>
          <PipelineStepper
            currentStatus={displayStatus as any}
            onRequestChange={(next) => {
              if (busy || isStageSaving) return;
              void runStageTransition({
                key: 'setStatus',
                toStage: next as any,
                action: async () => {
                  if (typeof window !== 'undefined') {
                    const ok = window.confirm(`Set pipeline stage to ${next}?`);
                    if (!ok) return;
                  }
                  const updated = await setProjectStatus(project.id, next as any);
                  setProject(updated);
                },
              });
            }}
          />

          <div className={styles.actions} style={{ justifyContent: 'flex-start', marginTop: 12 }}>
	            {displayStatus === 'NEW' ? (
	              <button
	                type="button"
	                className={styles.buttonSecondary}
	                disabled={Boolean(busy) || isStageSaving}
	                onClick={() => {
	                  void runStageTransition({
	                    key: 'mark_contacted',
	                    toStage: 'CONTACTED',
	                    action: async () => {
	                      await apiJson(`/api/staff/v1/projects/${encodeURIComponent(project.id)}/action/mark_contacted`, { method: 'POST' });
	                      toast.success('Marked contacted.');
	                    },
	                  });
	                }}
	              >
	                Mark contacted
	              </button>
	            ) : null}

	            {displayStatus === 'CONTACTED' ? (
	              <button
	                type="button"
	                className={styles.buttonSecondary}
	                disabled={Boolean(busy) || isStageSaving}
	                onClick={() => {
	                  void runStageTransition({
	                    key: 'site_visit_agreed',
	                    toStage: 'SITE_VISIT',
	                    action: async () => {
	                      await apiJson(`/api/staff/v1/projects/${encodeURIComponent(project.id)}/action/customer_agreed_site_visit`, { method: 'POST' });
	                      toast.success('Moved to Site Visit.');
	                    },
	                  });
	                }}
	              >
	                Customer agreed site visit
	              </button>
	            ) : null}

	            {displayStatus === 'SITE_VISIT' ? (
              <>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  disabled={Boolean(busy)}
                  onClick={() => {
                    const weekYmd = (() => {
                      const iso = siteVisit?.scheduledStart ?? null;
                      const dt = iso ? new Date(iso) : new Date();
                      const y = dt.getFullYear();
                      const m = String(dt.getMonth() + 1).padStart(2, '0');
                      const d = String(dt.getDate()).padStart(2, '0');
                      const day = dt.getDay();
                      const daysSinceMonday = (day + 6) % 7;
                      const monday = new Date(dt.getTime());
                      monday.setDate(dt.getDate() - daysSinceMonday);
                      const my = monday.getFullYear();
                      const mm = String(monday.getMonth() + 1).padStart(2, '0');
                      const md = String(monday.getDate()).padStart(2, '0');
                      return `${my}-${mm}-${md}`;
                    })();
                    const qs = new URLSearchParams();
                    qs.set('view', 'site-visits');
                    qs.set('week', weekYmd);
                    if (siteVisit?.id) qs.set('highlightSiteVisitId', siteVisit.id);
                    router.push(`/staff/schedule?${qs.toString()}`);
                  }}
                >
                  Open Site Visit Calendar
                </button>

                {siteVisit && String(siteVisit.status).toUpperCase() === 'TENTATIVE' ? (
                  <button
                    type="button"
                    className={styles.buttonSecondary}
                    disabled={Boolean(busy)}
                    onClick={() => {
                      void runAction('confirm_site_visit', async () => {
                        await apiJson(`/api/staff/v1/projects/${encodeURIComponent(project.id)}/action/site-visit/confirm`, {
                          method: 'POST',
                          body: JSON.stringify({ siteVisitEventId: siteVisit.id }),
                        });
                        toast.success('Booking confirmed.');
                      });
                    }}
                  >
                    Confirm booking
                  </button>
                ) : null}

                <button
                  type="button"
                  className={styles.buttonSecondary}
                  disabled={Boolean(busy)}
                  onClick={() => {
                    void runAction('complete_site_visit', async () => {
                      await apiJson(`/api/staff/v1/projects/${encodeURIComponent(project.id)}/action/complete_site_visit`, { method: 'POST' });
                      toast.success('Site visit marked complete.');
                    });
                  }}
                >
                  Complete site visit
                </button>
	                <button
	                  type="button"
	                  className={styles.buttonSecondary}
	                  disabled={Boolean(busy) || isStageSaving}
	                  onClick={() => {
	                    if (typeof window === 'undefined') return;
	                    const tierInput = window.prompt('Design tier (1-4). Leave blank for Tier 2:', '2') ?? '';
	                    const t = tierInput.trim();
	                    const tier = t === '1' ? 'TIER_1' : t === '3' ? 'TIER_3' : t === '4' ? 'TIER_4' : 'TIER_2';
	                    void runStageTransition({
	                      key: 'generate_cost_plan',
	                      toStage: 'QUOTING',
	                      action: async () => {
	                        await apiJson(`/api/staff/v1/projects/${encodeURIComponent(project.id)}/action/generate_cost_plan`, {
	                          method: 'POST',
	                          body: JSON.stringify({ tier }),
	                        });
	                        toast.success('Moved to Quoting (dry-run).');
	                      },
	                    });
	                  }}
	                >
	                  Generate cost plan
	                </button>
              </>
            ) : null}

	            {displayStatus === 'QUOTING' ? (
	              <button
	                type="button"
	                className={styles.buttonSecondary}
	                disabled={Boolean(busy) || isStageSaving}
	                onClick={() => {
	                  void runStageTransition({
	                    key: 'quote_sent',
	                    toStage: 'SENT',
	                    action: async () => {
	                      await apiJson(`/api/staff/v1/quotes/${encodeURIComponent('manual_quote')}/action/mark_sent`, {
	                        method: 'POST',
	                        body: JSON.stringify({ projectId: project.id }),
	                      });
	                      toast.success('Moved to Sent (dry-run).');
	                    },
	                  });
	                }}
	              >
	                Mark quote sent
	              </button>
	            ) : null}

	            {displayStatus === 'SENT' ? (
	              <button
	                type="button"
	                className={styles.buttonSecondary}
	                disabled={Boolean(busy) || isStageSaving}
	                onClick={() => {
	                  void runStageTransition({
	                    key: 'deposit_received',
	                    toStage: 'DEPOSIT',
	                    action: async () => {
	                      await apiJson(`/api/staff/v1/projects/${encodeURIComponent(project.id)}/action/mark_deposit_received`, { method: 'POST' });
	                      toast.success('Moved to Deposit.');
	                    },
	                  });
	                }}
	              >
	                Mark deposit received
	              </button>
	            ) : null}

	            {displayStatus === 'DEPOSIT' ? (
	              <button
	                type="button"
	                className={styles.buttonSecondary}
	                disabled={Boolean(busy) || isStageSaving}
	                onClick={() => {
	                  void runStageTransition({
	                    key: 'confirm_schedule',
	                    toStage: 'SCHEDULED',
	                    action: async () => {
	                      await apiJson(`/api/staff/v1/projects/${encodeURIComponent(project.id)}/action/confirm_schedule`, { method: 'POST' });
	                      toast.success('Moved to Scheduled.');
	                    },
	                  });
	                }}
	              >
	                Confirm schedule
	              </button>
	            ) : null}

	            {displayStatus === 'SCHEDULED' ? (
	              <button
	                type="button"
	                className={styles.buttonSecondary}
	                disabled={Boolean(busy) || isStageSaving}
	                onClick={() => {
	                  void runStageTransition({
	                    key: 'mark_completed',
	                    toStage: 'COMPLETED',
	                    action: async () => {
	                      await apiJson(`/api/staff/v1/projects/${encodeURIComponent(project.id)}/action/mark_completed`, { method: 'POST' });
	                      toast.success('Moved to Completed.');
	                    },
	                  });
	                }}
	              >
	                Mark completed
	              </button>
	            ) : null}

	            {displayStatus === 'COMPLETED' ? (
	              <button
	                type="button"
	                className={styles.buttonSecondary}
	                disabled={Boolean(busy) || isStageSaving}
	                onClick={() => {
	                  void runStageTransition({
	                    key: 'mark_paid',
	                    toStage: 'PAID',
	                    action: async () => {
	                      await apiJson(`/api/staff/v1/projects/${encodeURIComponent(project.id)}/action/mark_paid`, { method: 'POST' });
	                      toast.success('Moved to Paid.');
	                    },
	                  });
	                }}
	              >
	                Mark paid
	              </button>
	            ) : null}
          </div>
        </div>
      </section>

      <div className="sp-section-grid">
        <section className={styles.section} aria-label="Project details">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Details</h2>
            <div className={styles.actions}>
              {editing ? (
                <>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={!canSave || Boolean(busy)}
                    onClick={() => {
                      if (!draft) return;
                      void run('save', async () => {
                        setError(null);
                        try {
                          const nextActionDate = draft.nextActionDate.trim();
                          const nextActionType = draft.nextActionType.trim();

                          const updated = await updateProjectFields(project.id, {
                            projectName: draft.projectName.trim(),
                            quoteRef: draft.quoteRef.trim() || undefined,
                            region: draft.region.trim() || undefined,
                            siteAddress: draft.siteAddress.trim() || undefined,
                            nextActionType: (nextActionType ? (nextActionType as NextActionType) : null) as any,
                          });

                          if (nextActionDate ? isValidYmd(nextActionDate) : true) {
                            const withDate = await setProjectFollowUpDate(project.id, nextActionDate ? nextActionDate : null);
                            setProject(withDate);
                          } else {
                            setProject(updated);
                          }

                          setEditing(false);
                          setDraft(null);
                          toast.success('Project updated.');
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : 'Failed to update project';
                          setError(msg);
                          toast.error(msg);
                        }
                      });
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className={styles.buttonSecondary}
                    disabled={Boolean(busy)}
                    onClick={() => {
                      setEditing(false);
                      setDraft(null);
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  disabled={Boolean(busy)}
                  onClick={() => {
                    setEditing(true);
                    setDraft(toDraft(project));
                  }}
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          <div className={styles.sectionBody}>
            {editing && draft ? (
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label htmlFor="projectName">Project name *</label>
                  <input
                    id="projectName"
                    value={draft.projectName}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, projectName: e.target.value } : prev))}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="quoteRef">Quote ref</label>
                  <input
                    id="quoteRef"
                    value={draft.quoteRef}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, quoteRef: e.target.value } : prev))}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="region">Region</label>
                  <input id="region" value={draft.region} onChange={(e) => setDraft((prev) => (prev ? { ...prev, region: e.target.value } : prev))} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="siteAddress">Site address</label>
                  <input
                    id="siteAddress"
                    value={draft.siteAddress}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, siteAddress: e.target.value } : prev))}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="nextActionDate">Next action date (YYYY-MM-DD)</label>
                  <input
                    id="nextActionDate"
                    value={draft.nextActionDate}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, nextActionDate: e.target.value } : prev))}
                  />
                  {draft.nextActionDate.trim() && !isValidYmd(draft.nextActionDate) ? <p className={styles.error}>Invalid date format.</p> : null}
                </div>
                <div className={styles.field}>
                  <label htmlFor="nextActionType">Next action type</label>
                  <select
                    id="nextActionType"
                    value={draft.nextActionType}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, nextActionType: e.target.value } : prev))}
                  >
                    <option value="">(none)</option>
                    <option value="call">Call</option>
                    <option value="site_visit">Site visit</option>
                    <option value="send_quote">Send quote</option>
                    <option value="book_install">Book install</option>
                    <option value="invoice">Invoice</option>
                    <option value="chase_payment">Chase payment</option>
                  </select>
                </div>
              </div>
            ) : (
              <table className={styles.table}>
                <tbody>
                  <tr>
                    <th>Contact</th>
                    <td>
                      {project.contactId ? (
                        <Link className={styles.link} href={`/staff/contacts/${encodeURIComponent(project.contactId)}`}>
                          {contact?.displayName ?? project.contactId}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>Email</th>
                    <td className={styles.muted}>{contact?.email || '—'}</td>
                  </tr>
                  <tr>
                    <th>Phone</th>
                    <td className={styles.muted}>{contact?.phone || '—'}</td>
                  </tr>
                  <tr>
                    <th>Project name</th>
                    <td>{project.projectName ?? project.name ?? '—'}</td>
                  </tr>
                  <tr>
                    <th>Site address</th>
                    <td>{project.siteAddress ?? project.address ?? '—'}</td>
                  </tr>
                  <tr>
                    <th>Region</th>
                    <td>{project.region ?? '—'}</td>
                  </tr>
                  <tr>
                    <th>Quote ref</th>
                    <td>{project.quoteRef ?? '—'}</td>
                  </tr>
                  <tr>
                    <th>Next action</th>
                    <td>
                      {(project.nextActionDate ?? project.followUpDate)
                        ? `${project.nextActionDate ?? project.followUpDate}${project.nextActionType ? ` (${nextActionTypeLabel(project.nextActionType as any)})` : ''}`
                        : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className={styles.section} aria-label="Tasks">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Tasks</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className={styles.tabsPill} role="tablist" aria-label="Task status">
                <button
                  type="button"
                  role="tab"
                  aria-selected={taskTab === 'todo'}
                  className={`${styles.tabButton} ${taskTab === 'todo' ? styles.tabButtonActive : ''}`}
                  onClick={() => setTaskTabInUrl('todo')}
                >
                  To do ({todoTasks.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={taskTab === 'completed'}
                  className={`${styles.tabButton} ${taskTab === 'completed' ? styles.tabButtonActive : ''}`}
                  onClick={() => setTaskTabInUrl('completed')}
                >
                  Completed ({completedTasks.length})
                </button>
              </div>
              {mounted && tasksRes.isRefreshing ? <span className={styles.muted}>Refreshing…</span> : null}
            </div>
          </div>
          <div className={styles.sectionBody}>
            {!mounted ? <p className={styles.note}>Loading tasks…</p> : null}
            {mounted && tasksRes.error ? <p className={styles.error}>{tasksRes.error}</p> : null}
            {activeTasks.length ? (
              <div className={`${styles.tableWrap} ${styles.tableWrapScrollX}`}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Status</th>
                      <th>Due</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {activeTasks
                      .slice()
                      .sort(
                        (a, b) =>
                          (a.status === 'DONE' ? 1 : 0) - (b.status === 'DONE' ? 1 : 0) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
                      )
                      .map((t) => {
                        const done = t.status === 'DONE';
                        return (
                          <tr key={t.id}>
                            <td>
                              <div style={{ fontWeight: 700 }}>{t.title || t.type}</div>
                              <div className={styles.muted} style={{ fontSize: 12 }}>
                                {t.type}
                              </div>
                            </td>
                            <td>{t.status}</td>
                            <td className={styles.muted}>{t.dueAt ? new Date(t.dueAt).toLocaleString() : '—'}</td>
                            <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                className={styles.buttonSecondary}
                                disabled={Boolean(busy)}
                                onClick={() => {
                                  const nextDone = !done;
                                  const optimistic = tasks.map((x) =>
                                    x.id === t.id
                                      ? { ...x, status: (nextDone ? 'DONE' : 'OPEN') as any, completedAt: nextDone ? new Date().toISOString() : null }
                                      : x,
                                  );
                                  tasksRes.setData(optimistic);
                                  void runAction(`task_${t.id}`, async () => {
                                    await setTaskDone(t.id, nextDone);
                                    toast.success(nextDone ? 'Task done.' : 'Task reopened.');
                                  }).catch(() => tasksRes.refresh());
                                }}
                              >
                                {done ? 'Reopen' : 'Done'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.note}>{taskTab === 'completed' ? 'No completed tasks yet.' : 'No open tasks.'}</p>
            )}
          </div>
        </section>
      </div>

      <section className={styles.section} aria-label="Design ticket">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Design Ticket</h2>
          {mounted && ticketRes.isRefreshing ? <span className={styles.muted}>Refreshing…</span> : null}
          {ticketData && ticketData.status !== 'DONE' ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.buttonSecondary}
                disabled={Boolean(busy)}
                onClick={() => {
                  void runAction('design_done', async () => {
                    await apiJson(`/api/staff/v1/design_tickets/${encodeURIComponent(ticketData.id)}/action/mark_done`, { method: 'POST' });
                    toast.success('Design ticket marked done.');
                  });
                }}
              >
                Mark done
              </button>
            </div>
          ) : null}
        </div>
        <div className={styles.sectionBody}>
          {!mounted ? <p className={styles.note}>Loading design ticket…</p> : null}
          {mounted && ticketRes.error ? <p className={styles.error}>{ticketRes.error}</p> : null}
          {ticketData ? (
            <table className={styles.table}>
              <tbody>
                <tr>
                  <th>Tier</th>
                  <td>{ticketData.tier}</td>
                </tr>
                <tr>
                  <th>Status</th>
                  <td>{ticketData.status}</td>
                </tr>
                <tr>
                  <th>Due</th>
                  <td className={styles.muted}>{ticketData.dueAt ? new Date(ticketData.dueAt).toLocaleString() : '—'}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className={styles.note}>No design ticket yet.</p>
          )}
        </div>
      </section>

      <section className={styles.section} aria-label="Follow-ups">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Follow-up Timeline</h2>
          {mounted && followupsRes.isRefreshing ? <span className={styles.muted}>Refreshing…</span> : null}
        </div>
        <div className={styles.sectionBody}>
          {!mounted ? <p className={styles.note}>Loading follow-ups…</p> : null}
          {mounted && followupsRes.error ? <p className={styles.error}>{followupsRes.error}</p> : null}
          {followups.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {followups.map((f) => {
                    const done = f.status === 'DONE';
                    return (
                      <tr key={f.id}>
                        <td className={styles.muted}>{f.dueAt ? new Date(f.dueAt).toLocaleString() : '—'}</td>
                        <td>{f.type}</td>
                        <td>{f.status}</td>
                        <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className={styles.buttonSecondary}
                            disabled={Boolean(busy)}
                            onClick={() => {
                              const nextDone = !done;
                              const optimistic = followups.map((x) =>
                                x.id === f.id
                                  ? { ...x, status: (nextDone ? 'DONE' : 'OPEN') as any, completedAt: nextDone ? new Date().toISOString() : null }
                                  : x,
                              );
                              followupsRes.setData(optimistic);
                              void runAction(`followup_${f.id}`, async () => {
                                await setFollowupTaskDone(f.id, nextDone);
                                toast.success(nextDone ? 'Follow-up done.' : 'Follow-up reopened.');
                              }).catch(() => followupsRes.refresh());
                            }}
                          >
                            {done ? 'Reopen' : 'Done'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.note}>No follow-ups yet.</p>
          )}
        </div>
      </section>

      <section className={styles.section} aria-label="Email outbox">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Outbox Emails</h2>
          {mounted && outboxRes.isRefreshing ? <span className={styles.muted}>Refreshing…</span> : null}
        </div>
        <div className={styles.sectionBody}>
          {!mounted ? <p className={styles.note}>Loading outbox…</p> : null}
          {mounted && outboxRes.error ? <p className={styles.error}>{outboxRes.error}</p> : null}
          {outbox.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>To</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Vars</th>
                  </tr>
                </thead>
                <tbody>
                  {outbox.map((m) => (
                    <tr key={m.id}>
                      <td className={styles.muted}>{m.toEmail}</td>
                      <td>{m.subject}</td>
                      <td>{m.status}</td>
                      <td>
                        <details>
                          <summary style={{ cursor: 'pointer', fontSize: 12 }}>View</summary>
                          <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>
                            {JSON.stringify(m.variables ?? {}, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.note}>No outbox emails yet.</p>
          )}
        </div>
      </section>

      {process.env.NODE_ENV !== 'production' ? (
        <section className={styles.section} aria-label="Automation log">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Automation log (dev only)</h2>
            {mounted && auditRes.isRefreshing ? <span className={styles.muted}>Refreshing…</span> : null}
          </div>
          <div className={styles.sectionBody}>
            {!mounted ? <p className={styles.note}>Loading automation log…</p> : null}
            {mounted && auditRes.error ? <p className={styles.error}>{auditRes.error}</p> : null}
            {auditData.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Type</th>
                      <th>Key</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {auditData.map((ev) => (
                      <tr key={ev.id}>
                        <td className={styles.muted}>{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '—'}</td>
                        <td>{ev.type}</td>
                        <td className={styles.muted} style={{ fontSize: 12 }}>
                          {ev.idempotencyKey}
                        </td>
                        <td>
                          <details>
                            <summary style={{ cursor: 'pointer', fontSize: 12 }}>Payload</summary>
                            <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>
                              {JSON.stringify(ev.payload ?? null, null, 2)}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.note}>No automation events yet.</p>
            )}
          </div>
        </section>
      ) : null}

      <section className={styles.section} aria-label="Estimates">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Estimates</h2>
          <div className={styles.actions}>
            <Link className={styles.buttonSecondary} href={`/staff/calculator?projectId=${encodeURIComponent(project.id)}`}>
              Open Calculator
            </Link>
          </div>
        </div>
        <div className={styles.sectionBody}>
          {estimates.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Status</th>
                    <th>Total inc GST</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {estimates.map((e) => (
                    <tr key={e.id}>
                      <td className={styles.muted}>{new Date(e.createdAt).toLocaleString()}</td>
                      <td>{e.status}</td>
                      <td className={styles.muted}>
                        {typeof (e as any)?.outputs?.totals?.cost_inc_gst === 'number'
                          ? `$${(e as any).outputs.totals.cost_inc_gst.toFixed(2)}`
                          : '—'}
                      </td>
                      <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Link className={styles.buttonSecondary} href={`/staff/projects/${encodeURIComponent(project.id)}/estimate/${encodeURIComponent(e.id)}`}>
                          Open
                        </Link>
                        {isAdmin && e.status !== 'approved' ? (
                          <button
                            type="button"
                            className={styles.button}
                            disabled={Boolean(busy)}
                            onClick={() => {
                              void run(`approve-${e.id}`, async () => {
                                setError(null);
                                try {
                                  await updateEstimateStatus(e.id, 'approved', {
                                    projectSnapshot: { ...project, updatedAt: project.updatedAt ?? project.createdAt } as any,
                                  });
                                  setEstimates(await listEstimates(project.id));
                                  await addProjectActivity(project.id, { type: 'estimate_approved', message: 'Estimate approved.' } as any).catch(
                                    () => null,
                                  );
                                  toast.success('Estimate approved.');
                                } catch (err) {
                                  const msg = err instanceof Error ? err.message : 'Failed to approve estimate';
                                  setError(msg);
                                  toast.error(msg);
                                }
                              });
                            }}
                          >
                            Approve
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.note}>No estimates yet. Use the Calculator to generate one.</p>
          )}
        </div>
      </section>

      <section className={styles.section} aria-label="Activity">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Activity</h2>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <label htmlFor="activityNote">Add note</label>
            <input id="activityNote" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Note…" />
          </div>
          <div className={styles.actions} style={{ justifyContent: 'flex-start' }}>
            <button
              type="button"
              className={styles.buttonSecondary}
              disabled={Boolean(busy) || !noteDraft.trim()}
              onClick={() => {
                void run('addNote', async () => {
                  setError(null);
                  try {
                    const updated = await addProjectActivity(project.id, { type: 'note', message: noteDraft.trim() } as any);
                    setProject(updated);
                    setNoteDraft('');
                    toast.success('Note added.');
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Failed to add note';
                    setError(msg);
                    toast.error(msg);
                  }
                });
              }}
            >
              Add note
            </button>
          </div>

          {Array.isArray(project.activity) && project.activity.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 10 }}>
              {project.activity.slice(0, 25).map((a: any) => (
                <li key={a.id ?? `${a.createdAt}-${a.message}`}>
                  <div style={{ fontWeight: 700 }}>{a.type ?? 'event'}</div>
                  <div className={styles.muted}>{a.message ?? ''}</div>
                  {a.createdAt ? <div className={styles.muted} style={{ fontSize: 12 }}>{String(a.createdAt)}</div> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.note}>No activity yet.</p>
          )}
        </div>
      </section>
      </div>
    </main>
  );
}
