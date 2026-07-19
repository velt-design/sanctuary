import type { ProjectPageSnapshot } from '@/lib/projects/types';

export type ProjectTaskItem = ProjectPageSnapshot['tasks']['items'][number];

export function withManualTaskCompletion(
  items: ProjectTaskItem[],
  taskKey: string,
  completed: boolean,
): ProjectTaskItem[] {
  return items.map((item) =>
    item.key === taskKey
      ? { ...item, isDone: completed, isManualDone: completed }
      : item,
  );
}

export function restoreManualTask(
  items: ProjectTaskItem[],
  previousTask: ProjectTaskItem,
): ProjectTaskItem[] {
  return items.map((item) => item.key === previousTask.key ? previousTask : item);
}
