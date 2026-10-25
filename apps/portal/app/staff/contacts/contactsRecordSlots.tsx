import {DataStatePanel} from '@/components/ui/foundation/FoundationDataState';
import {paginationEvidence} from '@/components/ui/foundation/FoundationPagination';
import {ButtonLink} from '@/components/ui/foundation/FoundationControls';
import {TableRow,TableCell} from '@/components/ui/foundation/FoundationSurfaces';
import ListCountBanner from '@/components/ui/listBanner/ListCountBanner';
import {formatPortalDateTime} from '@/lib/format/portalDateTime';
import type {ContactsIndexFrameRead} from './ContactsIndexFrame';
import styles from './contacts.module.css';

/** Genuine records only; the public table/body and safe controls have a separate owner. */
export function contactsRecordSlots(read:ContactsIndexFrameRead,page:number,pageSize:number,onPageChange:(page:number)=>void,onClear?:()=>void){
 const contacts=read.state==='unavailable'?[]:read.data?.contacts.rows??[];
 const query=read.data?.query.search??'';
 return {rows:<>{!contacts.length&&read.data&&read.state==='cached'?<TableRow><TableCell colSpan={5}><p role="status">Reading contacts…</p></TableCell></TableRow>:null}{!contacts.length&&read.state==='fresh'?<TableRow><TableCell colSpan={5}><DataStatePanel state={query.trim()?'filtered-empty':'empty'} title={query.trim()?'No contacts match your search.':'No contacts found.'} description={query.trim()?'Clear or adjust the search.':'Create the first contact to begin.'} onClear={query.trim()?onClear:undefined}/></TableCell></TableRow>:null}{contacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell><strong>{contact.displayName}</strong></TableCell>
                          <TableCell className={`${styles.muted} ${styles.mobileOptional}`}>{contact.email || '\u2014'}</TableCell>
                          <TableCell className={`${styles.muted} ${styles.mobileOptional}`}>{contact.phone || '\u2014'}</TableCell>
                          <TableCell className={`${styles.muted} ${styles.mobileOptional}`}>{formatPortalDateTime(contact.createdAt)}</TableCell>
                          <TableCell className={styles.rowAction}><ButtonLink variant="quiet" size="small" href={`/staff/contacts/${encodeURIComponent(contact.id)}`}>Open</ButtonLink></TableCell>
                        </TableRow>
                      ))}</>,countNotice:<ListCountBanner compact totalCount={read.data?.contacts.totalCount??null} visibleCount={contacts.length} entityLabelSingular="contact" entityLabelPlural="contacts" truncated={read.data?.contacts.truncated??false}/>,
 pagination:paginationEvidence(page,read.data?.contacts.totalPages??null,onPageChange,read.data?`${read.data.contacts.totalCount?(page-1)*pageSize+1:0}–${Math.min(page*pageSize,read.data.contacts.totalCount)} of ${read.data.contacts.totalCount}`:undefined)};
}
