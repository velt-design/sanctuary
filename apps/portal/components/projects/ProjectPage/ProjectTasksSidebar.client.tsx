'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import { PIPELINE_STAGE_LABELS, normalizePipelineStageKey, stageKeyToStatus } from '@/lib/projects/pipelineDefinition';
import { STAGE_COMPLETE_MODAL, type StageCompleteAction } from '@/lib/projects/stageCompleteModal';
import { consumeStageCompleteIntent, setStageCompleteIntent } from '@/lib/projects/stageCompleteIntent';
import { PipelineModal } from '@/components/ui/PipelineModal';
import {
  AlertBanner,
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  Input,
  Radio,
  TaskList,
  TaskRow,
  TaskScheduleFeedback,
} from '@/components/ui/foundation';
import { apiJson } from '@/lib/repo/apiClient';
import { invalidateProjectReadCaches } from '@/lib/queries/projectCache';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { patchProjectTasksSnapshot } from '@/lib/localFirst/portalEntities';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { fetchProjectCommandCentre, runProjectActionCommand } from '@/lib/projects/commandCentre/client';
import {
  restoreManualTask,
  withManualTaskCompletion,
  type ProjectTaskItem,
} from './projectTaskMutationState';
import styles from './ProjectTasksSidebar.module.css';

type TaskItem = ProjectTaskItem;

type TaskMutationResponse = {
  ok?: boolean;
  taskKey?: string;
  completed?: boolean;
  stageMoved?: { fromStage: string; toStage: string };
};

type TaskSaveFailure = {
  completed: boolean;
  message: string;
};

const AUTO_ADVANCE_MANUAL_TASKS = new Set(['confirm_schedule', 'invoice_paid']);

const STAGE_MOVED_MESSAGES: Record<string, string> = {
  invoice_paid: 'Deposit received. Project moved to Deposit.',
  confirm_schedule: 'Schedule confirmed. Project moved to Scheduled.',
};

function isCompleted(task: TaskItem): boolean {
  return Boolean(task.isDone);
}

function isOpenTask(task: TaskItem): boolean {
  return !task.isDone && !task.isLocked;
}

