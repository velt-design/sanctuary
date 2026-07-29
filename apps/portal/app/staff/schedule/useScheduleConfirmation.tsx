'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Modal from '@/components/ui/modal/Modal';
import { Button } from '@/components/ui/foundation/FoundationControls';
import { AlertBanner } from '@/components/ui/foundation/FoundationFeedback';
import styles from './useScheduleConfirmation.module.css';

type ScheduleConfirmationInput = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  details?: string[];
};

type ScheduleConfirmationRequest = ScheduleConfirmationInput & {
  resolve: (confirmed: boolean) => void;
};

export function useScheduleConfirmation() {
  const [request, setRequest] = useState<ScheduleConfirmationRequest | null>(null);
  const requestRef = useRef<ScheduleConfirmationRequest | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    const pending = requestRef.current;
    requestRef.current = null;
    setRequest(null);
    pending?.resolve(confirmed);
  }, []);

  const confirm = useCallback((input: ScheduleConfirmationInput) => {
    requestRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => {
      const next = { ...input, resolve };
      requestRef.current = next;
      setRequest(next);
    });
  }, []);

  useEffect(() => () => {
    requestRef.current?.resolve(false);
    requestRef.current = null;
  }, []);

  const dialog = request ? (
    <Modal
      open
      ariaLabel={request.title}
      onClose={() => settle(false)}
      initialFocusRef={cancelRef}
      maxWidthPx={560}
    >
      <div className={styles.content}>
        <AlertBanner tone={request.destructive ? 'blocking' : 'warning'} title={request.title}>
          <p className={styles.description}>{request.description}</p>
          {request.details?.length ? (
            <ul className={styles.details}>
              {request.details.map((detail, index) => (
                <li key={`${index}-${detail}`}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </AlertBanner>
        <div className={styles.actions}>
          <Button ref={cancelRef} variant="tertiary" onClick={() => settle(false)}>Cancel</Button>
          <Button variant={request.destructive ? 'destructive' : 'primary'} onClick={() => settle(true)}>
            {request.confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  ) : null;

  return { confirm, dialog };
}
