'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import HeaderActions from '@/components/layout/HeaderActions';
import PageHeader from '@/components/layout/PageHeader';
import PortalIndexLink from '@/components/navigation/PortalIndexLink';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { formatPortalDateTime } from '@/lib/format/portalDateTime';
import { contactDetailQueryOptions } from '@/lib/queries/contacts';
import { qk } from '@/lib/queries/keys';
import { projectsByContactQueryOptions } from '@/lib/queries/projects';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { isValidOptionalContactEmail, useContactDetailsDraft } from './useContactDetailsDraft';

type ContactDetailsViewProps = {
  contact: Contact;
  hostKey: string;
  loadError: string | null;
  projects: Project[];
  projectsLoaded: boolean;
  projectsError: boolean;
};

export function ContactDetailsView({
  contact,
  hostKey,
  loadError,
  projects,
  projectsLoaded,
  projectsError,
}: ContactDetailsViewProps) {
  const {
    canRetry,
    canSave,
    displayed,
    draft,
    error,
    finishEditing,
    isEditing,
    isSaving,
    resetEditing,
    retry,
    reviewLocalDraft,
    saveCurrentDraft,
    setIsEditing,
    statusText,
    updateDraftField,
  } = useContactDetailsDraft(contact, hostKey);

  return (
    <main className={styles.page}>
      <PageHeader
        title={displayed.displayName || contact.displayName}
        right={
          <HeaderActions>
            <PortalIndexLink className={styles.buttonSecondary} href="/staff/contacts">
              Contacts
            </PortalIndexLink>
            <Link className={styles.button} href={`/staff/projects/new?contactId=${encodeURIComponent(contact.id)}`}>
              Create Project
            </Link>
          </HeaderActions>
        }
      />
      <div className="mt-1 mb-3 text-xs text-zinc-500">Contact ID: {contact.id}</div>

      {loadError ? <p className={styles.error}>{loadError}</p> : null}

      <section className={styles.section} aria-label="Contact info">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Contact Info</h2>
          <div className={styles.actions}>
            {statusText ? <span className={styles.note}>{statusText}</span> : null}
            {isEditing ? (
              <>
                <button type="button" className={styles.button} disabled={!canSave} onClick={finishEditing}>
                  Done
                </button>
                <button type="button" className={styles.buttonSecondary} disabled={isSaving} onClick={resetEditing}>
                  Reset
                </button>
              </>
            ) : (
              <button type="button" className={styles.buttonSecondary} onClick={() => setIsEditing(true)}>
                Edit
              </button>
            )}
          </div>
        </div>
        <div className={styles.sectionBody}>
          {error ? (
            <div className={styles.field} role="status">
              <p className={styles.error}>{error}</p>
              {canRetry ? (
                <div className={styles.actions}>
                  <button type="button" className={styles.buttonSecondary} onClick={() => void retry()}>
                    Retry now
                  </button>
                  <button type="button" className={styles.buttonSecondary} onClick={reviewLocalDraft}>
                    Review changes
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <th style={{ width: 180 }}>Name</th>
                  <td>
                    {isEditing ? (
                      <input
                        aria-label="Contact name"
                        className={styles.inlineInput}
                        value={draft.displayName}
                        onChange={(event) => updateDraftField('displayName', event.target.value)}
                        onBlur={saveCurrentDraft}
                        required
                      />
                    ) : (
                      displayed.displayName
                    )}
                  </td>
                </tr>
                <tr>
                  <th>Email</th>
                  <td>
                    {isEditing ? (
                      <input
                        aria-label="Contact email"
                        className={styles.inlineInput}
                        value={draft.email}
                        onChange={(event) => updateDraftField('email', event.target.value)}
                        onBlur={saveCurrentDraft}
                      />
                    ) : (
                      displayed.email || '—'
                    )}
                    {isEditing && !isValidOptionalContactEmail(draft.email) ? (
                      <p className={styles.error}>Email must include &quot;@&quot;.</p>
                    ) : null}
                  </td>
                </tr>
                <tr>
                  <th>Phone</th>
                  <td>
                    {isEditing ? (
                      <input
                        aria-label="Contact phone"
                        className={styles.inlineInput}
                        value={draft.phone}
                        onChange={(event) => updateDraftField('phone', event.target.value)}
                        onBlur={saveCurrentDraft}
                      />
                    ) : (
                      displayed.phone || '—'
                    )}
                  </td>
                </tr>
                <tr>
                  <th>Created</th>
                  <td>{formatPortalDateTime(contact.createdAt)}</td>
                </tr>
                <tr>
                  <th>Updated</th>
                  <td>{formatPortalDateTime(contact.updatedAt)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-label="Projects for contact" style={{ marginTop: 14 }}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Projects</h2>
        </div>
        <div className={styles.sectionBody}>
          {!projectsLoaded ? (
            <p className={styles.note}>Loading projects...</p>
          ) : projects.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Region</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id}>
                      <td>{project.projectName ?? project.name ?? '—'}</td>
                      <td className={styles.muted}>{project.region ?? '—'}</td>
                      <td className={styles.muted}>{formatPortalDateTime(project.createdAt)}</td>
                      <td>
                        <Link className={styles.link} href={`/staff/projects/${encodeURIComponent(project.id)}`}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.note}>{projectsError ? 'Could not load projects.' : 'No projects linked to this contact yet.'}</p>
          )}
        </div>
      </section>
    </main>
  );
}

export default function ContactDetailClient({ contactId }: { contactId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const cachedContacts = queryClient.getQueryData<Contact[]>(qk.contacts.list(host));
  const cachedContact = useMemo(
    () => (Array.isArray(cachedContacts) ? cachedContacts.find((contact) => contact.id === contactId) ?? null : null),
    [cachedContacts, contactId],
  );
  const contactQuery = useQuery({
    ...contactDetailQueryOptions(host, contactId),
    initialData: cachedContact ?? undefined,
  });
  const projectsQuery = useQuery(projectsByContactQueryOptions(host, contactId));

  useEffect(() => {
    if (!contactQuery.error) return;
    toast.error(contactQuery.error instanceof Error ? contactQuery.error.message : 'Failed to load contact.');
  }, [contactQuery.error, toast]);

  useEffect(() => {
    if (!projectsQuery.error) return;
    toast.error(projectsQuery.error instanceof Error ? projectsQuery.error.message : 'Failed to load projects.');
  }, [projectsQuery.error, toast]);

  if (typeof contactQuery.data === 'undefined') {
    return (
      <main className={styles.page}>
        <PageHeader
          title="Contact"
          right={
            <HeaderActions>
              <PortalIndexLink className={styles.buttonSecondary} href="/staff/contacts">
                Contacts
              </PortalIndexLink>
            </HeaderActions>
          }
        />
        <p className={styles.note}>Loading contact details...</p>
      </main>
    );
  }

  if (!contactQuery.data) {
    return (
      <main className={styles.page}>
        <PageHeader
          title="Contact"
          right={
            <HeaderActions>
              <PortalIndexLink className={styles.buttonSecondary} href="/staff/contacts">
                Contacts
              </PortalIndexLink>
            </HeaderActions>
          }
        />
        <p className={styles.note}>This contact does not exist in the portal database.</p>
      </main>
    );
  }

  return (
    <ContactDetailsView
      contact={contactQuery.data}
      hostKey={host}
      loadError={contactQuery.error instanceof Error ? contactQuery.error.message : null}
      projects={projectsQuery.data ?? []}
      projectsLoaded={typeof projectsQuery.data !== 'undefined'}
      projectsError={Boolean(projectsQuery.error)}
    />
  );
}
