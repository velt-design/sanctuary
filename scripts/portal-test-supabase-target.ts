export type PortalTestSupabaseTarget = 'local' | 'staging';

type PortalTestSupabaseTargetInput = {
  target: PortalTestSupabaseTarget;
  supabaseUrl: string;
  stagingProjectRef?: string;
  productionProjectRef?: string;
};

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;

function requiredProjectRef(value: string | undefined, name: string): string {
  const projectRef = value?.trim() ?? '';
  if (!PROJECT_REF_PATTERN.test(projectRef)) {
    throw new Error(`${name} must be an exact 20-character Supabase project reference.`);
  }
  return projectRef;
}

export function validatePortalTestSupabaseTarget(input: PortalTestSupabaseTargetInput): void {
  let url: URL;
  try {
    url = new URL(input.supabaseUrl);
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid URL.');
  }

  if (input.target === 'local') {
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
      throw new Error('A local portal test target requires an http://127.0.0.1 or http://localhost Supabase URL.');
    }
    return;
  }

  const stagingProjectRef = requiredProjectRef(
    input.stagingProjectRef,
    'PORTAL_STAGING_SUPABASE_PROJECT_REF',
  );
  const productionProjectRef = requiredProjectRef(
    input.productionProjectRef,
    'PORTAL_PRODUCTION_SUPABASE_PROJECT_REF',
  );
  if (stagingProjectRef === productionProjectRef) {
    throw new Error('The declared staging project reference matches the declared production project reference.');
  }

  const expectedOrigin = `https://${stagingProjectRef}.supabase.co`;
  if (url.origin !== expectedOrigin) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL does not exactly match the declared staging project reference.');
  }
  if (url.hostname === `${productionProjectRef}.supabase.co`) {
    throw new Error('The production Supabase project is a refusal target for portal test provisioning.');
  }
}
