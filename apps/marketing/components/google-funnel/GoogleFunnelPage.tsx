import Image from 'next/image';
import FunnelReview from './FunnelReview';
import { simpleCoverStandard } from '../../app/simple-pergolas-auckland/content';
import ArrowUpRight from '../marketing-foundation/ArrowUpRight';
import FunnelJourney from './FunnelJourney';
import AcrylicTintComparison from '../../app/acrylic-roof-pergolas-auckland/AcrylicTintComparison';
import styles from './funnel.module.css';

export default function GoogleFunnelPage({ acrylic = false }: { acrylic?: boolean }) {
  const path = acrylic ? '/ads/acrylic-pergolas' : '/ads/outdoor-living';
  return <main className={styles.page} data-google-funnel={acrylic ? 'acrylic' : 'outdoor-living'} data-marketing-foundation-page>
    <section className={styles.hero} aria-labelledby="funnel-title">
      <Image className={styles.heroImage} src={acrylic ? '/images/project-dairy-flat-03.jpg' : '/images/project-riverhead-gable-01.jpg'} alt={acrylic ? 'Daylight through the acrylic gable roof of the completed Sanctuary pergola at Dairy Flat' : 'The timber-lined Sanctuary pavilion beside the pool in Riverhead, Auckland'} fill priority sizes="100vw"/>
      <div className={styles.shade}/><div className={styles.brand}><span>sanctuary<small>PERGOLAS</small></span><p>{acrylic ? 'Acrylic pergolas' : 'Outdoor living'} · Auckland</p></div>
      <div className={styles.heroContent}><h1 id="funnel-title">{acrylic ? <>Cover the space<br/>without losing light.</> : <>Make room<br/>for life outside.</>}</h1><p className={styles.heroService}>{acrylic ? 'Custom acrylic pergolas, designed and installed in Auckland.' : 'Custom pergolas and covered outdoor spaces, designed and installed in Auckland.'}</p><div className={styles.heroBottom}><div><p>{acrylic ? <>A covered space, with daylight above.<br/>Designed around the home you love.</> : <>A place for slow mornings. Long lunches.<br/>And a little more everyday living.</>}</p><a className={styles.heroAction} href="#project-details">Get a tailored quote <ArrowUpRight/></a></div><span className={styles.caption}>Built by Sanctuary<br/>{' '}{acrylic ? 'Dairy Flat' : 'Riverhead'}, Auckland</span></div></div>
    </section>
    <div className={styles.proofLine}><span>Designed around your home.</span><span>Auckland based.</span><span>10-year workmanship warranty.</span></div>
    <FunnelReview acrylic={acrylic}/>
    <FunnelJourney path={path}>
      {acrylic && <details className={styles.tintExplainer}><summary><span>See how acrylic tints change the light</span><span aria-hidden="true">+</span></summary><div className={styles.tintContent}><p>Start with the view and daylight you want. Then consider the sun, your roof area and the windows behind it. We’ll confirm your tint with product samples at your site.</p><AcrylicTintComparison/></div></details>}
      <section className={styles.proof} aria-labelledby="proof-title"><header className={styles.sectionHeading}><div><p className={styles.eyebrow}>Real homes. Completed projects.</p><h2 id="proof-title">{acrylic ? <>Simple form.<br/>Sanctuary finish.</> : <>Not just a roof.<br/>Your favourite place.</>}</h2></div><p>{acrylic ? 'A focused product still deserves careful proportions, clean connections and a complete finish.' : 'From a light-filled deck to a timber-lined outdoor lounge, the right pergola starts with your house and how you want to live.'}</p></header>
        <div className={styles.projectPair}><figure><Image src="/images/project-st-heliers-01.jpg" alt="Opal acrylic gable roof following the roofline of the completed St Heliers townhouse" width={1500} height={1028} sizes="(max-width:760px) 100vw, 58vw"/><figcaption><strong>A natural extension.</strong><span>St Heliers · Opal acrylic</span></figcaption><p className={styles.projectCopy}>An open gable, opal acrylic and a custom street-facing frame follow the roofline of this St Heliers home.</p></figure>{!acrylic && <figure><Image src="/images/project-riverhead-gable-03.webp" alt="Timber lining and integrated lighting in the completed Riverhead pavilion" width={2400} height={1792} sizes="(max-width:760px) 100vw, 42vw"/><figcaption><strong>A room under the roof.</strong><span>Riverhead · Timber lining</span></figcaption><p className={styles.projectCopy}>Timber sarking and integrated lighting give this poolside pavilion its character. A different answer for a different way of living.</p></figure>}{acrylic && <div className={styles.standard}>{simpleCoverStandard.map(item => <div key={item.number}><span>{item.number}</span><h3>{item.title}</h3><p>{item.text}</p></div>)}<details><summary>What your proposal confirms</summary><p>Your chosen roof shape, aluminium frame and roofing, house and post connections, flashings, drainage, delivery and installation within the agreed scope.</p><p>Our acrylic roofing blocks 99% of UV light. We confirm the exact product and tint, plus any engineering or consent checks for your site.</p></details></div>}</div>
        <p className={styles.small}>Completed Sanctuary projects. Your proposal confirms your materials and inclusions. Furniture, planting and landscaping are not included.</p>
      </section>
    </FunnelJourney>
  </main>;
}
