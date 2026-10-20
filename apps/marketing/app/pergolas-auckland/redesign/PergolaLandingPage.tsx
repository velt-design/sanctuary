import ChannelTrackingRegion from '@/components/journey/ChannelTrackingRegion';
import type { LandingSourcePath } from '@/components/configurator-prototype/draftScope';
import GuidedJourneyContext from '@/components/guided-journey/GuidedJourneyContext';
import ProjectFinderJourneyContext from '@/components/project-finder/ProjectFinderJourneyContext';
import { resolveGuidedJourneyContext, type GuidedJourneySearchParams } from '@/lib/guidedJourneyContext';
import { resolveProjectFinderJourneyContext } from '@/lib/projectFinderContinuation';
import Image from 'next/image';
import Link from 'next/link';
import ArrowUpRight from '@/components/marketing-foundation/ArrowUpRight';
import foundation from '@/components/marketing-foundation/foundation.module.css';
import AcrylicPergolaEnquiryForm from '../../acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm';
import ComparisonLink from '../ComparisonLink';
import { faqItems, generalRoofPreference, investmentDrivers, residentialProcessSteps } from '../content';
import DesignWorkspace from './DesignWorkspace';
import '../../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import styles from './redesign.module.css';

export default function PergolaLandingPage({ sourcePath, comparison = false, searchParams = {} }: { sourcePath: LandingSourcePath; comparison?: boolean; searchParams?: GuidedJourneySearchParams }) {
  const guidedContext = resolveGuidedJourneyContext('residential-cover', searchParams);
  const projectFinderContext = guidedContext ? null : resolveProjectFinderJourneyContext('cover', searchParams);
  return <ChannelTrackingRegion><main className={`${foundation.marketingPage} ${styles.page}`} data-marketing-foundation-page data-pergola-redesign data-seo-landing="pergolas-auckland">
    {comparison && <ComparisonLink redesign />}
    <section className={styles.hero} aria-labelledby="redesign-title">
      <Image className={styles.heroImage} src="/images/project-riverhead-gable-01.jpg" alt="A Sanctuary gable pavilion with timber lining beside a pool in Riverhead, Auckland" fill priority sizes="100vw" />
      <div className={styles.heroShade} />
      <div className={styles.heroTop}><span>Pergolas Auckland</span><span>Designed. Built. Lived in.</span></div>
      <div className={styles.heroContent}><h1 id="redesign-title">Room to live.<br />Outside.</h1><div className={styles.heroBottom}><div><p>A pergola that belongs with your home.<br />A place to make more of every day.</p><div className={styles.heroActions}><a className={styles.lightButton} href="#explore-options">Explore your pergola <ArrowUpRight /></a><a className={styles.heroTextLink} href="#project-details" data-channel-action="quote">Talk about your project <ArrowUpRight /></a></div></div><Link className={styles.heroCaption} href="/projects/riverhead-gable-pavilion"><span>Built by Sanctuary</span>Riverhead, Auckland <ArrowUpRight /></Link></div></div>
    </section>
    <div className={styles.introduction}><p>Made for the house.<br />And the people in it.</p><div>Breakfast in the fresh air. Long lunches with friends. A sheltered place to unwind. Designed around the way you live.</div><a href="#explore-options" aria-label="Explore your pergola below">↓</a></div>
    <GuidedJourneyContext context={guidedContext} />
    <ProjectFinderJourneyContext context={projectFinderContext} />
    <DesignWorkspace sourcePath={sourcePath} />
    <section className={styles.materialStory} aria-labelledby="material-title">
      <div className={styles.materialImage}><Image src="/images/project-riverhead-gable-03.webp" alt="Timber sarking and integrated lighting beneath the Riverhead pavilion roof" fill sizes="(max-width: 820px) 100vw, 58vw" /></div>
      <div className={styles.materialCopy}><p className={styles.eyebrow}>02 / The feeling is in the detail</p><h2 id="material-title">Look up.<br />Feel at home.</h2><p>Daylight through acrylic. The warmth of a timber-lined ceiling. A roofline that makes sense alongside your house.</p><p>Choose the light and shelter you want, then explore blinds, screens and lighting as your idea takes shape.</p><a className={styles.textLink} href="#explore-options">Explore roof options <ArrowUpRight /></a><div className={styles.materialCaption}>Riverhead Gable Pavilion<br /><span>Timber sarking, downlights and LED lighting.<br />A completed custom project, not a standard package.</span></div></div>
    </section>
    <section className={styles.projectStory} id="project-evidence" aria-labelledby="project-title">
      <div className={styles.projectIntro}><p className={styles.eyebrow}>03 / At home in Auckland</p><h2 id="project-title">Different homes.<br />Considered answers.</h2><p>A built pergola is more than a roof shape. Its proportions, connection and details have to work with the home.</p></div>
      <Link className={styles.projectImage} href="/projects/st-heliers-townhouse"><Image src="/images/project-st-heliers-01.jpg" alt="White open-gable pergola with opal acrylic at a St Heliers townhouse at dusk" width={1500} height={1028} sizes="(max-width: 820px) 100vw, 70vw" /><span className={styles.projectLink}>View the project <ArrowUpRight /></span></Link>
      <div className={styles.projectDescription}><h3>St Heliers Townhouse</h3><p>An open gable with opal acrylic and a custom street-facing frame. A light-filled cover that follows the house.</p><span>6.0 × 3.0 m<br />St Heliers, Auckland</span></div>
      <Link className={styles.textLink} href="/projects">Explore more built projects <ArrowUpRight /></Link>
    </section>
    <section className={styles.scope} id="what-is-included" aria-labelledby="scope-title"><div className={styles.scopeIntro}><p className={styles.eyebrow}>The estimate, explained</p><h2 id="scope-title">Know what<br />you’re looking at.</h2><p>Your estimate reflects the options you select. Your final proposal confirms measurements, site requirements and complete scope.</p><Link className={styles.textLink} href="/pergola-cost-auckland">What shapes the cost <ArrowUpRight /></Link></div><div className={styles.scopeItems}>{investmentDrivers.map((item, index) => <div key={item.title}><span>0{index + 1}</span><div><h3>{item.title}</h3><p>{item.text}</p></div></div>)}</div></section>
    <section className={styles.process} aria-labelledby="process-title"><header><p className={styles.eyebrow}>04 / The next steps</p><h2 id="process-title">From first idea to agreed scope.</h2><p>We work through the details with you before you commit.</p></header><ol>{residentialProcessSteps.map((step, index) => <li key={step.title}><span>0{index + 1}</span><h3>{step.title}</h3><p>{step.copy}</p></li>)}</ol></section>
    <section className={styles.enquiry} id="project-details" aria-label="Auckland pergola project enquiry form"><AcrylicPergolaEnquiryForm
      initialEnquiryType="residential"
      sourceContext={{ ...(guidedContext?.enquiryContext ?? projectFinderContext?.enquiryContext ?? { enquiryType: 'residential', sourceComponent: 'embedded_form' }), sourcePath }}
      eyebrow="Your project"
      heading="What do you have in mind?"
      intro="Tell us where you’re building and what you’d like the pergola to do. Rough dimensions are helpful, but optional."
      directContact={{ intro: 'Prefer to talk?', phoneLabel: '022 854 5633', phoneHref: 'tel:+64228545633', emailLabel: 'info@sanctuarypergolas.co.nz', emailHref: 'mailto:info@sanctuarypergolas.co.nz' }}
      submitLabel="Send enquiry" messageLabel="Your project" messagePlaceholder="An outdoor dining space, a sheltered poolside spot, a little more room for family…"
      briefFields={[{ name: 'siteAddress', label: 'Project address', type: 'text', placeholder: 'Street address, if you are ready to share it', wide: true }]}
      roofPreference={generalRoofPreference}
    /></section>
    <section className={styles.faq} aria-labelledby="faq-title"><div><p className={styles.eyebrow}>A few useful answers</p><h2 id="faq-title">Before you begin.</h2><Link className={styles.textLink} href="/custom-pergolas-auckland">Have something more complex in mind? <ArrowUpRight /></Link></div><div>{faqItems.map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><div>{item.answer.map(answer => <p key={answer}>{answer}</p>)}</div></details>)}</div></section>
  </main></ChannelTrackingRegion>;
}
