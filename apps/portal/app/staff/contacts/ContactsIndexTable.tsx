import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/foundation/FoundationSurfaces';
import styles from './contacts.module.css';

export function ContactsIndexTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead className={styles.mobileOptional}>Email</TableHead>
        <TableHead className={styles.mobileOptional}>Phone</TableHead>
        <TableHead className={styles.mobileOptional}>Created</TableHead>
        <TableHead><span className="visually-hidden">Actions</span></TableHead>
      </TableRow>
    </TableHeader>
  );
}

export function ContactsIndexPendingTable() {
  return (
    <Table className={styles.responsiveTable} aria-label="Contacts">
      <ContactsIndexTableHeader />
      <TableBody>
        {Array.from({ length: 5 }, (_, rowIndex) => (
          <TableRow key={rowIndex}>
            {Array.from({ length: 5 }, (_, columnIndex) => (
              <TableCell
                key={columnIndex}
                className={columnIndex > 0 && columnIndex < 4 ? styles.mobileOptional : undefined}
              >
                <span
                  className={styles.pendingValue}
                  data-portal-value-slot="loading"
                  aria-hidden="true"
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
