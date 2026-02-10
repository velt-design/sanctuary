import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

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
  loadEnvFile(path.resolve(cwd, '.env.local'));
  loadEnvFile(path.resolve(cwd, '.env'));
}

loadEnvFromRepo();

function requiredEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'): string {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new Error(`${name} is not set. Add it to .env.local or your shell env.`);
}

const args = process.argv.slice(2);

function readFlag(flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

const email = readFlag('--email') ?? args[0] ?? '';
const role = readFlag('--role') ?? args[1] ?? '';
const password = readFlag('--password');

if (!email || !role) {
  console.error('Usage: tsx scripts/invite-portal-user.ts --email user@domain.com --role admin|staff [--password TEMP_PASSWORD]');
  process.exit(1);
}

if (role !== 'admin' && role !== 'staff') {
  console.error('Role must be "admin" or "staff".');
  process.exit(1);
}

const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function findUserIdByEmail(targetEmail: string): Promise<string | null> {
  const emailNeedle = targetEmail.trim().toLowerCase();
  if (!emailNeedle) return null;

  const perPage = 200;
  // Small portals typically have few users; this keeps the script simple and reliable.
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const match = users.find((u) => String(u.email ?? '').trim().toLowerCase() === emailNeedle);
    if (match?.id) return match.id;
    if (users.length < perPage) return null;
  }

  return null;
}

async function main() {
  let userId: string | undefined;

  if (password) {
    const existingUserId = await findUserIdByEmail(email);
    if (existingUserId) {
      const { data, error } = await supabase.auth.admin.updateUserById(existingUserId, {
        password,
        email_confirm: true,
      });
      if (error) throw error;
      userId = data.user?.id ?? existingUserId;
      console.log(`🔐 Updated password for existing user: ${email}`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;
      userId = data.user?.id;
      console.log(`👤 Created user with password: ${email}`);
    }
  } else {
    const existingUserId = await findUserIdByEmail(email);
    if (existingUserId) {
      userId = existingUserId;
      console.log(`ℹ️ User already exists: ${email}`);
      console.log('   No invite was sent. If they cannot sign in, re-run with --password to set a password.');
    } else {
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);
      if (error) throw error;
      userId = data.user?.id;
      console.log(`✉️ Invite sent: ${email} (check Supabase Auth email/SMTP settings).`);
    }
  }

  if (!userId) {
    throw new Error('Supabase did not return a user id.');
  }

  const { error: upsertError } = await supabase
    .from('portal_users')
    .upsert({ user_id: userId, role }, { onConflict: 'user_id' });

  if (upsertError) throw upsertError;

  console.log(`✅ Portal user ready: ${email} (${role})`);
  console.log(`   user_id: ${userId}`);
  if (!password) {
    console.log('   Invite email sent (check Supabase Auth settings / email provider).');
  }
}

main().catch((err) => {
  console.error('❌ Failed to invite portal user:', err?.message ?? err);
  process.exit(1);
});
