// components/OverlayMenu.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

export default function OverlayMenu() {
  const [open, setOpen] = useState(false);
  const firstLinkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);
    window.addEventListener('sp-open-menu', onOpen);
    window.addEventListener('sp-close-menu', onClose);
    return () => {
      window.removeEventListener('sp-open-menu', onOpen);
      window.removeEventListener('sp-close-menu', onClose);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('no-scroll', open);
    if (open) setTimeout(() => firstLinkRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function close() {
    setOpen(false);
    window.dispatchEvent(new CustomEvent('sp-close-menu'));
  }

  return (
    <div className={`overlay-menu ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="overlay-bg" onClick={close} role="button" aria-label="Close menu" tabIndex={-1} />
      <nav className="overlay-panel" aria-label="Main" role="dialog" aria-modal="true">
        <ul>
          <li><Link href="/projects" ref={firstLinkRef} onClick={close}>Projects</Link></li>
          <li><Link href="/gallery" onClick={close}>Gallery</Link></li>
          <li><Link href="/about" onClick={close}>About</Link></li>
          <li><Link href="/contact" onClick={close}>Contact</Link></li>
        </ul>
      </nav>
    </div>
  );
}
