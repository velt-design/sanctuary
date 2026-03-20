import { describe, expect, it } from 'vitest';
import { isMissingSchemaError } from './server';

describe('isMissingSchemaError', () => {
  it('treats PostgREST missing-column errors as missing schema', () => {
    expect(isMissingSchemaError({ code: 'PGRST204', message: "Could not find the 'foo' column" })).toBe(true);
  });

  it('treats PostgREST missing-table errors as missing schema', () => {
    expect(
      isMissingSchemaError({
        code: 'PGRST205',
        message: "Could not find the table 'public.job_pack_generations' in the schema cache",
      }),
    ).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isMissingSchemaError({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(false);
  });
});
