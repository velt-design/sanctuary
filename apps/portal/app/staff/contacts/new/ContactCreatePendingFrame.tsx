import HeaderActions from '@/components/layout/HeaderActions';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import PortalIndexLink from '@/components/navigation/PortalIndexLink';
import { Button, Input } from '@/components/ui/foundation/FoundationControls';
import { Card, PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import styles from '../contacts.module.css';

export default function ContactCreatePendingFrame() {
  return (
    <PageLayout
      className={styles.page}
      data-portal-page-shell="contact-create"
      data-portal-page-shell-ready="true"
      data-portal-page-shell-state="pending"
    >
      <StaffPageHeader
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
      <Card title="Contact details" aria-label="Contact form" data-portal-page-region="contact-form">
        <div className={styles.formGrid}>
          <Input id="displayNamePending" label="Name *" disabled />
          <Input id="emailPending" label="Email" type="email" disabled />
          <Input id="phonePending" label="Phone" type="tel" disabled />
        </div>
        <div className={styles.formActions}>
          <Button type="button" disabled>Create Contact</Button>
          <PortalIndexLink variant="secondary" href="/staff/contacts">Cancel</PortalIndexLink>
        </div>
      </Card>
    </PageLayout>
  );
}
