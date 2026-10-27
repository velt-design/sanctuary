'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Modal from '@/components/ui/modal/Modal';
import { Button } from '@/components/ui/foundation/FoundationControls';

const Preview = dynamic(() => import('./InvoiceArtifactPreviewDialog'));

/** A cold artifact must not suspend the public list or its evidence producer. */
export default function InvoicePreviewEntry({ invoiceId, invoiceRef, onClose }: {
  invoiceId: string; invoiceRef: string; onClose: () => void;
}) {
  return <Suspense fallback={<Modal open onClose={onClose} ariaLabel={`Preview invoice ${invoiceRef}`} maxWidthPx={1160}>
    <h2>{invoiceRef}</h2>
    <p role="status">Preparing invoice preview…</p>
    <Button variant="quiet" onClick={onClose}>Close</Button>
  </Modal>}>
    <Preview invoiceId={invoiceId} invoiceRef={invoiceRef} onClose={onClose} />
  </Suspense>;
}
