import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import JsonLd from '@/components/JsonLd';
import {
  Container,
  Eyebrow,
  Heading,
  Section,
  Text,
} from '@/components/marketing-foundation';
import { pergolaGuideChapters, pergolaGuideEditorialReview, pergolaGuides } from '@/data/pergolaGuides';
import { absoluteUrl } from '@/lib/seo';
import { WARKWORTH_EXTERIOR_IMAGE, WARKWORTH_EXTERIOR_OBJECT_POSITION } from '@/lib/projectImageFraming';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import './pergola-guides.css';

const route = '/pergola-guides';
const heroImage = WARKWORTH_EXTERIOR_IMAGE;
export const metadata: Metadata = {
  title: { absolute: 'Pergola Design Guides | Sanctuary Pergolas' },
  description:
    'Explore Sanctuary Pergolas guides to planning, forms, materials, cost, blinds, outdoor rooms and commercial pergola projects in Auckland.',
  alternates: { canonical: route },
  openGraph: {
    type: 'website',
    url: route,
    title: 'The Sanctuary Pergola Design Library',
    description:
      'Ten practical guides, organised around the decisions that shape a considered pergola or outdoor room.',
    images: [{
      url: heroImage,
      alt: 'Architectural gable outdoor room designed by Sanctuary Pergolas',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Sanctuary Pergola Design Library',
    description:
      'Ten practical guides to planning a pergola, choosing its form and comparing the decisions that shape its scope.',
    images: [heroImage],
  },
};

export default function PergolaGuidesPage() {
  return (
    <main
      className="acrylic-landing pergola-guide-hub"
      data-marketing-foundation-page
      data-pergola-guide-hub
    >
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Sanctuary Pergola Design Library',
            description: metadata.description,
            url: absoluteUrl(route),
            primaryImageOfPage: absoluteUrl(heroImage),
            dateModified: pergolaGuideEditorialReview.date,
            reviewedBy: {
              '@type': 'Organization',
              name: pergolaGuideEditorialReview.reviewer,
              url: absoluteUrl('/'),
            },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Sanctuary pergola design guides',
            numberOfItems: pergolaGuides.length,
            itemListElement: pergolaGuides.map((guide, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: guide.title,
              url: absoluteUrl(guide.href),
            })),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: absoluteUrl('/'),
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Pergola Guides',
                item: absoluteUrl(route),
              },
            ],
          },
        ]}
      />

      <section className="guide-hub-hero" aria-labelledby="guide-hub-title">
        <div className="guide-hub-hero__copy">
          <Eyebrow className="guide-hub-hero__eyebrow">Sanctuary pergola design library</Eyebrow>
          <Heading as="h1" variant="page" id="guide-hub-title">
            Pergola guides.
          </Heading>
          <Text size="large">
            Start with the decision you need to make.
          </Text>
          <p className="guide-hub-hero__review">
            Editorial review: {pergolaGuideEditorialReview.reviewer} ·{' '}
            <time dateTime={pergolaGuideEditorialReview.date}>{pergolaGuideEditorialReview.dateLabel}</time>
          </p>
        </div>

        <figure className="guide-hub-hero__figure">
          <Image
            src={heroImage}
            alt="Gable outdoor room with timber-lined ceiling and open garden edges"
            fill
            priority
            loading="eager"
            fetchPriority="high"
            sizes="(max-width: 800px) 100vw, 50vw"
            className="guide-hub-hero__image"
            style={{ objectPosition: WARKWORTH_EXTERIOR_OBJECT_POSITION }}
          />
          <figcaption>
            <span>Warkworth outdoor room</span>
          </figcaption>
        </figure>
      </section>

      <Section id="guide-library" className="guide-hub-index" aria-labelledby="guide-library-title">
        <Container width="wide">
          <div className="guide-hub-index__intro">
            <Heading id="guide-library-title">Choose a guide.</Heading>
          </div>
        </Container>
      </Section>

      {pergolaGuideChapters.map((chapter) => (
        <Section
          key={chapter.id}
          id={chapter.id}
          tone={chapter.number === '02' ? 'warm' : 'canvas'}
          className="guide-hub-group"
          aria-labelledby={`${chapter.id}-title`}
        >
          <Container width="wide" className="guide-hub-group__layout">
            <header className="guide-hub-group__header">
              <Eyebrow>{chapter.eyebrow}</Eyebrow>
              <Heading id={`${chapter.id}-title`}>{chapter.title}</Heading>
            </header>

            <div className="guide-hub-list">
              {chapter.guides.map((guide) => (
                <article
                  aria-labelledby={`guide-${guide.number}-title`}
                  key={guide.href}
                  className="guide-hub-card"
                  data-guide-card
                >
                  <span className="guide-hub-card__number">{guide.number}</span>
                  <div className="guide-hub-card__heading">
                    <h3 id={`guide-${guide.number}-title`}>
                      <Link
                        href={guide.href}
                        className="guide-hub-card__link"
                        data-guide-link
                      >
                        {guide.title}
                      </Link>
                    </h3>
                  </div>
                  <p className="guide-hub-card__summary">{guide.summary}</p>
                  <span className="guide-hub-card__arrow" aria-hidden="true">→</span>
                </article>
              ))}
            </div>
          </Container>
        </Section>
      ))}

    </main>
  );
}
