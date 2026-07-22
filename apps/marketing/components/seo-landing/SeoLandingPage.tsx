import Image from 'next/image';
import JsonLd from '@/components/JsonLd';
import { Button, Container, Eyebrow, Heading, Section, Text, TextLink } from '@/components/marketing-foundation';
import AcrylicPergolaEnquiryForm from '@/app/acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm';
import { absoluteUrl } from '@/lib/seo';
import SeoLandingBlocks from './SeoLandingBlocks';
import PergolaGuideNavigation from './PergolaGuideNavigation';
import type { SeoLandingPageConfig } from './types';
import { findPergolaGuide, pergolaGuideEditorialReview } from '@/data/pergolaGuides';

export default function SeoLandingPage({ config }: { config: SeoLandingPageConfig }) {
  const guide = findPergolaGuide(config.route);
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Pergola Guides', item: absoluteUrl('/pergola-guides') },
      { '@type': 'ListItem', position: 3, name: config.schemaName, item: absoluteUrl(config.route) },
    ],
  };
  const pageSchemas = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: config.schemaName, url: absoluteUrl(config.route), description: config.description, primaryImageOfPage: absoluteUrl(config.hero.image), dateModified: pergolaGuideEditorialReview.date, reviewedBy: { '@type': 'Organization', name: pergolaGuideEditorialReview.reviewer, url: absoluteUrl('/') }, isPartOf: { '@type': 'CollectionPage', name: 'Sanctuary Pergola Design Library', url: absoluteUrl('/pergola-guides') } },
    ...(guide?.role === 'service' ? [{ '@context': 'https://schema.org', '@type': 'Service', name: config.serviceName, serviceType: config.serviceType, areaServed: { '@type': 'City', name: 'Auckland' }, provider: { '@type': 'Organization', name: 'Sanctuary Pergolas', url: absoluteUrl('/') }, url: absoluteUrl(config.route) }] : []),
    breadcrumbSchema,
  ];

  return (
    <main className="acrylic-landing seo-landing" data-marketing-foundation-page data-seo-landing={config.marker}>
      <JsonLd data={pageSchemas} />
      <section className="acrylic-hero" aria-labelledby={`${config.marker}-title`}>
        <Image src={config.hero.image} alt={config.hero.imageAlt} fill priority loading="eager" fetchPriority="high" sizes="100vw" className="acrylic-hero__image" style={{ objectPosition: config.hero.objectPosition }} />
        <div className="acrylic-hero__shade" aria-hidden="true" />
        <Container width="wide" className="acrylic-hero__content">
          <Eyebrow className="acrylic-eyebrow">{config.hero.eyebrow}</Eyebrow><Heading as="h1" variant="page" id={`${config.marker}-title`}>{config.hero.title}</Heading><Text size="large" className="acrylic-hero__intro">{config.hero.intro}</Text>
          <div className="acrylic-hero__actions"><Button href="#project-details">{config.hero.primaryCta}</Button><TextLink href={config.hero.secondaryHref}>{config.hero.secondaryCta}</TextLink></div>
          <ul className="acrylic-hero__proof" aria-label={`${config.schemaName} approach`}>{config.hero.proof.map((item) => <li key={item}>{item}</li>)}</ul>
        </Container>
      </section>
      <PergolaGuideNavigation route={config.route} />
      <SeoLandingBlocks blocks={config.blocks} />
      <Section tone="inverse" className="acrylic-section acrylic-section--final-cta" aria-labelledby={`${config.marker}-final-cta`}>
        <Container width="wide" className="acrylic-final-grid"><div><Eyebrow className="acrylic-eyebrow">{config.finalCta.eyebrow}</Eyebrow><Heading id={`${config.marker}-final-cta`}>{config.finalCta.title}</Heading><p>{config.finalCta.text}</p><div className="acrylic-hero__actions"><Button href="#project-details">{config.finalCta.button}</Button></div></div><div><h3>{config.finalCta.checklistTitle}</h3><ul className="acrylic-check-list">{config.finalCta.checklist.map((item) => <li key={item}>{item}</li>)}</ul></div></Container>
      </Section>
      <Section id="project-details" tone="warm" className="acrylic-section acrylic-section--estimate" aria-label={config.form.ariaLabel}><Container width="wide"><AcrylicPergolaEnquiryForm eyebrow={config.form.eyebrow} heading={config.form.heading} intro={config.form.intro} submitLabel={config.form.submitLabel} messageLabel={config.form.messageLabel} messagePlaceholder={config.form.messagePlaceholder} briefFields={config.form.briefFields} roofPreference={config.form.roofPreference} /></Container></Section>
    </main>
  );
}
