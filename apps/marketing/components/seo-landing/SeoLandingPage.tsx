import Image from 'next/image';
import Link from 'next/link';
import JsonLd from '@/components/JsonLd';
import { Button, Container, Eyebrow, Heading, Section, Text, TextLink } from '@/components/marketing-foundation';
import AcrylicPergolaEnquiryForm from '@/app/acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm';
import { absoluteUrl } from '@/lib/seo';
import SeoLandingBlocks from './SeoLandingBlocks';
import SeoLandingMobileDisclosure from './SeoLandingMobileDisclosure';
import PergolaGuideNavigation from './PergolaGuideNavigation';
import type { SeoLandingPageConfig } from './types';
import {
  buildGuideFirstLayer,
  orderSeoLandingBlocks,
} from './seoLandingViewModel';
import { findPergolaGuide, pergolaGuideEditorialReview } from '@/data/pergolaGuides';

export default function SeoLandingPage({ config }: { config: SeoLandingPageConfig }) {
  const guide = findPergolaGuide(config.route);
  const enquiryType = config.enquiryType ?? 'residential';
  const blocks = orderSeoLandingBlocks(config.blocks, config.blockOrder);
  const guideFirstLayer = config.guideFirstLayer
    ? buildGuideFirstLayer(blocks, config.guideFirstLayer)
    : null;
  const currentBreadcrumb = {
    '@type': 'ListItem',
    position: guide ? 3 : 2,
    name: config.breadcrumbLabel ?? config.schemaName,
    item: absoluteUrl(config.route),
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      ...(guide
        ? [{ '@type': 'ListItem', position: 2, name: 'Pergola Guides', item: absoluteUrl('/pergola-guides') }]
        : []),
      currentBreadcrumb,
    ],
  };
  const pageSchemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: config.schemaName,
      url: absoluteUrl(config.route),
      description: config.description,
      primaryImageOfPage: absoluteUrl(config.hero.image),
      ...(guide
        ? {
            dateModified: pergolaGuideEditorialReview.date,
            reviewedBy: { '@type': 'Organization', name: pergolaGuideEditorialReview.reviewer, url: absoluteUrl('/') },
            isPartOf: { '@type': 'CollectionPage', name: 'Sanctuary Pergola Design Library', url: absoluteUrl('/pergola-guides') },
          }
        : {}),
    },
    ...(guide?.role === 'service' || config.schemaKind === 'service'
      ? [{ '@context': 'https://schema.org', '@type': 'Service', name: config.serviceName, serviceType: config.serviceType, areaServed: { '@type': 'City', name: 'Auckland' }, provider: { '@type': 'Organization', name: 'Sanctuary Pergolas', url: absoluteUrl('/') }, url: absoluteUrl(config.route) }]
      : []),
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
      {config.showGuideNavigation === false
        ? null
        : <PergolaGuideNavigation route={config.route} />}
      {guideFirstLayer && config.guideFirstLayer ? (
        <>
          <SeoLandingBlocks blocks={[guideFirstLayer.answerBlock]} />
          <div data-guide-first-layer-project>
            <SeoLandingBlocks blocks={[guideFirstLayer.projectBlock]} />
          </div>
          <nav
            aria-label="Continue from this guide"
            className="seo-landing__guide-return"
            data-guide-first-layer-return
          >
            <Container width="wide">
              <span>Ready to place this decision back in the wider project?</span>
              <Link href={config.guideFirstLayer.returnHref}>
                {config.guideFirstLayer.returnLabel}
              </Link>
            </Container>
          </nav>
          <SeoLandingMobileDisclosure
            groupId={`${config.marker}-supporting-depth`}
            summary={config.guideFirstLayer.supportingSummary}
            supportingDepth
          >
            <SeoLandingBlocks blocks={guideFirstLayer.supportingBlocks} />
          </SeoLandingMobileDisclosure>
        </>
      ) : (
        <SeoLandingBlocks blocks={blocks} disclosureGroups={config.mobileDisclosureGroups} />
      )}
      <Section id="project-details" tone="warm" className="acrylic-section acrylic-section--estimate" aria-label={config.form.ariaLabel}><Container width="wide"><AcrylicPergolaEnquiryForm eyebrow={config.form.eyebrow} heading={config.form.heading} intro={config.form.intro} submitLabel={config.form.submitLabel} messageLabel={config.form.messageLabel} messagePlaceholder={config.form.messagePlaceholder} briefFields={config.form.briefFields} directContact={config.form.directContact} roofPreference={config.form.roofPreference} initialEnquiryType={enquiryType} sourceContext={{ enquiryType, sourcePath: config.route, sourceComponent: 'embedded_form' }} /></Container></Section>
    </main>
  );
}
