import Image from 'next/image';
import Link from 'next/link';
import ArrowUpRight from '../marketing-foundation/ArrowUpRight';
import { Container } from '../marketing-foundation/Primitives';
import { buildAssistedEnquiryHref } from '../../lib/configuratorEntry';
import { buildProductHubViewModel } from './productHubViewModel';
import styles from './product-overview-details.module.css';

const roofs = [
  { title: 'Keep the daylight.', finish: 'Acrylic roofing', image: '/images/project-dairy-flat-02.jpg', alt: 'Daylight through the acrylic gable roof at Dairy Flat', project: 'Dairy Flat', href: '/projects/dairy-flat-estate', position: '50% 25%' },
  { title: 'Bring warmth overhead.', finish: 'Timber lining', image: '/images/project-riverhead-gable-03.webp', alt: 'Timber-lined ceiling and clear gable end at Riverhead', project: 'Riverhead', href: '/projects/riverhead-gable-pavilion', position: '50% 35%' },
  { title: 'Make room for both.', finish: 'Acrylic and timber lining', image: '/images/project-warkworth-outdoor-room-04.jpg', alt: 'A strip of acrylic roofing beside the timber-lined ceiling at Warkworth', project: 'Warkworth', href: '/projects/warkworth-outdoor-room', position: '50% 25%' },
] as const;

const details = [
  { title: 'Close a side when you need to.', image: '/images/blind-coastal-mesh.webp', alt: 'Lowered mesh blind beside a covered coastal deck', caption: 'A lowered mesh blind.', copy: 'Consider the sun, privacy and exposed edges of your space.', slugs: ['drop-down-blinds'] },
  { title: 'Give the space an edge.', image: '/images/project-milford-garden-retreat-05-privacy-screens.jpg', alt: 'Vertical timber privacy screens around the spa at Milford', caption: 'Fixed privacy screens at Milford.', copy: 'Fixed screens and infill can define a side or complete a roof end.', slugs: ['slat-screens', 'acrylic-infill-panels'] },
  { title: 'Stay a little longer.', image: '/images/project-goodhome-04.jpg', alt: 'Illuminated LED strip beneath the pergola roof at The Good Home', caption: 'Integrated strip lighting at The Good Home.', copy: 'Plan lighting and heating alongside the roof, so their positions work with the space.', slugs: ['downlights', 'led-strip-lighting', 'patio-heaters'] },
] as const;

export default function ProductHubDetails() {
  const { optionGateways, guideLinks } = buildProductHubViewModel();
  const options = optionGateways.flatMap(group => group.products);
  return <div className={styles.details}>
    <section className={styles.roofs} aria-labelledby="roof-finishes-title">
      <Container width="wide">
        <header className={styles.sectionIntro}>
          <div><p className={styles.eyebrow}>Then, choose what is overhead</p><h2 id="roof-finishes-title">Same roofline.<br />A different feeling.</h2></div>
          <p>The shape sets the outline. The roof finish changes the light and the feeling beneath it. These built projects show the possibilities; the estimates above are for acrylic roofing with open sides.</p>
        </header>
        <div className={styles.roofGrid}>{roofs.map(roof => <article key={roof.finish} data-roof-finish>
          <figure><Image src={roof.image} alt={roof.alt} width={900} height={900} sizes="(max-width:760px) calc(100vw - 40px), (max-width:1440px) 30vw, 415px" style={{ objectPosition: roof.position }} /><figcaption>{roof.finish}</figcaption></figure>
          <h3>{roof.title}</h3>
          <Link href={roof.href}>See {roof.project} <ArrowUpRight /></Link>
        </article>)}</div>
      </Container>
    </section>
    <section className={styles.finishing} aria-labelledby="finishing-title">
      <Container width="wide">
        <header className={styles.sectionIntro}><div><p className={styles.eyebrow}>Finish around the way you live</p><h2 id="finishing-title">The details make it yours.</h2></div><p>You do not need to decide everything now. Start with how you want to use the space, then choose the sides, lighting and heating that belong there.</p></header>
        <div className={styles.detailGrid}>{details.map(detail => <article key={detail.title} data-product-option-gateway>
          <figure><Image src={detail.image} alt={detail.alt} width={900} height={900} sizes="(max-width:760px) calc(100vw - 40px), (max-width:1440px) 30vw, 415px" /><figcaption>{detail.caption}</figcaption></figure>
          <h3>{detail.title}</h3><p>{detail.copy}</p>
          <div className={styles.optionLinks}>{options.filter(option => detail.slugs.some(slug => slug === option.slug)).map(option => <Link href={option.route} key={option.slug}>{option.name} <ArrowUpRight /></Link>)}</div>
        </article>)}</div>
      </Container>
    </section>
    <section className={styles.help} aria-labelledby="pergola-help-title"><Container width="wide"><div className={styles.helpGrid}>
      <div><p className={styles.eyebrow}>Start with your space</p><h2 id="pergola-help-title">Your home is the starting point.</h2><p>A particular roofline, an awkward corner, or simply an idea for the deck. Tell us what you have in mind and we can work through the options with you.</p><Link className={styles.primary} href={buildAssistedEnquiryHref({ sourcePath: '/products', sourceComponent: 'final_cta' }, 'bespoke')}>Discuss a bespoke pergola <ArrowUpRight /></Link></div>
      <div className={styles.guide}>{guideLinks.map(guide => <div key={guide.href}><h3>{guide.label}</h3><p>{guide.copy}</p><Link href={guide.href}>Read the cost guide <ArrowUpRight /></Link></div>)}</div>
    </div></Container></section>
  </div>;
}
