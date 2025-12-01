'use client';

import { useEffect, useRef, useState } from 'react';
import type { ProcessStep } from '@/components/home/HomePageClient';

type HomeProcessSectionProps = {
  processSteps: ProcessStep[];
  copyTexts: string[];
};

export default function HomeProcessSection({
  processSteps,
  copyTexts,
}: HomeProcessSectionProps) {
  const processWrapRef = useRef<HTMLDivElement | null>(null);
  const stepElsRef = useRef<Array<HTMLDivElement | null>>([]);
  const [activeStep, setActiveStep] = useState(1);
  const [copyStep, setCopyStep] = useState(1);
  const [mobileOpenStep, setMobileOpenStep] = useState<number | null>(null);
  const [copyVisible, setCopyVisible] = useState(true);
  const ioSeenRef = useRef<Set<number>>(new Set());
  const scrollGateRef = useRef(false);

  // Delay showing copy by 0.5s on step change, with 0.25s fade in/out handled in CSS
  useEffect(() => {
    setCopyVisible(false);
    const to = window.setTimeout(() => {
      setCopyStep(activeStep);
      setCopyVisible(true);
    }, 500);
    return () => window.clearTimeout(to);
  }, [activeStep]);

  const handleMobileStepToggle = (stepIndex: number) => {
    setMobileOpenStep((current) => (current === stepIndex ? null : stepIndex));
  };

  // Process rail vars + IO-based active step detection
  useEffect(() => {
    const computeVars = () => {
      if (scrollGateRef.current) return;
      const wrap = processWrapRef.current;
      const els = stepElsRef.current.filter(Boolean) as HTMLElement[];
      if (!wrap || !els.length) return;

      const wr = wrap.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (wr.bottom <= 0 || wr.top >= vh) return;

      wrap.style.setProperty('--lineTopPx', `${Math.round(wr.top)}px`);

      try {
        const numCol = wrap.querySelector<HTMLElement>('.col-num');
        if (numCol) {
          const nr = numCol.getBoundingClientRect();
          document.documentElement.style.setProperty('--railX', `${Math.round(nr.right)}px`);
        }
        const head = document.querySelector<HTMLElement>('section.process-head');
        if (head) {
          const hr = head.getBoundingClientRect();
          document.documentElement.style.setProperty('--headLeft', `${Math.round(hr.left)}px`);
        }
      } catch {}

      wrap.style.setProperty('--processLeft', `${Math.round(wr.left)}px`);
    };

    let ticking = false;
    const schedule = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(() => {
          ticking = false;
          computeVars();
        });
      }
    };

    computeVars();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    const els = stepElsRef.current.filter(Boolean) as HTMLElement[];
    const seen = ioSeenRef.current;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const idx = Math.max(0, els.indexOf(e.target as HTMLElement));
        if (e.isIntersecting) seen.add(idx);
        else seen.delete(idx);
      });
      if (!seen.size) return;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const mid = vh / 2;
      let best = -1;
      let bestDist = Number.POSITIVE_INFINITY;
      seen.forEach((i) => {
        const r = els[i].getBoundingClientRect();
        const cy = r.top + r.height / 2;
        const d = Math.abs(cy - mid);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      if (best >= 0 && best !== (activeStep - 1)) setActiveStep(best + 1);
    }, { root: null, rootMargin: '-45% 0px -45% 0px', threshold: 0 });

    els.forEach((el) => io.observe(el));

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      try {
        io.disconnect();
      } catch {}
    };
  }, [activeStep]);

  return (
    <>
      <section className="container process-head" aria-label="Process heading">
        <div className="process-head__inner">
          <h2 className="process-head__title">The Sanctuary Process</h2>
        </div>
      </section>

      <section className="container" id="process">
        <div className="process-wrap process-3col" ref={processWrapRef}>
          <div className="process-col col-num">
            <div className="col-num__stick">
              <div className="big-num" aria-hidden>
                {activeStep}
              </div>
            </div>
          </div>
          <div className="process-col col-steps">
            <div className="steps-grid" role="list">
              {processSteps.map((step, i) => (
                <div
                  className={`step-card ${activeStep === i + 1 ? 'is-active' : ''}`}
                  role="listitem"
                  key={step.title}
                  ref={(el) => {
                    stepElsRef.current[i] = el;
                  }}
                >
                  <div className="step-num" aria-hidden>
                    {String(i + 1).padStart(2, '0')}
                  </div>
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

        <div className="process-mobile" aria-label="The Sanctuary Process (mobile)">
          <div className="process-mobile__list" role="list">
            {processSteps.map((step, i) => {
              const stepIndex = i + 1;
              const isOpen = mobileOpenStep === stepIndex;
              return (
                <details
                  key={step.title}
                  className="process-mobile__item"
                  open={isOpen}
                  role="listitem"
                >
                  <summary
                    className="process-mobile__summary"
                    onClick={(e) => {
                      e.preventDefault();
                      handleMobileStepToggle(stepIndex);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleMobileStepToggle(stepIndex);
                      }
                    }}
                  >
                    <div className="process-mobile__summary-main">
                      <div className="process-mobile__num" aria-hidden>
                        {String(stepIndex).padStart(2, '0')}
                      </div>
                      <div className="process-mobile__text">
                        <h3 className="process-mobile__title">{step.title}</h3>
                        <p className="process-mobile__desc">{step.desc}</p>
                      </div>
                    </div>
                    <span className="accordion__icon" aria-hidden="true" />
                  </summary>
                  <div className="process-mobile__panel">
                    <p className="process-mobile__copy">{copyTexts[i]}</p>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
