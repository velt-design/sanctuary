export function isUuid(value: string): boolean {
  const v = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export function appIdFromUuid(prefix: string, uuid: string): string {
  return `${prefix}_${uuid}`;
}

export function uuidFromAppId(id: string, prefix?: string): string {
  const raw = id.trim();
  if (!raw) throw new Error('id is required');

  if (prefix) {
    const p = `${prefix}_`;
    if (raw.startsWith(p)) {
      const uuid = raw.slice(p.length);
      if (isUuid(uuid)) return uuid;
    }
  }

  if (isUuid(raw)) return raw;

  const maybeUuid = raw.split('_').at(-1) ?? '';
  if (isUuid(maybeUuid)) return maybeUuid;

  throw new Error('Invalid id format');
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

