import { useEffect, useRef } from 'react';
import {
  Check,
  CircleAlert,
  Mail,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { Badge, Button } from '@/components/ui/foundation';
import { previewConfigurationMessage } from './emailPreviewOptions';
import type { EmailPreviewWorkbenchController } from './useEmailPreviewWorkbench';
import styles from './email-previews.module.css';

function layoutName(
  controller: EmailPreviewWorkbenchController,
  layoutId: string,
) {
  return (
    controller.preview?.layouts.find((layout) => layout.id === layoutId)?.name
    ?? layoutId
  );
}

export function EmailPreviewDeliveryPanel({
  controller,
}: {
  controller: EmailPreviewWorkbenchController;
}) {
  const {
    preview,
    selectedLayout,
    loading,
    deliveryConfirmation,
    delivery,
    isSending,
  } = controller;
  const sendDisabled = loading || !preview?.sendReady || isSending;
  const selectedTriggerRef = useRef<HTMLButtonElement>(null);
  const allTriggerRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<'selected' | 'all'>('selected');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreTriggerFocusRef = useRef(false);

  useEffect(() => {
    if (deliveryConfirmation) {
      cancelRef.current?.focus();
      return;
    }
    if (restoreTriggerFocusRef.current) {
      restoreTriggerFocusRef.current = false;
      const trigger =
        lastTriggerRef.current === 'all'
          ? allTriggerRef.current
          : selectedTriggerRef.current;
      trigger?.focus();
    }
  }, [deliveryConfirmation]);

  function cancelDelivery() {
    restoreTriggerFocusRef.current = true;
    controller.cancelDelivery();
  }

  return (
    <section
      className={styles.deliveryPanel}
      aria-labelledby="email-preview-delivery-title"
    >
      <header className={styles.panelHeading}>
        <span className={styles.stepNumber} aria-hidden="true">03</span>
        <div>
          <p className={styles.eyebrow}>Inbox proof</p>
          <h2 id="email-preview-delivery-title">Send for review</h2>
        </div>
        <Badge tone={preview?.sendReady ? 'success' : 'warning'}>
          {preview?.sendReady ? 'Ready' : 'Locked'}
        </Badge>
      </header>

      <dl className={styles.deliveryFacts}>
        <div>
          <dt>Recipient</dt>
          <dd>{preview?.recipient ?? 'Not configured'}</dd>
        </div>
        <div>
          <dt>Environment</dt>
          <dd>{preview?.environment ?? 'Checking…'}</dd>
        </div>
      </dl>

      <p
        className={
          preview?.sendReady
            ? styles.deliveryReadinessReady
            : styles.deliveryReadinessWarning
        }
        id="email-preview-send-status"
        role="status"
      >
        {preview
          ? previewConfigurationMessage(preview.configurationReason)
          : 'Checking the preview delivery configuration.'}
      </p>

      <div className={styles.safetyContract}>
        <ShieldCheck aria-hidden="true" />
        <span>
          {preview?.deliveryMode ?? 'Preview-only Resend'} · fixed recipient ·
          no BCC · no database or audit writes
        </span>
      </div>

      {deliveryConfirmation ? (
        <div
          className={styles.deliveryConfirmation}
          role="alertdialog"
          aria-labelledby="email-preview-confirm-title"
          aria-describedby="email-preview-confirm-description"
        >
          <Mail aria-hidden="true" />
          <div>
            <strong id="email-preview-confirm-title">
              Send {deliveryConfirmation.label}?
            </strong>
            <p id="email-preview-confirm-description">
              This sends{' '}
              {deliveryConfirmation.layoutIds.length === 1
                ? 'one exact render'
                : `${deliveryConfirmation.layoutIds.length} exact renders`}{' '}
              for {controller.preview?.label} to{' '}
              {controller.preview?.recipient}. No production enquiry is
              created.
            </p>
          </div>
          <div className={styles.confirmActions}>
            <Button
              ref={cancelRef}
              size="small"
              variant="quiet"
              onClick={cancelDelivery}
            >
              Cancel
            </Button>
            <Button
              size="small"
              leadingIcon={<Mail aria-hidden="true" />}
              onClick={() => void controller.confirmDelivery()}
            >
              Confirm send
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.deliveryActions}>
          <Button
            ref={selectedTriggerRef}
            size="small"
            leadingIcon={<Mail aria-hidden="true" />}
            disabled={sendDisabled || !selectedLayout}
            aria-describedby="email-preview-send-status"
            onClick={() => {
              lastTriggerRef.current = 'selected';
              controller.requestSelectedDelivery();
            }}
          >
            Send {selectedLayout?.name ?? 'selected'}
          </Button>
          <Button
            ref={allTriggerRef}
            size="small"
            variant="secondary"
            disabled={sendDisabled || !preview?.layouts.length}
            aria-describedby="email-preview-send-status"
            onClick={() => {
              lastTriggerRef.current = 'all';
              controller.requestAllDelivery();
            }}
          >
            Send all {preview?.layouts.length ?? 3}
          </Button>
        </div>
      )}

      {delivery.status === 'sending' ? (
        <div className={styles.deliveryProgress} role="status" aria-live="polite">
          <span
            style={{
              width: `${(delivery.completed / delivery.total) * 100}%`,
            }}
          />
          <p>
            Sending {layoutName(controller, delivery.currentLayout)} ·{' '}
            {delivery.completed + 1} of {delivery.total}
          </p>
        </div>
      ) : null}

      {delivery.status === 'success' ? (
        <div className={styles.deliverySuccess} role="status">
          <Check aria-hidden="true" />
          <div>
            <strong>
              {delivery.acceptedLayoutIds.length === 1
                ? `${layoutName(controller, delivery.acceptedLayoutIds[0]!)} accepted`
                : `${delivery.acceptedLayoutIds.length} alternatives accepted`}
            </strong>
            <p>
              Resend accepted the preview request for {delivery.recipient}.
              Check the inbox and spam folder; acceptance is not proof of
              delivery.
            </p>
          </div>
          <Button
            size="small"
            variant="quiet"
            onClick={controller.dismissDeliveryFeedback}
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      {delivery.status === 'error' ? (
        <div className={styles.deliveryError} role="alert">
          <CircleAlert aria-hidden="true" />
          <div>
            <strong>
              {delivery.acceptedLayoutIds.length
                ? `${delivery.acceptedLayoutIds.length} accepted before the failure`
                : 'No preview was accepted'}
            </strong>
            <p>
              {layoutName(controller, delivery.failedLayoutId)} failed.{' '}
              {delivery.message}
            </p>
          </div>
          <div className={styles.errorActions}>
            <Button
              size="small"
              variant="secondary"
              leadingIcon={<RotateCcw aria-hidden="true" />}
              onClick={() => void controller.retryFailedDelivery()}
            >
              Retry failed
            </Button>
            <Button
              size="small"
              variant="quiet"
              onClick={controller.dismissDeliveryFeedback}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
