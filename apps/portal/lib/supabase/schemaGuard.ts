type SupabaseLikeError = {
  code?: unknown;
  message?: unknown;
};

function toStr(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function missingSchemaFieldFromError(error: unknown): string | null {
  const e = error as SupabaseLikeError;
  const code = toStr(e?.code).trim();
  const message = toStr(e?.message);

  if (code === 'PGRST204') {
    const match = message.match(/'([^']+)' column/i);
    return match ? match[1] : null;
  }

  const pgMatch = message.match(/column\s+([a-z0-9_\\.]+)\s+does not exist/i);
  if (pgMatch) {
    const dotted = pgMatch[1] || '';
    return dotted.split('.').at(-1) ?? null;
  }

  return null;
}

export function isSupportedSchemaError(error: unknown): boolean {
  const e = error as SupabaseLikeError;
  const code = toStr(e?.code).trim();
  const message = toStr(e?.message).toLowerCase();

  if (code === 'PGRST204' || code === 'PGRST205' || code === '42703' || code === '42883') {
    return true;
  }

  return (
    message.includes('schema cache') ||
    message.includes('undefined column') ||
    message.includes('undefined function') ||
    message.includes('column') && message.includes('does not exist') ||
    message.includes('function') && message.includes('does not exist') ||
    message.includes('could not find the table')
  );
}

export function formatSupportedSchemaMessage(resource: string, error: unknown): string | null {
  if (!isSupportedSchemaError(error)) return null;

  const missingField = missingSchemaFieldFromError(error);
  if (missingField) {
    return `Unsupported database schema for "${resource}": missing required column "${missingField}". Apply the current portal schema.`;
  }

  const message = toStr((error as SupabaseLikeError)?.message).toLowerCase();
  if (message.includes('function') && message.includes('does not exist')) {
    return `Unsupported database schema for "${resource}": missing required database function. Apply the current portal schema.`;
  }

  if (message.includes('could not find the table')) {
    return `Unsupported database schema for "${resource}": missing required table. Apply the current portal schema.`;
  }

  return `Unsupported database schema for "${resource}". Apply the current portal schema.`;
}
