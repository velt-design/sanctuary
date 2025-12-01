'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { sections } from '@/data/mega';
import '../../product.css';
import { productDescriptions } from '@/data/productDescriptions';
import Image from 'next/image';
import ProductDetails from '@/components/ProductDetails';
import Accordion from '@/components/Accordion';
import { productContent } from '@/data/productContent';
import JsonLd from '@/components/JsonLd';
import { absoluteUrl } from '@/lib/seo';

const norm = (s: string) => s.toLowerCase().replace(/\s*&\s*/g, '-').replace(/\s+/g, '-');

export default function ProductItemPage() {
  const params = useParams<{ category: string; item: string }>();
  const category = (params?.category as unknown as string) || '';
  const item = (params?.item as unknown as string) || '';

  const data = useMemo(() => {
    const sec = sections.find(s => norm(s.heading) === category);
    if (!sec) return null;
    const it = sec.items.find(i => i.href.split('/').pop() === item);
    return it ? { section: sec.heading, item: it } : null;
  }, [category, item]);

  // Do not early-return; keep hooks order stable. Render not-found state below if needed.

  const slug = item;
  const long = productDescriptions[slug];
  const structured = productContent[slug as keyof typeof productContent];
  const [activeIdx, setActiveIdx] = useState(0);
  const isGable = slug === 'gable';
  const isPitched = slug === 'pitched';
  const isHip = slug === 'hip';
  const isBox = slug === 'box-perimeter';
  const isLedStrip = slug === 'led-strip-lighting';
  const isDropDownBlinds = slug === 'drop-down-blinds';
  const usesAccordionLayout = isGable || isPitched || isHip || isBox || isLedStrip || isDropDownBlinds;
  const [zoomOpen, setZoomOpen] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);
  const leftScrollerRef = useRef<HTMLDivElement | null>(null);
  const rightScrollerRef = useRef<HTMLDivElement | null>(null);

  // Gable-only: keep an "all closed" class in sync and scroll
  // the left image stack to the panel-linked image when a panel opens.
  useEffect(() => {
    if (!usesAccordionLayout) return;
    const main = mainRef.current;
    if (!main) return;
    const container = main.querySelector('.product-long');
    if (!container) return;

    const detailsEls = Array.from(container.querySelectorAll<HTMLDetailsElement>('details.accordion__item'));
    const leftScroller = leftScrollerRef.current;

    const setAllClosedClass = () => {
      const anyOpen = container.querySelector('details[open]');
      if (anyOpen) main.classList.remove('is-all-closed');
      else main.classList.add('is-all-closed');
    };

    const scrollToIndex = (idx: number) => {
      setActiveIdx(idx);
      if (!leftScroller) return;
      const grid = leftScroller.querySelector('.img-grid');
      const items = grid ? (Array.from(grid.children) as HTMLElement[]) : [];
      const target = items[idx];
      if (target) leftScroller.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
    };

    // Initial sync (honours defaultOpen)
    setAllClosedClass();
    const initiallyOpenIdx = detailsEls.findIndex(d => d.hasAttribute('open'));
    if (initiallyOpenIdx >= 0) {
      scrollToIndex(initiallyOpenIdx);
      const d = detailsEls[initiallyOpenIdx];
      const summary = d?.querySelector<HTMLElement>('.accordion__summary');
      const rs = rightScrollerRef.current;
      if (summary && rs) {
        const offset = summary.getBoundingClientRect().top - rs.getBoundingClientRect().top + rs.scrollTop;
        rs.scrollTo({ top: Math.max(0, offset), behavior: 'auto' });
      }
    }

    const onToggle = (e: Event) => {
      const d = e.target as HTMLDetailsElement | null;
      if (!d || d.tagName !== 'DETAILS') return;
      setAllClosedClass();
      if (d.hasAttribute('open')) {
        const idx = detailsEls.indexOf(d);
        if (idx >= 0) scrollToIndex(idx);
        // Also align the right scroller so the open header is pinned at the top
        const summary = d.querySelector<HTMLElement>('.accordion__summary');
        const rs = rightScrollerRef.current;
        if (summary && rs) {
          const offset = summary.getBoundingClientRect().top - rs.getBoundingClientRect().top + rs.scrollTop;
          rs.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
        }
      }
      // no measuring; CSS handles equal-height when all are closed
    };
    container.addEventListener('toggle', onToggle as EventListener, true);
    return () => {
      container.removeEventListener('toggle', onToggle as EventListener, true);
    };
  }, [usesAccordionLayout, isGable, isPitched, isHip, isBox, isLedStrip, isDropDownBlinds]);

  const goPrev = () => setActiveIdx((i) => (i - 1 + productImages.length) % productImages.length);
  const goNext = () => setActiveIdx((i) => (i + 1) % productImages.length);
  // Image selections for known products using assets in public/images
  const productImages: string[] = useMemo(() => {
    const base = (() => {
      switch (slug) {
        case 'led-strip-lighting':
          return [
            '/images/project-kiwi-rail-02.jpg',
            '/images/project-kiwi-rail-01.jpg',
            '/images/project-kiwi-rail-03.jpg',
          ];
        case 'pitched':
          return [
            '/images/product-pitched-01.jpg',
            '/images/product-pitched-02.jpg',
            '/images/product-pitched-03.jpg',
            '/images/product-pitched-04.jpg',
            '/images/product-pitched-05.jpg',
            '/images/product-pitched-06.jpg',
          ];
        case 'gable':
          return [
            '/images/project-dairy-flat-01.jpg',
            '/images/project-st-heliers-01.jpg',
            '/images/hero-2.jpg',
            '/images/product-gable-01.jpg',
            '/images/project-st-heliers-02.jpg',
            '/images/project-goodhome-01.jpg',
          ];
        case 'hip':
          return [
            '/images/product-hip-02.jpg',
            '/images/project-waitakere-ranges-01.jpg',
            '/images/project-kiwi-rail-03.jpg',
            '/images/product-hip-04.jpg',
            '/images/product-hip-03.jpg',
          ];
        case 'box-perimeter':
          return [
            '/images/project-westmere-01.jpg',
            '/images/project-new-windsor-01.jpg',
            '/images/project-new-windsor-02.jpg',
            '/images/project-waiheke-03.jpg',
            '/images/project-waiheke-04.jpg',
          ];
        default:
          return ['/images/hero-1.jpg', '/images/hero-2.jpg'];
      }
    })();
    const filtered = base.filter(Boolean);
    return filtered.length ? filtered : ['/images/hero-1.jpg', '/images/hero-2.jpg'];
  }, [slug]);

  const getImageObjectPosition = (index: number): string => {
    if (isGable && [1, 2, 4].includes(index)) return 'top center';
    if (isHip && index === productImages.length - 1) return 'top center';
    return 'center';
  };

  const displayGroup = useMemo(() => {
    if (!data) return '';
    return data.section === 'Screens & walls'
      ? 'Slats & Screens'
      : data.section === 'Lighting & heating'
      ? 'Lighting & Heating'
      : data.section;
  }, [data]);

  const isAccordionVariant = usesAccordionLayout;

  return (
    <main
      ref={mainRef}
      className={`product-page ${isAccordionVariant ? 'product-page--accordion' : ''} ${isGable ? 'product-page--gable' : ''} ${isPitched ? 'product-page--pitched' : ''} ${isHip ? 'product-page--hip' : ''} ${isBox ? 'product-page--box-perimeter' : ''}`}
    >
      {data && (
        <JsonLd
          data={[
            {
              '@context': 'https://schema.org',
              '@type': 'Product',
              name: data.item.title.replace(/\s*→\s*$/, ''),
              description:
                structured?.overview || (long ? long.split(/\n+/)[0] : data.item.desc),
              image: productImages.map((src) => absoluteUrl(src)),
              brand: { '@type': 'Brand', name: 'Sanctuary Pergolas' },
              category: displayGroup,
              url: absoluteUrl(`/products/${category}/${item}`),
            },
            {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
                { '@type': 'ListItem', position: 2, name: 'Products', item: absoluteUrl('/products') },
                { '@type': 'ListItem', position: 3, name: displayGroup, item: absoluteUrl(`/products?group=${encodeURIComponent((data.section || '').toLowerCase().replace(/\s*&\s*/g, '-').replace(/\s+/g, '-'))}`) },
                { '@type': 'ListItem', position: 4, name: data.item.title.replace(/\s*→\s*$/, ''), item: absoluteUrl(`/products/${category}/${item}`) },
              ],
            },
          ]}
        />
      )}
      {!data ? (
        <div className="product-split">
          <div className="product-left">
            <div className="img-grid">
              <div className="ph-img" />
              <div className="ph-img" />
              <div className="ph-img" />
            </div>
          </div>
          <div className="product-right product-rail">
            <div className="product-right-scroller">
              <div className="product-body">
                <h1 className="product-title">Not found</h1>
                <p className="product-desc">Unknown product.</p>
                <Link className="btn" href="/products">Back to products</Link>
                <div className="text-grid">
                  <div className="ph-text" />
                  <div className="ph-text" />
                  <div className="ph-text" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div className="product-split">
        <div className="product-left">
          <div className="product-left-scroller" ref={leftScrollerRef}>
            {/* Mobile gallery: large main image then selectable thumbs below.
                Main image is square across all product pages for consistent framing. */}
            <div className="mobile-gallery mobile-gallery--square" aria-hidden={false}>
              <div className="ph-img mobile-gallery__main">
                {productImages.length > 0 && (
                <Image
                  key={productImages[activeIdx] || productImages[0]}
                  src={productImages[activeIdx] || productImages[0]}
                  alt={`${data.item.title.replace(/\s*→\s*$/, '')} main image`}
                  fill
                  sizes="100vw"
                  priority
                  style={{ objectFit: 'cover', objectPosition: getImageObjectPosition(activeIdx) }}
                />
                )}
                <button className="mobile-gallery__arrow mobile-gallery__arrow--prev" aria-label="Previous image" onClick={goPrev}><span aria-hidden>‹</span></button>
                <button className="mobile-gallery__arrow mobile-gallery__arrow--next" aria-label="Next image" onClick={goNext}><span aria-hidden>›</span></button>
                <button className="mobile-gallery__zoom" aria-label="Zoom image" onClick={() => setZoomOpen(true)}>
                  ⤢
                </button>
              </div>
              <div className="mobile-gallery__thumbs" role="list">
                {productImages.map((src, idx) => (
                  <button
                    key={src}
                    className={`ph-img mobile-gallery__thumb ${activeIdx === idx ? 'is-active' : ''}`}
                    onClick={() => setActiveIdx(idx)}
                    aria-label={`View image ${idx + 1}`}
                    role="listitem"
                  >
                    <Image
                      src={src}
                      alt={`${data.item.title.replace(/\s*→\s*$/, '')} thumbnail ${idx + 1}`}
                      fill
                      sizes="50vw"
                      style={{ objectFit: 'cover', objectPosition: getImageObjectPosition(idx) }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop image stack (hidden on mobile) */}
            <div className="img-grid">
              {productImages.map((src, idx) => (
                <div className="ph-img" key={src}>
                  <Image
                    src={src}
                    alt={`${data.item.title.replace(/\s*→\s*$/, '')} view ${idx + 1}`}
                    fill
                    sizes="(max-width: 960px) 100vw, 66vw"
                    priority={idx === 0}
                    style={{
                      objectFit: 'cover',
                      objectPosition: getImageObjectPosition(idx),
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="product-right product-rail">
          <div className="product-right-scroller" ref={rightScrollerRef}>
            <div className="product-body">
            {usesAccordionLayout && (
              <Link href="/products" className="product-close" aria-label="Back to products">
                <span className="product-close__icon" aria-hidden="true" />
              </Link>
            )}
            <div className="product-kicker product-kicker--wipe">{data.section === 'Screens & walls' ? 'Slats & Screens' : data.section}</div>
            {(() => {
              const baseTitle = data.item.title.replace(/\s*→\s*$/, '');
              const cleaned = isGable ? baseTitle.replace(/\s*pergola\b/i, '').trim() : baseTitle;
              return <h1 className="product-title">{cleaned}</h1>;
            })()}
            {!usesAccordionLayout && <p className="product-desc">{data.item.desc}</p>}
            {/* CTA buttons removed per request */}
            {usesAccordionLayout && structured ? (
              <div className="product-long">
                <Accordion
                  scrollBehavior={usesAccordionLayout ? 'sticky-panel' : 'default'}
                  items={[
                    {
                      title: 'Design description',
                      defaultOpen: true,
                      content: (
                        <div>
                          <p>{structured.overview}</p>
                          {structured.howItWorks && (
                            <p>
                              <strong>How it works: </strong>
                              {structured.howItWorks}
                            </p>
                          )}
                          {structured.whyItsGood && (
                            <div>
                              <p><strong>Why it’s good:</strong></p>
                              {Array.isArray(structured.whyItsGood) ? (
                                <ul>
                                  {structured.whyItsGood.map((it, i) => (
                                    <li key={i}>{it}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p>{structured.whyItsGood}</p>
                              )}
                            </div>
                          )}
                          {structured.atAGlance?.length ? (
                            <div>
                              <p><strong>At a glance:</strong></p>
                              <ul>
                                {structured.atAGlance.map((it, i) => (
                                  <li key={i}>{it}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ),
                    },
                    {
                      title: 'Product details',
                      content: (
                        <div>
                          {structured.structureMaterials?.length ? (
                            <div>
                              <p><strong>Structure & materials</strong></p>
                              <ul>
                                {structured.structureMaterials.map((it, i) => (
                                  <li key={i}>{it}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {structured.performance?.length ? (
                            <div>
                              <p><strong>Performance</strong></p>
                              <ul>
                                {structured.performance.map((it, i) => (
                                  <li key={i}>{it}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {structured.recommendedFor?.length ? (
                            <div>
                              <p><strong>Recommended for</strong></p>
                              <ul>
                                {structured.recommendedFor.map((it, i) => (
                                  <li key={i}>{it}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {structured.notIdealFor?.length ? (
                            <div>
                              <p><strong>Not ideal for</strong></p>
                              <ul>
                                {structured.notIdealFor.map((it, i) => (
                                  <li key={i}>{it}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {structured.indicativePerformance?.filter(p => !/Pitch and sheet type/i.test(p)).length ? (
                            <div>
                              <p><strong>Indicative performance</strong></p>
                              <ul>
                                {structured.indicativePerformance
                                  .filter(it => !/Pitch and sheet type/i.test(it))
                                  .map((it, i) => (
                                    <li key={i}>{it}</li>
                                  ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ),
                    },
                    {
                      title: 'Roof & Infill Options',
                      content: (
                        <div>
                          {/* Roofing + infill related options */}
                          {structured.options?.filter(o => /roof|infill/i.test(o)).length ? (
                            <div>
                              <ul>
                                {structured.options
                                  .filter(o => /roof|infill/i.test(o))
                                  .map((it, i) => (
                                    <li key={i}>{it}</li>
                                  ))}
                              </ul>
                            </div>
                          ) : null}
                          {/* Pitch/sheet tuning bullet from indicative performance */}
                          {structured.indicativePerformance?.find(p => /Pitch and sheet type/i.test(p)) ? (
                            <div>
                              <ul>
                                {structured.indicativePerformance
                                  .filter(p => /Pitch and sheet type/i.test(p))
                                  .map((it, i) => (
                                    <li key={i}>{it}</li>
                                  ))}
                              </ul>
                            </div>
                          ) : null}
                          {/* Related FAQs */}
                          {structured.faqs?.length ? (
                            <div className="product-faqs">
                              {structured.faqs.map((f, i) => (
                                <details key={i} className="product-faq">
                                  <summary>{f.q}</summary>
                                  <p>{f.a}</p>
                                </details>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ),
                    },
                    {
                      title: 'Screens, Lighting & Extras',
                      content: (
                        <div>
                          {/* Non-roof options like lights/blinds */}
                          {structured.options?.filter(o => !/roof|infill/i.test(o)).length ? (
                            <div>
                              <ul>
                                {structured.options
                                  .filter(o => !/roof|infill/i.test(o))
                                  .map((it, i) => (
                                    <li key={i}>{it}</li>
                                  ))}
                              </ul>
                            </div>
                          ) : null}
                          {structured.bestPairedWith?.length ? (
                            <div>
                              <p><strong>Best paired with</strong></p>
                              <ul>
                                {structured.bestPairedWith.map((it, i) => (
                                  <li key={i}>{it}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {structured.upgradePath?.length ? (
                            <div>
                              <p><strong>Upgrade path</strong></p>
                              <ul>
                                {structured.upgradePath.map((it, i) => (
                                  <li key={i}>{it}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ),
                    },
                    {
                      title: 'Lead time & delivery',
                      content: (
                        <div>
                          <ul>
                            {[...(structured.install || []), ...(structured.maintenance || [])].map((it, i) => (
                              <li key={i}>{it}</li>
                            ))}
                          </ul>
                        </div>
                      ),
                    },
                    {
                      title: 'Downloads',
                      content: (
                        <div>
                          <ul>
                            <li>
                              <Link href="/resources">Downloads overview</Link>
                            </li>
                            <li>
                              <Link href="/resources/specs-compliance">Specifications</Link>
                            </li>
                          </ul>
                        </div>
                      ),
                    },
                  ]}
                showPeekBottom={usesAccordionLayout}
                />
                {/* Contact CTA styled like a panel row */}
                <div className="accordion accordion--cta" role="list" aria-label="Contact call to action">
                  <div className="accordion__item" role="listitem">
                    <Link href="/contact" className="accordion__summary">
                      <span className="accordion__title">Contact</span>
                    </Link>
                  </div>
                </div>
              </div>
            ) : structured ? (
              <div className="product-long"><ProductDetails content={structured} /></div>
            ) : (
              long && (
                <div className="product-long">
                  {long.split(/\n+/).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              )
            )}
            </div>
          </div>
        </div>
      </div>
      )}
      {zoomOpen && (
        <div className="product-zoom" role="dialog" aria-modal="true" aria-label="Image zoom" onClick={() => setZoomOpen(false)}>
          <button className="product-zoom__close" aria-label="Close" onClick={() => setZoomOpen(false)}>×</button>
          <div className="product-zoom__img" onClick={(e) => e.stopPropagation()}>
            <Image
              key={`zoom-${productImages[activeIdx] || productImages[0]}`}
              src={productImages[activeIdx] || productImages[0]}
              alt={`${data?.item.title.replace(/\s*→\s*$/, '')} zoomed`}
              fill
              sizes="100vw"
              style={{ objectFit: 'contain', objectPosition: 'center' }}
              priority
            />
            <button className="product-zoom__nav product-zoom__nav--prev" aria-label="Previous image" onClick={(e) => { e.stopPropagation(); goPrev(); }}><span aria-hidden>‹</span></button>
            <button className="product-zoom__nav product-zoom__nav--next" aria-label="Next image" onClick={(e) => { e.stopPropagation(); goNext(); }}><span aria-hidden>›</span></button>
          </div>
        </div>
      )}
    </main>
  );
}
