import { useEffect, useState } from 'react';

/** Expands the existing viewer without remounting its camera or losing the form's scroll position. */
export function usePreviewExpansion() {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    const desktop = window.matchMedia('(min-width: 721px)');
    const closeOnDesktop = () => { if (desktop.matches) setExpanded(false); };
    window.addEventListener('keydown', closeOnEscape);
    desktop.addEventListener('change', closeOnDesktop);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', closeOnEscape);
      desktop.removeEventListener('change', closeOnDesktop);
    };
  }, [expanded]);
  return { expanded, toggleExpanded: () => setExpanded(current => !current) };
}
