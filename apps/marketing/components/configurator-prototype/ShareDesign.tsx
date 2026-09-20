'use client';

import { useEffect, useState } from 'react';
import type { PreviewDraft } from './previewDraft';
import { buildPreviewShareUrl, serializePreviewDesign } from './previewShare';
import styles from './journey.module.css';
import type { SharedEstimate } from './sharedEstimate';
import { useConsent } from '../ConsentProvider';
import { emitDesignEvent } from './DesignFunnelTracker';

export default function ShareDesign({ draft, estimate, prominent = false }: { draft: PreviewDraft; estimate?: SharedEstimate | null; prominent?: boolean }) {
  const { consent, hasTrackingDecision } = useConsent();
  const tracked = prominent && hasTrackingDecision && consent.analytics;
  const [nativeShare, setNativeShare] = useState(false);
  const [feedback, setFeedback] = useState<{ design: string; message: string; fallback?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const design = serializePreviewDesign(draft);
  useEffect(() => { setNativeShare(typeof navigator.share === 'function'); }, []);
  const current = feedback?.design === design ? feedback : null;
  const share = async (native: boolean) => {
    emitDesignEvent('design_share_open', tracked);
    const url = buildPreviewShareUrl(window.location.origin, draft, process.env.NEXT_PUBLIC_CONFIGURATOR_PREVIEW_SHARE, estimate);
    setBusy(true);
    try {
      if (native) await navigator.share({ title: 'My Sanctuary pergola', url });
      else await navigator.clipboard.writeText(url);
      emitDesignEvent('design_share', tracked);
      setFeedback({ design, message: prominent ? (native ? 'Design link shared.' : 'Design link copied. This version is saved in the link.') : (native ? 'Share menu opened.' : 'Link copied. Keep it or send it to someone.') });
    } catch (error) {
      if (native && error instanceof Error && error.name === 'AbortError') setFeedback(null);
      else {
        emitDesignEvent('design_share_link_ready', tracked);
        setFeedback({ design, message: 'Copy this link to save or share your design.', fallback: url });
      }
    } finally { setBusy(false); }
  };
  return <div className={styles.share}>
    <div className={styles.shareButtons}>
      {prominent ? <button type="button" disabled={busy} onClick={() => share(nativeShare)}>Share design</button> : <><button type="button" disabled={busy} onClick={() => share(false)}>Copy design link</button>{nativeShare && <button type="button" disabled={busy} onClick={() => share(true)}>Share…</button>}</>}
    </div>
    {current && <p role="status">{current.message}</p>}
    {current?.fallback && <input aria-label="Design link" readOnly value={current.fallback} onFocus={event => event.currentTarget.select()} />}
  </div>;
}
