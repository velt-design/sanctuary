'use client';

import { useRef, type ReactNode } from 'react';
import Modal from '@/components/ui/modal/Modal';
import { AlertBanner } from './FoundationFeedback';
import { Button, Input } from './FoundationControls';
import styles from './DestructiveConfirmation.module.css';

export function DestructiveConfirmation({ open, title, description, confirmationText, value, onValueChange, pending, onCancel, onConfirm, consequences, additionalContent }: {
  open: boolean;
  title: string;
  description: string;
  confirmationText: string;
  value: string;
  onValueChange: (value: string) => void;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  consequences?: ReactNode;
  additionalContent?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const matches = value === confirmationText;
  return (
    <Modal open={open} onClose={onCancel} ariaLabel={title} closeOnBackdrop={!pending} closeOnEsc={!pending} initialFocusRef={inputRef} maxWidthPx={560}>
      <div className={styles.content}>
        <header><h2>{title}</h2><p>{description}</p></header>
        {consequences ? <AlertBanner tone="blocking" title="This cannot be undone">{consequences}</AlertBanner> : null}
        {additionalContent}
        <Input ref={inputRef} label={<>Type <strong>{confirmationText}</strong> to confirm</>} value={value} onChange={(event) => onValueChange(event.target.value)} disabled={pending} autoComplete="off" />
        <footer>
          <Button variant="tertiary" onClick={onCancel} disabled={pending}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!matches} loading={pending}>Delete permanently</Button>
        </footer>
      </div>
    </Modal>
  );
}
