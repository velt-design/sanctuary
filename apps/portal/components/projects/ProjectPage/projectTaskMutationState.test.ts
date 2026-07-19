import { describe, expect, it } from 'vitest';
import { restoreManualTask, withManualTaskCompletion, type ProjectTaskItem } from './projectTaskMutationState';

const first: ProjectTaskItem = {
  key: 'order_materials',
  label: 'First task',
  kind: 'manual',
  isDone: false,
  isManualDone: false,
};

const second: ProjectTaskItem = {
  key: 'roofing_ordered',
  label: 'Second task',
  kind: 'manual',
  isDone: false,
  isManualDone: false,
};

describe('projectTaskMutationState', () => {
  it('patches only the requested task', () => {
    expect(withManualTaskCompletion([first, second], first.key, true)).toEqual([
      { ...first, isDone: true, isManualDone: true },
      second,
    ]);
  });

  it('restores one rejected task without clobbering a concurrent task change', () => {
    const bothCompleted = withManualTaskCompletion(
      withManualTaskCompletion([first, second], first.key, true),
      second.key,
      true,
    );

    expect(restoreManualTask(bothCompleted, first)).toEqual([
      first,
      { ...second, isDone: true, isManualDone: true },
    ]);
  });
});
