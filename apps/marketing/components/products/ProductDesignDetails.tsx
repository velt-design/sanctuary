import RoofApproaches from '../marketing-foundation/editorial/RoofApproaches';
import type { ReactNode } from 'react';
import { getProductBySlug, type ProductRecord } from '@/data/products';
import { Container, Disclosure, Eyebrow, Heading, Text, TextLink } from '../marketing-foundation';
import styles from '../marketing-foundation/editorial/composition.module.css';
import productStyles from '../marketing-foundation/editorial/product-composition.module.css';
import { productSelectionAnchor, type ProductDesignType } from './productDesigns';

/** Reading layer for the three interactive rooflines; shared selection owns the offer. */
export default function ProductDesignDetails({ product, type, evidence, gallery, supportingLinks }: {
  product: ProductRecord; type: ProductDesignType; evidence: ReactNode; gallery: ReactNode; supportingLinks: ReactNode;
}) {
  return <>
    {gallery}
    <Container width="wide">
      <div className={productStyles.specifications} id="product-fit">
        <div><Eyebrow>{product.shortName} / Design details</Eyebrow><Heading as="h2" variant="card">Made for your setting.</Heading><Text>{product.details.overview}</Text></div>
        <div>
          <Disclosure summary="Explore a project in detail" bodyClassName={styles.disclosureBody}>{evidence}</Disclosure>
          <Disclosure summary="Is this roofline right for your home?" bodyClassName={styles.disclosureBody}>
            <h3>Works well when</h3><ul className={styles.detailList}>{product.decision.worksWhen.map(item => <li key={item}>{item}</li>)}</ul>
            <h3>We’ll resolve together</h3><ul className={styles.detailList}>{product.decision.resolve.map(item => <li key={item}>{item}</li>)}</ul>
            {product.tradeoffs.map(item => <div key={item.tension}><h3>{item.tension}</h3><Text>{item.guidance}</Text></div>)}
          </Disclosure>
          {type === 'gable' && <Disclosure summary="Compare acrylic, solid and mixed roofing" bodyClassName={styles.disclosureBody}>
            <RoofApproaches options={product.details.options?.slice(0, 3) ?? []} designHref={`#${productSelectionAnchor(type)}`} />
          </Disclosure>}
          <Disclosure summary="Structure and roofing" bodyClassName={styles.disclosureBody}>
            <Text>{product.details.howItWorks}</Text>
            {product.details.indicativePerformance?.map(item => <Text key={item}>{item}</Text>)}
            <ul className={styles.detailList}>{product.details.structureMaterials?.map(item => <li key={item}>{item}</li>)}</ul>
            {(type === 'gable' ? product.details.options?.slice(3) : product.details.options)?.map(item => <Text key={item}>{item}</Text>)}
          </Disclosure>
          <Disclosure summary="Installation and maintenance" bodyClassName={styles.disclosureBody}>{[...(product.details.install ?? []), ...(product.details.maintenance ?? [])].map(item => <Text key={item}>{item}</Text>)}</Disclosure>
          {product.details.faqs?.map(item => <Disclosure summary={item.q} key={item.q} bodyClassName={styles.disclosureBody}><Text>{item.a}</Text></Disclosure>)}
        </div>
      </div>
    </Container>
    <Container width="wide">
      <div className={productStyles.alternatives}><div><Eyebrow>Other options</Eyebrow><Heading as="h2" variant="card">Explore the range.</Heading></div>{product.alternatives.map(slug => { const alternative = getProductBySlug(slug); return alternative ? <TextLink key={slug} href={alternative.route}>{alternative.name}</TextLink> : null; })}</div>
      {supportingLinks}
      <TextLink href={`#${productSelectionAnchor(type)}`}>Return to your design</TextLink>
    </Container>
  </>;
}
