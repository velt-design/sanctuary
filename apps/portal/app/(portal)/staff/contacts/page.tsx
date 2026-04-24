import ContactsIndexClient from './ContactsIndexClient';
import { loadContactsIndexData } from '@/lib/contacts/serverContactsIndex';

export default async function ContactsPage() {
  const initialContacts = await loadContactsIndexData();
  return <ContactsIndexClient initialContacts={initialContacts} />;
}
