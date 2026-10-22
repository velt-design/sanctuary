import type { DriveItem } from './graphProtocol';

function pathSegments(path: string | undefined, driveId: string): string[] | null {
  if (!path) return null;
  const marker = path.indexOf(':');
  const base = path.slice(0, marker);
  if (marker < 0 || !['/drive/root', `/drives/${driveId}/root`, `/drives/${encodeURIComponent(driveId)}/root`].includes(base)) return null;
  const suffix = path.slice(marker + 1);
  if (suffix === '') return [];
  if (!suffix.startsWith('/')) return null;
  try {
    const segments = suffix.slice(1).split('/').map(value => decodeURIComponent(value));
    if (segments.some(value => !value || value === '.' || value === '..' || /[\/\\:\x00-\x1f]/.test(value))) return null;
    return segments;
  } catch { return null; }
}

/** Both items must come from the same fresh Graph response scope, never client metadata. */
export function currentGraphContainment(root: DriveItem, item: DriveItem, driveId: string): boolean {
  if (!root.folder || root.remoteItem || item.remoteItem || root.parentReference?.driveId !== driveId || item.parentReference?.driveId !== driveId) return false;
  if (item.id === root.id || item.parentReference.id === root.id) return true;
  const parent = pathSegments(root.parentReference.path, driveId);
  const requested = pathSegments(item.parentReference.path, driveId);
  if (!parent || !requested || !root.name || root.name === '.' || root.name === '..' || /[\/\\:\x00-\x1f]/.test(root.name)) return false;
  const prefix = [...parent, root.name];
  return requested.length >= prefix.length && prefix.every((segment, index) => requested[index] === segment);
}
