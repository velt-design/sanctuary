import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import AcrylicPergolaEnquiryForm from '@/app/acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm';
import GuidedJourneyContext from '@/components/guided-journey/GuidedJourneyContext';
import {
  ActionGroup,
  Button,
  Container,
  Eyebrow,
  Heading,
  MarketingPage,
  Text,
  TextLink,
} from '@/components/marketing-foundation';
import ProjectFinderJourneyContext from '@/components/project-finder/ProjectFinderJourneyContext';
import { projects } from '@/data/projects';
import {
  orderGuidedItemsBySlug,
  resolveGuidedJourneyContext,
  type GuidedJourneySearchParams,
} from '@/lib/guidedJourneyContext';
import {
  buildProjectFinderProjectHref,
  resolveProjectFinderJourneyContext,
} from '@/lib/projectFinderContinuation';
import {
  simpleCoverConsiderations,
  simpleCoverFaqs,
  simpleCoverLevels,
  simpleCoverProcess,
  simpleCoverProjects,
  simpleCoverRoofPreference,
  simpleCoverScope,
  simpleCoverStrengths,
} from './content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import styles from './simple-pergolas-auckland.module.css';

const route = '/simple-pergolas-auckland';
const heroImage = '/images/project-st-heliers-02.jpg';

export const metadata: Metadata = {
  title: { absolute: 'Simple Acrylic Pergolas | Sanctuary Pergolas' },
  description:
    'See whether a fixed acrylic-roof pergola suits your home, compare roof and blind options, and request an initial estimate from Sanctuary Pergolas.',
  robots: { index: false, follow: true },
  alternates: { canonical: route },
  openGraph: {
    type: 'website',
    url: route,
    title: 'Cover the Space Without Losing Light',
    description:
      'A fixed acrylic roof shaped for your home, with optional side blinds where they add value.',
    images: [{
      url: heroImage,
      alt: 'Opal acrylic gable pergola above a St Heliers deck',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cover the Space Without Losing Light',
    description:
      'A fixed acrylic roof shaped for your home, with optional side blinds where they add value.',
    images: [heroImage],
  },
};

const projectEvidence = simpleCoverProjects.flatMap((proof) => {
  const project = projects.find((candidate) => candidate.slug === proof.slug);
  return project ? [{ ...proof, project }] : [];
});

type SimplePergolasPageProps = {
  searchParams?: Promise<GuidedJourneySearchParams>;
};

export default async function SimplePergolasPage({
  searchParams,
}: SimplePergolasPageProps) {
  const params = searchParams ? await searchParams : {};
  const guidedContext = resolveGuidedJourneyContext(
    'residential-cover',
    params,
  );
  const projectFinderContext = guidedContext
    ? null
    : resolveProjectFinderJourneyContext('cover', params);
  const orderedProjectEvidence = orderGuidedItemsBySlug(
    projectEvidence,
    guidedContext?.preferredProjectSlugs,
  );

  const projectHref = (slug: string) => projectFinderContext
    ? buildProjectFinderProjectHref(
      projectFinderContext.direction,
      projectFinderContext.priorities,
      slug,
    )
    : `/projects/${slug}`;

  return (
    <MarketingPage
      className={styles.page}
      data-conversion-landing="simple-pergolas-auckland"
      data-indexing="noindex"
    >
      <section className={styles.hero} aria-labelledby="simple-pergola-title">
        <div className={styles.heroCopy}>
          <Eyebrow className={styles.heroEyebrow}>
            Simple acrylic pergolas · Auckland
          </Eyebrow>
          <Heading as="h1" variant="page" id="simple-pergola-title" className={styles.heroTitle}>
            Cover the space without losing light.
          </Heading>
          <Text size="large" className={styles.heroIntro}>
            Add fixed overhead cover without closing the space in. Acrylic
            lets daylight remain part of the roof, while optional side blinds
            can respond to low sun, privacy and exposed edges.
          </Text>
          <ActionGroup className={styles.heroActions}>
            <Button href="#initial-estimate">Request an initial estimate</Button>
            <TextLink href="#right-fit">See if a Simple cover fits</TextLink>
          </ActionGroup>
          <ul className={styles.heroProof} aria-label="Simple pergola assurances">
            <li><strong>99%</strong><span>of UV light blocked by our acrylic roofing</span></li>
            <li><strong>10 years</strong><span>workmanship warranty from Sanctuary</span></li>
            <li><strong>Optional</strong><span>side blinds planned with the frame</span></li>
          </ul>
        </div>
        <figure className={styles.heroMedia}>
          <Image
            src={heroImage}
            alt="Opal acrylic gable pergola above a St Heliers deck"
            fill
            priority
            loading="eager"
            fetchPriority="high"
            sizes="(max-width: 760px) 100vw, 58vw"
          />
          <figcaption>
            <span>St Heliers Townhouse</span>
            <span>Opal acrylic · 6.0 m × 3.0 m recorded cover</span>
          </figcaption>
        </figure>
      </section>

      <GuidedJourneyContext context={guidedContext} />
      <ProjectFinderJourneyContext context={projectFinderContext} />

      <section className={styles.definition} id="right-fit" aria-labelledby="simple-means-title">
        <Container width="wide" className={styles.definitionGrid}>
          <div>
            <Eyebrow>Is it right for you?</Eyebrow>
            <Heading id="simple-means-title">
              A focused solution, designed for your home.
            </Heading>
          </div>
          <div className={styles.definitionCopy}>
            <p className={styles.lead}>
              A Simple cover is for homeowners who want a fixed roof over a
              deck or patio without turning it into an enclosed room.
            </p>
            <p>
              The purpose is focused, but the design is not off the shelf.
              Roof form, acrylic finish, frame, house connection, drainage and
              any blinds still respond to the site.
            </p>
            <ul className={styles.fitList}>
              <li>You want a fixed roof over an existing deck, patio or outdoor area.</li>
              <li>Daylight to the outdoor space or adjoining rooms matters.</li>
              <li>You prefer ongoing overhead cover to an opening roof system.</li>
              <li>You want the roof alone or blinds on selected sides.</li>
            </ul>
          </div>
        </Container>
      </section>

      <section className={styles.levels} aria-labelledby="protection-title">
        <Container width="wide">
          <header className={styles.sectionHeader}>
            <div>
              <Eyebrow>Roof and side protection</Eyebrow>
              <Heading id="protection-title">
                Start overhead. Then resolve the exposed sides.
              </Heading>
            </div>
            <Text size="large">
              Every Simple cover starts with a fixed acrylic roof. Add blinds
              only where low sun, privacy or exposure affects how you will use
              the space.
            </Text>
          </header>
          <div className={styles.levelGrid}>
            {simpleCoverLevels.map((level) => (
              <article key={level.number}>
                <span>{level.number}</span>
                <h3>{level.title}</h3>
                <p>{level.text}</p>
                <small>{level.note}</small>
              </article>
            ))}
          </div>
          <div className={styles.blindFeature}>
            <div className={styles.blindMedia}>
              <Image
                src="/images/product-blinds-02.jpg"
                alt="Drop-down mesh blinds lowered on three sides beneath an acrylic pergola roof"
                fill
                sizes="(max-width: 900px) 100vw, 58vw"
              />
            </div>
            <div className={styles.blindCopy}>
              <Eyebrow>Optional side protection</Eyebrow>
              <Heading as="h3" variant="section">
                Blinds can belong in the Simple cover brief.
              </Heading>
              <p>
                A blind gives one exposed side an adjustable layer. Lower it
                for low sun, privacy or exposure, then retract it when you want
                the edge open. We plan the headbox, guides and operating
                clearance with the frame rather than adding them later.
              </p>
              <TextLink href="/products/screens-walls/drop-down-blinds">
                See how drop-down blinds work
              </TextLink>
            </div>
          </div>
        </Container>
      </section>

      <section className={styles.decision} aria-labelledby="decision-title">
        <Container width="wide">
          <header className={styles.sectionHeader}>
            <div>
              <Eyebrow>Benefits and trade-offs</Eyebrow>
              <Heading id="decision-title">
                Know what you are choosing.
              </Heading>
            </div>
            <Text size="large">
              A fixed acrylic roof is a strong choice for the right brief.
              Weigh these practical strengths and limitations before we
              recommend it for your home.
            </Text>
          </header>
          <div className={styles.decisionGrid}>
            <div>
              <h3>Where it works well</h3>
              {simpleCoverStrengths.map((item) => (
                <article key={item.title}>
                  <h4>{item.title}</h4>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
            <div>
              <h3>What to consider</h3>
              {simpleCoverConsiderations.map((item) => (
                <article key={item.title}>
                  <h4>{item.title}</h4>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
          <div className={styles.decisionActions}>
            <Button href="#initial-estimate">Talk through your space</Button>
            <TextLink href="/acrylic-roof-pergolas-auckland">
              Read the acrylic roof guide
            </TextLink>
          </div>
        </Container>
      </section>

      <section className={styles.projects} aria-labelledby="project-evidence-title">
        <Container width="wide">
          <header className={styles.sectionHeader}>
            <div>
              <Eyebrow>Built in Auckland</Eyebrow>
              <Heading id="project-evidence-title">
                Three homes. Three focused responses.
              </Heading>
            </div>
            <Text size="large">
              Each project uses acrylic roofing in response to its house and
              recorded brief. The dimensions and materials below come from
              the current project records.
            </Text>
          </header>
          <div className={styles.projectGrid}>
            {orderedProjectEvidence.map(({ project, label, summary, facts }, index) => (
              <Link
                href={projectHref(project.slug)}
                className={styles.projectCard}
                data-featured={index === 0 ? 'true' : undefined}
                key={project.slug}
              >
                <div className={styles.projectMedia}>
                  <Image
                    src={project.slug === 'dairy-flat-estate' ? '/images/project-dairy-flat-03.jpg' : project.heroImage.src}
                    alt={project.slug === 'dairy-flat-estate' ? 'Clear acrylic gable roof opening the Dairy Flat deck to the garden' : project.heroImage.alt}
                    fill
                    sizes={index === 0
                      ? '(max-width: 900px) 100vw, 62vw'
                      : '(max-width: 760px) 100vw, 32vw'}
                    style={{ objectPosition: project.slug === 'dairy-flat-estate' ? '50% 45%' : project.heroImage.objectPosition }}
                  />
                </div>
                <div className={styles.projectBody}>
                  <Eyebrow>{label}</Eyebrow>
                  <h3>{project.title}</h3>
                  <p>{summary}</p>
                  <ul>{facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
                  <span>View project</span>
                </div>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <section className={styles.scope} aria-labelledby="scope-title">
        <Container width="wide">
          <header className={styles.sectionHeader}>
            <div>
              <Eyebrow>Why Sanctuary</Eyebrow>
              <Heading id="scope-title">
                One joined-up proposal.
              </Heading>
            </div>
            <Text size="large">
              We resolve the roof, frame, connection, drainage and exposed
              edges together, then set out what is included before the project
              moves into delivery.
            </Text>
          </header>
          <div className={styles.scopeGrid}>
            {simpleCoverScope.map((item) => (
              <article key={item.number}>
                <span>{item.number}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className={styles.process} aria-labelledby="process-title">
        <Container width="wide" className={styles.processGrid}>
          <div className={styles.processIntro}>
            <Eyebrow>How it starts</Eyebrow>
            <Heading id="process-title">Start with photos. Get a clear direction.</Heading>
            <Text size="large">
              You do not need finished plans. A few photos, your suburb and
              rough dimensions are enough for us to assess the right pathway.
            </Text>
            <Button href="#initial-estimate">Request an initial estimate</Button>
          </div>
          <ol>
            {simpleCoverProcess.map((step) => (
              <li key={step.number}>
                <span>{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className={styles.customRoute} aria-labelledby="custom-route-title">
        <Container width="wide" className={styles.customRouteGrid}>
          <div>
            <Eyebrow>When Custom design is better</Eyebrow>
            <Heading id="custom-route-title">
              Choose Custom when the architecture drives the brief.
            </Heading>
          </div>
          <div>
            <p>
              Mixed roof areas, lined ceilings, integrated fireplaces or
              services, unusual geometry and difficult structural connections
              deserve broader design development. Side blinds alone do not put
              a project in this category.
            </p>
            <TextLink href="/custom-pergolas-auckland">
              Explore custom design
            </TextLink>
          </div>
        </Container>
      </section>

      <section className={styles.faq} aria-labelledby="simple-cover-faq-title">
        <Container width="wide">
          <header className={styles.sectionHeader}>
            <div>
              <Eyebrow>Before you enquire</Eyebrow>
              <Heading id="simple-cover-faq-title">
                Questions worth resolving early.
              </Heading>
            </div>
          </header>
          <div className={styles.faqList}>
            {simpleCoverFaqs.map((item, index) => (
              <details key={item.question}>
                <summary>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{item.question}</h3>
                  <i aria-hidden="true" />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <section
        className={styles.estimate}
        id="initial-estimate"
        aria-label="Simple pergola initial estimate enquiry"
      >
        <Container width="wide">
          <AcrylicPergolaEnquiryForm
            initialEnquiryType="residential"
            sourceContext={guidedContext?.enquiryContext ?? projectFinderContext?.enquiryContext ?? {
              enquiryType: 'residential',
              sourcePath: route,
              sourceComponent: 'embedded_form',
            }}
            eyebrow="Initial estimate"
            heading="Tell us about the space you want to cover."
            intro="Start with your contact details and a few photos. Rough dimensions help if you have them; finished plans are not required."
            submitLabel="Request my initial estimate"
            successHeading="Estimate request sent."
            successMessage="We’ll review the space and come back to you with the most useful next step."
            messageLabel="What would make the space work better?"
            messagePlaceholder="For example: cover the deck, keep daylight at the kitchen and allow for a blind on the western side."
            briefFields={[
              {
                name: 'sideProtection',
                label: 'Side protection',
                type: 'select',
                options: [
                  'Roof only',
                  'Roof with one side blind',
                  'Roof with blinds on more than one side',
                  'Unsure: please recommend an arrangement',
                ],
                wide: true,
              },
            ]}
            roofPreference={simpleCoverRoofPreference}
          />
        </Container>
      </section>
    </MarketingPage>
  );
}
