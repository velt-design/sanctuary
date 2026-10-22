import 'server-only';
import { z } from 'zod';

export const GA4_TRANSFER_PROJECT = 'prj_nrpZyDHk8RqDXHGax7gnvDlnO5t8';
export const GA4_TRANSFER_KEY = 'SANCTUARY_GA4_REFRESH_TOKEN';
const team = 'team_yTur5DT5THIdiLGLK1OVLA2V', owner = 'rGPHGaegAnst8s6Zl1VZswuH';
const entry = z.object({ id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_:-]+$/), key: z.string(), type: z.string(),
  target: z.array(z.string()), gitBranch: z.string().nullable().optional(), customEnvironmentIds: z.array(z.string()).optional() });
function productionSecret(value: z.infer<typeof entry>) {
  return value.type === 'sensitive' && value.target.length === 1 && value.target[0] === 'production'
    && !value.gitBranch && !value.customEnvironmentIds?.length;
}
export async function ga4TransferJson(body: ReadableStream<Uint8Array> | null, maximum: number): Promise<unknown> {
  if (!body) throw new Error('Transfer unavailable.');
  const reader = body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break;
    size += part.value.byteLength; if (size > maximum) throw new Error('Transfer unavailable.'); chunks.push(part.value);
  } } finally { await reader.cancel(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
/** Fixed destination. The transient operator token and refresh token never leave cloud memory. */
export function ga4TransferPlatform(token: string, signal: AbortSignal, current: () => Promise<void>, fetcher: typeof fetch) {
  const api = async (path: string, init?: RequestInit) => {
    await current(); signal.throwIfAborted();
    const response = await fetcher(`https://api.vercel.com${path}`, { ...init, signal, cache: 'no-store', redirect: 'error',
      headers: { authorization: `Bearer ${token}`, ...(init ? { 'content-type': 'application/json' } : {}) } });
    if (!response.ok) { await response.body?.cancel(); throw new Error('Transfer unavailable.'); }
    return ga4TransferJson(response.body, 262144);
  };
  const path = `/v10/projects/${GA4_TRANSFER_PROJECT}/env?teamId=${team}`;
  const entries = async () => z.object({ envs: z.array(entry) }).parse(await api(path)).envs.filter(value => value.key === GA4_TRANSFER_KEY);
  return {
    async authorize() {
      const user = z.object({ user: z.object({ id: z.string() }) }).parse(await api('/v2/user'));
      const project = z.object({ id: z.string(), accountId: z.string() }).parse(await api(`/v9/projects/${GA4_TRANSFER_PROJECT}?teamId=${team}`));
      if (user.user.id !== owner || project.id !== GA4_TRANSFER_PROJECT || project.accountId !== team) throw new Error('Transfer unavailable.');
      if ((await entries()).length) throw new Error('Transfer destination exists.');
    },
    async install(refreshToken: string) {
      // No upsert or retry. Even a failed acknowledgement may follow a successful write.
      if ((await entries()).length) throw new Error('Transfer destination exists.');
      const raw = await api(path, { method: 'POST', body: JSON.stringify({ key: GA4_TRANSFER_KEY, value: refreshToken,
        type: 'sensitive', target: ['production'] }) });
      const direct = entry.safeParse(raw);
      const batch = z.object({ created: z.union([entry, z.array(entry)]), failed: z.array(z.unknown()).optional() }).safeParse(raw);
      const values = direct.success ? [direct.data] : batch.success && !batch.data.failed?.length
        ? Array.isArray(batch.data.created) ? batch.data.created : [batch.data.created] : [];
      if (values.length !== 1 || values[0]?.key !== GA4_TRANSFER_KEY || !productionSecret(values[0])) throw new Error('Transfer unconfirmed.');
      const installed = await entries();
      if (installed.length !== 1 || installed[0]?.id !== values[0].id || !productionSecret(installed[0])) throw new Error('Transfer unconfirmed.');
      return values[0].id;
    },
  };
}
