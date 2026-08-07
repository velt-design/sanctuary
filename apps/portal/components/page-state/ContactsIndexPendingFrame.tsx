'use client';

import HeaderActions from '@/components/layout/HeaderActions';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { Button, ButtonLink, Input, Select } from '@/components/ui/foundation/FoundationControls';
import { Card, PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import ListCountBanner from '@/components/ui/listBanner/ListCountBanner';
import { ContactsIndexPendingTable } from '@/app/staff/contacts/ContactsIndexTable';
import styles from '@/app/staff/contacts/contacts.module.css';

export default function ContactsIndexPendingFrame({ query = '' }: { query?: string }) {
  return (
    <PageLayout
      className={styles.page}
      data-portal-page-shell="contacts"
      data-portal-page-shell-ready="true"
      data-contacts-index-state="pending"
      data-ui-foundation-consumer="contacts"
      data-contacts-index-background-ready="false"
      aria-label="Opening contacts"
    >
      <StaffPageHeader
        variant="index"
        title="Contacts"
        description="Search customer records, review linked projects, or add a new enquiry contact."
        right={
          <HeaderActions>
            <Button type="button" variant="secondary" disabled>Import CSV</Button>
            <ButtonLink href="/staff/contacts/new" prefetch={false}>New Contact</ButtonLink>
          </HeaderActions>
        }
      />
      <ListCountBanner
        totalCount={null}
        visibleCount={0}
        entityLabelSingular="contact"
        entityLabelPlural="contacts"
        truncated={false}
      />
      <div className={styles.stack}>
        <Card
          title="Find contacts"
          aria-label="Search contacts"
          padding="compact"
          data-portal-page-region="contacts-filters"
        >
          <div role="search" aria-label="Search and filter" className={styles.listControls}>
            <Input
              id="contactSearchPending"
              label="Search"
              value={query}
              placeholder="Name, email, phone..."
              disabled
            />
            <Select id="contactSortPending" label="Sort" defaultValue="name_asc" disabled>
              <option value="name_asc">Name A–Z</option>
            </Select>
            <Select id="contactPageSizePending" label="Rows per page" defaultValue="50" disabled>
              <option value="50">50 rows</option>
            </Select>
          </div>
        </Card>
        <Card
          title="All contacts"
          action={<span className={styles.muted}>Updating...</span>}
          aria-label="Contacts list"
          aria-busy="true"
          padding="none"
          data-portal-page-region="contacts-list"
        >
          <ContactsIndexPendingTable />
          <span className="visually-hidden" role="status">Updating contacts...</span>
        </Card>
      </div>
    </PageLayout>
  );
}
