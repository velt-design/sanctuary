import Image from 'next/image';
import { buildConfiguratorEnquiryHref } from '@/lib/configuratorEntry';
import ArrowUpRight from './ArrowUpRight';
import styles from './landing-designer.module.css';

export default function LandingDesigner({ sourcePath, material, helpHref }: { sourcePath: string; material: 'acrylic' | 'solid'; helpHref: string }) {
  const href = buildConfiguratorEnquiryHref({ enquiryType: 'residential', sourcePath, sourceComponent: 'project_cta' });
  return <section className={styles.section} id="design-your-pergola" aria-labelledby="landing-designer-title">
    <div className={styles.copy}><p className={styles.eyebrow}>Your space. Your design.</p><h2 id="landing-designer-title">See what<br />could be yours.</h2><p>Set your size. Choose a roof. Add the details that make it your place.</p><p>Explore your pergola in 3D and plan view, with an installed estimate including GST where pricing is available. No contact details needed to try it.</p><a className={styles.action} href={href} data-configurator-material={material}>Design your pergola <ArrowUpRight /></a><a className={styles.help} href={helpHref}>Prefer a hand? Tell us about your space <ArrowUpRight /></a></div>
    <div className={styles.visual}><a href={href} data-configurator-material={material} aria-label="Open the pergola designer"><Image src={material === 'acrylic' ? '/images/configurator/shape-gable-v1.webp' : '/images/configurator/roof-gable-solid-v1.webp'} alt={material === 'acrylic' ? 'Illustration of an acrylic gable pergola, a starting point for the designer' : 'Illustration of a solid-roof gable pergola, a starting point for the designer'} width={1200} height={900} sizes="(max-width: 760px) 100vw, 60vw"/><span className={styles.open}>Open your 3D design <ArrowUpRight /></span></a><div className={styles.features}><span>01 / Shape & size</span><span>02 / Roof & sides</span><span>03 / Lighting & estimate</span></div><p className={styles.note}>Starting design illustration. Pick up your saved design or make this your own. Final pricing depends on site checks, connections and any engineering or consent requirements.</p><noscript><p>The interactive designer needs JavaScript. You can still send your project brief below.</p></noscript></div>
  </section>;
}
