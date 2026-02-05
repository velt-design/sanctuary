'use client';

import { useMemo, useState } from 'react';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import legacy from '@/app/staff/projects/projects.module.css';

function isCompleted(task: ProjectPageSnapshot['tasks'][number]): boolean {
  if (typeof (task as any).completed === 'boolean') return Boolean((task as any).completed);
  if ((task as any).completed_at) return true;
  const statusRaw = String((task as any).status ?? '').toLowerCase();
  return statusRaw === 'done' || statusRaw === 'completed';
}

function formatDue(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString();
}

export default function ProjectTasksSidebarClient({ tasks }: { tasks: ProjectPageSnapshot['tasks'] }) {
  const [view, setView] = useState<'todo' | 'completed'>('todo');

  const { todoTasks, completedTasks } = useMemo(() => {
    const todo = tasks.filter((t) => !isCompleted(t));
    const completed = tasks.filter((t) => isCompleted(t));
    return { todoTasks: todo, completedTasks: completed };
  }, [tasks]);

  const visibleTasks = view === 'completed' ? completedTasks : todoTasks;

  return (
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
        {visibleTasks.length ? (
          <div className={legacy.tableWrap}>
            <table className={legacy.table}>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map((task) => (
                  <tr key={task.id}>
                    <td>{task.title || 'Task'}</td>
                    <td>{isCompleted(task) ? 'Done' : 'To do'}</td>
                    <td className={legacy.muted}>{formatDue(task.dueAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={legacy.note}>{view === 'completed' ? 'No completed tasks.' : 'No open tasks.'}</p>
        )}
      </div>
    </section>
  );
}
