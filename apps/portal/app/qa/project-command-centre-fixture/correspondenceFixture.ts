import type { ProjectCorrespondenceContext } from '@/components/projects/ProjectPage/tabs/overview/projectCorrespondencePresentation';

// Synthetic excerpts only. Never acceptance evidence for live correspondence.
export const correspondenceFixture: ProjectCorrespondenceContext = {
  observedAt: '2026-09-16T01:00:00Z',
  answer: { sections: [
    { topic: 'agreement', kind: 'unknown', answer: 'This email does not establish the final agreed scope.', caveat: 'Use the accepted quote and source design for the agreement.', citations: [] },
    { topic: 'job_status', kind: 'interpretation', answer: 'The customer is asking for the expected installation week.', caveat: 'A booked installation date is not established by this email.', citations: [{ sourceId: 'S1', quote: 'Please confirm the expected installation week before we arrange access.' }] },
    { topic: 'next_action', kind: 'recommendation', answer: 'Check the installation plan and confirm the expected week with the customer.', caveat: 'Confirm that this message concerns this project before recording follow-up work.', citations: [{ sourceId: 'S1', quote: 'Please confirm the expected installation week before we arrange access.' }] },
  ] },
  sources: [{ id: 'S1', title: 'Installation timing — synthetic example', url: 'https://outlook.office.com/mail/inbox/id/fixture-only',
    observedAt: '2026-09-16T01:00:00Z', recordedAt: '2026-09-15T22:00:00Z', association: 'customer_address_only', excerpted: true }],
  limitations: ['Only bounded customer-address matches were checked. Other messages may be missing.', 'Attachments have not been read.'],
};
