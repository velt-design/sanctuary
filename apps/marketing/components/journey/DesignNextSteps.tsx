import { Container, Eyebrow, Heading, Section, Text, TextLink } from '../marketing-foundation/Primitives';
import type { EnquiryContext } from '../../lib/enquiryContext';
import { buildAssistedEnquiryHref, buildConfiguratorEnquiryHref } from '../../lib/configuratorEntry';
import styles from './designNextSteps.module.css';
import DecisionTrackingRegion from './DecisionTrackingRegion';

/** Public decision support only. Pricing and supported designs remain owned by the configurator. */
export default function DesignNextSteps({ sourcePath, sourceProduct, helpHref }: {
  sourcePath: string;
  sourceProduct?: string;
  helpHref?: string;
}) {
  const context: EnquiryContext = {
    sourcePath,
    sourceProduct,
    sourceComponent: sourceProduct || sourcePath === '/products' ? 'product_cta' : 'pathway',
  };
  const enquiryHref = helpHref ?? buildAssistedEnquiryHref(context, 'help');
  return <DecisionTrackingRegion source={sourceProduct ? 'product_detail' : sourcePath === '/products' ? 'product_hub' : 'cost_guide'}><Section id="design-next-steps" tone="warm" aria-label="Choose your next step">
    <Container width="wide">
      <Eyebrow>Your next step</Eyebrow>
      <Heading>Explore a design, or work through the brief with us.</Heading>
      <div className={styles.choices}>
        <article>
          <h3>Try your design and estimate</h3>
          <Text>Choose a roof form, size and available options in the designer. See an initial installed estimate where pricing is available; some designs need an individual quote.</Text>
          <TextLink href={buildConfiguratorEnquiryHref(context)} data-journey-action="design" data-journey-destination="designer">Design and estimate</TextLink>
          <Text size="small">An estimate is subject to site measure, structural review and confirmed scope.</Text>
        </article>
        <article>
          <h3>Need help, or something bespoke?</h3>
          <Text>If you are unsure where to start, or the designer cannot represent your project, share the site and what you want to achieve. Photos and rough dimensions help us recommend the next step.</Text>
          <TextLink href={enquiryHref} data-journey-action="help" data-journey-destination="enquiry">Discuss my project</TextLink>
        </article>
      </div>
    </Container>
  </Section></DecisionTrackingRegion>;
}
