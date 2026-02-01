'use client';

import { useEffect } from 'react';
import { ensureSupabaseContactsProjectsBootstrapped } from '@/lib/repo/supabaseBootstrap';
import { useToast } from '@/components/ui/toast/ToastProvider';

export default function DbGate() {
  const toast = useToast();

  useEffect(() => {
    const SUPABASE_TOAST_KEY = 'sp_supabase_bootstrap_toast_v1';
    let cancelled = false;

    void (async () => {
      try {
        const supa = await ensureSupabaseContactsProjectsBootstrapped();
        if (cancelled) return;
        if (supa.ok && supa.migrated) {
          if (typeof window !== 'undefined' && window.sessionStorage.getItem(SUPABASE_TOAST_KEY) !== '1') {
            window.sessionStorage.setItem(SUPABASE_TOAST_KEY, '1');
            toast.success('Migrated local contacts/projects into Supabase.');
          }
        } else if (!supa.ok && (supa.reason === 'db_unreachable' || supa.reason === 'migration_failed' || supa.reason === 'schema_missing')) {
          if (typeof window !== 'undefined' && window.sessionStorage.getItem(SUPABASE_TOAST_KEY) !== '1') {
            window.sessionStorage.setItem(SUPABASE_TOAST_KEY, '1');
            if (supa.reason === 'schema_missing') {
              toast.error('Supabase schema not ready. Run `supabase/contacts_projects.sql` in Supabase, then refresh.');
            } else {
              toast.info('Supabase unavailable; contacts/projects may not load until it is back.');
            }
          }
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to initialize Supabase.';
        if (typeof window !== 'undefined' && window.sessionStorage.getItem(SUPABASE_TOAST_KEY) !== '1') {
          window.sessionStorage.setItem(SUPABASE_TOAST_KEY, '1');
          toast.error(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  return null;
}
