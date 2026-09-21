'use client';
import controlStyles from '../marketing-foundation/design-controls.module.css';
import ArrowUpRight from '../marketing-foundation/ArrowUpRight';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { buildAssistedEnquiryHref } from '@/lib/configuratorEntry';
import type { ProductRecord } from '@/data/products';
import ProductChoices from './ProductChoices';
import { useMemo, useState, useCallback } from 'react';
import ProductPreviewPoster from './ProductPreviewPoster';
import { Button, Container, Eyebrow, Heading, Text } from '../marketing-foundation/Primitives';
import { useConfiguratorPrice } from '../configurator-prototype/useConfiguratorPrice';
import { useReviewPrice } from '../configurator-prototype/useReviewPrice';
import { enquiryEstimate } from '@/app/design-enquiry/enquiryEstimate';
import { designEntryHref, PRODUCT_MATERIALS, PRODUCT_SIDES, productSelectionDraft } from './productSelection';
import { useProductSelection } from './useProductSelection';
import { PRODUCT_DESIGNS, productSelectionAnchor, type ProductDesignType } from './productDesigns';
import styles from './product-selection.module.css';

const ProductModel = dynamic(() => import('./ProductModel'), { ssr: false, loading: () => null });
import { formatEstimate as money } from '../../lib/estimateDisplay';

