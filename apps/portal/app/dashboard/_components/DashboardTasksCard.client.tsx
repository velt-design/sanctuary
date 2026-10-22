'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { DashboardPersonalTask } from '@/lib/dashboard/types';





import { newId } from '@/lib/utils/id';
import DashboardTaskRows from './DashboardTaskRows';
import DashboardTasksSurface from './DashboardTasksSurface';
import { useDashboardWorkspace } from '../DashboardWorkspace';

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
  const workspace = useDashboardWorkspace();
  const [localTitle, setLocalTitle] = useState('');
  const title=workspace?.title??localTitle;
  const setTitle=workspace?.setTitle??setLocalTitle;
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
    if (submitLockedRef.current||!initialTasks||readOnly||(workspace&&!workspace.isCurrent())) return;
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
    if (!initialTasks||readOnly||pendingTaskIdsRef.current.has(task.id)||(workspace&&!workspace.isCurrent())) return;
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

  const surface = {rows:<DashboardTaskRows tasks={tasks} readOnly={readOnly} pendingTaskIds={pendingTaskIds} toggleTask={toggleTask}/>,title,setTitle,initialTasks,tasks,pending,readOnly,error,setError,submitting,pendingTaskIds,createTask,toggleTask};
  useLayoutEffect(()=>{workspace?.publishTasks(surface);});
  useLayoutEffect(()=>()=>workspace?.publishTasks(null),[workspace?.publishTasks]);
  return workspace?null:<DashboardTasksSurface {...surface}/>;
}
