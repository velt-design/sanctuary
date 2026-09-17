import { describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import ProjectEmailMessages from './ProjectEmailMessages';
import type { EmailMessage } from './projectEmailGroups';

describe('refreshed email text', () => {
  it('keeps quoted history in the full message without putting its headers in the teaser', () => {
    const bodyText = 'Thanks, could you confirm the installation week?\n\nFrom: Earlier sender\nSubject: Previous quote\nEarlier quoted text';
    const message: EmailMessage = { id: 'thread', subject: 'Re: Installation', from: 'customer@example.test',
      sentAt: '2026-09-16T01:00:00Z', receivedAt: '2026-09-16T01:00:00Z', observedAt: '2026-09-16T01:00:00Z',
      url: 'https://outlook.office.com/mail/id/thread', bodyText, truncated: false, association: 'customer_address_only' };
    const view = renderIntoDocument(<ProjectEmailMessages messages={[message]} sample expanded={new Set()} onExpand={() => undefined} earlierOpen={false} onEarlierOpen={() => undefined} />);
    const quotes = view.container.querySelectorAll('blockquote');
    expect(quotes[0].textContent).toBe('Thanks, could you confirm the installation week?');
    expect(quotes[1].textContent).toBe('Thanks, could you confirm the installation week?\n\n');
    expect(quotes[2].textContent).toBe('Earlier quoted text');
    expect(view.container.textContent).toContain('From: Earlier sender\nSubject: Previous quote');
    expect(view.container.textContent).toContain('Includes earlier conversation');
    view.unmount();
  });
  it('shows a newly shortened excerpt even if its full-message disclosure was open', () => {
    const message: EmailMessage = { id: 'one', subject: 'Project question', from: 'customer@example.test',
      sentAt: '2026-09-16T01:00:00Z', receivedAt: '2026-09-16T01:00:00Z', observedAt: '2026-09-16T01:00:00Z',
      url: 'https://outlook.office.com/mail/id/one', bodyText: 'A longer project question. '.repeat(20), truncated: false, association: 'customer_address_only' };
    const props = { sample: true, expanded: new Set(['one']), onExpand: () => undefined, earlierOpen: false, onEarlierOpen: () => undefined };
    const view = renderIntoDocument(<ProjectEmailMessages {...props} messages={[message]} />);
    expect((view.container.querySelector('details') as HTMLDetailsElement).open).toBe(true);
    view.rerender(<ProjectEmailMessages {...props} messages={[{ ...message, bodyText: 'A shorter available excerpt.', truncated: true }]} />);
    expect(view.container.querySelector('blockquote')?.textContent).toBe('A shorter available excerpt.');
    expect(view.container.textContent).toContain('Part of this message was omitted');
    view.unmount();
  });
});
