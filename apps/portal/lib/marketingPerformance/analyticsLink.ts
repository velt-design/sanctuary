export function analyticsReportLink(start: string, end: string): string {
  const url = new URL('https://velt.systems/analytics');
  if (/^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
    url.searchParams.set('start', start); url.searchParams.set('end', end);
  }
  return url.toString();
}
