import type { Metadata } from 'next';
import Image from 'next/image';
import {
  Button,
  Container,
  ConversionSection,
  Eyebrow,
  Figure,
  FullBleedStatement,
  Heading,
  MaterialPalette,
  NumberedPrinciples,
  ProcessSteps,
  ProjectMeta,
  ProjectStory,
  Section,
  SpecificationRows,
  StaggeredGallery,
  TestimonialQuote,
  Text,
  TextLink,
} from '@/components/marketing-foundation';
import { projects, type Project } from '@/data/projects';
import { GOOGLE_PLACE, featuredReviews } from '@/data/reviews';
import { getGoogleRating } from '@/lib/googleReviews';
import {
  designPrinciples,
  featuredProjectSlugs,
  materialItems,
  processSteps,
  proofPoints,
  roofForms,
} from './content';
import styles from './home-v2.module.css';

export const metadata: Metadata = {
  title: { absolute: 'Homepage V2 Comparison | Sanctuary Pergolas' },
  description: 'An unlisted architectural editorial homepage comparison for Sanctuary Pergolas.',
  alternates: { canonical: '/' },
  robots: { index: false, follow: false },
};

function findProject(slug: string): Project {
  const project = projects.find((candidate) => candidate.slug === slug);
  if (!project) throw new Error(`Missing homepage V2 project: ${slug}`);
  return project;
}

const featuredProjects = featuredProjectSlugs.map(findProject);
const leadProject = featuredProjects[0];
const galleryProjects = featuredProjects.slice(1);
const featuredReview = featuredReviews.find((review) => review.author === 'Stuart Jones') ?? featuredReviews[0];

