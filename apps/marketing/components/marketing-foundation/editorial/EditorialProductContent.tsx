import ArrowUpRight from '../ArrowUpRight';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button, Container, Disclosure, Eyebrow, Figure, Heading, Text, TextLink } from '../index';
import { getProductBySlug, type ProductRecord } from '@/data/products';
import RoofApproaches from './RoofApproaches';
import styles from './composition.module.css';
import productStyles from './product-composition.module.css';
import { isProductDesignType, productSelectionAnchor } from '../../products/productDesigns';
import MobileProductDisclosure from '../../products/MobileProductDisclosure';
import mobileStyles from '../../products/product-selection.module.css';

function ReadingSection({ enabled, children, summary, kind }: { enabled: boolean; children: ReactNode; summary: string; kind: string }) {
  return enabled ? <MobileProductDisclosure kind={kind} summary={summary}>{children}</MobileProductDisclosure> : children;
}

type Props = { product: ProductRecord; enquiryHref: string; gallery: ReactNode; evidence: ReactNode; supportingLinks: ReactNode; nextSteps?: ReactNode; selection?: ReactNode };

export default function EditorialProductContent({ product, enquiryHref, gallery, evidence, supportingLinks, nextSteps, selection }: Props) {
  const gable = product.slug === 'gable';
  const exploreTarget = selection && isProductDesignType(product.slug) ? `#${productSelectionAnchor(product.slug)}` : gable ? '#roof-approaches' : '#product-fit';
  return <>
    {!selection && <Container width="wide">
      <section className={productStyles.hero} aria-labelledby="product-title" data-editorial-product-hero>
        <div className={productStyles.heroCopy}>
          <Eyebrow><Link href="/products">{product.categoryLabel}</Link> / {product.name}</Eyebrow>
          <Heading as="h1" variant="display" id="product-title">{product.name}</Heading>
          <p className={styles.lead}>{product.proposition}</p>
          <Text>{product.outcome.copy}</Text>
          <Link className={styles.jump} href={exploreTarget}>{selection ? 'Choose your size & see an estimate' : gable ? 'Explore roof approaches' : 'Explore the details'} <span aria-hidden="true">↓</span></Link>
        </div>
        <Figure image={product.hero.src} alt={product.hero.alt} objectPosition={product.hero.objectPosition} ratio="portrait" priority caption={product.hero.caption} detail={product.evidence.status === 'governed' ? 'A built example' : 'Context reference'} sizes="(max-width: 760px) 100vw, 60vw" />
      </section>
    </Container>}

    {selection}
    <div className={selection ? mobileStyles.readingFlow : undefined}>
    <ReadingSection enabled={Boolean(selection)} summary="Is this roofline right for your home?" kind="fit">
    <section className={styles.section} id="product-fit">
      <Container width="wide">
        <div className={styles.sectionTop}><div><Eyebrow>01 / The right fit</Eyebrow><Heading>{product.categorySlug === 'pergolas' ? 'Start with the house.' : 'Start with the space.'}</Heading></div><Text>{product.details.overview}</Text></div>
        <div className={productStyles.fitGrid}>
          <div><h3>{gable ? 'A gable works well when' : 'Works well when'}</h3><ul className={styles.detailList}>{product.decision.worksWhen.map(item => <li key={item}>{item}</li>)}</ul></div>
          <div><h3>We’ll resolve together</h3><ul className={styles.detailList}>{product.decision.resolve.map(item => <li key={item}>{item}</li>)}</ul></div>
        </div>
      </Container>
    </section>
    </ReadingSection>

    {gable && <ReadingSection enabled={Boolean(selection)} summary="Explore roofing materials" kind="materials"><section className={`${styles.section} ${styles.warm}`} id="roof-approaches">
      <Container width="wide">
        <div className={styles.sectionTop}><div><Eyebrow>02 / Light, shade and material</Eyebrow><Heading>One form.<br />Different roof approaches.</Heading></div><Text>Compare acrylic, solid and mixed roof zones. The choice changes both the light below and the character of the ceiling.</Text></div>
        <RoofApproaches options={product.details.options?.slice(0, 3) ?? []} designHref={selection ? exploreTarget : undefined} />
      </Container>
    </section></ReadingSection>}

    <ReadingSection enabled={Boolean(selection)} summary="Design considerations" kind="considerations">
    <section className={styles.section} id="product-considerations">
      <Container width="wide" className={styles.detailGrid}>
        <div><Eyebrow>{gable ? '03' : '02'} / What to consider</Eyebrow><Heading>Resolve the<br />whole picture.</Heading><Text>{gable ? 'Look at the roof from inside the house as well as from the garden.' : 'Consider the materials, installation and everyday use together.'}</Text></div>
        <div className={productStyles.tradeoffs}>{product.tradeoffs.map((item, index) => <div key={item.tension}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{item.tension}</h3><Text>{item.guidance}</Text></div></div>)}</div>
      </Container>
    </section>
    </ReadingSection>

    <Container width="wide"><div className={productStyles.specifications}>
      <div><Eyebrow>Specification & care</Eyebrow><Heading as="h2" variant="card">The details that follow the design.</Heading></div>
      <div>
        <Disclosure summary={product.categorySlug === 'pergolas' ? 'Structure and roofing' : 'Materials and specification'} bodyClassName={styles.disclosureBody}>
          <Text>{product.details.howItWorks}</Text>
          {product.details.indicativePerformance?.map(item => <Text key={item}>{item}</Text>)}
          <ul className={styles.detailList}>{product.details.structureMaterials?.map(item => <li key={item}>{item}</li>)}</ul>
          {(gable ? product.details.options?.slice(3) : product.details.options)?.map(item => <Text key={item}>{item}</Text>)}
        </Disclosure>
        <Disclosure summary="Installation and maintenance" bodyClassName={styles.disclosureBody}>{[...(product.details.install ?? []), ...(product.details.maintenance ?? [])].map(item => <Text key={item}>{item}</Text>)}</Disclosure>
        {product.details.faqs?.map(item => <Disclosure summary={item.q} key={item.q} bodyClassName={styles.disclosureBody}><Text>{item.a}</Text></Disclosure>)}
      </div>
    </div></Container>

    <section className={styles.section} data-product-evidence><Container width="wide">{evidence}</Container></section>
    {gallery}
    <Container width="wide"><div className={productStyles.alternatives}><div><Eyebrow>Other options</Eyebrow><Heading as="h2" variant="card">A different approach?</Heading></div>{product.alternatives.map(slug => { const alternative = getProductBySlug(slug); return alternative ? <TextLink key={slug} href={alternative.route}>{alternative.name}</TextLink> : null; })}</div>{supportingLinks}</Container>
    {nextSteps ?? <section className={styles.conversion}><Container width="wide" className={styles.conversionGrid}>
      <div><Eyebrow>Your place, your project</Eyebrow><Heading>{product.categorySlug === 'pergolas' ? <>Find the right form<br />for your home.</> : <>Make it part of<br />your space.</>}</Heading></div>
      <div><Text size="large">Share your location, a few site photos and what you want from the space.</Text><Button href={enquiryHref}>Send project brief <span aria-hidden="true"><ArrowUpRight /></span></Button><Text size="small">We’ll confirm the materials, dimensions and site requirements with you.</Text></div>
    </Container></section>}
    </div>
  </>;
}
