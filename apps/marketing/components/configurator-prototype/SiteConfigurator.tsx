'use client';
import { isInlineFunnelPath, returnToInlineFunnelEnquiry } from '../../lib/googleFunnel';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useConsent } from '../ConsentProvider';
import { trackChannelAction } from '../../lib/channelDesignTracking';
import { usePathname } from 'next/navigation';
import { isConfiguratorEntry, OPEN_CONFIGURATOR_EVENT, rememberConfiguratorSource } from './configuratorOverlay';
import { rememberConfiguratorReturn, restoreConfiguratorScroll } from './configuratorReturn';
const Dialog = dynamic(() => import('./ConfiguratorDialog'), { ssr: false });

export default function SiteConfigurator() {
  const pathname = usePathname();
  const { consent, hasTrackingDecision } = useConsent();
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState(false);
  useEffect(() => { setOpen(false); setVisited(false); }, [pathname]);
  useEffect(() => restoreConfiguratorScroll(), [pathname]);
  useEffect(() => {
    const show = () => { trackChannelAction('design_start', hasTrackingDecision && consent.analytics, 'full_designer'); setVisited(true); setOpen(true); };
    const click = async (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a') : null;
      if (!link || link.target || link.hasAttribute('download')) return;
      const destination = new URL(link.href);
      if (link.closest('dialog[open]') && destination.origin === window.location.origin && destination.pathname === '/design-enquiry') {
        trackChannelAction('design_enquiry_open', hasTrackingDecision && consent.analytics, 'full_designer');
      }
      if (isInlineFunnelPath(window.location.pathname) && destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.hash === '#project-details' && link.closest('dialog[open]')) {
        trackChannelAction('design_enquiry_open', hasTrackingDecision && consent.analytics, 'full_designer');
        event.preventDefault(); event.stopPropagation(); returnToInlineFunnelEnquiry(); setOpen(false); return;
      }
      rememberConfiguratorReturn(destination);
      if (window.location.pathname === '/design-enquiry' && destination.origin === window.location.origin
        && destination.pathname === '/design-enquiry' && link.closest('dialog[open]')) {
        event.preventDefault(); event.stopPropagation(); setOpen(false);
        return;
      }
      if (!isConfiguratorEntry(destination, window.location.origin)) return;
      event.preventDefault(); event.stopPropagation(); rememberConfiguratorSource(link.href);
      const entryPath = window.location.pathname;
      const material = link.getAttribute('data-configurator-material');
      if (['/acrylic-roof-pergolas-auckland', '/auckland-outdoor-living', '/ads/facebook/outdoor-living', '/ads/facebook/acrylic-pergolas'].includes(window.location.pathname)
        && (material === 'acrylic' || material === 'solid')) {
        try {
          const { initializeLandingPreview } = await import('./usePreviewDraft');
          if (window.location.pathname !== entryPath) return;
          initializeLandingPreview(material);
        } catch { /* Optional starting context must not prevent the canonical designer opening. */ }
      }
      if (window.location.pathname === entryPath) show();
    };
    document.addEventListener('click', click, true);
    window.addEventListener(OPEN_CONFIGURATOR_EVENT, show);
    return () => { document.removeEventListener('click', click, true); window.removeEventListener(OPEN_CONFIGURATOR_EVENT, show); };
  }, [hasTrackingDecision, consent.analytics]);
  return visited ? <Dialog open={open} onClose={() => setOpen(false)} resume /> : null;
}
