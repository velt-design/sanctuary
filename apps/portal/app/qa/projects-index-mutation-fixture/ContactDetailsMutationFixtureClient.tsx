'use client';

import { ContactDetailsView } from '@/app/staff/contacts/[contactId]/ContactDetailClient';
import type { Contact } from '@/lib/types/contact';
import styles from './projectsIndexMutationFixture.module.css';

const FIXTURE_CONTACT: Contact = {
  id: 'fixture-contact',
  displayName: 'Fixture Contact',
  email: 'fixture@example.invalid',
  phone: '000 000 0000',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

export default function ContactDetailsMutationFixtureClient() {
  return (
    <section className={styles.card} data-contact-details-mutation-fixture="ready">
      <p className={styles.eyebrow}>Local-first contact check</p>
      <h2 className={styles.heading}>Contact details in the background</h2>
      <p className={styles.explanation}>
        This sample uses the production contact editor, user-owned queue, and retry state.
      </p>
      <div className={styles.embeddedPage}>
        <ContactDetailsView
          contact={FIXTURE_CONTACT}
          hostKey="fixture"
          loadError={null}
          projects={[]}
          projectsLoaded
          projectsError={false}
        />
      </div>
    </section>
  );
}
