import type { CSSProperties } from 'react';
import { Expand, MailCheck } from 'lucide-react';
import { Badge, Button } from '@/components/ui/foundation';
import {
  previewViewportDefinition,
  type PreviewLayoutId,
} from './emailPreviewOptions';
import type {
  LayoutPreview,
  PreviewResponse,
} from './emailPreviewTypes';
import type { EmailPreviewWorkbenchController } from './useEmailPreviewWorkbench';
import styles from './email-previews.module.css';

type PreviewStyle = CSSProperties & {
  '--preview-frame-width': string;
  '--preview-frame-height': string;
  '--preview-frame-scale': number;
  '--preview-scaled-width': string;
  '--preview-scaled-height': string;
};

function frameHeight(viewport: EmailPreviewWorkbenchController['viewport']) {
  if (viewport === 'mobile') return 1120;
  if (viewport === 'narrow') return 1260;
  return 1320;
}

function layoutNumber(
  preview: PreviewResponse,
  layoutId: PreviewLayoutId,
): string {
  const index = preview.layouts.findIndex((layout) => layout.id === layoutId);
  return String(Math.max(index, 0) + 1).padStart(2, '0');
}

function EmailLayoutPreview({
  controller,
  layout,
  style,
}: {
  controller: EmailPreviewWorkbenchController;
  layout: LayoutPreview;
  style: PreviewStyle;
}) {
  const selected = layout.id === controller.selectedLayoutId;
  const html =
    controller.theme === 'dark' ? layout.htmlDark : layout.htmlLight;

  function focusLayout() {
    controller.setSelectedLayoutId(layout.id);
    controller.setDisplayMode('focus');
  }

  return (
    <article
      className={styles.previewCard}
      data-layout-id={layout.id}
      data-selected={selected || undefined}
      style={style}
    >
      <header className={styles.previewCardHeader}>
        <span className={styles.layoutNumber}>
          {layoutNumber(controller.preview!, layout.id)}
        </span>
        <div>
          <div className={styles.layoutTitleLine}>
            <h3>{layout.name}</h3>
            {selected ? <Badge tone="info">Selected</Badge> : null}
          </div>
          <p>{layout.description}</p>
        </div>
        {controller.displayMode === 'compare' ? (
          <Button
            size="small"
            variant="quiet"
            leadingIcon={<Expand aria-hidden="true" />}
            onClick={focusLayout}
          >
            Focus
          </Button>
        ) : null}
      </header>

      <dl className={styles.messageMetadata}>
        <div>
          <dt>Inbox subject</dt>
          <dd>{layout.sendSubject}</dd>
        </div>
        <div>
          <dt>Preheader</dt>
          <dd>{layout.preheader}</dd>
        </div>
      </dl>

      <div
        className={styles.inboxStage}
        data-preview-theme={controller.theme}
      >
        <div className={styles.inboxChrome}>
          <span>
            {controller.viewport} · {controller.theme} · {controller.zoom}%
          </span>
          <span>Exact HTML</span>
        </div>
        <div className={styles.scaledFrame}>
          <iframe
            key={`${controller.variant}-${layout.id}-${controller.theme}-${controller.renderRevision}`}
            className={styles.emailFrame}
            title={`${layout.name} ${controller.viewport} ${controller.theme} enquiry email preview`}
            srcDoc={html}
            sandbox=""
            loading="lazy"
          />
        </div>
      </div>

      <footer className={styles.previewCardFooter}>
        <div className={styles.bestFor}>
          <span>Best for</span>
          <p>{layout.bestFor}</p>
        </div>
        <details className={styles.plainText}>
          <summary>Plain-text version</summary>
          <pre>{layout.text}</pre>
        </details>
      </footer>
    </article>
  );
}

export function EmailPreviewCanvas({
  controller,
}: {
  controller: EmailPreviewWorkbenchController;
}) {
  const { preview, selectedLayout } = controller;
  if (!preview || !selectedLayout) return null;

  const viewport = previewViewportDefinition(controller.viewport);
  const scale = controller.zoom / 100;
  const height = frameHeight(controller.viewport);
  const previewStyle: PreviewStyle = {
    '--preview-frame-width': `${viewport.width}px`,
    '--preview-frame-height': `${height}px`,
    '--preview-frame-scale': scale,
    '--preview-scaled-width': `${Math.round(viewport.width * scale)}px`,
    '--preview-scaled-height': `${Math.round(height * scale)}px`,
  };
  const visibleLayouts =
    controller.displayMode === 'compare'
      ? preview.layouts
      : [selectedLayout];

  return (
    <section
      className={styles.canvas}
      aria-labelledby="email-preview-canvas-title"
      data-preview-mode={controller.displayMode}
      data-preview-viewport={controller.viewport}
      data-preview-theme={controller.theme}
      data-testid="email-preview-canvas"
    >
      <header className={styles.canvasHeader}>
        <div>
          <p className={styles.eyebrow}>Preview canvas</p>
          <h2 id="email-preview-canvas-title">
            {controller.displayMode === 'compare'
              ? 'Three layouts. One identical brief.'
              : selectedLayout.name}
          </h2>
          <p>
            {viewport.label} {viewport.width}px · {controller.theme} simulation
            · {controller.zoom}% zoom
          </p>
        </div>
        <div className={styles.canvasContract}>
          <MailCheck aria-hidden="true" />
          <span>Production autoresponder unchanged</span>
        </div>
      </header>

      <div
        className={styles.layoutChoices}
        role="group"
        aria-label="Select the active email layout"
      >
        {preview.layouts.map((layout) => (
          <button
            type="button"
            className={styles.layoutChoice}
            data-layout-choice={layout.id}
            aria-pressed={layout.id === controller.selectedLayoutId}
            disabled={controller.controlsLocked}
            key={layout.id}
            onClick={() => controller.setSelectedLayoutId(layout.id)}
          >
            <span>{layoutNumber(preview, layout.id)}</span>
            <strong>{layout.name}</strong>
            <small>{layout.bestFor}</small>
          </button>
        ))}
      </div>

      <div
        className={styles.previewRail}
        data-preview-count={visibleLayouts.length}
        style={previewStyle}
      >
        {visibleLayouts.map((layout) => (
          <EmailLayoutPreview
            controller={controller}
            layout={layout}
            style={previewStyle}
            key={layout.id}
          />
        ))}
      </div>
    </section>
  );
}
