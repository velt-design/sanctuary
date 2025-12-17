"use client";

import React, { useEffect, useId, useRef, useState, forwardRef, useImperativeHandle } from "react";

export type AccordionItem = {
  title: string;
  content: React.ReactNode;
  defaultOpen?: boolean;
};

export type AccordionRowHandle = {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
};

const Row = forwardRef<AccordionRowHandle, { item: AccordionItem; id: string; onRequestToggle: () => void }>(function Row(
  { item, id, onRequestToggle },
  ref
) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  // Measure content height and store it on the panel as a CSS var so
  // we can animate from 0 -> content height (and back) over 0.7s.
  useEffect(() => {
    const el = innerRef.current;
    const host = panelRef.current;
    if (!el || !host) return;

    const apply = () => {
      const h = el.scrollHeight;
      // If currently transitioning open (height in px), keep it in sync.
      if (detailsRef.current?.hasAttribute("open") && host.style.height && host.style.height !== "auto") {
        host.style.height = `${h}px`;
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const open = () => {
    const d = detailsRef.current;
    const panel = panelRef.current;
    const inner = innerRef.current;
    if (!d || !panel || !inner) return;
    // Apply open state then measure inner content height (includes inner padding)
    d.setAttribute("open", "");
    panel.dataset.open = "true";
    panel.style.height = `0px`;
    const target = inner.scrollHeight;
    // Force reflow so transition starts from 0
    panel.offsetHeight;
    panel.style.height = `${target}px`;
    const onEnd = (e: TransitionEvent) => {
      if (e.target !== panel || e.propertyName !== "height") return;
      panel.removeEventListener("transitionend", onEnd);
      panel.style.height = "auto"; // allow natural growth
    };
    panel.addEventListener("transitionend", onEnd);
  };

  const close = () => {
    const d = detailsRef.current;
    const panel = panelRef.current;
    const inner = innerRef.current;
    if (!d || !panel || !inner) return;
    if (!d.hasAttribute("open")) return;
    // Measure current height from inner (includes inner padding)
    const current = inner.scrollHeight;
    panel.style.height = `${current}px`;
    // Kick off transition to 0 height and remove padding at the same time
    panel.dataset.open = "false";
    d.setAttribute("data-closing", "true");
    // Force reflow to ensure the next write transitions
    panel.offsetHeight;
    panel.style.height = `0px`;
    const onEnd = (e: TransitionEvent) => {
      if (e.target !== panel || e.propertyName !== "height") return;
      panel.removeEventListener("transitionend", onEnd);
      d.removeAttribute("data-closing");
      d.removeAttribute("open");
      panel.style.height = "";
      panel.removeAttribute("data-open");
    };
    panel.addEventListener("transitionend", onEnd);
  };

  useImperativeHandle(ref, () => ({
    open,
    close,
    isOpen: () => Boolean(detailsRef.current?.hasAttribute("open")),
  }));

  const onSummaryClick: React.MouseEventHandler<HTMLElement> = (e) => {
    e.preventDefault();
    onRequestToggle();
  };

  const onSummaryKeyDown: React.KeyboardEventHandler<HTMLElement> = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onRequestToggle();
    }
  };

  return (
    <details ref={detailsRef} className="accordion__item" open={Boolean(item.defaultOpen)} role="listitem">
      <summary className="accordion__summary" aria-controls={id} onClick={onSummaryClick} onKeyDown={onSummaryKeyDown}>
        <span className="accordion__title">{item.title}</span>
        <span className="accordion__icon" aria-hidden="true" />
      </summary>
      <div className="accordion__panel" id={id} ref={panelRef}>
        <div ref={innerRef} className="accordion__panel-inner">
          {item.content}
        </div>
      </div>
    </details>
  );
});

type ScrollBehavior = 'default' | 'sticky-panel';

export default function Accordion({
  items,
  showPeekBottom = false,
  scrollBehavior = 'default',
  onChange,
}: {
  items: AccordionItem[];
  showPeekBottom?: boolean;
  scrollBehavior?: ScrollBehavior;
  onChange?: (openIndex: number | null) => void;
}) {
  const idBase = useId();
  const rowRefs = useRef<(AccordionRowHandle | null)[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hidePeek, setHidePeek] = useState(false);
  // On mount and when items change, honor a defaultOpen item and enforce one-open-at-a-time
  useEffect(() => {
    const idx = items.findIndex(i => i.defaultOpen);
    if (idx >= 0) {
      // Close others and open the chosen one
      rowRefs.current.forEach((r, i) => {
        if (!r) return;
        if (i === idx) r.open(); else r.close();
      });
      setOpenIdx(idx);
      onChange?.(idx);
    } else {
      rowRefs.current.forEach((r) => r?.close());
      setOpenIdx(null);
      onChange?.(null);
    }
    // We intentionally run this only once on mount because
    // callers typically pass a new array literal for `items`
    // on every render, which would otherwise reset the open
    // state back to the default item.
  }, []);

  const handleToggle = (idx: number) => {
    const current = openIdx;
    if (current === idx) {
      rowRefs.current[idx]?.close();
      setOpenIdx(null);
       onChange?.(null);
      return;
    }
    // Close previously open
    if (current !== null) rowRefs.current[current]?.close();
    // Open new
    rowRefs.current[idx]?.open();
    setOpenIdx(idx);
    onChange?.(idx);
  };

  const openNext = () => {
    if (openIdx === null) return;
    const next = Math.min(items.length - 1, openIdx + 1);
    if (next !== openIdx) handleToggle(next);
  };

  // Hide the bottom peek tab whenever the actual next header is
  // visible inside the right-rail scroller so there isn't a duplicate.
  useEffect(() => {
    if (!showPeekBottom) return;
    if (openIdx === null) { setHidePeek(true); return; }
    const host = containerRef.current;
    if (!host) return;
    const summaries = host.querySelectorAll<HTMLElement>(".accordion__item > .accordion__summary");
    const next = summaries[openIdx + 1];
    if (!next) { setHidePeek(true); return; }
    const root = host.closest('.product-right-scroller') as Element | null;
    const io = new IntersectionObserver((entries) => {
      const e = entries[0];
      setHidePeek(Boolean(e?.isIntersecting));
    }, { root, threshold: 0.01 });
    io.observe(next);
    return () => io.disconnect();
  }, [openIdx, showPeekBottom]);

  return (
    <div ref={containerRef} className="accordion" role="list">
      {items.map((it, i) => (
        <Row
          ref={(el) => {
            rowRefs.current[i] = el;
          }}
          key={i}
          item={it}
          id={`${idBase}-${i}`}
          onRequestToggle={() => handleToggle(i)}
        />
      ))}
      {showPeekBottom && !hidePeek && openIdx !== null && openIdx < items.length - 1 ? (
        <button
          type="button"
          className="accordion__summary accordion__peek-bottom"
          aria-label={`Open ${items[openIdx + 1].title}`}
          onClick={openNext}
        >
          <span className="accordion__title">{items[openIdx + 1].title}</span>
          <span aria-hidden className="accordion__icon" />
        </button>
      ) : null}
    </div>
  );
}
