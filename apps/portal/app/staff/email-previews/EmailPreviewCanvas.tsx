import type { CSSProperties } from 'react';
import { Expand, MailCheck } from 'lucide-react';
import { Badge, Button } from '@/components/ui/foundation';
import {
  previewViewportDefinition,previewLayoutIds,
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

const layoutNames:Record<PreviewLayoutId,string>={'editorial-refined':'Editorial Refined','image-led':'Image-led',compact:'Compact'};
const layoutQuickLabels: Record<PreviewLayoutId, string> = {
  'editorial-refined': 'Balanced and polished',
  'image-led': 'Photography and impact',
  compact: 'Fastest to scan',
};

function frameHeight(viewport: EmailPreviewWorkbenchController['viewport']) {
  if (viewport === 'mobile') return 1120;
  if (viewport === 'narrow') return 1260;
  return 1320;
}

function layoutNumber(
  preview: PreviewResponse|null,
  layoutId: PreviewLayoutId,
): string {
  const index = (preview?.layouts.map(layout=>layout.id)??previewLayoutIds).indexOf(layoutId);
  return String(Math.max(index, 0) + 1).padStart(2, '0');
}

function EmailLayoutPreview({
  controller,
  layout,layoutId,
  style,
}: {
  controller: EmailPreviewWorkbenchController;
  layout: LayoutPreview|null;layoutId:PreviewLayoutId;
  style: PreviewStyle;
}) {
  const selected = layoutId === controller.selectedLayoutId;
  const html =
    controller.theme === 'dark' ? layout?.htmlDark : layout?.htmlLight;

  const name=layout?.name??layoutNames[layoutId],unknown=controller.loading?'Reading…':'Unavailable';
  function focusLayout() {
    controller.setSelectedLayoutId(layoutId);
    controller.setDisplayMode('focus');
  }

  return (
    <article
      className={styles.previewCard}
      data-layout-id={layoutId}
      data-selected={selected || undefined}
      style={style}
    >
      <header className={styles.previewCardHeader}>
        <span className={styles.layoutNumber}>
          {layoutNumber(controller.preview, layoutId)}
        </span>
        <div>
          <div className={styles.layoutTitleLine}>
            <h3>{name}</h3>
            {selected ? <Badge tone="info">Selected</Badge> : null}
          </div>
          <p>{layout?.description??layoutQuickLabels[layoutId]}</p>
        </div>
        {controller.displayMode === 'compare' ? (
          <Button
            size="small"
            variant="quiet"
            leadingIcon={<Expand aria-hidden="true" />}
            aria-label={`Focus ${name} design`}
            onClick={focusLayout}
          >
            Focus
          </Button>
        ) : null}
      </header>

      <dl className={styles.messageMetadata}>
        <div>
          <dt>Inbox subject</dt>
          <dd>{layout?.sendSubject??unknown}</dd>
        </div>
        <div>
          <dt>Preheader</dt>
          <dd>{layout?.preheader??unknown}</dd>
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
          {layout?<iframe
            key={`${controller.variant}-${layoutId}-${controller.theme}-${controller.renderRevision}`}
            className={styles.emailFrame}
            title={`${name} ${controller.viewport} ${controller.theme} enquiry email preview`}
            srcDoc={html}
            sandbox=""
            loading="lazy"
          />:<p role={controller.loading?'status':undefined}>{controller.loading?'Reading exact email HTML…':'Exact email HTML unavailable.'}</p>}
        </div>
      </div>

      <footer className={styles.previewCardFooter}>
        <div className={styles.bestFor}>
          <span>Best for</span>
          <p>{layout?.bestFor??unknown}</p>
        </div>
        <details className={styles.plainText}>
          <summary aria-label={`${name} plain-text version`}>
            Plain-text version
          </summary>
          <pre>{layout?.text??unknown}</pre>
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
  const selectedName=selectedLayout?.name??layoutNames[controller.selectedLayoutId];
  const choices=preview?.layouts.map(layout=>layout.id)??previewLayoutIds;

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
      ? choices
      : [controller.selectedLayoutId];

  return (
    <section
      id="email-preview-canvas"
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
              ? 'Compare three design directions'
              : selectedName}
          </h2>
          <p>
            {preview?.label??(controller.loading?'Reading selected enquiry…':'Selected enquiry unavailable')} · {viewport.label} {viewport.width}px ·{' '}
            {controller.theme} simulation · {controller.zoom}% zoom
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
          <strong>{selectedName}</strong>
        </div>
        <p>Select a design for sending. Use Focus for a larger review.</p>
      </div>

      <div
        className={styles.layoutChoices}
        role="group"
        aria-label="Select the active email layout"
      >
        {choices.map((layoutId) => {const name=preview?.layouts.find(layout=>layout.id===layoutId)?.name??layoutNames[layoutId];return (
          <button
            type="button"
            className={styles.layoutChoice}
            data-layout-choice={layoutId}
            aria-pressed={layoutId === controller.selectedLayoutId}
            disabled={controller.controlsLocked}
            key={layoutId}
            aria-label={`${name}: ${layoutQuickLabels[layoutId]}`}
            onClick={() => controller.setSelectedLayoutId(layoutId)}
          >
            <span>{layoutNumber(preview, layoutId)}</span>
            <strong>{name}</strong>
            <small>{layoutQuickLabels[layoutId]}</small>
          </button>
        );})}
      </div>

      <div
        className={styles.previewRail}
        data-preview-count={visibleLayouts.length}
        style={previewStyle}
      >
        {visibleLayouts.map((layoutId) => (
          <EmailLayoutPreview
            controller={controller}
            layoutId={layoutId}
            layout={preview?.layouts.find(layout=>layout.id===layoutId)??null}
            style={previewStyle}
            key={layoutId}
          />
        ))}
      </div>
    </section>
  );
}
