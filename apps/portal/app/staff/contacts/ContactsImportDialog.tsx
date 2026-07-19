'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Modal from '@/components/ui/modal/Modal';
import { useToast } from '@/components/ui/toast/ToastProvider';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import { parseContactsCsv, planContactsImport } from '@/lib/import/contactsCsv';
import { upsertContactCaches } from '@/lib/localFirst/portalEntities';
import { invalidateContactsIndexCaches } from '@/lib/queries/contactsIndex';
import { apiJson } from '@/lib/repo/apiClient';
import type { Contact } from '@/lib/types/contact';

function upsertContact(list: Contact[], contact: Contact): Contact[] {
  const next = [...list.filter((entry) => entry.id !== contact.id), contact];
  return next.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
}

function importDecisionKey(
  decision: {
    action: string;
    row: { sourceRowNumber?: number; displayName?: string; email?: string; phone?: string };
    match?: { existingId?: string };
  },
  index: number,
) {
  if (typeof decision.row.sourceRowNumber === 'number' && Number.isFinite(decision.row.sourceRowNumber)) {
    return `row:${decision.row.sourceRowNumber}`;
  }
  return [
    'fallback',
    index,
    decision.action,
    decision.row.displayName ?? '',
    decision.row.email ?? '',
    decision.row.phone ?? '',
    decision.match?.existingId ?? '',
  ].join(':');
}

export default function ContactsImportDialog({
  file,
  contacts,
  host,
  onClose,
}: {
  file: File;
  contacts: Contact[];
  host: string;
  onClose(): void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeBlanks, setMergeBlanks] = useState(false);
  const [payload, setPayload] = useState<ReturnType<typeof parseContactsCsv> | null>(null);

  useEffect(() => {
    let active = true;
    void file.text()
      .then((text) => parseContactsCsv(text))
      .then((parsed) => {
        if (active) setPayload(parsed);
      })
      .catch((reason) => {
        if (!active) return;
        const message = reason instanceof Error ? reason.message : 'Failed to read CSV';
        setError(message);
        toast.error(message);
      });
    return () => { active = false; };
  }, [file, toast]);

  const plan = useMemo(
    () => payload ? planContactsImport(payload.rows, contacts, { mergeBlanks }) : null,
    [contacts, mergeBlanks, payload],
  );

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <Modal
      open
      ariaLabel="Import contacts from CSV"
      onClose={close}
      overlayClassName={styles.modalOverlay}
      panelClassName={styles.modal}
      maxWidthPx={920}
      closeOnBackdrop={!busy}
      closeOnEsc={!busy}
    >
      <div className={styles.modalHeader}>
        <h2 className={styles.modalTitle}>Import contacts</h2>
        <button type="button" className={styles.modalClose} onClick={close}>Close</button>
      </div>

      <p className={styles.note}>File: <strong>{file.name || 'CSV upload'}</strong></p>
      {!payload && !error ? <p className={styles.note}>Reading file...</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      {payload && plan ? (
        <>
          <p className={styles.note}>
            Header detected on row <strong>{payload.headerRowNumber}</strong>. Import creates new contacts and can optionally merge missing fields into existing contacts.
          </p>
          {payload.warnings.length ? (
            <div className={styles.note} style={{ marginTop: 10 }}>
              <strong>CSV warnings:</strong> {payload.warnings.join(' · ')}
            </div>
          ) : null}

          <div className={styles.formGrid} style={{ marginTop: 12 }}>
            <div className={styles.field}>
              <label>Planned changes</label>
              <div className={styles.muted}>
                {plan.stats.create} create · {plan.stats.merge} merge · {plan.stats.skip} skip · {plan.stats.invalid} invalid
              </div>
            </div>
            <div className={styles.field}>
              <label>Merge blanks</label>
              <div className={styles.actions} style={{ justifyContent: 'flex-start' }}>
                <button
                  type="button"
                  className={mergeBlanks ? styles.button : styles.buttonSecondary}
                  disabled={busy}
                  onClick={() => setMergeBlanks((value) => !value)}
                >
                  {mergeBlanks ? 'On' : 'Off'}
                </button>
                <span className={styles.muted} style={{ alignSelf: 'center' }}>
                  When on: fills missing email, phone, or name without overwriting existing values.
                </span>
              </div>
            </div>
          </div>

          <div className={styles.tableWrap} style={{ marginTop: 14, maxHeight: 360, overflow: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr><th>Row</th><th>Name</th><th>Email</th><th>Phone</th><th>Action</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {plan.decisions.slice(0, 200).map((decision, index) => (
                  <tr key={importDecisionKey(decision, index)}>
                    <td className={styles.muted}>{decision.row.sourceRowNumber}</td>
                    <td>{decision.row.displayName || '—'}</td>
                    <td className={styles.muted}>{decision.row.email || '—'}</td>
                    <td className={styles.muted}>{decision.row.phone || '—'}</td>
                    <td>{decision.action === 'create' ? 'Create' : decision.action === 'merge' ? 'Merge' : decision.action === 'skip' ? 'Skip' : 'Invalid'}</td>
                    <td className={styles.muted}>
                      {decision.action === 'invalid'
                        ? decision.row.errors.join(' ')
                        : decision.reason
                          ? decision.reason
                          : decision.match
                            ? `Matches existing by ${decision.match.by}`
                            : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.decisions.length > 200 ? <p className={styles.note}>Showing first 200 rows.</p> : null}

          <div className={styles.modalFooter}>
            <button type="button" className={styles.buttonSecondary} disabled={busy} onClick={close}>Cancel</button>
            <button
              type="button"
              className={styles.button}
              disabled={busy || plan.stats.create + plan.stats.merge === 0}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  let created = 0;
                  let merged = 0;
                  let workingContacts = contacts.slice();
                  for (const decision of plan.decisions) {
                    if (decision.action === 'create') {
                      const response = await apiJson<{ contact: Contact }>('/api/contacts', {
                        method: 'POST',
                        body: JSON.stringify({
                          displayName: decision.row.displayName,
                          email: decision.row.email ?? '',
                          phone: decision.row.phone ?? '',
                        }),
                      });
                      workingContacts = upsertContact(workingContacts, response.contact);
                      upsertContactCaches(queryClient, host, response.contact);
                      created += 1;
                    } else if (decision.action === 'merge' && decision.match) {
                      const existing = workingContacts.find((contact) => contact.id === decision.match!.existingId);
                      if (!existing) continue;
                      const patch: Partial<Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>> = {};
                      if (!existing.displayName.trim() && decision.row.displayName.trim()) patch.displayName = decision.row.displayName;
                      if (!existing.email.trim() && decision.row.email.trim()) patch.email = decision.row.email;
                      if (!existing.phone.trim() && decision.row.phone.trim()) patch.phone = decision.row.phone;
                      if (Object.keys(patch).length) {
                        const response = await apiJson<{ contact: Contact }>(`/api/contacts/${encodeURIComponent(existing.id)}`, {
                          method: 'PATCH',
                          body: JSON.stringify(patch),
                        });
                        workingContacts = upsertContact(workingContacts, response.contact);
                        upsertContactCaches(queryClient, host, response.contact);
                        merged += 1;
                      }
                    }
                  }
                  await invalidateContactsIndexCaches(queryClient, host);
                  toast.success(`Imported contacts: ${created} created, ${merged} merged.`);
                  onClose();
                } catch (reason) {
                  const message = reason instanceof Error ? reason.message : 'Import failed';
                  setError(message);
                  toast.error(message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Importing...' : 'Confirm import'}
            </button>
          </div>
        </>
      ) : null}
    </Modal>
  );
}
