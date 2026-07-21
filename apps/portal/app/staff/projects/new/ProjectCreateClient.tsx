'use client';

import ProjectsIndexLink from '@/components/navigation/ProjectsIndexLink';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { listContacts } from '@/lib/repo/contactsRepo';
import { createProject } from '@/lib/repo/projectsRepo';
import type { Contact } from '@/lib/types/contact';
import styles from './ProjectCreateClient.module.css';
import PageHeader from '@/components/layout/PageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { SupabaseRepoError } from '@/lib/supabase/repoError';
import { apiJson } from '@/lib/repo/apiClient';
import { upsertContactCaches } from '@/lib/localFirst/portalEntities';
import { Button, Input, Select } from '@/components/ui/foundation/FoundationControls';
import { AlertBanner } from '@/components/ui/foundation/FoundationFeedback';
import { Card, PageLayout } from '@/components/ui/foundation/FoundationSurfaces';

type Draft = {
  contactId: string;
  projectName: string;
  quoteRef: string;
  region: string;
  siteAddress: string;
};

type ContactDraft = {
  displayName: string;
  email: string;
  phone: string;
};

function isValidOptionalEmail(email: string): boolean {
  if (!email.trim()) return true;
  return email.includes('@');
}

function upsertCreatedContact(list: Contact[], contact: Contact): Contact[] {
  const next = list.filter((entry) => entry.id !== contact.id);
  next.push(contact);
  next.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
  return next;
}

