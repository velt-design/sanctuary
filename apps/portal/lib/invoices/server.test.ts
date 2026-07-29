import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => {
  const from = vi.fn();
  return {
    isProjectWorkModelV2: vi.fn(),
    from,
    supabaseServiceRole: { from },
  };
});

vi.mock('../projects/workItems/modelBoundary', () => ({
  isProjectWorkModelV2: dependencies.isProjectWorkModelV2,
}));

vi.mock('../supabaseClient', () => ({
  supabaseServiceRole: dependencies.supabaseServiceRole,
}));

import { clearInvoicePaidManualCheck } from './server';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function deleteQuery(error: { code?: string; message?: string } | null = null) {
  const builder: Record<string, any> = {};
  builder.delete = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: null, error }).then(resolve);
  return builder;
}

describe('invoice legacy task compatibility', () => {
  beforeEach(() => {
    dependencies.isProjectWorkModelV2.mockReset();
    dependencies.from.mockReset();
  });

  it('does not touch project_task_checks for a V2 project', async () => {
    dependencies.isProjectWorkModelV2.mockResolvedValue(true);

    await clearInvoicePaidManualCheck(PROJECT_ID);

    expect(dependencies.isProjectWorkModelV2).toHaveBeenCalledWith(
      dependencies.supabaseServiceRole,
      PROJECT_ID,
    );
    expect(dependencies.from).not.toHaveBeenCalled();
  });

  it('preserves the legacy invoice-paid mirror reset', async () => {
    const query = deleteQuery();
    dependencies.isProjectWorkModelV2.mockResolvedValue(false);
    dependencies.from.mockReturnValue(query);

    await clearInvoicePaidManualCheck(PROJECT_ID);

    expect(dependencies.from).toHaveBeenCalledWith('project_task_checks');
    expect(query.delete).toHaveBeenCalledOnce();
    expect(query.eq.mock.calls).toEqual([
      ['project_id', PROJECT_ID],
      ['task_key', 'invoice_paid'],
    ]);
  });
});
