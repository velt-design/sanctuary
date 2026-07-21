'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import HeaderActions from '@/components/layout/HeaderActions';
import PageHeader from '@/components/layout/PageHeader';
import PortalIndexLink from '@/components/navigation/PortalIndexLink';
import SupabaseEnvStatus from '@/components/diagnostics/SupabaseEnvStatus';
import { Button, Input } from '@/components/ui/foundation/FoundationControls';
import { AlertBanner } from '@/components/ui/foundation/FoundationFeedback';
import { Card, PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import { upsertContactCaches } from '@/lib/localFirst/portalEntities';
import { apiJson } from '@/lib/repo/apiClient';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import type { Contact } from '@/lib/types/contact';
import styles from '../contacts.module.css';

type Draft = {
  displayName: string;
  email: string;
  phone: string;
};

function isValidOptionalEmail(email: string): boolean {
  if (!email.trim()) return true;
  return email.includes('@');
}

export default function ContactCreateClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>({ displayName: '', email: '', phone: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);

  const canSubmit = useMemo(() => {
    return !busy && draft.displayName.trim().length > 0 && isValidOptionalEmail(draft.email);
  }, [busy, draft.displayName, draft.email]);

  return (
    <PageLayout className={styles.page}>
      <PageHeader
        variant="detail"
        title="New Contact"
        description="Create a customer record that can be linked to enquiries and projects."
        breadcrumbs={[{ label: 'Contacts', href: '/staff/contacts' }, { label: 'New contact' }]}
        right={
          <HeaderActions>
            <PortalIndexLink variant="secondary" href="/staff/contacts">Contacts</PortalIndexLink>
          </HeaderActions>
        }
      />

      <Card title="Contact details" aria-label="Contact form">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy || !canSubmit) return;
            setError(null);
            setBusy(true);
            try {
              const response = await apiJson<{ contact: Contact }>('/api/contacts', {
                method: 'POST',
                body: JSON.stringify({
                  displayName: draft.displayName.trim(),
                  email: draft.email.trim(),
                  phone: draft.phone.trim(),
                }),
              });
              upsertContactCaches(queryClient, host, response.contact);
              router.push(`/staff/contacts/${encodeURIComponent(response.contact.id)}`);
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : 'Failed to create contact');
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className={styles.formGrid}>
            <Input
              id="displayName"
              label="Name *"
              value={draft.displayName}
              onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
              required
            />
            <Input
              id="email"
              label="Email"
              type="email"
              value={draft.email}
              onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
              error={!isValidOptionalEmail(draft.email) ? 'Email must include "@".' : undefined}
            />
            <Input
              id="phone"
              label="Phone"
              type="tel"
              value={draft.phone}
              onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
            />
          </div>

          {error ? <div className={styles.status}><AlertBanner tone="error" title="Contact could not be created">{error}</AlertBanner></div> : null}

          <div className={styles.formActions}>
            <Button type="submit" disabled={!canSubmit} loading={busy}>{busy ? 'Creating...' : 'Create Contact'}</Button>
            <PortalIndexLink variant="secondary" href="/staff/contacts">Cancel</PortalIndexLink>
          </div>
        </form>

        <SupabaseEnvStatus />
      </Card>
    </PageLayout>
  );
}
