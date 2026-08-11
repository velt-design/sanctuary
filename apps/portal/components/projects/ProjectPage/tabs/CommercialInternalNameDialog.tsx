'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Modal from '@/components/ui/modal/Modal';
import { Button, Input } from '@/components/ui/foundation';
import {
  COMMERCIAL_INTERNAL_NAME_MAX_LENGTH,
  validateCommercialInternalName,
} from '@/lib/commercial/internalName';
import styles from './CommercialInternalNameDialog.module.css';

export default function CommercialInternalNameDialog({
  open,
  title,
  description,
  initialValue,
  submitLabel,
  pending = false,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  initialValue?: string | null;
  submitLabel: string;
  pending?: boolean;
  onClose: () => void;
  onSubmit: (internalName: string | null) => void | Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue(initialValue ?? '');
    setError(null);
  }, [initialValue, open]);

  if (!open) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateCommercialInternalName(value);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    void onSubmit(result.value);
  };

  return (
    <Modal
      open
      onClose={onClose}
      ariaLabel={title}
      initialFocusRef={inputRef}
      closeOnBackdrop={!pending}
      closeOnEsc={!pending}
      maxWidthPx={520}
    >
      <form className={styles.form} onSubmit={submit}>
        <div>
          <h4 className={styles.title}>{title}</h4>
          <p className={styles.description}>{description}</p>
        </div>
        <Input
          ref={inputRef}
          label="Internal name (optional)"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          maxLength={COMMERCIAL_INTERNAL_NAME_MAX_LENGTH}
          placeholder="e.g. Front deck pergola"
          error={error ?? undefined}
          disabled={pending}
        />
        <p className={styles.hint}>For staff use only. It will not appear on customer documents.</p>
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? 'Saving…' : submitLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}
