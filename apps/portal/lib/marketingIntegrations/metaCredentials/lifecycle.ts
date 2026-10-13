import { z } from 'zod';
import { fingerprint, type MetaCredentialConfig } from './config';
import type { MetaVault, SavedMetaCredential } from './vault';
import type { CredentialCommand } from './store';
import type { MetaCredentialProvider } from './provider';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const leaseSchema = z.object({ operation: z.uuid(), state: z.enum(['READY','EXCHANGE_PENDING','VAULT_PENDING']),
  tokenHash: hash, vaultVersion: z.number().int().positive(), expiresAt: z.string().nullable(), dataAccessExpiresAt: z.string().nullable(),
  candidateHash: hash.nullable(), candidateExpiresAt: z.string().nullable(), candidateDataAccessExpiresAt: z.string().nullable(),
  candidateVaultVersion: z.number().int().positive().nullable() });
type Dependencies = { config: MetaCredentialConfig; vault: MetaVault; provider: MetaCredentialProvider; command: CredentialCommand; signal: AbortSignal; authorize?: () => Promise<void> };
const stampEqual = (a: string | null, b: string | null) => a === null || b === null ? a === b : Date.parse(a) === Date.parse(b);
function matches(value: SavedMetaCredential, tokenHash: string, expiry: string | null, dataExpiry: string | null) {
  return fingerprint(value.accessToken) === tokenHash && stampEqual(value.expiresAt, expiry) && stampEqual(value.dataAccessExpiresAt, dataExpiry);
}
/** Every external effect is fenced by the durable source lease. Secrets stay in the vault and memory. */
type CredentialUse = { token: string; expiresAt: string | null; check(): Promise<void>; finish(): Promise<void> };
export function metaCredentialSession(deps: Dependencies, purpose: 'use'): Promise<CredentialUse>;
// eslint-disable-next-line no-redeclare -- TypeScript overload, not a second runtime declaration.
export function metaCredentialSession(deps: Dependencies, purpose: 'renew' | 'reconcile'): Promise<{ renewed: boolean }>;
// eslint-disable-next-line no-redeclare -- Implementation of the two purpose-specific overloads.
export async function metaCredentialSession(deps: Dependencies, purpose: 'use' | 'renew' | 'reconcile'): Promise<CredentialUse | { renewed: boolean }> {
  if (purpose !== 'use' && !deps.config.renewalEnabled) throw new Error('Meta credential maintenance disabled');
  const raw = await deps.command('begin', { purpose, identity: deps.config.identity });
  if (purpose === 'renew' && z.object({ skip: z.literal(true) }).strict().safeParse(raw).success) return { renewed: false };
  const lease = leaseSchema.parse(raw);
  const command = (action: string, input: Record<string, unknown> = {}) => deps.command(action, input, lease.operation);
  const check = async () => { deps.signal.throwIfAborted(); await deps.authorize?.(); await command('check'); };
  let finished = false;
  let replacementReturned = false;
  const finish = async () => { if (!finished) { await command('finish'); finished = true; } };
  try {
    await check(); const saved = await deps.vault.read(); await check();
    const isOld = saved.version === lease.vaultVersion && matches(saved.credential, lease.tokenHash, lease.expiresAt, lease.dataAccessExpiresAt);
    if (purpose === 'reconcile') {
      const isCandidate = lease.state === 'VAULT_PENDING' && lease.candidateHash && lease.candidateExpiresAt
        && lease.candidateVaultVersion === lease.vaultVersion
        && saved.version > lease.vaultVersion && matches(saved.credential, lease.candidateHash, lease.candidateExpiresAt, lease.candidateDataAccessExpiresAt);
      if (!isCandidate && !(lease.state === 'EXCHANGE_PENDING' && isOld)) throw new Error('Meta credential reconciliation requires review');
      const verified = await deps.provider.verify(saved.credential.accessToken, check); await check();
      if (!stampEqual(verified.expiresAt, saved.credential.expiresAt) || !stampEqual(verified.dataAccessExpiresAt, saved.credential.dataAccessExpiresAt)) throw new Error('Meta credential metadata changed');
      await command(isCandidate ? 'activate' : 'exchange_reconciled', { vaultVersion: saved.version }); await finish();
      return { renewed: Boolean(isCandidate) };
    }
    if (!isOld || (saved.credential.expiresAt !== null && Date.parse(saved.credential.expiresAt) <= Date.now() + 60000)) throw new Error('Meta vault revision changed');
    const verified = await deps.provider.verify(saved.credential.accessToken, check); await check();
    if (!stampEqual(verified.expiresAt, saved.credential.expiresAt) || !stampEqual(verified.dataAccessExpiresAt, saved.credential.dataAccessExpiresAt)) throw new Error('Meta credential expiry changed');
    if (purpose === 'use') return { token: saved.credential.accessToken, expiresAt: saved.credential.expiresAt, check, finish };
    if (saved.credential.expiresAt === null) throw new Error('Nonexpiring token must not be exchanged');
    await command('exchange_pending');
    const token = await deps.provider.refresh(saved.credential.accessToken, check); replacementReturned = true; await check();
    const next = await deps.provider.verify(token, check); await check();
    if (next.expiresAt === null || Date.parse(next.expiresAt) <= Date.parse(saved.credential.expiresAt) || Date.parse(next.expiresAt) > Date.now() + 61 * 86400000)
      throw new Error('Meta renewal did not extend the verified token');
    const candidate: SavedMetaCredential = { version: 1, binding: deps.config.binding, accessToken: token, ...next };
    await command('vault_pending', { tokenHash: fingerprint(token), ...next });
    replacementReturned = false; // From here the recorded candidate, including uncertain put, owns recovery.
    await check(); const written = await deps.vault.write(candidate); await check();
    await command('activate', { vaultVersion: written.version }); await finish(); return { renewed: true };
  } catch {
    if (replacementReturned) await command('quarantine').catch(() => undefined);
    // Pending effects remain pending in SQL even after the operation is closed.
    await command('failed').catch(() => undefined);
    throw new Error('Meta credential connection requires review');
  }
}
