import 'server-only';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

const TTL_MS = 15 * 60_000;
const MAX_ENTRIES = 512;
type Binding = { projectId: string; providerMessageId: string; recipients: string[]; providerKey: string; secret: string };
type Entry = { expiresAt: number; ciphertext: Buffer; iv: Buffer; tag: Buffer; timer?: ReturnType<typeof setTimeout> };

/** Only encrypted, verified RFC message IDs are retained; never bodies or authorization. */
export function createVerifiedSendIdentityCache(now: () => number = Date.now) {
  const entries = new Map<string, Entry>();
  function remove(scope: string) {
    const entry = entries.get(scope);
    if (entry?.timer) clearTimeout(entry.timer);
    entries.delete(scope);
  }
  function keyFor(binding: Binding) {
    if (!/^[a-f0-9]{64}$/.test(binding.secret)) return null;
    const key = createHmac('sha256', Buffer.from(binding.secret, 'hex')).update('portal-send-identity-cache-v1').digest();
    const scope = createHmac('sha256', key).update(JSON.stringify([
      binding.projectId, binding.providerMessageId, [...new Set(binding.recipients.map(value => value.toLowerCase()))].sort(), binding.providerKey,
    ])).digest('hex');
    return { key, scope };
  }
  function prune() {
    for (const [scope, entry] of entries) if (entry.expiresAt <= now()) remove(scope);
  }
  return {
    get(binding: Binding): string | null {
      prune();
      const keys = keyFor(binding);
      if (!keys) return null;
      const entry = entries.get(keys.scope);
      if (!entry) return null;
      try {
        const decipher = createDecipheriv('aes-256-gcm', keys.key, entry.iv);
        decipher.setAAD(Buffer.from(`${keys.scope}:${entry.expiresAt}`));
        decipher.setAuthTag(entry.tag);
        return Buffer.concat([decipher.update(entry.ciphertext), decipher.final()]).toString('utf8');
      } catch { remove(keys.scope); return null; }
    },
    set(binding: Binding, internetMessageId: string) {
      const keys = keyFor(binding);
      if (!keys || internetMessageId.length > 998 || !/^<[^<>\s@]+@[^<>\s@]+>$/.test(internetMessageId)) return;
      prune();
      const expiresAt = now() + TTL_MS;
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', keys.key, iv);
      cipher.setAAD(Buffer.from(`${keys.scope}:${expiresAt}`));
      const ciphertext = Buffer.concat([cipher.update(internetMessageId, 'utf8'), cipher.final()]);
      remove(keys.scope);
      while (entries.size >= MAX_ENTRIES) remove(entries.keys().next().value!);
      const entry: Entry = { expiresAt, iv, ciphertext, tag: cipher.getAuthTag() };
      entries.set(keys.scope, entry);
      entry.timer = setTimeout(() => { if (entries.get(keys.scope) === entry) remove(keys.scope); }, TTL_MS);
      entry.timer.unref?.();
    },
  };
}

// A cold instance safely falls back to the provider. No disk, HTTP or Next data cache.
export const verifiedSendIdentityCache = createVerifiedSendIdentityCache();
