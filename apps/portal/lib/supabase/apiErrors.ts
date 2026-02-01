type SupabaseLikeError = { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };

function toStr(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as SupabaseLikeError;
  const code = toStr(e?.code);
  const msg = toStr(e?.message);
  return code === '23505' || /duplicate key value/i.test(msg) || /unique constraint/i.test(msg);
}

export function isSchemaCacheError(error: unknown): boolean {
  const e = error as SupabaseLikeError;
  const code = toStr(e?.code);
  const msg = toStr(e?.message);
  return code === 'PGRST205' || /schema cache/i.test(msg) || /could not find the table/i.test(msg);
}

export function formatSupabaseError(table: string, error: unknown): { status: number; message: string } {
  const e = error as SupabaseLikeError;
  const msg = toStr(e?.message).trim();

  if (isUniqueViolation(error)) {
    return { status: 409, message: `A "${table}" record with that id already exists.` };
  }

  if (/permission denied/i.test(msg) || /not allowed/i.test(msg)) {
    return {
      status: 403,
      message:
        `Supabase permission error for "${table}". ` +
        `If you enabled RLS, use \`SUPABASE_SERVICE_ROLE_KEY\` on the server or add appropriate policies.`,
    };
  }

  return { status: 500, message: msg || 'Supabase request failed' };
}
