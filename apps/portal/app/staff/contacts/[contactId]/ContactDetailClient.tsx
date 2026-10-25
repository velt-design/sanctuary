'use client';

import ReadStatus from '@/components/page-state/ReadStatus';

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import HeaderActions from '@/components/layout/HeaderActions';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import PortalIndexLink from '@/components/navigation/PortalIndexLink';
import { Button, ButtonLink, Input } from '@/components/ui/foundation/FoundationControls';
import { TaskScheduleFeedback } from '@/components/ui/foundation/FoundationFeedback';
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
import { ApiError } from '@/lib/repo/apiClient';
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

type ContactDetailsViewProps = {
  contact: Contact | null;
  contactId?: string;
  pending?: boolean;
  missing?: boolean;
  onRetry?: () => void;
  onRetryProjects?: () => void;
  hostKey: string;
  loadError: string | null;
  projects: Project[];
  projectsLoaded: boolean;
  projectsError: boolean;
};

export function ContactDetailsView({
  contact,
  contactId = contact?.id ?? "",
  pending = !contact,
  missing = false,
  onRetry,
  onRetryProjects,
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
    <PageLayout className={styles.page}>
      <StaffPageHeader
        variant="detail"
        title={contact ? displayed.displayName || contact.displayName : pending ? "Reading contact" : missing ? "Contact not found" : "Contact unavailable"}
        description="Customer details and linked project history."
        breadcrumbs={[{ label: 'Contacts', href: '/staff/contacts' }, { label: contact ? displayed.displayName || contact.displayName : 'Contact' }]}
        right={
          <HeaderActions>
            <PortalIndexLink variant="secondary" href="/staff/contacts">Contacts</PortalIndexLink>
            <ButtonLink disabled={!contact} href={`/staff/projects/new?contactId=${encodeURIComponent(contactId)}`}>Create Project</ButtonLink>
          </HeaderActions>
        }
      />
      <p className={styles.detailMeta}>Contact ID: {contactId}</p>

      <ReadStatus title={loadError ? contact ? 'Latest contact refresh failed' : 'Contact unavailable' : pending ? 'Reading contact…' : 'Contact current'} tone={loadError ? 'warning' : 'neutral'} action={loadError && onRetry ? <Button variant="secondary" onClick={onRetry}>Retry</Button> : undefined} details={loadError ? <p>{loadError}</p> : undefined} />

      <Card
        title="Contact info"
        aria-label="Contact info"
        action={
          <div className={styles.detailActions}>
            <div className={styles.detailFeedback}>{statusText ? <TaskScheduleFeedback state={error ? 'retry' : isSaving ? 'saving' : 'saved'}>{statusText}</TaskScheduleFeedback> : null}</div>
            {isEditing ? (
              <>
                <Button disabled={!canSave} onClick={finishEditing}>Done</Button>
                <Button variant="secondary" disabled={isSaving} onClick={resetEditing}>Reset</Button>
              </>
            ) : (
              <Button variant="secondary" disabled={!contact} onClick={() => setIsEditing(true)}>Edit</Button>
            )}
          </div>
        }
      >
        <ReadStatus title={error ? 'Contact changes need attention' : 'Contact details'} tone={error ? 'error' : 'neutral'}
          action={error && canRetry ? <div className={styles.detailActions}><Button variant="secondary" onClick={() => void retry()}>Retry now</Button><Button variant="tertiary" onClick={reviewLocalDraft}>Review changes</Button></div> : undefined}
          details={error ? <p>{error}</p> : undefined} />

        <Table className={styles.detailTable}><colgroup><col style={{width:'27%'}}/><col style={{width:'73%'}}/></colgroup>
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
                ) : !contact ? pending ? "Reading name…" : "Unavailable" : displayed.displayName}
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
                ) : !contact ? pending ? 'Reading email…' : 'Unavailable' : displayed.email || '\u2014'}
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
                ) : !contact ? pending ? 'Reading phone…' : 'Unavailable' : displayed.phone || '\u2014'}
              </TableCell>
            </TableRow>
            <TableRow><TableHead scope="row">Created</TableHead><TableCell>{contact ? formatPortalDateTime(contact.createdAt) : pending ? "Reading created date…" : "Unavailable"}</TableCell></TableRow>
            <TableRow><TableHead scope="row">Updated</TableHead><TableCell>{contact ? formatPortalDateTime(contact.updatedAt) : pending ? "Reading updated date…" : "Unavailable"}</TableCell></TableRow>
          </TableBody>
        </Table>
      </Card>

      <Card title="Projects" aria-label="Projects for contact" padding="none">
          <Table className={styles.responsiveTable} viewportClassName={styles.listViewport}><colgroup><col style={{width:'60%'}}/><col className={styles.mobileOptional} style={{width:'15%'}}/><col className={styles.mobileOptional} style={{width:'17%'}}/><col style={{width:'8%'}}/></colgroup>
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
              {!projects.length ? <TableRow><TableCell colSpan={4}>
                {!projectsLoaded && !projectsError ? <p role="status">Reading linked projects…</p> : <EmptyState compact
                  title={projectsError ? 'Projects unavailable' : 'No linked projects'}
                  description={projectsError ? 'The project list could not be loaded.' : 'Create a project to connect work with this contact.'}
                  action={projectsError && onRetryProjects ? <Button variant="secondary" onClick={onRetryProjects}>Retry projects</Button> : !projectsError && contact ? <ButtonLink href={`/staff/projects/new?contactId=${encodeURIComponent(contactId)}`}>Create Project</ButtonLink> : undefined} />}
              </TableCell></TableRow> : null}
            </TableBody>
          </Table>

      </Card>
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

  const denied = [contactQuery.error, projectsQuery.error].some(error => error instanceof ApiError && [401, 403, 404].includes(error.status));
  const missing = contactQuery.data === null && !contactQuery.error;
  const visibleContact = denied ? null : contactQuery.data ?? null;

  return (
    <ContactDetailsView
      key={contactId}
      contact={visibleContact}
      contactId={contactId}
      pending={!denied && !missing && !contactQuery.error && !contactQuery.data}
      missing={missing}
      onRetry={() => void contactQuery.refetch()}
      onRetryProjects={() => void projectsQuery.refetch()}
      hostKey={host}
      loadError={contactQuery.error instanceof Error ? contactQuery.error.message : null}
      projects={denied || missing ? [] : projectsQuery.data ?? []}
      projectsLoaded={typeof projectsQuery.data !== 'undefined'}
      projectsError={denied || missing || Boolean(projectsQuery.error)}
    />
  );
}
