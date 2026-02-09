'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import { PIPELINE_STAGE_LABELS, normalizePipelineStageKey, stageKeyToStatus } from '@/lib/projects/pipelineDefinition';
import { STAGE_COMPLETE_MODAL, type StageCompleteAction } from '@/lib/projects/stageCompleteModal';
import { consumeStageCompleteIntent, setStageCompleteIntent } from '@/lib/projects/stageCompleteIntent';
import { PIPELINE_MODAL_ACTION_CLASSES, PipelineModal } from '@/components/ui/PipelineModal';
import legacy from '@/app/staff/projects/projects.module.css';

type TaskItem = ProjectPageSnapshot['tasks']['items'][number];

function isCompleted(task: TaskItem): boolean {
  return Boolean(task.isDone);
}

export default function ProjectTasksSidebarClient({
  projectId,
  tasks,
}: {
  projectId: string;
  tasks: ProjectPageSnapshot['tasks'];
}) {
  const router = useRouter();
  const [view, setView] = useState<'todo' | 'completed'>('todo');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [items, setItems] = useState<TaskItem[]>(tasks.items);
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [stageModalError, setStageModalError] = useState<string | null>(null);
  const [stageModalBusy, setStageModalBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<StageCompleteAction | null>(null);
  const [pendingDate, setPendingDate] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const lastOpenCount = useRef<number | null>(null);
  const suppressStageComplete = useRef(false);
  const pendingRefresh = useRef(false);

  useEffect(() => {
    setItems(tasks.items);
  }, [tasks.items]);

  const stageKey = normalizePipelineStageKey(tasks.stage) ?? tasks.stage;
  const stageLabel = PIPELINE_STAGE_LABELS[stageKey as keyof typeof PIPELINE_STAGE_LABELS] ?? String(tasks.stage);
  const stageActions = STAGE_COMPLETE_MODAL[stageKey as keyof typeof STAGE_COMPLETE_MODAL] ?? [];
  const canShowStageModal = stageKey !== 'paid';

  useEffect(() => {
    lastOpenCount.current = null;
    setStageModalOpen(false);
    setStageModalError(null);
    setPendingAction(null);
    setPendingDate('');
    setConfirmArchive(false);
  }, [projectId, tasks.stage]);

  const { todoTasks, completedTasks } = useMemo(() => {
    const todo = items.filter((t) => !isCompleted(t));
    const completed = items.filter((t) => isCompleted(t));
    return { todoTasks: todo, completedTasks: completed };
  }, [items]);

  const visibleTasks = view === 'completed' ? completedTasks : todoTasks;

  useEffect(() => {
    if (!canShowStageModal) return;
    const openCount = todoTasks.length;
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
  }, [canShowStageModal, projectId, tasks.stage, todoTasks.length]);

  useEffect(() => {
    if (stageModalOpen) return;
    setPendingAction(null);
    setPendingDate('');
    setStageModalError(null);
    setConfirmArchive(false);
    if (pendingRefresh.current) {
      pendingRefresh.current = false;
      router.refresh();
    }
  }, [stageModalOpen]);

  const toggleManualTask = async (taskKey: string, completed: boolean) => {
    if (isSaving) return;
    if (taskKey === 'confirm_schedule' && completed) {
      suppressStageComplete.current = true;
    } else {
      setStageCompleteIntent(projectId, stageKey);
    }
    setIsSaving(true);
    setError(null);
    const previous = items;
    const nextItems = items.map((item) =>
      item.key === taskKey ? { ...item, isDone: completed, isManualDone: completed } : item,
    );
    setItems(nextItems);
    const nextOpenCount = nextItems.filter((item) => !isCompleted(item)).length;
    const shouldDeferRefresh = completed && nextOpenCount === 0 && taskKey !== 'confirm_schedule';
    const shouldOpenStageModal = completed && nextOpenCount === 0 && taskKey !== 'confirm_schedule' && canShowStageModal;

    if (shouldOpenStageModal) {
      setStageModalOpen(true);
      setStageModalError(null);
      setPendingAction(null);
      setPendingDate('');
      setConfirmArchive(false);
    }

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/tasks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ taskKey, completed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = typeof body?.error === 'string' ? body.error : 'Failed to update task';
        throw new Error(msg);
      }

      if (shouldDeferRefresh) {
        pendingRefresh.current = true;
      } else {
        pendingRefresh.current = false;
        router.refresh();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update task';
      setItems(previous);
      if (shouldOpenStageModal) {
        setStageModalOpen(true);
        setStageModalError(msg);
      } else {
        setStageModalOpen(false);
      }
      setPendingAction(null);
      setPendingDate('');
      pendingRefresh.current = false;
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const runStageAction = async (action: StageCompleteAction) => {
    if (stageModalBusy) return;
    setStageModalError(null);

    if (action.kind === 'call_later' || action.kind === 'set_reminder') {
      setPendingAction(action);
      setPendingDate('');
      setConfirmArchive(false);
      return;
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
        const res = await fetch(`/api/staff/v1/projects/${encodeURIComponent(projectId)}/stage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ toStage: stageKeyToStatus(action.toStage) }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const msg = typeof body?.error === 'string' ? body.error : 'Failed to update stage';
          throw new Error(msg);
        }
      }

      setStageModalOpen(false);
      pendingRefresh.current = false;
      router.refresh();
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
      const detailsRes = await fetch(`/api/projects/${encodeURIComponent(projectId)}/details`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project: { nextActionDate: dateValue } }),
      });
      if (!detailsRes.ok) {
        const body = await detailsRes.json().catch(() => null);
        const msg = typeof body?.error === 'string' ? body.error : 'Failed to set reminder date';
        throw new Error(msg);
      }

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
      router.refresh();
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

  return (
    <>
      <section className={legacy.section} aria-label="Tasks">
        <div className={legacy.sectionHeader}>
          <h2 className={legacy.sectionTitle}>Tasks</h2>
          <div className={legacy.tabsPill} role="tablist" aria-label="Task status">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'todo'}
              className={`${legacy.tabButton} ${view === 'todo' ? legacy.tabButtonActive : ''}`}
              onClick={() => setView('todo')}
            >
              To do ({todoTasks.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'completed'}
              className={`${legacy.tabButton} ${view === 'completed' ? legacy.tabButtonActive : ''}`}
              onClick={() => setView('completed')}
            >
              Completed ({completedTasks.length})
            </button>
          </div>
        </div>
        <div className={legacy.sectionBody}>
          <p className={legacy.muted}>Stage: {stageLabel}</p>
          {error ? <p className={legacy.error}>{error}</p> : null}

          {visibleTasks.length ? (
            <div className={legacy.taskList}>
              {visibleTasks.map((task) => {
                const isManual = task.kind === 'manual';
                const isDone = isCompleted(task);
                const toggleNext = () => toggleManualTask(task.key, !Boolean(task.isManualDone ?? task.isDone));
                const handleRowClick = (event: MouseEvent<HTMLDivElement>) => {
                  const target = event.target as HTMLElement | null;
                  if (target?.closest('input,button,a')) return;
                  toggleNext();
                };
                return (
                  <div
                    key={task.key}
                    className={legacy.taskRow}
                    role={isManual ? 'button' : undefined}
                    tabIndex={isManual ? 0 : undefined}
                    onClick={isManual ? handleRowClick : undefined}
                    onKeyDown={
                      isManual
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              toggleNext();
                            }
                          }
                        : undefined
                    }
                  >
                    {isManual ? (
                      <label className={`${legacy.checkboxRow} ${legacy.taskLabel}`}>
                        <input
                          type="checkbox"
                          checked={Boolean(task.isManualDone ?? task.isDone)}
                          disabled={isSaving}
                          onChange={(event) => {
                            event.stopPropagation();
                            toggleNext();
                          }}
                          onClick={(event) => event.stopPropagation()}
                        />
                        <span className={legacy.checkboxText}>{task.label}</span>
                      </label>
                    ) : (
                      <span className={legacy.taskLabel}>{task.label}</span>
                    )}

                    <div className={legacy.rowActions}>
                      {isManual ? (
                        <span className={`${legacy.statusPill} ${isDone ? legacy.statusPillPaid : legacy.statusPillDraft}`}>
                          {isDone ? 'Done' : 'To do'}
                        </span>
                      ) : isDone ? (
                        <span className={`${legacy.statusPill} ${legacy.statusPillPaid}`}>Done</span>
                      ) : task.cta ? (
                        <Link
                          className={legacy.button}
                          href={task.cta.href}
                          onClick={() => setStageCompleteIntent(projectId, stageKey)}
                        >
                          {task.cta.label}
                        </Link>
                      ) : (
                        <span className={`${legacy.statusPill} ${legacy.statusPillDraft}`}>Pending</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={legacy.note}>
              {view === 'completed' ? 'No completed tasks.' : 'No open tasks for this stage.'}
            </p>
          )}
        </div>
      </section>
      {stageModalOpen ? (
        <PipelineModal
          open={stageModalOpen}
          onOpenChange={setStageModalOpen}
          title={pendingAction ? reminderTitle : 'Stage complete'}
          description={pendingAction ? reminderDescription : stageDescription}
          actions={
            pendingAction && (pendingAction.kind === 'call_later' || pendingAction.kind === 'set_reminder') ? (
              <>
                <button
                  type="button"
                  className={PIPELINE_MODAL_ACTION_CLASSES.primary}
                  onClick={savePendingAction}
                  disabled={!pendingDate || stageModalBusy}
                >
                  {stageModalBusy ? 'Saving…' : 'Save reminder'}
                </button>
                <button
                  type="button"
                  className={PIPELINE_MODAL_ACTION_CLASSES.secondary}
                  onClick={() => setPendingAction(null)}
                  disabled={stageModalBusy}
                >
                  Cancel
                </button>
              </>
            ) : hasStageActions ? (
              <>
                {primaryAction ? (
                  <button
                    type="button"
                    className={PIPELINE_MODAL_ACTION_CLASSES.primary}
                    onClick={() => runStageAction(primaryAction)}
                    disabled={stageModalBusy}
                  >
                    {primaryAction.label}
                  </button>
                ) : null}
                {secondaryActions.map((action) => {
                  const key = 'toStage' in action ? `${action.kind}:${action.toStage}` : `${action.kind}:${action.label}`;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={PIPELINE_MODAL_ACTION_CLASSES.secondary}
                      onClick={() => runStageAction(action)}
                      disabled={stageModalBusy}
                    >
                      {action.label}
                    </button>
                  );
                })}
                {archiveAction ? (
                  confirmArchive ? (
                    <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                      <div className="text-sm font-medium text-neutral-900">Archive this lead?</div>
                      <div className="mt-1 text-sm text-neutral-600">
                        This will move it out of active projects.
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="h-10 flex-1 rounded-lg border border-neutral-200 bg-white text-sm font-medium hover:bg-neutral-100"
                          onClick={() => setConfirmArchive(false)}
                          disabled={stageModalBusy}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="h-10 flex-1 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700"
                          onClick={() => runStageAction(archiveAction)}
                          disabled={stageModalBusy}
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={PIPELINE_MODAL_ACTION_CLASSES.danger}
                      onClick={() => setConfirmArchive(true)}
                      disabled={stageModalBusy}
                    >
                      {archiveAction.label}
                    </button>
                  )
                ) : null}
              </>
            ) : (
              <button
                type="button"
                className={PIPELINE_MODAL_ACTION_CLASSES.secondary}
                onClick={() => setStageModalOpen(false)}
                disabled={stageModalBusy}
              >
                Close
              </button>
            )
          }
        >
          {stageModalError ? <p className="text-sm text-red-600">{stageModalError}</p> : null}
          {pendingAction && (pendingAction.kind === 'call_later' || pendingAction.kind === 'set_reminder') ? (
            <label className="mt-4 block text-sm font-medium text-neutral-900">
              <span className="block text-xs uppercase tracking-[0.08em] text-neutral-500">
                {pendingAction.kind === 'call_later' ? 'Call later date' : 'Reminder date'}
              </span>
              <input
                className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300"
                type="date"
                value={pendingDate}
                onChange={(event) => setPendingDate(event.target.value)}
              />
            </label>
          ) : null}
        </PipelineModal>
      ) : null}
    </>
  );
}
