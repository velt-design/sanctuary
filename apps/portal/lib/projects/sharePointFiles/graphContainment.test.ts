import { expect, it } from 'vitest';
import { currentGraphContainment } from './graphContainment';
import type { DriveItem } from './graphProtocol';

const root: DriveItem = { id: 'project', name: 'Project % One', folder: {}, parentReference: { driveId: 'drive', id: 'clients', path: '/drives/drive/root:/Clients' } };
const child: DriveItem = { id: 'drawing', name: 'Design.pdf', file: {}, parentReference: { driveId: 'drive', id: 'deep', path: '/drive/root:/Clients/Project%20%25%20One/CAD' } };

it('proves exact current root/direct-parent IDs without depending on path names', () => {
  expect(currentGraphContainment(root, root, 'drive')).toBe(true);
  expect(currentGraphContainment(root, { ...child, parentReference: { driveId: 'drive', id: root.id } }, 'drive')).toBe(true);
});
it('compares decoded whole provider segments without decoding a literal percent twice', () => {
  expect(currentGraphContainment(root, child, 'drive')).toBe(true);
  const literal = { ...root, name: '%2F' };
  expect(currentGraphContainment(literal, { ...child, parentReference: { ...child.parentReference, path: '/drive/root:/Clients/%252F/CAD' } }, 'drive')).toBe(true);
});
it.each([
  '/drive/root:/Clients/Project%20%25%20One-other/CAD', '/drive/root:/Other/Project%20%25%20One/CAD',
  '/drives/foreign/root:/Clients/Project%20%25%20One/CAD', '/drive/root:/Clients/Project%20%25%20One%2FCAD',
  '/drive/root:/Clients/Project%20%25%20One/%2E%2E', '/drive/root:/Clients/Project%20%25%20One/CAD%3Asecret',
  '/drive/root:/Clients/Project%20%25%20One/%ZZ', '/drive/root:/Clients//Project%20%25%20One',
])('requires the existing ancestry fallback for a nonproving path %s', path => {
  expect(currentGraphContainment(root, { ...child, parentReference: { ...child.parentReference, path } }, 'drive')).toBe(false);
});
it('never makes a foreign-drive, remote-item or non-folder root prove containment', () => {
  expect(currentGraphContainment({ ...root, folder: undefined }, child, 'drive')).toBe(false);
  expect(currentGraphContainment({ ...root, remoteItem: {} }, child, 'drive')).toBe(false);
  expect(currentGraphContainment(root, { ...child, remoteItem: {} }, 'drive')).toBe(false);
  expect(currentGraphContainment(root, { ...child, parentReference: { ...child.parentReference, driveId: 'foreign' } }, 'drive')).toBe(false);
});
