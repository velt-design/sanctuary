'use client';

import Image from 'next/image';
import { useMemo, useState, useEffect, useRef } from 'react';
import '@/app/products/product.css';
import '@/app/contact/dark.css';
import '@/app/contact/spacing.css';

const PERGOLA_OPTIONS = ['Pitched pergola', 'Gable pergola', 'Hip pergola', 'Perimeter pergola'];
const DISPLAY_STYLE_OPTS = PERGOLA_OPTIONS
  .map(s => s.replace(/\s*pergola$/i, ''))
  .map(s => s.replace(/^Box\s+Perimeter\b/i, 'Perimeter'));

export default function ContactPage() {
  const [width, setWidth] = useState(6.0);
  const [length, setLength] = useState(3.0);
  const [height, setHeight] = useState(2.5);
  // Enquiry type (single select)
  type EnquiryType = 'Residential' | 'Commercial' | 'Professional';
  const [enquiryType, setEnquiryType] = useState<EnquiryType | null>(null);
  const [enquiryExpanded, setEnquiryExpanded] = useState(true);
  const [enquiryRevealed, setEnquiryRevealed] = useState(false);
  // Delay the reveal so the selected enquiry toggle has time to animate
  const REVEAL_DELAY_MS = 650;
  const HIDE_AFTER_OPEN_MS = 200;
  const revealTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const clearRevealTimer = () => {
    if (revealTimerRef.current !== null){
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  };
  const clearHideTimer = () => {
    if (hideTimerRef.current !== null){
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };
  const scheduleReveal = () => {
    clearRevealTimer();
    revealTimerRef.current = window.setTimeout(() => {
      // Collapse the enquiry header and reveal the controls together
      setEnquiryExpanded(false);
      setEnquiryRevealed(true);
    }, REVEAL_DELAY_MS);
  };
  const scheduleHideAfterFade = () => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setEnquiryRevealed(false);
    }, HIDE_AFTER_OPEN_MS);
  };
  
  // Vertical sliders replacing dial
  const STYLE_OPTS = DISPLAY_STYLE_OPTS;
  // Only two roof options: Acrylic and Timber (keep UI size unchanged)
  const ROOF_OPTS = ['Acrylic', 'Timber'];
  const ADDON_OPTS = ['Blinds', 'Slats', 'Lighting', 'Heating'];
  // Style slider: discrete options with magnetic snapping
  const [stylePos, setStylePos] = useState(0); // raw float 0..(n-1)
  const styleIdx = Math.max(0, Math.min(STYLE_OPTS.length-1, Math.round(stylePos)));
  const [styleTouched, setStyleTouched] = useState(false);
  const setStyleIdxLoop = (i:number) => { setStyleTouched(true); setStylePos(Math.max(0, Math.min(STYLE_OPTS.length-1, i))); };
  const styleOpacity = (i:number)=>{ const a = styleIdx, n = STYLE_OPTS.length; const d = Math.min((i-a+n)%n,(a-i+n)%n); return d===0?1:d===1?0.55:0.28; };
  // Roof checkboxes
  const [roofSelected, setRoofSelected] = useState<string[]>([]);
  const [addonsSelected, setAddonsSelected] = useState<string[]>([]);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userSuburb, setUserSuburb] = useState('');
  const [notes, setNotes] = useState('');
  const [userCompany, setUserCompany] = useState('');
  // Professional enquiry: drag-and-drop files UI state
  const [proFiles, setProFiles] = useState<File[]>([]);
  const [proDragOver, setProDragOver] = useState(false);
  const proFileInputRef = useRef<HTMLInputElement | null>(null);
  // Track if user interacted with sliders
  const [widthTouched, setWidthTouched] = useState(false);
  const [lengthTouched, setLengthTouched] = useState(false);
  const [heightTouched, setHeightTouched] = useState(false);
  // Fit text scaling for roof list in display box
  const roofContainerRef = useRef<HTMLDivElement>(null);
  const roofTextRef = useRef<HTMLSpanElement>(null);
  const [roofScale, setRoofScale] = useState(1);
  // Fit text scaling for add-ons list in display box
  const addonsContainerRef = useRef<HTMLDivElement>(null);
  const addonsTextRef = useRef<HTMLSpanElement>(null);
  const [addonsScale, setAddonsScale] = useState(1);
  // Submit state
  const [submitState, setSubmitState] = useState<'idle'|'sending'|'success'|'error'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const proAttachmentsSummary = useMemo(() => {
    if (!proFiles.length) return '';
    const MAX_LISTED = 5;
    const listed = proFiles.slice(0, MAX_LISTED);
    const moreCount = proFiles.length - listed.length;
    const parts = listed.map((file) => {
      const kb = file.size / 1024;
      const sizeLabel = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
      return `${file.name} (${sizeLabel})`;
    });
    if (moreCount > 0) {
      parts.push(`+${moreCount} more file(s)`);
    }
    return parts.join('; ');
  }, [proFiles]);

  // Analytics helper (GA4 via window.gtag, if configured)
  type GtagFn = (...args: any[]) => void;
  const trackSubmitEvent = (phase:'start'|'success'|'error', extra?:Record<string, unknown>) => {
    if (typeof window === 'undefined') return;
    const gtag = (window as typeof window & { gtag?: GtagFn }).gtag;
    if (typeof gtag !== 'function') return;
    const base = {
      event_category: 'contact',
      event_label: enquiryType ?? 'Unknown',
      enquiry_type: enquiryType ?? 'Unknown',
      roof_count: roofSelected.length,
      addons_count: addonsSelected.length,
    };
    try {
      gtag('event', `contact_${phase}`, { ...base, ...extra });
    } catch {
      // Fail silently – analytics should never break form submission
    }
  };

  // Pick a preview image based on style selection
  const previewImg = useMemo(() => {
    const sel = STYLE_OPTS[styleIdx]?.toLowerCase();
    if (sel?.includes('pitched')) return '/assets/pitched.jpg';
    if (sel?.includes('gable')) return '/assets/gable.jpg';
    if (sel?.includes('hip')) return '/assets/hip.jpg';
    if (sel?.includes('perimeter')) return '/assets/pitched.jpg';
    return '/assets/hero-left.jpg';
  }, [styleIdx, STYLE_OPTS]);

  const showCustomerInfo = enquiryType === 'Residential' || enquiryType === 'Commercial';
  // Recompute roof text scale when it or layout changes
  const roofKey = roofSelected.join(',');
  const addonsKey = addonsSelected.join(',');
  useEffect(() => {
    const measure = () => {
      // Roof
      const rC = roofContainerRef.current; const rT = roofTextRef.current;
      if (rC && rT) {
        rT.style.whiteSpace = 'nowrap';
        const textW = rT.scrollWidth || 0; const boxW = rC.clientWidth || 0;
        setRoofScale(boxW > 0 && textW > 0 ? Math.min(1, boxW / textW) : 1);
      }
      // Add-ons
      const aC = addonsContainerRef.current; const aT = addonsTextRef.current;
      if (aC && aT) {
        aT.style.whiteSpace = 'nowrap';
        const textW = aT.scrollWidth || 0; const boxW = aC.clientWidth || 0;
        setAddonsScale(boxW > 0 && textW > 0 ? Math.min(1, boxW / textW) : 1);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [roofKey, addonsKey]);
  const enquiryPicked = enquiryType !== null;
  const enquiryChoosing = enquiryType !== null && enquiryExpanded;
  // Reveal state shared across mid content variants
  const revealReady = enquiryRevealed && !enquiryExpanded;
  // Keep the mid-controls container (for the top rule) whenever any mid content is present
  const hasMidContent = ((enquiryType === 'Professional') || showCustomerInfo) && revealReady;
  // Generic sliders/options only show for Residential/Commercial
  const showGenericMidControls = showCustomerInfo && revealReady;
  // Right column (inputs) should hide while enquiry header is open and only show after reveal
  const showRightControlsCustomer = showCustomerInfo && enquiryRevealed && !enquiryExpanded;

  // Slider ranges depend on enquiry type
  const widthMin = 1;
  const widthMax = 10; // Always 10 per requirements
  const lengthMin = 1;
  const lengthMax = enquiryType === 'Commercial' ? 10 : 6; // Commercial gets 10m max, Residential keeps 6m
  const heightMin = enquiryType === 'Residential' ? 1.5 : 2;
  const heightMax = enquiryType === 'Residential' ? 4.0 : 6;

  // Defaults when switching types
  const defaultsCommercial = { width: 8.0, length: 4.0, height: 3.5 } as const;

  // Clamp helper
  const clamp = (v:number, min:number, max:number) => Math.max(min, Math.min(max, v));

  // When enquiry type changes, set defaults (commercial) or clamp values (residential)
  useEffect(() => {
    if (!enquiryType) return;
    if (enquiryType === 'Commercial') {
      // Apply commercial defaults if untouched; otherwise clamp to new bounds
      setWidth(prev => widthTouched ? clamp(prev, widthMin, widthMax) : defaultsCommercial.width);
      setLength(prev => lengthTouched ? clamp(prev, lengthMin, lengthMax) : defaultsCommercial.length);
      setHeight(prev => heightTouched ? clamp(prev, heightMin, heightMax) : defaultsCommercial.height);
    } else if (enquiryType === 'Residential') {
      // Keep defaults; only clamp to residential ranges
      setWidth(prev => clamp(prev, widthMin, widthMax));
      setLength(prev => clamp(prev, lengthMin, lengthMax));
      setHeight(prev => clamp(prev, heightMin, heightMax));
    } else {
      // Professional: keep current values but ensure within general bounds
      setWidth(prev => clamp(prev, widthMin, widthMax));
      setLength(prev => clamp(prev, lengthMin, 6));
      setHeight(prev => clamp(prev, 2, 6));
    }
  }, [enquiryType]);

  // Helper to select an enquiry type with a delayed reveal
  const chooseEnquiry = (type: EnquiryType) => {
    // If choosing the same type again, still replay the transition
    setEnquiryType(type);
    // Keep the enquiry header open so the toggle animation is visible
    setEnquiryExpanded(true);
    setEnquiryRevealed(false);
    scheduleReveal();
  };

  // Toggle enquiry header open/closed; hide content when opened, show after wipe when closed
  const toggleEnquiryHeader = () => {
    if (!enquiryType){
      setEnquiryExpanded(true);
      return;
    }
    setEnquiryExpanded((open) => {
      const next = !open;
      if (next){
        // Opening: stop any pending reveal, then hide content after the left image fade completes
        clearRevealTimer();
        scheduleHideAfterFade();
      } else {
        // Closing: cancel any pending hide and reveal content after the delay
        clearHideTimer();
        scheduleReveal();
      }
      return next;
    });
  };

  // Cleanup timer on unmount
  useEffect(() => () => {
    clearRevealTimer();
    clearHideTimer();
  }, []);

  const submitForm = async (form: HTMLFormElement | null) => {
    if (!form) return;
    if (submitState === 'sending') return;
    setSubmitError(null);
    setSubmitState('sending');
    trackSubmitEvent('start');
    try {
      // Build the payload from React state rather than relying on browser
      // form serialization. This avoids mobile-browsers quirks with
      // externally-associated controls and ensures a single canonical
      // value for each field.
      const fd = new FormData();
      // Core contact details
      fd.set('name', userName);
      fd.set('email', userEmail);
      if (userSuburb) fd.set('suburb', userSuburb);
      if (notes) fd.set('message', notes);
      if (userCompany) fd.set('company', userCompany);
      // Dimensional + options
      fd.set('width_m', width.toFixed(1));
      fd.set('length_m', length.toFixed(1));
      fd.set('height_m', height.toFixed(1));
      fd.set('style', STYLE_OPTS[styleIdx]);
      fd.set('roof', roofSelected.join(', '));
      fd.set('addons', addonsSelected.join(', '));
      fd.set('attachments', proAttachmentsSummary);
      // Legacy flags + typed enquiry label
      fd.set('is_homeowner', enquiryType === 'Residential' ? '1' : '0');
      fd.set('is_professional', enquiryType === 'Professional' ? '1' : '0');
      fd.set('enquiry_type', enquiryType ?? '');
      // Honeypot field for bots (left empty intentionally)
      fd.set('website', '');
      // Attach professional enquiry files so the API can send them on.
      if (enquiryType === 'Professional' && proFiles.length) {
        proFiles.forEach((file) => {
          fd.append('pro_attachments', file);
        });
      }
      const res = await fetch('/api/contact', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({ ok: res.ok }));
      if (res.ok && json?.ok) {
        setSubmitState('success');
        trackSubmitEvent('success');
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
      } else {
        setSubmitState('error');
        setSubmitError(json?.error || 'Unable to send. Please email us directly.');
        trackSubmitEvent('error', { status: res.status, error: json?.error || 'unknown' });
      }
    } catch {
      setSubmitState('error');
      setSubmitError('Something went wrong. Please try again.');
      trackSubmitEvent('error', { error: 'network' });
    }
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    await submitForm(e.currentTarget);
  };

  const isSending = submitState === 'sending';
  const isSubmitted = submitState === 'success';
  const sendLabel =
    submitState === 'sending' ? 'SENDING…' :
    submitState === 'success' ? 'SENT' :
    'SEND';

  const handleClickSend: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    submitForm(formRef.current);
  };

  return (
    <main className={`two-col-page contact-page contact-dark ${showCustomerInfo ? 'customer-on' : 'customer-off'} ${enquiryPicked ? 'enquiry-picked' : ''} ${enquiryChoosing ? 'enquiry-choosing' : ''} ${enquiryRevealed ? 'enquiry-revealed' : ''} ${isSubmitted ? 'contact-submitted' : ''}`}>
      <form ref={formRef} id="contact-form" method="post" action="/api/contact" onSubmit={handleSubmit}>
        <div className="product-split max-w-screen-xl mx-auto px-8 pt-10 pb-2 md:pb-3 lg:pb-4 grid grid-cols-1 lg:grid-cols-[1fr_1px_1fr_1px_1fr] items-stretch gap-y-[var(--vgap)] lg:gap-y-[var(--vgap)] gap-x-[var(--gap)]">
        {/* Left column (keeps its space; content hides on submit) */}
        <div className="col-span-1 relative h-full">
          <div className="hw-tile contact-media" style={{height:'100%'}}>
            {!isSubmitted && (
              <>
                <div className="contact-media__placeholder" aria-hidden={enquiryPicked}>
                  <span>1</span>
                </div>
                <div className="contact-media__img">
                  <Image src={previewImg} alt="Pergola example" fill sizes="(max-width: 960px) 100vw, 33vw" style={{ objectFit: 'cover' }} priority={false} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Rule 1 */}
        <div aria-hidden className="hidden lg:block bg-neutral-600/80 w-px h-full self-stretch" />

        {/* Middle column */}
        <div className="contact-mid grid gap-y-[var(--vgap)]">
          <div className="contact-mid__intro grid gap-y-[var(--vgap)]">
            <h1 className="product-title text-3xl lg:text-4xl font-semibold">Start your project</h1>
            <div className="contact-info text-sm">
              <div><strong>Phone</strong> <a href="tel:+6496349482">+64 9 634 9482</a></div>
              <div><strong>Email</strong> <a href="mailto:info@sanctuarypergolas.co.nz">info@sanctuarypergolas.co.nz</a></div>
            </div>

            <div className={`enquiry-block ${enquiryExpanded ? 'open' : 'closed'}`}>
              <button
                type="button"
                className={`enquiry-header ${enquiryExpanded ? 'open' : ''}`}
                aria-expanded={enquiryExpanded}
                onClick={toggleEnquiryHeader}
              >
                <span className="enquiry-header__text">{(!enquiryType || enquiryExpanded) ? 'Which best describes your enquiry' : `${enquiryType} Enquiry`}</span>
                <span className="enquiry-header__chev" aria-hidden="true" />
              </button>

              {(enquiryExpanded || !enquiryType) && (
                <div className="big-choices">
                  <div className="big-choice">
                    <div className="big-choice__label">Residential</div>
                    <button type="button" className={`toggle ${enquiryType === 'Residential' ? 'on' : ''}`} aria-label={enquiryType === 'Residential' ? 'Selected' : 'Select Residential'} aria-pressed={enquiryType === 'Residential'} onClick={()=> chooseEnquiry('Residential')} />
                  </div>
                  <div className="big-choice">
                    <div className="big-choice__label">Commercial</div>
                    <button type="button" className={`toggle ${enquiryType === 'Commercial' ? 'on' : ''}`} aria-label={enquiryType === 'Commercial' ? 'Selected' : 'Select Commercial'} aria-pressed={enquiryType === 'Commercial'} onClick={()=> chooseEnquiry('Commercial')} />
                  </div>
                  <div className="big-choice">
                    <div className="big-choice__label">Professional</div>
                    <button type="button" className={`toggle ${enquiryType === 'Professional' ? 'on' : ''}`} aria-label={enquiryType === 'Professional' ? 'Selected' : 'Select Professional'} aria-pressed={enquiryType === 'Professional'} onClick={()=> chooseEnquiry('Professional')} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile-only customer flow: Name → Email → Suburb → sliders → Style → Roof → Add ons → Message → SEND */}
          {showRightControlsCustomer && !isSubmitted ? (
            <section className="contact-mobile space-y-3">
              {/* Name / Email / Suburb */}
              <div className="hw-tile">
                <input
                  name="name"
                  placeholder="Name"
                  required
                  className="input input--tile"
                  onChange={(e)=>setUserName(e.target.value)}
                />
              </div>
              <div className="hw-tile">
                <input
                  name="email"
                  type="email"
                  placeholder="Email"
                  required
                  className="input input--tile"
                  onChange={(e)=>setUserEmail(e.target.value)}
                />
              </div>
              <div className="hw-tile">
                <input
                  name="suburb"
                  placeholder="Suburb"
                  className="input input--tile"
                  onChange={(e)=>setUserSuburb(e.target.value)}
                />
              </div>

              {/* Width */}
              <div className="hw-tile">
                <div className="field field--big">
                  <label htmlFor="width-range-mobile">Width</label>
                  <output aria-live="polite">{width.toFixed(1)}m</output>
                  <input
                    id="width-range-mobile"
                    type="range"
                    min={widthMin}
                    max={widthMax}
                    step={0.1}
                    value={width}
                    onChange={(e)=>{ setWidth(parseFloat(e.target.value)); setWidthTouched(true); }}
                    style={{ ['--pct' as string]: `${((width - widthMin) / (widthMax - widthMin)) * 100}%` }}
                  />
                </div>
              </div>

              {/* Depth */}
              <div className="hw-tile">
                <div className="field field--big">
                  <label htmlFor="length-range-mobile">Depth</label>
                  <output aria-live="polite">{length.toFixed(1)}m</output>
                  <input
                    id="length-range-mobile"
                    type="range"
                    min={lengthMin}
                    max={lengthMax}
                    step={0.1}
                    value={length}
                    onChange={(e)=>{ setLength(parseFloat(e.target.value)); setLengthTouched(true); }}
                    style={{ ['--pct' as string]: `${((length - lengthMin) / (lengthMax - lengthMin)) * 100}%` }}
                  />
                </div>
              </div>

              {/* Height */}
              <div className="hw-tile">
                <div className="field field--big">
                  <label htmlFor="height-range-mobile">Height</label>
                  <output aria-live="polite">{height.toFixed(1)}m</output>
                  <input
                    id="height-range-mobile"
                    type="range"
                    min={heightMin}
                    max={heightMax}
                    step={0.1}
                    value={height}
                    onChange={(e)=>{ setHeight(parseFloat(e.target.value)); setHeightTouched(true); }}
                    style={{ ['--pct' as string]: `${((height - heightMin) / (heightMax - heightMin)) * 100}%` }}
                  />
                </div>
              </div>

              {/* Style + Roof side by side */}
              <div className="contact-mobile__style-row">
                {/* Style */}
                <div className="hw-tile equal style-tile">
                  <div className="vs-group">
                    <div className="vs-head">Style</div>
                    <ul className="vs-list" aria-hidden="true">
                      {STYLE_OPTS.map((s,i)=> (
                        <li
                          key={s}
                          className={styleIdx===i? 'active' : ''}
                          style={{opacity:styleOpacity(i)}}
                          onClick={()=>setStyleIdxLoop(i)}
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                    <div className="vs-rail">
                      <input
                        className="vs-range"
                        type="range"
                        min={0}
                        max={STYLE_OPTS.length-1}
                        step={0.01}
                        value={(STYLE_OPTS.length-1) - stylePos}
                        onChange={(e)=> {
                          const v = parseFloat(e.target.value);
                          setStyleTouched(true);
                          setStylePos((STYLE_OPTS.length-1) - v);
                        }}
                        onMouseUp={()=> setStylePos(styleIdx)}
                        onTouchEnd={()=> setStylePos(styleIdx)}
                        onKeyUp={()=> setStylePos(styleIdx)}
                        aria-label="Style selector"
                      />
                    </div>
                  </div>
                </div>

                {/* Roof */}
                <div className="hw-tile roof-tile equal">
                  <div className="vs-group">
                    <div className="vs-head">Roof</div>
                    <ul className="vs-list vs-list--checks" aria-hidden="false" style={{minHeight:'unset'}}>
                      {ROOF_OPTS.map((s)=> (
                        <li key={s}>
                          <label className="vs-check">
                            <span className="vs-check__label">{s}</span>
                            <input
                              className="vs-check__box"
                              type="checkbox"
                              checked={roofSelected.includes(s)}
                              onChange={(e)=>{
                                setRoofSelected(prev=> e.target.checked
                                  ? Array.from(new Set([...prev, s]))
                                  : prev.filter(x=>x!==s));
                              }}
                            />
                          </label>
                        </li>
                      ))}
                    </ul>
                    <div />
                  </div>
                </div>
              </div>

              {/* Add ons – after Roof */}
              <div className="hw-tile addons-eq">
                <div className="vs-group">
                  <div className="vs-head">Add ons</div>
                  <ul className="vs-list vs-list--checks" aria-hidden="false" style={{minHeight:'unset'}}>
                    {ADDON_OPTS.map((s)=> (
                      <li key={s}>
                        <label className="vs-check">
                          <span className="vs-check__label">{s}</span>
                          <input
                            className="vs-check__box"
                            type="checkbox"
                            checked={addonsSelected.includes(s)}
                            onChange={(e)=>{
                              setAddonsSelected(prev=> e.target.checked
                                ? Array.from(new Set([...prev, s]))
                                : prev.filter(x=>x!==s));
                            }}
                          />
                        </label>
                      </li>
                    ))}
                  </ul>
                  <div />
                </div>
              </div>

              {/* Message */}
              <div className="hw-tile">
                <textarea
                  name="message"
                  placeholder="Tell us about your space…"
                  rows={5}
                  className="input input--tile"
                  onChange={(e)=>setNotes(e.target.value)}
                />
              </div>

              {/* Send */}
              <div className="hw-tile send-tile">
                <button
                  type="button"
                  className="send-btn"
                  onClick={handleClickSend}
                  disabled={isSending}
                >
                  {sendLabel}
                </button>
              </div>
              {submitState==='error' && (
                <div className="hw-tile" role="alert">
                  <p><strong>Sorry, we couldn’t send your message.</strong></p>
                  <p>{submitError}</p>
                </div>
              )}
            </section>
          ) : null}

          <div className={`mid-controls ${hasMidContent ? '' : 'is-empty'} gap-y-[var(--vgap)]`} style={{ borderTop: 0 }}>
                {submitState === 'success' ? (
                  <div className="hw-tile span-2" role="status" aria-live="polite">
                    <p><strong>Thanks – we’ve received your enquiry.</strong></p>
                    <p>We’ll get back to you shortly. If it’s urgent, call <a href="tel:+6496349482">+64 9 634 9482</a>.</p>
                  </div>
                ) : showGenericMidControls ? (
                  <>
                  {/* Removed duplicate Name field from mid column; Name is collected in right column */}
                  {/* Width */}
                  <div className="hw-tile span-2">
                    <div className="field field--big">
                      <label htmlFor="width-range-mid">Width</label>
                      <output aria-live="polite">{width.toFixed(1)}m</output>
                      <input
                        id="width-range-mid"
                        type="range"
                        min={widthMin} max={widthMax} step={0.1}
                        value={width}
                        onChange={(e)=>{ setWidth(parseFloat(e.target.value)); setWidthTouched(true); }}
                        style={{ ['--pct' as string]: `${((width - widthMin) / (widthMax - widthMin)) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Depth (formerly Length) */}
                  <div className="hw-tile span-2">
                    <div className="field field--big">
                      <label htmlFor="length-range-mid">Depth</label>
                      <output aria-live="polite">{length.toFixed(1)}m</output>
                      <input
                        id="length-range-mid"
                        type="range"
                        min={lengthMin} max={lengthMax} step={0.1}
                        value={length}
                        onChange={(e)=>{ setLength(parseFloat(e.target.value)); setLengthTouched(true); }}
                        style={{ ['--pct' as string]: `${((length - lengthMin) / (lengthMax - lengthMin)) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Height */}
                  <div className="hw-tile span-2">
                    <div className="field field--big">
                      <label htmlFor="height-range-mid">Height</label>
                      <output aria-live="polite">{height.toFixed(1)}m</output>
                      <input
                        id="height-range-mid"
                        type="range"
                        min={heightMin} max={heightMax} step={0.1}
                        value={height}
                        onChange={(e)=>{ setHeight(parseFloat(e.target.value)); setHeightTouched(true); }}
                        style={{ ['--pct' as string]: `${((height - heightMin) / (heightMax - heightMin)) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Style + vertical slider */}
                  <div className="hw-tile col-1 equal style-tile">
                    <div className="vs-group">
                      <div className="vs-head">Style</div>
                      <ul className="vs-list" aria-hidden="true">
                        {STYLE_OPTS.map((s,i)=> (
                          <li key={s} className={styleIdx===i? 'active' : ''} style={{opacity:styleOpacity(i)}} onClick={()=>setStyleIdxLoop(i)}>{s}</li>
                        ))}
                      </ul>
                      <div className="vs-rail">
                        <input
                          className="vs-range"
                          type="range"
                          min={0}
                          max={STYLE_OPTS.length-1}
                          step={0.01}
                          value={(STYLE_OPTS.length-1) - stylePos}
                          onChange={(e)=> { const v = parseFloat(e.target.value); setStyleTouched(true); setStylePos((STYLE_OPTS.length-1) - v); }}
                          onMouseUp={()=> setStylePos(styleIdx)}
                          onTouchEnd={()=> setStylePos(styleIdx)}
                          onKeyUp={()=> setStylePos(styleIdx)}
                          aria-label="Style selector"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Roof checks */}
                  <div className="hw-tile col-2 roof-tile equal">
                    <div className="vs-group">
                      <div className="vs-head">Roof</div>
                      <ul className="vs-list vs-list--checks" aria-hidden="false" style={{minHeight:'unset'}}>
                        {ROOF_OPTS.map((s)=> (
                          <li key={s}>
                            <label className="vs-check">
                              <span className="vs-check__label">{s}</span>
                              <input className="vs-check__box" type="checkbox" checked={roofSelected.includes(s)} onChange={(e)=>{
                                setRoofSelected(prev=> e.target.checked? Array.from(new Set([...prev, s])): prev.filter(x=>x!==s));
                              }} />
                            </label>
                          </li>
                        ))}
                      </ul>
                      <div />
                    </div>
                  </div>
                  </>
                ) : null}

                {(enquiryType === 'Professional' && revealReady) ? (
                  <div className="pro-stack span-2">
                    {/* Selected files list */}
                    <div className="hw-tile pro-grow">
                      <div className="pro-files-list" aria-live="polite">
                        {proFiles.length === 0 ? (
                          <div className="pro-files-empty">No files added yet</div>
                        ) : (
                          <ul className="pro-files" role="list">
                            {proFiles.map((f, idx) => (
                              <li key={`${f.name}-${f.lastModified}-${idx}`} className="pro-file">
                                <span className="pro-file__name">{f.name}</span>
                                <span className="pro-file__size">{Math.ceil(f.size/1024)} KB</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* Clear button between list and dropzone */}
                    <div className="hw-tile send-tile">
                      <button type="button" className="clear-btn" onClick={()=> setProFiles([])}>CLEAR</button>
                    </div>

                    {/* Dropzone */}
                    <div className="hw-tile pro-grow">
                      <div
                        className={`pro-dropzone ${proDragOver ? 'drag-over' : ''}`}
                        onDragOver={(e)=>{ e.preventDefault(); e.stopPropagation(); setProDragOver(true); }}
                        onDragEnter={(e)=>{ e.preventDefault(); e.stopPropagation(); setProDragOver(true); }}
                        onDragLeave={(e)=>{ e.preventDefault(); e.stopPropagation(); setProDragOver(false); }}
                        onDrop={(e)=>{
                          e.preventDefault(); e.stopPropagation(); setProDragOver(false);
                          const incoming = Array.from(e.dataTransfer?.files || []);
                          if (incoming.length) {
                            setProFiles(prev => [...prev, ...incoming]);
                          }
                        }}
                        onClick={()=> proFileInputRef.current?.click()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); proFileInputRef.current?.click(); } }}
                        aria-label="Add files by dropping or selecting"
                      >
                        <div className="pro-dropzone__hint">
                          Drag and drop images or files here
                        </div>
                        <div className="pro-dropzone__sub">or click to choose</div>
                        <div className="pro-dropzone__note text-xs text-neutral-400 mt-2">
                          Up to 8 files, 20MB total.
                        </div>
                        <input
                          ref={proFileInputRef}
                          type="file"
                          multiple
                          tabIndex={-1}
                          aria-hidden
                          style={{ display:'none' }}
                          onChange={(e)=>{
                            const picked = Array.from(e.target.files || []);
                            if (picked.length) setProFiles(prev => [...prev, ...picked]);
                          }}
                        />
                      </div>
                </div>
                </div>
                ) : null}
          </div>
        </div>

        {/* Rule 2 */}
        <div aria-hidden className="hidden lg:block bg-neutral-600/80 w-px h-full self-stretch" />

        {/* Right column (keeps its space; content hides on submit) */}
        <section className="contact-right space-y-4 sm:space-y-6">
          {!isSubmitted && showRightControlsCustomer ? (
            <div className="right-locked">
                {/* Header / summary (spans both columns) */}
                <div className="hw-tile summary-tile right-locked__header">
                  <div className="summary summary--digital">
                    <div className="digital__type">{enquiryType ?? '—'}</div>
                    {/* Order: Enquiry, Style, Roof, Add ons */}
                    {styleTouched ? (
                      <div className="digital__style">{STYLE_OPTS[styleIdx]}</div>
                    ) : null}
                    {/* Keep a stable line for Roof so the box doesn't shift */}
                    <div className="digital__roof" ref={roofContainerRef}>
                      {roofSelected.length > 0 ? (
                        <span ref={roofTextRef} style={{ display:'inline-block', transform:`scale(${roofScale})`, transformOrigin:'left top' }}>
                          {roofSelected.join(', ')}
                        </span>
                      ) : null}
                    </div>
                    <div className="digital__addons" ref={addonsContainerRef}>
                      <span ref={addonsTextRef} style={{ display:'inline-block', transform:`scale(${addonsScale})`, transformOrigin:'left top' }}>
                        {addonsSelected.length ? addonsSelected.join(', ') : '—'}
                      </span>
                    </div>
                    <div className="digital__name">{userName}</div>
                    <div className="digital__dims-label">Dimensions:</div>
                    {(widthTouched || lengthTouched || heightTouched) ? (
                      <div className="digital__dims">{width.toFixed(1)}m x {length.toFixed(1)}m x {height.toFixed(1)}m</div>
                    ) : null}
                  </div>
                </div>

                {/* Fields stack (left subcolumn) */}
                <div className="right-locked__fields">
                  <div className="hw-tile">
                    <input name="name" placeholder="Name" required className="input input--tile" onChange={(e)=>setUserName(e.target.value)} />
                  </div>
                  <div className="hw-tile">
                    <input name="email" type="email" placeholder="Email" required className="input input--tile" onChange={(e)=>setUserEmail(e.target.value)} />
                  </div>
                  <div className="hw-tile">
                    <input name="suburb" placeholder="Suburb" className="input input--tile" onChange={(e)=>setUserSuburb(e.target.value)} />
                  </div>
                </div>

                {/* Add-ons (right subcolumn) */}
                <div className="hw-tile addons-eq right-locked__addons">
                  <div className="vs-group">
                    <div className="vs-head">Add ons</div>
                    <ul className="vs-list vs-list--checks" aria-hidden="false" style={{minHeight:'unset'}}>
                      {ADDON_OPTS.map((s)=> (
                        <li key={s}>
                          <label className="vs-check">
                            <span className="vs-check__label">{s}</span>
                            <input className="vs-check__box" type="checkbox" checked={addonsSelected.includes(s)} onChange={(e)=>{
                              setAddonsSelected(prev=> e.target.checked? Array.from(new Set([...prev, s])): prev.filter(x=>x!==s));
                            }} />
                          </label>
                        </li>
                      ))}
                    </ul>
                    <div />
                  </div>
                </div>

                {/* Message (spans both) */}
                <div className="hw-tile right-locked__textarea">
                  <textarea name="message" placeholder="Tell us about your space…" rows={5} className="input input--tile" onChange={(e)=>setNotes(e.target.value)} />
                </div>

                {/* Submit (spans both) */}
                <div className="hw-tile send-tile right-locked__send">
                  <button
                    type="button"
                    className="send-btn"
                    onClick={handleClickSend}
                    disabled={isSending}
                  >
                    {sendLabel}
                  </button>
                </div>
                {submitState==='error' && (
                  <div className="hw-tile right-locked__send" role="alert">
                    <p><strong>Sorry, we couldn’t send your message.</strong></p>
                    <p>{submitError}</p>
                  </div>
                )}
            </div>
          ) : null}

          {!isSubmitted && enquiryType === 'Professional' && enquiryRevealed && !enquiryExpanded ? (
            <div className="contact-controls">
                {/* Company */}
                <div className="hw-tile span-2">
                  <input name="company" placeholder="Company" className="input input--tile" onChange={(e)=>setUserCompany(e.target.value)} />
                </div>
                {/* Name */}
                <div className="hw-tile span-2">
                  <input name="name" placeholder="Name" required className="input input--tile" onChange={(e)=>setUserName(e.target.value)} />
                </div>
                {/* Email */}
                <div className="hw-tile span-2">
                  <input name="email" type="email" placeholder="Email" required className="input input--tile" onChange={(e)=>setUserEmail(e.target.value)} />
                </div>
                {/* Suburb */}
                <div className="hw-tile span-2">
                  <input name="suburb" placeholder="Suburb" className="input input--tile" onChange={(e)=>setUserSuburb(e.target.value)} />
                </div>
                {/* Message */}
                <div className="hw-tile span-2">
                  <textarea name="message" placeholder="Tell us about your space…" rows={5} className="input input--tile" onChange={(e)=>setNotes(e.target.value)} />
                </div>
                {/* Submit */}
                <div className="hw-tile span-2 send-tile mt-6">
                  <button
                    type="button"
                    className="send-btn"
                    onClick={handleClickSend}
                    disabled={isSending}
                  >
                    {sendLabel}
                  </button>
                </div>
                {submitState==='error' && (
                  <div className="hw-tile span-2" role="alert">
                    <p><strong>Sorry, we couldn’t send your message.</strong></p>
                    <p>{submitError}</p>
                  </div>
                )}
            </div>
          ) : null}
        </section>

        {/* Hidden fields attached to the contact form */}
        <input type="hidden" name="width_m" value={width.toFixed(1)} />
        <input type="hidden" name="length_m" value={length.toFixed(1)} />
        <input type="hidden" name="style" value={STYLE_OPTS[styleIdx]} />
        <input type="hidden" name="height_m" value={height.toFixed(1)} />
        <input type="hidden" name="roof" value={roofSelected.join(', ')} />
        <input type="hidden" name="addons" value={addonsSelected.join(', ')} />
        <input type="hidden" name="attachments" value={proAttachmentsSummary} />
        {/* Keep legacy flags for compatibility; add new descriptive field */}
        <input type="hidden" name="is_homeowner" value={enquiryType === 'Residential' ? '1' : '0'} />
        <input type="hidden" name="is_professional" value={enquiryType === 'Professional' ? '1' : '0'} />
        <input type="hidden" name="enquiry_type" value={enquiryType ?? ''} />
        {/* Honeypot field for bots (should remain empty) */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: '-10000px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }} aria-hidden="true" />
        </div>
      </form>
    </main>
  );
}
