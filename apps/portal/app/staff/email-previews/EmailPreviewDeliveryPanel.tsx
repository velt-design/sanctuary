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

  return (
    <section
      className={styles.deliveryPanel}
      aria-labelledby="email-preview-delivery-title"
    >
      <header className={styles.panelHeading}>
        <div>
          <p className={styles.eyebrow}>Inbox delivery</p>
          <h2 id="email-preview-delivery-title">Review safely</h2>
        </div>
        <Badge tone={preview?.sendReady ? 'success' : 'warning'}>
          {preview?.sendReady ? 'Ready' : 'Locked'}
        </Badge>
      </header>

      <dl className={styles.deliveryFacts}>
        <div>
          <dt>Recipient</dt>
          <dd>{preview?.recipient ?? 'Server configured'}</dd>
        </div>
        <div>
          <dt>Environment</dt>
          <dd>{preview?.environment ?? 'Checking…'}</dd>
        </div>
        <div>
          <dt>Delivery</dt>
          <dd>{preview?.deliveryMode ?? 'Preview-only Resend'}</dd>
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
        <span>Fixed recipient · no BCC · no database or audit writes</span>
      </div>

      {deliveryConfirmation ? (
        <div
          className={styles.deliveryConfirmation}
          role="group"
          aria-labelledby="email-preview-confirm-title"
        >
          <Mail aria-hidden="true" />
          <div>
            <strong id="email-preview-confirm-title">
              Send {deliveryConfirmation.label}?
            </strong>
            <p>
              This will deliver the exact {controller.preview?.label} fixture
              to {controller.preview?.recipient}.
            </p>
          </div>
          <div className={styles.confirmActions}>
            <Button
              size="small"
              variant="quiet"
              onClick={controller.cancelDelivery}
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
            size="small"
            leadingIcon={<Mail aria-hidden="true" />}
            disabled={sendDisabled || !selectedLayout}
            aria-describedby="email-preview-send-status"
            onClick={controller.requestSelectedDelivery}
          >
            Send {selectedLayout?.name ?? 'selected'}
          </Button>
          <Button
            size="small"
            variant="secondary"
            disabled={sendDisabled || !preview?.layouts.length}
            aria-describedby="email-preview-send-status"
            onClick={controller.requestAllDelivery}
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
              {delivery.sentLayoutIds.length === 1
                ? `${layoutName(controller, delivery.sentLayoutIds[0]!)} sent`
                : `${delivery.sentLayoutIds.length} alternatives sent`}
            </strong>
            <p>Check the differentiated preview subjects in {delivery.recipient}.</p>
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
              {delivery.sentLayoutIds.length
                ? `${delivery.sentLayoutIds.length} sent before the failure`
                : 'Nothing was sent'}
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
