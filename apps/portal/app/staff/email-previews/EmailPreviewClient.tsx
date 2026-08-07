'use client';

import { Button } from '@/components/ui/foundation';
import { EmailPreviewCanvas } from './EmailPreviewCanvas';
import { EmailPreviewControls } from './EmailPreviewControls';
import { EmailPreviewPendingCanvas } from './EmailPreviewPendingCanvas';
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
      data-email-preview-background-ready={controller.preview ? 'true' : 'false'}
    >
      <div data-portal-shell-region="email-previews-controls">
        <EmailPreviewControls controller={controller} />
      </div>

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

      {controller.preview ? (
        <EmailPreviewCanvas controller={controller} />
      ) : (
        <EmailPreviewPendingCanvas
          state={controller.loadError ? 'unavailable' : 'loading'}
        />
      )}
    </section>
  );
}
