export function enquiryDeliveryStatus(emailStatus: string | null, deliveryStatus?: string | null) {
  if (deliveryStatus === 'needs_attention' || deliveryStatus === 'permanent_failed' || deliveryStatus === 'cancelled')
    return 'Needs attention — ask an administrator to check delivery before resending.';
  if (emailStatus === 'SENT') return 'Sent';
  if (deliveryStatus === 'retrying') return 'Retrying automatically';
  if (deliveryStatus === 'provider_accepted' || deliveryStatus === 'finalising') return 'Accepted by email provider — completing delivery record';
  if (deliveryStatus === 'queued') return 'Queued for delivery';
  if (deliveryStatus === 'claimed' || deliveryStatus === 'preparing' || deliveryStatus === 'running' || deliveryStatus === 'dispatching') return 'Sending';
  if (emailStatus === 'FAILED' || deliveryStatus === 'succeeded') return 'Check email history — delivery status needs review';
  return emailStatus ?? 'Legacy delivery — check email history';
}
