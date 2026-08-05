import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { PublishedCostingConfigurationProvenanceV1 } from '@sp/costing/server';
import { parseSimpleCoverInput, type SimpleCoverInput } from './simpleCoverCalculator';
import type { FrozenSimpleCoverPricingResult } from './simpleCoverPricing.server';

const TOKEN_PREFIX = 'sc1.';
const TOKEN_MAX_LENGTH = 2_048;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const DOMAIN = 'sanctuary.simple-cover-calculation-ref.v1';
const LOCAL_FALLBACK_SECRET = 'local-only.simple-cover-calculation-ref.v1';
const EARLIEST_ISSUED_AT_SECONDS = 1_577_836_800; // 2020-01-01
const MAX_FUTURE_SKEW_SECONDS = 5 * 60;

export type SimpleCoverCalculationRefClaims = Readonly<{
  schemaVersion: 'simple-cover-calculation-ref.v1';
  input: SimpleCoverInput;
  costingConfiguration: PublishedCostingConfigurationProvenanceV1;
  issuedAt: number;
  frozenResultHash: string;
}>;

type SecretOptions = {
  /** Tests only. Production callers derive the key from the server environment. */
  secret?: string;
  nowMs?: number;
};

class SimpleCoverCalculationRefUnavailableError extends Error {
  readonly code = 'SIMPLE_COVER_CALCULATION_REF_UNAVAILABLE';

  constructor() {
    super('Simple cover calculation continuity is unavailable.');
    this.name = 'SimpleCoverCalculationRefUnavailableError';
  }
}

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Cannot hash a non-finite calculation value.');
    return value;
  }
  if (!value || typeof value !== 'object') return undefined;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalise(item)]),
  );
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalise(value));
}

export function hashFrozenSimpleCoverPricingResult(result: FrozenSimpleCoverPricingResult): string {
  return createHash('sha256').update(canonicalJson(result)).digest('hex');
}

function resolveSecret(explicitSecret?: string): string {
  const configured = explicitSecret?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  if (configured) return configured;
  if (process.env.NODE_ENV !== 'production') return LOCAL_FALLBACK_SECRET;
  throw new SimpleCoverCalculationRefUnavailableError();
}

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(DOMAIN).update('\0').update(secret).digest();
}

function validProvenance(value: unknown): PublishedCostingConfigurationProvenanceV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    item.schemaVersion !== 'costing-provenance.v1' ||
    item.source !== 'published' ||
    typeof item.versionId !== 'string' ||
    item.versionId.length < 1 ||
    item.versionId.length > 128 ||
    !Number.isSafeInteger(item.versionNumber) ||
    Number(item.versionNumber) < 1 ||
    typeof item.contentHash !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(item.contentHash) ||
    typeof item.baseManifestVersion !== 'string' ||
    item.baseManifestVersion.length < 1 ||
    item.baseManifestVersion.length > 64
  ) {
    return null;
  }
  return {
    schemaVersion: 'costing-provenance.v1',
    source: 'published',
    versionId: item.versionId,
    versionNumber: Number(item.versionNumber),
    contentHash: item.contentHash.toLowerCase(),
    baseManifestVersion: item.baseManifestVersion,
  };
}

function parseClaims(value: unknown, nowMs: number): SimpleCoverCalculationRefClaims | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const input = parseSimpleCoverInput(item.input);
  const costingConfiguration = validProvenance(item.costingConfiguration);
  const nowSeconds = Math.floor(nowMs / 1_000);
  if (
    item.schemaVersion !== 'simple-cover-calculation-ref.v1' ||
    !input ||
    !costingConfiguration ||
    !Number.isSafeInteger(item.issuedAt) ||
    Number(item.issuedAt) < EARLIEST_ISSUED_AT_SECONDS ||
    Number(item.issuedAt) > nowSeconds + MAX_FUTURE_SKEW_SECONDS ||
    typeof item.frozenResultHash !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(item.frozenResultHash)
  ) {
    return null;
  }
  return {
    schemaVersion: 'simple-cover-calculation-ref.v1',
    input,
    costingConfiguration,
    issuedAt: Number(item.issuedAt),
    frozenResultHash: item.frozenResultHash.toLowerCase(),
  };
}

export function issueSimpleCoverCalculationRef(
  result: FrozenSimpleCoverPricingResult,
  options: SecretOptions = {},
): string {
  const claims: SimpleCoverCalculationRefClaims = {
    schemaVersion: 'simple-cover-calculation-ref.v1',
    input: result.input,
    costingConfiguration: result.costingConfiguration,
    issuedAt: Math.floor((options.nowMs ?? Date.now()) / 1_000),
    frozenResultHash: hashFrozenSimpleCoverPricingResult(result),
  };
  const key = deriveKey(resolveSecret(options.secret));
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(DOMAIN));
  const encrypted = Buffer.concat([cipher.update(canonicalJson(claims), 'utf8'), cipher.final()]);
  const token = `${TOKEN_PREFIX}${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')}`;
  if (token.length > TOKEN_MAX_LENGTH) throw new SimpleCoverCalculationRefUnavailableError();
  return token;
}

export function readSimpleCoverCalculationRef(
  token: unknown,
  options: SecretOptions = {},
): SimpleCoverCalculationRefClaims | null {
  if (
    typeof token !== 'string' ||
    token.length <= TOKEN_PREFIX.length ||
    token.length > TOKEN_MAX_LENGTH ||
    !token.startsWith(TOKEN_PREFIX)
  ) {
    return null;
  }
  const encoded = token.slice(TOKEN_PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null;

  try {
    const bytes = Buffer.from(encoded, 'base64url');
    if (bytes.length <= IV_BYTES + AUTH_TAG_BYTES) return null;
    const iv = bytes.subarray(0, IV_BYTES);
    const authTag = bytes.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
    const ciphertext = bytes.subarray(IV_BYTES + AUTH_TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(resolveSecret(options.secret)), iv);
    decipher.setAAD(Buffer.from(DOMAIN));
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    if (Buffer.byteLength(plaintext, 'utf8') > TOKEN_MAX_LENGTH) return null;
    return parseClaims(JSON.parse(plaintext) as unknown, options.nowMs ?? Date.now());
  } catch {
    return null;
  }
}

export function frozenSimpleCoverHashesMatch(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}
