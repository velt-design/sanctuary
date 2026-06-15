'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

// Reusable horizontal flick carousel. Owns the scroll-snap track, optional
// prev/next arrows, and a tap-vs-swipe click guard so swiping the rail never
// triggers a card's navigation. Card children supply their own width; the rail
// applies snap-start + shrink-0 to each direct child.

const DRAG_THRESHOLD_PX = 8;

function IconChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
      <path d="M14.5 6.5L9 12l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
      <path d="M9.5 6.5L15 12l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" />
    </svg>
  );
}

type CardCarouselProps = {
  children: React.ReactNode;
  ariaLabel: string;
  showArrows?: boolean;
  className?: string;
  arrowsClassName?: string;
  trackClassName?: string;
  railClassName?: string;
};

export default function CardCarousel({
  children,
  ariaLabel,
  showArrows = true,
  className,
  arrowsClassName,
  trackClassName,
  railClassName,
}: CardCarouselProps) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const startX = React.useRef(0);
  const startScrollLeft = React.useRef(0);
  const dragged = React.useRef(false);

  const scrollByCard = React.useCallback((direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;

    const rail = track.firstElementChild;
    const cards = rail ? (Array.from(rail.children) as HTMLElement[]) : [];
    let delta = track.clientWidth * 0.84;
    if (cards.length >= 2) {
      delta = Math.abs(cards[1].offsetLeft - cards[0].offsetLeft);
    } else if (cards[0]) {
      delta = cards[0].getBoundingClientRect().width;
    }

    track.scrollBy({ left: direction * delta, behavior: 'smooth' });
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    startX.current = event.clientX;
    startScrollLeft.current = trackRef.current?.scrollLeft ?? 0;
    dragged.current = false;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (Math.abs(event.clientX - startX.current) > DRAG_THRESHOLD_PX) {
      dragged.current = true;
    }
  };

  // Capture phase: runs before a card's own click, so swiped clicks are
  // swallowed before navigation. A real tap (no movement, no scroll) passes
  // through untouched.
  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const scrolled = Math.abs((trackRef.current?.scrollLeft ?? 0) - startScrollLeft.current);
    if (dragged.current || scrolled > DRAG_THRESHOLD_PX) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <div className={cn('relative', className)}>
      {showArrows ? (
        <div className={cn('mb-4 flex items-center justify-end gap-2', arrowsClassName)} aria-label={`${ariaLabel} controls`}>
          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            aria-label="Previous"
            className="inline-flex h-10 w-10 items-center justify-center border border-page bg-card text-ink transition-colors hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/35"
          >
            <IconChevronLeft />
          </button>
          <button
            type="button"
            onClick={() => scrollByCard(1)}
            aria-label="Next"
            className="inline-flex h-10 w-10 items-center justify-center border border-page bg-card text-ink transition-colors hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/35"
          >
            <IconChevronRight />
          </button>
        </div>
      ) : null}

      <div
        ref={trackRef}
        className={cn(
          'overflow-x-auto pb-1 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden',
          trackClassName
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onClickCapture={handleClickCapture}
      >
        <div className={cn('flex [&>*]:shrink-0 [&>*]:snap-start', railClassName)}>{children}</div>
      </div>
    </div>
  );
}
