'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Contact } from '@/lib/types/contact';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { parseContactsCsv, planContactsImport } from '@/lib/import/contactsCsv';
import Modal from '@/components/ui/modal/Modal';
import PageHeader from '@/components/layout/PageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import PageMessagePanel from '@/components/page-state/PageMessagePanel';
import { formatPortalDateTime } from '@/lib/format/portalDateTime';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsListQueryOptions } from '@/lib/queries/contacts';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { apiJson } from '@/lib/repo/apiClient';
import stateStyles from '@/components/page-state/PageState.module.css';

export default function ContactsIndexClient({ initialContacts }: { initialContacts: Contact[] }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const importRef = useRef<HTMLInputElement | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMergeBlanks, setImportMergeBlanks] = useState(false);
  const [importPayload, setImportPayload] = useState<ReturnType<typeof parseContactsCsv> | null>(null);
  const [importFilename, setImportFilename] = useState<string>('');

  const queryClient = useQueryClient();
  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const { data, error } = useQuery({
    ...contactsListQueryOptions(host),
    initialData: initialContacts,
  });

  const contacts = data ?? [];

  useEffect(() => {
    if (!error) return;
    if (contacts.length) {
      toast.error("Couldn't refresh contacts (showing last saved).");
      return;
    }
    const msg = error instanceof Error ? error.message : 'Failed to load contacts.';
    toast.error(msg);
  }, [contacts.length, error, toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => {
      return (
        c.displayName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
      );
    });
  }, [contacts, query]);

  const importPlan = useMemo(() => {
    if (!importPayload) return null;
    return planContactsImport(importPayload.rows, contacts, { mergeBlanks: importMergeBlanks });
  }, [contacts, importMergeBlanks, importPayload]);

  if (error && !contacts.length) {
    const message = error instanceof Error ? error.message : 'Failed to load contacts.';
    return (
      <PageMessagePanel
        title="Contacts unavailable"
        description={message}
        actions={
          <button
            type="button"
            className={stateStyles.primaryAction}
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: contactsListQueryOptions(host).queryKey });
            }}
          >
            Try again
          </button>
        }
      />
    );
  }

  return (
    <main className={styles.page}>
      <PageHeader
        title="Contacts"
        right={
          <HeaderActions>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={() => {
                setImportError(null);
                importRef.current?.click();
              }}
            >
              Import CSV
            </button>
            <Link className={styles.button} href="/staff/contacts/new">
              New Contact
            </Link>
          </HeaderActions>
        }
      />

      <input
        ref={importRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;

          setImportError(null);
          try {
            const text = await file.text();
            const parsed = parseContactsCsv(text);
            setImportPayload(parsed);
            setImportMergeBlanks(false);
            setImportFilename(file.name);
            setImportOpen(true);
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to read CSV';
            setImportError(msg);
            toast.error(msg);
          }
        }}
      />

      {importError ? <p className={styles.error}>{importError}</p> : null}

      <div className="sp-page-stack">
        <section className={styles.section} aria-label="Search contacts">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Search</h2>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.field}>
              <label htmlFor="contactSearch">Search</label>
              <input
                id="contactSearch"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, email, phone…"
              />
            </div>
          </div>
        </section>

        <section className={styles.section} aria-label="Contacts list">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>All Contacts</h2>
            <span className={styles.muted}>{filtered.length} total</span>
          </div>
          <div className={styles.sectionBody}>
            {filtered.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Created</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr key={c.id}>
                        <td>{c.displayName}</td>
                        <td className={styles.muted}>{c.email || '—'}</td>
                        <td className={styles.muted}>{c.phone || '—'}</td>
                        <td className={styles.muted}>{formatPortalDateTime(c.createdAt)}</td>
                        <td>
                          <Link className={styles.link} href={`/staff/contacts/${encodeURIComponent(c.id)}`}>
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.note}>No contacts found.</p>
            )}
          </div>
        </section>
      </div>

      {importOpen && importPayload && importPlan ? (
        <Modal
          open
          ariaLabel="Import contacts from CSV"
          onClose={() => {
            if (importBusy) return;
            setImportOpen(false);
            setImportPayload(null);
          }}
          overlayClassName={styles.modalOverlay}
          panelClassName={styles.modal}
          maxWidthPx={920}
          closeOnBackdrop={!importBusy}
          closeOnEsc={!importBusy}
        >
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Import contacts</h2>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => {
                if (importBusy) return;
                setImportOpen(false);
                setImportPayload(null);
              }}
            >
              Close
            </button>
          </div>

            <p className={styles.note}>
              Header detected on row <strong>{importPayload.headerRowNumber}</strong>. Import creates new contacts and can optionally merge missing fields
              into existing contacts.
            </p>

            {importPayload.warnings.length ? (
              <div className={styles.note} style={{ marginTop: 10 }}>
                <strong>CSV warnings:</strong> {importPayload.warnings.join(' · ')}
              </div>
            ) : null}

            <div className={styles.formGrid} style={{ marginTop: 12 }}>
              <div className={styles.field}>
                <label>Planned changes</label>
                <div className={styles.muted}>
                  {importPlan.stats.create} create · {importPlan.stats.merge} merge · {importPlan.stats.skip} skip · {importPlan.stats.invalid} invalid
                </div>
              </div>
              <div className={styles.field}>
                <label>Merge blanks</label>
                <div className={styles.actions} style={{ justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    className={importMergeBlanks ? styles.button : styles.buttonSecondary}
                    disabled={importBusy}
                    onClick={() => setImportMergeBlanks((v) => !v)}
                  >
                    {importMergeBlanks ? 'On' : 'Off'}
                  </button>
                  <span className={styles.muted} style={{ alignSelf: 'center' }}>
                    When on: fills missing email/phone/name on existing contacts (doesn’t overwrite).
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.tableWrap} style={{ marginTop: 14, maxHeight: 360, overflow: 'auto' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Action</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {importPlan.decisions.slice(0, 200).map((d) => (
                    <tr key={d.row.sourceRowNumber}>
                      <td className={styles.muted}>{d.row.sourceRowNumber}</td>
                      <td>{d.row.displayName || '—'}</td>
                      <td className={styles.muted}>{d.row.email || '—'}</td>
                      <td className={styles.muted}>{d.row.phone || '—'}</td>
                      <td>
                        {d.action === 'create'
                          ? 'Create'
                          : d.action === 'merge'
                            ? 'Merge'
                            : d.action === 'skip'
                              ? 'Skip'
                              : 'Invalid'}
                      </td>
                      <td className={styles.muted}>
                        {d.action === 'invalid'
                          ? d.row.errors.join(' ')
                          : d.reason
                            ? d.reason
                            : d.match
                              ? `Matches existing by ${d.match.by}`
                              : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importPlan.decisions.length > 200 ? (
              <p className={styles.note} style={{ marginTop: 10 }}>
                Showing first 200 rows.
              </p>
            ) : null}

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.buttonSecondary}
                disabled={importBusy}
                onClick={() => {
                  setImportOpen(false);
                  setImportPayload(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.button}
                disabled={importBusy || importPlan.stats.create + importPlan.stats.merge === 0}
                onClick={async () => {
                  setImportBusy(true);
                  setImportError(null);
                  try {
                    let created = 0;
                    let merged = 0;

                    for (const d of importPlan.decisions) {
                      if (d.action === 'create') {
                        await apiJson<{ contact: Contact }>('/api/contacts', {
                          method: 'POST',
                          body: JSON.stringify({
                            displayName: d.row.displayName,
                            email: d.row.email ?? '',
                            phone: d.row.phone ?? '',
                          }),
                        });
                        created += 1;
                      } else if (d.action === 'merge' && d.match) {
                        const existing = contacts.find((c) => c.id === d.match!.existingId);
                        if (!existing) continue;
                        const patch: Partial<Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>> = {};
                        if (!existing.displayName.trim() && d.row.displayName.trim()) patch.displayName = d.row.displayName;
                        if (!existing.email.trim() && d.row.email.trim()) patch.email = d.row.email;
                        if (!existing.phone.trim() && d.row.phone.trim()) patch.phone = d.row.phone;
                        if (Object.keys(patch).length) {
                          await apiJson<{ contact: Contact }>(`/api/contacts/${encodeURIComponent(existing.id)}`, {
                            method: 'PATCH',
                            body: JSON.stringify(patch),
                          });
                          merged += 1;
                        }
                      }
                    }

                    await queryClient.invalidateQueries({ queryKey: contactsListQueryOptions(host).queryKey });
                    setImportOpen(false);
                    setImportPayload(null);
                    setImportFilename('');
                    toast.success(`Imported contacts: ${created} created, ${merged} merged.`);
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Import failed';
                    setImportError(msg);
                    toast.error(msg);
                  } finally {
                    setImportBusy(false);
                  }
                }}
              >
                {importBusy ? 'Importing…' : 'Confirm import'}
              </button>
            </div>
        </Modal>
      ) : null}
    </main>
  );
}
