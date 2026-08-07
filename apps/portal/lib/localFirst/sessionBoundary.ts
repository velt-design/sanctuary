const LEGACY_UNSCOPED_CALCULATOR_SESSION_PREFIX = 'sanctuary-portal:calculator:draft:v1:';
const CALCULATOR_SESSION_STORAGE_PREFIX = 'sanctuary-portal:calculator:draft:v2:';

function removeStorageKeysWithPrefixes(
  prefixes: readonly string[],
  storage: Pick<Storage, 'length' | 'key' | 'removeItem'> | null,
): number {
  if (!storage) return 0;
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
  return keys.length;
}

export function calculatorSessionStorageKey(ownerId: string, legacyDraftKey: string): string {
  const normalizedOwner = ownerId.trim();
  if (!normalizedOwner) throw new Error('A portal user id is required for calculator session storage.');
  const suffix = legacyDraftKey.startsWith(LEGACY_UNSCOPED_CALCULATOR_SESSION_PREFIX)
    ? legacyDraftKey.slice(LEGACY_UNSCOPED_CALCULATOR_SESSION_PREFIX.length)
    : legacyDraftKey;
  return `${CALCULATOR_SESSION_STORAGE_PREFIX}${normalizedOwner}:${suffix}`;
}

export function clearLegacyUnscopedCalculatorSessionDrafts(
  storage: Pick<Storage, 'length' | 'key' | 'removeItem'> | null =
    typeof window === 'undefined' ? null : window.sessionStorage,
): number {
  return removeStorageKeysWithPrefixes([LEGACY_UNSCOPED_CALCULATOR_SESSION_PREFIX], storage);
}

export function clearCalculatorSessionDraftsForOwner(
  ownerId: string,
  storage: Pick<Storage, 'length' | 'key' | 'removeItem'> | null =
    typeof window === 'undefined' ? null : window.sessionStorage,
): number {
  const normalizedOwner = ownerId.trim();
  if (!normalizedOwner) return 0;
  return removeStorageKeysWithPrefixes(
    [`${CALCULATOR_SESSION_STORAGE_PREFIX}${normalizedOwner}:`],
    storage,
  );
}
