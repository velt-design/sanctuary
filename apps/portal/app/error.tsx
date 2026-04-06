'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import PageMessagePanel from '@/components/page-state/PageMessagePanel';
import styles from '@/components/page-state/PageState.module.css';
import { logPortalClientError } from '@/lib/logging/clientLogger';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    logPortalClientError('portal.global_error', {
      message: error.message,
      digest: error.digest ?? null,
      pathname: pathname ?? null,
    });
  }, [error, pathname]);

  return (
    <PageMessagePanel
      title="Something went wrong"
      description="The portal hit an unexpected problem while loading this screen. Try again first, then return to dashboard if the problem continues."
      actions={
        <>
          <button type="button" className={styles.primaryAction} onClick={() => reset()}>
            Try again
          </button>
          <Link href="/dashboard" className={styles.secondaryAction}>
            Dashboard
          </Link>
        </>
      }
    />
  );
}
