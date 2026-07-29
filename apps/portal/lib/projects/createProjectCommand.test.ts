import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectCreateRequest } from './createProjectContract';

const mocks = vi.hoisted(() => ({
  runEvent: vi.fn(),
  serviceFrom: vi.fn(),
}));

vi.mock('@/lib/automation/AutomationRunner', () => ({
  automationRunner: { runEvent: (...args: unknown[]) => mocks.runEvent(...args) },
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: { from: (...args: unknown[]) => mocks.serviceFrom(...args) },
}));

import {
  createProjectCommand,
  ProjectCreateCommandConflictError,
  ProjectCreateDuplicateContactsError,
  ProjectCreateRecoveryError,
} from './createProjectCommand';

const projectUuid = '11111111-1111-4111-8111-111111111111';
const contactUuid = '22222222-2222-4222-8222-222222222222';

const request: ProjectCreateRequest = {
  projectId: `proj_${projectUuid}`,
  projectName: 'Courtyard roof',
  quoteRef: 'Q-18',
  region: 'North',
  siteAddress: '12 Beach Road',
  contact: {
    kind: 'new',
    contactId: `ct_${contactUuid}`,
    displayName: 'Alex Mason',
    email: 'alex@example.com',
    phone: '021',
    allowDuplicate: false,
  },
};

const contactRow = {
  id: contactUuid,
  name: 'Alex Mason',
  email: 'alex@example.com',
  phone: '021',
  created_at: '2026-07-29T00:00:00.000Z',
  updated_at: '2026-07-29T00:00:00.000Z',
};

const projectRow = {
  id: projectUuid,
  contact_id: contactUuid,
  name: 'Courtyard roof',
  quote_ref: 'Q-18',
  region: 'North',
  site_address: '12 Beach Road',
  pipeline_stage: 'NEW',
  archived_at: null,
  created_at: '2026-07-29T00:00:00.000Z',
  updated_at: '2026-07-29T00:00:00.000Z',
};

function authClient(options: {
  duplicates?: unknown[];
  contactInsert?: { data: unknown; error: unknown };
  contactExisting?: { data: unknown; error: unknown };
  projectInsert?: { data: unknown; error: unknown };
  projectExisting?: { data: unknown; error: unknown };
} = {}) {
  const contactInsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue(options.contactInsert ?? { data: contactRow, error: null }),
    })),
  }));
  const contactSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue(options.contactExisting ?? { data: contactRow, error: null }),
    })),
  }));
  const projectInsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue(options.projectInsert ?? { data: projectRow, error: null }),
    })),
  }));
  const projectSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue(options.projectExisting ?? { data: projectRow, error: null }),
    })),
  }));
  const from = vi.fn((table: string) => {
    if (table === 'contacts') return { insert: contactInsert, select: contactSelect };
    if (table === 'projects') return { insert: projectInsert, select: projectSelect };
    throw new Error(`Unexpected table ${table}`);
  });
  const rpc = vi.fn().mockResolvedValue({ data: options.duplicates ?? [], error: null });
  return {
    client: { from, rpc } as any,
    contactInsert,
    projectInsert,
    rpc,
  };
}

function mockContactCleanup(options?: { linkedProjectSelectError?: unknown; contactDeleteError?: unknown }) {
  const linkedProjectSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      limit: vi.fn().mockResolvedValue({
        data: [],
        error: options?.linkedProjectSelectError ?? null,
      }),
    })),
  }));
  const contactDelete = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({
      data: null,
      error: options?.contactDeleteError ?? null,
    }),
  }));
  mocks.serviceFrom.mockImplementation((table: string) => {
    if (table === 'projects') return { select: linkedProjectSelect };
    if (table === 'contacts') return { delete: contactDelete };
    throw new Error(`Unexpected cleanup table ${table}`);
  });
  return { linkedProjectSelect, contactDelete };
}

