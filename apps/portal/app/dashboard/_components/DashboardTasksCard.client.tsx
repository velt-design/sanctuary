'use client';

import { useRef, useState } from 'react';
import type { DashboardPersonalTask } from '@/lib/dashboard/types';
import { DASHBOARD_TASK_TITLE_MAX_LENGTH } from '@/lib/dashboard/tasks';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import dash from '../dashboard.module.css';
import { Button, Input } from '@/components/ui/foundation/FoundationControls';
import { TaskList, TaskRow } from '@/components/ui/foundation/FoundationOperational';
import { newId } from '@/lib/utils/id';

async function readTaskResponse(res: Response): Promise<DashboardPersonalTask> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body && typeof body.error === 'string' ? body.error : 'Dashboard task request failed.';
    throw new Error(message);
  }
  return body.task as DashboardPersonalTask;
}

export default function DashboardTasksCard({ initialTasks,pending=false,readOnly=false }: { initialTasks: DashboardPersonalTask[]|null;pending?:boolean;readOnly?:boolean }) {
  const [tasks, setTasks] = useState(initialTasks??[]);
  const [sourceTasks, setSourceTasks] = useState(initialTasks);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(() => new Set());
  const submitLockedRef = useRef(false);
  const createTaskIdRef = useRef(newId());
  const pendingTaskIdsRef = useRef(new Set<string>());

  // Adopt a changed source before committing its ready UI. A passive effect would
  // briefly label a genuine nonempty response as empty. Pending mutations retain
  // their current row, and settling one must never reapply an older source prop.
  if (initialTasks !== sourceTasks) {
    setSourceTasks(initialTasks);
    if (initialTasks) {
      setTasks((current) => {
        const currentById = new Map(current.map((task) => [task.id, task]));
        const refreshed = initialTasks.map((task) => pendingTaskIds.has(task.id)
          ? currentById.get(task.id) ?? task
          : task);
        const refreshedIds = new Set(refreshed.map((task) => task.id));
        return [...refreshed, ...current.filter((task) => !refreshedIds.has(task.id))];
      });
    }
  }

  async function createTask() {
    if (submitLockedRef.current||!initialTasks||readOnly) return;
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError('Task title required');
      return;
    }

    submitLockedRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const task = await readTaskResponse(
        await fetch('/api/dashboard/tasks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: nextTitle, taskId: createTaskIdRef.current }),
        }),
      );
      setTasks((current) => [...current, task]);
      setTitle('');
      createTaskIdRef.current = newId();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      submitLockedRef.current = false;
      setSubmitting(false);
    }
  }

  async function toggleTask(task: DashboardPersonalTask, completed: boolean) {
    if (!initialTasks||readOnly||pendingTaskIdsRef.current.has(task.id)) return;
    pendingTaskIdsRef.current.add(task.id);
    const previousTask = task;
    const optimistic: DashboardPersonalTask = {
      ...task,
      completedAt: completed ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    };
    setPendingTaskIds((current) => new Set(current).add(task.id));
    setError(null);
    setTasks((current) => current.map((item) => (item.id === task.id ? optimistic : item)));

    try {
      const updated = await readTaskResponse(
        await fetch(`/api/dashboard/tasks/${encodeURIComponent(task.id)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ completed }),
        }),
      );
      setTasks((current) => current.map((item) => (item.id === task.id ? updated : item)));
    } catch (err) {
      setTasks((current) => current.map((item) => (
        item.id === task.id ? previousTask : item
      )));
      setError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      pendingTaskIdsRef.current.delete(task.id);
      setPendingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

  return (
    <section className={`${styles.section} ${dash.card} ${dash.tasksCard}`} aria-label="My Tasks">
      <div className={`${styles.sectionHeader} ${dash.cardHeader}`}>
        <div>
          <h2 className={styles.sectionTitle}>My Tasks</h2>
          <div className={`${styles.muted} ${dash.cardSubheading}`}>
            Personal reminders.
          </div>
        </div>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody}`}>
        <form
          className={dash.taskComposer}
          onSubmit={(event) => {
            event.preventDefault();
            void createTask();
          }}
        >
          <Input
            fieldClassName={dash.taskInputField}
            className={dash.taskInput}
            aria-label="New dashboard task"
            placeholder="Add a task..."
            value={title}
            maxLength={DASHBOARD_TASK_TITLE_MAX_LENGTH}
            onChange={(event) => {
              setTitle(event.target.value);
              if (error) setError(null);
            }}
            disabled={submitting}
          />
          <Button className={dash.taskAddButton} type="submit" loading={submitting} disabled={!initialTasks||readOnly||!title.trim()}>
            Add
          </Button>
        </form>
        {error ? <div className={dash.taskError}>{error}</div> : null}

        {!initialTasks?<div className={dash.emptyState} role={pending?'status':undefined}>{pending?'Reading personal tasks…':'Personal tasks unavailable.'}</div>:tasks.length ? (
          <TaskList className={dash.taskList} ariaLabel="Personal tasks">
            {tasks.map((task) => {
              const completed = Boolean(task.completedAt);
              return (
                <TaskRow
                  key={task.id}
                  className={dash.taskBubble}
                  checked={completed}
                  disabled={readOnly||pendingTaskIds.has(task.id)}
                  label={task.title}
                  controlAriaLabel={`Complete ${task.title}`}
                  onChange={(checked) => void toggleTask(task, checked)}
                />
              );
            })}
          </TaskList>
        ) : (
          <div className={dash.emptyState}>No personal tasks yet.</div>
        )}
      </div>
    </section>
  );
}
