import type { ReactNode } from 'react';
import { ActionGroup, Button, Container, Eyebrow, Heading, Text, TextLink } from '../../components/marketing-foundation/Primitives';
import type { EnquiryContext } from '@/lib/enquiryContext';
import { buildAssistedEnquiryHref, buildConfiguratorEnquiryHref } from '../../lib/configuratorEntry';
import styles from './simple-pergolas-auckland.module.css';

export default function SimplePergolaJourney({ children, sourceContext }: {
  children: ReactNode; sourceContext: EnquiryContext;
}) {
  const designHref = buildConfiguratorEnquiryHref(sourceContext);
  return <>
    <section className={`${styles.calculatorSection} ${styles.designEntry}`} id="price-your-cover" aria-labelledby="simple-design-title">
      <Container width="wide">
        <Eyebrow>Your pergola</Eyebrow>
        <Heading id="simple-design-title">Start with your space.</Heading>
        <Text>Choose your dimensions, roof, sides and lighting in one designer. See an installed estimate including GST where pricing is available, without entering contact details.</Text>
        <ActionGroup>
          <Button href={designHref}>Design your pergola</Button>
          <TextLink href={buildAssistedEnquiryHref(sourceContext, 'help')}>Need help choosing?</TextLink>
        </ActionGroup>
      </Container>
    </section>
    {children}
    <section className={`${styles.estimate} ${styles.designEntry}`} id="initial-estimate" aria-labelledby="simple-measure-title">
      <Container width="wide">
        <Eyebrow>The next step</Eyebrow>
        <Heading id="simple-measure-title">A design, then a site measure.</Heading>
        <Text>When you are ready, send us your design. Site measures and evaluations are free in Auckland. Outside Auckland, we confirm availability and travel costs before arranging a visit.</Text>
        <Text>We review each request and typically respond within the working day. Submitting a request does not book an appointment.</Text>
        <ActionGroup>
          <Button href={designHref}>Design your pergola</Button>
          <TextLink href={buildAssistedEnquiryHref(sourceContext, 'bespoke')}>Need a bespoke design?</TextLink>
        </ActionGroup>
      </Container>
    </section>
  </>;
}
