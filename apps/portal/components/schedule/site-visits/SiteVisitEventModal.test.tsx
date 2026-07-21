import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import SiteVisitEventModal from './SiteVisitEventModal';

const scheduledVisit = {
  id: 'visit-1',
  projectId: 'project-1',
  salespersonId: 'person-1',
  scheduledStart: '2026-07-22T09:00:00.000Z',
  scheduledEnd: '2026-07-22T10:00:00.000Z',
  status: 'CONFIRMED',
  notes: '',
  project: { name: 'Alpha Deck', region: 'North', siteAddress: '1 Example Road' },
  contact: { name: 'Alex Example', phone: '021 000 0000' },
} as any;

describe('SiteVisitEventModal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('requires an in-context confirmation before unscheduling', async () => {
    const onUnschedule = vi.fn().mockResolvedValue(undefined);
    const rendered = renderIntoDocument(
      <SiteVisitEventModal
        open
        mode="edit"
        item={scheduledVisit}
        unscheduled={[]}
        salesPeople={[{ id: 'person-1', name: 'Jordan' }] as any}
        defaultSalespersonId="person-1"
        onClose={vi.fn()}
        onSave={vi.fn()}
        onUnschedule={onUnschedule}
      />,
    );

    const unscheduleButton = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent === 'Unschedule',
    ) as HTMLButtonElement;

    act(() => unscheduleButton.click());

    expect(onUnschedule).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Unschedule this site visit?');
    expect(document.body.textContent).toContain('No project or contact data will be deleted.');

    const confirmButton = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent === 'Confirm unschedule',
    ) as HTMLButtonElement;
    await act(async () => confirmButton.click());

    expect(onUnschedule).toHaveBeenCalledTimes(1);
    rendered.unmount();
  });
});
