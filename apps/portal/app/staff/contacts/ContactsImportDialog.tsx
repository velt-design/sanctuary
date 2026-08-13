'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Button, IconButton, Switch } from '@/components/ui/foundation/FoundationControls';
import { AlertBanner } from '@/components/ui/foundation/FoundationFeedback';
import {
  LoadingSkeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/foundation/FoundationSurfaces';
import Modal from '@/components/ui/modal/Modal';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { parseContactsCsv, planContactsImport } from '@/lib/import/contactsCsv';
import { upsertContactCaches } from '@/lib/localFirst/portalEntities';
import { invalidateContactsIndexCaches } from '@/lib/queries/contactsIndex';
import { apiJson } from '@/lib/repo/apiClient';
import type { Contact } from '@/lib/types/contact';
import { newId } from '@/lib/utils/id';
import styles from './contacts.module.css';

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
  const [completedCount, setCompletedCount] = useState(0);
  const importLockedRef = useRef(false);
  const completedRowsRef = useRef(new Set<string>());
  const createIdsRef = useRef(new Map<string, string>());
  const workingContactsRef = useRef(contacts.slice());

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
      maxWidthPx={920}
      closeOnBackdrop={!busy}
      closeOnEsc={!busy}
    >
      <div className={styles.dialog}>
        <div className={styles.dialogHeader}>
          <div>
            <h2 className={styles.dialogTitle}>Import contacts</h2>
            <p className={styles.dialogMeta}>File: <strong>{file.name || 'CSV upload'}</strong></p>
          </div>
          <IconButton aria-label="Close import contacts" variant="quiet" disabled={busy} onClick={close}><X aria-hidden="true" /></IconButton>
        </div>

        {!payload && !error ? <LoadingSkeleton rows={3} columns={2} label="Reading file..." /> : null}
        {error ? <AlertBanner tone="error" title="Import failed">{error}</AlertBanner> : null}

        {payload && plan ? (
          <>
            <p className={styles.dialogMeta}>
              Header detected on row <strong>{payload.headerRowNumber}</strong>. Import creates new contacts and can optionally merge missing fields into existing contacts.
            </p>

            {payload.warnings.length ? (
              <AlertBanner tone="warning" title="CSV warnings">{payload.warnings.join(' | ')}</AlertBanner>
            ) : null}

            <div className={styles.dialogStats} aria-label="Planned changes">
              <span><small>Create</small><strong>{plan.stats.create}</strong></span>
              <span><small>Merge</small><strong>{plan.stats.merge}</strong></span>
              <span><small>Skip</small><strong>{plan.stats.skip}</strong></span>
              <span><small>Invalid</small><strong>{plan.stats.invalid}</strong></span>
            </div>

            <Switch
              label="Merge blanks"
              description="Fill missing email, phone, or name without overwriting existing values."
              checked={mergeBlanks}
              disabled={busy || completedCount > 0}
              onChange={(event) => setMergeBlanks(event.target.checked)}
            />

            <div className={styles.dialogTable}>
              <Table>
                <TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Action</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                <TableBody>
                  {plan.decisions.slice(0, 200).map((decision, index) => (
                    <TableRow key={importDecisionKey(decision, index)}>
                      <TableCell className={styles.muted}>{decision.row.sourceRowNumber}</TableCell>
                      <TableCell>{decision.row.displayName || '\u2014'}</TableCell>
                      <TableCell className={styles.muted}>{decision.row.email || '\u2014'}</TableCell>
                      <TableCell className={styles.muted}>{decision.row.phone || '\u2014'}</TableCell>
                      <TableCell>{decision.action === 'create' ? 'Create' : decision.action === 'merge' ? 'Merge' : decision.action === 'skip' ? 'Skip' : 'Invalid'}</TableCell>
                      <TableCell className={styles.muted}>
                        {decision.action === 'invalid'
                          ? decision.row.errors.join(' ')
                          : decision.reason
                            ? decision.reason
                            : decision.match
                              ? `Matches existing by ${decision.match.by}`
                              : '\u2014'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {plan.decisions.length > 200 ? <p className={styles.dialogMeta}>Showing first 200 rows.</p> : null}

            <div className={styles.dialogFooter}>
              <Button variant="secondary" disabled={busy} onClick={close}>Cancel</Button>
              <Button
                loading={busy}
                disabled={busy || plan.stats.create + plan.stats.merge === 0}
                onClick={async () => {
                  if (importLockedRef.current) return;
                  importLockedRef.current = true;
                  setBusy(true);
                  setError(null);
                  const actionableCount = plan.stats.create + plan.stats.merge;
                  try {
                    let created = 0;
                    let merged = 0;
                    let workingContacts = workingContactsRef.current;
                    for (const [decisionIndex, decision] of plan.decisions.entries()) {
                      const decisionKey = importDecisionKey(decision, decisionIndex);
                      if (completedRowsRef.current.has(decisionKey)) continue;
                      if (decision.action === 'create') {
                        const contactId = createIdsRef.current.get(decisionKey) ?? newId('ct');
                        createIdsRef.current.set(decisionKey, contactId);
                        const response = await apiJson<{ contact: Contact }>('/api/contacts', {
                          method: 'POST',
                          body: JSON.stringify({
                            contactId,
                            displayName: decision.row.displayName,
                            email: decision.row.email ?? '',
                            phone: decision.row.phone ?? '',
                          }),
                        });
                        workingContacts = upsertContact(workingContacts, response.contact);
                        upsertContactCaches(queryClient, host, response.contact);
                        created += 1;
                        completedRowsRef.current.add(decisionKey);
                        setCompletedCount(completedRowsRef.current.size);
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
                        completedRowsRef.current.add(decisionKey);
                        setCompletedCount(completedRowsRef.current.size);
                      }
                      workingContactsRef.current = workingContacts;
                    }
                    let refreshFailed = false;
                    try {
                      await invalidateContactsIndexCaches(queryClient, host);
                    } catch {
                      refreshFailed = true;
                      toast.error('Import completed, but the contacts list could not refresh. Reload the list to see the latest contacts; do not repeat the import.');
                    }
                    if (!refreshFailed) {
                      toast.success(`Import complete: ${completedRowsRef.current.size} changes processed (${created} created, ${merged} merged in this run).`);
                    }
                    onClose();
                  } catch (reason) {
                    const detail = reason instanceof Error ? reason.message : 'Import failed';
                    const message = `Import paused after ${completedRowsRef.current.size} of ${actionableCount} changes. Completed rows are saved; retry resumes safely. ${detail}`;
                    setError(message);
                    toast.error(message);
                  } finally {
                    importLockedRef.current = false;
                    setBusy(false);
                  }
                }}
              >
                {busy ? `Importing ${completedCount} of ${plan.stats.create + plan.stats.merge}...` : completedCount > 0 ? 'Retry remaining' : 'Confirm import'}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
