import 'server-only';
import { cookies } from 'next/headers';
import { config, unseal } from './security';

export async function discoveredOrganisations(userId: string): Promise<Array<{tenantId:string;tenantName:string}>> {
  try {
    const cfg=config();
    if (cfg.tenantId) return [];
    const jar=await cookies();
    const value=unseal<{userId:string;expires:number;organisations:Array<{tenantId:string;tenantName:string}>}>(jar.get('__Host-xero-organisations')?.value ?? '',cfg.key);
    if(value.userId!==userId || !Number.isFinite(value.expires) || value.expires<Date.now()) return [];
    return value.organisations;
  } catch { return []; }
}
