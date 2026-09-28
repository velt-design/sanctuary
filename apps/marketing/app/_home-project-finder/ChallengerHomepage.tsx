import Image from 'next/image';
import Link from 'next/link';
import { Button, Container, MarketingPage } from '../../components/marketing-foundation/Primitives';
import ArrowUpRight from '../../components/marketing-foundation/ArrowUpRight';
import { projects } from '../../data/projects';
import { GOOGLE_PLACE } from '../../data/reviews';
import { buildEnquiryHref } from '../../lib/enquiryContext';
import { getGoogleRating } from '../../lib/googleReviews';
import { PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE } from '../../lib/projectFinderContract';
import { resolveProjectFinderHomeEnquiryContextFromReader } from '../../lib/projectFinderContinuation';
import ProjectFinder from './ProjectFinder';
import ProjectFinderNoScriptFallback from './ProjectFinderNoScriptFallback';
import ProjectFinderTracker from './ProjectFinderTracker';
import { buildProjectFinderHomepageMedia } from './projectFinderMedia';
import { buildProjectFinderHref, type ProjectFinderState } from './projectFinderModel';
import styles from './challengerHomepage.module.css';
import ChallengerEnquiryLink from './ChallengerEnquiryLink';

export default async function ChallengerHomepage({ initialState }: { initialState: ProjectFinderState }) {
  const media = buildProjectFinderHomepageMedia(projects);
  const project = projects.find(item => item.slug === 'warkworth-outdoor-room')!;
  const detail = project.gallery[2];
  const review = await getGoogleRating();
  const restoredContext = resolveProjectFinderHomeEnquiryContextFromReader(
    new URLSearchParams(buildProjectFinderHref(initialState).split('?')[1]),
  );
  const enquiryHref = buildEnquiryHref({ enquiryType: 'residential', sourcePath: '/', sourceExperience: PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE, ...restoredContext, sourceComponent: 'hero' });
  const defaultEnquiryHref = buildEnquiryHref({ enquiryType: 'residential', sourcePath: '/', sourceExperience: PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE, sourceComponent: 'hero' });
  return <MarketingPage className={styles.page} data-homepage-preview="architecture-first-b">
    <ProjectFinderTracker />
    <section className={styles.hero} aria-labelledby="challenger-heading">
      <Container width="wide" className={styles.heroOpening}>
        <div><p className={styles.kicker}>Fixed-roof pergolas · Auckland</p><h1 id="challenger-heading">Make room<br />for outside.</h1></div>
        <div className={styles.heroActions}><p>Designed for your home.<br />Built by Sanctuary.</p><Button href="#project-finder">Find your pergola <ArrowUpRight /></Button><ChallengerEnquiryLink initialHref={enquiryHref} defaultHref={defaultEnquiryHref} /></div>
      </Container>
      <div className={styles.heroImage}>
        <Image src={media.hero.src} alt={media.hero.alt} fill sizes="100vw" preload style={{ objectPosition: media.hero.objectPosition }} />
        <Link href={`/projects/${project.slug}`} className={styles.projectCaption}><span>Warkworth outdoor room<span>Completed Sanctuary project</span></span><ArrowUpRight /></Link>
      </div>
    </section>
    <ProjectFinder initialState={initialState} media={media} presentation="challenger" defaultContent={<>
    <section className={styles.builtWork} aria-labelledby="built-work-heading">
      <Container width="wide">
        <div className={styles.builtComposition}>
          <div className={styles.builtWhole}><Image src={project.heroImage.src} alt={project.heroImage.alt} fill sizes="(max-width:760px) 90vw, 58vw" style={{ objectPosition: project.heroImage.objectPosition }} /></div>
          <div className={styles.builtDetail}><Image src={detail.src} alt={detail.alt} fill sizes="(max-width:760px) 48vw, 28vw" style={{ objectPosition: detail.objectPosition }} /></div>
          <div className={styles.builtCopy}><p className={styles.kicker}>Warkworth, Auckland</p><h2 id="built-work-heading">The whole space.<br />Every detail.</h2><p>A freestanding gable. Cedar lining.<br />Clear acrylic bringing daylight through.</p><Link href={`/projects/${project.slug}`}>Explore this project <ArrowUpRight /></Link></div>
        </div>
        <Link className={styles.allProjects} href="/projects">More spaces we’ve built <ArrowUpRight /></Link>
      </Container>
    </section>
    <section className={styles.close} aria-labelledby="challenger-close-heading">
      <Container width="wide" className={styles.closeLayout}>
        <div><p className={styles.kicker}>Design → Build → Install</p><h2 id="challenger-close-heading">Your space.<br />Let’s start there.</h2><Button href={defaultEnquiryHref}>Discuss your project <ArrowUpRight /></Button></div>
        <div className={styles.closeProof}><p>One team, from design to installation.</p><a href={GOOGLE_PLACE.reviewsUrl}><strong>{review.rating.toFixed(1)}<span>/ 5</span></strong><span>{review.count} Google reviews <ArrowUpRight /></span></a><Link href="/pergolas-auckland">Our design &amp; build service <ArrowUpRight /></Link></div>
      </Container>
    </section>
    </>} />
    <ProjectFinderNoScriptFallback enquiryHref={enquiryHref} />
  </MarketingPage>;
}
