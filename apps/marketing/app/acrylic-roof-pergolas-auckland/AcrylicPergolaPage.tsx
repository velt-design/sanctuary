import type { LandingCopies } from '@/lib/landingExperiment';
import { LandingExperiment, LandingCopy, OriginalLandingCopy, LandingHeroOrder } from '@/components/landing-experiment/LandingExperiment';
import ChannelTrackingRegion from '@/components/journey/ChannelTrackingRegion';
import Image from 'next/image';
import Link from 'next/link';
import FunnelJourney from '@/components/google-funnel/FunnelJourney';
import FunnelReview from '@/components/google-funnel/FunnelReview';
import funnelStyles from '@/components/google-funnel/funnel.module.css';
import JsonLd from '@/components/JsonLd';
import ArrowUpRight from '@/components/marketing-foundation/ArrowUpRight';
import { absoluteUrl } from '@/lib/seo';
import AcrylicTintComparison from './AcrylicTintComparison';
import { comfortFactors, faqItems, weatherDetails } from './content';
import './acrylic-roof-pergolas-auckland.css';
import styles from './acrylic-editorial.module.css';

const heroImage = '/images/project-dairy-flat-03.jpg';

export default function AcrylicPergolaPage({ path = '/acrylic-roof-pergolas-auckland', control }: { control?: LandingCopies; path?: '/acrylic-roof-pergolas-auckland' | '/ads/facebook/acrylic-pergolas' }) {
  const seo = path === '/acrylic-roof-pergolas-auckland';
  return (
    <ChannelTrackingRegion><LandingExperiment path={path} control={control}><main className={`acrylic-landing ${styles.page} ${funnelStyles.page}`} data-marketing-foundation-page data-seo-landing={seo ? "acrylic-roof-pergolas-auckland" : undefined} data-facebook-landing={!seo || undefined} data-acrylic-editorial>
      {seo && <JsonLd data={[
        { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Acrylic Roof Pergolas Auckland', url: absoluteUrl(path), description: 'Compare clear, grey and opal acrylic roofing, see completed Auckland pergolas and send Sanctuary your project brief.', primaryImageOfPage: absoluteUrl(heroImage) },
        { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: 'Acrylic Roof Pergolas Auckland', item: absoluteUrl(path) },
        ] },
      ]} />}

      <section className={styles.hero} aria-labelledby="acrylic-hero-title">
        <Image className={styles.heroImage} src={heroImage} alt="Looking through the acrylic gable roof of a Sanctuary pergola towards the garden at Dairy Flat, Auckland" fill priority sizes="100vw" />
        <div className={styles.heroShade} />
        {!seo && <div className={funnelStyles.brand}><span>sanctuary<small>PERGOLAS</small></span><p>Acrylic pergolas · Auckland</p></div>}
        <div className={styles.heroContent}>
          <h1 id="acrylic-hero-title">Keep the light.<br />Make room outside.</h1>
          <p className={funnelStyles.heroService}>Custom acrylic pergolas, designed and installed in Auckland.</p>
          <div className={styles.heroBottom}>
            <LandingHeroOrder className={styles.heroActionOrder}><p><LandingCopy slot="support"><OriginalLandingCopy path="/acrylic-roof-pergolas-auckland" slot="support"/></LandingCopy></p><div className={styles.heroActions}><a className={styles.primaryAction} href="#your-design"><LandingCopy slot="design"><OriginalLandingCopy path="/acrylic-roof-pergolas-auckland" slot="design"/></LandingCopy> <ArrowUpRight /></a><a className={styles.lightLink} href="#project-details" data-channel-action="quote"><LandingCopy slot="help"><OriginalLandingCopy path="/acrylic-roof-pergolas-auckland" slot="help"/></LandingCopy> <ArrowUpRight /></a><a className={styles.lightLink} href="#acrylic-options">Explore acrylic tints <span aria-hidden="true">↓</span></a></div></LandingHeroOrder>
            <Link className={styles.projectCaption} href="/projects/dairy-flat-estate"><span>Built by Sanctuary</span>Dairy Flat, Auckland <ArrowUpRight /></Link>
          </div>
        </div>
      </section>

      <div className={styles.proofLine}><p>Designed around your home.</p><p>Auckland based.</p><p>10-year workmanship warranty.</p></div>

      <FunnelReview acrylic />
      <FunnelJourney path={path} showPrivacyFooter={!seo} afterEnquiry={<section className={styles.questions} aria-labelledby="acrylic-faq"><div><p className={styles.eyebrow}>The details, when you need them</p><h2 id="acrylic-faq">Acrylic pergola<br />questions.</h2></div><div className={styles.faqList}>
        {faqItems.map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><div>{item.answer.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div></details>)}
        <details><summary>What affects shade and comfort?<span aria-hidden="true">+</span></summary><div><p>The roof product is one part of the picture. We consider:</p><ul>{comfortFactors.map(factor => <li key={factor}>{factor}</li>)}</ul></div></details>
        <details><summary>How are the roof and house connection planned?<span aria-hidden="true">+</span></summary><div>{weatherDetails.map(detail => <div key={detail.title}><h3>{detail.title}</h3><p>{detail.text}</p></div>)}</div></details>
        <details><summary>What should my proposal confirm?<span aria-hidden="true">+</span></summary><div><p>Your proposal identifies the exact fixed-roof assembly, including the product, thickness, tint and current limitations.</p><p>It also confirms the frame, fall, joints, flashings, gutters and outlets, with current care and warranty information for the selected products. Consent depends on the final design and property. We’ll identify the checks needed for your project.</p><nav className={styles.guideLinks} aria-label="Related roof and cost guides"><Link href="/acrylic-pergolas-vs-louvre-roofs">Compare fixed roofs with a louvre proposal <ArrowUpRight /></Link><Link href="/pergola-cost-auckland">Review scope and quote comparison <ArrowUpRight /></Link></nav></div></details>
        <details><summary>Can I see a built dark-tint example?<span aria-hidden="true">+</span></summary><div><Link className={styles.cafeExample} href="/projects/atelier-shu-cafe" data-acrylic-project><Image src="/images/project-atelier-shu-05.jpg" alt="Dark-tint acrylic roofing and exposed gable framing above Atelier Shu Cafe seating" width={1600} height={1200} sizes="(max-width: 760px) 90vw, 50vw" /><span>Atelier Shu Cafe <ArrowUpRight /></span></Link><p>A dark-tint acrylic gable canopy aligned with the cafe frontage. This is a commercial example; the right tint for your home depends on your site.</p></div></details>
      </div></section>}>

      <section className={styles.introduction} aria-labelledby="daylight-title"><p className={styles.eyebrow}>A little closer to outside</p><h2 id="daylight-title">Shelter overhead.<br />Daylight in the picture.</h2><div><p>Breakfast on the deck. Friends around the table. A place to stay a little longer.</p><p>Keep daylight coming through the roof while creating a covered place to eat, gather and unwind. Our acrylic roofing blocks 99% of UV light. Choose a clear view of the sky, a grey tint or the soft, diffused light of opal.</p><p>Roof proportions, frame and post positions are designed around the house. We resolve the connection, flashings and drainage together, then confirm the materials and installation in your proposal.</p></div></section>


      <section className={styles.projectStory} aria-labelledby="completed-projects">
        <div className={styles.storyHeader}><p className={styles.eyebrow}>01 / A roof that belongs</p><h2 id="completed-projects">Light, from the inside out.</h2></div>
        <Link className={styles.projectImage} href="/projects/st-heliers-townhouse" data-acrylic-project><Image src="/images/project-st-heliers-01.jpg" alt="An opal acrylic gable roof following the roofline of a St Heliers townhouse at dusk" width={1500} height={1028} sizes="(max-width: 760px) 100vw, 80vw" /><span>Explore the project <ArrowUpRight /></span></Link>
        <div className={styles.storyCaption}><h3>St Heliers Townhouse</h3><p>An open gable, opal acrylic and a custom street-facing frame. A considered extension of the house, with its own character.</p><span>St Heliers, Auckland<br />6.0 × 3.0 m / Opal acrylic</span></div>
      </section>

      <section className={styles.options} id="acrylic-options" aria-labelledby="compare-tints"><header><p className={styles.eyebrow}>02 / Find your light</p><h2 id="compare-tints">Four tints.<br />A different feeling.</h2><p>Start with the view and daylight you want. Then consider the sun, your roof area and the windows behind it.</p></header><AcrylicTintComparison /></section>

      <section className={styles.mixedStory} aria-labelledby="mixed-title"><Link className={styles.mixedImage} href="/projects/warkworth-outdoor-room" data-acrylic-project><Image src="/images/project-warkworth-outdoor-room-04.jpg" alt="Clear acrylic roof zones beside cedar lining in the completed Warkworth outdoor room" width={3000} height={2562} sizes="(max-width: 760px) 100vw, 58vw" /><span>See the whole project <ArrowUpRight /></span></Link><div className={styles.mixedCopy}><p className={styles.eyebrow}>03 / A place for both</p><h2 id="mixed-title">Daylight above.<br />Timber beside it.</h2><p>Acrylic can also be part of a mixed roof. At Warkworth, clear acrylic roof and gable glazing sit alongside solid roofing and cedar lining.</p><p>We plan the materials, junctions and drainage together. The right balance depends on your home and the space below.</p><div className={styles.materialCaption}>Warkworth Outdoor Room<br /><span>A completed custom project. Furniture, landscaping and the fireplace are not standard pergola inclusions.</span></div></div></section>

      <section className={styles.nextStep} aria-labelledby="next-step-title"><div><p className={styles.eyebrow}>A considered start</p><h2 id="next-step-title">Bring us the space.<br />We’ll work through the details.</h2></div><ol><li><span>01</span><div><h3>Share your idea</h3><p>Your suburb and how you want to use the space are enough to begin.</p></div></li><li><span>02</span><div><h3>Explore the fit</h3><p>We review the roof, daylight, house connection and site requirements.</p></div></li><li><span>03</span><div><h3>Agree the scope</h3><p>Your proposal confirms the design, products, inclusions and checks before you commit.</p></div></li></ol></section>




      </FunnelJourney>
    </main></LandingExperiment></ChannelTrackingRegion>
  );
}
