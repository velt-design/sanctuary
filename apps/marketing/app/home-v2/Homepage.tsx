import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import JsonLd from '@/components/JsonLd';
import {
  Button,
  Container,
  Eyebrow,
  Figure,
  FullBleedStatement,
  Heading,
  NumberedPrinciples,
  ProcessSteps,
  ProjectMeta,
  Section,
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
import MobileReviewCarousel from './MobileReviewCarousel';
import styles from './home-v2.module.css';

const homepageTitle = 'Architectural Pergola Design & Build | Sanctuary Pergolas';
const homepageEnquiryHrefs = {
  hero: buildEnquiryHref({
    enquiryType: 'residential',
    sourcePath: '/',
    sourceComponent: 'homepage-hero',
  }),
  process: buildEnquiryHref({
    enquiryType: 'residential',
    sourcePath: '/',
    sourceComponent: 'homepage-process',
  }),
  final: buildEnquiryHref({
    enquiryType: 'residential',
    sourcePath: '/',
    sourceComponent: 'homepage-final',
  }),
  professional: buildEnquiryHref({
    enquiryType: 'professional',
    sourcePath: '/',
    sourceComponent: 'homepage-professional',
  }),
};

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
const mobileSelectedProjects = selectedProjects.slice(0, 2);
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
    <Link
      className={styles.pathwayCard}
      href={pathway.href}
      data-homepage-event={pathway.event}
      data-homepage-item={pathway.eyebrow}
    >
      <span className={styles.cardNumber}>{String(index + 1).padStart(2, '0')}</span>
      <Eyebrow>{pathway.eyebrow}</Eyebrow>
      <Heading as="h3" variant="card">{pathway.title}</Heading>
      <Text>{pathway.copy}</Text>
      <span className={styles.cardAction}>{pathway.action}</span>
    </Link>
  );
}

