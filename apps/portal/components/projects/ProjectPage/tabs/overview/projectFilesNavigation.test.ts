import { afterEach, expect, it } from 'vitest';
import { emptyFilesNavigation, filesNavigationKey, readFilesNavigation, writeFilesNavigation } from './projectFilesNavigation';
import { formatFileSize } from './projectFilePresentation';
afterEach(() => sessionStorage.clear());
it('keeps only bounded per-user navigation metadata, with no document or token persistence', () => {
  const key = filesNavigationKey('staging', 'user-a', 'project-a')!;
  const nav = { ...emptyFilesNavigation(), rootId: 'root', trail: [{ id: 'cad', name: '3 CAD' }], selectedId: 'plan', term: 'plan', scrolls: { cad: 140 }, pageCounts: { cad: 2 } };
  writeFilesNavigation(key, nav); expect(readFilesNavigation(key)).toEqual(nav);
  expect(readFilesNavigation(filesNavigationKey('staging', 'user-b', 'project-a'))).toEqual(emptyFilesNavigation());
  expect(readFilesNavigation(filesNavigationKey('other', 'user-a', 'project-a'))).toEqual(emptyFilesNavigation());
  expect(filesNavigationKey('staging', null, 'project-a')).toBeNull();
  const stored = sessionStorage.getItem(key)!; expect(stored).not.toMatch(/downloadUrl|token|documentBytes|cursor|https:/i);
  sessionStorage.setItem(key, '{invalid'); expect(readFilesNavigation(key)).toEqual(emptyFilesNavigation());
  sessionStorage.setItem(key, JSON.stringify({ ...nav, trail: Array.from({ length: 41 }, () => nav.trail[0]) })); expect(readFilesNavigation(key)).toEqual(emptyFilesNavigation());
});
it('keeps small source files truthful in B and KB rather than rounding to zero MB', () => {
  expect(formatFileSize(740)).toBe('740 B'); expect(formatFileSize(2480)).toBe('2.4 KB'); expect(formatFileSize(470000000)).toBe('448.2 MB');
});
