'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import './home.css';
import SpReveal from '@/components/SpReveal';

const featureItems = [
  'On-site 1–5 days',
  'Lead time ~6 weeks',
  'Engineered for wind',
  'Aluminium, powder-coated',
  '10-year warranty'
];

const processSteps = [
  {
    title: 'Enquiry',
    desc: 'Reach out by phone or email with your project.'
  },
  {
    title: 'Quick estimate',
    desc: 'We provide a ballpark based on size and style.'
  },
  {
    title: 'Site visit & design advice',
    desc: 'If the range suits, we visit, measure, and discuss how it will work best for your site.'
  },
  {
    title: 'Design sign-off',
    desc: 'We present a design for you to review and approve.'
  },
  {
    title: 'Deposit & scheduling',
    desc: 'Pay the deposit to secure your spot; typical lead time is 6–8 weeks.'
  },
  {
    title: 'On-site build',
    desc: 'We install your pergola on site, typically within 2–5 days.'
  }
];

// ~100‑word copy for each process step (aligned by index)
const copyTexts: string[] = [
  // Enquiry (~25–30 words)
  "Tell us how you use the space, share a few photos and rough sizes. We confirm feasibility, flag consent or engineering, and outline trade‑offs in daylight, heat, headroom and upkeep before booking a visit.",
  // Quick estimate
  "We price the best‑fit style from your photos and dimensions, including structure, roofing and options. We explain cost drivers and alternatives. If the numbers work, we book a measured visit to refine scope.",
  // Site visit & design advice
  "We measure carefully, consider sun, wind, eaves and access, test head heights and post locations, and review drainage. Samples show light. We sketch tweaks to balance function and appearance.",
  // Design sign-off
  "We deliver a clear design pack with drawings, key dimensions, beam sizes, roof fall and finishes. Lighting and screens are integrated. Approval locks scope for fabrication and a smooth installation.",
  // Deposit & scheduling
  "Your deposit secures a production slot and materials. Lead time is typically four to six weeks. We coordinate trades, share a pre‑start checklist, and confirm timing the week before.",
  // On-site build
  "We protect surfaces, set out posts and beams, check fixings, and seal the house junction correctly. Wiring is concealed where possible. Most installs finish in one to five days.",
];

