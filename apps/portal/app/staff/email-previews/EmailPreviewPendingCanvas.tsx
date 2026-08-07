import type { CSSProperties } from 'react';
import { MailCheck } from 'lucide-react';
import styles from './email-previews.module.css';

const pendingPreviewStyle = {
  '--preview-frame-width': '760px',
  '--preview-frame-height': '1320px',
  '--preview-frame-scale': 0.75,
  '--preview-scaled-width': '570px',
  '--preview-scaled-height': '990px',
} as CSSProperties;

const directions = [
  ['01', 'Editorial refined', 'Balanced and polished'],
  ['02', 'Image-led', 'Photography and impact'],
  ['03', 'Compact', 'Fastest to scan'],
] as const;

export function EmailPreviewPendingCanvas({
  state = 'loading',
}: {
  state?: 'loading' | 'unavailable';
}) {
  const valueState = state === 'loading' ? 'loading' : 'unavailable';

  return (
    <section
      id="email-preview-canvas"
      className={styles.canvas}
      aria-labelledby="email-preview-canvas-title"
      aria-busy={state === 'loading' || undefined}
      data-preview-mode="compare"
      data-preview-viewport="desktop"
      data-preview-theme="light"
      data-testid="email-preview-canvas"
      data-portal-shell-region="email-previews-canvas"
    >
      <header className={styles.canvasHeader}>
        <div>
          <p className={styles.eyebrow}>Preview canvas</p>
          <h2 id="email-preview-canvas-title">Compare three design directions</h2>
          <p data-portal-value-slot={valueState}>
            {state === 'loading' ? 'Rendering the selected enquiry…' : 'Preview values unavailable'}
          </p>
        </div>
        <div className={styles.canvasContract}>
          <MailCheck aria-hidden="true" />
          <span>Live autoresponder unchanged</span>
        </div>
      </header>

      <div className={styles.layoutChoiceHeading}>
        <div>
          <span>Active design</span>
          <strong data-portal-value-slot={valueState}>
            {state === 'loading' ? 'Loading…' : 'Unavailable'}
          </strong>
        </div>
        <p>Select a design for sending. Use Focus for a larger review.</p>
      </div>

      <div className={styles.layoutChoices} role="group" aria-label="Email layout choices">
        {directions.map(([number, name, description]) => (
          <button type="button" className={styles.layoutChoice} disabled key={number}>
            <span>{number}</span>
            <strong>{name}</strong>
            <small>{description}</small>
          </button>
        ))}
      </div>

      <div
        className={styles.previewRail}
        data-preview-count="3"
        style={pendingPreviewStyle}
      >
        {directions.map(([number, name]) => (
          <article className={styles.previewCard} key={number}>
            <header className={styles.previewCardHeader}>
              <span className={styles.layoutNumber}>{number}</span>
              <div>
                <div className={styles.layoutTitleLine}>
                  <h3>{name}</h3>
                </div>
                <p data-portal-value-slot={valueState}>
                  {state === 'loading' ? 'Preparing design details…' : 'Design details unavailable'}
                </p>
              </div>
            </header>
            <dl className={styles.messageMetadata}>
              <div>
                <dt>Inbox subject</dt>
                <dd data-portal-value-slot={valueState}>{state === 'loading' ? 'Loading…' : 'Unavailable'}</dd>
              </div>
              <div>
                <dt>Preheader</dt>
                <dd data-portal-value-slot={valueState}>{state === 'loading' ? 'Loading…' : 'Unavailable'}</dd>
              </div>
            </dl>
            <div className={styles.inboxStage}>
              <div className={styles.inboxChrome}>
                <span>Desktop · light · 75%</span>
                <span>Exact HTML</span>
              </div>
              <div className={styles.scaledFrame}>
                <div
                  className={styles.pendingEmailFrame}
                  data-portal-value-slot={valueState}
                  role="status"
                >
                  {state === 'loading' ? 'Rendering email…' : 'Email preview unavailable'}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
