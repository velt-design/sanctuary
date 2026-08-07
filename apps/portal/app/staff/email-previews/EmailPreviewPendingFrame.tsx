import PageHeader from '@/components/layout/PageHeader';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { Badge, Button, PageLayout, Select } from '@/components/ui/foundation';
import { EmailPreviewPendingCanvas } from './EmailPreviewPendingCanvas';
import styles from './email-previews.module.css';

const headerProps = {
  variant: 'detail',
  eyebrow: 'Marketing',
  title: 'Enquiry email workbench',
  description:
    'Choose a project scenario, compare three exact email designs, then send labelled proofs to the fixed review inbox.',
} as const;

export default function EmailPreviewPendingFrame({
  qaFixture = false,
}: {
  qaFixture?: boolean;
}) {
  return (
    <PageLayout
      width="full"
      data-ui-foundation-consumer="email-previews"
      data-portal-page-shell="email-previews"
      data-portal-page-shell-ready="true"
    >
      <div data-portal-shell-region="email-previews-header">
        {qaFixture ? (
          <PageHeader {...headerProps} />
        ) : (
          <StaffPageHeader {...headerProps} searchShortcutEnabled={false} />
        )}
      </div>

      <section
        className={styles.workspace}
        aria-label="Customer enquiry email design workbench"
        data-email-preview-background-ready="false"
      >
        <div data-portal-shell-region="email-previews-controls">
          <div className={styles.controlDeck}>
            <section className={styles.fixturePanel} aria-labelledby="pending-email-fixture-title">
              <header className={styles.panelHeading}>
                <span className={styles.stepNumber} aria-hidden="true">01</span>
                <div>
                  <p className={styles.eyebrow}>Project scenario</p>
                  <h2 id="pending-email-fixture-title">Choose the enquiry</h2>
                </div>
                <Badge>Example 01</Badge>
              </header>
              <div className={styles.fixtureFields}>
                <Select label="Customer type" disabled><option>Residential</option></Select>
                <Select label="Roof form" disabled><option>Loading…</option></Select>
                <Select label="Outdoor blinds" disabled><option>Loading…</option></Select>
              </div>
              <div className={styles.fixtureIdentity}>
                <div className={styles.fixtureImagePlaceholder} aria-hidden="true" />
                <div>
                  <span>Completed project shown</span>
                  <strong data-portal-value-slot="loading">Resolving project reference</strong>
                </div>
              </div>
            </section>

            <section className={styles.viewPanel} aria-labelledby="pending-email-view-title">
              <header className={styles.panelHeading}>
                <span className={styles.stepNumber} aria-hidden="true">02</span>
                <div>
                  <p className={styles.eyebrow}>Design review</p>
                  <h2 id="pending-email-view-title">Compare the emails</h2>
                </div>
              </header>
              <div className={styles.viewControls}>
                {['Mode', 'Viewport', 'Simulation', 'Zoom'].map((label) => (
                  <Button variant="quiet" size="small" disabled key={label}>{label}</Button>
                ))}
              </div>
              <p className={styles.viewSummary}>
                <strong>Compare · Desktop · light · 75%</strong>
                <span>Theme is simulated; the exact email HTML remains isolated.</span>
              </p>
            </section>

            <section className={styles.deliveryPanel} aria-labelledby="pending-email-delivery-title">
              <header className={styles.panelHeading}>
                <span className={styles.stepNumber} aria-hidden="true">03</span>
                <div>
                  <p className={styles.eyebrow}>Inbox proof</p>
                  <h2 id="pending-email-delivery-title">Send for review</h2>
                </div>
              </header>
              <dl className={styles.deliveryFacts}>
                <div><dt>Recipient</dt><dd data-portal-value-slot="loading">Loading…</dd></div>
                <div><dt>Environment</dt><dd data-portal-value-slot="loading">Loading…</dd></div>
              </dl>
              <div className={styles.deliveryActions}>
                <Button disabled>Send selected</Button>
                <Button disabled variant="secondary">Send all</Button>
              </div>
            </section>
          </div>
        </div>

        <EmailPreviewPendingCanvas />
      </section>
    </PageLayout>
  );
}
