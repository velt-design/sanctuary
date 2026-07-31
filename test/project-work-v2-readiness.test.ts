import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  checkProjectWorkV2Readiness,
  evaluateProjectWorkV2Probe,
  readProjectWorkV2ReadinessConfig,
} from '../scripts/check-project-work-v2-readiness.mjs';

const STAGING_REF = 'abcdefghijklmnopqrst';
const PRODUCTION_REF = 'zyxwvutsrqponmlkjihg';
const validEnv = {
  PORTAL_PROJECT_WORK_V2_READINESS_TARGET: 'staging',
  PORTAL_PROJECT_WORK_V2_STAGING_PROJECT_REF: STAGING_REF,
  PORTAL_PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
  NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-test-key',
};

function deniedResponse(message = 'permission denied') {
  return new Response(
    JSON.stringify({
      code: '42501',
      message,
    }),
    {
      status: 401,
      headers: { 'content-type': 'application/json' },
    },
  );
}

describe('readProjectWorkV2ReadinessConfig', () => {
  it('accepts only an exact staging ref and matching hosted Supabase URL', () => {
    expect(readProjectWorkV2ReadinessConfig(validEnv)).toEqual({
      target: 'staging',
      projectRef: STAGING_REF,
      supabaseUrl: `https://${STAGING_REF}.supabase.co`,
      anonKey: 'anon-test-key',
    });
  });

  it.each([
    [{ ...validEnv, PORTAL_PROJECT_WORK_V2_READINESS_TARGET: 'production' }, /Production is not an allowed/],
    [{ ...validEnv, PORTAL_PROJECT_WORK_V2_READINESS_TARGET: 'local' }, /must be exactly "staging"/],
    [{ ...validEnv, PORTAL_PROJECT_WORK_V2_READINESS_TARGET: '' }, /Missing required environment value/],
    [{ ...validEnv, PORTAL_PROJECT_WORK_V2_STAGING_PROJECT_REF: '' }, /Missing required environment value/],
    [
      {
        ...validEnv,
        PORTAL_PRODUCTION_SUPABASE_PROJECT_REF: STAGING_REF,
      },
      /matches the declared production reference/,
    ],
    [
      {
        ...validEnv,
        NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co`,
      },
      /does not exactly match/,
    ],
    [
      {
        ...validEnv,
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      },
      /does not exactly match/,
    ],
  ])('rejects an unsafe or unknown target', (env, message) => {
    expect(() => readProjectWorkV2ReadinessConfig(env)).toThrow(message);
  });
});

describe('evaluateProjectWorkV2Probe', () => {
  it.each([
    [
      {
        id: 'marker',
        label: 'project_work_model_versions',
        migration: 'foundation',
        kind: 'table',
      },
      { status: 404, ok: false },
      { code: 'PGRST205' },
      'PROJECT_WORK_V2_MISSING_000002',
    ],
    [
      {
        id: 'relationships',
        label: 'project relationships',
        migration: 'schemaCache',
        kind: 'relationship',
      },
      { status: 400, ok: false },
      { code: 'PGRST200' },
      'PROJECT_WORK_V2_MISSING_000003',
    ],
    [
      {
        id: 'queue',
        label: 'project_work_queue_v3',
        migration: 'workQueue',
        kind: 'rpc',
      },
      { status: 404, ok: false },
      { code: 'PGRST202' },
      'PROJECT_WORK_V2_MISSING_000004',
    ],
    [
      {
        id: 'portfolio-index',
        label: 'staff_projects_index_v3',
        migration: 'pipelineAccountability',
        kind: 'rpc',
      },
      { status: 404, ok: false },
      { code: 'PGRST202' },
      'PROJECT_WORK_V2_MISSING_20260731000003',
    ],
    [
      {
        id: 'portfolio-ledger',
        label: 'project_work_portfolio_rollouts',
        migration: 'portfolio',
        kind: 'table',
      },
      { status: 404, ok: false },
      { code: 'PGRST205' },
      'PROJECT_WORK_V2_MISSING_20260731000002',
    ],
  ])('maps a missing contract to its exact migration', (probe, response, payload, expectedCode) => {
    expect(() => evaluateProjectWorkV2Probe(probe, response, payload)).toThrow(
      expect.objectContaining({ code: expectedCode }),
    );
  });

  it('accepts a present contract only when anonymous access is denied', () => {
    expect(
      evaluateProjectWorkV2Probe(
        {
          id: 'queue',
          label: 'project_work_queue_v3',
          migration: 'workQueue',
          kind: 'rpc',
        },
        { status: 401, ok: false },
        { code: '42501', message: 'staff access required' },
      ),
    ).toEqual({
      id: 'queue',
      status: 'present-and-anonymous-denied',
    });
  });

  it('fails closed when anonymous access unexpectedly succeeds', () => {
    expect(() =>
      evaluateProjectWorkV2Probe(
        {
          id: 'queue',
          label: 'project_work_queue_v3',
          migration: 'workQueue',
          kind: 'rpc',
        },
        { status: 200, ok: true },
        {},
      ),
    ).toThrow(expect.objectContaining({ code: 'PROJECT_WORK_V2_SECURITY_FAILURE' }));
  });

  it('does not mistake an invalid key or unrelated denial for readiness', () => {
    expect(() =>
      evaluateProjectWorkV2Probe(
        {
          id: 'queue',
          label: 'project_work_queue_v3',
          migration: 'workQueue',
          kind: 'rpc',
        },
        { status: 401, ok: false },
        { code: 'PGRST301', message: 'JWT expired' },
      ),
    ).toThrow(expect.objectContaining({ code: 'PROJECT_WORK_V2_PROBE_FAILED' }));
  });
});

describe('checkProjectWorkV2Readiness', () => {
  it('keeps the checker free of service-role and mutation methods', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'scripts/check-project-work-v2-readiness.mjs'),
      'utf8',
    );

    expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(source).not.toMatch(/method:\s*['"](?:PUT|PATCH|DELETE)['"]/);
    expect(source).not.toContain('/migrate');
    expect(source).not.toContain('project_work_classify_legacy_contacted_v1');
    expect(source).not.toContain('project_work_migrate_legacy_contacted_v1');
  });

  it('runs only bounded read/schema probes with the anon key', async () => {
    const fetchMock = vi.fn(async () => deniedResponse());

    await expect(
      checkProjectWorkV2Readiness(
        readProjectWorkV2ReadinessConfig(validEnv),
        fetchMock,
      ),
    ).resolves.toHaveLength(7);

    expect(fetchMock).toHaveBeenCalledTimes(7);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toMatch(/^https:\/\/abcdefghijklmnopqrst\.supabase\.co\/rest\/v1\//);
      expect(init.headers).toMatchObject({
        apikey: 'anon-test-key',
        authorization: 'Bearer anon-test-key',
      });
      expect(init.method === 'GET' || init.method === 'POST').toBe(true);
    }

    const getCalls = fetchMock.mock.calls.filter(([, init]) => init.method === 'GET');
    expect(getCalls).toHaveLength(4);
    expect(getCalls.every(([url]) => String(url).includes('limit=0'))).toBe(true);

    const postCalls = fetchMock.mock.calls.filter(([, init]) => init.method === 'POST');
    expect(postCalls).toHaveLength(3);
    expect(postCalls.map(([url]) => String(url))).toEqual([
      expect.stringContaining('/rpc/project_work_queue_v3'),
      expect.stringContaining('/rpc/staff_projects_index_v3'),
      expect.stringContaining('/rpc/staff_project_state_counts_v1'),
    ]);
    expect(JSON.parse(String(postCalls[1]?.[1].body))).toEqual({
      p_archive: 'all',
      p_search: '',
      p_status: 'all',
      p_due: 'all',
      p_today: '2026-01-01',
      p_page: 1,
      p_page_size: 1,
      p_sort: 'newest',
      p_state: 'all',
      p_stages: null,
      p_owner: 'all',
    });
    expect(JSON.parse(String(postCalls[2]?.[1].body))).toEqual({});
  });

  it('stops at the first missing migration', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(deniedResponse())
      .mockResolvedValueOnce(deniedResponse())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'PGRST200', message: 'relationship missing' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      );

    await expect(
      checkProjectWorkV2Readiness(
        readProjectWorkV2ReadinessConfig(validEnv),
        fetchMock,
      ),
    ).rejects.toMatchObject({
      code: 'PROJECT_WORK_V2_MISSING_000003',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fails if the current portfolio index contract is absent', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(deniedResponse())
      .mockResolvedValueOnce(deniedResponse())
      .mockResolvedValueOnce(deniedResponse())
      .mockResolvedValueOnce(deniedResponse())
      .mockResolvedValueOnce(deniedResponse())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'PGRST202', message: 'RPC missing' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      );

    await expect(
      checkProjectWorkV2Readiness(
        readProjectWorkV2ReadinessConfig(validEnv),
        fetchMock,
      ),
    ).rejects.toMatchObject({
      code: 'PROJECT_WORK_V2_MISSING_20260731000003',
      details: [
        expect.stringContaining(
          '20260731000003_project_pipeline_accountability_reads.sql',
        ),
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});
