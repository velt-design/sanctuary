'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

const DEFAULT_CALLBACK_URL = '/staff/calculator';

function getSafeCallbackUrl(raw: string | null): string {
  if (!raw) return DEFAULT_CALLBACK_URL;
  if (raw.startsWith('/')) return raw;
  return DEFAULT_CALLBACK_URL;
}

export default function LoginPage() {
  const params = useSearchParams();
  const error = params.get('error');
  const callbackUrl = getSafeCallbackUrl(params.get('callbackUrl'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const errorMessage = useMemo(() => {
    if (!error) return null;
    if (error === 'CredentialsSignin') return 'Invalid email or password.';
    return 'Unable to sign in.';
  }, [error]);

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
          onSubmit={(e) => {
            e.preventDefault();
            signIn('credentials', {
              email,
              password,
              callbackUrl,
            });
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
                cursor: 'pointer',
              }}
            >
              Sign in
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
