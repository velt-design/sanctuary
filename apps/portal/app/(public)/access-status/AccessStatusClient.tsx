'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import PublicAuthShell from '@/components/page-state/PublicAuthShell';
import styles from '@/components/page-state/PageState.module.css';
import { getSupabaseBrowser } from '@/lib/supabase/browserClient';
import type { AccessStatusQueryState } from '@/lib/portalAccess';

export default function AccessStatusClient({
  state,
  callbackUrl,
}: {
  state: AccessStatusQueryState;
  callbackUrl: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (state === 'no-access') {
    return (
      <PublicAuthShell
        eyebrow="Portal Access"
        title="Access not assigned"
        description="Your account is signed in, but it does not have an active Sanctuary Portal role yet."
      >
        <p className={styles.publicNote}>
          Ask an administrator to assign your portal access, then sign in again. If you were expecting access already, contact the person who manages portal permissions.
        </p>
        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={() => {
              void signOut();
            }}
          >
            Sign out
          </button>
        </div>
      </PublicAuthShell>
    );
  }

  return (
    <PublicAuthShell
      eyebrow="Portal Access"
      title="Access check unavailable"
      description="We could not confirm your Sanctuary Portal access right now. This is usually temporary."
    >
      <p className={styles.publicNote}>
        Check your connection and try again. If the problem persists, sign out and sign back in or contact support.
      </p>
      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.primaryAction}
          onClick={() => {
            router.replace(callbackUrl);
          }}
        >
          Try again
        </button>
        <button
          type="button"
          className={styles.secondaryAction}
          onClick={() => {
            void signOut();
          }}
        >
          Sign out
        </button>
      </div>
    </PublicAuthShell>
  );
}
