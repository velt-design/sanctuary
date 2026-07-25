import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import JsonLd from '@/components/JsonLd';
import {
  ActionGroup,
  Button,
  CardGrid,
  Container,
  EditorialCard,
  Eyebrow,
  FactList,
  Figure,
  Heading,
  MarketingPage,
  NumberedPrinciples,
  ProjectMeta,
  Section,
  SectionHeader,
  SpecificationRows,
  StaggeredGallery,
  Text,
  TextLink,
} from '@/components/marketing-foundation';
import { projects, type Project } from '@/data/projects';
import { GOOGLE_PLACE, featuredReviews } from '@/data/reviews';
import { buildEnquiryHref } from '@/lib/enquiryContext';
import { getGoogleRating } from '@/lib/googleReviews';
import { absoluteUrl } from '@/lib/seo';
import {
  designPrinciples,
  finalEnquiryChecklist,
  guidePathways,
  homepageDescription,
  integratedOptions,
  processSteps,
  proofPoints,
  reviewAuthors,
  roofApproaches,
  roofForms,
  selectedProjectProfiles,
  visitorPathways,
} from './content';
import HomepageInteractionTracker from './HomepageInteractionTracker';
import MobileDisclosure from './MobileDisclosure';
import styles from './home-v2.module.css';

const homepageTitle = 'Architectural Pergola Design & Build | Sanctuary Pergolas';
const homeHeroEnquiryHref = buildEnquiryHref({
  enquiryType: 'residential',
  sourcePath: '/',
  sourceComponent: 'hero',
});
const homeFinalEnquiryHref = buildEnquiryHref({
  enquiryType: 'residential',
  sourcePath: '/',
  sourceComponent: 'final_cta',
});
const homeProfessionalEnquiryHref = buildEnquiryHref({
  enquiryType: 'professional',
  sourcePath: '/',
  sourceComponent: 'pathway',
});

export const metadata: Metadata = {
  title: { absolute: homepageTitle },
  description: homepageDescription,
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: '/',
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
  if (!project) throw new Error(`Missing homepage V2 project: ${slug}`);
  return project;
}

function projectDimensions(project: Project): string | null {
  return project.stats.width && project.stats.depth
    ? `${project.stats.width} × ${project.stats.depth}`
    : null;
}

const leadProject = findProject('warkworth-outdoor-room');
const selectedProjects = selectedProjectProfiles.map((profile) => ({
  ...profile,
  project: findProject(profile.slug),
}));
const selectedReviews = featuredReviews.filter((review) => (
  reviewAuthors.some((author) => author === review.author)
));

type VisitorPathway = (typeof visitorPathways)[number];

function PathwayCard({
  index,
  pathway,
}: {
  index: number;
  pathway: VisitorPathway;
}) {
  return (
    <EditorialCard
      className={index === 0 ? styles.primaryPathway : undefined}
      href={pathway.href}
      variant="balanced"
      indexLabel={String(index + 1).padStart(2, '0')}
      eyebrow={pathway.eyebrow}
      title={pathway.title}
      copy={pathway.copy}
      actionLabel={pathway.action}
      data-homepage-event={pathway.event}
      data-homepage-item={pathway.eyebrow}
    />
  );
}