export default function ProjectTasksSidebarClient({
  projectId,
  tasks,
}: {
  projectId: string;
  tasks: ProjectPageSnapshot['tasks'];
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const hostKey = supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown';
  const [items, setItems] = useState<TaskItem[]>(tasks.items);
  const itemsRef = useRef<TaskItem[]>(tasks.items);
  const [pendingTaskKeys, setPendingTaskKeys] = useState<Set<string>>(() => new Set());
  const pendingTaskKeysRef = useRef<Set<string>>(new Set());
  const [taskSaveFailures, setTaskSaveFailures] = useState<Record<string, TaskSaveFailure>>({});
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [stageModalError, setStageModalError] = useState<string | null>(null);
  const [stageModalBusy, setStageModalBusy] = useState(false);
  const [stageModalStep, setStageModalStep] = useState<'default' | 'siteVisitTier'>('default');
  const [pendingAction, setPendingAction] = useState<StageCompleteAction | null>(null);
  const [pendingDate, setPendingDate] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [siteVisitTier, setSiteVisitTier] = useState<1 | 2 | null>(null);
  const [siteVisitTierError, setSiteVisitTierError] = useState<string | null>(null);
  const lastOpenCount = useRef<number | null>(null);
  const suppressStageComplete = useRef(false);
  const pendingRefresh = useRef(false);

  useEffect(() => {
    if (pendingTaskKeysRef.current.size > 0) return;
    itemsRef.current = tasks.items;
    setItems(tasks.items);
  }, [tasks.items]);

  const stageKey = normalizePipelineStageKey(tasks.stage) ?? tasks.stage;
  const stageLabel = PIPELINE_STAGE_LABELS[stageKey as keyof typeof PIPELINE_STAGE_LABELS] ?? String(tasks.stage);
  const stageActions = STAGE_COMPLETE_MODAL[stageKey as keyof typeof STAGE_COMPLETE_MODAL] ?? [];
  const hasSiteVisitAction = stageActions.some((action) => 'toStage' in action && action.toStage === 'site_visit');
  const siteVisitAction =
    stageActions.find((action) => 'toStage' in action && action.toStage === 'site_visit') ?? null;
  const canShowStageModal = stageKey !== 'paid';

  useEffect(() => {
    lastOpenCount.current = null;
    setStageModalOpen(false);
    setStageModalStep('default');
    setStageModalError(null);
    setPendingAction(null);
    setPendingDate('');
    setConfirmArchive(false);
    setSiteVisitTier(null);
    setSiteVisitTierError(null);
  }, [projectId, tasks.stage]);

  const openTasks = useMemo(() => items.filter(isOpenTask), [items]);
  const visibleTasks = items;

  useEffect(() => {
    if (!canShowStageModal) return;
    const openCount = openTasks.length;
    const prev = lastOpenCount.current;
    lastOpenCount.current = openCount;

    if (openCount !== 0) {
      if (suppressStageComplete.current) suppressStageComplete.current = false;
      return;
    }

    if (suppressStageComplete.current) {
      suppressStageComplete.current = false;
      consumeStageCompleteIntent(projectId);
      return;
    }

    const intent = consumeStageCompleteIntent(projectId);
    if (intent && intent.stage === stageKey) {
      setStageModalOpen(true);
      setStageModalError(null);
      return;
    }

    if (prev !== null && prev > 0) {
      setStageModalOpen(true);
      setStageModalError(null);
    }
  }, [canShowStageModal, projectId, tasks.stage, openTasks.length]);

  useEffect(() => {
    if (stageModalOpen) return;
    setPendingAction(null);
    setPendingDate('');
    setStageModalError(null);
    setConfirmArchive(false);
    setStageModalStep('default');
    setSiteVisitTier(null);
    setSiteVisitTierError(null);
    if (pendingRefresh.current) {
      pendingRefresh.current = false;
      void invalidateProjectReadCaches(queryClient, hostKey, projectId);
    }
  }, [hostKey, projectId, queryClient, stageModalOpen]);

  useEffect(() => {
    if (!hasSiteVisitAction) {
      setStageModalStep('default');
      setSiteVisitTier(null);
      setSiteVisitTierError(null);
    }
  }, [hasSiteVisitAction]);

  const returnToDefaultStep = () => {
    setStageModalStep('default');
    setStageModalError(null);
    setSiteVisitTierError(null);
  };

  const openSiteVisitStep = () => {
    setStageModalStep('siteVisitTier');
    setStageModalError(null);
    setSiteVisitTierError(null);
  };

  const toggleManualTask = async (taskKey: string, completed: boolean) => {
    if (pendingTaskKeysRef.current.has(taskKey)) return;
    const previousTask = itemsRef.current.find((item) => item.key === taskKey);
    if (!previousTask) return;
    const isAutoAdvanceCompletion = completed && AUTO_ADVANCE_MANUAL_TASKS.has(taskKey);

    if (isAutoAdvanceCompletion) {
      suppressStageComplete.current = true;
    } else {
      setStageCompleteIntent(projectId, stageKey);
    }
    setTaskSaveFailures((current) => {
      if (!current[taskKey]) return current;
      const next = { ...current };
      delete next[taskKey];
      return next;
    });
    const nextItems = withManualTaskCompletion(itemsRef.current, taskKey, completed);
    itemsRef.current = nextItems;
    setItems(nextItems);
    patchProjectTasksSnapshot(queryClient, hostKey, projectId, nextItems);
    const nextOpenCount = nextItems.filter(isOpenTask).length;
    const shouldOpenStageModal = completed && nextOpenCount === 0 && !isAutoAdvanceCompletion && canShowStageModal;

    if (shouldOpenStageModal) {
      setStageModalOpen(true);
      setStageModalError(null);
      setPendingAction(null);
      setPendingDate('');
      setConfirmArchive(false);
    }

    const nextPendingTaskKeys = new Set(pendingTaskKeysRef.current).add(taskKey);
    pendingTaskKeysRef.current = nextPendingTaskKeys;
    setPendingTaskKeys(nextPendingTaskKeys);

    try {
      const response = await apiJson<TaskMutationResponse>(`/api/projects/${encodeURIComponent(projectId)}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          taskKey,
          completed,
        }),
      });
      if (completed && response?.stageMoved && STAGE_MOVED_MESSAGES[taskKey]) {
        toast.success(STAGE_MOVED_MESSAGES[taskKey]);
      }
      void invalidateProjectReadCaches(queryClient, hostKey, projectId, {
        includeProjectDetail: false,
        includeProjectsList: false,
      });
      pendingRefresh.current = false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update task';
      const rolledBackItems = restoreManualTask(itemsRef.current, previousTask);
      itemsRef.current = rolledBackItems;
      setItems(rolledBackItems);
      patchProjectTasksSnapshot(queryClient, hostKey, projectId, rolledBackItems);
      if (shouldOpenStageModal) {
        setStageModalOpen(true);
        setStageModalError(msg);
      } else {
        setStageModalOpen(false);
      }
      setPendingAction(null);
      setPendingDate('');
      pendingRefresh.current = false;
      setTaskSaveFailures((current) => ({
        ...current,
        [taskKey]: { completed, message: msg },
      }));
      void invalidateProjectReadCaches(queryClient, hostKey, projectId, {
        includeProjectDetail: false,
        includeProjectsList: false,
      });
    } finally {
      const remainingPendingTaskKeys = new Set(pendingTaskKeysRef.current);
      remainingPendingTaskKeys.delete(taskKey);
      pendingTaskKeysRef.current = remainingPendingTaskKeys;
      setPendingTaskKeys(remainingPendingTaskKeys);
    }
  };

  const runStageAction = async (action: StageCompleteAction) => {
    if (stageModalBusy) return;
    setStageModalError(null);
    setSiteVisitTierError(null);

    if (action.kind === 'call_later' || action.kind === 'set_reminder') {
      setPendingAction(action);
      setPendingDate('');
      setConfirmArchive(false);
      returnToDefaultStep();
      return;
    }

    if ('toStage' in action && action.toStage === 'site_visit') {
      if (stageModalStep === 'default') {
        openSiteVisitStep();
        return;
      }
      if (!siteVisitTier) {
        setSiteVisitTierError('Select Tier 1 or Tier 2 to proceed to Site Visit.');
        return;
      }
    }

    setStageModalBusy(true);
    try {
      if (action.kind === 'archive') {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/details`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ project: { archivedAt: new Date().toISOString() } }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const msg = typeof body?.error === 'string' ? body.error : 'Failed to archive lead';
          throw new Error(msg);
        }
      } else {
        const payload: Record<string, unknown> = { toStage: stageKeyToStatus(action.toStage) };
        if (action.toStage === 'site_visit') {
          payload.site_visit_priority_tier = siteVisitTier;
        }
        const res = await fetch(`/api/staff/v1/projects/${encodeURIComponent(projectId)}/stage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const msg = typeof body?.error === 'string' ? body.error : 'Failed to update stage';
          throw new Error(msg);
        }
      }

      setStageModalOpen(false);
      pendingRefresh.current = false;
      void invalidateProjectReadCaches(queryClient, hostKey, projectId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update stage';
      setStageModalError(msg);
    } finally {
      setStageModalBusy(false);
    }
  };

  const savePendingAction = async () => {
    if (!pendingAction || stageModalBusy) return;
    const dateValue = pendingDate.trim();
    if (!dateValue) {
      setStageModalError('Select a date to continue.');
      return;
    }

    setStageModalBusy(true);
    setStageModalError(null);

    try {
      const commandCentre = await fetchProjectCommandCentre(projectId);
      await runProjectActionCommand(projectId, {
        command: 'create_manual',
        commandId: crypto.randomUUID(),
        title: pendingAction.kind === 'call_later' ? 'Call customer again' : 'Follow up with customer',
        category: pendingAction.kind === 'call_later' ? 'Call' : 'Follow-up',
        dueDate: dateValue,
        expectedCandidateRevision: commandCentre.operations.candidateRevision,
      });

      const taskKey =
        pendingAction.kind === 'call_later'
          ? stageKey === 'contacted'
            ? 'call_again_later_contacted'
            : stageKey === 'sent'
              ? 'call_again_later_sent'
              : null
          : 'reminder';

      if (!taskKey) throw new Error('Invalid stage for call later.');

      const taskRes = await fetch(`/api/projects/${encodeURIComponent(projectId)}/tasks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ taskKey, completed: false }),
      });

      if (!taskRes.ok) {
        const body = await taskRes.json().catch(() => null);
        const msg = typeof body?.error === 'string' ? body.error : 'Failed to reopen task';
        throw new Error(msg);
      }

      setStageModalOpen(false);
      pendingRefresh.current = false;
      void invalidateProjectReadCaches(queryClient, hostKey, projectId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update reminder';
      setStageModalError(msg);
    } finally {
      setStageModalBusy(false);
    }
  };

  const primaryAction =
    stageActions.find((action) => action.kind === 'advance' || action.kind === 'advance_skip') ??
    stageActions.find((action) => action.kind !== 'archive') ??
    null;
  const secondaryActions = stageActions.filter(
    (action) => action !== primaryAction && action.kind !== 'archive',
  );
  const archiveAction = stageActions.find((action) => action.kind === 'archive') ?? null;
  const hasStageActions = stageActions.length > 0;
  const reminderTitle = pendingAction?.kind === 'call_later' ? 'Call later' : 'Set reminder';
  const reminderDescription = 'Choose a date/time to keep this stage active.';
  const stageDescription = `No open tasks for ${stageLabel}.`;
  const isTierStep = stageModalStep === 'siteVisitTier';
  const taskSyncLabel =
    pendingTaskKeys.size > 0 ? 'Saving task changes…' : null;

  return (
    <>
      <div className={styles.tasks} aria-label="Tasks" data-ui-foundation-consumer="project-tasks">
        <div className={styles.summary}>
          <span>Stage: <strong>{stageLabel}</strong></span>
          <Badge tone={openTasks.length ? 'warning' : 'success'}>{openTasks.length} open</Badge>
        </div>
          {Object.entries(taskSaveFailures).map(([taskKey, failure]) => {
            const taskLabel = items.find((item) => item.key === taskKey)?.label ?? 'task';
            return (
              <div key={taskKey} className={styles.feedbackRow}>
                <TaskScheduleFeedback state="retry">{failure.message}</TaskScheduleFeedback>
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  disabled={pendingTaskKeys.has(taskKey)}
                  aria-label={`Retry ${taskLabel}`}
                  onClick={() => void toggleManualTask(taskKey, failure.completed)}
                >
                  Retry
                </Button>
              </div>
            );
          })}
          {taskSyncLabel ? <TaskScheduleFeedback state="saving">{taskSyncLabel}</TaskScheduleFeedback> : null}

          {visibleTasks.length ? (
            <TaskList>
              {visibleTasks.map((task) => {
                const isManual = task.kind === 'manual';
                const isDone = isCompleted(task);
                const isLocked = Boolean(task.isLocked) && !isDone;
                const isSavingTask = pendingTaskKeys.has(task.key);
                const toggleNext = () => toggleManualTask(task.key, !(task.isManualDone ?? task.isDone));
                return (
                  <TaskRow
                    key={task.key}
                    checked={isDone}
                    showControl={isManual && !isLocked}
                    disabled={!isManual || isLocked || isSavingTask}
                    label={task.label}
                    description={isLocked ? 'Complete the earlier stage requirement first.' : undefined}
                    onChange={isManual && !isLocked && !isSavingTask ? () => toggleNext() : undefined}
                    status={isSavingTask ? (
                        <Badge tone="info">Saving…</Badge>
                      ) : isDone ? (
                        <Badge tone="success">Done</Badge>
                      ) : isLocked ? (
                        <Badge tone="warning">Pending</Badge>
                      ) : isManual ? (
                        <Badge tone="neutral">To do</Badge>
                      ) : task.cta ? (
                        <ButtonLink
                          size="small"
                          href={task.cta.href}
                          onClick={() => setStageCompleteIntent(projectId, stageKey)}
                        >
                          {task.cta.label}
                        </ButtonLink>
                      ) : (
                        <Badge tone="warning">Pending</Badge>
                      )}
                  />
                );
              })}
            </TaskList>
          ) : (
            <EmptyState compact title="No tasks for this stage" description="The next stage action is available when the workflow is ready." />
          )}
      </div>
      {stageModalOpen ? (
        <PipelineModal
          open={stageModalOpen}
          onOpenChange={(open) => {
            if (!open && isTierStep) {
              returnToDefaultStep();
              return;
            }
            setStageModalOpen(open);
          }}
          title={pendingAction ? reminderTitle : 'Stage complete'}
          description={pendingAction ? reminderDescription : stageDescription}
          onBack={isTierStep ? returnToDefaultStep : undefined}
          actions={
            pendingAction && (pendingAction.kind === 'call_later' || pendingAction.kind === 'set_reminder') ? (
              <>
                <Button
                  type="button"
                  fullWidth
                  loading={stageModalBusy}
                  onClick={savePendingAction}
                  disabled={!pendingDate || stageModalBusy}
                >
                  Save reminder
                </Button>
                <Button
                  type="button"
                  variant="tertiary"
                  fullWidth
                  onClick={() => setPendingAction(null)}
                  disabled={stageModalBusy}
                >
                  Cancel
                </Button>
              </>
            ) : hasStageActions ? (
              isTierStep ? (
                <Button
                  type="button"
                  fullWidth
                  onClick={() => {
                    if (!siteVisitAction) return;
                    runStageAction(siteVisitAction);
                  }}
                  disabled={!siteVisitTier || stageModalBusy || !siteVisitAction}
                >
                  Confirm
                </Button>
              ) : (
                <>
                  {primaryAction ? (
                    <Button
                      type="button"
                      fullWidth
                      loading={stageModalBusy}
                      onClick={() => runStageAction(primaryAction)}
                      disabled={stageModalBusy}
                    >
                      {primaryAction.label}
                    </Button>
                  ) : null}
                  {secondaryActions.map((action) => {
                    const key =
                      'toStage' in action ? `${action.kind}:${action.toStage}` : `${action.kind}:${action.label}`;
                    return (
                      <Button
                        key={key}
                        type="button"
                        variant="secondary"
                        fullWidth
                        onClick={() => runStageAction(action)}
                        disabled={stageModalBusy}
                      >
                        {action.label}
                      </Button>
                    );
                  })}
                  {archiveAction ? (
                    confirmArchive ? (
                      <div className={styles.archiveConfirmation}>
                        <AlertBanner tone="blocking" title="Archive this lead?">
                          This will move it out of active projects.
                        </AlertBanner>
                        <div className={styles.modalActions}>
                          <Button
                            type="button"
                            variant="tertiary"
                            fullWidth
                            onClick={() => setConfirmArchive(false)}
                            disabled={stageModalBusy}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            fullWidth
                            onClick={() => runStageAction(archiveAction)}
                            disabled={stageModalBusy}
                          >
                            Archive
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="destructive"
                        fullWidth
                        onClick={() => setConfirmArchive(true)}
                        disabled={stageModalBusy}
                      >
                        {archiveAction.label}
                      </Button>
                    )
                  ) : null}
                </>
              )
            ) : (
              <Button
                type="button"
                variant="tertiary"
                fullWidth
                onClick={() => setStageModalOpen(false)}
                disabled={stageModalBusy}
              >
                Close
              </Button>
            )
          }
        >
          <div className={styles.modalContent}>
            {stageModalError ? (
              <AlertBanner tone="error" title="Stage action not saved">
                {stageModalError}
              </AlertBanner>
            ) : null}
            {hasSiteVisitAction && isTierStep ? (
              <fieldset className={styles.tierFieldset}>
                <legend>Site visit priority (required)</legend>
                <p className={styles.tierHelper}>Budget and timeline only.</p>
                <Radio
                    name="siteVisitTier"
                    checked={siteVisitTier === 1}
                    label="Tier 1 — Qualified + urgent"
                    description="Budget: Yes · Timeline: ASAP / 0–8 weeks · Site visit in 2–3 days"
                    onChange={() => {
                      setSiteVisitTier(1);
                      setSiteVisitTierError(null);
                    }}
                  />
                <Radio
                    name="siteVisitTier"
                    checked={siteVisitTier === 2}
                    label="Tier 2 — Qualified + near-term"
                    description="Budget: Yes · Timeline: 2–6 months · Site visit in 2–3 weeks"
                    onChange={() => {
                      setSiteVisitTier(2);
                      setSiteVisitTierError(null);
                    }}
                  />
                {siteVisitTierError ? (
                  <AlertBanner tone="error" title="Select a priority">
                    {siteVisitTierError}
                  </AlertBanner>
                ) : null}
              </fieldset>
            ) : null}
            {pendingAction && (pendingAction.kind === 'call_later' || pendingAction.kind === 'set_reminder') ? (
              <Input
                type="date"
                label={pendingAction.kind === 'call_later' ? 'Call later date' : 'Reminder date'}
                value={pendingDate}
                onChange={(event) => setPendingDate(event.target.value)}
              />
            ) : null}
          </div>
        </PipelineModal>
      ) : null}
    </>
  );
}
