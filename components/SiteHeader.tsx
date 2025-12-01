// components/SiteHeader.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  // keep header button state in sync if overlay closes elsewhere
  useEffect(() => {
    const onClose = () => setMenuOpen(false);
    window.addEventListener('sp-close-menu', onClose);
    return () => window.removeEventListener('sp-close-menu', onClose);
  }, []);

  function toggleView() {
    window.dispatchEvent(new CustomEvent('sp-toggle-view'));
  }

  function toggleMenu() {
    const next = !menuOpen;
    setMenuOpen(next);
    window.dispatchEvent(new CustomEvent(next ? 'sp-open-menu' : 'sp-close-menu'));
  }

  return (
    <header className="site-header">
      <nav aria-label="Primary" className="site-header__bar">
        {/* BRAND: transparent font logo image from the prototype */}
        <Link href="/" className="site-header__brand-img" aria-label="Home">
          <Image
            src="/logo-sanctuary.svg"
            alt="Sanctuary Pergolas"
            width={360}
            height={64}
            priority
          />
        </Link>

        <div className="site-header__actions">
          {/* View (square outline with SQUARE corners) */}
          <button
            type="button"
            aria-label="Toggle gallery view"
            title="Toggle gallery view"
            className="icon-btn"
            onClick={toggleView}
          >
            <svg width="28" height="22" viewBox="0 0 28 22" aria-hidden="true">
              <rect x="4" y="4" width="20" height="14" rx="0" ry="0" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>

          {/* Hamburger ↔ perfectly centered symmetric X (ONLY 3 lines) */}
          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            title="Menu"
            className={`icon-btn menu-btn ${menuOpen ? 'open' : ''}`}
            onClick={toggleMenu}
          >
            <svg width="28" height="22" viewBox="0 0 28 22" aria-hidden="true" className="icon-menu">
              {/* We rotate these around the exact center (14,11) */}
              <line className="l1" x1="3" y1="7"  x2="25" y2="7"  stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
              <line className="l2" x1="3" y1="11" x2="25" y2="11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
              <line className="l3" x1="3" y1="15" x2="25" y2="15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
            </svg>
          </button>
        </div>
      </nav>
    </header>
  );
}
