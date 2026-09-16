import { useEffect, useState } from 'react';

// The popup owns page locking and Escape; expansion only changes its layout.
export function usePreviewExpansion() {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 721px)');
    const closeOnDesktop = () => { if (desktop.matches) setExpanded(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);
  return { expanded, toggleExpanded: () => setExpanded(current => !current), collapse: () => setExpanded(false) };
}
