import { commandCentreFixtures, commandCentreWorkFixtures } from './fixtures';
import { correspondenceFixture } from './correspondenceFixture';
import type { ProjectWorkItem } from '@/lib/projects/workItems/types';

export const storyNames = { enquiry: 'New enquiry', quote: 'Awaiting quote decision', installation: 'Accepted job', 'accepted-review': 'Accepted quote history' };
export type ProjectStory = keyof typeof storyNames;

/** Deliberately coherent synthetic jobs. No independent mixing of stage and quote. */
export function projectStory(name: ProjectStory) {
  const work = structuredClone(commandCentreWorkFixtures['v2-primary']);
  const correspondence = structuredClone(correspondenceFixture);
  const currentDesign = structuredClone(commandCentreFixtures[
    name === 'enquiry' ? 'no-current-design' : name === 'quote' ? 'sent-revision' : 'accepted-newer-estimate'
  ]);
  const item: ProjectWorkItem = { ...work.projectWork.openItems[0],
    dueAt: '2026-09-17T05:00:00Z', createdAt: '2026-09-16T01:00:00Z', updatedAt: '2026-09-16T01:00:00Z',
  };
  work.project = { name: `Aroha Smith · ${storyNames[name]}`, contactName: 'Aroha Smith', owner: { key: 'jordan', displayName: 'Jordan' } };
  work.stage = name === 'enquiry' ? 'new' : name === 'quote' ? 'sent' : 'deposit';
  let reason: string;
  let excerpt: string;
  let position: string;
  let suggestion: string;
  if (name === 'enquiry') {
    item.title = 'Reply to Aroha about her pergola enquiry';
    reason = 'Aroha has asked whether her deck can be covered. No personal response is recorded.';
    excerpt = 'Can you help us cover our deck? Please let me know what measurements you need.';
    position = 'The customer wants advice on covering the deck.';
    suggestion = 'Reply with the information needed to assess the site.';
    correspondence.answer.sections[0].caveat = 'No quote or agreed design exists in this example.';
  } else if (name === 'quote') {
    item.title = 'Follow up on Aroha’s quote decision';
    item.sourceType = 'QUOTE_CADENCE';
    item.sourceKey = 'quote:follow-up:qv_fixture_2:v1';
    item.seriesKey = 'quote:qv_fixture_2:v1';
    item.subjectKind = 'QUOTE_VERSION';
    item.subjectId = currentDesign.quote!.id;
    reason = 'The quote has been sent. Aroha’s last message said she would review it; acceptance is not recorded.';
    excerpt = 'Thank you for the quote. We will review the design and price this week.';
    position = 'The customer is reviewing the quote; no acceptance is established by this email.';
    suggestion = 'Ask whether any questions are holding up the decision.';
    correspondence.answer.sections[0].caveat = 'A sent quote is a proposal, not an accepted agreement.';
  } else {
    item.title = 'Confirm the installation week with Aroha';
    item.sourceType = 'MANUAL'; item.origin = 'MANUAL';
    item.sourceKey = null; item.seriesKey = null; item.subjectKind = null; item.subjectId = null;
    item.deadlinePolicy = 'MANUAL'; item.slaBreachAt = null;
    item.effectiveAssignee = { kind: 'projectOwner', ownerKey: 'jordan' };
    reason = 'The quote is accepted and a deposit is recorded. Jordan has committed to confirm timing so Aroha can arrange access.';
    excerpt = 'Please confirm the expected installation week before we arrange access.';
    position = 'The customer is asking for the expected installation week.';
    suggestion = 'Check the installation plan before confirming the week. This supports Jordan’s existing action above.';
    currentDesign.newerEstimate = null;
  }
  if (name !== 'enquiry') currentDesign.price.totalIncGstCents = 2_665_000;
  work.projectWork.openItems = [item];
  work.projectWork.primaryAction = { kind: 'workItem', item, dueState: 'future', reason };
  work.projectWork.generatedAt = '2026-09-16T01:00:00Z';
  correspondence.answer.sections[1] = { topic: 'job_status', kind: 'interpretation', answer: position,
    caveat: 'This is a synthetic example. Inspect the source before relying on an interpretation.', citations: [{ sourceId: 'S1', quote: excerpt }] };
  correspondence.answer.sections[2] = { topic: 'next_action', kind: 'recommendation', answer: suggestion,
    caveat: 'A suggestion does not create or replace assigned work.', citations: [{ sourceId: 'S1', quote: excerpt }] };
  correspondence.sources[0].title = `${storyNames[name]} — synthetic customer email`;
  correspondence.messages = [{ id: 'sample-message', subject: correspondence.sources[0].title,
    from: 'aroha@example.invalid', sentAt: correspondence.sources[0].recordedAt,
    receivedAt: correspondence.sources[0].recordedAt, observedAt: correspondence.observedAt,
    url: correspondence.sources[0].url, bodyText: excerpt, truncated: false, association: 'customer_address_only',
    projectLink: { state: 'linked', basis: 'reply_chain' } }];
  if (name === 'quote') {
    const sent = { ...correspondence.messages[0], id: 'sample-quote', from: 'team@example.invalid',
      projectLink: { state: 'linked' as const, basis: 'sent_message' as const },
      subject: `Your revised quote ${currentDesign.quote!.quoteRef}`,
      sentAt: '2026-09-15T23:00:00Z', receivedAt: '2026-09-15T23:00:00Z',
      bodyText: 'Hi Aroha, your revised quote is ready to review. It includes the design changes we discussed. Please review the proposed scope and price and let us know whether you have any questions. We will confirm installation timing separately once the agreement is in place.' };
    correspondence.messages.push(sent, { ...sent, id: 'sample-copy', url: 'https://outlook.office.com/mail/id/sample-copy' },
      { ...sent, id: 'sample-earlier', sentAt: '2026-09-14T23:00:00Z', subject: 'Your initial design proposal', bodyText: 'Here is the first design proposal for discussion.' });
    correspondence.messages.push({ ...sent, id: 'sample-other-job', from: 'aroha@example.invalid',
      sentAt: '2026-09-16T00:00:00Z', subject: 'Question about another property',
      bodyText: 'Could we also discuss a pergola at a different property?', projectLink: { state: 'unconfirmed' } });
  }
  if (name === 'accepted-review') {
    work.projectWork.openItems = [];
    work.projectWork.primaryAction = { kind: 'none', title: 'No assigned work', reason: 'No manual commitment is recorded.' };
    currentDesign.warnings = ['multiple_accepted_quotes'];
    correspondence.messages[0].bodyText = 'Hi Jordan,\n\nThanks for explaining the revised quote. Could you confirm the installation week and whether the lighting is included in the accepted version?\n\nWe need to arrange access for the team.\n\nThanks,\nAroha\n\nFrom: Sanctuary Pergolas\nSubject: Your updated quote\n\nPlease find the revised design and price for your review. The installation date will be confirmed separately.';
    correspondence.messages.push({ ...correspondence.messages[0], id: 'sample-invoice', from: 'website@example.invalid',
      subject: 'Initial payment invoice', sentAt: '2026-09-17T00:00:00Z',
      projectLink: { state: 'linked', basis: 'sent_message' },
      bodyText: 'Sanctuary Pergolas\nInvoice\nInitial payment\n\nHi Aroha, this invoice relates to the accepted quote for your pergola. Please use the invoice reference when making payment.\n\nThank you for choosing Sanctuary Pergolas.' });
  }
  return { work, currentDesign, correspondence };
}
