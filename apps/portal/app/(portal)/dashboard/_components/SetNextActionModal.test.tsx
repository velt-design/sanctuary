import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SetNextActionModal from './SetNextActionModal';
import { renderIntoDocument } from '../../../../../../test/reactHarness';

const invalidateQueries = vi.fn();
const setNextActionMock = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries,
  }),
}));

vi.mock('../actions', () => ({
  setNextAction: (...args: unknown[]) => setNextActionMock(...args),
}));

describe('SetNextActionModal', () => {
  beforeEach(() => {
    invalidateQueries.mockReset();
    setNextActionMock.mockReset();
    setNextActionMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('invalidates dashboard and project reads after saving', async () => {
    const onOpenChange = vi.fn();
    const rendered = renderIntoDocument(
      <SetNextActionModal
        open
        onOpenChange={onOpenChange}
        projectId="proj_123"
        initial={{ actionLabel: 'call', dueDate: '2026-04-05' }}
      />,
    );

    const saveButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('Save')) as HTMLButtonElement;

    await act(async () => {
      saveButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(setNextActionMock).toHaveBeenCalledWith({
      projectId: 'proj_123',
      actionLabel: 'call',
      dueDate: '2026-04-05',
      note: undefined,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['dashboard', 'data'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projects'] });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rendered.unmount();
  });
});
