'use client';

import { lazy, Suspense, useRef, useState } from 'react';
import { Button } from '@/components/ui/foundation/FoundationControls';
import type { Contact } from '@/lib/types/contact';
import styles from './contacts.module.css';

const loadContactsImportDialog = () => import('./ContactsImportDialog');
const ContactsImportDialog = lazy(loadContactsImportDialog);

export default function ContactsImportAction({ contacts, host }: { contacts: Contact[]; host: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const prepare = () => { void loadContactsImportDialog(); };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => inputRef.current?.click()}
        onMouseEnter={prepare}
        onFocus={prepare}
        onPointerDown={prepare}
        onTouchStart={prepare}
      >Import CSV</Button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className={styles.fileInput}
        onChange={(event) => {
          const nextFile = event.target.files?.[0] ?? null;
          event.target.value = '';
          if (nextFile) setFile(nextFile);
        }}
      />
      {file ? (
        <Suspense fallback={null}>
          <ContactsImportDialog
            file={file}
            contacts={contacts}
            host={host}
            onClose={() => setFile(null)}
          />
        </Suspense>
      ) : null}
    </>
  );
}
