import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { PublishedCostingConfigurationProvenanceV1 } from '@sp/costing/server';

export type CalculationRefOptions = { secret?: string; nowMs?: number };
type Codec = { domain: string; prefix: string; localSecret: string };
const MAX_LENGTH = 2048, IV_BYTES = 12, TAG_BYTES = 16;

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Cannot hash a non-finite calculation value.');
    return value;
  }
  if (!value || typeof value !== 'object') return undefined;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalise(item)]));
}
export function hashCalculationValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalise(value))).digest('hex');
}
export function calculationHashesMatch(left: string, right: string): boolean {
  return /^[a-f0-9]{64}$/i.test(left) && /^[a-f0-9]{64}$/i.test(right)
    && timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}
function key(codec: Codec, options: CalculationRefOptions) {
  const secret = options.secret?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || (process.env.NODE_ENV !== 'production' ? codec.localSecret : '');
  if (!secret) throw new Error('Calculation continuity is unavailable.');
  return createHash('sha256').update(codec.domain).update('\0').update(secret).digest();
}
export function sealCalculationRef(claims: unknown, codec: Codec, options: CalculationRefOptions = {}): string {
  const iv = randomBytes(IV_BYTES), cipher = createCipheriv('aes-256-gcm', key(codec, options), iv);
  cipher.setAAD(Buffer.from(codec.domain));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(canonicalise(claims)), 'utf8'), cipher.final()]);
  const token = codec.prefix + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
  if (token.length > MAX_LENGTH) throw new Error('Calculation reference is too large.');
  return token;
}
export function openCalculationRef(token: unknown, codec: Codec, options: CalculationRefOptions = {}): unknown {
  if (typeof token !== 'string' || token.length > MAX_LENGTH || !token.startsWith(codec.prefix)) return null;
  const encoded = token.slice(codec.prefix.length);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const bytes = Buffer.from(encoded, 'base64url');
    if (bytes.length <= IV_BYTES + TAG_BYTES || bytes.toString('base64url') !== encoded) return null;
    const decipher = createDecipheriv('aes-256-gcm', key(codec, options), bytes.subarray(0, IV_BYTES));
    decipher.setAAD(Buffer.from(codec.domain));
    decipher.setAuthTag(bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const plain = Buffer.concat([decipher.update(bytes.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
    return plain.length <= MAX_LENGTH ? JSON.parse(plain.toString('utf8')) : null;
  } catch { return null; }
}
export function validCalculationIssuedAt(value: unknown, nowMs: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1577836800 && Number(value) <= Math.floor(nowMs / 1000) + 300;
}
export function parsePublishedCalculationProvenance(value: unknown): PublishedCostingConfigurationProvenanceV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (item.schemaVersion !== 'costing-provenance.v1' || item.source !== 'published'
    || typeof item.versionId !== 'string' || !item.versionId.length || item.versionId.length > 128
    || !Number.isSafeInteger(item.versionNumber) || Number(item.versionNumber) < 1
    || typeof item.contentHash !== 'string' || !/^[a-f0-9]{64}$/i.test(item.contentHash)
    || typeof item.baseManifestVersion !== 'string' || !item.baseManifestVersion.length || item.baseManifestVersion.length > 64) return null;
  return { schemaVersion: 'costing-provenance.v1', source: 'published', versionId: item.versionId,
    versionNumber: Number(item.versionNumber), contentHash: item.contentHash.toLowerCase(), baseManifestVersion: item.baseManifestVersion };
}
