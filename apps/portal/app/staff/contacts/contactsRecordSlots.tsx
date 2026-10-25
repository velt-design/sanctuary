import {ButtonLink} from '@/components/ui/foundation/FoundationControls';
import {TableRow,TableCell} from '@/components/ui/foundation/FoundationSurfaces';
import ListCountBanner from '@/components/ui/listBanner/ListCountBanner';
import {formatPortalDateTime} from '@/lib/format/portalDateTime';
import type {ContactsIndexFrameRead} from './ContactsIndexFrame';
import styles from './contacts.module.css';

/** Genuine records only; the public table/body and safe controls have a separate owner. */
export function contactsRecordSlots(read:ContactsIndexFrameRead,page:number,pageSize:number,onPageChange:(page:number)=>void){
 const contacts=read.state==='unavailable'?[]:read.data?.contacts.rows??[];
 return {rows:<>{contacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell><strong>{contact.displayName}</strong></TableCell>
                          <TableCell className={`${styles.muted} ${styles.mobileOptional}`}>{contact.email || '\u2014'}</TableCell>
                          <TableCell className={`${styles.muted} ${styles.mobileOptional}`}>{contact.phone || '\u2014'}</TableCell>
                          <TableCell className={`${styles.muted} ${styles.mobileOptional}`}>{formatPortalDateTime(contact.createdAt)}</TableCell>
                          <TableCell className={styles.rowAction}><ButtonLink variant="quiet" size="small" href={`/staff/contacts/${encodeURIComponent(contact.id)}`}>Open</ButtonLink></TableCell>
                        </TableRow>
                      ))}</>,countNotice:<ListCountBanner compact totalCount={read.data?.contacts.totalCount??null} visibleCount={contacts.length} entityLabelSingular="contact" entityLabelPlural="contacts" truncated={read.data?.contacts.truncated??false}/>,
 onPageChange};
}
