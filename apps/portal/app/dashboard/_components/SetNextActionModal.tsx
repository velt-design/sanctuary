'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import styles from '@/app/staff/projects/projects.module.css';
import { NEXT_ACTION_TYPE_ORDER, nextActionTypeLabel } from '@/lib/types/project';
import { setNextAction } from '../actions';

const ACTION_OPTIONS = NEXT_ACTION_TYPE_ORDER.map((value) => ({
  value,
  label: nextActionTypeLabel(value),
}));

export default function SetNextActionModal(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  initial?: { actionLabel?: string; dueDate?: string };
}) {
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [actionLabel, setActionLabel] = useState(props.initial?.actionLabel ?? '');
  const [dueDate, setDueDate] = useState(props.initial?.dueDate ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setActionLabel(props.initial?.actionLabel ?? '');
    setDueDate(props.initial?.dueDate ?? '');
    setNote('');
    setError(null);
  }, [props.initial?.actionLabel, props.initial?.dueDate, props.open]);

  const canSave = actionLabel.trim().length > 0 && dueDate.trim().length > 0 && !pending;

  const options = useMemo(() => {
    if (!actionLabel) return ACTION_OPTIONS;
    const exists = ACTION_OPTIONS.some((opt) => opt.value === actionLabel);
    return exists ? ACTION_OPTIONS : [...ACTION_OPTIONS, { value: actionLabel, label: actionLabel }];
  }, [actionLabel]);

  if (!props.open) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Set next action">
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>Set next action</div>
            <div className={styles.muted} style={{ fontSize: 12 }}>
              Applies to this project.
            </div>
          </div>
          <button type="button" className={styles.modalClose} onClick={() => props.onOpenChange(false)}>
            Close
          </button>
        </div>

        <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr', gap: 10 }}>
          <label className={styles.field}>
            <span>Action</span>
            <select className={styles.inlineInput} value={actionLabel} onChange={(e) => setActionLabel(e.target.value)}>
              <option value="">Select…</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Due date</span>
            <input className={styles.inlineInput} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>

          <label className={styles.field}>
            <span>Note (optional)</span>
            <textarea
              className={styles.inlineInput}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </div>

        {error ? (
          <div className={styles.muted} style={{ color: 'rgb(185, 28, 28)', marginTop: 10 }}>
            {error}
          </div>
        ) : null}

        <div className={styles.modalFooter}>
          <button type="button" className={styles.buttonSecondary} onClick={() => props.onOpenChange(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.button}
            disabled={!canSave}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await setNextAction({
                    projectId: props.projectId,
                    actionLabel: actionLabel.trim(),
                    dueDate: dueDate.trim(),
                    note: note.trim() ? note.trim() : undefined,
                  });
                  await Promise.allSettled([
                    queryClient.invalidateQueries({ queryKey: ['dashboard', 'data'] }),
                    queryClient.invalidateQueries({ queryKey: ['projects'] }),
                  ]);
                  props.onOpenChange(false);
                } catch (err) {
                  const msg = err instanceof Error ? err.message : 'Failed to update next action.';
                  setError(msg);
                }
              });
            }}
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
