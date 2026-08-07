import HeaderActions from '@/components/layout/HeaderActions';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import PortalIndexLink from '@/components/navigation/PortalIndexLink';
import { Button } from '@/components/ui/foundation/FoundationControls';
import {
  Card,
  PageLayout,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/foundation/FoundationSurfaces';
import styles from '../contacts.module.css';

export function ContactProjectsPendingTable() {
  return (
    <Table className={styles.responsiveTable} aria-label="Projects for contact">
      <TableHeader>
        <TableRow>
          <TableHead>Project</TableHead>
          <TableHead className={styles.mobileOptional}>Region</TableHead>
          <TableHead className={styles.mobileOptional}>Created</TableHead>
          <TableHead><span className="visually-hidden">Actions</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 3 }, (_, rowIndex) => (
          <TableRow key={rowIndex}>
            {Array.from({ length: 4 }, (_, columnIndex) => (
              <TableCell
                key={columnIndex}
                className={columnIndex === 1 || columnIndex === 2 ? styles.mobileOptional : undefined}
              >
                <span className={styles.pendingValue} data-portal-value-slot="loading" aria-hidden="true" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function ContactDetailPendingFrame() {
  return (
    <PageLayout
      className={styles.page}
      data-portal-page-shell="contact-detail"
      data-portal-page-shell-ready="true"
      data-portal-page-shell-state="pending"
    >
      <StaffPageHeader
        variant="detail"
        title="Contact"
        description="Customer details and linked project history."
        breadcrumbs={[{ label: 'Contacts', href: '/staff/contacts' }, { label: 'Contact' }]}
        right={
          <HeaderActions>
            <PortalIndexLink variant="secondary" href="/staff/contacts">Contacts</PortalIndexLink>
            <Button disabled>Create Project</Button>
          </HeaderActions>
        }
      />
      <p className={styles.detailMeta}>
        Contact ID: <span className={styles.pendingInlineValue} data-portal-value-slot="loading" aria-hidden="true" />
      </p>
      <Card
        title="Contact info"
        aria-label="Contact info"
        action={<Button variant="secondary" disabled>Edit</Button>}
        data-portal-page-region="contact-info"
      >
        <Table className={styles.detailTable} aria-label="Contact details">
          <TableBody>
            {['Name', 'Email', 'Phone', 'Created', 'Updated'].map((label) => (
              <TableRow key={label}>
                <TableHead scope="row">{label}</TableHead>
                <TableCell>
                  <span className={styles.pendingValue} data-portal-value-slot="loading" aria-hidden="true" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Card
        title="Projects"
        aria-label="Projects for contact"
        aria-busy="true"
        padding="none"
        data-portal-page-region="contact-projects"
      >
        <ContactProjectsPendingTable />
        <span className="visually-hidden" role="status">Loading contact and linked projects</span>
      </Card>
    </PageLayout>
  );
}
