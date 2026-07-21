'use client';

import { useState } from 'react';
import type { DashboardPersonalTask } from '@/lib/dashboard/types';
import { DASHBOARD_TASK_TITLE_MAX_LENGTH } from '@/lib/dashboard/tasks';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import dash from '../dashboard.module.css';
import { Button, Input } from '@/components/ui/foundation/FoundationControls';
import { TaskList, TaskRow } from '@/components/ui/foundation/FoundationOperational';

async function readTaskResponse(res: Response): Promise<DashboardPersonalTask> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body && typeof body.error === 'string' ? body.error : 'Dashboard task request failed.';
    throw new Error(message);
  }
  return body.task as DashboardPersonalTask;
}

export default function DashboardTasksCard({ initialTasks }: { initialTasks: DashboardPersonalTask[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  async function createTask() {
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError('Task title required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const task = await readTaskResponse(
        await fetch('/api/dashboard/tasks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: nextTitle }),
        }),
      );
      setTasks((current) => [...current, task]);
      setTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleTask(task: DashboardPersonalTask, completed: boolean) {
    const previous = tasks;
    const optimistic: DashboardPersonalTask = {
      ...task,
      completedAt: completed ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    };
    setPendingTaskId(task.id);
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
      setTasks(previous);
      setError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setPendingTaskId(null);
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
          <Button className={dash.taskAddButton} type="submit" loading={submitting} disabled={!title.trim()}>
            Add
          </Button>
        </form>
        {error ? <div className={dash.taskError}>{error}</div> : null}

        {tasks.length ? (
          <TaskList className={dash.taskList} ariaLabel="Personal tasks">
            {tasks.map((task) => {
              const completed = Boolean(task.completedAt);
              return (
                <TaskRow
                  key={task.id}
                  className={dash.taskBubble}
                  checked={completed}
                  disabled={pendingTaskId === task.id}
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