describe('createProjectCommand', () => {
  beforeEach(() => {
    mocks.runEvent.mockReset();
    mocks.runEvent.mockResolvedValue(undefined);
    mocks.serviceFrom.mockReset();
  });

  it('saves a new contact and project before returning a durable receipt', async () => {
    const auth = authClient();

    const result = await createProjectCommand(auth.client, request);

    expect(auth.rpc).toHaveBeenCalledWith('staff_find_contact_duplicates_v1', {
      p_email: 'alex@example.com',
      p_phone: '021',
      p_exclude_contact_id: contactUuid,
    });
    expect(auth.contactInsert).toHaveBeenCalledTimes(1);
    expect(auth.projectInsert).toHaveBeenCalledTimes(1);
    expect(mocks.runEvent).toHaveBeenCalledWith({
      type: 'ui.action.project_created',
      projectId: projectUuid,
      stage: 'NEW',
      payload: { source: 'portal' },
    });
    expect(result).toMatchObject({
      project: { id: `proj_${projectUuid}`, contactId: `ct_${contactUuid}` },
      contact: { id: `ct_${contactUuid}`, displayName: 'Alex Mason' },
      receipt: {
        state: 'server_confirmed',
        replayed: false,
        createdContact: true,
        setupAutomation: 'confirmed',
      },
    });
  });

  it('returns strong duplicate candidates before writing either record', async () => {
    const duplicate = { ...contactRow, id: '33333333-3333-4333-8333-333333333333' };
    const auth = authClient({ duplicates: [duplicate] });

    await expect(createProjectCommand(auth.client, request))
      .rejects.toBeInstanceOf(ProjectCreateDuplicateContactsError);
    expect(auth.contactInsert).not.toHaveBeenCalled();
    expect(auth.projectInsert).not.toHaveBeenCalled();
    expect(mocks.runEvent).not.toHaveBeenCalled();
  });

  it('rejects a stable command ID that belongs to different contact details', async () => {
    const auth = authClient({
      contactInsert: { data: null, error: { code: '23505', message: 'duplicate key' } },
      contactExisting: { data: { ...contactRow, name: 'Different person' }, error: null },
    });

    await expect(createProjectCommand(auth.client, {
      ...request,
      contact: {
        kind: 'new',
        contactId: `ct_${contactUuid}`,
        displayName: 'Alex Mason',
        email: 'alex@example.com',
        phone: '021',
        allowDuplicate: true,
      },
    })).rejects.toBeInstanceOf(ProjectCreateCommandConflictError);
    expect(auth.projectInsert).not.toHaveBeenCalled();
    expect(mocks.runEvent).not.toHaveBeenCalled();
  });

  it('preserves the confirmed records and reports attention when setup automation fails', async () => {
    const auth = authClient();
    mocks.runEvent.mockRejectedValue(new Error('automation failed'));

    await expect(createProjectCommand(auth.client, request)).rejects.toMatchObject({
      name: 'ProjectCreateAutomationAttentionError',
      response: {
        project: { id: `proj_${projectUuid}` },
        receipt: {
          state: 'server_confirmed',
          setupAutomation: 'needs_attention',
        },
      },
    });
    expect(mocks.serviceFrom).not.toHaveBeenCalled();
  });

  it('requires administrator review when compensation cannot be verified', async () => {
    const auth = authClient({
      projectInsert: { data: null, error: { message: 'project insert failed' } },
      projectExisting: { data: null, error: null },
    });
    mockContactCleanup({ linkedProjectSelectError: { message: 'cleanup check failed' } });

    await expect(createProjectCommand(auth.client, request))
      .rejects.toBeInstanceOf(ProjectCreateRecoveryError);
  });

  it('removes an unused new contact after a definitively failed project write', async () => {
    const projectError = { message: 'project insert failed' };
    const auth = authClient({
      projectInsert: { data: null, error: projectError },
      projectExisting: { data: null, error: null },
    });
    const cleanup = mockContactCleanup();

    await expect(createProjectCommand(auth.client, request)).rejects.toBe(projectError);
    expect(cleanup.linkedProjectSelect).toHaveBeenCalledTimes(1);
    expect(cleanup.contactDelete).toHaveBeenCalledTimes(1);
    expect(mocks.runEvent).not.toHaveBeenCalled();
  });

  it('treats a matching stable-ID replay as confirmed without repeating automation', async () => {
    const existingRequest: ProjectCreateRequest = {
      ...request,
      contact: { kind: 'existing', contactId: `ct_${contactUuid}` },
    };
    const auth = authClient({
      projectInsert: { data: null, error: { code: '23505', message: 'duplicate key' } },
    });

    const result = await createProjectCommand(auth.client, existingRequest);

    expect(result.receipt).toMatchObject({
      state: 'server_confirmed',
      replayed: true,
      setupAutomation: 'not_rechecked',
    });
    expect(mocks.runEvent).not.toHaveBeenCalled();
  });
});
