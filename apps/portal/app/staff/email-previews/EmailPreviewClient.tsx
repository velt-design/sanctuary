'use client';

import { Button } from '@/components/ui/foundation';
import { EmailPreviewCanvas } from './EmailPreviewCanvas';
import { EmailPreviewControls } from './EmailPreviewControls';
import { useEmailPreviewWorkbench } from './useEmailPreviewWorkbench';
import styles from './email-previews.module.css';

type EmailPreviewClientProps = {
  previewEndpoint?: string;
};

export default function EmailPreviewClient({
  previewEndpoint,
}: EmailPreviewClientProps) {
  const controller = useEmailPreviewWorkbench(previewEndpoint);

  return (
    <section
      className={styles.workspace}
      aria-label="Customer enquiry email design workbench"
      aria-busy={controller.loading || undefined}
    >
      <EmailPreviewControls controller={controller} />

      {controller.loadError ? (
        <div className={styles.loadError} role="alert">
          <div>
            <strong>Preview rendering failed</strong>
            <p>{controller.loadError}</p>
          </div>
          <Button variant="secondary" onClick={controller.refresh}>
            Try again
          </Button>
        </div>
      ) : null}

      <EmailPreviewCanvas controller={controller} />

    </section>
  );
}
