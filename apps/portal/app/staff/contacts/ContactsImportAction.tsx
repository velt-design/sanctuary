'use client';

import { lazy, Suspense, useRef, useState } from 'react';
import type { Contact } from '@/lib/types/contact';
import styles from '@/components/ui/surface/PortalSurface.module.css';

const loadContactsImportDialog = () => import('./ContactsImportDialog');
const ContactsImportDialog = lazy(loadContactsImportDialog);

export default function ContactsImportAction({ contacts, host }: { contacts: Contact[]; host: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const prepare = () => { void loadContactsImportDialog(); };

  return (
    <>
      <button
        type="button"
        className={styles.buttonSecondary}
        onClick={() => inputRef.current?.click()}
        onMouseEnter={prepare}
        onFocus={prepare}
        onPointerDown={prepare}
        onTouchStart={prepare}
      >
        Import CSV
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
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