export default async function HomeV2Page() {
  const review = await getGoogleRating();
  const ratingText = review.rating.toFixed(1);

  return (
    <main className={styles.page} data-homepage-variant="v2">
      <section className={styles.hero} aria-labelledby="home-v2-heading">
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
              <Eyebrow className={styles.heroEyebrow}>Architectural outdoor living</Eyebrow>
              <Heading as="h1" variant="page" className={styles.heroHeading} id="home-v2-heading">
                Architectural pergolas tailored to Kiwi homes.
              </Heading>
              <Text size="large" className={styles.heroText}>
                Bespoke fixed-roof design and permanent construction tailored to the home and site.
              </Text>
              <div className={styles.heroActions} aria-label="Homepage V2 actions">
                <Button href="/contact">Start your project</Button>
                <TextLink href="/projects" className={styles.heroLink}>View projects</TextLink>
              </div>
            </div>
            <ProjectMeta
              className={styles.heroMeta}
              items={[leadProject.location, leadProject.type, leadProject.roof, leadProject.year]}
            />
          </div>
        </Container>
      </section>

      <aside className={styles.proofRail} aria-label="Sanctuary project facts">
        <Container width="wide">
          <div className={styles.proofGrid}>
            <a
              className={styles.proofItem}
              href={GOOGLE_PLACE.reviewsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Rated ${ratingText} out of 5 from ${review.count} Google reviews`}
              data-live-rating
            >
              <span className={styles.proofValue}>{ratingText}</span>
              <span className={styles.proofLabel}>{review.count} Google reviews</span>
            </a>
            {proofPoints.map((item) => (
              <div className={styles.proofItem} key={item.label}>
                <span className={styles.proofValue}>{item.value}</span>
                <span className={styles.proofLabel}>{item.label}</span>
              </div>
            ))}
          </div>
        </Container>
      </aside>

      <Section>
        <Container>
          <div className={styles.introGrid}>
            <div>
              <Eyebrow>The Sanctuary approach</Eyebrow>
              <Heading>Designed as part of the home.</Heading>
            </div>
            <Text size="large">
              Every project begins with the architecture, climate and daily life around it. Roof form, light,
              drainage and finish are resolved together so the result feels permanent, calm and connected.
            </Text>
          </div>
        </Container>
      </Section>

      <Section tone="warm">
        <Container>
          <div className={styles.sectionIntro}>
            <div>
              <Eyebrow>Design principles</Eyebrow>
              <Heading>A clear idea, carried through every detail.</Heading>
            </div>
            <Text>
              The room below leads the design. Structure and roofing follow with the technical decisions already considered.
            </Text>
          </div>
          <NumberedPrinciples items={designPrinciples.map((item) => ({ ...item }))} />
        </Container>
      </Section>

      <Section>
        <Container width="wide">
          <div className={styles.sectionIntro}>
            <div>
              <Eyebrow>Selected project</Eyebrow>
              <Heading>Architecture you can live beneath.</Heading>
            </div>
            <Text>
              Finished Sanctuary projects show how structure, material and use can read as one considered outdoor room.
            </Text>
          </div>
          <ProjectStory
            image={leadProject.heroImage.src}
            alt={leadProject.heroImage.alt}
            title={leadProject.title}
            metadata={[leadProject.location, leadProject.type, leadProject.roof, leadProject.year]}
            copy={leadProject.blurb}
            href={`/projects/${leadProject.slug}`}
          />
        </Container>
      </Section>

      <Section tone="elevated">
        <Container width="wide">
          <div className={styles.galleryHeader}>
            <div>
              <Eyebrow>Selected work</Eyebrow>
              <Heading as="h2" variant="card">More Sanctuary projects</Heading>
            </div>
            <TextLink href="/projects">Browse every project</TextLink>
          </div>
          <StaggeredGallery
            items={galleryProjects.map((project) => ({
              image: project.heroImage.src,
              alt: project.heroImage.alt,
              title: project.title,
              detail: [project.location, project.roof].filter(Boolean).join(' / '),
              href: `/projects/${project.slug}`,
            }))}
          />
        </Container>
      </Section>

      <FullBleedStatement
        image="/images/timber-gable-ceiling.jpg"
        alt="Timber-lined Riverhead gable roof framing blue sky and treetops"
        eyebrow="A more sheltered outdoor room"
        heading="Shelter without losing the view."
        copy="Permanent construction, warm materials and integrated light extend the home outdoors."
        action={{ label: 'See the Riverhead project', href: '/projects/riverhead-gable-pavilion' }}
      />

      <Section>
        <Container width="wide">
          <div className={styles.sectionIntro}>
            <div>
              <Eyebrow>Material palette</Eyebrow>
              <Heading>Chosen in context, not in isolation.</Heading>
            </div>
            <Text>
              Each material is judged against the home, the intended light and the way the space needs to perform.
            </Text>
          </div>
          <MaterialPalette items={materialItems.map((item) => ({ ...item }))} />
        </Container>
      </Section>

      <Section tone="warm">
        <Container width="wide">
          <div className={styles.sectionIntro}>
            <div>
              <Eyebrow>Roof forms</Eyebrow>
              <Heading>Four ways to meet the home.</Heading>
            </div>
            <Text>
              The right form is selected for proportion, span, daylight and connection, not simply for appearance.
            </Text>
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
                  <span className={styles.roofNumber}>{String(index + 1).padStart(2, '0')}</span>
                  <Heading as="h3" variant="card">{roof.title}</Heading>
                  <Text size="small">{roof.copy}</Text>
                  <TextLink href={roof.href}>Explore</TextLink>
                </article>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <Section>
        <Container width="wide">
          <div className={styles.sectionIntro}>
            <div>
              <Eyebrow>Our process</Eyebrow>
              <Heading>From first idea to finished room.</Heading>
            </div>
            <Text>
              Seven clear stages keep the design, price, manufacture and on-site work aligned.
            </Text>
          </div>
          <ProcessSteps items={processSteps.map((item) => ({ ...item }))} />
        </Container>
      </Section>

      <Section tone="inverse" aria-labelledby="home-v2-review-heading">
        <Container>
          <Heading as="h2" id="home-v2-review-heading" className="visually-hidden">Customer reviews</Heading>
          <Eyebrow>Client perspective</Eyebrow>
          <TestimonialQuote quote={featuredReview.quote} author={featuredReview.author} />
          <div className={styles.reviewSummary}>
            <span>Rated {ratingText} from {review.count} Google reviews</span>
            <a href={GOOGLE_PLACE.reviewsUrl} target="_blank" rel="noopener noreferrer">
              Read all reviews on Google
            </a>
          </div>
        </Container>
      </Section>

      <Section tone="neutral">
        <Container>
          <div className={styles.sectionIntro}>
            <div>
              <Eyebrow>Built with confidence</Eyebrow>
              <Heading>Clear expectations, before site work begins.</Heading>
            </div>
            <Text>
              The early design and sign-off process aligns the permanent structure, roofing and integrated features.
            </Text>
          </div>
          <SpecificationRows
            rows={[
              { label: 'Current programme', value: 'Confirmed in the project proposal' },
              { label: 'On-site sequence', value: 'Resolved for the agreed scope and access' },
              { label: 'Roof forms', value: 'Pitched, gable, hip and box perimeter' },
              { label: 'Warranty information', value: 'Written terms supplied for the project and selected products' },
            ]}
          />
        </Container>
      </Section>

      <ConversionSection
        heading="Bring us the site. We will help resolve the possibilities."
        copy="Share a few photos, rough dimensions and how you want the space to work."
      />
    </main>
  );
}
