type CommercialArtifact = 'quote' | 'invoice';

export default function CommercialFinalFailureGuidance({
  artifact,
  reference,
  evidence,
  errorReference,
  className,
}: {
  artifact: CommercialArtifact;
  reference: string;
  evidence: string;
  errorReference?: string | null;
  className?: string;
}) {
  const replacementAction = artifact === 'quote' ? 'send' : 'delivery';

  return (
    <div className={className} role="alert">
      <strong>Staff action required.</strong>{' '}
      This delivery cannot be retried safely from the portal. Do not start a replacement{' '}
      {replacementAction}. Ask a portal administrator to reconcile {artifact} {reference} using{' '}
      {evidence}
      {errorReference ? <> and reference <strong>{errorReference}</strong></> : null}.
      {' '}After reconciliation, refresh this {artifact} before taking another delivery action.
    </div>
  );
}
