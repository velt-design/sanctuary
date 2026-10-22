type FileTrailPart = { id: string; name: string };
export type FilesNavigation = {
  rootId?: string; trail: FileTrailPart[]; selectedId?: string; term: string;
  source: 'sharepoint' | 'website'; scrolls: Record<string, number>; pageCounts: Record<string, number>;
};
export const emptyFilesNavigation = (): FilesNavigation => ({ trail: [], term: '', source: 'sharepoint', scrolls: {}, pageCounts: {} });
export function filesNavigationKey(host: string, ownerId: string | null, projectId: string) {
  return ownerId ? `sanctuary:files-navigation:v1:${encodeURIComponent(host)}:${encodeURIComponent(ownerId)}:${encodeURIComponent(projectId)}` : null;
}
export function readFilesNavigation(key: string | null): FilesNavigation {
  if (!key || typeof window === 'undefined') return emptyFilesNavigation();
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw || raw.length > 60_000) return emptyFilesNavigation();
    const value = JSON.parse(raw) as FilesNavigation;
    const shortString = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= 400;
    if (!Array.isArray(value.trail) || value.trail.length > 40 || value.trail.some(x => !shortString(x?.id) || !shortString(x?.name))) return emptyFilesNavigation();
    const numbers = (map: unknown, max: number) => Object.fromEntries(Object.entries(map && typeof map === 'object' ? map : {}).slice(-100).filter(([key, number]) => key.length <= 800 && typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= max));
    return { rootId: shortString(value.rootId) ? value.rootId : undefined, trail: value.trail,
      selectedId: shortString(value.selectedId) ? value.selectedId : undefined,
      term: typeof value.term === 'string' ? value.term.slice(0, 200) : '', source: value.source === 'website' ? 'website' : 'sharepoint',
      scrolls: numbers(value.scrolls, 10_000_000), pageCounts: numbers(value.pageCounts, 100) };
  } catch { return emptyFilesNavigation(); }
}
export function writeFilesNavigation(key: string | null, value: FilesNavigation) {
  if (!key) return;
  try { window.sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Navigation still works when storage is unavailable. */ }
}
