import Image from 'next/image';
import Link from 'next/link';
import ArrowUpRight from '@/components/marketing-foundation/ArrowUpRight';
import { projects } from '@/data/projects';
import { costFaqItems } from './content';
import styles from './cost.module.css';

const examples = [
  { slug: 'st-heliers-townhouse', label: 'A considered cover', detail: 'Opal acrylic, an open gable and a custom street-facing frame. Even a focused pergola brief needs its connection and details resolved.' },
  { slug: 'warkworth-outdoor-room', label: 'A complete outdoor room', detail: 'Mixed roofing, cedar lining, a new deck, fireplace and lighting. A wider brief needs a budget for the connected work, as well as the pergola.' },
] as const;

const costDrivers = [
  ['Size and structure', 'Footprint, height, spans and supports shape the structure and its foundations.'],
  ['Roof and connection', 'Roofing, lining, house junctions, flashing and drainage make up more than the visible roof.'],
  ['Site and access', 'Existing conditions, elevated work, access and any engineering or consent requirements need a site review.'],
  ['Finishing the space', 'Blinds, lighting and other options, plus separately agreed decking or electrical work, complete the scope.'],
] as const;

export default function CostGuide() {
  return <>
    <section className={styles.projects} id="cost-projects" aria-labelledby="cost-projects-title">
      <header className={styles.sectionHeading}><div><p className={styles.eyebrow}>The scope behind the number</p><h2 id="cost-projects-title">A cover. Or a whole<br />new way to live.</h2></div><p>Decide what the complete space needs to include. These built projects illustrate different scopes, not prices or standard packages.</p></header>
      <div className={styles.projectGrid}>{examples.map((example, index) => {
        const project = projects.find(item => item.slug === example.slug)!;
        return <article className={styles.project} key={example.slug}>
          <Link className={styles.projectPhoto} href={`/projects/${example.slug}`}><Image src={project.heroImage.src} alt={project.heroImage.alt} width={1500} height={1125} sizes="(max-width: 760px) 100vw, 50vw" style={{ objectPosition: project.heroImage.objectPosition }} /><span>View the project <ArrowUpRight /></span></Link>
          <div className={styles.projectCopy}><span className={styles.projectNumber}>0{index + 1}</span><div><p className={styles.projectPlace}>{project.title}</p><h3>{example.label}</h3><p>{example.detail}</p></div></div>
        </article>;
      })}</div>
    </section>
    <section className={styles.scope} id="what-is-included" aria-labelledby="cost-drivers-title">
      <div className={styles.scopeIntro}><p className={styles.eyebrow}>Read the estimate with confidence</p><h2 id="cost-drivers-title">Know what<br />you’re allowing for.</h2><p>The estimate is a starting point for your selected design. Your final proposal sets out the measured design, installation scope, allowances and exclusions.</p><a className={styles.textLink} href="#explore-options">Return to your estimate <ArrowUpRight /></a></div>
      <div className={styles.scopeBody}><div className={styles.included}><span>Included in the estimate</span><p>Selected structure + roof<br />Priced designer options<br />Standard installation allowances<br />GST</p></div><div id="cost-drivers" className={styles.driverList}>{costDrivers.map(([title, text], index) => <div key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}</div></div>
    </section>
    <section className={styles.quote} id="quote-comparison" aria-labelledby="quote-title"><div><p className={styles.eyebrow}>When you’re comparing quotes</p><h2 id="quote-title">Compare the whole job.</h2></div><ol><li><span>01</span><div><h3>The same design</h3><p>Match the footprint, roof, finish and extras.</p></div></li><li><span>02</span><div><h3>The same scope</h3><p>Check installation, GST, site work and connected trades.</p></div></li><li><span>03</span><div><h3>The same certainty</h3><p>Ask what is fixed, allowed for or still to be confirmed.</p></div></li></ol></section>
    <section className={styles.process} id="cost-process" aria-labelledby="process-title"><p className={styles.eyebrow}>From estimate to proposal</p><h2 id="process-title">Rough idea.<br />Clear next step.</h2><div><p>Send your selected design, or a few photos and a rough brief. We’ll review what you have in mind, confirm the site details and prepare a proposal around the agreed work.</p><p>A site measure and evaluation is free in Auckland. Staff usually respond within the working day.</p><a className={styles.textLink} href="#project-details">Talk about your project <ArrowUpRight /></a></div></section>
    <section className={styles.faq} id="pergola-cost-faq" aria-labelledby="faq-title"><div><p className={styles.eyebrow}>Before you begin</p><h2 id="faq-title">Cost questions,<br />answered.</h2><nav className={styles.related} aria-label="Related planning decisions"><Link href="/pergolas-auckland">Planning a pergola in Auckland <ArrowUpRight /></Link><Link href="/acrylic-roof-pergolas-auckland">Choosing an acrylic roof <ArrowUpRight /></Link><Link href="/custom-pergolas-auckland">Something more bespoke <ArrowUpRight /></Link><Link href="/pergola-guides">All pergola guides <ArrowUpRight /></Link></nav></div><div className="acrylic-faq-list">{costFaqItems.map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><div>{item.answer.map(answer => <p key={answer}>{answer}</p>)}</div></details>)}</div></section>
  </>;
}
