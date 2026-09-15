import type { StripSite } from '@sp/geometry';

/** Pick one outside mounting line per edge, retaining separate gable slopes. */
export function perimeterLedPreset(sites: StripSite[]): string[] {
  const candidates = sites.filter(site => site.perimeter);
  if (!candidates.length) return [];
  const xs = sites.flatMap(s => [s.start.x, s.end.x]);
  const ys = sites.flatMap(s => [s.start.y, s.end.y]);
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const rows = candidates.map(site => {
    const vertical = Math.abs(site.end.y - site.start.y) > Math.abs(site.end.x - site.start.x);
    const cross = vertical ? (site.start.x + site.end.x) / 2 : (site.start.y + site.end.y) / 2;
    const lower = cross < (vertical ? midX : midY);
    const axis = vertical ? 'y' : 'x';
    return { site, edge: `${vertical ? 'side' : 'end'}-${lower}`, outside: lower ? cross : -cross,
      low: Math.min(site.start[axis], site.end[axis]), high: Math.max(site.start[axis], site.end[axis]) };
  }).sort((a,b) => a.outside - b.outside || (b.high-b.low)-(a.high-a.low) || a.site.id.localeCompare(b.site.id));
  const selected: typeof rows = [];
  for (const row of rows) {
    if (!selected.some(other => other.edge === row.edge && Math.min(other.high,row.high)-Math.max(other.low,row.low) > 1)) selected.push(row);
  }
  return selected.map(row => row.site.id);
}
