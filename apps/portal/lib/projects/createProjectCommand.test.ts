import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectCreateRequest } from './createProjectContract';

const mocks = vi.hoisted(() => ({
  serviceFrom: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: { from: (...args: unknown[]) => mocks.serviceFrom(...args) },
}));

import {
  createProjectCommand,
  ProjectCreateCommandConflictError,
  ProjectCreateDuplicateContactsError,
  ProjectCreateRecoveryError,
  ProjectCreateSchemaError,
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
  duplicateError?: unknown;
  contactInsert?: { data: unknown; error: unknown };
  contactExisting?: { data: unknown; error: unknown };
  projectRpc?: { data: unknown; error: unknown };
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
  const from = vi.fn((table: string) => {
    if (table === 'contacts') return { insert: contactInsert, select: contactSelect };
    throw new Error(`Unexpected direct table ${table}`);
  });
  const projectCreate = vi.fn().mockResolvedValue(options.projectRpc ?? {
    data: { project: projectRow, replayed: false },
    error: null,
  });
  const rpc = vi.fn((name: string, payload: unknown) => {
    if (name === 'staff_find_contact_duplicates_v1') {
      return Promise.resolve({
        data: options.duplicates ?? [],
        error: options.duplicateError ?? null,
      });
    }
    if (name === 'project_create_v2') return projectCreate(payload);
    throw new Error(`Unexpected RPC ${name}`);
  });
  return {
    client: { from, rpc } as any,
    contactInsert,
    from,
    projectCreate,
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

function projectCreateCallCount(rpc: ReturnType<typeof vi.fn>): number {
  return rpc.mock.calls.filter(([name]) => name === 'project_create_v2').length;
}

describe('createProjectCommand', () => {
  beforeEach(() => {
    mocks.serviceFrom.mockReset();
  });

  it('creates the project and its V2 cadence through one authenticated RPC', async () => {
    const auth = authClient();

    const result = await createProjectCommand(auth.client, request);

    expect(auth.rpc).toHaveBeenCalledWith('staff_find_contact_duplicates_v1', {
      p_email: 'alex@example.com',
      p_phone: '021',
      p_exclude_contact_id: contactUuid,
    });
    expect(auth.rpc).toHaveBeenCalledWith('project_create_v2', {
      p_project_id: projectUuid,
      p_contact_id: contactUuid,
      p_name: 'Courtyard roof',
      p_quote_ref: 'Q-18',
      p_region: 'North',
      p_site_address: '12 Beach Road',
    });
    expect(auth.contactInsert).toHaveBeenCalledTimes(1);
    expect(auth.from).not.toHaveBeenCalledWith('projects');
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
    expect(projectCreateCallCount(auth.rpc)).toBe(0);
  });

  it('rejects a stable contact ID that belongs to different details', async () => {
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
    expect(projectCreateCallCount(auth.rpc)).toBe(0);
  });

  it('maps a missing V2 RPC to schema unavailable and removes an unused new contact', async () => {
    const auth = authClient({
      projectRpc: {
        data: null,
        error: { code: 'PGRST202', message: 'Could not find project_create_v2 in the schema cache' },
      },
    });
    const cleanup = mockContactCleanup();

    await expect(createProjectCommand(auth.client, request))
      .rejects.toBeInstanceOf(ProjectCreateSchemaError);
    expect(cleanup.linkedProjectSelect).toHaveBeenCalledTimes(1);
    expect(cleanup.contactDelete).toHaveBeenCalledTimes(1);
  });

  it('maps the RPC stable-ID mismatch to a command conflict', async () => {
    const auth = authClient({
      projectRpc: {
        data: null,
        error: {
          code: '40001',
          message: 'PROJECT_CREATION_COMMAND_CONFLICT: project id is already used for different details',
        },
      },
    });
    const cleanup = mockContactCleanup();

    await expect(createProjectCommand(auth.client, request))
      .rejects.toBeInstanceOf(ProjectCreateCommandConflictError);
    expect(cleanup.contactDelete).toHaveBeenCalledTimes(1);
  });

  it('removes an unused new contact after a definitive RPC failure', async () => {
    const projectError = { code: '22023', message: 'project creation rejected' };
    const auth = authClient({
      projectRpc: { data: null, error: projectError },
    });
    const cleanup = mockContactCleanup();

    await expect(createProjectCommand(auth.client, request)).rejects.toBe(projectError);
    expect(cleanup.linkedProjectSelect).toHaveBeenCalledTimes(1);
    expect(cleanup.contactDelete).toHaveBeenCalledTimes(1);
  });

  it('requires administrator review when compensation cannot be verified', async () => {
    const auth = authClient({
      projectRpc: {
        data: null,
        error: { code: '22023', message: 'project creation rejected' },
      },
    });
    mockContactCleanup({ linkedProjectSelectError: { message: 'cleanup check failed' } });

    await expect(createProjectCommand(auth.client, request))
      .rejects.toBeInstanceOf(ProjectCreateRecoveryError);
  });

  it('returns a matching stable-ID replay without invoking legacy automation', async () => {
    const existingRequest: ProjectCreateRequest = {
      ...request,
      contact: { kind: 'existing', contactId: `ct_${contactUuid}` },
    };
    const auth = authClient({
      projectRpc: {
        data: [{ project: projectRow, replayed: true }],
        error: null,
      },
    });

    const result = await createProjectCommand(auth.client, existingRequest);

    expect(result.receipt).toMatchObject({
      state: 'server_confirmed',
      replayed: true,
      createdContact: false,
      setupAutomation: 'not_rechecked',
    });
    expect(auth.projectCreate).toHaveBeenCalledTimes(1);
    expect(auth.from).not.toHaveBeenCalledWith('projects');
  });

  it('does not trust a malformed successful RPC result', async () => {
    const auth = authClient({
      projectRpc: { data: { replayed: false }, error: null },
    });
    mockContactCleanup();

    await expect(createProjectCommand(auth.client, request))
      .rejects.toBeInstanceOf(ProjectCreateRecoveryError);
  });
});