export default async function HomePage() {
  const review = await getGoogleRating();
  const ratingText = review.rating.toFixed(1);

  return (
    <main className={styles.page} data-homepage-variant="v2">
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

      <section className={styles.hero} aria-labelledby="homepage-heading">
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
              <div className={styles.heroActions} aria-label="Homepage actions">
                <Button href={homepageEnquiryHrefs.hero} data-homepage-event="hero_estimate_click">Get an initial project estimate</Button>
                <TextLink href="/projects" className={styles.heroLink} data-homepage-event="hero_projects_click">
                  View completed projects
                </TextLink>
              </div>
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

      <Section aria-labelledby="featured-warkworth-project">
        <Container width="wide">
          <article className={styles.featuredProject}>
            <Figure
              image={leadProject.heroImage.src}
              alt={leadProject.heroImage.alt}
              ratio="landscape"
              className={styles.featuredProjectMedia}
              objectPosition={leadProject.heroImage.objectPosition}
            />
            <div className={styles.featuredProjectCopy}>
              <div>
                <Eyebrow>Featured project / Warkworth, Auckland</Eyebrow>
                <Heading id="featured-warkworth-project">{leadProject.title}</Heading>
              </div>
              <Text size="large">{leadProject.description[0]}</Text>
              <dl className={styles.projectFacts}>
                <div><dt>Footprint</dt><dd>{projectDimensions(leadProject)}</dd></div>
                <div><dt>Configuration</dt><dd>Freestanding gable</dd></div>
                <div><dt>Roof and ceiling</dt><dd>Solid and clear acrylic zones with cedar lining</dd></div>
              </dl>
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
              <div className={styles.sectionActions}>
                <Button href={`/projects/${leadProject.slug}`} data-homepage-event="project_case_study_click" data-homepage-item={leadProject.slug}>
                  View the Warkworth project
                </Button>
                <TextLink href="/projects" data-homepage-event="project_gallery_click">Browse all completed projects</TextLink>
              </div>
            </div>
          </article>
        </Container>
      </Section>

      <Section aria-labelledby="project-pathways">
        <Container width="wide">
          <div className={styles.sectionIntro}>
            <div>
              <Eyebrow>Choose the right starting point</Eyebrow>
              <Heading id="project-pathways">Different briefs need different pathways.</Heading>
            </div>
            <Text className={styles.mobileSecondaryCopy}>Use the route that best matches the project today. The form, material and detailed scope can follow once the right context is clear.</Text>
          </div>
          <div className={styles.pathwayGrid}>
            {visitorPathways.slice(0, 2).map((pathway, index) => (
              <PathwayCard index={index} key={pathway.title} pathway={pathway} />
            ))}
            <MobileDisclosure
              className={styles.pathwayDisclosure}
              summary="Other project types"
              eventName="project_types_expand"
            >
              <div className={styles.pathwayDisclosureGrid}>
                {visitorPathways.slice(2).map((pathway, index) => (
                  <PathwayCard index={index + 2} key={pathway.title} pathway={pathway} />
                ))}
              </div>
            </MobileDisclosure>
          </div>
        </Container>
      </Section>

      <Section className={styles.mobileSelectedProjects} aria-labelledby="mobile-selected-projects">
        <Container width="wide">
          <div className={styles.galleryHeader}>
            <div>
              <Eyebrow>Selected work</Eyebrow>
              <Heading id="mobile-selected-projects">Built across different sites and briefs.</Heading>
            </div>
            <TextLink href="/projects" data-homepage-event="project_gallery_click">View all projects</TextLink>
          </div>
          <div className={styles.mobileProjectPreviewGrid}>
            {mobileSelectedProjects.map(({ project, configuration, roofApproach }) => (
              <article className={styles.mobileProjectPreviewCard} key={project.slug}>
                <Link
                  className={styles.mobileProjectPreviewMedia}
                  href={`/projects/${project.slug}`}
                  data-homepage-event="project_case_study_click"
                  data-homepage-item={project.slug}
                  aria-label={`View ${project.title}`}
                >
                  <Image
                    src={project.heroImage.src}
                    alt={project.heroImage.alt}
                    fill
                    quality={75}
                    sizes="(max-width: 640px) calc(100vw - 2.5rem), 1px"
                    style={{ objectFit: 'cover', objectPosition: project.heroImage.objectPosition }}
                  />
                </Link>
                <div className={styles.mobileProjectPreviewCopy}>
                  <Heading as="h3" variant="card">{project.title}</Heading>
                  <p>{[project.location, projectDimensions(project), configuration, roofApproach].filter(Boolean).join(' / ')}</p>
                  <TextLink
                    href={`/projects/${project.slug}`}
                    data-homepage-event="project_case_study_click"
                    data-homepage-item={project.slug}
                  >
                    View project
                  </TextLink>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="warm" aria-labelledby="sanctuary-design-approach">
        <Container>
          <div className={styles.sectionIntro}>
            <div>
              <Eyebrow>The Sanctuary design approach</Eyebrow>
              <Heading id="sanctuary-design-approach">One design response, from home to final detail.</Heading>
            </div>
            <div className={styles.introAction}>
              <Text>Each decision is made in context so the structure, roof and room below it support the same brief.</Text>
              <TextLink href="/custom-pergolas-auckland" data-homepage-event="approach_click">Explore custom design capability</TextLink>
            </div>
          </div>
          <MobileDisclosure
            summary="View the three design principles"
            eventName="design_principles_expand"
          >
            <NumberedPrinciples items={designPrinciples.map((item) => ({ ...item }))} />
          </MobileDisclosure>
        </Container>
      </Section>

      <FullBleedStatement
        image="/images/timber-gable-ceiling.jpg"
        alt="Timber-lined Riverhead gable roof framing blue sky and treetops"
        eyebrow="Riverhead / Gable / Solid roof"
        heading="A roof form is only the beginning."
        copy="Structure, roofing, lining, drainage and integrated services are resolved as one assembly."
        action={{ label: 'See the Riverhead project', href: '/projects/riverhead-gable-pavilion' }}
      />

      <Section tone="warm" aria-labelledby="pergola-forms">
        <Container width="wide">
          <div className={styles.sectionIntro}>
            <div>
              <Eyebrow>Pergola forms</Eyebrow>
              <Heading id="pergola-forms">Four forms, selected for a reason.</Heading>
            </div>
            <div className={styles.introAction}>
              <Text>Available height, roofline, drainage, proportion and the area to cover help determine which geometry belongs on the site.</Text>
              <TextLink href="/products" data-homepage-event="pergola_forms_compare_click">Compare pergola forms</TextLink>
            </div>
          </div>
          <div className={styles.roofIndex}>
            <Figure
              image="/images/product-gable-02.jpg"
              alt="Gable pergola roof with dark aluminium framing and clear acrylic panels"
              caption="Gable roof form"
              detail="Structure and daylight resolved together"
              className={styles.roofFigure}
            />
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
          </div>
        </Container>
      </Section>

      <Section aria-labelledby="roof-and-material-approaches">
        <Container width="wide">
          <div className={styles.sectionIntro}>
            <div>
              <Eyebrow>Roofing and materials</Eyebrow>
              <Heading id="roof-and-material-approaches">Choose what the roof should do to the room.</Heading>
            </div>
            <Text>Acrylic, solid and combination roofs create different relationships with daylight, shade and the architecture. No one approach is right for every project.</Text>
          </div>
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
          <div className={styles.materialContext}>
            <MobileDisclosure
              summary="How the roof is resolved"
              eventName="roof_resolution_expand"
            >
              <SpecificationRows
                rows={[
                  { label: 'Structure', value: 'Architectural aluminium framing, with steel where project requirements demand it' },
                  { label: 'Linings and ceilings', value: 'Timber sarking, cedar and selected solid ceiling treatments, specified separately from the roof category' },
                  { label: 'Junctions and drainage', value: 'Flashings, falls, gutters and house connections resolved with the frame and roof' },
                ]}
              />
            </MobileDisclosure>
            <TextLink href="/pergolas-auckland#roofing-options" data-homepage-event="roof_comparison_click">Compare roof approaches</TextLink>
          </div>
        </Container>
      </Section>

      <Section tone="elevated" aria-labelledby="integrated-options">
        <Container width="wide">
          <div className={styles.sectionIntro}>
            <div>
              <Eyebrow>Integrated options</Eyebrow>
              <Heading id="integrated-options">Plan comfort into the structure.</Heading>
            </div>
            <Text>Blinds, lighting and heating work best when mounting, power, clearances, exposure and the intended use are considered before fabrication.</Text>
          </div>
          <div className={styles.integrationGrid}>
            <Figure
              image="/images/project-warkworth-outdoor-room-04.jpg"
              alt="Clear acrylic glazing, cedar ceiling and integrated lighting in the Warkworth outdoor room"
              caption="Warkworth Outdoor Room"
              detail="Roof, ceiling and lighting coordinated together"
              className={styles.integrationFigure}
            />
            <MobileDisclosure
              summary="View integrated comfort options"
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

      <Section className={styles.desktopSelectedProjects} aria-labelledby="selected-projects">
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

      <Section tone="warm" aria-labelledby="design-build-process">
        <Container width="wide">
          <div className={styles.sectionIntro}>
            <div>
              <Eyebrow>Design and build process</Eyebrow>
              <Heading id="design-build-process">From useful first brief to documented handover.</Heading>
            </div>
            <Text>The programme and on-site sequence depend on the completed scope, access, approvals, materials and current schedule. They are confirmed for the project in writing.</Text>
          </div>
          <div className={styles.desktopProcess}>
            <ProcessSteps items={processSteps.map((item) => ({ ...item }))} />
          </div>
          <ol className={styles.mobileProcess}>
            {processSteps.map((step, index) => (
              <li key={step.title}>
                <details
                  open={index === 0}
                  data-homepage-toggle-event="process_item_expand"
                  data-homepage-item={step.title}
                >
                  <summary>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <Heading as="h3" variant="card">{step.title}</Heading>
                    <span className={styles.mobileDisclosureIcon} aria-hidden="true" />
                  </summary>
                  <Text>{step.copy}</Text>
                </details>
              </li>
            ))}
          </ol>
          <div className={styles.processAction}>
            <Button href={homepageEnquiryHrefs.process} data-homepage-event="process_enquiry_click">Start with your project details</Button>
          </div>
        </Container>
      </Section>

      <Section tone="inverse" aria-labelledby="homepage-review-heading">
        <Container width="wide">
          <div className={styles.inverseIntro}>
            <div>
              <Eyebrow>Client perspective</Eyebrow>
              <Heading id="homepage-review-heading">Trusted for the design, build and installation.</Heading>
            </div>
          </div>
          <div className={styles.reviewGrid}>
            {selectedReviews.map((selectedReview) => (
              <figure className={styles.reviewCard} key={selectedReview.author} data-home-review>
                <blockquote>&ldquo;{selectedReview.quote}&rdquo;</blockquote>
                <figcaption>{selectedReview.author} / Google review</figcaption>
              </figure>
            ))}
          </div>
          <div className={styles.reviewSummary}>
            <span>Rated {ratingText} from {review.count} Google reviews</span>
            <a href={GOOGLE_PLACE.reviewsUrl} target="_blank" rel="noopener noreferrer">
              Read all reviews on Google
            </a>
          </div>
          <MobileReviewCarousel
            count={review.count}
            rating={ratingText}
            reviews={selectedReviews}
            reviewsUrl={GOOGLE_PLACE.reviewsUrl}
          />
        </Container>
      </Section>

      <Section tone="neutral" aria-labelledby="project-assurances">
        <Container>
          <div className={styles.sectionIntro}>
            <div>
              <Eyebrow>Project-specific assurances</Eyebrow>
              <Heading id="project-assurances">Clear expectations before site work begins.</Heading>
            </div>
            <Text className={styles.mobileSecondaryCopy}>Before site work begins, Sanctuary records the agreed design, materials, inclusions, exclusions, current programme and applicable warranty information in writing.</Text>
          </div>
          <MobileDisclosure
            summary="What is confirmed before work begins"
            eventName="assurance_expand"
          >
            <SpecificationRows
              rows={[
                { label: 'Written scope', value: 'Design, materials, inclusions and exclusions recorded for approval' },
                { label: 'Current programme', value: 'Confirmed against the completed scope and current schedule' },
                { label: 'Installation', value: 'Carried out by the Sanctuary team to the documented project requirements' },
                { label: 'Warranty information', value: 'Applicable workmanship and selected-product terms supplied in writing' },
                { label: 'Ongoing support', value: 'Care information and a clear contact path provided at handover' },
              ]}
            />
          </MobileDisclosure>
        </Container>
      </Section>

      <Section aria-labelledby="pergola-guide-pathways">
        <Container width="wide">
          <div className={styles.guideGateway}>
            <div>
              <Eyebrow>Planning guides</Eyebrow>
              <Heading id="pergola-guide-pathways">Still working through the options?</Heading>
              <Text>Compare cost, roof approaches and complete outdoor-room planning before making an enquiry.</Text>
            </div>
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
        </Container>
      </Section>

      <Section tone="inverse" aria-labelledby="qualified-enquiry">
        <Container width="wide" className={styles.finalGrid}>
          <div className={styles.finalCopy}>
            <Eyebrow>Start with the site and intended use</Eyebrow>
            <Heading id="qualified-enquiry">Send enough detail for a useful first response.</Heading>
            <Text size="large">
              Sanctuary reviews the initial information, identifies likely options, flags site or scope considerations and recommends a next step. Where the brief is clear, an indicative price range may be possible.
            </Text>
            <div className={styles.sectionActions}>
              <Button href={homepageEnquiryHrefs.final} data-homepage-event="final_enquiry_click">Send your project details</Button>
            </div>
            <nav className={styles.secondaryPathways} aria-label="Alternative enquiry pathways">
              <TextLink href="/commercial-pergolas-auckland#project-details" data-homepage-event="commercial_pathway_click">Discuss a commercial project</TextLink>
              <TextLink href={homepageEnquiryHrefs.professional} data-homepage-event="professional_pathway_click">Send plans or a project brief</TextLink>
              <TextLink href="/contact#contact-form" data-homepage-event="general_contact_click">General contact questions</TextLink>
            </nav>
          </div>
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
        </Container>
      </Section>
    </main>
  );
}
