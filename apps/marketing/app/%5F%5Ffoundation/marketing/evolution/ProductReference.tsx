import Link from 'next/link';
import { Button, Container, Disclosure, Eyebrow, Figure, Heading, Text, TextLink } from '@/components/marketing-foundation';
import { getProductBySlug, type ProductRecord } from '@/data/products';
import RoofApproaches from './RoofApproaches';
import { PROJECT_REFERENCE } from './referencePaths';
import ReferenceLink from './ReferenceLink';
import styles from './reference.module.css';
import productStyles from './productReference.module.css';

export default function ProductReference({ product, enquiryHref }: { product: ProductRecord; enquiryHref: string }) {
  return <>
    <Container width="wide"><section className={productStyles.hero} aria-labelledby="product-title"><div className={productStyles.heroCopy}><Eyebrow>Pergola forms / Gable</Eyebrow><Heading as="h1" variant="display" id="product-title">{product.name}</Heading><p className={styles.lead}>{product.proposition}</p><Text>{product.outcome.copy}</Text><Link className={styles.jump} href="#roof-approaches">Explore roof approaches <span aria-hidden="true">↓</span></Link></div><Figure image={product.hero.src} alt={product.hero.alt} objectPosition={product.hero.objectPosition} ratio="portrait" priority caption={product.hero.caption} detail="A built example" sizes="(max-width: 760px) 100vw, 60vw" /></section></Container>

    <section className={styles.section} id="gable-fit"><Container width="wide"><div className={styles.sectionTop}><div><Eyebrow>01 / The right fit</Eyebrow><Heading>Start with the house.</Heading></div><Text>{product.details.overview}</Text></div><div className={productStyles.fitGrid}><div><h3>A gable works well when</h3><ul className={styles.detailList}>{product.decision.worksWhen.map(item => <li key={item}>{item}</li>)}</ul></div><div><h3>We’ll resolve together</h3><ul className={styles.detailList}>{product.decision.resolve.map(item => <li key={item}>{item}</li>)}</ul></div></div></Container></section>

    <section className={`${styles.section} ${styles.warm}`} id="roof-approaches"><Container width="wide"><div className={styles.sectionTop}><div><Eyebrow>02 / Light, shade and material</Eyebrow><Heading>One form.<br />Different roof approaches.</Heading></div><Text>Compare acrylic, solid and mixed roof zones. The choice changes both the light below and the character of the ceiling.</Text></div><RoofApproaches options={product.details.options?.slice(0, 3) ?? []} /></Container></section>

    <section className={styles.section} id="gable-details"><Container width="wide" className={styles.detailGrid}><div><Eyebrow>03 / What to consider</Eyebrow><Heading>Resolve the <br />whole picture.</Heading><Text>Look at the roof from inside the house as well as from the garden.</Text></div><div className={productStyles.tradeoffs}>{product.tradeoffs.map((item, index) => <div key={item.tension}><span>0{index + 1}</span><div><h3>{item.tension}</h3><Text>{item.guidance}</Text></div></div>)}</div></Container></section>

    <Container width="wide"><div className={productStyles.specifications}><div><Eyebrow>Specification & care</Eyebrow><Heading as="h2" variant="card">The details that follow the design.</Heading></div><div>
      <Disclosure summary="Structure and roofing" bodyClassName={styles.disclosureBody}><Text>{product.details.howItWorks}</Text><ul className={styles.detailList}>{product.details.structureMaterials?.map(item => <li key={item}>{item}</li>)}</ul><Text>{product.details.options?.[3]}</Text></Disclosure>
      <Disclosure summary="Installation and maintenance" bodyClassName={styles.disclosureBody}>{[...(product.details.install ?? []), ...(product.details.maintenance ?? [])].map(item => <Text key={item}>{item}</Text>)}</Disclosure>
      {product.details.faqs?.map(item => <Disclosure summary={item.q} key={item.q} bodyClassName={styles.disclosureBody}><Text>{item.a}</Text></Disclosure>)}
    </div></div></Container>

    <section className={styles.section}><Container width="wide" className={styles.bridgeGrid}><Figure image={product.gallery[0].src} alt={product.gallery[0].alt} objectPosition={product.gallery[0].objectPosition} ratio="standard" /><div><Eyebrow>See it built / Warkworth</Eyebrow><Heading>A room beside<br />the house.</Heading><Text>{product.evidence.status === 'governed' ? product.evidence.relevance : product.outcome.copy}</Text><ReferenceLink href={PROJECT_REFERENCE}>Explore Warkworth Outdoor Room</ReferenceLink></div></Container></section>

    <Container width="wide"><div className={productStyles.alternatives}><div><Eyebrow>Other forms</Eyebrow><Heading as="h2" variant="card">A different roofline?</Heading></div>{product.alternatives.map(slug => { const alternative = getProductBySlug(slug); return alternative ? <TextLink key={slug} href={alternative.route}>{alternative.name}</TextLink> : null; })}</div></Container>
    <section className={styles.conversion}><Container width="wide" className={styles.conversionGrid}><div><Eyebrow>Your place, your project</Eyebrow><Heading>Find the right form<br />for your home.</Heading></div><div><Text size="large">Share your location, a few site photos and what you want from the space.</Text><Button href={enquiryHref}>Discuss a gable pergola <span aria-hidden="true">↗</span></Button><Text size="small">We’ll confirm the roof approach, dimensions and site requirements with you.</Text></div></Container></section>
  </>;
}
