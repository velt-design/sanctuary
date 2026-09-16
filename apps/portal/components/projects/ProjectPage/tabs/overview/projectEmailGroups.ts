import type { ProjectCorrespondenceContext } from './projectCorrespondencePresentation';

export type EmailMessage = NonNullable<ProjectCorrespondenceContext['messages']>[number];
export type EmailProjectContext = { customerEmail?: string; quoteRef?: string | null };

export function projectEmailGroups(messages: EmailMessage[], customerEmail?: string) {
  const groups: { message: EmailMessage; copies: EmailMessage[] }[] = [];
  const keys = new Map<string, number>();
  for (const message of [...messages].sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt))) {
    // Equal truncated excerpts do not establish that the complete messages match.
    const key = message.truncated ? message.id : JSON.stringify([message.from.toLowerCase(), message.subject,
      Date.parse(message.sentAt), message.bodyText]);
    const existing = keys.get(key);
    if (existing !== undefined) groups[existing].copies.push(message);
    else { keys.set(key, groups.length); groups.push({ message, copies: [] }); }
  }
  const latestCustomer = customerEmail ? groups.find(group => group.message.from.toLowerCase() === customerEmail.toLowerCase()) : undefined;
  const featured = groups.filter((group, index) => index === 0 || group === latestCustomer);
  return { featured, earlier: groups.filter(group => !featured.includes(group)), latestCustomer };
}

export function referencesProjectQuote(message: EmailMessage, quoteRef?: string | null) {
  if (!quoteRef) return false;
  const escaped = quoteRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // A subject reference is evidence of a quote reference, not acceptance or scope.
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(message.subject);
}
