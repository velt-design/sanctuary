import { beforeEach, expect, it } from 'vitest';
import { readStudioProjectChoice, rememberStudioProjectChoice, selectStudioProjectDesign, studioDesignHref, studioProjectChoiceKey, type StudioProjectDesign } from './projectDesigns';
const row = (id: string, extra: Partial<StudioProjectDesign> = {}): StudioProjectDesign => ({ id, label: id, versionLabel: 'V1', createdAt: '2026-11-02T00:00:00Z', history: 'Saved draft', quoteLabel: null, canOpenEditor: true, status: 'draft', commercialScopeId: null, isActiveDraft: false, ...extra });
beforeEach(() => localStorage.clear());
it('returns the authoritative current editable base instead of the newest add-on or old option', () => {
  const rows = [row('addon', { commercialScopeId: 'scope', isActiveDraft: true }), row('old-option'), row('base', { isActiveDraft: true })];
  expect(selectStudioProjectDesign(rows, null)?.id).toBe('base');
});
it('honours a deliberately selected option/add-on only while it is freshly visible and not archived', () => {
  const rows = [row('addon', { commercialScopeId: 'scope' }), row('base', { isActiveDraft: true }), row('archived', { status: 'archived' })];
  expect(selectStudioProjectDesign(rows, 'addon')?.id).toBe('addon');
  for (const hint of ['missing', 'other-project', 'archived']) expect(selectStudioProjectDesign(rows, hint)?.id).toBe('base');
});
it('opens a quoted active draft for review and never treats the active flag as edit authority', () => {
  const quoted = row('quoted', { canOpenEditor: false, isActiveDraft: true, history: 'Used by a quote' });
  expect(studioDesignHref('proj-test', selectStudioProjectDesign([quoted], null)!)).toBe('/staff/design-studio/proj-test/quoted');
  expect(selectStudioProjectDesign([quoted,row('older-editable-option')],null)?.id).toBe('quoted');
  expect(studioDesignHref('proj-test', row('edit'))).toBe('/staff/design-studio/proj-test/edit/edit');
});
it('has no creation decision for missing data: only a successfully empty inventory selects nothing', () => {
  expect(selectStudioProjectDesign([], 'old')).toBeNull();
  expect(selectStudioProjectDesign([row('archived', { canOpenEditor: false, status: 'archived' })], null)?.id).toBe('archived');
});
it('remembers only an actor and project scoped routing hint, independent between projects and actors', () => {
  rememberStudioProjectChoice('actor-a', 'project-a', 'option');
  expect(readStudioProjectChoice('actor-a', 'project-a')).toBe('option');
  expect(readStudioProjectChoice('actor-b', 'project-a')).toBeNull();
  expect(readStudioProjectChoice('actor-a', 'project-b')).toBeNull();
  expect(studioProjectChoiceKey('actor-a', 'project-a')).not.toBe(studioProjectChoiceKey('actor-b', 'project-a'));
});
