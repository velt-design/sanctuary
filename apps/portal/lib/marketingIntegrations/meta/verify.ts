import 'server-only';
import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { metaRead } from './transport';
import type { MetaConfig } from './config';
import type { Boundary } from './boundary';

export async function verifyMeta(config: MetaConfig, boundary: Boundary, fetcher: typeof fetch) {
  await boundary('identity_check', async () => {
    const response = await metaRead(fetcher, 'debug_token', new URLSearchParams({ input_token: config.token }), `${config.app}|${config.appSecret}`);
    const data = z.object({ data: z.object({ app_id: z.literal(config.app), user_id: z.literal(config.principal),
      type: z.literal('SYSTEM_USER'), is_valid: z.literal(true), scopes: z.array(z.string()).min(1),
      expires_at: z.number().int().nonnegative(), data_access_expires_at: z.number().int().nonnegative() }) }).parse(response.body).data;
    if (!data.scopes.includes('ads_read') || data.scopes.some(scope => !['ads_read', 'public_profile'].includes(scope))) throw new Error('Meta scope unavailable.');
    for (const expiry of [data.expires_at, data.data_access_expires_at]) if (expiry !== 0 && expiry * 1000 <= Date.now() + 60000) throw new Error('Meta credential unavailable.');
  });
  return boundary('account_read', async () => {
    const response = await metaRead(fetcher, `act_${config.account}`, new URLSearchParams({
      fields: 'id,account_id,account_status,currency,timezone_name',
      appsecret_proof: createHmac('sha256', config.appSecret).update(config.token).digest('hex'),
    }), config.token);
    const account = z.object({ id: z.literal(`act_${config.account}`), account_id: z.literal(config.account), account_status: z.literal(1),
      currency: z.string().regex(/^[A-Z]{3}$/), timezone_name: z.string().min(1).max(80) }).parse(response.body);
    new Intl.DateTimeFormat('en-CA', { timeZone: account.timezone_name }).format();
    return { timezone: account.timezone_name, currency: account.currency };
  });
}
