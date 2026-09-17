import { afterEach, describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import { correspondenceFixture } from '@/app/qa/project-command-centre-fixture/correspondenceFixture';
import ProjectCorrespondenceCard from './ProjectCorrespondenceCard';
import { correspondenceSourceHref } from './projectCorrespondencePresentation';

afterEach(() => { document.body.innerHTML = ''; });
describe('ProjectCorrespondenceCard', () => {
  it.each([
    'Outlook returned more data than this check permits.',
    'The hourly mailbox check limit has been reached. Try again later.',
    'The Outlook connection is not ready for a message check.',
    'Mailbox checks are paused by the connection controls.',
  ])('shows only a recognized mailbox failure explanation: %s', reason => {
    const context = { ...correspondenceFixture, messages: [], limitations: ['Outlook correspondence is unavailable or has not been checked.', 'private arbitrary detail', reason] };
    const view = renderIntoDocument(<ProjectCorrespondenceCard context={context} state="ready" />);
    expect(view.container.textContent).toContain(reason);
    expect(view.container.textContent).not.toContain('private arbitrary detail');
    view.unmount();
  });
  it('shows an unconfirmed customer reply beside a linked send without claiming it belongs to the project', () => {
    const base = { subject: 'Email', sentAt: correspondenceFixture.observedAt, receivedAt: correspondenceFixture.observedAt,
      observedAt: correspondenceFixture.observedAt, url: 'https://outlook.office.com/mail/id/one', bodyText: 'Please review.',
      truncated: false, association: 'customer_address_only' as const };
    const context = { ...correspondenceFixture, messages: [
      { ...base, id: 'sent', from: 'staff@example.test', projectLink: { state: 'linked' as const, basis: 'sent_message' as const } },
      { ...base, id: 'reply', from: 'customer@example.test', projectLink: { state: 'unconfirmed' as const } },
    ] };
    const view = renderIntoDocument(<ProjectCorrespondenceCard context={context} state="ready" project={{ customerEmail: 'customer@example.test' }} />);
    const customer = [...view.container.querySelectorAll('article')].find(article => article.textContent?.includes('From customer@example.test'))!;
    expect(customer.closest('details')?.open).toBe(true);
    expect(customer.textContent).toContain('Latest customer email — project match unconfirmed');
    expect(customer.closest('details')?.textContent).toContain('Matched by customer address; these may concern another job.');
    expect(view.container.textContent).not.toContain('Matched to the customer, not yet confirmed to this job.');
    view.unmount();
  });
  it('distinguishes an unavailable mailbox read from a successful empty result', () => {
    const context = { ...correspondenceFixture, messages: [], analysisAvailable: false };
    const failed = renderIntoDocument(<ProjectCorrespondenceCard context={{ ...context, limitations: ['Outlook correspondence is unavailable or has not been checked.'] }} state="ready" onRefresh={() => undefined} onAnalyze={() => undefined} />);
    expect(failed.container.textContent).toContain('Conversations unavailable');
    expect(failed.container.textContent).not.toContain('No customer messages were returned');
    expect(failed.container.textContent).not.toContain('Ask AI');
    failed.unmount();
    const empty = renderIntoDocument(<ProjectCorrespondenceCard context={{ ...context, limitations: [] }} state="ready" />);
    expect(empty.container.textContent).toContain('No customer messages were returned');
    expect(empty.container.textContent).not.toContain('Conversations unavailable');
    empty.unmount();
  });
  it('shows source messages even when AI does not cite them, with sender and expandable plain text', () => {
    const bodyText = 'Customer message, not AI text. '.repeat(40) + '<script>not executable</script>';
    const context = { ...correspondenceFixture, messages: [{ id: 'mail-one', subject: 'Actual message subject',
      from: 'customer@example.test', sentAt: correspondenceFixture.observedAt, receivedAt: correspondenceFixture.observedAt,
      observedAt: correspondenceFixture.observedAt, url: 'https://outlook.office.com/mail/id/one', bodyText,
      truncated: false, association: 'customer_address_only' as const }] };
    const view = renderIntoDocument(<ProjectCorrespondenceCard context={context} state="ready" />);
    const article = view.container.querySelector('article')!;
    expect(article.textContent).toContain('From customer@example.test');
    expect(article.querySelector('blockquote')?.closest('details')?.open).toBe(true);
    expect(article.closest('details')?.textContent).toContain('project match unconfirmed');
    expect(article.querySelector(':scope > details blockquote')?.textContent).toBe(bodyText);
    expect(article.querySelector('script')).toBeNull();
    expect(article.querySelector('summary')?.textContent).toBe('Read message');
    view.unmount();
  });
  it('shows each email excerpt without opening AI analysis and makes samples explicit', () => {
    const view = renderIntoDocument(<ProjectCorrespondenceCard context={correspondenceFixture} state="ready" sample />);
    const messages = view.container.querySelectorAll('article blockquote');
    expect(messages).toHaveLength(1);
    expect(messages[0].closest('details')).toBeNull();
    expect(view.container.textContent).toContain('Your real Outlook emails are not connected');
    expect(view.container.querySelector('a')).toBeNull();
    view.unmount();
  });
  it('keeps suggestions distinct from confirmed project work and reveals cited evidence', () => {
    const view = renderIntoDocument(<ProjectCorrespondenceCard context={correspondenceFixture} state="ready" />);
    expect(view.container.textContent).toContain('AI interpretation');
    expect(view.container.textContent).toContain('Suggestion');
    expect(view.container.textContent).toContain('project not confirmed');
    expect(view.container.textContent).toContain('Project Work controls above');
    expect(view.container.querySelector('blockquote')?.textContent).toContain('Please confirm the expected installation week');
    expect(view.container.querySelectorAll('button')).toHaveLength(0);
    view.unmount();
  });

  it('does not display an unsupported claim or an unsafe source link', () => {
    const context = { ...correspondenceFixture, sources: [{ ...correspondenceFixture.sources[0], url: 'javascript:alert(1)' }] };
    const view = renderIntoDocument(<ProjectCorrespondenceCard context={context} state="ready" />);
    expect(view.container.textContent).not.toContain('The customer is asking');
    expect(view.container.textContent).toContain('supporting source is unavailable');
    expect(view.container.querySelector('a')).toBeNull();
    view.unmount();
  });

  it('hides an old summary when the read is unavailable', () => {
    const view = renderIntoDocument(<ProjectCorrespondenceCard context={correspondenceFixture} state="error" />);
    expect(view.container.textContent).toContain('Conversations unavailable');
    expect(view.container.textContent).not.toContain('The customer is asking');
    view.unmount();
  });

  it.each(['https://outlook.office.com.evil.test/mail', 'https://user:secret@outlook.office.com/mail', 'http://outlook.office.com/mail', 'https://portal.sanctuarypergolas.co.nz/api/admin/reset'])('rejects an unsafe source %s', (url) => {
    expect(correspondenceSourceHref(url)).toBeNull();
  });
});
