import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import FunnelJourney from '@/components/google-funnel/FunnelJourney';
import FunnelReview from '@/components/google-funnel/FunnelReview';
import funnelStyles from '@/components/google-funnel/funnel.module.css';
import ArrowUpRight from '@/components/marketing-foundation/ArrowUpRight';
import foundation from '@/components/marketing-foundation/foundation.module.css';
import { residentialProcessSteps } from '../pergolas-auckland/content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import styles from './outdoor-living.module.css';

export const metadata: Metadata = {
  title: 'Make room for life outside | Auckland pergolas',
  description: 'A pergola designed around your Auckland home. Explore completed Sanctuary projects and tell us about your outdoor space.',
  alternates: { canonical: '/auckland-outdoor-living' },
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Make room for life outside',
    description: 'Pergolas designed around Auckland homes. Built by Sanctuary.',
    url: '/auckland-outdoor-living',
    images: [{ url: '/images/project-riverhead-gable-01.jpg', width: 2048, height: 1534, alt: 'The completed Sanctuary pavilion in Riverhead, Auckland' }],
  },
};

export default function AucklandOutdoorLivingPage() {
  return (
    <main className={`${foundation.marketingPage} ${styles.page} ${funnelStyles.page}`} data-marketing-foundation-page data-facebook-landing>
      <section className={styles.hero} aria-labelledby="outdoor-living-title">
        <Image className={styles.heroImage} src="/images/project-riverhead-gable-01.jpg" alt="A timber-lined Sanctuary gable pavilion framing the garden beside a pool in Riverhead, Auckland" fill priority sizes="(max-width: 760px) 1100px, 100vw" />
        <div className={styles.heroShade} />
        <div className={funnelStyles.brand}><span>sanctuary<small>PERGOLAS</small></span><p>Outdoor living · Auckland</p></div>
        <div className={styles.heroContent}>
          <h1 id="outdoor-living-title">Make room<br />for life outside.</h1>
          <p className={funnelStyles.heroService}>Custom pergolas and covered outdoor spaces, designed and installed in Auckland.</p>
          <div className={styles.heroBottom}>
            <div><p>A place for slow mornings. Long lunches.<br />And a little more everyday living.</p><div className={styles.heroActions}><a className={styles.primaryAction} href="#your-design">Design your pergola <ArrowUpRight /></a><a className={styles.lightLink} href="#project-details">Tell us about your space <ArrowUpRight /></a></div></div>
            <Link className={styles.projectCaption} href="/projects/riverhead-gable-pavilion"><span>Built by Sanctuary</span>Riverhead, Auckland <ArrowUpRight /></Link>
          </div>
        </div>
      </section>

      <div className={styles.proofLine}><p>Designed around your home.</p><p>Auckland based.</p><p>10-year workmanship warranty.</p></div>

      <FunnelReview />
      <FunnelJourney path="/auckland-outdoor-living" afterEnquiry={<section className={styles.questions} aria-labelledby="questions-title"><h2 id="questions-title">A few useful answers.</h2><div>
        <details><summary>Do I need a design or measurements first?<span aria-hidden="true">+</span></summary><p>No. Start with your suburb and what you would like the space to do. Photos and rough dimensions are helpful if you have them.</p></details>
        <details><summary>What will my pergola cost?<span aria-hidden="true">+</span></summary><p>Size, roof materials, selected options and site requirements shape the price. Your final proposal confirms measurements, installation scope and any engineering or consent requirements.</p><Link href="/pergola-cost-auckland">See what shapes the cost <ArrowUpRight /></Link></details>
        <details><summary>Can it attach to my house?<span aria-hidden="true">+</span></summary><p>Often, but support, cladding, flashing and drainage need review. We assess the connection against your home and site.</p></details>
        <details><summary>Can I include blinds, screens or lighting?<span aria-hidden="true">+</span></summary><p>Yes, where they suit the structure and selected products. These are optional and are confirmed in your proposal.</p></details>
      </div></section>}>

      <section className={styles.introduction} aria-labelledby="your-home-title">
        <p className={styles.eyebrow}>Your home, with room to breathe</p>
        <h2 id="your-home-title">Not just a roof.<br />Your favourite place.</h2>
        <div><p>From a light-filled deck to a timber-lined outdoor lounge, the right pergola starts with your house and how you want to live.</p><p>We work through the roofline, materials and details with you, so the finished space feels like it belongs.</p><a className={styles.textLink} href="#built-in-auckland">See two different approaches <span aria-hidden="true">↓</span></a></div>
      </section>


      <section className={styles.projects} id="built-in-auckland" aria-labelledby="built-title">
        <div className={styles.projectHeading}><p className={styles.eyebrow}>Real homes. Completed projects.</p><h2 id="built-title">At home in Auckland.</h2></div>
        <div className={styles.daylightStory}>
          <Link className={styles.daylightImage} href="/projects/st-heliers-townhouse"><Image src="/images/project-st-heliers-01.jpg" alt="The opal acrylic gable pergola following the roofline of a St Heliers townhouse at dusk" width={1500} height={1028} sizes="(max-width: 760px) 100vw, 67vw" /><span className={styles.imageLink}>Explore this project <ArrowUpRight /></span></Link>
          <div className={styles.projectCopy}><p className={styles.eyebrow}>01 / Daylight and connection</p><h3>A natural extension.</h3><p>An open gable, opal acrylic and a custom street-facing frame follow the roofline of this St Heliers home.</p><span className={styles.projectFacts}>St Heliers, Auckland<br />6.0 × 3.0 m / Opal acrylic</span></div>
        </div>
        <div className={styles.timberStory}>
          <div className={styles.projectCopy}><p className={styles.eyebrow}>02 / The warmth of timber</p><h3>A room under<br />the roof.</h3><p>Timber sarking and integrated lighting give this poolside pavilion its character. A different answer for a different way of living.</p><span className={styles.projectFacts}>Riverhead, Auckland<br />Insulated roof / Timber lining</span></div>
          <Link className={styles.timberImage} href="/projects/riverhead-gable-pavilion"><Image src="/images/project-riverhead-gable-03.webp" alt="Timber sarking, downlights and LED lighting beneath the completed Riverhead pavilion roof" width={2400} height={1792} sizes="(max-width: 760px) 100vw, 55vw" /><span className={styles.imageLink}>See the details <ArrowUpRight /></span></Link>
        </div>
        <p className={styles.scopeNote}>These are completed custom projects. Your proposal confirms your design, materials and inclusions. Furniture, planting and landscaping are not included.</p>
      </section>


      <section className={styles.process} aria-labelledby="process-title"><header><p className={styles.eyebrow}>A considered start</p><h2 id="process-title">From your first idea<br />to an agreed plan.</h2></header><ol>{residentialProcessSteps.map((step, index) => <li key={step.title}><span>0{index + 1}</span><h3>{step.title}</h3><p>{step.copy}</p></li>)}</ol></section>




      </FunnelJourney>
    </main>
  );
}
