import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { readJson } from '@/lib/repo/storage';
import { upsertContact } from '@/lib/repo/contactsRepo';
import { upsertProject } from '@/lib/repo/projectsRepo';
import { SupabaseRepoError } from '@/lib/supabase/repoError';

const CONTACTS_KEY = 'sp_contacts_v1';
const PROJECTS_KEY = 'sp_projects_v1';
const MIGRATION_KEY = 'sp_supabase_contacts_projects_migrated_v1';

function coerceProjectForCreate(p: Project): Partial<Project> & { projectName: string } {
  const projectName = (p.projectName ?? p.name ?? '').trim() || 'Imported project';
  return {
    ...p,
    projectName,
    siteAddress: p.siteAddress ?? p.address,
    nextActionDate: (p as any).nextActionDate ?? (p as any).followUpDate ?? null,
    followUpDate: (p as any).followUpDate ?? (p as any).nextActionDate ?? null,
  };
}

export type SupabaseBootstrapResult =
  | { ok: true; migrated: boolean; detail?: 'empty' | 'pushed_local_then_cleared' | 'already_done' }
  | { ok: false; reason: 'server' | 'db_unreachable' | 'migration_failed' | 'schema_missing' };

export async function ensureSupabaseContactsProjectsBootstrapped(): Promise<SupabaseBootstrapResult> {
  if (typeof window === 'undefined') return { ok: false, reason: 'server' };

  if (window.localStorage.getItem(MIGRATION_KEY) === '1') return { ok: true, migrated: false, detail: 'already_done' };

  const contacts = readJson<Contact[]>(CONTACTS_KEY, []);
  const projects = readJson<Project[]>(PROJECTS_KEY, []);

  const contactsArr = Array.isArray(contacts) ? contacts : [];
  const projectsArr = Array.isArray(projects) ? projects : [];

  if (!contactsArr.length && !projectsArr.length) {
    window.localStorage.removeItem(CONTACTS_KEY);
    window.localStorage.removeItem(PROJECTS_KEY);
    window.localStorage.setItem(MIGRATION_KEY, '1');
    return { ok: true, migrated: false, detail: 'empty' };
  }

  try {
    for (const c of contactsArr) {
      if (!c?.id || !c.displayName) continue;
      await upsertContact(c);
    }

    for (const p of projectsArr) {
      if (!p?.id) continue;
      await upsertProject(coerceProjectForCreate(p) as Project);
    }
  } catch (err) {
    const isSchemaMissing = err instanceof SupabaseRepoError && /^PGRST/i.test(String(err.postgrestError?.code ?? ''));
    if (isSchemaMissing) return { ok: false, reason: 'schema_missing' };
    return { ok: false, reason: 'migration_failed' };
  }

  window.localStorage.removeItem(CONTACTS_KEY);
  window.localStorage.removeItem(PROJECTS_KEY);
  window.localStorage.setItem(MIGRATION_KEY, '1');
  return { ok: true, migrated: true, detail: 'pushed_local_then_cleared' };
}
