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
  ProcessSteps,
  Section,
  Text,
  TextLink,
} from '@/components/marketing-foundation';
import { projects } from '@/data/projects';
import { absoluteUrl } from '@/lib/seo';
import { pergolaGuideEditorialReview } from '@/data/pergolaGuides';
import AcrylicPergolaEnquiryForm from '../acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm';
import PergolaGuideNavigation from '@/components/seo-landing/PergolaGuideNavigation';
import MobileServiceDisclosure from './MobileServiceDisclosure';
import {
  conditionalDecisions,
  designOutcomes,
  designQuestions,
  edgeDecisions,
  faqItems,
  generalRoofPreference,
  processSteps,
  quoteChecklist,
  roofApproaches,
  roofForms,
  scopeFactors,
} from './content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import '../../components/seo-landing/seo-landing.css';
import './pergolas-auckland.css';

const route = '/pergolas-auckland';
const heroImage = '/images/project-riverhead-gable-01.jpg';

export const metadata: Metadata = {
  title: { absolute: 'Pergolas Auckland | Design, Build & Installation' },
  description: 'Plan an Auckland pergola around the home, outdoor area and intended use. Compare roof forms, materials and project scope, then share the site for an initial assessment.',
  alternates: { canonical: route },
  openGraph: {
    type: 'website',
    url: route,
    title: 'Pergolas for Auckland Homes, Designed From the House Out',
    description: 'A practical guide to planning a pergola around the home, the outdoor room and the conditions that reach the site.',
    images: [{
      url: heroImage,
      alt: 'Poolside gable pergola beside an Auckland home',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pergolas for Auckland Homes, Designed From the House Out',
    description: 'Compare roof form, material, daylight, shelter and scope before planning an Auckland pergola.',
    images: [heroImage],
  },
};

const projectProof = [
  {
    slug: 'warkworth-outdoor-room',
    label: 'Freestanding gable outdoor room',
    summary: 'A freestanding gable structure combines clear acrylic glazing, a solid roof zone, cedar lining, a deck and fireplace within one complete outdoor-room design.',
    facts: ['5.0 x 6.0 m footprint', '30 m² freestanding room'],
  },
  {
    slug: 'tindalls-bay-pavilion',
    label: 'Mixed roofing around a complex home',
    summary: 'Insulated panels, acrylic roof zones, timber battens and mesh blinds respond to different uses and light conditions across a layered patio and carport.',
    facts: ['108 m² patio and carport scope', 'Mixed roof and edge treatments'],
  },
  {
    slug: 'muriwai-courtyard',
    label: 'A new hip roof on a familiar footprint',
    summary: 'A hipped aluminium pergola with opal acrylic roofing replaces an older structure while retaining the courtyard layout that already worked for the home.',
    facts: ['8.0 x 5.0 m footprint', '40 m² courtyard cover'],
  },
  {
    slug: 'goodhome-commercial-terrace',
    label: 'Commercial gable integration',
    summary: 'A two-zone gable roof follows the pitch and rhythm of the existing building to create a covered hospitality courtyard with a coherent street-facing form.',
    facts: ['10.09 x 6.7 m footprint', '67.7 m² hospitality cover'],
  },
].flatMap((proof) => {
  const project = projects.find((candidate) => candidate.slug === proof.slug);
  return project ? [{ ...proof, project }] : [];
});

export default function PergolasAucklandPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Pergola Guides', item: absoluteUrl('/pergola-guides') },
      { '@type': 'ListItem', position: 3, name: 'Pergolas Auckland', item: absoluteUrl(route) },
    ],
  };

  return (
    <main className="acrylic-landing pergolas-auckland" data-marketing-foundation-page data-seo-landing="pergolas-auckland">
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

      <section className="acrylic-hero" aria-labelledby="pergolas-auckland-title">
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
          <Eyebrow className="acrylic-eyebrow">Pergola design and installation in Auckland</Eyebrow>
          <Heading as="h1" variant="page" id="pergolas-auckland-title">Pergolas for Auckland homes, designed from the house out</Heading>
          <Text size="large" className="acrylic-hero__intro">
            Sanctuary designs, builds and installs pergolas across Auckland around the home, the site and the way the outdoor area needs to work. Start with photos and rough dimensions, not a preselected product.
          </Text>
          <div className="acrylic-hero__actions">
            <Button href="#project-details">Send photos and rough dimensions</Button>
            <TextLink href="#design-brief">Plan the design brief</TextLink>
          </div>
          <ul className="acrylic-hero__proof" aria-label="Sanctuary pergola approach">
            <li>Site-specific form and layout</li>
            <li>Residential and selected commercial work</li>
            <li>Design and installation together</li>
          </ul>
        </Container>
      </section>
      <PergolaGuideNavigation route={route} />

      <Section id="design-brief" className="acrylic-section acrylic-section--opening" aria-labelledby="one-connected-design">
        <Container width="wide" className="acrylic-intro-grid">
          <div>
            <Eyebrow className="acrylic-eyebrow">One connected design</Eyebrow>
            <Heading id="one-connected-design">A pergola changes the deck, the house and the space between them</Heading>
          </div>
          <div className="acrylic-prose acrylic-prose--large">
            <p>The roof is the most visible decision, but it is not the first one.</p>
            <p>The starting point is how the outdoor area should be used, what makes it difficult today and which parts of the home should remain light and open.</p>
            <p>From there, roof form, material, post placement, drainage, side protection and accessories can be developed as one response to the site.</p>
            <p>This prevents a useful cover from solving one problem while creating another at the doors, windows, paths or edges beside it.</p>
          </div>
        </Container>
      </Section>

      <MobileServiceDisclosure
        kind="design-brief"
        summary="See the design tests that shape a useful brief"
      >
        <Section className="acrylic-section" aria-labelledby="three-tests">
          <Container width="wide">
            <header className="acrylic-section__header acrylic-section__header--wide">
              <Eyebrow className="acrylic-eyebrow">Three tests for the finished room</Eyebrow>
              <Heading id="three-tests">Useful outside. Considered inside. At home in the architecture.</Heading>
              <Text size="large">The product choice matters, but the finished relationship between the home and outdoor area matters more.</Text>
            </header>
            <div className="acrylic-benefit-grid">
              {designOutcomes.map((outcome, index) => (
                <article className="acrylic-benefit" key={outcome.title}>
                  <span className="acrylic-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <h3>{outcome.title}</h3>
                  <p>{outcome.text}</p>
                </article>
              ))}
            </div>
          </Container>
        </Section>

        <Section tone="neutral" className="acrylic-section" aria-labelledby="questions-before-form">
          <Container width="wide" className="acrylic-editorial-grid">
            <div className="acrylic-editorial-media pergolas-auckland__brief-image">
              <Image
                src="/images/project-tindalls-bay.jpg"
                alt="Auckland pergola using different roof and edge treatments around an existing home"
                fill
                sizes="(max-width: 900px) 100vw, 48vw"
              />
            </div>
            <div>
              <Eyebrow className="acrylic-eyebrow">Before choosing the form</Eyebrow>
              <Heading id="questions-before-form">Four questions make the first design conversation more useful</Heading>
              <p className="acrylic-lead">A clear brief explains the intended change without pretending the technical answer is already known.</p>
              <div className="acrylic-mini-grid">
                {designQuestions.map((question) => (
                  <article key={question.title}>
                    <h3>{question.title}</h3>
                    <p>{question.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </Container>
        </Section>
      </MobileServiceDisclosure>

      <Section className="acrylic-section" aria-labelledby="completed-projects" id="project-evidence">
        <Container width="wide">
          <header className="acrylic-section__header acrylic-section__header--wide">
            <Eyebrow className="acrylic-eyebrow">Built evidence across Auckland</Eyebrow>
            <Heading id="completed-projects">Different homes lead to different pergolas</Heading>
            <p>Completed projects show how form, roofing, screening and the existing building come together at full scale. They are a better starting point than choosing a detail in isolation.</p>
          </header>
          <div className="acrylic-project-grid">
            {projectProof.map(({ project, label, summary, facts }) => (
              <Link href={`/projects/${project.slug}`} className="acrylic-project-card" key={project.slug}>
                <div className="acrylic-project-card__media">
                  <Image src={project.heroImage.src} alt={project.heroImage.alt} fill sizes="(max-width: 720px) 100vw, 50vw" style={{ objectPosition: project.heroImage.objectPosition }} />
                </div>
                <div className="acrylic-project-card__body">
                  <Eyebrow className="acrylic-eyebrow">{label}</Eyebrow>
                  <h3>{project.title}</h3>
                  <p className="acrylic-project-card__location">{project.location} · {project.roof}</p>
                  <p>{summary}</p>
                  <ul className="seo-landing__project-facts">{facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
                  <span>Review the completed project</span>
                </div>
              </Link>
            ))}
          </div>
          <div className="acrylic-section__action">
            <Button href="/projects" variant="outline">Browse completed projects</Button>
            <Button href="#project-details" className="pergolas-auckland__mobile-project-cta">Discuss my site</Button>
          </div>
        </Container>
      </Section>

      <MobileServiceDisclosure
        kind="roof-and-edges"
        summary="Compare roof forms, materials and open-edge constraints"
      >
        <Section className="acrylic-section" aria-labelledby="roof-form-options">
          <Container width="wide">
            <header className="acrylic-section__header acrylic-section__header--wide">
              <Eyebrow className="acrylic-eyebrow">Form follows the house and site</Eyebrow>
              <Heading id="roof-form-options">Choose the roof geometry for a reason</Heading>
              <p>Available height, the existing roofline, drainage, the area to cover and the desired architectural presence all help determine the most useful form.</p>
            </header>
            <div className="acrylic-form-grid">
              {roofForms.map((form) => (
                <Link className="acrylic-form-card" href={form.href} key={form.title}>
                  <h3>{form.title}</h3>
                  <p>{form.text}</p>
                  <span>Explore this pergola form</span>
                </Link>
              ))}
            </div>
          </Container>
        </Section>

        <Section id="roofing-options" tone="warm" className="acrylic-section pergolas-auckland__roofing" aria-labelledby="roof-material-effect">
          <Container width="wide">
            <header className="acrylic-section__header acrylic-section__header--wide">
              <Eyebrow className="acrylic-eyebrow">Material changes the room</Eyebrow>
              <Heading id="roof-material-effect">Decide what the roof should do to light, shade and character</Heading>
              <Text size="large">Acrylic, solid and combination roofs create different conditions below the pergola and inside the rooms beside it.</Text>
            </header>
            <div className="pergolas-auckland__roof-grid">
              {roofApproaches.map((approach) => (
                <article className="pergolas-auckland__roof-card" key={approach.title}>
                  <h3>{approach.title}</h3>
                  <dl>
                    <div><dt>What it prioritises</dt><dd>{approach.outcome}</dd></div>
                    <div><dt>What to check</dt><dd>{approach.consider}</dd></div>
                  </dl>
                  <Link href={approach.href}>Review this approach</Link>
                </article>
              ))}
            </div>
          </Container>
        </Section>

        <Section tone="inverse" className="acrylic-section acrylic-section--dark" aria-labelledby="weather-boundary-title" id="weather-boundary">
          <Container width="wide">
            <header className="acrylic-section__header acrylic-section__header--wide">
              <Eyebrow className="acrylic-eyebrow">A roof is only the upper boundary</Eyebrow>
              <Heading id="weather-boundary-title">Plan the open edges with the same care as the roof</Heading>
              <p>Overhead cover, wind, low sun and privacy are related, but they are not the same problem. Name the condition at each edge before deciding how enclosed the outdoor room should become.</p>
            </header>
            <div className="acrylic-weather-grid acrylic-weather-grid--three">
              {edgeDecisions.map((decision) => (
                <article key={decision.title}>
                  <h3>{decision.title}</h3>
                  <p>{decision.text}</p>
                </article>
              ))}
            </div>
            <nav className="acrylic-inline-links" aria-label="Pergola edge protection options">
              <Link href="/products/screens-walls/drop-down-blinds">Review outdoor blinds</Link>
              <Link href="/products/screens-walls/acrylic-infill-panels">Review acrylic infill panels</Link>
              <Link href="/products/screens-walls/slat-screens">Review slat screens</Link>
            </nav>
          </Container>
        </Section>
      </MobileServiceDisclosure>

      <Section tone="warm" className="acrylic-section acrylic-section--process" aria-labelledby="clear-process">
        <Container width="wide">
          <header className="acrylic-section__header acrylic-section__header--wide">
            <Eyebrow className="acrylic-eyebrow">Clarity before commitment</Eyebrow>
            <Heading id="clear-process">Move from an early brief to an agreed pergola design</Heading>
            <p>Each stage should reduce uncertainty. Known information, open decisions, project-specific checks and the next action stay visible throughout.</p>
          </header>
          <ProcessSteps items={processSteps.map(({ title, copy }) => ({ title, copy }))} />
        </Container>
      </Section>

      <Section className="acrylic-section" aria-labelledby="compare-scope">
        <Container width="wide">
          <div className="acrylic-intro-grid">
            <div>
              <Eyebrow className="acrylic-eyebrow">Cost follows scope</Eyebrow>
              <Heading id="compare-scope">Compare the complete project, not a square-metre shortcut</Heading>
              <p className="acrylic-lead">Two pergolas with similar footprints can require different structures, connections, drainage and site work.</p>
              <p>A useful early estimate explains its assumptions. A final quotation should make the agreed outcome, inclusions, exclusions and options easy to understand.</p>
            </div>
            <div className="acrylic-price-grid">
              {scopeFactors.map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}
            </div>
          </div>
          <aside className="acrylic-quote-note">
            <p>Before comparing totals, check that each proposal describes the same finished result.</p>
            <ul className="acrylic-two-column-list">{quoteChecklist.map((item) => <li key={item}>{item}</li>)}</ul>
          </aside>
        </Container>
      </Section>

      <MobileServiceDisclosure
        kind="supporting-guidance"
        summary="Explore specialist guides, site checks and common questions"
      >
        <Section tone="neutral" className="acrylic-section" aria-labelledby="continue-the-brief">
          <Container width="wide">
            <header className="acrylic-section__header acrylic-section__header--wide">
              <Eyebrow className="acrylic-eyebrow">Continue with the decision that matters</Eyebrow>
              <Heading id="continue-the-brief">Use the specialist guides without losing the whole project</Heading>
              <p>This guide provides an overview of Sanctuary's Auckland pergola design and installation service. Continue with the specialist guides where the brief needs more detail.</p>
            </header>
            <div className="acrylic-form-grid">
              <Link className="acrylic-form-card" href="/custom-pergolas-auckland"><h3>Complex or architect-led work</h3><p>Resolve difficult connections, irregular sites, restricted posts, spans, changing levels and renovation coordination.</p><span>Open the custom pergola guide</span></Link>
              <Link className="acrylic-form-card" href="/pergola-cost-auckland"><h3>Define a comparable scope</h3><p>See which inputs shape price and what a complete quotation should make visible.</p><span>Open the pergola cost guide</span></Link>
              <Link className="acrylic-form-card" href="/outdoor-rooms-auckland"><h3>Plan the room below</h3><p>Coordinate use, furniture, roof, edges, light and services as one outdoor room.</p><span>Open the outdoor room guide</span></Link>
            </div>
          </Container>
        </Section>

        <Section tone="neutral" className="acrylic-section" aria-labelledby="site-dependent">
          <Container width="wide">
            <header className="acrylic-section__header acrylic-section__header--wide">
              <Eyebrow className="acrylic-eyebrow">Project-specific by necessity</Eyebrow>
              <Heading id="site-dependent">Some answers should wait for the completed design</Heading>
              <Text size="large">Accurate advice includes being clear about what a photo, an approximate dimension or a generic product description cannot confirm.</Text>
            </header>
            <div className="acrylic-benefit-grid">
              {conditionalDecisions.map((decision, index) => (
                <article className="acrylic-benefit" key={decision.title}>
                  <span className="acrylic-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <h3>{decision.title}</h3>
                  <p>{decision.text}</p>
                </article>
              ))}
            </div>
          </Container>
        </Section>

        <Section tone="elevated" className="acrylic-section acrylic-section--faq" aria-labelledby="pergolas-auckland-faq">
          <Container width="wide">
            <header className="acrylic-section__header acrylic-section__header--wide">
              <Eyebrow className="acrylic-eyebrow">Questions worth resolving early</Eyebrow>
              <Heading id="pergolas-auckland-faq">Planning a pergola in Auckland</Heading>
              <p>These answers explain the main decisions. The final recommendation still depends on the property, selected products and agreed design.</p>
            </header>
            <div className="acrylic-faq-list">
              {faqItems.map((item, index) => (
                <details key={item.question}>
                  <summary><span>{String(index + 1).padStart(2, '0')}</span><h3>{item.question}</h3><i aria-hidden="true" /></summary>
                  <div>{item.answer.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
                </details>
              ))}
            </div>
          </Container>
        </Section>
      </MobileServiceDisclosure>

      <Section tone="inverse" className="acrylic-section acrylic-section--final-cta" aria-labelledby="useful-first-look">
        <Container width="wide" className="acrylic-final-grid">
          <div>
            <Eyebrow className="acrylic-eyebrow">One useful next step</Eyebrow>
            <Heading id="useful-first-look">Show Sanctuary the house, not just the empty deck</Heading>
            <p>Photos from outside reveal the likely structure and connections. A view from inside the adjoining room shows what the new roof should preserve. Rough dimensions and a short description are enough to begin.</p>
            <div className="acrylic-hero__actions">
              <Button href="#project-details">Send my project details</Button>
            </div>
          </div>
          <div>
            <h3>Start with</h3>
            <ul className="acrylic-check-list">
              <li>The project suburb</li>
              <li>Approximate width and projection</li>
              <li>Photos of the outdoor area and house</li>
              <li>A view from inside the adjoining room</li>
              <li>How you want to use the space</li>
              <li>The main issue with rain, sun, wind or privacy</li>
              <li>Plans or sketches, if available</li>
              <li>Your intended timeframe, if known</li>
            </ul>
          </div>
        </Container>
      </Section>

      <Section id="project-details" tone="warm" className="acrylic-section acrylic-section--estimate" aria-label="Auckland pergola project enquiry form">
        <Container width="wide">
          <AcrylicPergolaEnquiryForm
            initialEnquiryType="residential"
            sourceContext={{
              enquiryType: 'residential',
              sourcePath: '/pergolas-auckland',
              sourceComponent: 'embedded_form',
            }}
            eyebrow="Start with what you know"
            heading="Send your pergola project details"
            intro="Add the suburb, a few photos and rough dimensions. Tell us what the outdoor area cannot do today, which rooms sit beside it and what you want the new structure to improve."
            submitLabel="Send my project details"
            messageLabel="What should the pergola change?"
            messagePlaceholder="Describe how you use the area, the rooms beside it and the main issue with rain, sun, wind or privacy."
            briefFields={[
              { name: 'siteAddress', label: 'Project address', type: 'text', placeholder: 'Street address, if you are ready to share it', wide: true },
              { name: 'intendedUse', label: 'Intended use', type: 'text', placeholder: 'For example: dining, cooking, poolside or everyday family use', wide: true },
            ]}
            roofPreference={generalRoofPreference}
          />
        </Container>
      </Section>

    </main>
  );
}
