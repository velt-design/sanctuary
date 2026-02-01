function fallbackId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function newId(prefix?: string): string {
  const raw =
    typeof globalThis !== 'undefined' && 'crypto' in globalThis && typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : fallbackId();
  return prefix ? `${prefix}_${raw}` : raw;
}

