import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import JsonLd from '@/components/JsonLd';
import {
  Button,
  Container,
  Eyebrow,
  Heading,
  Section,
  Text,
} from '@/components/marketing-foundation';
import { projects } from '@/data/projects';
import { absoluteUrl } from '@/lib/seo';
import AcrylicPergolaEnquiryForm from './AcrylicPergolaEnquiryForm';
import {
  comfortFactors,
  faqItems,
  tintOptions,
  weatherDetails,
} from './content';
import './acrylic-roof-pergolas-auckland.css';

const route = '/acrylic-roof-pergolas-auckland';
const heroImage = '/images/project-dairy-flat-01.jpg';

export const metadata: Metadata = {
  title: { absolute: 'Acrylic Roof Pergolas Auckland | Sanctuary Pergolas' },
  description:
    'Compare clear, grey and opal acrylic roofing, see completed Auckland pergolas and send Sanctuary your project brief.',
  alternates: { canonical: route },
  openGraph: {
    type: 'website',
    url: route,
    title: 'Acrylic Roof Pergolas for Auckland Homes',
    description:
      'Plan an acrylic roof around daylight, shade, drainage and the home.',
    images: [{
      url: heroImage,
      alt: 'Acrylic-roof gable pergola extending an Auckland home',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Acrylic Roof Pergolas for Auckland Homes',
    description:
      'Plan an acrylic roof around daylight, shade, drainage and the home.',
    images: [heroImage],
  },
};

const projectProof = [
  {
    slug: 'warkworth-outdoor-room',
    label: 'Clear acrylic and mixed roofing',
    summary:
      'A freestanding gable combines clear acrylic, solid roofing and cedar lining.',
  },
  {
    slug: 'st-heliers-townhouse',
    label: 'Opal acrylic',
    summary:
      'An open gable uses opal acrylic and a custom street-facing frame.',
  },
  {
    slug: 'atelier-shu-cafe',
    label: 'Dark-tint acrylic',
    summary:
      'A dark-tint acrylic gable canopy aligns with the cafe frontage.',
  },
].flatMap((proof) => {
  const project = projects.find((candidate) => candidate.slug === proof.slug);
  return project ? [{ ...proof, project }] : [];
});

export default function AcrylicRoofPergolasAucklandPage() {
  return (
    <main
      className="acrylic-landing"
      data-marketing-foundation-page
      data-seo-landing="acrylic-roof-pergolas-auckland"
    >
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Acrylic Roof Pergolas Auckland',
            url: absoluteUrl(route),
            description: metadata.description,
            primaryImageOfPage: absoluteUrl(heroImage),
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
                name: 'Acrylic Roof Pergolas Auckland',
                item: absoluteUrl(route),
              },
            ],
          },
        ]}
      />

      <section className="acrylic-hero" aria-labelledby="acrylic-hero-title">
        <Image
          src={heroImage}
          alt="Gable pergola with acrylic roofing beside an Auckland home"
          fill
          priority
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
          className="acrylic-hero__image"
        />
        <div className="acrylic-hero__shade" aria-hidden="true" />
        <Container width="wide" className="acrylic-hero__content">
          <Eyebrow className="acrylic-eyebrow">
            Acrylic roof pergolas in Auckland
          </Eyebrow>
          <Heading as="h1" variant="page" id="acrylic-hero-title">
            Acrylic roof pergolas for Auckland homes.
          </Heading>
          <Text size="large" className="acrylic-hero__intro">
            Acrylic roofing can provide cover while keeping daylight. The
            right tint, roof form and depth depend on your home, sun and how
            you use the deck.
          </Text>
          <div className="acrylic-hero__actions">
            <Button href="#project-details">Send project brief</Button>
            <Link href="#acrylic-options">Compare acrylic options</Link>
          </div>
          <ul className="acrylic-hero__proof" aria-label="Acrylic roof approach">
            <li>Site-specific tint</li>
            <li>Roof and drainage designed together</li>
            <li>Built project evidence</li>
          </ul>
        </Container>
      </section>

      <Section
        id="acrylic-options"
        tone="warm"
        className="acrylic-section acrylic-section--tints"
        aria-labelledby="compare-tints"
      >
        <Container width="wide">
          <header className="acrylic-section__header acrylic-section__header--wide">
            <Eyebrow className="acrylic-eyebrow">Tint comparison</Eyebrow>
            <Heading id="compare-tints">
              Clear, light grey, dark grey or opal?
            </Heading>
            <Text size="large">
              Choose for the whole site, not a small sample.
            </Text>
          </header>
          <div className="acrylic-tint-grid">
            {tintOptions.map((tint) => (
              <article className="acrylic-tint" key={tint.name}>
                <div
                  className={`acrylic-tint__swatch acrylic-tint__swatch--${tint.tone}`}
                  aria-hidden="true"
                />
                <h3>{tint.name}</h3>
                <dl>
                  <div><dt>Look</dt><dd>{tint.visual}</dd></div>
                  <div><dt>Daylight</dt><dd>{tint.daylight}</dd></div>
                  <div><dt>Assess</dt><dd>{tint.assess}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      <Section
        className="acrylic-section"
        aria-labelledby="comfort-and-weather"
      >
        <Container width="wide" className="acrylic-intro-grid">
          <div>
            <Eyebrow className="acrylic-eyebrow">Comfort and weather</Eyebrow>
            <Heading id="comfort-and-weather">
              The roof product is only one part.
            </Heading>
            <ul className="acrylic-two-column-list">
              {comfortFactors.map((factor) => <li key={factor}>{factor}</li>)}
            </ul>
          </div>
          <div className="acrylic-price-grid">
            {weatherDetails.map((detail) => (
              <article key={detail.title}>
                <h3>{detail.title}</h3>
                <p>{detail.text}</p>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      <Section
        tone="neutral"
        className="acrylic-section"
        aria-labelledby="completed-projects"
      >
        <Container width="wide">
          <header className="acrylic-section__header acrylic-section__header--wide">
            <Eyebrow className="acrylic-eyebrow">Built examples</Eyebrow>
            <Heading id="completed-projects">
              Three acrylic roof responses.
            </Heading>
          </header>
          <div className="acrylic-project-grid">
            {projectProof.map(({ project, label, summary }) => (
              <Link
                href={`/projects/${project.slug}`}
                className="acrylic-project-card"
                key={project.slug}
              >
                <div className="acrylic-project-card__media">
                  <Image
                    src={project.heroImage.src}
                    alt={project.heroImage.alt}
                    fill
                    sizes="(max-width: 720px) 100vw, 33vw"
                    style={{ objectPosition: project.heroImage.objectPosition }}
                  />
                </div>
                <div className="acrylic-project-card__body">
                  <Eyebrow className="acrylic-eyebrow">{label}</Eyebrow>
                  <h3>{project.title}</h3>
                  <p>{summary}</p>
                  <span>View project</span>
                </div>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      <Section
        tone="inverse"
        className="acrylic-section acrylic-section--dark"
        aria-labelledby="product-evidence"
      >
        <Container width="wide">
          <header className="acrylic-section__header acrylic-section__header--wide">
            <Eyebrow className="acrylic-eyebrow">Project evidence</Eyebrow>
            <Heading id="product-evidence">
              Name the exact fixed-roof assembly in the proposal.
            </Heading>
          </header>
          <div className="acrylic-weather-grid">
            <article>
              <h3>Roof product</h3>
              <p>Confirm the product, thickness, tint and current limitations.</p>
            </article>
            <article>
              <h3>Complete assembly</h3>
              <p>Confirm the frame, fall, joints, flashings, gutters and outlets.</p>
            </article>
            <article>
              <h3>Written documents</h3>
              <p>Use current care and warranty information for the selected products.</p>
            </article>
          </div>
          <p>
            Consent depends on the final design and property. We’ll identify
            the checks needed for your project.
          </p>
          <nav
            className="acrylic-inline-links"
            aria-label="Related roof and cost guides"
          >
            <Link href="/acrylic-pergolas-vs-louvre-roofs">
              Compare fixed roofs with a louvre proposal
            </Link>
            <Link href="/pergola-cost-auckland">
              Review scope and quote comparison
            </Link>
          </nav>
        </Container>
      </Section>

      <Section
        tone="elevated"
        className="acrylic-section acrylic-section--faq"
        aria-labelledby="acrylic-faq"
      >
        <Container width="wide">
          <header className="acrylic-section__header">
            <Eyebrow className="acrylic-eyebrow">Questions</Eyebrow>
            <Heading id="acrylic-faq">Acrylic pergola questions.</Heading>
          </header>
          <div className="acrylic-faq-list">
            {faqItems.map((item, index) => (
              <details key={item.question}>
                <summary>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{item.question}</h3>
                  <i aria-hidden="true" />
                </summary>
                <div>
                  {item.answer.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </Container>
      </Section>

      <Section
        id="project-details"
        tone="warm"
        className="acrylic-section acrylic-section--estimate"
        aria-label="Acrylic pergola project enquiry form"
      >
        <Container width="wide">
          <AcrylicPergolaEnquiryForm
            initialEnquiryType="residential"
            sourceContext={{
              enquiryType: 'residential',
              sourcePath: route,
              sourceComponent: 'embedded_form',
            }}
            eyebrow="Project brief"
            heading="Tell us about your project."
            intro="Share the site, intended use and what you know so far."
            submitLabel="Send project brief"
          />
        </Container>
      </Section>
    </main>
  );
}
