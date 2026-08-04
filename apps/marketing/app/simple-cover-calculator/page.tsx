import type { Metadata } from 'next';
import SimpleCoverCalculator from '@/components/simple-cover-calculator/SimpleCoverCalculator';
import {
  Container,
  Eyebrow,
  Heading,
  MarketingPage,
  Text,
} from '@/components/marketing-foundation';
import styles from './simple-cover-calculator.module.css';

const route = '/simple-cover-calculator';

export const metadata: Metadata = {
  title: { absolute: 'Simple Cover Cost Calculator | Sanctuary Pergolas' },
  description: 'Shape a pitched acrylic Simple cover and see a live architectural concept plan with an initial installed estimate.',
  robots: { index: false, follow: true },
  alternates: { canonical: route },
  openGraph: {
    type: 'website',
    url: route,
    title: 'Simple Cover Cost Calculator',
    description: 'Adjust the footprint, see the plan and get a live initial installed estimate.',
  },
};

export default function SimpleCoverCalculatorPage() {
  return (
    <MarketingPage className={styles.page} data-indexing="noindex">
      <header className={styles.hero}>
        <Container width="wide" className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <Eyebrow>Plan + initial estimate</Eyebrow>
            <Heading as="h1" variant="page">Start with the footprint.</Heading>
          </div>
          <div className={styles.heroSupport}>
            <Text size="large">
              A live architectural concept plan and costing guide for a fascia-connected pitched acrylic Simple cover.
            </Text>
            <dl>
              <div><dt>Starting size</dt><dd>6.0 × 3.0 m</dd></div>
              <div><dt>Ground level</dt><dd>Up to 30 m²</dd></div>
              <div><dt>Elevated</dt><dd>Up to 20 m²</dd></div>
            </dl>
          </div>
        </Container>
      </header>

      <SimpleCoverCalculator />

      <section className={styles.scope} aria-labelledby="calculator-scope-title">
        <Container width="wide" className={styles.scopeGrid}>
          <div>
            <Eyebrow>What this estimate means</Eyebrow>
            <Heading id="calculator-scope-title">A useful first number, with clear boundaries.</Heading>
          </div>
          <div className={styles.scopeNotes}>
            <article>
              <span>Included</span>
              <p>GST, standard installation, fascia connection, deck brackets, normal access and a standard colour.</p>
            </article>
            <article>
              <span>Confirmed next</span>
              <p>Site measure, structural requirements, approvals and the final documented scope.</p>
            </article>
            <article>
              <span>Not included</span>
              <p>Blinds, electrical work, difficult access, non-standard finishes or bespoke structural conditions.</p>
            </article>
          </div>
        </Container>
      </section>
    </MarketingPage>
  );
}
