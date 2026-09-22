import type { EmailReviewThread } from './contracts';

/** Mirrors the server's deterministic choice; the subject is visible before Accept. */
export function reviewDelivery(threads: EmailReviewThread[], to: string, subject: string): { mode: 'reply' | 'new'; subject: string; threadMessageId: string | null } {
  const matches = threads.filter(thread => thread.matchedRecipient.trim().toLowerCase() === to.trim().toLowerCase());
  if (matches.length === 1) {
    const candidate = matches[0];
    const replySubject = /^re:/i.test(candidate.subject) ? candidate.subject : `Re: ${candidate.subject}`;
    if (subject === replySubject) return { mode: 'reply', subject, threadMessageId: candidate.messageId };
  }
  return { mode: 'new', subject: subject.replace(/^(?:re:\s*)+/i, ''), threadMessageId: null };
}