export default function ProductSelector({ product, type }: { product: ProductRecord; type: ProductDesignType }) {
  const design = PRODUCT_DESIGNS[type];
  const context = { sourcePath: product.route, sourceComponent: 'product_cta' as const, sourceProduct: product.slug };
  const { selection, update, ready, storageAvailable, adjustment, projectionMax } = useProductSelection(type);
  const { draft, issue } = useMemo(() => productSelectionDraft(selection, type), [selection, type]);
  const [attempt, setAttempt] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [resizing, setResizing] = useState(false);
  const markModelReady = useCallback(() => setModelReady(true), []);
  const [section, setSection] = useState<'Size' | 'Roof' | 'Sides'>('Size');
  const { price, retry } = useConfiguratorPrice(draft, ready && !issue);
  const review = useReviewPrice(draft.input, draft.roof, ready && !issue, attempt);
  const estimate = enquiryEstimate(price, review, process.env.NODE_ENV === 'development');
  const partial = 'excluded' in estimate && Boolean(estimate.excluded?.length);
  const shared = !issue && !partial && 'amount' in estimate && estimate.amount !== undefined
    ? { basis: estimate.draft ? 'draft' as const : 'published' as const, amountIncGst: estimate.amount } : null;
  const material = PRODUCT_MATERIALS.find(m => m.value === selection.material)!;
  const sides = PRODUCT_SIDES.find(s => s.value === selection.sides)!;
  const compactPrice = shared ? money(shared.amountIncGst) : issue ? 'Check sides'
    : partial || estimate.message === 'Your design needs a tailored quote.' ? 'Tailored quote'
    : 'retry' in estimate && estimate.retry ? 'Price unavailable' : 'Updating…';
  return <section id={productSelectionAnchor(type)} className={styles.section} aria-labelledby="product-title">
    <Container width="wide">
      <div className={styles.breadcrumb}><Link href="/products">Pergolas</Link><span aria-hidden="true">/</span><span>{product.shortName}</span></div>
      <div className={styles.layout} data-choice-section={section}>
        <div className={styles.identity}>
          <Eyebrow>Made for your home</Eyebrow>
          <Heading as="h1" variant="display" id="product-title" className={styles.title}>{product.name}.</Heading>
          <Text>{design.introduction}</Text>
          <div className={styles.price} aria-live="polite" aria-atomic="true">
            <Eyebrow>{shared?.basis === 'draft' ? 'Draft installed estimate' : 'Installed estimate'}</Eyebrow>
            <p className={styles.amount} data-priced={Boolean(shared)}>{issue ? 'Check side configuration' : partial ? 'Your design needs a tailored quote.' : shared ? money(shared.amountIncGst) : estimate.message}</p>
            <p className={styles.priceNote}>{shared ? 'NZD · Including GST · Subject to site confirmation' : 'We’ll confirm the cost for your site.'}</p>
            <p className={styles.priceStatus}>{shared?.basis === 'draft' ? 'Review pricing only — not a published customer offer.' : ' '}
              {'retry' in estimate && estimate.retry && !issue && <button className={styles.retry} onClick={() => { retry(); setAttempt(n => n + 1); }}>Retry estimate</button>}</p>
          </div>
        </div>
        <div className={styles.visual}>
          <div className={styles.model} aria-label={`Preview your ${product.name.toLowerCase()}`}><ProductModel resizing={resizing} draft={draft} example={product.hero} onFullscreen={setFullscreen} onReady={markModelReady}/>{!modelReady && <ProductPreviewPoster type={type}/>}</div>
          <div className={styles.caption}><span>{(selection.widthMm / 1000).toFixed(1)} × {(selection.projectionMm / 1000).toFixed(1)} m</span><span>{Number((selection.widthMm * selection.projectionMm / 1e6).toFixed(2))} m² covered</span></div>
          <p className={styles.modelNote}>Explore the model or plan. Final proportions and fixings follow your site measure.</p>
        </div>
        <div className={styles.controls}><div className={styles.choiceEstimate} aria-live="polite"><span>{shared?.basis === 'draft' ? 'Draft installed estimate' : 'Installed estimate'}</span><strong>{shared ? money(shared.amountIncGst) : issue ? 'Check sides' : partial ? 'Tailored quote' : estimate.message}</strong><small>{shared?.basis === 'draft' ? 'Including GST · Review pricing only, not a published offer.' : 'Including GST · Subject to site confirmation.'}</small>{'retry' in estimate && estimate.retry && !issue && <button className={styles.retry} onClick={() => {retry();setAttempt(n => n + 1);}}>Retry estimate</button>}</div><ProductChoices onResizingChange={setResizing} onSectionChange={setSection} draft={draft} adjustment={adjustment} projectionMax={projectionMax} imageFamily={design.imageFamily} selection={selection} update={update} ready={ready} issue={issue}/></div>
        <div className={styles.purchase}>
          <p className={styles.selectionSummary}>{material.label} <span aria-hidden="true">·</span> {sides.label} <span aria-hidden="true">·</span> House-attached</p>
          <div className={styles.actions}>
            {ready && !issue ? <><Button className={controlStyles.action} href={designEntryHref('enquiry', draft, context, shared)} prefetch={false}>Enquire about this design <ArrowUpRight /></Button><Button variant="secondary" data-secondary="true" className={controlStyles.action} href={designEntryHref('configurator', draft, context, shared)} prefetch={false}>Customise further <ArrowUpRight /></Button></> : <p role="status">{issue ? 'Resolve the side configuration to continue.' : 'Restoring your selections…'}</p>}
          </div>
          <p className={styles.detail}>Your choices carry through. Explore other attachments, screens and lighting in the full designer.</p>
          <Link className={styles.bespokeLink} href={buildAssistedEnquiryHref(context, 'bespoke')}>Need a bespoke design? Talk to us <ArrowUpRight/></Link>
          <details className={styles.inclusions}><summary>What’s included</summary><Text size="small">Selected roof, any selected blinds and standard installation allowances. {design.assumptions} Foundations, unusual access or fixings, electrical supply and travel outside our service area are assessed separately. Final price is subject to site confirmation.</Text></details>
          {!storageAvailable && <p className={styles.detail} role="status">Your browser cannot save these choices for a return visit. The buttons still carry your current design.</p>}
        </div>
      </div>
      <div className={styles.assumptions}><span>Designed around your space</span><span>{design.attachment} · Ground level</span><a href="#product-fit">Explore the details <ArrowUpRight style={{transform:'rotate(135deg)'}}/></a></div>
      <div className={styles.mobilePurchase} hidden={fullscreen} aria-label="Your design enquiry"><div><small>{shared?.basis === 'draft' ? 'Draft estimate · incl. GST' : 'Installed estimate'}</small><strong>{compactPrice}</strong></div>{ready && !issue ? <Link href={designEntryHref('enquiry', draft, context, shared)} prefetch={false}>Enquire <ArrowUpRight/></Link> : <button disabled>{issue ? 'Check sides' : 'Loading…'}</button>}</div>
    </Container>
  </section>;
}
