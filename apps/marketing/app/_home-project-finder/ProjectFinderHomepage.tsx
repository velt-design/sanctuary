import Image from 'next/image';
import Link from 'next/link';
import JsonLd from '../../components/JsonLd';
import {
  Container,
  MarketingPage,
} from '../../components/marketing-foundation/Primitives';
import { GOOGLE_PLACE } from '../../data/reviews';
import { projects } from '../../data/projects';
import { buildEnquiryHref } from '../../lib/enquiryContext';
import { getGoogleRating } from '../../lib/googleReviews';
import { absoluteUrl } from '../../lib/seo';
import {
  PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
  PROJECT_FINDER_HOME_PATH,
  PROJECT_FINDER_HOME_VARIANT,
} from '../../lib/projectFinderContract';
import ProjectFinder from './ProjectFinder';
import ProjectFinderNoScriptFallback from './ProjectFinderNoScriptFallback';
import ProjectFinderTracker from './ProjectFinderTracker';
import { buildProjectFinderHomepageMedia } from './projectFinderMedia';
import type { ProjectFinderState } from './projectFinderModel';
import styles from './projectFinderHomepage.module.css';
import {
  projectFinderHomepageDescription,
  projectFinderHomepageTitle,
} from './routeContract';

type ProjectFinderHomepageProps = {
  initialState: ProjectFinderState;
};

export default async function ProjectFinderHomepage({
  initialState,
}: ProjectFinderHomepageProps) {
  const [review] = await Promise.all([getGoogleRating()]);
  const media = buildProjectFinderHomepageMedia(projects);
  const heroEnquiryHref = buildEnquiryHref({
    enquiryType: 'residential',
    sourcePath: PROJECT_FINDER_HOME_PATH,
    sourceComponent: 'hero',
    sourceExperience: PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
  });

  return (
    <MarketingPage
      className={styles.page}
      data-homepage-variant={PROJECT_FINDER_HOME_VARIANT}
      data-project-finder-home-variant={PROJECT_FINDER_HOME_VARIANT}
    >
      <ProjectFinderTracker />
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Sanctuary Pergolas',
            url: absoluteUrl(PROJECT_FINDER_HOME_PATH),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: projectFinderHomepageTitle,
            url: absoluteUrl(PROJECT_FINDER_HOME_PATH),
            description: projectFinderHomepageDescription,
            isPartOf: {
              '@type': 'WebSite',
              name: 'Sanctuary Pergolas',
              url: absoluteUrl(PROJECT_FINDER_HOME_PATH),
            },
          },
        ]}
      />
      <section
        className={styles.hero}
        aria-labelledby="project-finder-home-heading"
        data-homepage-hero
      >
        <Image
          alt={media.hero.alt}
          className={styles.heroImage}
          fill
          fetchPriority="high"
          priority
          sizes="100vw"
          src={media.hero.src}
          style={{ objectPosition: media.hero.objectPosition }}
        />
        <div className={styles.heroShade} aria-hidden="true" />
        <Container className={styles.heroContent} width="wide">
          <div className={styles.heroCopy}>
            <p className={styles.heroEyebrow}>
              Fixed-roof pergola design and build in Auckland
            </p>
            <h1 id="project-finder-home-heading">
              Outdoor spaces designed around the way you live.
            </h1>
            <p className={styles.heroSupport}>
              Custom pergolas and outdoor rooms, designed around the house, the
              site and how the space will be used.
            </p>
            <div className={styles.heroActions}>
              <a
                className={styles.heroPrimaryAction}
                data-project-finder-event="project_finder_start_click"
                data-source-component="hero"
                data-step-number="1"
                href="#project-finder"
              >
                Find your project direction
              </a>
              <Link
                className={styles.heroSecondaryAction}
                data-project-finder-event="project_finder_direct_enquiry_click"
                data-source-component="hero"
                href={heroEnquiryHref}
              >
                Start your project
              </Link>
            </div>
          </div>
          <p className={styles.heroProjectMeta}>
            <span>Completed project</span>
            <Link href={`/projects/${media.hero.projectSlug}`}>
              {media.hero.projectTitle}, {media.hero.location}
            </Link>
          </p>
        </Container>
      </section>

      <aside className={styles.proofRail} aria-label="Why Sanctuary">
        <Container className={styles.proofItems} width="wide">
          <a className={styles.proofItem} href={GOOGLE_PLACE.reviewsUrl}>
            <strong>{review.rating.toFixed(1)}</strong>
            <span>{review.count} Google reviews</span>
          </a>
          <p className={styles.proofItem}>
            <strong>Design and build</strong>
            <span>One accountable team through installation</span>
          </p>
          <p className={styles.proofItem}>
            <strong>Built project evidence</strong>
            <span>Residential and selected commercial work</span>
          </p>
        </Container>
      </aside>

      <ProjectFinder initialState={initialState} media={media} />
      <ProjectFinderNoScriptFallback enquiryHref={heroEnquiryHref} />
    </MarketingPage>
  );
}
