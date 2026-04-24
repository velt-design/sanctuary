'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browserClient';
import { fetchPortalRole } from '@/lib/queries/auth';
import PublicAuthShell from '@/components/page-state/PublicAuthShell';
import styles from '@/components/page-state/PageState.module.css';
import { buildAccessStatusHref, getSafeCallbackUrl, toAccessStatusQueryState } from '@/lib/portalAccess';

const DEFAULT_CALLBACK_URL = '/dashboard';

export default function LoginClient() {
  const params = useSearchParams();
  const router = useRouter();
  const callbackUrl = getSafeCallbackUrl(params.get('callbackUrl'), DEFAULT_CALLBACK_URL);

  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <PublicAuthShell
      eyebrow="Sanctuary Portal"
      title="Staff Login"
      description="Use your Sanctuary Pergolas staff email to sign in."
    >
      {errorMessage ? <p className={styles.inlineError}>{errorMessage}</p> : null}

      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (submitting) return;

          setSubmitting(true);
          setErrorMessage(null);

          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

          if (error || !data.session || !data.user) {
            setErrorMessage('Invalid email or password.');
            setSubmitting(false);
            return;
          }

          let role: string | null = null;
          try {
            role = await fetchPortalRole(data.user.id);
          } catch {
            try {
              const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
              if (refreshError) throw refreshError;
              role = await fetchPortalRole(refreshed.session?.user?.id ?? data.user.id);
            } catch {
              router.replace(
                buildAccessStatusHref({
                  state: 'lookup-failed',
                  callbackUrl,
                }),
              );
              return;
            }
          }

          if (!role) {
            router.replace(
              buildAccessStatusHref({
                state: 'no-access',
                callbackUrl,
              }),
            );
            return;
          }

          router.replace(callbackUrl);
        }}
        className={styles.publicBody}
      >
        <label className={styles.publicField}>
          <span className={styles.publicLabel}>Email</span>
          <input
            className={styles.publicInput}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="username"
          />
        </label>

        <label className={styles.publicField}>
          <span className={styles.publicLabel}>Password</span>
          <input
            className={styles.publicInput}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        <div className={styles.actionRow}>
          <button
            type="submit"
            disabled={submitting}
            className={styles.primaryAction}
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </div>
      </form>
    </PublicAuthShell>
  );
}
