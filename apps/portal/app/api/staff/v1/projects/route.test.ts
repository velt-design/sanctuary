import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Contact } from '@/lib/types/contact';

const requireStaffContext = vi.fn();
const createProjectCommand = vi.fn();

vi.mock('@/lib/api/staffApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/staffApi')>();
  return { ...actual, requireStaffContext };
});

vi.mock('@/lib/projects/createProjectCommand', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/projects/createProjectCommand')>();
  return { ...actual, createProjectCommand };
});

const body = {
  projectId: 'proj_11111111-1111-4111-8111-111111111111',
  projectName: 'Courtyard roof',
  quoteRef: '',
  region: '',
  siteAddress: '',
  contact: {
    kind: 'existing',
    contactId: 'ct_22222222-2222-4222-8222-222222222222',
  },
};

const duplicate: Contact = {
  id: 'ct_33333333-3333-4333-8333-333333333333',
  displayName: 'Alex Mason',
  email: 'alex@example.com',
  phone: '021',
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
};

function request(payload: unknown = body) {
  return new Request('http://localhost/api/staff/v1/projects', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'req_project_create',
    },
    body: JSON.stringify(payload),
  });
}

describe('POST /api/staff/v1/projects', () => {
  beforeEach(() => {
    requireStaffContext.mockReset();
    createProjectCommand.mockReset();
    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user-1' }, role: 'staff' },
      supabase: { from: vi.fn(), rpc: vi.fn() },
    });
    createProjectCommand.mockResolvedValue({
      project: { id: body.projectId, projectName: body.projectName, status: 'NEW' },
      contact: duplicate,
      receipt: {
        state: 'server_confirmed',
        confirmedAt: '2026-07-29T00:00:00.000Z',
        replayed: false,
        createdContact: false,
        setupAutomation: 'confirmed',
      },
    });
  });

  it('returns a server-confirmed receipt with diagnostics', async () => {
    const mod = await import('./route');
    const response = await mod.POST(request());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-portal-request-id')).toBe('req_project_create');
    expect(createProjectCommand).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ projectId: body.projectId, contact: body.contact }),
    );
    await expect(response.json()).resolves.toMatchObject({
      project: { id: body.projectId },
      receipt: { state: 'server_confirmed' },
    });
  });

  it('returns duplicate candidates without treating them as a server failure', async () => {
    const { ProjectCreateDuplicateContactsError } = await import('@/lib/projects/createProjectCommand');
    createProjectCommand.mockRejectedValue(new ProjectCreateDuplicateContactsError([duplicate]));
    const mod = await import('./route');
    const response = await mod.POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'A contact with the same email or phone already exists.',
      code: 'CONTACT_DUPLICATE_CANDIDATES',
      candidates: [duplicate],
    });
  });

  it('marks unverifiable compensation as unsafe to retry', async () => {
    const { ProjectCreateRecoveryError } = await import('@/lib/projects/createProjectCommand');
    createProjectCommand.mockRejectedValue(new ProjectCreateRecoveryError());
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mod = await import('./route');
    const response = await mod.POST(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Project creation could not be confirmed. Do not retry; ask a portal administrator to reconcile this request.',
      code: 'PROJECT_CREATION_REVIEW_REQUIRED',
    });
    errorSpy.mockRestore();
  });

  it('marks a reused command ID as a form conflict rather than retry-safe', async () => {
    const { ProjectCreateCommandConflictError } = await import('@/lib/projects/createProjectCommand');
    createProjectCommand.mockRejectedValue(new ProjectCreateCommandConflictError());
    const mod = await import('./route');
    const response = await mod.POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'This creation request ID is already used for different details. Reload the form before trying again.',
      code: 'PROJECT_CREATION_COMMAND_CONFLICT',
    });
  });

  it('returns the saved project with an attention receipt when setup automation fails', async () => {
    const { ProjectCreateAutomationAttentionError } = await import('@/lib/projects/createProjectCommand');
    const savedResponse = {
      project: { id: body.projectId, projectName: body.projectName, status: 'NEW' },
      contact: duplicate,
      receipt: {
        state: 'server_confirmed' as const,
        confirmedAt: '2026-07-29T00:00:00.000Z',
        replayed: false,
        createdContact: false,
        setupAutomation: 'needs_attention' as const,
      },
    };
    createProjectCommand.mockRejectedValue(
      new ProjectCreateAutomationAttentionError(savedResponse as never, new Error('automation failed')),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mod = await import('./route');
    const response = await mod.POST(request());

    expect(response.status).toBe(202);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toMatchObject({
      project: { id: body.projectId },
      receipt: {
        state: 'server_confirmed',
        setupAutomation: 'needs_attention',
      },
    });
    errorSpy.mockRestore();
  });

  it('rejects invalid command IDs before any write', async () => {
    const mod = await import('./route');
    const response = await mod.POST(request({ ...body, projectId: 'proj_bad' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Project command ID is invalid' });
    expect(createProjectCommand).not.toHaveBeenCalled();
  });
});
