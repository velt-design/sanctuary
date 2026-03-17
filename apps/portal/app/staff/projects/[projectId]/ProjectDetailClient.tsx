'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getContact } from '@/lib/repo/contactsRepo';
import {
  addProjectActivity,
  deleteProject,
  getProject,
  setProjectFollowUpDate,
  setProjectStatus,
  updateProject,
  updateProjectFields,
} from '@/lib/repo/projectsRepo';
import { deleteEstimate, deleteEstimatesForProject, listEstimates } from '@/lib/repo/estimatesRepo';
import { listScheduleItems } from '@/lib/repo/scheduleRepo';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import type { Estimate } from '@/lib/types/estimate';
import styles from '../projects.module.css';
import { downloadJson, importExportFile, makeProjectExportFile, readJsonFile } from '@/lib/export/json';
import { persistImportResultToDb } from '@/lib/export/importPersist';
import { isCalculatorInputsV2, isLegacyCalculatorInputsV1 } from '@/lib/types/calculator';
import PipelineStepper from './PipelineStepper';
import PageHeader from '@/components/layout/PageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import MoreMenu from '@/components/portal/MoreMenu';
import { useToast } from '@/components/ui/toast/ToastProvider';
import RequestDesignModal from '@/components/designPackages/RequestDesignModal';
import { NEXT_ACTION_TYPE_ORDER, nextActionTypeLabel, PROJECT_STATUS_ORDER, projectStatusLabel } from '@/lib/types/project';
import Modal from '@/components/ui/modal/Modal';
import ConflictModal from '@/components/ui/ConflictModal';
import { PIPELINE_MODAL_ACTION_CLASSES, PipelineModal } from '@/components/ui/PipelineModal';
import {
  createQuoteFromEstimate,
  deleteQuote,
  duplicateQuoteAsRevision,
  listQuotesByProject,
  markQuotePaid,
  markQuoteSent,
  suggestNextQuoteNumber,
  updateQuote,
} from '@/lib/repo/quotesRepo';
import type { Quote } from '@/lib/types/quote';
import { quoteCustomerTotalIncGst, quoteLabel, quoteStatusLabel } from '@/lib/types/quote';
import { ProjectConflictError } from '@/lib/repo/errors';
import { apiJson } from '@/lib/repo/apiClient';

function formatMoney(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return `$${n.toFixed(2)}`;
}

type ProjectDraft = {
  projectName: string;
  quoteRef: string;
  region: string;
  siteAddress: string;
};

function projectToDraft(p: Project): ProjectDraft {
  return {
    projectName: p.projectName ?? p.name ?? '',
    quoteRef: p.quoteRef ?? '',
    region: p.region ?? '',
    siteAddress: p.siteAddress ?? p.address ?? '',
  };
}

