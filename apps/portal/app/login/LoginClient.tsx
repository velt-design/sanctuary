'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browserClient';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';

const DEFAULT_CALLBACK_URL = '/dashboard';

function getSafeCallbackUrl(raw: string | null): string {
  if (!raw) return DEFAULT_CALLBACK_URL;
  if (raw.startsWith('/')) return raw;
  return DEFAULT_CALLBACK_URL;
}

export default function LoginClient() {
  const params = useSearchParams();
  const router = useRouter();
  const callbackUrl = getSafeCallbackUrl(params.get('callbackUrl'));
  const { status } = usePortalSession();

  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') router.replace(callbackUrl);
  }, [callbackUrl, router, status]);

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: 'calc(var(--navH, 82px) + 48px) 24px 48px',
        display: 'grid',
        placeItems: 'center',
        background: '#fff',
      }}
    >
      <div
        style={{
          width: 'min(420px, 100%)',
          border: '1px solid rgba(15,15,16,.12)',
          borderRadius: 18,
          background: '#fff',
          padding: 24,
          boxShadow: '0 22px 60px rgba(17,17,17,.08)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: '-0.02em' }}>Staff Login</h1>
        <p style={{ marginTop: 8, color: 'rgba(15,15,16,.7)' }}>
          Use your Sanctuary Pergolas staff email to sign in.
        </p>

        {errorMessage ? (
          <p
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 12,
              background: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              color: 'rgb(185, 28, 28)',
            }}
          >
            {errorMessage}
          </p>
        ) : null}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
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

            const { data: portalUser, error: portalError } = await supabase
              .from('portal_users')
              .select('role')
              .eq('user_id', data.user.id)
              .maybeSingle();

            if (portalError || !portalUser?.role) {
              await supabase.auth.signOut();
              setErrorMessage('Your account does not have portal access yet.');
              setSubmitting(false);
              return;
            }

            router.replace(callbackUrl);
          }}
          style={{ marginTop: 16 }}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, color: 'rgba(15,15,16,.7)' }}>Email</span>
              <input
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(15,15,16,.18)',
                  background: '#fff',
                  fontSize: 14,
                  outline: 'none',
                }}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, color: 'rgba(15,15,16,.7)' }}>Password</span>
              <input
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(15,15,16,.18)',
                  background: '#fff',
                  fontSize: 14,
                  outline: 'none',
                }}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 4,
                width: '100%',
                padding: '12px 14px',
                borderRadius: 999,
                border: 'none',
                background: '#813F39',
                color: '#fff',
                fontWeight: 600,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