export default function HomePage() {
  // Intro transition state (homepage only)
  const [showIntroContact, setShowIntroContact] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [revealImages, setRevealImages] = useState(false);
  const [introContactIn, setIntroContactIn] = useState(false);
  const [titleIn, setTitleIn] = useState(false);
  const [contactIn, setContactIn] = useState(false);
  // Track load state for pitched product image so we can animate it in after other content is ready
  const [pitchedLoaded, setPitchedLoaded] = useState(false);
  // Mobile hero load state (product-pitched-01)
  const [mobileHeroLoaded, setMobileHeroLoaded] = useState(false);

  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const contactRef = useRef<HTMLDivElement | null>(null);
  const processWrapRef = useRef<HTMLDivElement | null>(null);
  const stepElsRef = useRef<Array<HTMLDivElement | null>>([]);
  const [activeStep, setActiveStep] = useState(1);
  const [copyStep, setCopyStep] = useState(1);
  const [copyVisible, setCopyVisible] = useState(true);
  // no explicit box visibility/positioning needed; handled in CSS with --railCenter

  useEffect(() => {
    document.body.classList.add('homepage');
    // Ensure we start exactly at top on desktop to avoid visual offset
    try {
      if (typeof window !== 'undefined' && window.matchMedia('(min-width: 961px)').matches) {
        requestAnimationFrame(() => {
          // Run after layout
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
          // Fallbacks for some browsers
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        });
      }
    } catch {}
    return () => {
      document.body.classList.remove('homepage');
    };
  }, []);

  // Delay showing copy by 0.5s on step change, with 0.25s fade in/out handled in CSS
  useEffect(() => {
    setCopyVisible(false); // fade out immediately
    const to = window.setTimeout(() => {
      setCopyStep(activeStep);
      setCopyVisible(true); // fade in
    }, 500);
    return () => window.clearTimeout(to);
  }, [activeStep]);

  useEffect(() => {
    const zone = document.getElementById('feature-zone');
    const bar = document.getElementById('feature-bar');
    const hero = document.querySelector('.hero');
    const products = document.getElementById('products');
    if (!zone || !bar || !hero || !products) return;

    const sizeZone = () => {
      const cs = getComputedStyle(bar);
      // If the bar is hidden (mobile), collapse the zone height to 0 to disable the effect cleanly
      if (cs.display === 'none' || bar.offsetHeight === 0) {
        zone.style.height = '0px';
        return;
      }
      const h = bar.offsetHeight;
      bar.style.setProperty('--barH', `${h}px`);
      const rs = getComputedStyle(document.documentElement);
      const mult = parseFloat(rs.getPropertyValue('--slowMult')) || 10;
      zone.style.height = `${h * mult}px`;
    };

    const apply = (p: number) => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const off = vh * 1.1;
      hero.setAttribute('style', `transform:translate3d(0, ${-(p * off)}px, 0)`);
      products.setAttribute('style', `transform:translate3d(0, ${p * off}px, 0)`);
    };

    let progress = 0;
    let lastZoneCenterY: number | null = null;
    let ticking = false;

    const compute = () => {
      const zoneRect = zone.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const center = zoneRect.top + zoneRect.height / 2;
      const lower = vh / 3;
      const upper = (2 * vh) / 3;
      const mid = (lower + upper) / 2;
      const half = (upper - lower) / 2;

      let target = 0;
      const d = Math.abs(center - mid);
      if (d < half) target = 1 - d / half;

      let delta = 0;
      if (lastZoneCenterY !== null) delta = Math.abs(center - lastZoneCenterY);
      lastZoneCenterY = center;

      const step = delta / Math.max(1, zoneRect.height);
      if (progress < target) progress = Math.min(target, progress + step);
      else if (progress > target) progress = Math.max(target, progress - step);

      apply(progress);
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          compute();
          ticking = false;
        });
        ticking = true;
      }
    };

    sizeZone();
    // Only compute/apply transforms if the zone is active (not hidden)
    if (zone.clientHeight > 0) {
      compute();
    }

    window.addEventListener('resize', sizeZone);
    if (zone.clientHeight > 0) {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
    }

    return () => {
      window.removeEventListener('resize', sizeZone);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // Run the requested homepage intro sequence on mount
  useEffect(() => {

    // 1) Contact info slides up and settles one gutter from bottom (0.5s)
    setShowIntroContact(true);
    // Trigger CSS transition on next frame
    requestAnimationFrame(() => setIntroContactIn(true));
    // H1/hero contact fade-in handled by IntersectionObserver below
    const contactTimer = window.setTimeout(() => {
      setIntroContactIn(false);
      setShowIntroContact(false);

      // 2) Progress counter 0% -> 100%
      setShowProgress(true);
      const duration = 1100; // ms
      const start = performance.now();
      const tick = (now: number) => {
        const pct = Math.min(100, Math.round(((now - start) / duration) * 100));
        setProgress(pct);
        if (pct < 100) requestAnimationFrame(tick);
        else {
          setShowProgress(false);
          // 3) Wipe reveal from bottom to top
          setRevealImages(true);
        }
      };
      requestAnimationFrame(tick);
    }, 500);

    return () => {
      window.clearTimeout(contactTimer);
    };
  }, []);

  // Fade-in when elements enter the viewport
  useEffect(() => {
    const titleEl = titleRef.current;
    const contactEl = contactRef.current;
    if (!titleEl && !contactEl) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target === titleEl) setTitleIn(true);
            if (entry.target === contactEl) setContactIn(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (titleEl) io.observe(titleEl);
    if (contactEl) io.observe(contactEl);

    return () => io.disconnect();
  }, []);

  // Process rail + active step detection (no floating number box)
  useEffect(() => {
    const compute = () => {
      const wrap = processWrapRef.current;
      const els = stepElsRef.current.filter(Boolean) as HTMLElement[];
      if (!wrap || !els.length) return;

      // Determine if viewport center lies within the process section
      const wr = wrap.getBoundingClientRect();
      const vpCenter = window.innerHeight / 2;
      // Expose container-left CSS var for spacing only
      wrap.style.setProperty('--processLeft', `${Math.round(wr.left)}px`);

      // Compute step anchors: prefer each card's title center when available
      const centers = els.map((el) => {
        const title = el.querySelector<HTMLElement>('.step-title');
        if (title) {
          const tr = title.getBoundingClientRect();
          return tr.top + tr.height / 2;
        }
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2;
      });
      const firstCy = centers[0];
      const lastCy = centers[centers.length - 1];

      // Clamp the virtual target Y between first/last step centers, else follow viewport center
      const rawY = vpCenter;
      const clampedY = Math.max(Math.min(rawY, lastCy), firstCy);

      // Update number based on nearest center to the box
      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      centers.forEach((cy, i) => {
        const d = Math.abs(cy - clampedY);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      setActiveStep(best + 1);
    };
    compute();
    // Run on scroll/resize
    window.addEventListener('scroll', compute, { passive: true });
    window.addEventListener('resize', compute, { passive: true });
    // Also run on every animation frame while the section is visible so fast scrolls never skip
    let rafId = 0;
    const rafLoop = () => {
      const wrap = processWrapRef.current;
      if (wrap) {
        const r = wrap.getBoundingClientRect();
        const h = window.innerHeight || document.documentElement.clientHeight;
        if (r.top < h && r.bottom > 0) compute();
      }
      rafId = window.requestAnimationFrame(rafLoop);
    };
    rafId = window.requestAnimationFrame(rafLoop);
    return () => {
      window.removeEventListener('scroll', compute);
      window.removeEventListener('resize', compute);
      try { window.cancelAnimationFrame(rafId); } catch {}
    };
  }, []);

  return (
    <div className="homepage">
      <main>
        <section className="container hero" id="top">
          {showIntroContact && (
            <div className={`intro-contact ${introContactIn ? 'show' : ''}`} aria-hidden="true">
              <div>
                <div className="label">Phone</div>
                <a href="tel:+6496349482">+64 9 634 9482</a>
              </div>
              <div>
                <div className="label">Email</div>
                <a href="mailto:info@sanctuarypergolas.co.nz">info@sanctuarypergolas.co.nz</a>
              </div>
            </div>
          )}
          <div className="split">
            <div className="hero-left-grid">
              <div className="hero-top">
                <div className="hero-info">
                  <h1 ref={titleRef} className={`hero-title ${titleIn ? 'in' : ''}`}>
                    Architectural pergolas<br />
                    <span className="muted-line">tailored to kiwi homes.</span>
                  </h1>
                  {/* removed per request: subhead text */}
                </div>
                <div ref={contactRef} className={`hero-contact ${contactIn ? 'in' : ''}`}>
                  <div>
                    <div className="label">Phone</div>
                    <a href="tel:+6496349482">+64 9 634 9482</a>
                  </div>
                  <div>
                    <div className="label">Email</div>
                    <a href="mailto:info@sanctuarypergolas.co.nz">info@sanctuarypergolas.co.nz</a>
                  </div>
                </div>
              </div>
              {/* Mobile-only hero image (product-pitched-01) */}
              <div className={`mobile-hero ${mobileHeroLoaded && revealImages ? 'reveal' : ''}`}>
                <div className="wipe-inner">
                  <Image
                    src="/images/product-pitched-01.jpg"
                    alt="Pitched pergola hero"
                    fill
                    priority
                    sizes="100vw"
                    style={{ objectFit: 'cover' }}
                    onLoadingComplete={() => setMobileHeroLoaded(true)}
                  />
                </div>
              </div>
              <div className={`hero-card ${revealImages ? 'reveal' : ''}`}>
                <div className="wipe-inner">
                  <Image
                    src="/images/hero-1.jpg"
                    alt="Custom aluminium pergola at a modern home"
                    width={800}
                    height={600}
                    priority
                    sizes="(max-width: 960px) 100vw, 50vw"
                  />
                  <Link href="/projects" className="image-cta">Our Projects</Link>
                </div>
                {showProgress && <div className="intro-progress">{progress}%</div>}
              </div>
            </div>
            <div className={`hero-right ${revealImages ? 'reveal' : ''}`}>
              <div className="wipe-inner">
                <Image
                  src="/images/hero-2.jpg"
                  alt="Aluminium pergola over outdoor seating area"
                  width={800}
                  height={600}
                  priority
                  sizes="(max-width: 960px) 100vw, 50vw"
                />
                <Link href="/products" className="image-cta">Explore Products</Link>
              </div>
            </div>
          </div>
        </section>

        <div id="gallery" aria-hidden="true" />

        <div className="feature-zone" id="feature-zone">
          <div className="feature-bar" id="feature-bar" aria-label="Key features">
            <div className="container" role="list">
              {featureItems.map(item => (
                <span className="dot" role="listitem" key={item}>{item}</span>
              ))}
            </div>
          </div>
        </div>

        <section className="container" id="products">
          <div className="section-title"><h2>Products</h2></div>
          <div className="products-grid">
            <Link className="tile" href="/products/pergolas/pitched">
              <p className="k">Pergolas</p>
              <h3 className="t">Pitched pergola</h3>
              <div className={`m pitched ${pitchedLoaded && revealImages ? 'in' : ''}`}>
                <Image
                  src="/images/product-pitched-01.jpg"
                  alt="Pitched pergola"
                  fill
                  sizes="(max-width: 1280px) 33vw, (max-width: 1024px) 50vw, 25vw"
                  style={{ objectFit: 'cover' }}
                  onLoadingComplete={() => setPitchedLoaded(true)}
                />
              </div>
            </Link>
            <Link className="tile" href="/products/pergolas/gable">
              <p className="k">Pergolas</p>
              <h3 className="t">Gable pergola</h3>
              <div className="m">
                <Image
                  src="/images/product-gable-01.jpg"
                  alt="Gable pergola"
                  fill
                  sizes="(max-width: 1280px) 33vw, (max-width: 1024px) 50vw, 25vw"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            </Link>
            <Link className="tile" href="/products/pergolas/hip">
              <p className="k">Pergolas</p>
              <h3 className="t">Hip pergola</h3>
              <div className="m">
                <Image
                  src="/images/product-hip-01.jpg"
                  alt="Hip pergola"
                  fill
                  sizes="(max-width: 1280px) 33vw, (max-width: 1024px) 50vw, 25vw"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            </Link>
            <Link className="tile viewall" href="/products" aria-label="View full range">
              <p className="k">.</p>
              <h3 className="t">.</h3>
              <div className="m">
                <div className="cta-box"><div className="cta-title">View<br />full range</div></div>
              </div>
            </Link>
          </div>
        </section>

        {/* Word-by-word statement section (after product tiles) */}
        <SpReveal
          id="sp-reveal-1"
          sentence="A space to pause, gather, and breathe—crafted for calm in every line and surface."
          holdFrac={0.8}
          scrollSpan="400vh"
          images={["/images/project-dairy-flat-01.jpg", "/images/project-waiheke-02.jpg", "/images/product-pitched-06.jpg"]}
          imageAlt="Project images"
          style={{ '--sp-gutter': 'clamp(16px, 2.8vw, 40px)', '--sp-size': 'clamp(35px, 5.12vw, 70px)' }}
        />

        <section className="container" id="process">
          <div className="process-wrap process-3col" ref={processWrapRef}>
            <div className="process-col col-num">
              <div className="col-num__stick"><div className="big-num" aria-hidden>{activeStep}</div></div>
            </div>
            <div className="process-col col-steps">
              <div className="steps-grid" role="list">
              {processSteps.map((step, i) => (
                <div
                  className={`step-card ${activeStep === i + 1 ? 'is-active' : ''}`}
                  role="listitem"
                  key={step.title}
                  ref={(el) => { stepElsRef.current[i] = el; }}
                >
                  <div className="step-num" aria-hidden>{String(i + 1).padStart(2, '0')}</div>
                  <div className="step-copy">
                    <h3 className="step-title">{step.title}</h3>
                    <p className="step-desc">{step.desc}</p>
                  </div>
                </div>
              ))}
              </div>
            </div>
            <div className="process-col col-copy">
              <div className="copy-stick">
                <div className={`copy-panel ${copyVisible ? 'in' : ''}`}>
                  <p>{copyTexts[copyStep - 1]}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container" id="quote">
          <div className="section-title"><h2>Start your project</h2></div>
          <p>Call <a href="tel:+6496349482">+64 9 634 9482</a> or email <a href="mailto:info@sanctuarypergolas.co.nz">info@sanctuarypergolas.co.nz</a> to book a site visit.</p>
        </section>
      </main>
    </div>
  );
}
