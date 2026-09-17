export type QuotedEmail = { header: string; body: string };

/** Recognize explicit email headers only. Unrecognized text stays in the message. */
export function splitProjectEmailText(text: string): { latest: string; history: QuotedEmail[] } {
  const boundary = /^(?:From:[^\r\n]+\r?\n(?=(?:Date|Sent|To|Subject):)|On [^\r\n]{1,200}wrote:\s*$)/gim;
  const starts = [...text.matchAll(boundary)].map(match => match.index!);
  if (!starts.length || starts[0] === 0) return { latest: text, history: [] };
  const history = starts.map((start, index) => {
    const chunk = text.slice(start, starts[index + 1] ?? text.length);
    const header = chunk.match(/^(?:From:[^\r\n]+\r?\n(?:(?:Date|Sent|To|Cc|Subject):[^\r\n]*(?:\r?\n|$)){1,8}|On [^\r\n]{1,200}wrote:[^\S\r\n]*(?:\r?\n|$))/i)?.[0] ?? '';
    return { header, body: chunk.slice(header.length) };
  });
  return { latest: text.slice(0, starts[0]), history };
}

/** Only the teaser omits conventional standalone greetings and short sign-offs. */
export function usefulEmailOpening(text: string, from?: string): string {
  let result = text.trim();
  const withoutGreeting = result.replace(/^(?:[Hh]i|[Hh]ello|[Dd]ear|[Hh]ey)(?: (?:team|all|[\p{Lu}][\p{L}'-]*(?: [\p{Lu}][\p{L}'-]*){0,2}))?[,!]\s*\r?\n\s*/u, '');
  if (withoutGreeting.trim()) result = withoutGreeting;
  const signature = result.match(/\r?\n\s*(?:Cheers|Kind regards|Best regards|Regards),?\s*\r?\n\s*([\p{L} .'-]{1,60})\s*$/iu);
  const senderName = from?.split('@')[0].replace(/[._-]/g, '').toLocaleLowerCase();
  const signatureName = signature?.[1].replace(/[ .'-]/g, '').toLocaleLowerCase();
  if (signature && senderName && signatureName === senderName) {
    const content = result.slice(0, signature.index).trim();
    if (content) result = content;
  }
  return result;
}
