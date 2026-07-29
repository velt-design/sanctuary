'use client';

import ProjectsIndexLink from '@/components/navigation/ProjectsIndexLink';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Contact } from '@/lib/types/contact';
import styles from './ProjectCreateClient.module.css';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { ApiError, apiJson } from '@/lib/repo/apiClient';
import { Button, Input } from '@/components/ui/foundation/FoundationControls';
import { AlertBanner } from '@/components/ui/foundation/FoundationFeedback';
import { Card, PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import { newId } from '@/lib/utils/id';
import type {
  ProjectCreateDuplicateResponse,
  ProjectCreateRequest,
  ProjectCreateResponse,
} from '@/lib/projects/createProjectContract';
import ProjectContactCombobox from './ProjectContactCombobox';
import { invalidateProjectsIndexCaches } from '@/lib/queries/projectCache';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

type Draft = {
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

function duplicateResponse(error: unknown): ProjectCreateDuplicateResponse | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const body = error.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const candidate = body as Partial<ProjectCreateDuplicateResponse>;
  return candidate.code === 'CONTACT_DUPLICATE_CANDIDATES' && Array.isArray(candidate.candidates)
    ? candidate as ProjectCreateDuplicateResponse
    : null;
}

export default function ProjectCreateClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const toast = useToast();
  const initialContactId = searchParams.get('contactId');
  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const [projectId] = useState(() => newId('proj'));
  const [newContactId] = useState(() => newId('ct'));
  const [contactMode, setContactMode] = useState<'existing' | 'new'>('existing');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [draft, setDraft] = useState<Draft>({
    projectName: '',
    quoteRef: '',
    region: '',
    siteAddress: '',
  });
  const [contactDraft, setContactDraft] = useState<ContactDraft>({ displayName: '', email: '', phone: '' });
  const [duplicateCandidates, setDuplicateCandidates] = useState<Contact[]>([]);
  const [submitError, setSubmitError] = useState<{ message: string; retrySafe: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    if (!draft.projectName.trim()) return false;
    if (contactMode === 'existing') return Boolean(selectedContact);
    return Boolean(contactDraft.displayName.trim() && isValidOptionalEmail(contactDraft.email));
  }, [contactDraft.displayName, contactDraft.email, contactMode, draft.projectName, selectedContact]);

  const setField = <K extends keyof Draft>(key: K, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const submitProject = useCallback(async (allowDuplicate: boolean) => {
    if (busy || !canSubmit) return;
    setBusy(true);
    setSubmitError(null);
    setDuplicateCandidates([]);
    const contact: ProjectCreateRequest['contact'] = contactMode === 'existing' && selectedContact
      ? { kind: 'existing', contactId: selectedContact.id }
      : {
          kind: 'new',
          contactId: newContactId,
          displayName: contactDraft.displayName.trim(),
          email: contactDraft.email.trim(),
          phone: contactDraft.phone.trim(),
          allowDuplicate,
        };
    try {
      const response = await apiJson<ProjectCreateResponse>('/api/staff/v1/projects', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          projectName: draft.projectName.trim(),
          quoteRef: draft.quoteRef.trim(),
          region: draft.region.trim(),
          siteAddress: draft.siteAddress.trim(),
          contact,
        } satisfies ProjectCreateRequest),
      });
      if (response.receipt.setupAutomation === 'needs_attention') {
        toast.info('Project saved. Initial setup automation needs administrator review.');
      } else if (response.receipt.setupAutomation === 'not_rechecked') {
        toast.info('Project was already saved. Check its activity if expected setup items are missing.');
      } else {
        toast.success('Project saved to Sanctuary.');
      }
      void invalidateProjectsIndexCaches(queryClient, host, {
        includeContacts: contact.kind === 'new',
      });
      router.push(`/staff/projects/${encodeURIComponent(response.project.id)}`);
    } catch (error) {
      const duplicate = duplicateResponse(error);
      if (duplicate) {
        setDuplicateCandidates(duplicate.candidates);
        setSubmitError({ message: duplicate.error, retrySafe: true });
      } else {
        const message = error instanceof Error ? error.message : 'Project could not be created.';
        const errorCode = error instanceof ApiError
          && error.body
          && typeof error.body === 'object'
          && !Array.isArray(error.body)
          ? (error.body as { code?: unknown }).code
          : null;
        const retryUnsafe = errorCode === 'PROJECT_CREATION_REVIEW_REQUIRED'
          || errorCode === 'PROJECT_CREATION_COMMAND_CONFLICT';
        setSubmitError({ message, retrySafe: !retryUnsafe });
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    canSubmit,
    contactDraft.displayName,
    contactDraft.email,
    contactDraft.phone,
    contactMode,
    draft.projectName,
    draft.quoteRef,
    draft.region,
    draft.siteAddress,
    newContactId,
    projectId,
    host,
    queryClient,
    router,
    selectedContact,
    toast,
  ]);

  return (
    <PageLayout className={styles.page} data-ui-foundation-consumer="project-create">
      <StaffPageHeader
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
            void submitProject(false);
          }}
        >
          <div className={styles.formGrid}>
            <div className={styles.fullWidth}>
              <div className={styles.contactMode} role="group" aria-label="Primary contact choice">
                <Button
                  type="button"
                  variant={contactMode === 'existing' ? 'secondary' : 'tertiary'}
                  aria-pressed={contactMode === 'existing'}
                  disabled={busy}
                  onClick={() => {
                    setContactMode('existing');
                    setDuplicateCandidates([]);
                    setSubmitError(null);
                  }}
                >
                  Choose existing contact
                </Button>
                <Button
                  type="button"
                  variant={contactMode === 'new' ? 'secondary' : 'tertiary'}
                  aria-pressed={contactMode === 'new'}
                  disabled={busy}
                  onClick={() => {
                    setContactMode('new');
                    setDuplicateCandidates([]);
                    setSubmitError(null);
                  }}
                >
                  Create new contact
                </Button>
              </div>
            </div>

            {contactMode === 'existing' ? (
              <div className={styles.fullWidth}>
                <ProjectContactCombobox
                  selected={selectedContact}
                  initialContactId={initialContactId}
                  disabled={busy}
                  onChange={setSelectedContact}
                />
              </div>
            ) : (
              <section className={styles.subsection} aria-labelledby="new-project-contact-title">
                <h3 className={styles.subsectionHeader} id="new-project-contact-title">New contact</h3>
                <p className={styles.subsectionIntro}>
                  The contact and project are confirmed together. If cleanup cannot be verified, the portal stops
                  retries and asks for administrator review.
                </p>
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
              </section>
            )}

            <Input id="projectName" label="Project name *" value={draft.projectName} onChange={(event) => setField('projectName', event.target.value)} required />
            <Input id="quoteRef" label="Quote ref" value={draft.quoteRef} onChange={(event) => setField('quoteRef', event.target.value)} />
            <Input id="region" label="Region" value={draft.region} onChange={(event) => setField('region', event.target.value)} />
            <Input id="siteAddress" label="Site address" fieldClassName={styles.fullWidth} value={draft.siteAddress} onChange={(event) => setField('siteAddress', event.target.value)} />

            {duplicateCandidates.length ? (
              <div className={styles.status}>
                <AlertBanner tone="warning" title="Possible existing contact">
                  <p>Choose an existing match, or explicitly create a separate contact and project.</p>
                  <div className={styles.duplicateCandidates}>
                    {duplicateCandidates.map((candidate) => (
                      <Button
                        key={candidate.id}
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setSelectedContact(candidate);
                          setContactMode('existing');
                          setDuplicateCandidates([]);
                          setSubmitError(null);
                        }}
                      >
                        Use {candidate.displayName}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="tertiary"
                      disabled={busy}
                      onClick={() => void submitProject(true)}
                    >
                      Create separate contact and project
                    </Button>
                  </div>
                </AlertBanner>
              </div>
            ) : null}

            {submitError && !duplicateCandidates.length ? (
              <div className={styles.status}>
                <AlertBanner tone="error" title="Project could not be created">
                  {submitError.message}
                  {submitError.retrySafe && !/retry is safe/i.test(submitError.message) ? ' Retry is safe.' : ''}
                </AlertBanner>
              </div>
            ) : null}
          </div>

          <div className={styles.formActions}>
            <Button type="submit" disabled={busy || !canSubmit} loading={busy}>
              {busy ? 'Creating…' : 'Create project'}
            </Button>
            <ProjectsIndexLink variant="secondary" href="/staff/projects">Cancel</ProjectsIndexLink>
          </div>
        </form>
      </Card>
    </PageLayout>
  );
}
