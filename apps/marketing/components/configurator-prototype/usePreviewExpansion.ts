import { useEffect, useState } from 'react';

/** Expands the existing viewer without remounting its camera or losing the form's scroll position. */
export function usePreviewExpansion() {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    // Mobile browsers can scroll either root. Lock both, and restore their
    // previous styles when returning to the compact, page-scrollable preview.
    const roots = [document.documentElement, document.body];
    const previous = roots.map(root => ({ overflow: root.style.overflow, overscrollBehavior: root.style.overscrollBehavior }));
    roots.forEach(root => {
      root.style.overflow = 'hidden';
      root.style.overscrollBehavior = 'none';
    });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    const desktop = window.matchMedia('(min-width: 721px)');
    const closeOnDesktop = () => { if (desktop.matches) setExpanded(false); };
    window.addEventListener('keydown', closeOnEscape);
    desktop.addEventListener('change', closeOnDesktop);
    return () => {
      roots.forEach((root, index) => {
        root.style.overflow = previous[index].overflow;
        root.style.overscrollBehavior = previous[index].overscrollBehavior;
      });
      window.removeEventListener('keydown', closeOnEscape);
      desktop.removeEventListener('change', closeOnDesktop);
    };
  }, [expanded]);
  return { expanded, toggleExpanded: () => setExpanded(current => !current) };
}
