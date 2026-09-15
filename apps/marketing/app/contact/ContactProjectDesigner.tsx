'use client';
import { useEffect } from 'react';
import ConfiguratorPrototype from '@/components/configurator-prototype/ConfiguratorPrototype';
import { usePreviewExpansion } from '@/components/configurator-prototype/usePreviewExpansion';
import type { ContactEnquiryFormProps } from './ContactEnquiryForm';
import styles from './projectDesigner.module.css';

export default function ContactProjectDesigner(_props: ContactEnquiryFormProps) {
  const { expanded, toggleExpanded, collapse } = usePreviewExpansion();
  useEffect(() => {
    if (!expanded) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') collapse(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [expanded, collapse]);
  return <main className={`contact-page ${styles.page}`} data-contact-page data-project-preview>
    <div className={styles.frame}>
      <header className={styles.header}>
        <h1>Your pergola.</h1>
        <a href="/contact?enquiry_intent=bespoke#contact-form">Need a bespoke design?</a>
      </header>
      <ConfiguratorPrototype expanded={expanded} onToggleExpanded={toggleExpanded} resume />
    </div>
    <noscript><a href="/contact?enquiry_intent=bespoke">Open the project enquiry form</a></noscript>
  </main>;
}
