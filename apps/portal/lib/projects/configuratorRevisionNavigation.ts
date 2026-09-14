export function configuratorMarketingOrigin(): string {
  const url = new URL(process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.trim() || 'https://www.sanctuarypergolas.co.nz');
  const local = process.env.NODE_ENV !== 'production' && ['localhost','127.0.0.1'].includes(url.hostname);
  if ((!local && url.protocol !== 'https:') || url.username || url.password) throw new Error('Invalid marketing origin');
  return url.origin;
}

export function buildStaffConfiguratorEditUrl(origin: string, projectId: string, sourceEstimateId: string, design: unknown, returnOrigin?: string) {
  const url = new URL('/configurator-preview', origin);
  url.searchParams.set('open', '1');
  url.searchParams.set('staff_project', projectId);
  url.searchParams.set('staff_source', sourceEstimateId);
  if (returnOrigin) url.searchParams.set('staff_return_origin', returnOrigin);
  url.hash = `design=3~${encodeURIComponent(JSON.stringify(design))}`;
  return url.toString();
}

/** The same reviewed revision keeps its retry identity after refresh or a lost response. */
export function configuratorRevisionRequestId(preparationHash: string): string {
  if (!/^[0-9a-f]{64}$/i.test(preparationHash)) throw new Error('Invalid revision preparation');
  const value = preparationHash.slice(0, 32).toLowerCase();
  return `${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20,32)}`;
}
