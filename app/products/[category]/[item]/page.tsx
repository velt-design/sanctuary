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

const nonPergolaExtras = [
  {
    id: 'slat-screens',
    name: 'Slat screens',
    href: '/products/screens-walls/slat-screens',
    blurb:
      'give adjustable privacy and wind filtering while keeping airflow and daylight, helping decks feel more enclosed without losing openness.',
  },
  {
    id: 'acrylic-infill-panels',
    name: 'Acrylic infill panels',
    href: '/products/screens-walls/acrylic-infill-panels',
    blurb:
      'block wind and rain while preserving views and daylight so edges stay usable year‑round.',
  },
  {
    id: 'drop-down-blinds',
    name: 'Drop-down blinds',
    href: '/products/screens-walls/drop-down-blinds',
    blurb:
      'give on‑demand control of wind, rain and low sun. Fabrics range from clear PVC for weather blocking to open‑weave meshes that cut glare while keeping the view.',
  },
  {
    id: 'downlights',
    name: 'Downlights',
    href: '/products/lighting-heating/downlights',
    blurb:
      'provide even overhead lighting for dining and task zones so outdoor rooms stay usable after dark.',
  },
  {
    id: 'led-strip-lighting',
    name: 'LED strip lighting',
    href: '/products/lighting-heating/led-strip-lighting',
    blurb:
      'washes the pergola perimeter with a soft glow that defines edges, improves safety and adds ambience.',
  },
  {
    id: 'patio-heaters',
    name: 'Patio heaters',
    href: '/products/lighting-heating/patio-heaters',
    blurb:
      'deliver targeted warmth to seating areas so you can comfortably use the space through cooler evenings.',
  },
];

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
  // Only pergola products use the accordion layout; lighting/blinds/screens
  // use the simpler, non-accordion product details layout.
  const usesAccordionLayout = isGable || isPitched || isHip || isBox;
  const [zoomOpen, setZoomOpen] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);
  const leftScrollerRef = useRef<HTMLDivElement | null>(null);
  const rightScrollerRef = useRef<HTMLDivElement | null>(null);

  // Keep "all closed" layout class and left image stack in sync with the
  // accordion's open panel, without relying on DOM toggle events.
  const handleAccordionChange = (idx: number | null) => {
    if (!usesAccordionLayout) return;
    const main = mainRef.current;
    if (!main) return;
    const container = main.querySelector('.product-long');
    if (!container) return;

    if (idx === null) {
      main.classList.add('is-all-closed');
      return;
    }

    main.classList.remove('is-all-closed');
    setActiveIdx(idx);

    const leftScroller = leftScrollerRef.current;
    if (!leftScroller) return;
    const grid = leftScroller.querySelector('.img-grid');
    const items = grid ? (Array.from(grid.children) as HTMLElement[]) : [];
    const target = items[idx];
    if (target) leftScroller.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
  };

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

  const headerContent = data ? (
    <>
      {usesAccordionLayout && (
        <Link href="/products" className="product-close" aria-label="Back to products">
          <span className="product-close__icon" aria-hidden="true" />
        </Link>
      )}
      <div className="product-kicker product-kicker--wipe">
        {data.section === 'Screens & walls' ? 'Slats & Screens' : data.section}
      </div>
      {(() => {
        const baseTitle = data.item.title.replace(/\s*→\s*$/, '');
        const cleaned = isGable ? baseTitle.replace(/\s*pergola\b/i, '').trim() : baseTitle;
        return <h1 className="product-title">{cleaned}</h1>;
      })()}
    </>
  ) : null;

  const header = headerContent ? (
    <div className="product-header">
      {headerContent}
    </div>
  ) : null;

  // Mobile-only header that appears above the image gallery for accordion layouts
  const mobileHeader = headerContent && usesAccordionLayout ? (
    <div className="product-header product-header--mobile">
      {headerContent}
    </div>
  ) : null;

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
            {mobileHeader}
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
          {usesAccordionLayout && (
            <div className="product-body product-body--fixed-header">
              {header}
            </div>
          )}
          <div className="product-right-scroller" ref={rightScrollerRef}>
            <div className="product-body">
            {!usesAccordionLayout && header}
            {!usesAccordionLayout && <p className="product-desc">{data.item.desc}</p>}
            {/* CTA buttons removed per request */}
            {usesAccordionLayout && structured ? (
              <div className="product-long">
                <Accordion
                  scrollBehavior={usesAccordionLayout ? 'sticky-panel' : 'default'}
                  onChange={handleAccordionChange}
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
                            <div className="product-design-description__why">
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
                          {(() => {
                            const roofInfillOptions = isPitched
                              ? structured.options?.slice(0, 3)
                              : structured.options?.filter(o => /roof|infill/i.test(o));
                            return roofInfillOptions?.length ? (
                            <div>
                              <ul>
                                {roofInfillOptions
                                  .map((it, i) => {
                                    if (isPitched && it.includes(':')) {
                                      const [label, ...rest] = it.split(':');
                                      const restText = rest.join(':').trim();
                                      return (
                                        <li key={i}>
                                          <strong>{label.trim()}</strong>
                                          {restText ? `: ${restText}` : null}
                                        </li>
                                      );
                                    }
                                    return <li key={i}>{it}</li>;
                                  })}
                              </ul>
                            </div>
                            ) : null;
                          })()}
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
                          <div>
                            <ul>
                              {nonPergolaExtras.map(extra => (
                                <li key={extra.id}>
                                  <Link href={extra.href}>
                                    <strong>{extra.name}</strong>
                                  </Link>{' '}
                                  {extra.blurb}
                                </li>
                              ))}
                            </ul>
                          </div>
                          {/* Non-roof options like lights/blinds */}
                          {(() => {
                            const nonRoofOptions = isPitched
                              ? structured.options?.slice(3)
                              : structured.options?.filter(o => !/roof|infill/i.test(o));
                            return nonRoofOptions?.length ? (
                            <div>
                              <ul>
                                {nonRoofOptions
                                  .map((it, i) => (
                                    <li key={i}>{it}</li>
                                  ))}
                              </ul>
                            </div>
                            ) : null;
                          })()}
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
                          <ul className="product-downloads">
                            <li>
                              <Link
                                href="/downloads/Sp-Portfolio.pdf"
                                className="product-download"
                                target="_blank"
                                rel="noreferrer"
                              >
                                <span className="product-download__icon" aria-hidden="true" />
                                <span className="product-download__body">
                                  <span className="product-download__title">Project Portfolio</span>
                                  <span className="product-download__desc">
                                    Finished pergola projects with photos and brief case notes.
                                  </span>
                                </span>
                              </Link>
                            </li>
                            <li>
                              <Link
                                href="/downloads/Sanctuary-Pergolas-Brochure.pdf"
                                className="product-download"
                                target="_blank"
                                rel="noreferrer"
                              >
                                <span className="product-download__icon" aria-hidden="true" />
                                <span className="product-download__body">
                                  <span className="product-download__title">Sanctuary Brochure</span>
                                  <span className="product-download__desc">
                                    Overview of pergola styles, options and finishes to share with clients.
                                  </span>
                                </span>
                              </Link>
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
