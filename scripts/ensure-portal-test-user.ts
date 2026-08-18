import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validatePortalTestSupabaseTarget } from './portal-test-supabase-target';

export type PortalTestProvisionTarget = 'local' | 'staging';
export type PortalTestRole = 'staff' | 'admin';

export interface PortalTestUserConfig {
  email: string;
  password: string;
  provisionTarget: PortalTestProvisionTarget;
  role: PortalTestRole;
  supabaseUrl: string;
  serviceRoleKey: string;
}

type PortalTestUserEnv = Partial<Record<string, string | undefined>>;

const REQUIRED_ENV = [
  'PORTAL_TEST_EMAIL',
  'PORTAL_TEST_PASSWORD',
  'PORTAL_TEST_PROVISION_TARGET',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const cleaned = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const eqIndex = cleaned.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = cleaned.slice(0, eqIndex).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = cleaned.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadEnvFromRepo() {
  const cwd = process.cwd();
  loadEnvFile(path.resolve(cwd, '.env.agent.local'));
  loadEnvFile(path.resolve(cwd, '.env.local'));
  loadEnvFile(path.resolve(cwd, '.env'));
}

function readRequiredEnv(env: PortalTestUserEnv, name: (typeof REQUIRED_ENV)[number]): string {
  const value = env[name];
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new Error(`${name} is required for portal test user provisioning.`);
}

export function readPortalTestUserConfig(env: PortalTestUserEnv = process.env): PortalTestUserConfig {
  const missing = REQUIRED_ENV.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required env for portal test user provisioning: ${missing.join(', ')}`);
  }

  const provisionTarget = readRequiredEnv(env, 'PORTAL_TEST_PROVISION_TARGET');
  if (provisionTarget === 'production') {
    throw new Error('PORTAL_TEST_PROVISION_TARGET=production is not allowed.');
  }
  if (provisionTarget !== 'local' && provisionTarget !== 'staging') {
    throw new Error('PORTAL_TEST_PROVISION_TARGET must be "local" or "staging".');
  }

  const role = env.PORTAL_TEST_ROLE?.trim() || 'staff';
  if (role !== 'staff' && role !== 'admin') {
    throw new Error('PORTAL_TEST_ROLE must be "staff" or "admin" when set.');
  }

  const supabaseUrl = readRequiredEnv(env, 'NEXT_PUBLIC_SUPABASE_URL');
  validatePortalTestSupabaseTarget({
    target: provisionTarget,
    supabaseUrl,
    stagingProjectRef: env.PORTAL_STAGING_SUPABASE_PROJECT_REF,
    productionProjectRef: env.PORTAL_PRODUCTION_SUPABASE_PROJECT_REF,
  });

  return {
    email: readRequiredEnv(env, 'PORTAL_TEST_EMAIL'),
    password: readRequiredEnv(env, 'PORTAL_TEST_PASSWORD'),
    provisionTarget,
    role,
    supabaseUrl,
    serviceRoleKey: readRequiredEnv(env, 'SUPABASE_SERVICE_ROLE_KEY'),
  };
}

export function redactPortalTestUserSecrets(message: unknown, config: Pick<PortalTestUserConfig, 'password' | 'serviceRoleKey'>): string {
  let text = typeof message === 'string' ? message : message instanceof Error ? message.message : String(message);
  for (const secret of [config.password, config.serviceRoleKey]) {
    if (!secret) continue;
    text = text.split(secret).join('[redacted]');
  }
  return text;
}

async function findUserIdByEmail(supabase: SupabaseClient, targetEmail: string): Promise<string | null> {
  const emailNeedle = targetEmail.trim().toLowerCase();
  const perPage = 200;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const match = users.find((user) => String(user.email ?? '').trim().toLowerCase() === emailNeedle);
    if (match?.id) return match.id;
    if (users.length < perPage) return null;
  }

  return null;
}

async function ensurePortalTestUser(config: PortalTestUserConfig) {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const existingUserId = await findUserIdByEmail(supabase, config.email);
  let userId = existingUserId ?? undefined;

  if (existingUserId) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUserId, {
      password: config.password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user?.id ?? existingUserId;
    console.log(`Updated existing portal test user auth: ${config.email}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: config.email,
      password: config.password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user?.id;
    console.log(`Created portal test user auth: ${config.email}`);
  }

  if (!userId) {
    throw new Error('Supabase did not return a user id for the portal test user.');
  }

  const { error: upsertError } = await supabase
    .from('portal_users')
    .upsert({ user_id: userId, role: config.role }, { onConflict: 'user_id' });

  if (upsertError) throw upsertError;

  console.log(`Portal test user ready: ${config.email} (${config.role}, ${config.provisionTarget})`);
  console.log(`user_id: ${userId}`);
}

async function main() {
  loadEnvFromRepo();
  const config = readPortalTestUserConfig();
  try {
    await ensurePortalTestUser(config);
  } catch (error) {
    console.error(`Failed to ensure portal test user: ${redactPortalTestUserSecrets(error, config)}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Failed to ensure portal test user: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