export default function ProjectCreateClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [draft, setDraft] = useState<Draft>({
    contactId: '',
    projectName: '',
    quoteRef: '',
    region: '',
    siteAddress: '',
  });
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState<ContactDraft>({ displayName: '', email: '', phone: '' });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [debugInsert, setDebugInsert] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await listContacts();
        if (cancelled) return;
        setContacts(next);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load contacts.';
        setSubmitError(msg);
        toast.error(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    const q = searchParams.get('contactId');
    if (!q) return;
    setDraft((prev) => ({ ...prev, contactId: q }));
  }, [searchParams]);

  const canSubmit = useMemo(() => draft.projectName.trim().length > 0 && draft.contactId.trim().length > 0, [draft.projectName, draft.contactId]);

  const setField = <K extends keyof Draft>(key: K, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const run = async (key: string, fn: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageLayout className={styles.page} data-ui-foundation-consumer="project-create">
      <PageHeader
        variant="detail"
        title="New Project"
        description="Create the project record and link its primary customer contact."
        breadcrumbs={[{ label: 'Projects', href: '/staff/projects' }, { label: 'New project' }]}
        right={<HeaderActions><ProjectsIndexLink variant="secondary" href="/staff/projects">Projects</ProjectsIndexLink></HeaderActions>}
      />

      <Card title="Project details" aria-label="Project form">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) return;
            setSubmitError(null);
            run('createProject', async () => {
              try {
                const project = await createProject({
                  contactId: draft.contactId.trim(),
                  projectName: draft.projectName.trim(),
                  quoteRef: draft.quoteRef.trim() || undefined,
                  region: draft.region.trim() || undefined,
                  siteAddress: draft.siteAddress.trim() || undefined,
                });
                await apiJson(`/api/staff/v1/projects/${encodeURIComponent(project.id)}/action/created`, { method: 'POST' }).catch(() => null);
                toast.success('Project created.');
                router.push(`/staff/projects/${encodeURIComponent(project.id)}`);
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to create project';
                setSubmitError(msg);
                if (process.env.NODE_ENV !== 'production') {
                  const dbg = (globalThis as any).__SP_PROJECT_INSERT_DEBUG__ ?? null;
                  if (err instanceof SupabaseRepoError) {
                    setDebugInsert({
                      host: err.supabaseHost || supabaseHostFromUrl(supabaseRuntimeUrl()),
                      table: err.table,
                      postgrestUrl: err.postgrestUrl,
                      postgrestError: err.postgrestError,
                      payload: dbg?.payload ?? null,
                    });
                  } else {
                    setDebugInsert({
                      host: supabaseHostFromUrl(supabaseRuntimeUrl()),
                      payload: dbg?.payload ?? null,
                      error: err instanceof Error ? { message: err.message } : err,
                    });
                  }
                }
                toast.error(msg);
              }
            });
          }}
        >
          <div className={styles.formGrid}>
            <div>
              <Select
                id="contactId"
                label="Primary contact *"
                value={draft.contactId}
                onChange={(event) => setField('contactId', event.target.value)}
                required
              >
                <option value="">Select a contact…</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.displayName}{contact.email ? ` (${contact.email})` : ''}
                  </option>
                ))}
              </Select>
              <div className={styles.contactActions}>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    setNewContactOpen((open) => !open);
                    setSubmitError(null);
                  }}
                >
                  {newContactOpen ? 'Cancel new contact' : 'Create new contact'}
                </Button>
              </div>
            </div>
            <Input id="projectName" label="Project name *" value={draft.projectName} onChange={(event) => setField('projectName', event.target.value)} required />
            <Input id="quoteRef" label="Quote ref" value={draft.quoteRef} onChange={(event) => setField('quoteRef', event.target.value)} />
            <Input id="region" label="Region" value={draft.region} onChange={(event) => setField('region', event.target.value)} />
            <Input id="siteAddress" label="Site address" fieldClassName={styles.fullWidth} value={draft.siteAddress} onChange={(event) => setField('siteAddress', event.target.value)} />

            {newContactOpen ? (
              <section className={styles.subsection} aria-labelledby="new-project-contact-title">
                <h3 className={styles.subsectionHeader} id="new-project-contact-title">New contact</h3>
                <div className={styles.formGrid}>
                  <Input
                    id="newContactName"
                    label="Name *"
                    value={contactDraft.displayName}
                    onChange={(event) => setContactDraft((current) => ({ ...current, displayName: event.target.value }))}
                    required
                  />
                  <Input
                    id="newContactEmail"
                    label="Email"
                    type="email"
                    value={contactDraft.email}
                    onChange={(event) => setContactDraft((current) => ({ ...current, email: event.target.value }))}
                    error={!isValidOptionalEmail(contactDraft.email) ? 'Email must include "@".' : undefined}
                  />
                  <Input
                    id="newContactPhone"
                    label="Phone"
                    type="tel"
                    value={contactDraft.phone}
                    onChange={(event) => setContactDraft((current) => ({ ...current, phone: event.target.value }))}
                  />
                </div>
                <div className={styles.contactActions}>
                  <Button
                    type="button"
                    disabled={Boolean(busy) || !contactDraft.displayName.trim() || !isValidOptionalEmail(contactDraft.email)}
                    loading={busy === 'createContact'}
                    onClick={() => {
                      run('createContact', async () => {
                        setSubmitError(null);
                        try {
                          const response = await apiJson<{ contact: Contact }>('/api/contacts', {
                            method: 'POST',
                            body: JSON.stringify({
                              displayName: contactDraft.displayName.trim(),
                              email: contactDraft.email.trim(),
                              phone: contactDraft.phone.trim(),
                            }),
                          });
                          upsertContactCaches(queryClient, host, response.contact);
                          setContacts((current) => upsertCreatedContact(current, response.contact));
                          setDraft((current) => ({ ...current, contactId: response.contact.id }));
                          setNewContactOpen(false);
                          setContactDraft({ displayName: '', email: '', phone: '' });
                          toast.success('Contact created.');
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : 'Failed to create contact';
                          setSubmitError(msg);
                          toast.error(msg);
                        }
                      });
                    }}
                  >
                    Create contact
                  </Button>
                </div>
              </section>
            ) : null}

            {submitError ? <div className={styles.status}><AlertBanner tone="error" title="Project could not be created">{submitError}</AlertBanner></div> : null}
            {process.env.NODE_ENV !== 'production' && debugInsert ? (
              <details className={styles.diagnostics}>
                <summary>Project insert diagnostics (dev only)</summary>
                <pre>{JSON.stringify(debugInsert, null, 2)}</pre>
              </details>
            ) : null}
          </div>

          <div className={styles.formActions}>
            <Button type="submit" disabled={Boolean(busy) || !canSubmit} loading={busy === 'createProject'}>
              {busy === 'createProject' ? 'Creating…' : 'Create Project'}
            </Button>
            <ProjectsIndexLink variant="secondary" href="/staff/projects">Cancel</ProjectsIndexLink>
          </div>
        </form>
      </Card>
    </PageLayout>
  );
}
