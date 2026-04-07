import { requireAdminContext, parseJsonBody, jsonError, jsonOk } from '@/lib/api/adminApi';
import { getSupabaseServiceRole } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function findAuthUserIdByEmail(supabase: ReturnType<typeof getSupabaseServiceRole>, email: string): Promise<string | null> {
  const needle = email.trim().toLowerCase();
  if (!needle) return null;

  const perPage = 200;
  // Supabase JS doesn't currently provide admin.getUserByEmail; page and scan.
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const match = users.find((u) => String(u.email ?? '').trim().toLowerCase() === needle);
    if (match?.id) return match.id;
    if (users.length < perPage) return null;
  }

  return null;
}

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.');
  }
  return getSupabaseServiceRole();
}

export async function POST(req: Request) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;

  const emailRaw = parsed.body?.email;
  const roleRaw = parsed.body?.role;
  const passwordRaw = parsed.body?.password;

  const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';
  const role = roleRaw === 'admin' || roleRaw === 'staff' ? roleRaw : '';
  const password = typeof passwordRaw === 'string' ? passwordRaw.trim() : '';

  if (!email) return jsonError('Email is required.', 400);
  if (!role) return jsonError('Role must be admin or staff.', 400);
  if (!password || password.length < 8) return jsonError('Password must be at least 8 characters.', 400);

  let supabase;
  try {
    supabase = getAdminClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Missing Supabase service role key.';
    return jsonError(message, 500);
  }

  let existingUserId: string | null = null;
  try {
    existingUserId = await findAuthUserIdByEmail(supabase, email);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to lookup user.';
    return jsonError(message, 500);
  }

  let userId: string | undefined;

  if (existingUserId) {
    userId = existingUserId;
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updateError) return jsonError(updateError.message ?? 'Failed to update user password.', 500);
  } else {
    const { data, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) return jsonError(createError.message ?? 'Failed to create user.', 500);
    userId = data.user?.id;
  }

  if (!userId) return jsonError('Supabase did not return a user id.', 500);

  const { error: upsertError } = await supabase
    .from('portal_users')
    .upsert({ user_id: userId, role }, { onConflict: 'user_id' });

  if (upsertError) return jsonError(upsertError.message ?? 'Failed to assign portal role.', 500);

  return jsonOk({
    ok: true,
    user_id: userId,
    email,
    role,
    existing: Boolean(existingUserId),
  });
}
