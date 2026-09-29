'use client';
import controlStyles from '../marketing-foundation/design-controls.module.css';
import ArrowUpRight from '../marketing-foundation/ArrowUpRight';
import ProductModel from './ProductModel';
import Link from 'next/link';
import { buildAssistedEnquiryHref } from '@/lib/configuratorEntry';
import type { ProductRecord } from '@/data/products';
import ProductChoices from './ProductChoices';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Button, Container, Eyebrow, Heading, Text } from '../marketing-foundation/Primitives';
import { useConfiguratorPrice } from '../configurator-prototype/useConfiguratorPrice';
import { useReviewPrice } from '../configurator-prototype/useReviewPrice';
import { enquiryEstimate } from '@/app/design-enquiry/enquiryEstimate';
import { type ProductSelection, designEntryHref, PRODUCT_MATERIALS, PRODUCT_SIDES, productSelectionDraft } from './productSelection';
import { useProductSelection } from './useProductSelection';
import { PRODUCT_DESIGNS, productSelectionAnchor, type ProductDesignType } from './productDesigns';
import styles from './product-selection.module.css';

import { formatEstimate as money } from '../../lib/estimateDisplay';

export default function ProductSelector({ product, type }: { product: ProductRecord; type: ProductDesignType }) {
  const design = PRODUCT_DESIGNS[type];
  const context = { sourcePath: product.route, sourceComponent: 'product_cta' as const, sourceProduct: product.slug };
  const { selection, update, ready, storageAvailable, adjustment, projectionMax } = useProductSelection(type);
  const { draft, issue } = useMemo(() => productSelectionDraft(selection, type), [selection, type]);
  const [attempt, setAttempt] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [mode, setMode] = useState<'Photos' | 'Design' | 'Plan'>('Photos');
  const priceRegion = useRef<HTMLDivElement>(null);
  const [priceVisible, setPriceVisible] = useState(true);
  useEffect(() => {
    if (!priceRegion.current) return;
    const observer = new IntersectionObserver(([entry]) => setPriceVisible(entry.isIntersecting), { threshold: .5 });
    observer.observe(priceRegion.current);
    return () => observer.disconnect();
  }, []);
  const updateDesign = (patch: Partial<ProductSelection>) => {
    if (Object.entries(patch).some(([key, value]) => selection[key as keyof ProductSelection] !== value)) setMode('Design');
    update(patch);
  };
  const [resizing, setResizing] = useState(false);
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
          <Heading as="h1" variant="display" id="product-title" className={styles.title}>{product.shortName}.</Heading>
          <Text>{design.introduction}</Text>

        </div>
        <div className={styles.visual}>
          <div className={styles.model} aria-label={`Preview your ${product.name.toLowerCase()}`}><ProductModel resizing={resizing} draft={draft} gallery={product.gallery} mode={mode} onModeChange={setMode} onFullscreen={setFullscreen}/></div>
          <p className={styles.modelNote}>{mode === 'Photos' ? 'Built references, not your selected design or estimate.' : 'Your selected design. Final proportions and fixings follow your site measure.'}</p>
        </div>
        <div className={styles.controls}><ProductChoices onResizingChange={setResizing} onSectionChange={setSection} adjustment={adjustment} projectionMax={projectionMax} imageFamily={design.imageFamily} selection={selection} update={updateDesign} ready={ready} issue={issue}/></div>
        <div className={styles.purchase} ref={priceRegion}>
          <p className={styles.selectedSize}>Selected design · {selection.widthMm / 1000} × {selection.projectionMm / 1000} m</p>
          <div className={styles.price} aria-live="polite" aria-atomic="true">
            <Eyebrow>{shared?.basis === 'draft' ? 'Draft estimate · Including installation' : 'Including installation'}</Eyebrow>
            <p className={styles.amount} data-priced={Boolean(shared)}>{issue ? 'Check side configuration' : partial ? 'Your design needs a tailored quote.' : shared ? money(shared.amountIncGst) : estimate.message}</p>
            <p className={styles.priceNote}>{shared ? 'NZD · Including GST · Subject to site confirmation' : 'We’ll confirm the cost for your site.'}</p>
            <p className={styles.priceStatus}>{shared?.basis === 'draft' ? 'Review pricing only — not a published customer offer.' : ' '}
              {'retry' in estimate && estimate.retry && !issue && <button className={styles.retry} onClick={() => { retry(); setAttempt(n => n + 1); }}>Retry estimate</button>}</p>
          </div>
          <p className={styles.selectionSummary}>{material.label} <span aria-hidden="true">·</span> {sides.label} <span aria-hidden="true">·</span> House-attached</p>
          <div className={styles.actions}>
            {ready && !issue ? <><Button className={controlStyles.action} href={designEntryHref('enquiry', draft, context, shared)} prefetch={false}>Enquire about this design <ArrowUpRight /></Button></> : <p role="status">{issue ? 'Resolve the side configuration to continue.' : 'Restoring your selections…'}</p>}
          </div>

        </div>
        <div className={styles.support}>
          <div className={styles.secondaryAction}>{ready && !issue && <Button variant="secondary" data-secondary="true" className={controlStyles.action} href={designEntryHref('configurator', draft, context, shared)} prefetch={false}>Customise further <ArrowUpRight /></Button>}</div>
          <p className={styles.detail}>Your choices carry through. Explore other attachments, screens and lighting in the full designer.</p>
          <Link className={styles.bespokeLink} href={buildAssistedEnquiryHref(context, 'bespoke')}>Need a bespoke design? Talk to us <ArrowUpRight/></Link>
          <details className={styles.inclusions}><summary>What’s included</summary><Text size="small">Selected roof, any selected blinds and standard installation allowances. {design.assumptions} Foundations, unusual access or fixings, electrical supply and travel outside our service area are assessed separately. Final price is subject to site confirmation.</Text></details>
          {!storageAvailable && <p className={styles.detail} role="status">Your browser cannot save these choices for a return visit. The buttons still carry your current design.</p>}
        </div>
      </div>
      <div className={styles.assumptions}><span>Designed around your space</span><span>{design.attachment} · Ground level</span><a href="#product-fit">Explore the details <ArrowUpRight style={{transform:'rotate(135deg)'}}/></a></div>
      <div className={styles.mobilePurchase} hidden={fullscreen} aria-label="Your design enquiry"><div style={{ visibility: priceVisible ? 'hidden' : 'visible' }}><small>{shared?.basis === 'draft' ? 'Draft estimate · incl. GST' : 'Including installation'}</small><strong>{compactPrice}</strong></div>{ready && !issue ? <Link href={designEntryHref('enquiry', draft, context, shared)} prefetch={false}>Enquire <ArrowUpRight/></Link> : <button disabled>{issue ? 'Check sides' : 'Loading…'}</button>}</div>
    </Container>
  </section>;
}
