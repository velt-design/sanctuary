import { splitProjectEmailText, usefulEmailOpening } from './projectEmailText';

/** Presentation only: full message text remains available unchanged. */
export function projectEmailPreview(body: string, from: string) {
  const text = body.trim();
  let lead = usefulEmailOpening(splitProjectEmailText(text).latest, from);
  // Our generated quote/invoice emails start with a useful one-line summary,
  // followed by the branded document. Show that summary, not repeated headings.
  const brandStart = lead.search(/\r?\n(?:\[Sanctuary Pergolas\]|Sanctuary Pergolas)\s*\r?\n/i);
  if (/(?:^|<)[^<>\s]+@sanctuarypergolas\.co\.nz>?$/i.test(from.trim()) && brandStart > 0) {
    const summary = lead.slice(0, brandStart).trim();
    if (/^(?:Quote\s+Q-|Invoice\s+INV-)/i.test(summary)) lead = summary;
  }
  return lead.slice(0, 200);
}
