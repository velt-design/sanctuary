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
import AcrylicPergolaEnquiryForm from '../acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm';
import {
  costDrivers,
  designPriorities,
  designQuestions,
  edgeDecisions,
  faqItems,
  processSteps,
  quoteChecklist,
  roofForms,
  tintChoices,
} from './content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import './copy-variant.css';

const route = '/acrylic-roof-pergolas-auckland-v2';
const canonicalRoute = '/acrylic-roof-pergolas-auckland';
const heroImage = '/images/project-tindalls-bay.jpg';

export const metadata: Metadata = {
  title: { absolute: 'Acrylic Roof Pergolas Auckland | Custom Design by Sanctuary' },
  description: 'Planning an acrylic roof pergola in Auckland? Compare daylight, tint, roof form and weather trade-offs, then send photos for a site-specific first assessment.',
  alternates: { canonical: canonicalRoute },
  robots: { index: false, follow: false },
  openGraph: {
    type: 'website',
    url: route,
    title: 'Cover the Deck Without Giving Up the Light',
    description: 'A practical guide to custom acrylic roof pergolas designed around the home, the daylight inside and the way an Auckland deck needs to work.',
    images: [{
      url: heroImage,
      alt: 'Auckland patio with a combination of acrylic and solid pergola roofing',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cover the Deck Without Giving Up the Light',
    description: 'Compare the design, daylight and shelter decisions behind a custom acrylic roof pergola in Auckland.',
    images: [heroImage],
  },
};

const projectProof = [
  {
    slug: 'dairy-flat-estate',
    label: 'Roofline-led gable design',
    summary: 'A gable form continues the existing roofline, using aluminium framing and acrylic roofing to keep the new outdoor room connected to the house.',
  },
  {
    slug: 'st-heliers-townhouse',
    label: 'Opal acrylic and a custom gable end',
    summary: 'Opal roofing and custom aluminium gable-end framing give this street-facing addition a deliberate architectural presence.',
  },
  {
    slug: 'warkworth-outdoor-room',
    label: 'Clear acrylic with a solid roof zone',
    summary: 'Clear acrylic sits alongside a cedar-lined solid roof area, placing daylight and a more enclosed ceiling treatment within one outdoor room.',
  },
  {
    slug: 'atelier-shu-cafe',
    label: 'Dark-tint acrylic in a commercial setting',
    summary: 'A dark-tint acrylic roof and aluminium gable frame create a sheltered outdoor area while maintaining the cafe frontage.',
  },
].flatMap((proof) => {
  const project = projects.find((candidate) => candidate.slug === proof.slug);
  return project ? [{ ...proof, project }] : [];
});

export default function AcrylicRoofPergolasAucklandCopyVariantPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer.join('\n\n'),
      },
    })),
  };

  return (
    <main className="acrylic-landing acrylic-copy-variant" data-marketing-foundation-page data-copy-variant="context-pack-v2">
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Custom Acrylic Roof Pergolas Auckland',
            url: absoluteUrl(route),
            description: metadata.description,
            primaryImageOfPage: absoluteUrl(heroImage),
          },
          faqSchema,
        ]}
      />

      <section className="acrylic-hero" aria-labelledby="acrylic-v2-hero-title">
        <Image
          src={heroImage}
          alt="Covered Auckland patio using acrylic and solid roofing to balance shelter and daylight"
          fill
          priority
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
          className="acrylic-hero__image"
        />
        <div className="acrylic-hero__shade" aria-hidden="true" />
        <Container width="wide" className="acrylic-hero__content">
          <Eyebrow className="acrylic-eyebrow">Custom acrylic roof pergolas in Auckland</Eyebrow>
          <Heading as="h1" variant="page" id="acrylic-v2-hero-title">Cover the deck without giving up the daylight inside</Heading>
          <Text size="large" className="acrylic-hero__intro">
            Sanctuary designs and installs each pergola around the home, the sun and the way the outdoor area needs to work. Send a few photos and rough dimensions to start with advice that fits the site.
          </Text>
          <div className="acrylic-hero__actions">
            <Button href="#project-details">Send photos and rough dimensions</Button>
            <TextLink href="#design-approach">See the design approach</TextLink>
          </div>
          <ul className="acrylic-hero__proof" aria-label="Sanctuary design approach">
            <li>Designed around the house</li>
            <li>Clear, tinted and opal options</li>
            <li>Design and installation together</li>
          </ul>
        </Container>
      </section>

      <Section id="design-approach" className="acrylic-section acrylic-section--opening" aria-labelledby="two-rooms">
        <Container width="wide" className="acrylic-intro-grid">
          <div>
            <Eyebrow className="acrylic-eyebrow">Begin with the consequence</Eyebrow>
            <Heading id="two-rooms">A pergola roof changes two rooms at once</Heading>
          </div>
          <div className="acrylic-prose acrylic-prose--large">
            <p>The obvious room is the deck. The other is the kitchen, lounge or dining space beside it.</p>
            <p>Acrylic roofing can add useful overhead cover while allowing daylight through. The design still needs judgement. A deep clear roof may feel brighter in direct sun than expected. A darker tint may bring welcome shade outside while taking more light from the room inside.</p>
            <p>The frame matters too. A post in the wrong place can interrupt a view or circulation. A poorly resolved house connection can make an otherwise attractive roof feel like an afterthought.</p>
            <p>The aim is not to choose a sheet colour in isolation. It is to decide how shelter, light, openness and the character of the home should work together.</p>
          </div>
        </Container>
      </Section>

      <Section className="acrylic-section" aria-labelledby="earning-place">
        <Container width="wide">
          <header className="acrylic-section__header acrylic-section__header--wide">
            <Eyebrow className="acrylic-eyebrow">The outcome before the product</Eyebrow>
            <Heading id="earning-place">A good cover earns its place in three ways</Heading>
            <Text size="large">The value is in the complete result: more use from the deck, a bright and comfortable home, and an addition that looks considered from inside and outside.</Text>
          </header>
          <div className="acrylic-benefit-grid">
            {designPriorities.map((priority, index) => (
              <article className="acrylic-benefit" key={priority.title}>
                <span className="acrylic-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <h3>{priority.title}</h3>
                <p>{priority.text}</p>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="neutral" className="acrylic-section" aria-labelledby="four-questions">
        <Container width="wide" className="acrylic-editorial-grid">
          <div className="acrylic-editorial-media">
            <Image
              src="/images/project-dairy-flat-03.jpg"
              alt="Acrylic pergola framing and roof connection beside an Auckland home"
              fill
              sizes="(max-width: 900px) 100vw, 48vw"
            />
          </div>
          <div>
            <Eyebrow className="acrylic-eyebrow">Four useful questions</Eyebrow>
            <Heading id="four-questions">Design the decision before designing the roof</Heading>
            <p className="acrylic-lead">The first conversation is more useful when it starts with the way the space should work.</p>
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

      <Section className="acrylic-section" aria-labelledby="project-evidence">
        <Container width="wide">
          <header className="acrylic-section__header acrylic-section__header--wide">
            <Eyebrow className="acrylic-eyebrow">Comparable decisions, completed</Eyebrow>
            <Heading id="project-evidence">See the roof choice in the context of a whole home</Heading>
            <p>Project photography is more useful than a small material sample. It shows how roof form, tint, framing and the building beside it affect the finished result.</p>
          </header>
          <div className="acrylic-project-grid">
            {projectProof.map(({ project, label, summary }) => (
              <Link href={`/projects/${project.slug}`} className="acrylic-project-card" key={project.slug}>
                <div className="acrylic-project-card__media">
                  <Image src={project.heroImage.src} alt={project.heroImage.alt} fill sizes="(max-width: 720px) 100vw, 50vw" style={{ objectPosition: project.heroImage.objectPosition }} />
                </div>
                <div className="acrylic-project-card__body">
                  <Eyebrow className="acrylic-eyebrow">{label}</Eyebrow>
                  <h3>{project.title}</h3>
                  <p className="acrylic-project-card__location">{project.location} · {project.roof}</p>
                  <p>{summary}</p>
                  <span>Review the completed project</span>
                </div>
              </Link>
            ))}
          </div>
          <div className="acrylic-section__action"><Button href="/projects" variant="outline">Browse completed projects</Button></div>
        </Container>
      </Section>

      <Section id="acrylic-options" tone="warm" className="acrylic-section acrylic-section--tints" aria-labelledby="tint-tradeoff">
        <Container width="wide">
          <header className="acrylic-section__header acrylic-section__header--wide">
            <Eyebrow className="acrylic-eyebrow">Choose the effect, not a favourite colour</Eyebrow>
            <Heading id="tint-tradeoff">There is no best acrylic tint</Heading>
            <Text size="large">There is only a better fit for the sun, the size of the roof, the view overhead and the amount of daylight the adjoining rooms can afford to lose.</Text>
          </header>
          <div className="acrylic-tint-grid">
            {tintChoices.map((choice) => (
              <article className="acrylic-tint" key={choice.name}>
                <div className={`acrylic-tint__swatch acrylic-tint__swatch--${choice.tone}`} aria-hidden="true" />
                <h3>{choice.name}</h3>
                <dl>
                  <div><dt>What it prioritises</dt><dd>{choice.outcome}</dd></div>
                  <div><dt>What to check</dt><dd>{choice.consider}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <aside className="acrylic-callout" aria-labelledby="compare-at-scale">
            <Eyebrow className="acrylic-eyebrow">See it at roof scale</Eyebrow>
            <h3 id="compare-at-scale">A hand sample cannot show the effect on the house</h3>
            <p>Compare the likely options against the roof area, sun path and rooms beside the deck. Similar completed projects, drawings and physical samples can help turn an abstract tint choice into a more confident design decision.</p>
          </aside>
        </Container>
      </Section>

      <Section className="acrylic-section" aria-labelledby="roof-form-options">
        <Container width="wide">
          <header className="acrylic-section__header acrylic-section__header--wide">
            <Eyebrow className="acrylic-eyebrow">Form follows the home and site</Eyebrow>
            <Heading id="roof-form-options">Acrylic can sit within more than one roof shape</Heading>
            <p>The right form depends on available height, the house roofline, the area to cover, drainage and the architectural presence the addition should have.</p>
          </header>
          <div className="acrylic-form-grid">
            {roofForms.map((form) => (
              <Link className="acrylic-form-card" href={form.href} key={form.title}>
                <h3>{form.title}</h3>
                <p>{form.text}</p>
                <span>Explore this roof form</span>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="inverse" className="acrylic-section acrylic-section--dark" aria-labelledby="weather-boundary">
        <Container width="wide">
          <header className="acrylic-section__header acrylic-section__header--wide">
            <Eyebrow className="acrylic-eyebrow">Set the right expectation</Eyebrow>
            <Heading id="weather-boundary">The roof handles what falls above it. The edges need their own plan.</Heading>
            <p>A more useful weather conversation separates overhead rain cover from wind, low-angle sun, privacy and the open sides of the structure.</p>
          </header>
          <div className="acrylic-weather-grid acrylic-weather-grid--three">
            {edgeDecisions.map((decision) => (
              <article key={decision.title}>
                <h3>{decision.title}</h3>
                <p>{decision.text}</p>
              </article>
            ))}
          </div>
          <nav className="acrylic-inline-links" aria-label="Side protection options">
            <Link href="/products/screens-walls/drop-down-blinds">Review outdoor blinds</Link>
            <Link href="/products/screens-walls/acrylic-infill-panels">Review acrylic infill panels</Link>
          </nav>
        </Container>
      </Section>

      <Section tone="warm" className="acrylic-section acrylic-section--process" aria-labelledby="clear-process">
        <Container width="wide">
          <header className="acrylic-section__header acrylic-section__header--wide">
            <Eyebrow className="acrylic-eyebrow">Clarity before commitment</Eyebrow>
            <Heading id="clear-process">Move from a useful first reply to an agreed design</Heading>
            <p>The process should make each decision clearer. What is known, what still depends on the site and what happens next remain visible throughout.</p>
          </header>
          <ProcessSteps items={processSteps.map(({ title, copy }) => ({ title, copy }))} />
        </Container>
      </Section>

      <Section className="acrylic-section" aria-labelledby="compare-scope">
        <Container width="wide">
          <div className="acrylic-intro-grid">
            <div>
              <Eyebrow className="acrylic-eyebrow">Price and value</Eyebrow>
              <Heading id="compare-scope">Compare the scope, not only the total</Heading>
              <p className="acrylic-lead">Two roofs with similar areas can require very different structures, connections and site work.</p>
              <p>A useful early estimate states its assumptions. A final quotation should make the agreed design, inclusions, exclusions and options easy to compare.</p>
            </div>
            <div className="acrylic-price-grid">
              {costDrivers.map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}
            </div>
          </div>
          <aside className="acrylic-quote-note">
            <p>Before comparing headline prices, check that each proposal describes the same finished outcome.</p>
            <ul className="acrylic-two-column-list">{quoteChecklist.map((item) => <li key={item}>{item}</li>)}</ul>
          </aside>
        </Container>
      </Section>

      <Section tone="neutral" className="acrylic-section" aria-labelledby="site-dependent">
        <Container width="wide">
          <header className="acrylic-section__header acrylic-section__header--wide">
            <Eyebrow className="acrylic-eyebrow">Conditional by design</Eyebrow>
            <Heading id="site-dependent">Some answers should wait for the complete design</Heading>
            <Text size="large">Calm, accurate advice includes knowing what cannot be confirmed from a photo or a single measurement.</Text>
          </header>
          <div className="acrylic-benefit-grid">
            <article className="acrylic-benefit">
              <span className="acrylic-index" aria-hidden="true">01</span>
              <h3>Posts and spans</h3>
              <p>The cleanest feasible post arrangement depends on the structure, dimensions, site and any required engineering. A post-free outcome should not be promised before review.</p>
            </article>
            <article className="acrylic-benefit">
              <span className="acrylic-index" aria-hidden="true">02</span>
              <h3>Consent and documentation</h3>
              <p>Requirements depend on the property and completed design. Sanctuary can identify likely next checks, but the approval pathway must be confirmed for the actual project.</p>
            </article>
            <article className="acrylic-benefit">
              <span className="acrylic-index" aria-hidden="true">03</span>
              <h3>Products and warranties</h3>
              <p>The quotation should name the exact acrylic product and provide the current written warranty that applies. Generic material claims are not a substitute for those documents.</p>
            </article>
          </div>
        </Container>
      </Section>

      <Section tone="elevated" className="acrylic-section acrylic-section--faq" aria-labelledby="acrylic-v2-faq">
        <Container width="wide">
          <header className="acrylic-section__header acrylic-section__header--wide">
            <Eyebrow className="acrylic-eyebrow">Questions worth resolving early</Eyebrow>
            <Heading id="acrylic-v2-faq">Acrylic pergola planning questions</Heading>
            <p>These answers explain the decision. The final recommendation still depends on the site, selected products and agreed design.</p>
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

      <Section tone="inverse" className="acrylic-section acrylic-section--final-cta" aria-labelledby="useful-first-look">
        <Container width="wide" className="acrylic-final-grid">
          <div>
            <Eyebrow className="acrylic-eyebrow">One useful next step</Eyebrow>
            <Heading id="useful-first-look">Give Sanctuary enough context to be useful</Heading>
            <p>You do not need to choose the roof form or tint before making contact. Send the location, a few photos and rough dimensions so the team can understand the space and identify what should be assessed next.</p>
            <div className="acrylic-hero__actions">
              <Button href="#project-details">Send my project details</Button>
            </div>
          </div>
          <div>
            <h3>Start with</h3>
            <ul className="acrylic-check-list">
              <li>The project suburb</li>
              <li>Approximate width and projection</li>
              <li>Photos of the deck and house connection</li>
              <li>A view from inside the adjoining room</li>
              <li>How you want to use the covered space</li>
              <li>Your main concern about rain, sun, wind or lost light</li>
              <li>Plans or sketches, if available</li>
              <li>Your intended timeframe, if known</li>
            </ul>
          </div>
        </Container>
      </Section>

      <Section id="project-details" tone="warm" className="acrylic-section acrylic-section--estimate" aria-label="Acrylic pergola project enquiry form">
        <Container width="wide">
          <AcrylicPergolaEnquiryForm
            eyebrow="Start with what you know"
            heading="Send your project details"
            intro="Add the suburb, a few photos and rough dimensions. Tell us what the deck cannot do today, which rooms sit beside it and what you want the new cover to improve."
            submitLabel="Send my project details"
          />
        </Container>
      </Section>

      <a className="acrylic-sticky-cta" href="#project-details">Send project details</a>
    </main>
  );
}