export default async function HomePage() {
  const review = await getGoogleRating();
  const ratingText = review.rating.toFixed(1);

  return (
    <MarketingPage className={styles.page} data-homepage-variant="v2">
      <HomepageInteractionTracker />
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Sanctuary Pergolas',
            url: absoluteUrl('/'),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: homepageTitle,
            url: absoluteUrl('/'),
            description: homepageDescription,
            isPartOf: {
              '@type': 'WebSite',
              name: 'Sanctuary Pergolas',
              url: absoluteUrl('/'),
            },
          },
        ]}
      />

      <section className={styles.hero} aria-labelledby="homepage-heading" data-home-section="hero">
        <Image
          src="/images/project-warkworth-outdoor-room-02.jpg"
          alt="Timber-lined Warkworth gable outdoor room with integrated lighting and lounge seating"
          fill
          priority
          fetchPriority="high"
          quality={75}
          sizes="100vw"
          className={styles.heroImage}
        />
        <div className={styles.heroShade} aria-hidden="true" />
        <Container width="wide" className={styles.heroContent}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <Eyebrow className={styles.heroEyebrow}>Fixed-roof pergola design and build in Auckland</Eyebrow>
              <Heading as="h1" variant="page" className={styles.heroHeading} id="homepage-heading">
                Bespoke pergolas, built around the architecture.
              </Heading>
              <Text size="large" className={styles.heroText}>
                Sanctuary designs, builds and installs bespoke fixed-roof pergolas for Auckland homes and selected commercial projects.
              </Text>
              <ActionGroup className={styles.heroActions} aria-label="Homepage actions">
                <Button href={homeHeroEnquiryHref} data-homepage-event="hero_estimate_click">Get an initial project estimate</Button>
                <TextLink href="/projects" className={styles.heroLink} data-homepage-event="hero_projects_click">
                  View completed projects
                </TextLink>
              </ActionGroup>
              <p className={styles.heroMicrocopy}>
                Send your suburb, photos and rough dimensions for an initial assessment and indicative range where feasible.
              </p>
            </div>
            <ProjectMeta
              className={styles.heroMeta}
              items={[leadProject.location, leadProject.type, leadProject.roof, leadProject.year]}
            />
          </div>
        </Container>
      </section>

      <aside className={styles.proofRail} aria-label="Sanctuary project evidence">
        <Container width="wide">
          <div className={styles.proofGrid}>
            <a
              className={styles.proofItem}
              href={GOOGLE_PLACE.reviewsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Rated ${ratingText} out of 5 from ${review.count} Google reviews`}
              data-live-rating
              data-proof-item
            >
              <span className={styles.proofValue} data-proof-primary>{ratingText}</span>
              <span className={styles.proofLabel} data-proof-supporting>{review.count} Google reviews</span>
            </a>
            {proofPoints.map((item) => (
              <div className={styles.proofItem} key={item.label} data-proof-item>
                <span className={styles.proofValue} data-proof-primary>{item.value}</span>
                <span className={styles.proofLabel} data-proof-supporting>{item.label}</span>
              </div>
            ))}
          </div>
        </Container>
      </aside>

      <Section aria-labelledby="featured-warkworth-project" data-home-section="featured-project">
        <Container width="wide">
          <article className={styles.featuredProject}>
            <Figure
              image={leadProject.heroImage.src}
              alt={leadProject.heroImage.alt}
              ratio="landscape"
              mobileRatio="standard"
              className={styles.featuredProjectMedia}
              objectPosition={leadProject.heroImage.objectPosition}
            />
            <div className={styles.featuredProjectCopy}>
              <div>
                <Eyebrow>Featured project / Warkworth, Auckland</Eyebrow>
                <Heading id="featured-warkworth-project">{leadProject.title}</Heading>
              </div>
              <Text size="large">{leadProject.description[0]}</Text>
              <FactList
                items={[
                  { label: 'Footprint', value: projectDimensions(leadProject) },
                  { label: 'Configuration', value: 'Freestanding gable' },
                  { label: 'Roof and ceiling', value: 'Solid and clear acrylic zones with cedar lining' },
                ]}
              />
              <MobileDisclosure
                summary="View the design response"
                eventName="featured_project_response_expand"
              >
                <div className={styles.projectEvidence}>
                  <div>
                    <h3>Design constraint</h3>
                    <p>Create a substantial room beside the house without relying on the existing structure for support, while retaining daylight and a connection to the garden.</p>
                  </div>
                  <div>
                    <h3>Sanctuary response</h3>
                    <p>A freestanding gable combines the new deck, fireplace, clear acrylic glazing, solid roof zones, cedar ceiling and lighting within one resolved structure.</p>
                  </div>
                </div>
              </MobileDisclosure>
              <ActionGroup>
                <Button href={`/projects/${leadProject.slug}`} data-homepage-event="project_case_study_click" data-homepage-item={leadProject.slug}>
                  View the Warkworth project
                </Button>
                <TextLink href="/projects" data-homepage-event="project_gallery_click">Browse all completed projects</TextLink>
              </ActionGroup>
            </div>
          </article>
        </Container>
      </Section>

      <Section aria-labelledby="project-pathways" data-home-section="project-pathways">
        <Container width="wide">
          <SectionHeader
            eyebrow="Start with the project context"
            heading="Home projects come first."
            headingId="project-pathways"
          >
            <Text>Residential enquiries begin with the home and intended use. Complex sites and custom details stay within that same design pathway.</Text>
            <TextLink href="/custom-pergolas-auckland" data-homepage-event="custom_pathway_click">
              Read about custom design conditions
            </TextLink>
          </SectionHeader>
          <CardGrid columns={2}>
            {visitorPathways.slice(0, 1).map((pathway, index) => (
              <PathwayCard index={index} key={pathway.title} pathway={pathway} />
            ))}
            <MobileDisclosure
              className={styles.pathwayDisclosure}
              summary="Commercial and professional projects"
              eventName="project_types_expand"
            >
              <div className={styles.pathwayDisclosureGrid}>
                {visitorPathways.slice(1).map((pathway, index) => (
                  <PathwayCard index={index + 1} key={pathway.title} pathway={pathway} />
                ))}
              </div>
            </MobileDisclosure>
          </CardGrid>
        </Container>
      </Section>

      <Section aria-labelledby="selected-projects" data-home-section="selected-projects">
        <Container width="wide">
          <div className={styles.galleryHeader}>
            <div>
              <Eyebrow>Selected work</Eyebrow>
              <Heading id="selected-projects" as="h2" variant="card">Built across different sites and briefs</Heading>
            </div>
            <TextLink href="/projects" data-homepage-event="project_gallery_click">View all projects</TextLink>
          </div>
          <div data-homepage-event="project_case_study_click">
            <StaggeredGallery
              className={styles.selectedGallery}
              items={selectedProjects.map(({ project, configuration, roofApproach }) => ({
                image: project.heroImage.src,
                alt: project.heroImage.alt,
                title: project.title,
                detail: [project.location, projectDimensions(project), configuration, roofApproach].filter(Boolean).join(' / '),
                href: `/projects/${project.slug}`,
                objectPosition: project.heroImage.objectPosition,
              }))}
            />
          </div>
        </Container>
      </Section>

      <Section tone="warm" aria-labelledby="planning-options" data-home-section="planning-options">
        <Container width="wide">
          <SectionHeader
            eyebrow="Planning the design"
            heading="Resolve the form, roof and comfort as one brief."
            headingId="planning-options"
          >
            <Text>Start with the site and intended use. The detailed options can follow once the right constraints and priorities are clear.</Text>
          </SectionHeader>
          <div className={styles.planningGroups}>
            <MobileDisclosure
              className={styles.planningDisclosure}
              summary="How Sanctuary approaches the design"
              eventName="design_principles_expand"
            >
              <NumberedPrinciples items={designPrinciples.map((item) => ({ ...item }))} />
            </MobileDisclosure>
            <MobileDisclosure
              className={styles.planningDisclosure}
              summary="Compare four pergola forms"
              eventName="pergola_forms_expand"
            >
              <div className={styles.roofRows}>
              {roofForms.map((roof, index) => (
                <article className={styles.roofRow} key={roof.title}>
                  <div className={styles.roofFormMedia}>
                    <Image
                      src={roof.image}
                      alt={roof.alt}
                      fill
                      quality={75}
                      sizes="(max-width: 640px) calc(50vw - 1.9rem), 1px"
                      style={{ objectFit: 'cover', objectPosition: roof.objectPosition }}
                    />
                  </div>
                  <span className={styles.roofNumber}>{String(index + 1).padStart(2, '0')}</span>
                  <Heading as="h3" variant="card">{roof.title}</Heading>
                  <Text size="small">{roof.copy}</Text>
                  <TextLink href={roof.href} data-homepage-event="pergola_form_click" data-homepage-item={roof.title}>Explore</TextLink>
                </article>
              ))}
              </div>
              <TextLink href="/products" data-homepage-event="pergola_forms_compare_click">Compare pergola forms</TextLink>
            </MobileDisclosure>
            <MobileDisclosure
              className={styles.planningDisclosure}
              summary="Compare roof and material approaches"
              eventName="roof_approaches_expand"
            >
              <div className={styles.roofApproachGrid}>
                {roofApproaches.map((approach, index) => (
                  <article className={styles.roofApproachCard} key={approach.title}>
                    <div className={styles.roofApproachMedia}>
                      <Image
                        src={approach.image}
                        alt={approach.alt}
                        fill
                        quality={75}
                        unoptimized={approach.image.endsWith('.webp')}
                        sizes="(max-width: 640px) calc(100vw - 2.5rem), 1px"
                        style={{ objectFit: 'cover', objectPosition: approach.objectPosition }}
                      />
                    </div>
                    <span className={styles.cardNumber}>{String(index + 1).padStart(2, '0')}</span>
                    <Eyebrow className={styles.mobileRoofEyebrow}>Roof approach</Eyebrow>
                    <Heading as="h3" variant="card">{approach.title}</Heading>
                    <Text>{approach.copy}</Text>
                    <TextLink href={approach.href} data-homepage-event="roof_approach_click" data-homepage-item={approach.title}>{approach.action}</TextLink>
                  </article>
                ))}
              </div>
              <SpecificationRows
                rows={[
                  { label: 'Structure', value: 'Architectural aluminium framing, with steel where project requirements demand it' },
                  { label: 'Linings and ceilings', value: 'Timber sarking, cedar and selected solid ceiling treatments, specified separately from the roof category' },
                  { label: 'Junctions and drainage', value: 'Flashings, falls, gutters and house connections resolved with the frame and roof' },
                ]}
              />
              <TextLink href="/pergolas-auckland#roofing-options" data-homepage-event="roof_comparison_click">Compare roof approaches</TextLink>
            </MobileDisclosure>
            <MobileDisclosure
              className={styles.planningDisclosure}
              summary="Plan integrated comfort options"
              eventName="integrated_options_expand"
            >
              <div className={styles.integrationRows}>
                {integratedOptions.map((option, index) => (
                  <article className={styles.integrationRow} key={option.title}>
                    <span className={styles.roofNumber}>{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <Heading as="h3" variant="card">{option.title}</Heading>
                      <Text size="small">{option.copy}</Text>
                      <TextLink href={option.href} data-homepage-event="integrated_option_click" data-homepage-item={option.title}>{option.action}</TextLink>
                    </div>
                  </article>
                ))}
              </div>
            </MobileDisclosure>
          </div>
        </Container>
      </Section>

      <Section tone="warm" aria-labelledby="design-build-process" data-home-section="design-build-process">
        <Container width="wide">
          <SectionHeader
            eyebrow="Design and build process"
            heading="Three stages, with expectations confirmed in writing."
            headingId="design-build-process"
          >
            <Text>Design, materials, inclusions, exclusions, price, programme and applicable warranty information are recorded before manufacture or site work proceeds.</Text>
          </SectionHeader>
          <ol className={styles.processSteps}>
            {processSteps.map((step, index) => (
              <li key={step.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <Heading as="h3" variant="card">{step.title}</Heading>
                <Text>{step.copy}</Text>
              </li>
            ))}
          </ol>
          <div className={styles.processAction}>
            <Button href={homeFinalEnquiryHref} data-homepage-event="process_enquiry_click">Start with your project details</Button>
          </div>
        </Container>
      </Section>

      <Section tone="inverse" aria-labelledby="homepage-review-heading" data-home-section="client-review">
        <Container width="wide">
          <div className={styles.inverseIntro}>
            <div>
              <Eyebrow>Client perspective</Eyebrow>
              <Heading id="homepage-review-heading">Trusted for the design, build and installation.</Heading>
            </div>
          </div>
          <div className={`${styles.reviewGrid} ${styles.singleReview}`}>
            <figure className={styles.reviewCard} data-home-review>
              <blockquote>&ldquo;{selectedReviews[0]?.quote}&rdquo;</blockquote>
              <figcaption>{selectedReviews[0]?.author} / Google review</figcaption>
            </figure>
          </div>
          <div className={styles.reviewSummary}>
            <span>Rated {ratingText} from {review.count} Google reviews</span>
            <a href={GOOGLE_PLACE.reviewsUrl} target="_blank" rel="noopener noreferrer">
              Read all reviews on Google
            </a>
          </div>
        </Container>
      </Section>

      <Section tone="inverse" aria-labelledby="qualified-enquiry" data-home-section="qualified-enquiry">
        <Container width="wide" className={styles.finalGrid}>
          <div className={styles.finalCopy}>
            <Eyebrow>Start with the site and intended use</Eyebrow>
            <Heading id="qualified-enquiry">Send enough detail for a useful first response.</Heading>
            <Text size="large">
              Sanctuary reviews the initial information, identifies likely options, flags site or scope considerations and recommends a next step. Where the brief is clear, an indicative price range may be possible.
            </Text>
            <ActionGroup>
              <Button href={homeFinalEnquiryHref} data-homepage-event="final_enquiry_click">Send your project details</Button>
            </ActionGroup>
            <nav className={styles.secondaryPathways} aria-label="Alternative enquiry pathways">
              <TextLink href="/commercial-pergolas-auckland#project-details" data-homepage-event="commercial_pathway_click">Discuss a commercial project</TextLink>
              <TextLink href={homeProfessionalEnquiryHref} data-homepage-event="professional_pathway_click">Send plans or a project brief</TextLink>
            </nav>
          </div>
          <div className={styles.finalSupport}>
            <div className={styles.finalChecklist}>
              <h3>Useful first inputs</h3>
              <ul>
                {finalEnquiryChecklist.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
              </ul>
              <MobileDisclosure
                className={styles.finalChecklistDisclosure}
                summary="More helpful project information"
                eventName="enquiry_inputs_expand"
              >
                <ul>
                  {finalEnquiryChecklist.slice(3).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </MobileDisclosure>
            </div>
            <div className={styles.finalGuides}>
              <Eyebrow>Planning guides</Eyebrow>
              <Heading id="pergola-guide-pathways" as="h3" variant="card">Compare before you enquire</Heading>
              <nav aria-label="Featured pergola guides">
                <ul className={styles.guideLinks}>
                  {guidePathways.map((guide) => (
                    <li key={guide.title}>
                      <Link
                        href={guide.href}
                        data-homepage-event="guide_pathway_click"
                        data-homepage-item={guide.title}
                      >
                        <span>{guide.title}</span>
                        <span>{guide.copy}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <TextLink href="/pergola-guides" data-homepage-event="guide_gateway_click">Explore all pergola guides</TextLink>
            </div>
          </div>
        </Container>
      </Section>
    </MarketingPage>
  );
}
