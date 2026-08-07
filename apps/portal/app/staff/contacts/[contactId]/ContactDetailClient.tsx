'use client';

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import HeaderActions from '@/components/layout/HeaderActions';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import PortalIndexLink from '@/components/navigation/PortalIndexLink';
import { Button, ButtonLink, Input } from '@/components/ui/foundation/FoundationControls';
import { AlertBanner, TaskScheduleFeedback } from '@/components/ui/foundation/FoundationFeedback';
import {
  Card,
  EmptyState,
  PageLayout,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/foundation/FoundationSurfaces';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { formatPortalDateTime } from '@/lib/format/portalDateTime';
import { contactDetailQueryOptions } from '@/lib/queries/contacts';
import { qk } from '@/lib/queries/keys';
import { projectsByContactQueryOptions } from '@/lib/queries/projects';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import styles from '../contacts.module.css';
import { isValidOptionalContactEmail, useContactDetailsDraft } from './useContactDetailsDraft';
import ContactDetailPendingFrame, { ContactProjectsPendingTable } from './ContactDetailPendingFrame';

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
    <PageLayout
      className={styles.page}
      data-portal-page-shell="contact-detail"
      data-portal-page-shell-ready="true"
      data-portal-page-shell-state="ready"
    >
      <StaffPageHeader
        variant="detail"
        title={displayed.displayName || contact.displayName}
        description="Customer details and linked project history."
        breadcrumbs={[{ label: 'Contacts', href: '/staff/contacts' }, { label: displayed.displayName || contact.displayName }]}
        right={
          <HeaderActions>
            <PortalIndexLink variant="secondary" href="/staff/contacts">Contacts</PortalIndexLink>
            <ButtonLink href={`/staff/projects/new?contactId=${encodeURIComponent(contact.id)}`}>Create Project</ButtonLink>
          </HeaderActions>
        }
      />
      <p className={styles.detailMeta}>Contact ID: {contact.id}</p>

      {loadError ? <AlertBanner tone="warning" title="Latest contact refresh failed">{loadError}</AlertBanner> : null}

      <Card
        title="Contact info"
        aria-label="Contact info"
        data-portal-page-region="contact-info"
        action={
          <div className={styles.detailActions}>
            {statusText ? <TaskScheduleFeedback state={error ? 'retry' : isSaving ? 'saving' : 'saved'}>{statusText}</TaskScheduleFeedback> : null}
            {isEditing ? (
              <>
                <Button disabled={!canSave} onClick={finishEditing}>Done</Button>
                <Button variant="secondary" disabled={isSaving} onClick={resetEditing}>Reset</Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => setIsEditing(true)}>Edit</Button>
            )}
          </div>
        }
      >
        {error ? (
          <div className={styles.status}>
            <AlertBanner
              tone="error"
              title="Contact changes need attention"
              action={canRetry ? (
                <div className={styles.detailActions}>
                  <Button variant="secondary" onClick={() => void retry()}>Retry now</Button>
                  <Button variant="tertiary" onClick={reviewLocalDraft}>Review changes</Button>
                </div>
              ) : undefined}
            >
              {error}
            </AlertBanner>
          </div>
        ) : null}

        <Table className={styles.detailTable}>
          <TableBody>
            <TableRow>
              <TableHead scope="row">Name</TableHead>
              <TableCell>
                {isEditing ? (
                  <Input
                    aria-label="Contact name"
                    value={draft.displayName}
                    onChange={(event) => updateDraftField('displayName', event.target.value)}
                    onBlur={saveCurrentDraft}
                    required
                  />
                ) : displayed.displayName}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableHead scope="row">Email</TableHead>
              <TableCell>
                {isEditing ? (
                  <Input
                    aria-label="Contact email"
                    type="email"
                    value={draft.email}
                    onChange={(event) => updateDraftField('email', event.target.value)}
                    onBlur={saveCurrentDraft}
                    error={!isValidOptionalContactEmail(draft.email) ? 'Email must include "@".' : undefined}
                  />
                ) : displayed.email || '\u2014'}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableHead scope="row">Phone</TableHead>
              <TableCell>
                {isEditing ? (
                  <Input
                    aria-label="Contact phone"
                    type="tel"
                    value={draft.phone}
                    onChange={(event) => updateDraftField('phone', event.target.value)}
                    onBlur={saveCurrentDraft}
                  />
                ) : displayed.phone || '\u2014'}
              </TableCell>
            </TableRow>
            <TableRow><TableHead scope="row">Created</TableHead><TableCell>{formatPortalDateTime(contact.createdAt)}</TableCell></TableRow>
            <TableRow><TableHead scope="row">Updated</TableHead><TableCell>{formatPortalDateTime(contact.updatedAt)}</TableCell></TableRow>
          </TableBody>
        </Table>
      </Card>

      <Card
        title="Projects"
        aria-label="Projects for contact"
        padding="none"
        data-portal-page-region="contact-projects"
      >
        {!projectsLoaded ? (
          <>
            <ContactProjectsPendingTable />
            <span className="visually-hidden" role="status">Loading projects</span>
          </>
        ) : projects.length ? (
          <Table className={styles.responsiveTable}>
            <TableHeader><TableRow><TableHead>Project</TableHead><TableHead className={styles.mobileOptional}>Region</TableHead><TableHead className={styles.mobileOptional}>Created</TableHead><TableHead><span className="visually-hidden">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell><strong>{project.projectName ?? project.name ?? '\u2014'}</strong></TableCell>
                  <TableCell className={`${styles.muted} ${styles.mobileOptional}`}>{project.region ?? '\u2014'}</TableCell>
                  <TableCell className={`${styles.muted} ${styles.mobileOptional}`}>{formatPortalDateTime(project.createdAt)}</TableCell>
                  <TableCell className={styles.rowAction}><ButtonLink variant="quiet" size="small" href={`/staff/projects/${encodeURIComponent(project.id)}`}>Open</ButtonLink></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            compact
            title={projectsError ? 'Projects unavailable' : 'No linked projects'}
            description={projectsError ? 'The project list could not be loaded.' : 'Create a project to connect work with this contact.'}
            action={!projectsError ? <ButtonLink href={`/staff/projects/new?contactId=${encodeURIComponent(contact.id)}`}>Create Project</ButtonLink> : undefined}
          />
        )}
      </Card>
    </PageLayout>
  );
}

function ContactDetailState({ title, description }: { title: string; description: string }) {
  return (
    <PageLayout
      className={styles.page}
      data-portal-page-shell="contact-detail"
      data-portal-page-shell-ready="true"
      data-portal-page-shell-state="unavailable"
    >
      <StaffPageHeader
        variant="detail"
        title="Contact"
        breadcrumbs={[{ label: 'Contacts', href: '/staff/contacts' }, { label: 'Contact' }]}
        right={<HeaderActions><PortalIndexLink variant="secondary" href="/staff/contacts">Contacts</PortalIndexLink></HeaderActions>}
      />
      <EmptyState title={title} description={description} />
    </PageLayout>
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
    return <ContactDetailPendingFrame />;
  }

  if (!contactQuery.data) {
    return <ContactDetailState title="Contact not found" description="This contact does not exist in the portal database." />;
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
