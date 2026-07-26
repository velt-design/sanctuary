import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ActionGroup,
  Button,
  Container,
  Eyebrow,
  Heading,
  MarketingPage,
  ProjectMeta,
  Text,
  TextLink,
} from '@/components/marketing-foundation';
import { projects, type Project } from '@/data/projects';
import { GOOGLE_PLACE } from '@/data/reviews';
import { buildEnquiryHref } from '@/lib/enquiryContext';
import { getGoogleRating } from '@/lib/googleReviews';
import DesignConversation from './DesignConversation';
import JsonLd from '@/components/JsonLd';
import HomepageDesignConversationTracker from './HomepageDesignConversationTracker';
import {
  HOME_PATH,
  HOME_VARIANT,
  getIntentResponses,
  type IntentResponse,
} from './matching';
import { absoluteUrl } from '@/lib/seo';
import {
  audiencePathways,
  homepageDescription,
  homepageTitle,
  processSteps,
} from './content';
import styles from './homepage.module.css';

const generalEnquiryHref = buildEnquiryHref({
  sourcePath: HOME_PATH,
  sourceComponent: 'hero',
});

export const metadata: Metadata = {
  title: { absolute: homepageTitle },
  description: homepageDescription,
  alternates: { canonical: HOME_PATH },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: HOME_PATH,
    title: homepageTitle,
    description: homepageDescription,
    images: [{
      url: '/images/project-warkworth-outdoor-room-02.jpg',
      alt: 'Inhabited Warkworth outdoor room beneath a bespoke fixed roof',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: homepageTitle,
    description: homepageDescription,
    images: ['/images/project-warkworth-outdoor-room-02.jpg'],
  },
};

function findProject(slug: string): Project {
  const project = projects.find((candidate) => candidate.slug === slug);
  if (!project) throw new Error(`Missing homepage project: ${slug}`);
  return project;
}

function NoScriptProjectCard({
  project,
}: {
  project: IntentResponse['projects'][number];
}) {
  return (
    <article className={styles.noScriptProject}>
      <h3>{project.title}</h3>
      <p>{project.location} / {project.type} / {project.roof}</p>
      <p>{project.rationale}</p>
      <div>
        <a
          href={project.projectHref}
          aria-label={`View ${project.title} project`}
        >
          View project
        </a>
        <a
          href={project.enquiryHref}
          aria-label={`Use ${project.title} as an enquiry reference`}
        >
          Use this project as a reference
        </a>
      </div>
    </article>
  );
}

function NoScriptConversationFallback({
  responses,
}: {
  responses: IntentResponse[];
}) {
  return (
    <noscript>
      <style>{'[data-design-conversation-interactive]{display:none!important}'}</style>
      <div className={styles.noScriptFallback}>
        {responses.map((response) => (
          <section
            className={styles.noScriptPathway}
            id={`intent-${response.value}`}
            key={response.value}
            aria-labelledby={`intent-${response.value}-heading`}
          >
            <h3 id={`intent-${response.value}-heading`}>{response.label}</h3>
            <p>{response.statement}</p>
            <div className={styles.noScriptProjects}>
              {response.projects.map((project) => (
                <NoScriptProjectCard project={project} key={project.slug} />
              ))}
            </div>
            <a href={response.generalEnquiryHref}>
              Continue without a project reference
            </a>
          </section>
        ))}
        <p>
          <a href="/projects">Browse all completed projects</a>
        </p>
      </div>
    </noscript>
  );
}

export default async function HomePage() {
  const leadProject = findProject('warkworth-outdoor-room');
  const openingImage = leadProject.gallery[0] ?? leadProject.heroImage;
  const responses = getIntentResponses(projects);
  const review = await getGoogleRating();

  return (
    <MarketingPage
      className={styles.page}
      data-homepage-variant={HOME_VARIANT}
    >
      <HomepageDesignConversationTracker />
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Sanctuary Pergolas',
            url: absoluteUrl(HOME_PATH),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: homepageTitle,
            url: absoluteUrl(HOME_PATH),
            description: homepageDescription,
            isPartOf: {
              '@type': 'WebSite',
              name: 'Sanctuary Pergolas',
              url: absoluteUrl(HOME_PATH),
            },
          },
        ]}
      />

      <section
        className={styles.hero}
        aria-labelledby="homepage-heading"
        data-homepage-hero
      >
        <Image
          src={openingImage.src}
          alt={openingImage.alt}
          fill
          priority
          fetchPriority="high"
          quality={75}
          sizes="100vw"
          className={styles.heroImage}
          style={{ objectPosition: openingImage.objectPosition }}
        />
        <div className={styles.heroShade} aria-hidden="true" />
        <Container width="wide" className={styles.heroContent}>
          <div className={styles.heroCopy}>
            <Eyebrow className={styles.heroEyebrow}>
              Fixed-roof pergola design and build in Auckland
            </Eyebrow>
            <Heading
              as="h1"
              variant="page"
              className={styles.heroHeading}
              id="homepage-heading"
            >
              Begin with built work.
            </Heading>
            <Text size="large" className={styles.heroProposition}>
              Bespoke fixed-roof pergolas designed around the home or
              commercial site, its architecture and intended use.
            </Text>
            <ActionGroup
              className={styles.heroActions}
              aria-label="Homepage actions"
            >
              <Button
                href="#design-conversation"
                data-design-conversation-event="design_conversation_start"
                data-step-number="1"
              >
                Start with your project
              </Button>
              <TextLink
                className={styles.heroProjectLink}
                href={`/projects/${leadProject.slug}`}
                data-design-conversation-event="design_conversation_project_open"
                data-selected-project={leadProject.slug}
              >
                View Warkworth project
              </TextLink>
            </ActionGroup>
          </div>
          <div className={styles.heroProjectMeta}>
            <span>Completed project</span>
            <strong>{leadProject.title}</strong>
            <ProjectMeta
              items={[
                leadProject.location,
                leadProject.type,
                leadProject.roof,
              ]}
            />
          </div>
        </Container>
      </section>

      <aside className={styles.proofRail} aria-label="Sanctuary project proof">
        <Container width="wide" className={styles.proofGrid}>
          <a
            href={GOOGLE_PLACE.reviewsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${review.rating.toFixed(1)} from ${review.count} Google reviews`}
          >
            <strong>{review.rating.toFixed(1)}</strong>
            <span>{review.count} Google reviews</span>
          </a>
          <div>
            <strong>Design &amp; build</strong>
            <span>One team from first brief to installation</span>
          </div>
          <div>
            <strong>Built evidence</strong>
            <span>Real residential and commercial projects</span>
          </div>
        </Container>
      </aside>

      <section
        className={styles.conversationSection}
        aria-labelledby="design-conversation-heading"
      >
        <Container width="wide">
          <div
            className={styles.conversationIntroduction}
            id="design-conversation"
          >
            <div>
              <p>One useful starting point</p>
              <h2 id="design-conversation-heading">
                What are you trying to create?
              </h2>
            </div>
            <p id="design-conversation-guidance">
              Choose the closest starting point and we will show two completed
              projects with a related brief.
            </p>
          </div>
          <DesignConversation responses={responses} />
          <NoScriptConversationFallback responses={responses} />
        </Container>
      </section>

      <section
        className={styles.capabilitySection}
        aria-labelledby="homepage-capability-heading"
      >
        <Container width="wide">
          <div className={styles.capabilityIntroduction}>
            <div>
              <p>Designed around the site</p>
              <h2 id="homepage-capability-heading">
                Fixed-roof pergolas shaped by the architecture.
              </h2>
            </div>
            <p>
              Sanctuary designs and builds project-specific fixed-roof
              pergolas for Auckland homes and selected commercial sites.
              Form, roof, drainage and integrated details are resolved
              together around the architecture and intended use.
            </p>
          </div>
          <div className={styles.audienceGrid}>
            {audiencePathways.map((pathway, index) => (
              <article key={pathway.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{pathway.title}</h3>
                <p>{pathway.copy}</p>
                <Link
                  href={pathway.href}
                  data-design-conversation-event={
                    pathway.event
                  }
                  data-enquiry-type={pathway.enquiryType}
                >
                  {pathway.action}
                </Link>
              </article>
            ))}
          </div>
          <div className={styles.supportLinks}>
            <Link
              href="/products"
              data-design-conversation-event="design_conversation_support_open"
            >
              Compare pergola forms and roof approaches
            </Link>
            <Link
              href="/pergola-guides"
              data-design-conversation-event="design_conversation_support_open"
            >
              Read the planning guides
            </Link>
          </div>
        </Container>
      </section>

      <section
        className={styles.processSection}
        aria-labelledby="homepage-process-heading"
      >
        <Container width="wide" className={styles.processGrid}>
          <div>
            <p>Design and build process</p>
            <h2 id="homepage-process-heading">
              From a useful brief to an installed structure.
            </h2>
          </div>
          <ol>
            {processSteps.map((step, index) => (
              <li key={step.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section
        className={styles.enquiryClose}
        aria-labelledby="homepage-close-heading"
      >
        <Container width="wide" className={styles.enquiryCloseGrid}>
          <div>
            <p>Prefer to begin directly?</p>
            <h2 id="homepage-close-heading">
              Share the site, intended use and what you know so far.
            </h2>
          </div>
          <div>
            <p>
              Photos and approximate dimensions are useful, but an early idea
              is enough to begin an initial project conversation.
            </p>
            <div className={styles.closeActions}>
              <Link
                href={generalEnquiryHref}
                data-design-conversation-event="design_conversation_general_enquiry_click"
              >
                Share your project details
              </Link>
              <a href="tel:+64228545633">Call 022 854 5633</a>
            </div>
          </div>
        </Container>
      </section>
    </MarketingPage>
  );
}
