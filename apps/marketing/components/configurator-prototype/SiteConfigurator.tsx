'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isConfiguratorEntry, OPEN_CONFIGURATOR_EVENT, rememberConfiguratorSource } from './configuratorOverlay';
import { rememberConfiguratorReturn, restoreConfiguratorScroll } from './configuratorReturn';
const Dialog = dynamic(() => import('./ConfiguratorDialog'), { ssr: false });

export default function SiteConfigurator() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState(false);
  useEffect(() => { setOpen(false); setVisited(false); }, [pathname]);
  useEffect(() => restoreConfiguratorScroll(), [pathname]);
  useEffect(() => {
    const show = () => { setVisited(true); setOpen(true); };
    const click = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a') : null;
      if (!link || link.target || link.hasAttribute('download')) return;
      const destination = new URL(link.href);
      rememberConfiguratorReturn(destination);
      if (window.location.pathname === '/design-enquiry' && destination.origin === window.location.origin
        && destination.pathname === '/design-enquiry' && link.closest('dialog[open]')) {
        event.preventDefault(); event.stopPropagation(); setOpen(false);
        return;
      }
      if (!isConfiguratorEntry(destination, window.location.origin)) return;
      event.preventDefault(); event.stopPropagation(); rememberConfiguratorSource(link.href); show();
    };
    document.addEventListener('click', click, true);
    window.addEventListener(OPEN_CONFIGURATOR_EVENT, show);
    return () => { document.removeEventListener('click', click, true); window.removeEventListener(OPEN_CONFIGURATOR_EVENT, show); };
  }, []);
  return visited ? <Dialog open={open} onClose={() => setOpen(false)} resume /> : null;
}
