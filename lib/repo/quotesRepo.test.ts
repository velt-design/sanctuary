// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { createContact } from '@/lib/repo/contactsRepo';
import { createEstimate } from '@/lib/repo/estimatesRepo';
import { createProject } from '@/lib/repo/projectsRepo';
import { createQuoteFromEstimate, duplicateQuoteAsRevision, markQuoteSent, suggestNextQuoteNumber, updateQuote } from '@/lib/repo/quotesRepo';

async function seedProjectWithEstimate(opts?: { totalEx?: number; totalInc?: number; status?: 'draft' | 'approved' }) {
  const contact = await createContact({ displayName: 'Test Contact', email: 'test@example.com', phone: '021' });
  const project = await createProject({ contactId: contact.id, projectName: 'Test Project' });
  const totalEx = opts?.totalEx ?? 100;
  const totalInc = opts?.totalInc ?? 115;

  const estimate = await createEstimate(project.id, {
    status: opts?.status ?? 'draft',
    inputs: {
      schemaVersion: 'v2',
      projectName: 'Test Project',
      quoteRef: '',
      access: 'normal',
      height: 'single_storey',
      travelExGst: '0',
      extrasAllowanceExGst: '0',
      quoteDiscountPct: '0',
      modules: [
        {
          pergolaStyle: 'pitched',
          roofMaterial: 'acrylic',
          extrusionColour: 'Black',
          boxPerimeterEnabled: false,
          internalRoofType: 'pitched',
          fallDistanceMm: '0',
          roofPitchDeg: '5',
          mixedSkylightStripCount: '0',
          mixedSkylightStripWidthM: '0',
          mixedAcrylicBaysMain: '0',
          mixedAcrylicBaysA: '0',
          mixedAcrylicBaysB: '0',
          postCount: '4',
          houseConnectionType: 'soffit',
          postConnectionType: 'deck_bracket',
          ground: 'easy',
          lengthM: '6',
          projectionM: '3',
          hipCornerLengthBM: '0',
          hipCornerProjectionBM: '0',
          postCutHeightM: '2.4',
          timberRoofAllowanceExGst: '0',
        },
      ],
    } as any,
    derived: { area_m2: 0 } as any,
    outputs: {
      materials: { lines: [], totals: { materials_ex_gst: 0, waste_m_by_profile: {}, bars_by_profile: {} } },
      install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
      overhead: { method: 'test', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
      totals: { cost_ex_gst: totalEx, cost_inc_gst: totalInc, warnings: [], notes_and_warnings: [] },
      warnings: [],
    } as any,
    configVersions: { pricebook: 'p', installActions: 'i', overheads: 'o', rules: 'r', manifest: 'm' },
  } as any);

  return { contact, project, estimate };
}

describe('quotesRepo', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const mockStorage: Storage = {
      get length() {
        return store.size;
      },
      clear() {
        store.clear();
      },
      getItem(key: string) {
        return store.has(key) ? store.get(key)! : null;
      },
      key(index: number) {
        return Array.from(store.keys())[index] ?? null;
      },
      removeItem(key: string) {
        store.delete(key);
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      configurable: true,
    });
    window.localStorage.clear();

    const db = {
      contacts: new Map<string, any>(),
      projects: new Map<string, any>(),
      estimates: new Map<string, any>(),
      quotes: new Map<string, any>(),
    };

    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === 'string' ? new URL(input, window.location.origin) : new URL(String(input.url), window.location.origin);
      const method = String(init?.method ?? 'GET').toUpperCase();
      const pathname = url.pathname;
      const header = (name: string): string => {
        const h: any = init?.headers;
        if (!h) return '';
        if (typeof h.get === 'function') return String(h.get(name) ?? '');
        if (Array.isArray(h)) {
          const found = h.find((pair) => String(pair?.[0] ?? '').toLowerCase() === name.toLowerCase());
          return found ? String(found[1] ?? '') : '';
        }
        if (typeof h === 'object') {
          return String(h[name] ?? h[name.toLowerCase()] ?? '');
        }
        return '';
      };

      const jsonBody = async () => {
        const raw = init?.body;
        if (!raw) return null;
        if (typeof raw !== 'string') return raw;
        return JSON.parse(raw);
      };

      const json = (body: any, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

      const notFound = () => json({ error: 'Not found' }, 404);

      // Supabase PostgREST - contacts
      if (url.host === 'test.supabase.co' && pathname === '/rest/v1/contacts') {
        const select = url.searchParams.get('select');
        const idFilter = url.searchParams.get('id');
        const accept = header('accept');

        const makeRow = (body: any) => ({
          id: body.id,
          name: body.name ?? body.displayName ?? '',
          email: body.email ?? null,
          phone: body.phone ?? null,
          address: body.address ?? null,
          created_at: body.created_at ?? new Date().toISOString(),
          updated_at: body.updated_at ?? body.created_at ?? new Date().toISOString(),
          data: body.data ?? {},
        });

        if (method === 'GET') {
          if (idFilter && idFilter.startsWith('eq.')) {
            const uuid = idFilter.slice('eq.'.length);
            const row = db.contacts.get(uuid);
            if (!row) return json({ message: 'Not found', code: 'PGRST116', details: null, hint: null }, 406);
            if (select && accept === 'application/vnd.pgrst.object+json') return json(row);
            return json([row]);
          }
          return json(Array.from(db.contacts.values()));
        }

        if (method === 'POST') {
          const body = await jsonBody();
          const row = makeRow(Array.isArray(body) ? body[0] : body);
          if (db.contacts.has(row.id)) return json({ message: 'duplicate key value', code: '23505', details: null, hint: null }, 409);
          db.contacts.set(row.id, row);
          if (select && accept === 'application/vnd.pgrst.object+json') return json(row, 201);
          return json([row], 201);
        }

        if (method === 'PATCH') {
          if (!idFilter || !idFilter.startsWith('eq.')) return json({ message: 'Missing filter', code: 'PGRST101' }, 400);
          const uuid = idFilter.slice('eq.'.length);
          const prev = db.contacts.get(uuid);
          if (!prev) return notFound();
          const body = await jsonBody();
          const patch = Array.isArray(body) ? body[0] : body;
          const now = new Date().toISOString();
          const next = { ...prev, ...patch, updated_at: now };
          db.contacts.set(uuid, next);
          if (select && accept === 'application/vnd.pgrst.object+json') return json(next);
          return json([next]);
        }
      }

      // Supabase PostgREST - projects
      if (url.host === 'test.supabase.co' && pathname === '/rest/v1/projects') {
        const select = url.searchParams.get('select');
        const idFilter = url.searchParams.get('id');
        const accept = header('accept');

        const makeRow = (body: any) => ({
          id: body.id,
          contact_id: body.contact_id ?? null,
          name: body.name ?? body.projectName ?? '',
          quote_ref: body.quote_ref ?? null,
          region: body.region ?? null,
          site_address: body.site_address ?? null,
          pipeline_stage: body.pipeline_stage ?? body.status ?? 'NEW',
          follow_up_date: body.follow_up_date ?? null,
          notes: body.notes ?? '',
          created_at: body.created_at ?? new Date().toISOString(),
          updated_at: body.updated_at ?? body.created_at ?? new Date().toISOString(),
        });

        if (method === 'GET') {
          if (idFilter && idFilter.startsWith('eq.')) {
            const uuid = idFilter.slice('eq.'.length);
            const row = db.projects.get(uuid);
            if (!row) return json({ message: 'Not found', code: 'PGRST116', details: null, hint: null }, 406);
            if (select && accept === 'application/vnd.pgrst.object+json') return json(row);
            return json([row]);
          }
          return json(Array.from(db.projects.values()));
        }

        if (method === 'POST') {
          const body = await jsonBody();
          const row = makeRow(Array.isArray(body) ? body[0] : body);
          if (db.projects.has(row.id)) return json({ message: 'duplicate key value', code: '23505', details: null, hint: null }, 409);
          db.projects.set(row.id, row);
          if (select && accept === 'application/vnd.pgrst.object+json') return json(row, 201);
          return json([row], 201);
        }

        if (method === 'PATCH') {
          if (!idFilter || !idFilter.startsWith('eq.')) return json({ message: 'Missing filter', code: 'PGRST101' }, 400);
          const uuid = idFilter.slice('eq.'.length);
          const prev = db.projects.get(uuid);
          if (!prev) return notFound();
          const body = await jsonBody();
          const patch = Array.isArray(body) ? body[0] : body;
          const now = new Date().toISOString();
          const next = { ...prev, ...patch, updated_at: now };
          db.projects.set(uuid, next);
          if (select && accept === 'application/vnd.pgrst.object+json') return json(next);
          return json([next]);
        }
      }

      // Supabase PostgREST - estimates
      if (url.host === 'test.supabase.co' && pathname === '/rest/v1/estimates') {
        const select = url.searchParams.get('select');
        const idFilter = url.searchParams.get('id');
        const projectFilter = url.searchParams.get('project_id');
        const accept = header('accept');

        const makeRow = (body: any) => ({
          id: body.id,
          project_id: body.project_id,
          status: body.status ?? 'draft',
          summary: body.summary ?? null,
          crew_hours: body.crew_hours ?? null,
          duration_days: body.duration_days ?? null,
          materials_ex_gst: body.materials_ex_gst ?? null,
          install_payout_ex_gst: body.install_payout_ex_gst ?? null,
          overhead_ex_gst: body.overhead_ex_gst ?? null,
          total_true_cost_ex_gst: body.total_true_cost_ex_gst ?? null,
          total_true_cost_inc_gst: body.total_true_cost_inc_gst ?? null,
          inputs: body.inputs ?? {},
          outputs: body.outputs ?? {},
          warnings: body.warnings ?? [],
          costing_manifest: body.costing_manifest ?? null,
          costing_rules: body.costing_rules ?? null,
          created_at: body.created_at ?? new Date().toISOString(),
          updated_at: body.updated_at ?? body.created_at ?? new Date().toISOString(),
        });

        if (method === 'GET') {
          if (idFilter && idFilter.startsWith('eq.')) {
            const uuid = idFilter.slice('eq.'.length);
            const row = db.estimates.get(uuid);
            if (!row) return json({ message: 'Not found', code: 'PGRST116', details: null, hint: null }, 406);
            if (select && accept === 'application/vnd.pgrst.object+json') return json(row);
            return json([row]);
          }

          if (projectFilter && projectFilter.startsWith('eq.')) {
            const projectUuid = projectFilter.slice('eq.'.length);
            const rows = Array.from(db.estimates.values()).filter((r) => r.project_id === projectUuid);
            return json(rows);
          }

          return json(Array.from(db.estimates.values()));
        }

        if (method === 'POST') {
          const body = await jsonBody();
          const row = makeRow(Array.isArray(body) ? body[0] : body);
          if (db.estimates.has(row.id)) return json({ message: 'duplicate key value', code: '23505', details: null, hint: null }, 409);
          db.estimates.set(row.id, row);
          if (select && accept === 'application/vnd.pgrst.object+json') return json(row, 201);
          return json([row], 201);
        }

        if (method === 'PATCH') {
          if (!idFilter || !idFilter.startsWith('eq.')) return json({ message: 'Missing filter', code: 'PGRST101' }, 400);
          const uuid = idFilter.slice('eq.'.length);
          const prev = db.estimates.get(uuid);
          if (!prev) return notFound();
          const body = await jsonBody();
          const patch = Array.isArray(body) ? body[0] : body;
          const now = new Date().toISOString();
          const next = { ...prev, ...patch, updated_at: now };
          db.estimates.set(uuid, next);
          if (select && accept === 'application/vnd.pgrst.object+json') return json(next);
          return json([next]);
        }
      }

      // Projects
      if (pathname === '/api/staff/v1/projects' && method === 'POST') {
        const body = await jsonBody();
        const now = new Date().toISOString();
        const next = {
          version: 1,
          createdAt: body.createdAt ?? now,
          updatedAt: body.updatedAt ?? now,
          ...body,
          projectName: body.projectName ?? body.name,
          activity: Array.isArray(body.activity) ? body.activity : [],
        };
        db.projects.set(next.id, next);
        return json({ project: next });
      }
      {
        const m = /^\/api\/staff\/v1\/projects\/([^/]+)$/.exec(pathname);
        if (m && method === 'GET') {
          const id = decodeURIComponent(m[1]);
          const p = db.projects.get(id);
          return p ? json({ project: p }) : notFound();
        }
        if (m && method === 'PATCH') {
          const id = decodeURIComponent(m[1]);
          const prev = db.projects.get(id);
          if (!prev) return notFound();
          const body = await jsonBody();
          const expectedVersion = typeof body.expectedVersion === 'number' ? body.expectedVersion : null;
          const force = Boolean(body.force);
          if (!force && expectedVersion !== prev.version) return json({ error: 'Version conflict', current: prev }, 409);
          const patch = body.patch ?? {};
          const addActivity = body.addActivity ?? null;
          const now = new Date().toISOString();
          const nextActivity = (() => {
            if (!addActivity) return prev.activity;
            return [{ id: `act_${Math.random().toString(16).slice(2)}`, createdAt: now, ...addActivity }, ...(prev.activity ?? [])];
          })();
          const next = { ...prev, ...patch, activity: nextActivity, updatedAt: now, version: prev.version + 1 };
          db.projects.set(id, next);
          return json({ project: next });
        }
      }

      // Estimates
      if (pathname === '/api/staff/v1/estimates' && method === 'GET') {
        const projectId = url.searchParams.get('projectId');
        const rows = Array.from(db.estimates.values()).filter((e) => (projectId ? e.projectId === projectId : true));
        return json({ estimates: rows });
      }
      if (pathname === '/api/staff/v1/estimates' && method === 'POST') {
        const body = await jsonBody();
        const estimate = body.estimate ?? body;
        db.estimates.set(estimate.id, estimate);
        return json({ estimate });
      }
      {
        const m = /^\/api\/staff\/v1\/estimates\/([^/]+)$/.exec(pathname);
        if (m && method === 'GET') {
          const id = decodeURIComponent(m[1]);
          const e = db.estimates.get(id);
          return e ? json({ estimate: e }) : notFound();
        }
        if (m && method === 'PUT') {
          const body = await jsonBody();
          const estimate = body.estimate ?? body;
          db.estimates.set(estimate.id, estimate);
          return json({ estimate });
        }
      }

      // Quotes
      if (pathname === '/api/staff/v1/quotes' && method === 'GET') {
        const projectId = url.searchParams.get('projectId');
        const rows = Array.from(db.quotes.values()).filter((q) => (projectId ? q.projectId === projectId : true));
        return json({ quotes: rows });
      }
      if (pathname === '/api/staff/v1/quotes' && method === 'POST') {
        const body = await jsonBody();
        const quote = body.quote ?? body;
        db.quotes.set(quote.id, quote);
        return json({ quote });
      }
      {
        const m = /^\/api\/staff\/v1\/quotes\/([^/]+)$/.exec(pathname);
        if (m && method === 'GET') {
          const id = decodeURIComponent(m[1]);
          const q = db.quotes.get(id);
          return q ? json({ quote: q }) : notFound();
        }
        if (m && method === 'PUT') {
          const body = await jsonBody();
          const quote = body.quote ?? body;
          db.quotes.set(quote.id, quote);
          return json({ quote });
        }
        if (m && method === 'DELETE') {
          const id = decodeURIComponent(m[1]);
          db.quotes.delete(id);
          return json({ ok: true });
        }
      }

      return json({ error: `Unhandled ${method} ${pathname}` }, 500);
    }) as any;

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  it('creates quotes with snapshot + default overrides', async () => {
    const { project, estimate } = await seedProjectWithEstimate({ totalEx: 200, totalInc: 230 });

    const nextNumber = await suggestNextQuoteNumber();
    const quote = await createQuoteFromEstimate(project.id, estimate.id);

    expect(quote.projectId).toBe(project.id);
    expect(quote.rootQuoteId).toBe(quote.id);
    expect(quote.quoteNumber).toBe(nextNumber);
    expect(quote.customerTotalOverride).toBe(230);
    expect(quote.estimateSnapshotFull?.id).toBe(estimate.id);
  });

  it('suggestNextQuoteNumber increments by year sequence', async () => {
    const { project, estimate } = await seedProjectWithEstimate();
    const year = new Date().getFullYear();

    const q1 = await createQuoteFromEstimate(project.id, estimate.id);
    const q2 = await createQuoteFromEstimate(project.id, estimate.id);

    expect(q1.quoteNumber).toBe(`Q-${year}-0001`);
    expect(q2.quoteNumber).toBe(`Q-${year}-0002`);
  });

  it('duplicates as revision using max(version)+1 for the series', async () => {
    const { project, estimate } = await seedProjectWithEstimate();
    const q1 = await createQuoteFromEstimate(project.id, estimate.id);
    const q2 = await duplicateQuoteAsRevision(q1.id);
    const q3 = await duplicateQuoteAsRevision(q1.id);

    expect(q2.rootQuoteId).toBe(q1.id);
    expect(q3.rootQuoteId).toBe(q1.id);
    expect(q2.version).toBe(2);
    expect(q3.version).toBe(3);
    expect(q2.quoteNumber).toBe(q1.quoteNumber);
    expect(q3.quoteNumber).toBe(q1.quoteNumber);
  });

  it('prevents edits after marking sent', async () => {
    const { project, estimate } = await seedProjectWithEstimate();
    const q1 = await createQuoteFromEstimate(project.id, estimate.id);
    const sent = await markQuoteSent(q1.id);

    expect(sent.status).toBe('sent');
    await expect(updateQuote(sent.id, { notes: 'changed' })).rejects.toThrow(/locked/i);
  });
});
