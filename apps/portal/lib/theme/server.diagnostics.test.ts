// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock('@/lib/supabase/serverClient', () => ({ getSupabaseServerAuth: h.client }));
import { loadPortalThemeForUser } from './server';
import { resolvePortalTheme } from './resolve';
import { prepareProxyDocumentDiagnostics } from '../performance/documentDiagnostics';

beforeEach(() => vi.stubEnv('PORTAL_DOCUMENT_DIAGNOSTICS', JSON.stringify({ until: new Date(Date.now() + 60_000).toISOString(), nonce: 'A'.repeat(43) })));
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); h.client.mockReset(); });

it.each(['absent', 'missing', 'custom', 'preset-missing', 'error', 'anonymous'] as const)('preserves %s theme result, query sequence and safe outcomes', async (mode) => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const error = { code: 'OTHER', message: 'private SQL payload' };
  const missing = { code: '42P01', message: 'private relation' };
  const rows = mode === 'absent' ? { data: null, error: null } : mode === 'missing' ? { data: null, error: missing }
    : mode === 'error' ? { data: null, error } : { data: { user_preset_id: 'private-preset', overrides: {} }, error: null };
  const tables: string[] = [];
  h.client.mockImplementation(async () => ({ from: (table: string) => {
    tables.push(table);
    const query = { select: () => query, eq: () => query, maybeSingle: async () => table === 'portal_user_theme_settings' ? rows
      : mode === 'preset-missing' ? { data: null, error: missing }
        : { data: { id: 'private-preset', name: 'private theme', tokens: resolvePortalTheme().tokens }, error: null } };
    return query;
  } }));
  const user = mode === 'anonymous' ? null : 'private-user';
  const scope = prepareProxyDocumentDiagnostics(new Request('https://portal.example/staff/projects', {
    headers: { accept: 'text/html', 'sec-fetch-dest': 'document' },
  })).diagnostics;
  if (mode === 'error') {
    await expect(loadPortalThemeForUser(user, scope)).rejects.toBe(error);
    await expect(loadPortalThemeForUser(user)).rejects.toBe(error);
  } else {
    const observed = await loadPortalThemeForUser(user, scope);
    const firstReads = [...tables]; tables.length = 0;
    expect(observed).toEqual(await loadPortalThemeForUser(user));
    expect(tables).toEqual(firstReads);
    if (mode === 'custom') expect(firstReads).toEqual(['portal_user_theme_settings', 'portal_user_theme_presets']);
    if (mode === 'anonymous') expect(firstReads).toEqual([]);
  }
  const events = log.mock.calls.map((call) => call[1]);
  if (mode === 'missing' || mode === 'preset-missing') expect(events).toContainEqual(expect.objectContaining({ phase: 'theme.fallback', outcome: 'missing_relation' }));
  if (mode === 'custom') expect(events).toContainEqual(expect.objectContaining({ phase: 'theme.preset', outcome: 'complete' }));
  if (mode === 'error') expect(events).toContainEqual(expect.objectContaining({ phase: 'theme.settings', outcome: 'error' }));
  expect(JSON.stringify(events)).not.toMatch(/private/);
});