export default function ProjectDetailClient({ projectId, isAdmin }: { projectId: string; isAdmin: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>('');
  const [notesEditing, setNotesEditing] = useState(false);
  const [newActivityNote, setNewActivityNote] = useState('');
  const [depositAmountInput, setDepositAmountInput] = useState('');

  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [deleteProjectText, setDeleteProjectText] = useState('');
  const [deleteEstimateId, setDeleteEstimateId] = useState<string | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<{ next: Project['status']; label: string } | null>(null);
  const [siteVisitTier, setSiteVisitTier] = useState<1 | 2 | null>(null);
  const [siteVisitTierError, setSiteVisitTierError] = useState<string | null>(null);
  const [createQuoteOpen, setCreateQuoteOpen] = useState(false);
  const [createQuoteEstimateId, setCreateQuoteEstimateId] = useState<string>('');
  const [createQuoteNumber, setCreateQuoteNumber] = useState<string>('');
  const [createQuoteTotalOverride, setCreateQuoteTotalOverride] = useState<string>('');
  const [createQuoteTotalTouched, setCreateQuoteTotalTouched] = useState(false);
  const [createQuoteNotes, setCreateQuoteNotes] = useState<string>('');
  const [requestDesignEstimate, setRequestDesignEstimate] = useState<Estimate | null>(null);
  const [quoteConfirm, setQuoteConfirm] = useState<
    | { kind: 'delete'; quoteId: string }
    | { kind: 'duplicate'; quoteId: string }
    | { kind: 'sent'; quoteId: string }
    | { kind: 'paid'; quoteId: string }
    | null
  >(null);
  const [conflict, setConflict] = useState<{ details?: string; retry: () => Promise<void> } | null>(null);

  const run = async (key: string, fn: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    setError(null);
    void (async () => {
      const p = await getProject(projectId);
      setProject(p);
      setContact(p?.contactId ? await getContact(p.contactId) : null);
      setNotesDraft(p?.notes ?? '');
      setEstimates(await listEstimates(projectId));
      setQuotes(await listQuotesByProject(projectId));
    })();
  }, [projectId]);

  useEffect(() => {
    if (!statusConfirm || statusConfirm.next !== 'SITE_VISIT') {
      setSiteVisitTier(null);
      setSiteVisitTierError(null);
    }
  }, [statusConfirm]);

  useEffect(() => {
    if (!project) return;
    const cents = typeof project.depositAmountCents === 'number' && Number.isFinite(project.depositAmountCents) ? project.depositAmountCents : null;
    setDepositAmountInput(cents === null ? '' : (cents / 100).toFixed(2));
  }, [project?.id, project?.depositAmountCents]);

  useEffect(() => {
    const t = searchParams.get('toast');
    if (t === 'estimate_deleted') {
      toast.success('Estimate deleted.');
      router.replace(`/staff/projects/${encodeURIComponent(projectId)}`);
    }
  }, [projectId, router, searchParams, toast]);

  const canSave = useMemo(() => {
    if (!draft) return false;
    return draft.projectName.trim().length > 0;
  }, [draft]);

  const notesDirty = useMemo(() => {
    if (!project) return false;
    return (notesDraft ?? '') !== (project.notes ?? '');
  }, [notesDraft, project]);

  const defaultQuoteEstimate = useMemo(() => {
    return estimates[0]?.id ?? '';
  }, [estimates]);

  const selectedQuoteEstimate = useMemo(
    () => estimates.find((e) => e.id === createQuoteEstimateId) ?? null,
    [createQuoteEstimateId, estimates],
  );

  const openCreateQuoteModal = (estimateId?: string) => {
    const id = estimateId ?? defaultQuoteEstimate;
    if (!id) {
      toast.error('Create an estimate first.');
      return;
    }
    setCreateQuoteEstimateId(id);
    setCreateQuoteNumber('…');
    void (async () => setCreateQuoteNumber(await suggestNextQuoteNumber()))();
    setCreateQuoteTotalTouched(false);
    const est = estimates.find((e) => e.id === id);
    setCreateQuoteTotalOverride(typeof est?.outputs?.totals?.cost_inc_gst === 'number' ? est.outputs.totals.cost_inc_gst.toFixed(2) : '');
    setCreateQuoteNotes('');
    setCreateQuoteOpen(true);
  };

  useEffect(() => {
    if (!createQuoteOpen) return;
    if (createQuoteTotalTouched) return;
    if (!selectedQuoteEstimate) return;
    setCreateQuoteTotalOverride(selectedQuoteEstimate.outputs.totals.cost_inc_gst.toFixed(2));
  }, [createQuoteOpen, createQuoteTotalTouched, selectedQuoteEstimate]);

  const applyStatus = async (next: Project['status'], opts?: { siteVisitPriorityTier?: 1 | 2 | null }) => {
    if (!project) return;
    if (!next) return;

    setError(null);
    try {
      const updated = await setProjectStatus(projectId, next as any, {
        siteVisitPriorityTier: opts?.siteVisitPriorityTier ?? null,
      });
      setProject(updated);
      toast.success('Status updated.');

      if (next === 'DEPOSIT' && !updated.depositPaidDate) {
        toast.info('Deposit stage: record deposit paid date (optional amount).');
        await addProjectActivity(projectId, { type: 'project_updated', message: 'Stage warning: Deposit set with no deposit paid date.' }).catch(() => null);
      }

      if (next === 'SCHEDULED') {
        const items = await listScheduleItems().catch(() => []);
        const hasSchedule = items.some((i) => i.projectId === projectId);
        if (!hasSchedule) {
          toast.info('Scheduled stage: assign a crew and dates on the Schedule page.');
          await addProjectActivity(projectId, { type: 'project_updated', message: 'Stage warning: Scheduled set with no crew/dates assigned.' }).catch(
            () => null,
          );
        }
      }

      if (next === 'PAID' && !updated.finalPaymentDate) {
        toast.info('Paid stage: record final payment date.');
        await addProjectActivity(projectId, { type: 'project_updated', message: 'Stage warning: Paid set with no final payment date.' }).catch(() => null);
      }
    } catch (err) {
      if (err instanceof ProjectConflictError) {
        setConflict({
          details: `Server updated at ${new Date((err.current as any).updatedAt ?? (err.current as any).createdAt).toLocaleString()}.`,
          retry: async () => {
            const updated = await setProjectStatus(projectId, next as any, {
              force: true,
              siteVisitPriorityTier: opts?.siteVisitPriorityTier ?? null,
            });
            setProject(updated);
          },
        });
        toast.error('This project was updated elsewhere.');
        return;
      }
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      setError(msg);
      toast.error(msg);
    }
  };

  const refreshProject = async () => {
    const next = await getProject(projectId);
    setProject(next);
    setContact(next?.contactId ? await getContact(next.contactId) : null);
  };

  const refreshQuotes = async () => setQuotes(await listQuotesByProject(projectId));

  const pillClassForQuote = (status: Quote['status']): string => {
    if (status === 'paid') return `${styles.statusPill} ${styles.statusPillPaid}`;
    if (status === 'sent') return `${styles.statusPill} ${styles.statusPillSent}`;
    return `${styles.statusPill} ${styles.statusPillDraft}`;
  };

  if (!project) {
    return (
      <main className={styles.page}>
        <PageHeader
          title="Project"
          right={
            <HeaderActions>
              <Link className={styles.buttonSecondary} href="/staff/projects">
                Projects
              </Link>
            </HeaderActions>
          }
        />
        <p className={styles.note}>This project doesn’t exist in the portal database.</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <PageHeader
        title={project.projectName ?? project.name ?? 'Project'}
        right={
          <HeaderActions>
            <Link className={styles.buttonSecondary} href="/staff/projects">
              Projects
            </Link>
            <button
              type="button"
              className={styles.buttonSecondary}
              disabled={!estimates.length || Boolean(busy)}
              onClick={() => openCreateQuoteModal()}
            >
              New Quote
            </button>
            <Link className={styles.button} href={`/staff/calculator?projectId=${encodeURIComponent(projectId)}`}>
              New Estimate
            </Link>
            {isAdmin ? (
              <button
                type="button"
                className={styles.buttonDanger}
                disabled={Boolean(busy)}
                onClick={() => {
                  setDeleteProjectText('');
                  setDeleteProjectOpen(true);
                }}
              >
                Delete project
              </button>
            ) : null}
            <MoreMenu
              items={[
                {
                  label: 'Export Project JSON',
                  onClick: async () => {
                    try {
                      const file = await makeProjectExportFile(project, estimates);
                      downloadJson(`project_${project.id}.json`, file);
                      toast.success('Project JSON exported.');
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Export failed';
                      toast.error(msg);
                    }
                  },
                  disabled: Boolean(busy),
                },
                {
                  label: 'Import JSON',
                  onClick: () => {
                    setError(null);
                    importRef.current?.click();
                  },
                  disabled: Boolean(busy),
                },
              ]}
              disabled={Boolean(busy)}
            />
          </HeaderActions>
        }
      />
      <div className="mt-1 mb-3 text-xs text-zinc-500">Project ID: {project.id}</div>

      <input
        ref={importRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setError(null);

          await run('importJson', async () => {
            try {
              const payload = await readJsonFile(file);
              const res = importExportFile(payload);
              await persistImportResultToDb(res);
              await apiJson('/api/staff/v1/imports', {
                method: 'POST',
                body: JSON.stringify({
                  filename: file.name || 'import.json',
                  stats: {
                    kind: 'json_import',
                    result:
                      res.kind === 'project'
                        ? { kind: res.kind, projectId: res.projectId, estimatesImported: res.estimatesImported }
                        : { kind: res.kind, projectId: res.projectId, estimateId: res.estimateId },
                  },
                }),
              }).catch(() => null);
              if (res.kind === 'project') {
                toast.success(`Imported project ${res.projectId} (${res.estimatesImported} estimate(s)).`);
                router.push(`/staff/projects/${encodeURIComponent(res.projectId)}`);
              } else {
                toast.success(`Imported estimate ${res.estimateId}.`);
                router.push(`/staff/projects/${encodeURIComponent(res.projectId)}/estimate/${encodeURIComponent(res.estimateId)}`);
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Import failed';
              setError(msg);
              toast.error(msg);
            }
          });
        }}
      />

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.pageStack}>
      <section className={styles.section} aria-label="Pipeline">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Pipeline</h2>
        </div>
        <div className={styles.sectionBody}>
          <PipelineStepper
            currentStatus={(project.status ?? 'NEW') as any}
            onRequestChange={(next, label) => {
              setStatusConfirm({ next, label });
            }}
          />

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="projectStatus">Status</label>
              <select
                id="projectStatus"
                value={project.status ?? 'NEW'}
                onChange={(e) => {
                  const next = e.target.value as any;
                  if (next === 'SITE_VISIT') {
                    setStatusConfirm({ next, label: projectStatusLabel(next) });
                    return;
                  }
                  applyStatus(next);
                }}
              >
                {PROJECT_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {projectStatusLabel(status)}
                  </option>
                ))}
              </select>
              <div className={styles.muted} style={{ marginTop: 6, fontSize: 12 }}>
                {project.isLost ? <span style={{ marginRight: 10 }}>Outcome: <strong>Lost</strong></span> : null}
                {project.isArchived ? <span>Outcome: <strong>Archived</strong></span> : null}
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="nextActionDate">Next action</label>
              <input
                id="nextActionDate"
                type="date"
                value={project.nextActionDate ?? project.followUpDate ?? ''}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  setError(null);
                  run('followUp', async () => {
                    try {
                      const updated = await setProjectFollowUpDate(projectId, value ? value : null);
                      setProject(updated);
                      toast.success('Next action updated.');
                    } catch (err) {
                      if (err instanceof ProjectConflictError) {
                        setConflict({
                          details: `Server updated at ${new Date((err.current as any).updatedAt ?? (err.current as any).createdAt).toLocaleString()}.`,
                          retry: async () => {
                            const updated = await setProjectFollowUpDate(projectId, value ? value : null, { force: true });
                            setProject(updated);
                          },
                        });
                        toast.error('This project was updated elsewhere.');
                        return;
                      }
                      const msg = err instanceof Error ? err.message : 'Failed to update next action';
                      setError(msg);
                      toast.error(msg);
                    }
                  });
                }}
              />
              <select
                className={styles.inlineInput}
                value={project.nextActionType ?? ''}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  run('nextActionType', async () => {
                    try {
                      const updated = await updateProjectFields(projectId, { nextActionType: value ? (value as any) : null });
                      setProject(updated);
                      toast.success('Next action updated.');
                    } catch (err) {
                      if (err instanceof ProjectConflictError) {
                        setConflict({
                          details: `Server updated at ${new Date((err.current as any).updatedAt ?? (err.current as any).createdAt).toLocaleString()}.`,
                          retry: async () => {
                            const updated = await updateProjectFields(projectId, { nextActionType: value ? (value as any) : null }, { force: true });
                            setProject(updated);
                          },
                        });
                        toast.error('This project was updated elsewhere.');
                        return;
                      }
                      const msg = err instanceof Error ? err.message : 'Failed to update next action';
                      setError(msg);
                      toast.error(msg);
                    }
                  });
                }}
                style={{ marginTop: 10 }}
              >
                <option value="">Type…</option>
                {NEXT_ACTION_TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {nextActionTypeLabel(t)}
                  </option>
                ))}
              </select>
              <div className={styles.actions} style={{ justifyContent: 'flex-start', marginTop: 10 }}>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  onClick={() => {
                    setError(null);
                    run('followUp', async () => {
                      try {
                        const updated = await setProjectFollowUpDate(projectId, null);
                        setProject(updated);
                        toast.success('Next action cleared.');
                      } catch (err) {
                        if (err instanceof ProjectConflictError) {
                          setConflict({
                            details: `Server updated at ${new Date((err.current as any).updatedAt ?? (err.current as any).createdAt).toLocaleString()}.`,
                            retry: async () => {
                              const updated = await setProjectFollowUpDate(projectId, null, { force: true });
                              setProject(updated);
                            },
                          });
                          toast.error('This project was updated elsewhere.');
                          return;
                        }
                        const msg = err instanceof Error ? err.message : 'Failed to clear next action';
                        setError(msg);
                        toast.error(msg);
                      }
                    });
                  }}
                >
                  Clear next action
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="depositAmount">Deposit</label>
              <input
                id="depositAmount"
                className={styles.inlineInput}
                inputMode="decimal"
                placeholder="Amount (NZD)"
                value={depositAmountInput}
                onChange={(e) => setDepositAmountInput(e.target.value)}
                onBlur={() => {
                  const raw = depositAmountInput.trim();
                  const parsed = raw ? Number(raw.replace(/[^0-9.\\-]/g, '')) : NaN;
                  const cents = raw && Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : null;
                  run('deposit', async () => {
                    try {
                      const updated = await updateProjectFields(projectId, { depositAmountCents: cents });
                      setProject(updated);
                      toast.success('Deposit updated.');
                    } catch (err) {
                      if (err instanceof ProjectConflictError) {
                        setConflict({
                          details: `Server updated at ${new Date((err.current as any).updatedAt ?? (err.current as any).createdAt).toLocaleString()}.`,
                          retry: async () => {
                            const updated = await updateProjectFields(projectId, { depositAmountCents: cents }, { force: true });
                            setProject(updated);
                          },
                        });
                        toast.error('This project was updated elsewhere.');
                        return;
                      }
                      const msg = err instanceof Error ? err.message : 'Failed to update deposit';
                      setError(msg);
                      toast.error(msg);
                    }
                  });
                }}
              />
              <input
                type="date"
                className={styles.inlineInput}
                value={project.depositPaidDate ?? ''}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  run('deposit', async () => {
                    try {
                      const updated = await updateProjectFields(projectId, { depositPaidDate: value ? value : null });
                      setProject(updated);
                      toast.success('Deposit updated.');
                    } catch (err) {
                      if (err instanceof ProjectConflictError) {
                        setConflict({
                          details: `Server updated at ${new Date((err.current as any).updatedAt ?? (err.current as any).createdAt).toLocaleString()}.`,
                          retry: async () => {
                            const updated = await updateProjectFields(projectId, { depositPaidDate: value ? value : null }, { force: true });
                            setProject(updated);
                          },
                        });
                        toast.error('This project was updated elsewhere.');
                        return;
                      }
                      const msg = err instanceof Error ? err.message : 'Failed to update deposit';
                      setError(msg);
                      toast.error(msg);
                    }
                  });
                }}
                style={{ marginTop: 10 }}
              />
              <div className={styles.muted} style={{ marginTop: 6, fontSize: 12 }}>
                Amount is optional. Date is when deposit was paid.
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="finalPaymentDate">Paid</label>
              <input
                id="finalPaymentDate"
                type="date"
                className={styles.inlineInput}
                value={project.finalPaymentDate ?? ''}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  run('finalPayment', async () => {
                    try {
                      const updated = await updateProjectFields(projectId, { finalPaymentDate: value ? value : null });
                      setProject(updated);
                      toast.success('Payment updated.');
                    } catch (err) {
                      if (err instanceof ProjectConflictError) {
                        setConflict({
                          details: `Server updated at ${new Date((err.current as any).updatedAt ?? (err.current as any).createdAt).toLocaleString()}.`,
                          retry: async () => {
                            const updated = await updateProjectFields(projectId, { finalPaymentDate: value ? value : null }, { force: true });
                            setProject(updated);
                          },
                        });
                        toast.error('This project was updated elsewhere.');
                        return;
                      }
                      const msg = err instanceof Error ? err.message : 'Failed to update payment';
                      setError(msg);
                      toast.error(msg);
                    }
                  });
                }}
              />
              <div className={styles.muted} style={{ marginTop: 6, fontSize: 12 }}>
                Final payment date (used when stage is Paid).
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-label="Project info">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Project Info</h2>
          <div className={styles.actions}>
            {isEditing ? (
              <>
                <button
                  type="button"
                  className={styles.button}
                  disabled={!canSave}
                  onClick={() => {
                    if (!draft) return;
                    setError(null);
                    run('projectInfo', async () => {
                      try {
                        const updated = await updateProject(projectId, {
                          projectName: draft.projectName.trim(),
                          quoteRef: draft.quoteRef.trim() || undefined,
                          region: draft.region.trim() || undefined,
                          siteAddress: draft.siteAddress.trim() || undefined,
                        });
                        const withActivity = await addProjectActivity(projectId, { type: 'project_updated', message: 'Project info updated' });
                        setProject(withActivity);
                        setContact(withActivity.contactId ? await getContact(withActivity.contactId) : null);
                        setIsEditing(false);
                        setDraft(null);
                        toast.success('Project updated.');
                      } catch (err) {
                        if (err instanceof ProjectConflictError) {
                          setConflict({
                            details: `Server updated at ${new Date((err.current as any).updatedAt ?? (err.current as any).createdAt).toLocaleString()}.`,
                            retry: async () => {
                              const updated = await updateProject(
                                projectId,
                                {
                                  projectName: draft.projectName.trim(),
                                  quoteRef: draft.quoteRef.trim() || undefined,
                                  region: draft.region.trim() || undefined,
                                  siteAddress: draft.siteAddress.trim() || undefined,
                                },
                                { force: true },
                              );
                              const withActivity = await addProjectActivity(projectId, { type: 'project_updated', message: 'Project info updated' }, { force: true });
                              setProject(withActivity);
                              setContact(withActivity.contactId ? await getContact(withActivity.contactId) : null);
                              setIsEditing(false);
                              setDraft(null);
                              void updated;
                            },
                          });
                          toast.error('This project was updated elsewhere.');
                          return;
                        }
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
                  onClick={() => {
                    setIsEditing(false);
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
                onClick={() => {
                  setIsEditing(true);
                  setDraft(projectToDraft(project));
                  setError(null);
                }}
              >
                Edit
              </button>
            )}
          </div>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <th style={{ width: 180 }}>Project name</th>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.inlineInput}
                        value={draft?.projectName ?? ''}
                        onChange={(e) => setDraft((prev) => ({ ...(prev ?? projectToDraft(project)), projectName: e.target.value }))}
                        required
                      />
                    ) : (
                      project.projectName ?? project.name ?? '—'
                    )}
                  </td>
                </tr>
                <tr>
                  <th>Quote ref</th>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.inlineInput}
                        value={draft?.quoteRef ?? ''}
                        onChange={(e) => setDraft((prev) => ({ ...(prev ?? projectToDraft(project)), quoteRef: e.target.value }))}
                      />
                    ) : (
                      project.quoteRef ?? '—'
                    )}
                  </td>
                </tr>
                <tr>
                  <th>Region</th>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.inlineInput}
                        value={draft?.region ?? ''}
                        onChange={(e) => setDraft((prev) => ({ ...(prev ?? projectToDraft(project)), region: e.target.value }))}
                      />
                    ) : (
                      project.region ?? '—'
                    )}
                  </td>
                </tr>
                <tr>
                  <th>Site address</th>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.inlineInput}
                        value={draft?.siteAddress ?? ''}
                        onChange={(e) => setDraft((prev) => ({ ...(prev ?? projectToDraft(project)), siteAddress: e.target.value }))}
                      />
                    ) : (
                      project.siteAddress ?? project.address ?? '—'
                    )}
                  </td>
                </tr>
                <tr>
                  <th>Created</th>
                  <td>{new Date(project.createdAt).toLocaleString()}</td>
                </tr>
                <tr>
                  <th>Updated</th>
                  <td>{project.updatedAt ? new Date(project.updatedAt).toLocaleString() : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-label="Contact">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Contact</h2>
          {project.contactId ? (
            <Link className={styles.buttonSecondary} href={`/staff/contacts/${encodeURIComponent(project.contactId)}`}>
              Open contact
            </Link>
          ) : null}
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <th style={{ width: 180 }}>Name</th>
                  <td>{contact?.displayName ?? '—'}</td>
                </tr>
                <tr>
                  <th>Email</th>
                  <td className={styles.muted}>{contact?.email || '—'}</td>
                </tr>
                <tr>
                  <th>Phone</th>
                  <td className={styles.muted}>{contact?.phone || '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-label="Estimates">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Estimates</h2>
        </div>
        <div className={styles.sectionBody}>
          {estimates.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Status</th>
                    <th>Total (ex‑GST)</th>
                    <th>Summary</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {estimates.map((e) => {
                    const inputs: unknown = (e as any).inputs;
                    let summary = '—';
                    if (isCalculatorInputsV2(inputs)) {
                      const mods = inputs.modules ?? [];
                      const formatModule = (m: any) =>
                        m?.pergolaStyle === 'hip_corner'
                          ? `${m.pergolaStyle}, ${m.roofMaterial}, A:${m.lengthM}×${m.projectionM} B:${m.hipCornerLengthBM}×${m.hipCornerProjectionBM}m`
                          : `${m?.pergolaStyle ?? '—'}, ${m?.roofMaterial ?? '—'}, ${m?.lengthM ?? '—'}×${m?.projectionM ?? '—'}m`;
                      summary = mods.length > 1 ? `${mods.length} modules · ${formatModule(mods[0])}` : formatModule(mods[0]);
                    } else if (isLegacyCalculatorInputsV1(inputs)) {
                      summary = `${inputs.pergolaStyle}, ${inputs.roofMaterial}, ${inputs.lengthM}×${inputs.projectionM}m`;
                    }
                    return (
                      <tr key={e.id}>
                        <td className={styles.muted}>{new Date(e.createdAt).toLocaleString()}</td>
                        <td>{e.status}</td>
                        <td>{formatMoney(e.outputs.totals.cost_ex_gst)}</td>
                        <td className={styles.muted}>{summary}</td>
                        <td>
                          <div className={styles.rowActions}>
                            <Link className={styles.link} href={`/staff/projects/${encodeURIComponent(projectId)}/estimate/${encodeURIComponent(e.id)}`}>
                              View
                            </Link>
                            <button
                              type="button"
                              className={styles.buttonSecondary}
                              disabled={Boolean(busy)}
                              onClick={() => openCreateQuoteModal(e.id)}
                            >
                              Create Quote
                            </button>
                            <button
                              type="button"
                              className={styles.buttonSecondary}
                              disabled={Boolean(busy)}
                              onClick={() => setRequestDesignEstimate(e)}
                            >
                              Request Design
                            </button>
                            <Link
                              className={styles.link}
                              href={`/staff/calculator?projectId=${encodeURIComponent(projectId)}&fromEstimateId=${encodeURIComponent(e.id)}`}
                            >
                              Duplicate
                            </Link>
                            {isAdmin ? (
                              <button
                                type="button"
                                className={styles.buttonDanger}
                                onClick={() => {
                                  setDeleteEstimateId(e.id);
                                  setError(null);
                                }}
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
            <p className={styles.note}>No estimates yet. Click “New Estimate” to generate one from the calculator.</p>
          )}
        </div>
      </section>

      <section className={styles.section} aria-label="Quotes">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Quotes</h2>
        </div>
        <div className={styles.sectionBody}>
          {quotes.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Quote</th>
                    <th>Status</th>
                    <th>Total (inc‑GST)</th>
                    <th>Source estimate</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.id}>
                      <td className={styles.muted}>{new Date(q.createdAt).toLocaleString()}</td>
                      <td>{q.quoteNumber ?? quoteLabel(q)}</td>
                      <td>
                        <span className={pillClassForQuote(q.status)}>{quoteStatusLabel(q.status)}</span>
                      </td>
                      <td>{formatMoney(quoteCustomerTotalIncGst(q))}</td>
                      <td className={styles.muted}>
                        <Link className={styles.link} href={`/staff/projects/${encodeURIComponent(projectId)}/estimate/${encodeURIComponent(q.sourceEstimateId)}`}>
                          {typeof q.sourceEstimateVersion === 'number' ? `Estimate v${q.sourceEstimateVersion}` : 'Estimate'}
                        </Link>
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <Link className={styles.link} href={`/staff/projects/${encodeURIComponent(projectId)}/quotes/${encodeURIComponent(q.id)}`}>
                            View
                          </Link>
                          <Link
                            className={styles.link}
                            href={`/staff/projects/${encodeURIComponent(projectId)}/quotes/${encodeURIComponent(q.id)}/print`}
                            target="_blank"
                          >
                            Print
                          </Link>
                          <button
                            type="button"
                            className={styles.buttonSecondary}
                            disabled={Boolean(busy)}
                            onClick={() => setQuoteConfirm({ kind: 'duplicate', quoteId: q.id })}
                          >
                            Duplicate
                          </button>
                          {q.status === 'draft' ? (
                            <button
                              type="button"
                              className={styles.buttonSecondary}
                              disabled={Boolean(busy)}
                              onClick={() => setQuoteConfirm({ kind: 'sent', quoteId: q.id })}
                            >
                              Mark Sent
                            </button>
                          ) : null}
                          {q.status === 'sent' ? (
                            <button
                              type="button"
                              className={styles.buttonSecondary}
                              disabled={Boolean(busy)}
                              onClick={() => setQuoteConfirm({ kind: 'paid', quoteId: q.id })}
                            >
                              Mark Paid
                            </button>
                          ) : null}
                          {isAdmin ? (
                            <button
                              type="button"
                              className={styles.buttonDanger}
                              disabled={Boolean(busy)}
                              onClick={() => setQuoteConfirm({ kind: 'delete', quoteId: q.id })}
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.note} style={{ margin: 0 }}>
              No quotes yet. Click “New Quote” to create one from an estimate snapshot.
            </p>
          )}
        </div>
      </section>

      <section className={styles.section} aria-label="Notes">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Notes</h2>
          <div className={styles.actions}>
            {notesEditing ? (
              <>
                <button
                  type="button"
                  className={styles.button}
                  disabled={!notesDirty}
                  onClick={() => {
                    setError(null);
                    run('notes', async () => {
                      try {
                        await updateProjectFields(projectId, { notes: notesDraft });
                        const updated = await addProjectActivity(projectId, { type: 'project_updated', message: 'Notes updated' });
                        setProject(updated);
                        setNotesEditing(false);
                        toast.success('Notes saved.');
                      } catch (err) {
                        if (err instanceof ProjectConflictError) {
                          setConflict({
                            details: `Server updated at ${new Date((err.current as any).updatedAt ?? (err.current as any).createdAt).toLocaleString()}.`,
                            retry: async () => {
                              await updateProjectFields(projectId, { notes: notesDraft }, { force: true });
                              const updated = await addProjectActivity(projectId, { type: 'project_updated', message: 'Notes updated' }, { force: true });
                              setProject(updated);
                              setNotesEditing(false);
                            },
                          });
                          toast.error('This project was updated elsewhere.');
                          return;
                        }
                        const msg = err instanceof Error ? err.message : 'Failed to save notes';
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
                  onClick={() => {
                    setNotesDraft(project.notes ?? '');
                    setNotesEditing(false);
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => {
                  setNotesDraft(project.notes ?? '');
                  setNotesEditing(true);
                }}
              >
                Edit
              </button>
            )}
          </div>
        </div>
        <div className={styles.sectionBody}>
          {notesEditing ? (
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={6}
              style={{
                width: '100%',
                margin: 0,
                padding: '12px',
                borderRadius: 12,
                border: '1px solid rgba(var(--portal-text-rgb), 0.18)',
                background: 'var(--portal-bg-surface)',
                color: 'inherit',
                fontSize: 14,
                resize: 'vertical',
              }}
            />
          ) : (
            <p className={styles.note} style={{ whiteSpace: 'pre-wrap' }}>
              {project.notes?.trim() ? project.notes : 'No notes yet.'}
            </p>
          )}
        </div>
      </section>

      <section className={styles.section} aria-label="Activity">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Activity</h2>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <label htmlFor="addActivity">Add note</label>
            <input
              id="addActivity"
              value={newActivityNote}
              onChange={(e) => setNewActivityNote(e.target.value)}
              placeholder="Quick note…"
            />
            <div className={styles.actions} style={{ justifyContent: 'flex-start', marginTop: 10 }}>
              <button
                type="button"
                className={styles.buttonSecondary}
                disabled={!newActivityNote.trim()}
                onClick={() => {
                  setError(null);
                  run('activity', async () => {
                    try {
                      const updated = await addProjectActivity(projectId, { type: 'note', message: newActivityNote.trim() });
                      setProject(updated);
                      setNewActivityNote('');
                      toast.success('Note added.');
                    } catch (err) {
                      if (err instanceof ProjectConflictError) {
                        setConflict({
                          details: `Server updated at ${new Date((err.current as any).updatedAt ?? (err.current as any).createdAt).toLocaleString()}.`,
                          retry: async () => {
                            const updated = await addProjectActivity(projectId, { type: 'note', message: newActivityNote.trim() }, { force: true });
                            setProject(updated);
                            setNewActivityNote('');
                          },
                        });
                        toast.error('This project was updated elsewhere.');
                        return;
                      }
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
          </div>

          {Array.isArray(project.activity) && project.activity.length ? (
            <div className={styles.tableWrap} style={{ marginTop: 14 }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {project.activity.map((ev) => (
                    <tr key={ev.id}>
                      <td className={styles.muted}>{new Date(ev.createdAt).toLocaleString()}</td>
                      <td className={styles.muted}>{ev.type}</td>
                      <td>{ev.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.note} style={{ marginTop: 14 }}>
              No activity yet.
            </p>
          )}
        </div>
      </section>
      </div>

      {deleteEstimateId ? (
        <Modal
          open
          ariaLabel="Delete estimate confirmation"
          onClose={() => setDeleteEstimateId(null)}
          overlayClassName={styles.modalOverlay}
          panelClassName={styles.modal}
          maxWidthPx={520}
        >
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Delete estimate?</h2>
            <button type="button" className={styles.modalClose} onClick={() => setDeleteEstimateId(null)}>
              Close
            </button>
          </div>
          <p className={styles.note}>This removes the estimate snapshot from the portal database.</p>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.buttonSecondary} onClick={() => setDeleteEstimateId(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.buttonDanger}
              disabled={busy === 'deleteEstimate'}
              onClick={() => {
                run('deleteEstimate', () => {
                  setError(null);
                  return (async () => {
                    try {
                      await deleteEstimate(deleteEstimateId);
                      setDeleteEstimateId(null);
                      setEstimates(await listEstimates(projectId));
                      toast.success('Estimate deleted.');
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Failed to delete estimate';
                      setError(msg);
                      toast.error(msg);
                    }
                  })();
                });
              }}
            >
              {busy === 'deleteEstimate' ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      ) : null}

      {createQuoteOpen ? (
        <Modal
          open
          ariaLabel="Create quote"
          onClose={() => setCreateQuoteOpen(false)}
          overlayClassName={styles.modalOverlay}
          panelClassName={styles.modal}
          maxWidthPx={720}
        >
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Create quote</h2>
            <button type="button" className={styles.modalClose} onClick={() => setCreateQuoteOpen(false)}>
              Close
            </button>
          </div>
          <p className={styles.note}>Quotes store a snapshot of the selected estimate so future config changes don’t affect it.</p>
          <div className={styles.field}>
            <label htmlFor="quoteEstimate">Estimate</label>
            <select
              id="quoteEstimate"
              className={styles.inlineInput}
              value={createQuoteEstimateId}
              onChange={(e) => setCreateQuoteEstimateId(e.target.value)}
            >
              {estimates.map((e) => (
                <option key={e.id} value={e.id}>
                  {`Estimate v${e.version ?? '—'} · ${e.status} · ${new Date(e.createdAt).toLocaleDateString()}`}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field} style={{ marginTop: 10 }}>
            <label htmlFor="quoteNumber">Quote number</label>
            <input
              id="quoteNumber"
              className={styles.inlineInput}
              value={createQuoteNumber}
              onChange={(e) => setCreateQuoteNumber(e.target.value)}
              placeholder="Q-2026-0001"
            />
          </div>
          <div className={styles.field} style={{ marginTop: 10 }}>
            <label htmlFor="quoteTotal">Customer total (inc‑GST)</label>
            <input
              id="quoteTotal"
              className={styles.inlineInput}
              inputMode="decimal"
              value={createQuoteTotalOverride}
              onChange={(e) => {
                setCreateQuoteTotalOverride(e.target.value);
                setCreateQuoteTotalTouched(true);
              }}
              placeholder={selectedQuoteEstimate ? selectedQuoteEstimate.outputs.totals.cost_inc_gst.toFixed(2) : ''}
            />
          </div>
          <div className={styles.field} style={{ marginTop: 10 }}>
            <label htmlFor="quoteNotes">Notes (optional)</label>
            <textarea
              id="quoteNotes"
              value={createQuoteNotes}
              onChange={(e) => setCreateQuoteNotes(e.target.value)}
              rows={4}
              style={{ width: '100%', margin: 0, padding: 12, borderRadius: 10, border: '1px solid rgba(var(--portal-text-rgb), 0.12)' }}
              placeholder="Optional notes to include on the quote."
            />
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.buttonSecondary} onClick={() => setCreateQuoteOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.button}
              disabled={Boolean(busy) || !createQuoteEstimateId}
              onClick={() => {
                run('createQuote', () => {
                  return (async () => {
                    try {
                      const estimate = selectedQuoteEstimate;
                      const fallbackTotal = estimate ? estimate.outputs.totals.cost_inc_gst : 0;
                      const rawOverride = String(createQuoteTotalOverride ?? '').trim();
                      const totalOverrideParsed = rawOverride ? Number(rawOverride.replace(/[^0-9.\\-]/g, '')) : NaN;
                      const totalOverride = Number.isFinite(totalOverrideParsed) ? totalOverrideParsed : fallbackTotal;

                      const quote = await createQuoteFromEstimate(projectId, createQuoteEstimateId, {
                        quoteNumber: createQuoteNumber,
                        customerTotalOverride: totalOverride,
                        notes: createQuoteNotes.trim() ? createQuoteNotes.trim() : null,
                      });
                      void refreshQuotes();
                      void refreshProject();
                      setCreateQuoteOpen(false);
                      toast.success(`${quoteLabel(quote)} created.`);
                      router.push(`/staff/projects/${encodeURIComponent(projectId)}/quotes/${encodeURIComponent(quote.id)}`);
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Failed to create quote';
                      setError(msg);
                      toast.error(msg);
                    }
                  })();
                });
              }}
            >
              Create
            </button>
          </div>
        </Modal>
      ) : null}

      {requestDesignEstimate ? (
        <RequestDesignModal
          open
          onOpenChange={(open) => {
            if (!open) setRequestDesignEstimate(null);
          }}
          projectId={projectId}
          estimateId={requestDesignEstimate.id}
          estimateLabel={`v${requestDesignEstimate.version ?? '—'}`}
          requestSource="estimates_tab"
        />
      ) : null}

      {quoteConfirm ? (
        <Modal
          open
          ariaLabel="Quote action confirmation"
          onClose={() => setQuoteConfirm(null)}
          overlayClassName={styles.modalOverlay}
          panelClassName={styles.modal}
          maxWidthPx={520}
        >
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>
              {quoteConfirm.kind === 'delete'
                ? 'Delete quote?'
                : quoteConfirm.kind === 'duplicate'
                  ? 'Duplicate as revision?'
                  : quoteConfirm.kind === 'sent'
                    ? 'Mark sent?'
                    : quoteConfirm.kind === 'paid'
                      ? 'Mark paid?'
                      : 'Confirm quote action?'}
            </h2>
            <button type="button" className={styles.modalClose} onClick={() => setQuoteConfirm(null)}>
              Close
            </button>
          </div>
          <p className={styles.note}>
            {quoteConfirm.kind === 'delete'
              ? 'This removes the quote snapshot from the portal database.'
              : quoteConfirm.kind === 'duplicate'
                ? 'This will create a new draft revision you can edit.'
                : quoteConfirm.kind === 'sent'
                  ? 'This will lock the quote content and set the Sent date.'
                  : quoteConfirm.kind === 'paid'
                    ? 'This will mark the quote as paid and set the Paid date.'
                    : 'Continue?'}
          </p>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.buttonSecondary} onClick={() => setQuoteConfirm(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={quoteConfirm.kind === 'delete' ? styles.buttonDanger : styles.button}
              disabled={Boolean(busy)}
              onClick={() => {
                run('quoteAction', () => {
                  return (async () => {
                    try {
                      const q = quotes.find((x) => x.id === quoteConfirm.quoteId);
                      if (!q) throw new Error('Quote not found.');

                      if (quoteConfirm.kind === 'delete') {
                        await deleteQuote(q.id);
                        void refreshQuotes();
                        void refreshProject();
                        setQuoteConfirm(null);
                        toast.success('Quote deleted.');
                        return;
                      }
                      if (quoteConfirm.kind === 'duplicate') {
                        const next = await duplicateQuoteAsRevision(q.id);
                        void refreshQuotes();
                        void refreshProject();
                        setQuoteConfirm(null);
                        toast.success(`${quoteLabel(next)} created.`);
                        router.push(`/staff/projects/${encodeURIComponent(projectId)}/quotes/${encodeURIComponent(next.id)}`);
                        return;
                      }
                      if (quoteConfirm.kind === 'sent') {
                        await markQuoteSent(q.id);
                        void refreshQuotes();
                        void refreshProject();
                        setQuoteConfirm(null);
                        toast.success('Quote marked sent.');
                        return;
                      }
                      if (quoteConfirm.kind === 'paid') {
                        await markQuotePaid(q.id);
                        void refreshQuotes();
                        void refreshProject();
                        setQuoteConfirm(null);
                        toast.success('Quote marked paid.');
                        return;
                      }
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Quote action failed';
                      setError(msg);
                      toast.error(msg);
                    }
                  })();
                });
              }}
            >
              Confirm
            </button>
          </div>
        </Modal>
      ) : null}

      {statusConfirm ? (
        <PipelineModal
          open
          onOpenChange={(open) => {
            if (!open) {
              setStatusConfirm(null);
              setSiteVisitTier(null);
              setSiteVisitTierError(null);
            }
          }}
          title="Move stage"
          description={`Move this project from ${projectStatusLabel((project.status ?? 'NEW') as any)} to ${statusConfirm.label}?`}
          actions={
            <>
              <button
                type="button"
                className={PIPELINE_MODAL_ACTION_CLASSES.primary}
                disabled={Boolean(busy)}
                onClick={() => {
                  const next = statusConfirm.next;
                  if (next === 'SITE_VISIT' && !siteVisitTier) {
                    setSiteVisitTierError('Select Tier 1 or Tier 2 to proceed to Site Visit.');
                    return;
                  }
                  setStatusConfirm(null);
                  applyStatus(next, { siteVisitPriorityTier: next === 'SITE_VISIT' ? siteVisitTier : null });
                }}
              >
                Move to {statusConfirm.label}
              </button>
              <button
                type="button"
                className={PIPELINE_MODAL_ACTION_CLASSES.secondary}
                onClick={() => setStatusConfirm(null)}
              >
                Cancel
              </button>
            </>
          }
        >
          {statusConfirm.next === 'SITE_VISIT' ? (
            <div className={styles.stageModalSection}>
              <div className={styles.stageModalLabel}>Site visit priority (required)</div>
              <div className={styles.stageModalHelper}>Budget + timeline only.</div>
              <div className={styles.stageModalRadioGroup}>
                <label className={styles.stageModalRadio}>
                  <input
                    type="radio"
                    name="siteVisitTier"
                    checked={siteVisitTier === 1}
                    onChange={() => {
                      setSiteVisitTier(1);
                      setSiteVisitTierError(null);
                    }}
                  />
                  <div>
                    <div className={styles.stageModalRadioTitle}>Tier 1 — Qualified + urgent</div>
                    <div className={styles.stageModalRadioSub}>
                      Budget: Yes · Timeline: ASAP / 0–8 weeks · Site visit in 2–3 days
                    </div>
                  </div>
                </label>
                <label className={styles.stageModalRadio}>
                  <input
                    type="radio"
                    name="siteVisitTier"
                    checked={siteVisitTier === 2}
                    onChange={() => {
                      setSiteVisitTier(2);
                      setSiteVisitTierError(null);
                    }}
                  />
                  <div>
                    <div className={styles.stageModalRadioTitle}>Tier 2 — Qualified + near-term</div>
                    <div className={styles.stageModalRadioSub}>
                      Budget: Yes · Timeline: 2–6 months · Site visit in 2–3 weeks
                    </div>
                  </div>
                </label>
              </div>
              {siteVisitTierError ? <div className={styles.stageModalError}>{siteVisitTierError}</div> : null}
            </div>
          ) : null}
        </PipelineModal>
      ) : null}

      {conflict ? (
        <ConflictModal
          open
          message="This project was updated in another session. Refresh to load the latest version, or overwrite to apply your change anyway."
          details={conflict.details}
          busy={busy === 'conflictOverwrite'}
          onClose={() => setConflict(null)}
          onRefresh={() => {
            setConflict(null);
            void refreshProject();
          }}
          onOverwrite={() => {
            run('conflictOverwrite', async () => {
              await conflict.retry();
              setConflict(null);
              await refreshProject();
            });
          }}
        />
      ) : null}

      {deleteProjectOpen ? (
        <Modal
          open
          ariaLabel="Delete project confirmation"
          onClose={() => {
            setDeleteProjectOpen(false);
            setDeleteProjectText('');
          }}
          overlayClassName={styles.modalOverlay}
          panelClassName={styles.modal}
          maxWidthPx={520}
        >
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Delete project?</h2>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => {
                setDeleteProjectOpen(false);
                setDeleteProjectText('');
              }}
            >
              Close
            </button>
          </div>
          <p className={styles.note}>This deletes the project and all estimates stored under it.</p>
          <div className={styles.field} style={{ marginTop: 10 }}>
            <label htmlFor="delete-confirm">Type DELETE to confirm</label>
            <input
              id="delete-confirm"
              value={deleteProjectText}
              onChange={(e) => setDeleteProjectText(e.target.value)}
              className={styles.inlineInput}
            />
          </div>
          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={() => {
                setDeleteProjectOpen(false);
                setDeleteProjectText('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.buttonDanger}
              disabled={busy === 'deleteProject' || deleteProjectText.trim().toUpperCase() !== 'DELETE'}
              onClick={() => {
                run('deleteProject', () => {
                  setError(null);
                  return (async () => {
                    try {
                      await deleteEstimatesForProject(projectId);
                      await deleteProject(projectId);
                      setDeleteProjectOpen(false);
                      setDeleteProjectText('');
                      toast.success('Project deleted.');
                      router.push('/staff/projects');
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Failed to delete project';
                      setError(msg);
                      toast.error(msg);
                    }
                  })();
                });
              }}
            >
              {busy === 'deleteProject' ? 'Deleting…' : 'Delete project'}
            </button>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
