'use client';

import { useMemo, useState, type FormEvent } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { useToast } from '@/components/ui/toast/ToastProvider';
import styles from './access.module.css';

type Role = 'admin' | 'staff';

type Result = {
  user_id: string;
  email: string;
  role: Role;
  existing: boolean;
};

function generatePassword(length = 14) {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const buffer = new Uint32Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buffer);
  } else {
    for (let i = 0; i < length; i += 1) buffer[i] = Math.floor(Math.random() * charset.length);
  }
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += charset[buffer[i] % charset.length];
  }
  return out;
}

export default function AccessClient() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('staff');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const trimmedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (!trimmedEmail) {
      toast.error('Email is required.');
      return;
    }
    if (!password || password.trim().length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch('/api/admin/access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, role, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(String(json?.error ?? 'Failed to set password.'));
      }
      setResult(json as Result);
      toast.success(json?.existing ? 'Password updated.' : 'User created with temp password.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set temp password.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader title="Access" />
      <div className={styles.card}>
        <p className={styles.intro}>
          Create a portal user (or update an existing one) with a temporary password. The user can log in immediately.
        </p>

        <form className={styles.form} onSubmit={submit}>
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <input
                className={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@sanctuarypergolas.co.nz"
                autoComplete="username"
                required
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Role</span>
              <select className={styles.select} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Temporary password</span>
            <div className={styles.passwordRow}>
              <input
                className={styles.input}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => setPassword(generatePassword())}
              >
                Generate
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <span className={styles.helper}>Use at least 8 characters. You can change it later.</span>
          </label>

          <div className={styles.actions}>
            <button className={styles.buttonPrimary} type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Set temp password'}
            </button>
            <span className={styles.helper}>Creates the user if missing and assigns portal role.</span>
          </div>
        </form>

        {result ? (
          <div className={styles.result}>
            <strong>{result.existing ? 'Updated existing user' : 'Created new user'}</strong>
            <div>
              {result.email} → {result.role}
            </div>
            <div className={styles.code}>user_id: {result.user_id}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
