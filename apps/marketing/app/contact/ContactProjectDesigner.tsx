'use client';

import { useEffect } from 'react';
import ConfiguratorPrototype from '@/components/configurator-prototype/ConfiguratorPrototype';
import { usePreviewExpansion } from '@/components/configurator-prototype/usePreviewExpansion';
import ContactEnquiryForm, { type ContactEnquiryFormProps } from './ContactEnquiryForm';
import { buildContactDesignBrief } from './contactDesignBrief';
import styles from './projectDesigner.module.css';

export default function ContactProjectDesigner(props: ContactEnquiryFormProps) {
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
        <h1>Start your project.</h1>
        <nav aria-label="Project steps"><a href="#project-design">Design</a><a href="#contact-form">Project details ↓</a></nav>
      </header>
      <ConfiguratorPrototype expanded={expanded} onToggleExpanded={toggleExpanded} renderEnquiry={selection => <>
        <div className={styles.continue}>
          <a className="contact-action contact-action--primary" href="#contact-form">Continue to project details ↓</a>
          <p>Keep your design in view while you tell us about the site.</p>
        </div>
        <div className={styles.enquiry}>
          <ContactEnquiryForm {...props} configuredDesign={buildContactDesignBrief(selection)} />
          <p className={styles.other}>Planning something different? <a href="/contact">Send a custom or business brief ↗</a></p>
        </div>
      </>} />
    </div>
    <noscript><a href="/contact">Open the project enquiry form</a></noscript>
  </main>;
}
