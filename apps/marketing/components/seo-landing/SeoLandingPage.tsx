import Image from 'next/image';
import JsonLd from '@/components/JsonLd';
import { Button, Container, Eyebrow, Heading, Section, Text, TextLink } from '@/components/marketing-foundation';
import AcrylicPergolaEnquiryForm from '@/app/acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm';
import { absoluteUrl } from '@/lib/seo';
import SeoLandingBlocks from './SeoLandingBlocks';
import type { SeoLandingPageConfig } from './types';

export default function SeoLandingPage({ config }: { config: SeoLandingPageConfig }) {
  const faqBlock = config.blocks.find((block) => block.kind === 'faq');
  const faqItems = faqBlock?.kind === 'faq' ? faqBlock.items : [];
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer.join('\n\n') } })),
  };

  return (
    <main className="acrylic-landing seo-landing" data-marketing-foundation-page data-seo-landing={config.marker}>
      <JsonLd data={[
        { '@context': 'https://schema.org', '@type': 'WebPage', name: config.schemaName, url: absoluteUrl(config.route), description: config.description, primaryImageOfPage: absoluteUrl(config.hero.image) },
        { '@context': 'https://schema.org', '@type': 'Service', name: config.serviceName, serviceType: config.serviceType, areaServed: { '@type': 'City', name: 'Auckland' }, provider: { '@type': 'Organization', name: 'Sanctuary Pergolas', url: absoluteUrl('/') }, url: absoluteUrl(config.route) },
        faqSchema,
      ]} />
      <section className="acrylic-hero" aria-labelledby={`${config.marker}-title`}>
        <Image src={config.hero.image} alt={config.hero.imageAlt} fill priority loading="eager" fetchPriority="high" sizes="100vw" className="acrylic-hero__image" style={{ objectPosition: config.hero.objectPosition }} />
        <div className="acrylic-hero__shade" aria-hidden="true" />
        <Container width="wide" className="acrylic-hero__content">
          <Eyebrow className="acrylic-eyebrow">{config.hero.eyebrow}</Eyebrow><Heading as="h1" variant="page" id={`${config.marker}-title`}>{config.hero.title}</Heading><Text size="large" className="acrylic-hero__intro">{config.hero.intro}</Text>
          <div className="acrylic-hero__actions"><Button href="#project-details">{config.hero.primaryCta}</Button><TextLink href={config.hero.secondaryHref}>{config.hero.secondaryCta}</TextLink></div>
          <ul className="acrylic-hero__proof" aria-label={`${config.schemaName} approach`}>{config.hero.proof.map((item) => <li key={item}>{item}</li>)}</ul>
        </Container>
      </section>
      <SeoLandingBlocks blocks={config.blocks} />
      <Section tone="inverse" className="acrylic-section acrylic-section--final-cta" aria-labelledby={`${config.marker}-final-cta`}>
        <Container width="wide" className="acrylic-final-grid"><div><Eyebrow className="acrylic-eyebrow">{config.finalCta.eyebrow}</Eyebrow><Heading id={`${config.marker}-final-cta`}>{config.finalCta.title}</Heading><p>{config.finalCta.text}</p><div className="acrylic-hero__actions"><Button href="#project-details">{config.finalCta.button}</Button></div></div><div><h3>{config.finalCta.checklistTitle}</h3><ul className="acrylic-check-list">{config.finalCta.checklist.map((item) => <li key={item}>{item}</li>)}</ul></div></Container>
      </Section>
      <Section id="project-details" tone="warm" className="acrylic-section acrylic-section--estimate" aria-label={config.form.ariaLabel}><Container width="wide"><AcrylicPergolaEnquiryForm eyebrow={config.form.eyebrow} heading={config.form.heading} intro={config.form.intro} submitLabel={config.form.submitLabel} roofPreference={config.form.roofPreference} /></Container></Section>
      <a className="acrylic-sticky-cta" href="#project-details">{config.finalCta.button}</a>
    </main>
  );
}
