import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import JsonLd from '@/components/JsonLd';
import GuidedJourneyContext from '@/components/guided-journey/GuidedJourneyContext';
import {
  Button,
  Container,
  Eyebrow,
  Heading,
  ProcessSteps,
  Section,
  Text,
  TextLink,
} from '@/components/marketing-foundation';
import { projects } from '@/data/projects';
import { pergolaGuideEditorialReview } from '@/data/pergolaGuides';
import {
  orderGuidedItemsBySlug,
  resolveGuidedJourneyContext,
  type GuidedJourneySearchParams,
} from '@/lib/guidedJourneyContext';
import { absoluteUrl } from '@/lib/seo';
import AcrylicPergolaEnquiryForm from '../acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm';
import MobileServiceDisclosure from './MobileServiceDisclosure';
import {
  faqItems,
  generalRoofPreference,
  investmentDrivers,
  planningLinks,
  residentialProcessSteps,
  residentialProjectProof,
  roofFormLinks,
  siteSpecificChecks,
} from './content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import '../../components/seo-landing/seo-landing.css';
import './pergolas-auckland.css';

const route = '/pergolas-auckland';
const heroImage = '/images/project-riverhead-gable-01.jpg';

export const metadata: Metadata = {
  title: { absolute: 'Pergolas Auckland | Design, Build & Installation' },
  description:
    'Plan an Auckland pergola around the home, outdoor area and intended use. Compare roof forms, materials and project scope, then share the site for an initial assessment.',
  alternates: { canonical: route },
  openGraph: {
    type: 'website',
    url: route,
    title: 'Pergolas for Auckland Homes, Designed From the House Out',
    description:
      'A practical guide to planning a pergola around the home, the outdoor room and the conditions that reach the site.',
    images: [
      {
        url: heroImage,
        alt: 'Poolside gable pergola beside an Auckland home',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pergolas for Auckland Homes, Designed From the House Out',
    description:
      'Compare roof form, material, daylight, shelter and scope before planning an Auckland pergola.',
    images: [heroImage],
  },
};

const baseProjectProof = residentialProjectProof.flatMap((proof) => {
  const project = projects.find((candidate) => candidate.slug === proof.slug);
  return project ? [{ ...proof, project }] : [];
});

type PergolasAucklandPageProps = {
  searchParams?: Promise<GuidedJourneySearchParams>;
};

export default async function PergolasAucklandPage({
  searchParams,
}: PergolasAucklandPageProps) {
  const guidedContext = resolveGuidedJourneyContext(
    'residential-cover',
    searchParams ? await searchParams : {},
  );
  const projectProof = orderGuidedItemsBySlug(
    baseProjectProof,
    guidedContext?.preferredProjectSlugs,
  );
  const breadcrumbSchema = {
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
        item: absoluteUrl('/pergola-guides'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Pergolas Auckland',
        item: absoluteUrl(route),
      },
    ],
  };

  return (
    <main
      className="acrylic-landing pergolas-auckland"
      data-marketing-foundation-page
      data-seo-landing="pergolas-auckland"
    >
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Pergolas Auckland',
            url: absoluteUrl(route),
            description: metadata.description,
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
            '@type': 'Service',
            name: 'Pergola design, build and installation in Auckland',
            serviceType: 'Pergola design and installation',
            areaServed: { '@type': 'City', name: 'Auckland' },
            provider: {
              '@type': 'Organization',
              name: 'Sanctuary Pergolas',
              url: absoluteUrl('/'),
            },
            url: absoluteUrl(route),
          },
          breadcrumbSchema,
        ]}
      />

      <section
        className="acrylic-hero"
        aria-labelledby="pergolas-auckland-title"
        data-service-major-section="hero"
      >
        <Image
          src={heroImage}
          alt="Poolside gable pergola and outdoor room beside an Auckland home"
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
            Pergola design and installation in Auckland
          </Eyebrow>
          <Heading as="h1" variant="page" id="pergolas-auckland-title">
            Custom pergolas for Auckland homes.
          </Heading>
          <Text size="large" className="acrylic-hero__intro">
            Designed around your house, outdoor area and how you want to use it.
          </Text>
          <div className="acrylic-hero__actions">
            <Button href="#project-details">
              Send photos and dimensions
            </Button>
            <TextLink href="#project-evidence">View projects</TextLink>
          </div>
          <ul
            className="acrylic-hero__proof"
            aria-label="Sanctuary pergola approach"
          >
            <li>Designed for the site</li>
            <li>Built projects across Auckland</li>
            <li>One design and installation team</li>
          </ul>
        </Container>
      </section>

      <GuidedJourneyContext context={guidedContext} />

      <Section
        id="design-brief"
        className="acrylic-section acrylic-section--opening"
        aria-labelledby="one-connected-design"
        data-service-major-section="fit"
      >
        <Container width="wide" className="acrylic-intro-grid">
          <div>
            <Eyebrow className="acrylic-eyebrow">The brief</Eyebrow>
            <Heading id="one-connected-design">
              Start with what the space needs to do.
            </Heading>
          </div>
          <div className="acrylic-prose acrylic-prose--large">
            <p>Name the intended use, what should stay open and the main weather or privacy issue.</p>
          </div>
        </Container>
      </Section>

      <Section
        className="acrylic-section"
        aria-labelledby="completed-projects"
        id="project-evidence"
        data-service-major-section="proof"
      >
        <Container width="wide">
          <header className="acrylic-section__header acrylic-section__header--wide">
            <Eyebrow className="acrylic-eyebrow">
              Built in Auckland
            </Eyebrow>
            <Heading id="completed-projects">
              Three homes. Three responses.
            </Heading>
          </header>
          <div className="acrylic-project-grid">
            {projectProof.map(({ project, label, summary, facts }) => (
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
                    sizes="(max-width: 720px) 100vw, 50vw"
                    style={{
                      objectPosition: project.heroImage.objectPosition,
                    }}
                  />
                </div>
                <div className="acrylic-project-card__body">
                  <Eyebrow className="acrylic-eyebrow">{label}</Eyebrow>
                  <h3>{project.title}</h3>
                  <p className="acrylic-project-card__location">
                    {project.location} · {project.roof}
                  </p>
                  <p>{summary}</p>
                  <ul className="seo-landing__project-facts">
                    {facts.map((fact) => <li key={fact}>{fact}</li>)}
                  </ul>
                  <span>View project</span>
                </div>
              </Link>
            ))}
          </div>
          <div className="acrylic-section__action">
            <Button href="/projects" variant="outline">
              View all projects
            </Button>
            <Button
              href="#project-details"
              className="pergolas-auckland__mobile-project-cta"
            >
              Send my brief
            </Button>
          </div>
        </Container>
      </Section>

      <Section
        tone="warm"
        className="acrylic-section acrylic-section--process"
        aria-labelledby="clear-process"
        data-service-major-section="process"
      >
        <Container width="wide">
          <header className="acrylic-section__header acrylic-section__header--wide">
            <Eyebrow className="acrylic-eyebrow">
              The process
            </Eyebrow>
            <Heading id="clear-process">
              From brief to agreed scope.
            </Heading>
          </header>
          <ProcessSteps items={[...residentialProcessSteps]} />
        </Container>
      </Section>

      <Section
        className="acrylic-section"
        aria-labelledby="investment-drivers"
        data-service-major-section="investment"
      >
        <Container width="wide">
          <div className="acrylic-intro-grid">
            <div>
              <Eyebrow className="acrylic-eyebrow">
                Cost follows scope
              </Eyebrow>
              <Heading id="investment-drivers">
                What shapes cost.
              </Heading>
              <Link href="/pergola-cost-auckland">
                Read the cost guide
              </Link>
            </div>
            <div className="acrylic-price-grid">
              {investmentDrivers.map(({ title, text }) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <MobileServiceDisclosure
        kind="service-planning-support"
        summary="Roof forms, site checks and useful guides"
      >
        <div data-service-major-section="support">
          <Section
            id="roofing-options"
            tone="warm"
            className="acrylic-section"
            aria-labelledby="roof-form-options"
          >
            <Container width="wide">
              <header className="acrylic-section__header acrylic-section__header--wide">
                <Eyebrow className="acrylic-eyebrow">
                  Compare form after fit
                </Eyebrow>
                <Heading id="roof-form-options">
                  Four roof forms, each with a different consequence
                </Heading>
              </header>
              <div className="acrylic-form-grid">
                {roofFormLinks.map((form) => (
                  <Link
                    className="acrylic-form-card"
                    href={form.href}
                    key={form.title}
                  >
                    <h3>{form.title}</h3>
                    <p>{form.text}</p>
                    <span>Explore this form</span>
                  </Link>
                ))}
              </div>
            </Container>
          </Section>

          <Section
            tone="neutral"
            className="acrylic-section"
            aria-labelledby="site-dependent"
          >
            <Container width="wide">
              <header className="acrylic-section__header acrylic-section__header--wide">
                <Eyebrow className="acrylic-eyebrow">
                  Project-specific by necessity
                </Eyebrow>
                <Heading id="site-dependent">
                  Some answers should wait for the completed design
                </Heading>
              </header>
              <div className="acrylic-benefit-grid">
                {siteSpecificChecks.map((check, index) => (
                  <article className="acrylic-benefit" key={check.title}>
                    <span className="acrylic-index" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3>{check.title}</h3>
                    <p>{check.text}</p>
                  </article>
                ))}
              </div>
            </Container>
          </Section>

          <Section
            tone="neutral"
            className="acrylic-section"
            aria-labelledby="continue-the-brief"
          >
            <Container width="wide">
              <header className="acrylic-section__header acrylic-section__header--wide">
                <Eyebrow className="acrylic-eyebrow">Useful next guides</Eyebrow>
                <Heading id="continue-the-brief">
                  Continue only with the question in front of you
                </Heading>
              </header>
              <div className="acrylic-form-grid">
                {planningLinks.map((guide) => (
                  <Link
                    className="acrylic-form-card"
                    href={guide.href}
                    key={guide.href}
                  >
                    <h3>{guide.title}</h3>
                    <p>{guide.text}</p>
                    <span>{guide.label}</span>
                  </Link>
                ))}
              </div>
            </Container>
          </Section>

          <Section
            tone="elevated"
            className="acrylic-section acrylic-section--faq"
            aria-labelledby="pergolas-auckland-faq"
          >
            <Container width="wide">
              <header className="acrylic-section__header acrylic-section__header--wide">
                <Eyebrow className="acrylic-eyebrow">
                  Questions worth resolving
                </Eyebrow>
                <Heading id="pergolas-auckland-faq">
                  Planning a pergola in Auckland
                </Heading>
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
        </div>
      </MobileServiceDisclosure>

      <Section
        id="project-details"
        tone="warm"
        className="acrylic-section acrylic-section--estimate"
        aria-label="Auckland pergola project enquiry form"
      >
        <Container width="wide">
          <AcrylicPergolaEnquiryForm
            initialEnquiryType="residential"
            sourceContext={guidedContext?.enquiryContext ?? {
              enquiryType: 'residential',
              sourcePath: route,
              sourceComponent: 'embedded_form',
            }}
            eyebrow="Project brief"
            heading="Tell us about your project."
            intro="Share the site, intended use and what you know so far."
            submitLabel="Send project brief"
            messageLabel="Your project"
            messagePlaceholder="How will you use the space? What should the pergola improve?"
            briefFields={[
              {
                name: 'siteAddress',
                label: 'Project address',
                type: 'text',
                placeholder: 'Street address, if you are ready to share it',
                wide: true,
              },
              {
                name: 'intendedUse',
                label: 'Intended use',
                type: 'text',
                placeholder:
                  'For example: dining, cooking, poolside or everyday family use',
                wide: true,
              },
            ]}
            roofPreference={generalRoofPreference}
          />
        </Container>
      </Section>
    </main>
  );
}
