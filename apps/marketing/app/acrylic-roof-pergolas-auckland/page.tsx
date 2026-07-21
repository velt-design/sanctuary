import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import JsonLd from '@/components/JsonLd';
import { ButtonLink } from '@/components/ui/Button';
import Container from '@/components/ui/Container';
import { projects } from '@/data/projects';
import { absoluteUrl } from '@/lib/seo';
import AcrylicPergolaEnquiryForm from './AcrylicPergolaEnquiryForm';
import {
  acrylicBenefits,
  comfortFactors,
  comfortResponses,
  faqItems,
  pergolaForms,
  priceFactors,
  processSteps,
  sanctuaryReasons,
  tintOptions,
  weatherDetails,
} from './content';
import './acrylic-roof-pergolas-auckland.css';

const route = '/acrylic-roof-pergolas-auckland';
const heroImage = '/images/project-dairy-flat-01.jpg';

export const metadata: Metadata = {
  title: { absolute: 'Acrylic Roof Pergolas Auckland | Sanctuary Pergolas' },
  description: 'Explore custom acrylic roof pergolas in Auckland. Compare clear, tinted and opal roofing, understand heat and light, and request an initial estimate.',
  alternates: { canonical: route },
  openGraph: {
    type: 'website',
    url: route,
    title: 'Acrylic Roof Pergolas for Auckland Homes',
    description: 'Compare clear, light grey, dark grey and opal acrylic roofing, then plan a custom aluminium pergola around your home, daylight and comfort priorities.',
    images: [{
      url: heroImage,
      alt: 'Acrylic-roof gable pergola extending an Auckland home',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Acrylic Roof Pergolas for Auckland Homes',
    description: 'Compare clear, light grey, dark grey and opal acrylic roofing, then plan a custom aluminium pergola around your home, daylight and comfort priorities.',
    images: [heroImage],
  },
};

const projectProof = [
  {
    slug: 'warkworth-outdoor-room',
    label: 'Clear acrylic and a combination roof',
    summary: 'A freestanding gable outdoor room using clear acrylic glazing with a cedar-lined solid roof area.',
  },
  {
    slug: 'st-heliers-townhouse',
    label: 'Opal acrylic',
    summary: 'An open gable extension with opal acrylic roofing and custom aluminium gable framing.',
  },
  {
    slug: 'tindalls-bay-pavilion',
    label: 'Light grey, opal and insulated roofing',
    summary: 'A layered patio and carport cover combining insulated panels, acrylic roofing and battens.',
  },
  {
    slug: 'atelier-shu-cafe',
    label: 'Dark-tint acrylic',
    summary: 'An aluminium gable canopy with dark-tint acrylic roofing for a Newmarket cafe.',
  },
].flatMap((proof) => {
  const project = projects.find((candidate) => candidate.slug === proof.slug);
  return project ? [{ ...proof, project }] : [];
});

export default function AcrylicRoofPergolasAucklandPage() {
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
    <main className="acrylic-landing">
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
          faqSchema,
        ]}
      />

      <section className="acrylic-hero" aria-labelledby="acrylic-hero-title">
        <Image
          src={heroImage}
          alt="Gable pergola with acrylic roofing extending the roofline of an Auckland home"
          fill
          priority
          sizes="100vw"
          className="acrylic-hero__image"
        />
        <div className="acrylic-hero__shade" aria-hidden="true" />
        <Container className="acrylic-hero__content">
          <p className="acrylic-eyebrow">Custom acrylic pergolas for Auckland homes</p>
          <h1 id="acrylic-hero-title">Acrylic roof pergolas for Auckland homes, designed to keep the light</h1>
          <p className="acrylic-hero__intro">
            Create a sheltered deck or patio without making the home beside it feel closed in. Sanctuary designs custom aluminium pergolas with the roof form, acrylic tint, frame, drainage and optional accessories considered together.
          </p>
          <div className="acrylic-hero__actions">
            <ButtonLink href="#estimate" variant="brand" size="lg">Request an initial estimate</ButtonLink>
            <ButtonLink href="#acrylic-options" variant="outline" size="lg" className="acrylic-button--light">Compare acrylic roof options</ButtonLink>
          </div>
          <ul className="acrylic-hero__proof" aria-label="Sanctuary service highlights">
            <li>Site-specific tint and roof advice</li>
            <li>Custom aluminium construction</li>
            <li>Design through installation</li>
          </ul>
        </Container>
      </section>

      <section className="acrylic-section acrylic-section--opening" aria-labelledby="cover-without-closing">
        <Container className="acrylic-intro-grid">
          <div>
            <p className="acrylic-eyebrow">Light, shelter and the house</p>
            <h2 id="cover-without-closing">Cover the space without closing it in</h2>
          </div>
          <div className="acrylic-prose acrylic-prose--large">
            <p>Adding a roof over a deck can solve one problem and create another.</p>
            <p>The new cover may keep rain off the table, but the wrong roof depth, tint or position can reduce daylight into the kitchen or living room. Clear roofing may preserve the view of the sky, yet feel brighter than expected in direct afternoon sun. A dark tint may add welcome shade, but reduce more light than the adjoining room can comfortably lose.</p>
            <p>That is why an acrylic roof pergola should be designed as a complete structure rather than selected from a roof sample alone.</p>
            <p>Orientation, roof pitch, pergola depth, nearby windows, existing eaves, frame proportions, gutters, flashing and prevailing weather all influence the finished result.</p>
            <p>For Auckland homeowners comparing covered pergolas, acrylic is often considered because it can provide overhead weather protection while retaining visual openness and allowing daylight through the roof.</p>
            <p>The objective is not simply to install a clear sheet. It is to find the right balance between shelter, light, shade and integration with the house.</p>
          </div>
        </Container>
      </section>

      <section className="acrylic-section" aria-labelledby="why-acrylic">
        <Container>
          <header className="acrylic-section__header">
            <p className="acrylic-eyebrow">Material-led design</p>
            <h2 id="why-acrylic">Why choose an acrylic roof?</h2>
          </header>
          <div className="acrylic-benefit-grid">
            {acrylicBenefits.map((benefit, index) => (
              <article className="acrylic-benefit" key={benefit.title}>
                <span className="acrylic-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <h3>{benefit.title}</h3>
                {benefit.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section id="acrylic-options" className="acrylic-section acrylic-section--tints" aria-labelledby="compare-tints">
        <Container>
          <header className="acrylic-section__header acrylic-section__header--wide">
            <p className="acrylic-eyebrow">Compare the visual effect</p>
            <h2 id="compare-tints">Clear, light grey, dark grey or opal acrylic?</h2>
            <p>There is no universally correct acrylic tint. The most appropriate option depends on the direction of the sun, roof area, pergola depth, nearby glazing, surrounding surfaces and how much daylight the adjoining rooms can afford to lose.</p>
          </header>
          <div className="acrylic-tint-grid">
            {tintOptions.map((tint) => (
              <article className="acrylic-tint" key={tint.name}>
                <div className={`acrylic-tint__swatch acrylic-tint__swatch--${tint.tone}`} aria-hidden="true" />
                <h3>{tint.name}</h3>
                <dl>
                  <div><dt>Visual effect</dt><dd>{tint.visual}</dd></div>
                  <div><dt>Relative daylight</dt><dd>{tint.daylight}</dd></div>
                  <div><dt>Glare and shade</dt><dd>{tint.glare}</dd></div>
                </dl>
                <h4>May suit</h4>
                <ul>{tint.suits.map((item) => <li key={item}>{item}</li>)}</ul>
                <h4>Sanctuary should assess</h4>
                <ul>{tint.assess.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
            ))}
          </div>
          <aside className="acrylic-callout" aria-labelledby="choose-for-site">
            <p className="acrylic-eyebrow">The whole roof changes the result</p>
            <h3 id="choose-for-site">Choose for the site, not from the sample alone</h3>
            <p>A small acrylic sample cannot show how an entire roof will affect the house.</p>
            <p>The recommendation should take account of where the sun moves, which rooms sit beside the pergola, how deep the roof will be, how much ventilation is available and whether the space is intended mainly for dining, lounging, circulation or year-round use.</p>
            <p>The best tint is the one that resolves those conditions together.</p>
          </aside>
        </Container>
      </section>

      <section className="acrylic-section" aria-labelledby="summer-comfort">
        <Container className="acrylic-editorial-grid">
          <div className="acrylic-editorial-media">
            <Image src="/images/project-atelier-shu-03.jpg" alt="Dark-tint acrylic canopy detail at Atelier Shu Cafe in Auckland" fill sizes="(max-width: 900px) 100vw, 48vw" />
          </div>
          <div>
            <p className="acrylic-eyebrow">Heat, glare and summer comfort</p>
            <h2 id="summer-comfort">Will it get too hot under an acrylic pergola?</h2>
            <div className="acrylic-prose">
              <p>Not necessarily, but an acrylic-covered area can feel warm or bright when the roof choice does not account for direct sun, orientation and airflow.</p>
              <p>Clear acrylic prioritises daylight and transparency. In a location receiving strong summer sun, that same openness may produce more brightness or warmth than the homeowner expects.</p>
              <p>Comfort depends on several interacting factors:</p>
              <ul className="acrylic-two-column-list">{comfortFactors.map((factor) => <li key={factor}>{factor}</li>)}</ul>
            </div>
            <div className="acrylic-mini-grid">
              {comfortResponses.map((response) => <article key={response.title}><h3>{response.title}</h3><p>{response.text}</p></article>)}
            </div>
          </div>
        </Container>
      </section>

      <section className="acrylic-section acrylic-section--dark" aria-labelledby="weather-details">
        <Container>
          <div className="acrylic-section__header acrylic-section__header--wide">
            <p className="acrylic-eyebrow">Rain, drainage and house integration</p>
            <h2 id="weather-details">Weather protection starts with the roof details</h2>
            <p>People often search for a weatherproof pergola when what they need is dependable overhead cover and well-considered rainwater management.</p>
            <p>An acrylic sheet is only one part of that outcome.</p>
          </div>
          <div className="acrylic-weather-grid">
            {weatherDetails.map((detail) => <article key={detail.title}><h3>{detail.title}</h3><p>{detail.text}</p></article>)}
          </div>
          <nav className="acrylic-inline-links" aria-label="Weather protection options">
            <Link href="/products/screens-walls/drop-down-blinds">Explore outdoor blinds</Link>
            <Link href="/products/screens-walls/acrylic-infill-panels">Explore acrylic infill panels</Link>
          </nav>
        </Container>
      </section>

      <section className="acrylic-section" aria-labelledby="pergola-forms">
        <Container>
          <header className="acrylic-section__header">
            <p className="acrylic-eyebrow">Pergola design options</p>
            <h2 id="pergola-forms">Acrylic roofing across different pergola forms</h2>
          </header>
          <div className="acrylic-form-grid">
            {pergolaForms.map((form) => (
              <Link className="acrylic-form-card" href={form.href} key={form.title}>
                <h3>{form.title}</h3>
                <p>{form.text}</p>
                <span>View this pergola form</span>
              </Link>
            ))}
          </div>
          <div className="acrylic-attached-grid">
            <article><h3>Attached pergolas</h3><p>An attached pergola can create a direct transition from the house to the covered area. The design needs to consider the existing wall, fascia, soffit or roof edge, along with flashing, available height, door clearances and drainage.</p></article>
            <article><h3>Freestanding pergolas</h3><p>A freestanding pergola does not rely on the house for structural support. This can be useful beside complex eaves, around a pool or courtyard, or where the pergola should read as a separate pavilion or outdoor room. Its position still needs to be coordinated with the house, paths, views and services.</p></article>
          </div>
        </Container>
      </section>

      <section className="acrylic-section acrylic-section--why" aria-labelledby="one-system">
        <Container className="acrylic-intro-grid">
          <div>
            <p className="acrylic-eyebrow">Why Sanctuary</p>
            <h2 id="one-system">Designed as one architectural system</h2>
            <p className="acrylic-lead">An aluminium pergola with an acrylic roof works best when the frame, roof, drainage and optional accessories are resolved together.</p>
            <p>Sanctuary approaches the structure as a permanent addition to the property rather than a lightweight cover selected independently of the house.</p>
          </div>
          <div className="acrylic-reason-list">
            {sanctuaryReasons.map((reason, index) => <article key={reason.title}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{reason.title}</h3><p>{reason.text}</p></div></article>)}
          </div>
        </Container>
      </section>

      <section className="acrylic-section" aria-labelledby="completed-projects">
        <Container>
          <header className="acrylic-section__header acrylic-section__header--wide">
            <p className="acrylic-eyebrow">Verified Sanctuary projects</p>
            <h2 id="completed-projects">See how acrylic choices work in completed projects</h2>
            <p>Roof colour is easier to understand when it is shown in a completed setting. These project records show clear, opal, light grey, mixed and dark-tint applications already documented by Sanctuary.</p>
          </header>
          <div className="acrylic-project-grid">
            {projectProof.map(({ project, label, summary }) => (
              <Link href={`/projects/${project.slug}`} className="acrylic-project-card" key={project.slug}>
                <div className="acrylic-project-card__media">
                  <Image src={project.heroImage.src} alt={project.heroImage.alt} fill sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 25vw" />
                </div>
                <div className="acrylic-project-card__body">
                  <p className="acrylic-eyebrow">{label}</p>
                  <h3>{project.title}</h3>
                  <p className="acrylic-project-card__location">{project.location} · {project.roof}</p>
                  <p>{summary}</p>
                  <span>View completed project</span>
                </div>
              </Link>
            ))}
          </div>
          <div className="acrylic-section__action"><ButtonLink href="/projects" variant="outline">View all completed projects</ButtonLink></div>
        </Container>
      </section>

      <section className="acrylic-section acrylic-section--process" aria-labelledby="project-process">
        <Container>
          <header className="acrylic-section__header">
            <p className="acrylic-eyebrow">A considered path to site</p>
            <h2 id="project-process">From initial enquiry to installation</h2>
          </header>
          <ol className="acrylic-process-list">
            {processSteps.map(([title, text], index) => <li key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}
          </ol>
        </Container>
      </section>

      <section className="acrylic-section" aria-labelledby="price-guidance">
        <Container>
          <div className="acrylic-intro-grid">
            <div>
              <p className="acrylic-eyebrow">Price guidance</p>
              <h2 id="price-guidance">What affects the cost of an acrylic roof pergola?</h2>
              <p className="acrylic-lead">A useful price cannot be based on roof area alone.</p>
              <p>Two acrylic pergolas with similar footprints may have materially different costs because the structure, house connection, access and detailing are different.</p>
            </div>
            <div className="acrylic-price-grid">
              {priceFactors.map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}
            </div>
          </div>
          <aside className="acrylic-quote-note">
            <p>An initial estimate is most useful when it allows the homeowner to compare like with like.</p>
            <p>When reviewing quotes, confirm whether the price includes the aluminium frame, acrylic roofing, flashings, gutters, downpipes, foundations, site access, electrical work, engineering, consent work and GST.</p>
            <p>A bespoke aluminium pergola is unlikely to be the right option for someone seeking only the lowest-cost temporary cover. It is more appropriate for homeowners comparing permanent, site-specific structures and wanting the result to integrate with the house.</p>
          </aside>
        </Container>
      </section>

      <section className="acrylic-section acrylic-section--consent" aria-labelledby="consent-engineering">
        <Container className="acrylic-intro-grid">
          <div>
            <p className="acrylic-eyebrow">Site-specific assessment</p>
            <h2 id="consent-engineering">Consent and engineering depend on the final design</h2>
          </div>
          <div className="acrylic-prose">
            <p>Some roofed outdoor structures may fall within an exemption, while others may require building consent, engineering or site-specific assessment.</p>
            <p>The requirements can depend on:</p>
            <ul className="acrylic-two-column-list"><li>Site</li><li>Dimensions</li><li>Roof area</li><li>Height</li><li>Attachment to the house</li><li>Structural design</li><li>Property location</li><li>Planning controls</li><li>Intended use</li></ul>
            <p>Even where consent is not required, other building and planning requirements may still apply.</p>
            <p>Sanctuary can review the early project information and identify where further assessment, engineering or council advice is likely to be needed.</p>
            <p>The final pathway should be confirmed for the completed design before work begins.</p>
            <p className="acrylic-small-print">This information is general and is not legal or regulatory advice.</p>
          </div>
        </Container>
      </section>

      <section className="acrylic-section acrylic-section--faq" aria-labelledby="acrylic-faq">
        <Container>
          <header className="acrylic-section__header">
            <p className="acrylic-eyebrow">Frequently asked questions</p>
            <h2 id="acrylic-faq">Acrylic pergola questions</h2>
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
      </section>

      <section className="acrylic-section acrylic-section--final-cta" aria-labelledby="request-estimate">
        <Container className="acrylic-final-grid">
          <div>
            <p className="acrylic-eyebrow">Your project, in context</p>
            <h2 id="request-estimate">Request an initial estimate for your acrylic pergola</h2>
            <p>Send Sanctuary enough information to understand the space, the house beside it and what you want the roof to achieve.</p>
            <p>You do not need to make every material decision before enquiring. Sanctuary can use the early information to identify what needs further assessment and prepare the next step.</p>
            <div className="acrylic-hero__actions">
              <ButtonLink href="#estimate" variant="brand" size="lg">Request an initial estimate</ButtonLink>
              <ButtonLink href="/projects" variant="outline" size="lg">View completed projects</ButtonLink>
            </div>
          </div>
          <div>
            <h3>Useful information to include</h3>
            <ul className="acrylic-check-list">
              <li>Project suburb</li><li>Approximate width, projection and height</li><li>Photos from the garden or deck</li><li>Photos looking from adjoining rooms towards the proposed roof</li><li>Plans or drawings, if available</li><li>Preferred pergola form and acrylic tint, if known</li><li>Whether the structure may be attached or freestanding</li><li>Desired blinds, lighting, heaters, screens or infills</li><li>Your priorities for daylight, rain cover, shade, wind and privacy</li>
            </ul>
          </div>
        </Container>
      </section>

      <section id="estimate" className="acrylic-section acrylic-section--estimate" aria-label="Initial estimate enquiry form">
        <Container>
          <AcrylicPergolaEnquiryForm />
        </Container>
      </section>

      <a className="acrylic-sticky-cta" href="#estimate">Request an estimate</a>
    </main>
  );
}
