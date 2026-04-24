import { Suspense } from 'react';
import LoginClient from './LoginClient';
import PublicAuthShell from '@/components/page-state/PublicAuthShell';
import styles from '@/components/page-state/PageState.module.css';

function LoginFallback() {
  return (
    <PublicAuthShell
      eyebrow="Sanctuary Portal"
      title="Staff Login"
      description="Use your Sanctuary Pergolas staff account to sign in."
    >
      <div className={styles.loginFallbackFields} aria-hidden="true">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className={styles.loginFallbackField}>
            <div className={`${styles.fieldLabel} ${styles.skeletonShimmer} ${styles.skeletonLine}`} />
            <div className={`${styles.fieldInput} ${styles.skeletonShimmer} ${styles.skeletonBlock}`} />
          </div>
        ))}
        <div className={`${styles.loginFallbackButton} ${styles.skeletonShimmer} ${styles.skeletonBlock}`} />
      </div>
    </PublicAuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginClient />
    </Suspense>
  );
}
