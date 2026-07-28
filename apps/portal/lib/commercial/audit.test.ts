import { beforeEach, describe, expect, it, vi } from 'vitest';

const insert = vi.fn();
const from = vi.fn(() => ({ insert }));

vi.mock('../supabaseClient', () => ({
  supabaseServiceRole: { from },
}));

describe('commercial audit writes', () => {
  beforeEach(() => {
    from.mockClear();
    insert.mockReset();
  });

  it('observes returned Supabase errors instead of relying on thrown errors', async () => {
    insert.mockResolvedValue({
      data: null,
      error: { code: 'XX000', message: 'write failed' },
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { insertCommercialAuditEvent } = await import('./audit');

    await expect(
      insertCommercialAuditEvent({
        projectId: 'project-1',
        type: 'quote.sent',
        idempotencyKey: 'quote.sent:intent-1',
      }),
    ).resolves.toBe('failed');
    expect(errorSpy).toHaveBeenCalledWith(
      '[commercial_audit] failed to insert',
      expect.objectContaining({ code: 'XX000' }),
    );
    errorSpy.mockRestore();
  });

  it('treats a repeated idempotency key as a successful replay boundary', async () => {
    insert.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });
    const { insertCommercialAuditEvent } = await import('./audit');

    await expect(
      insertCommercialAuditEvent({
        projectId: 'project-1',
        type: 'invoice.sent',
        idempotencyKey: 'invoice.sent:intent-1',
      }),
    ).resolves.toBe('duplicate');
  });

  it('reports a missing audit schema without failing the committed command', async () => {
    insert.mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'relation audit_events does not exist' },
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { insertCommercialAuditEvent } = await import('./audit');

    await expect(
      insertCommercialAuditEvent({
        projectId: 'project-1',
        type: 'quote.accepted',
        idempotencyKey: 'quote.accepted:qv-1',
      }),
    ).resolves.toBe('schema_unavailable');
    expect(errorSpy).toHaveBeenCalledWith(
      '[commercial_audit] schema unavailable',
      expect.objectContaining({ code: '42P01' }),
    );
    errorSpy.mockRestore();
  });
});
