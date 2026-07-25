import Image from 'next/image';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { Badge, Button, Select } from '@/components/ui/foundation';
import {
  previewBlindsOptions,
  previewCustomerTypes,
  previewDisplayModeOptions,
  previewRoofForms,
  previewThemeOptions,
  previewVariantPosition,
  previewViewportOptions,
  previewZoomOptions,
  type PreviewBlindsOption,
  type PreviewCustomerType,
  type PreviewRoofForm,
} from './emailPreviewOptions';
import { EmailPreviewDeliveryPanel } from './EmailPreviewDeliveryPanel';
import { EmailPreviewSegmentedControl } from './EmailPreviewSegmentedControl';
import type { EmailPreviewWorkbenchController } from './useEmailPreviewWorkbench';
import styles from './email-previews.module.css';

const imageMatchLabels = {
  exact: 'Matched project',
  'form-only': 'Roof-form match',
  professional: 'Professional default',
  fallback: 'Default project',
} as const;

export function EmailPreviewControls({
  controller,
}: {
  controller: EmailPreviewWorkbenchController;
}) {
  const position = previewVariantPosition(controller.variant);
  const professional = controller.customerType === 'professional';
  const displayMode = previewDisplayModeOptions.find(
    (option) => option.value === controller.displayMode,
  );
  const viewport = previewViewportOptions.find(
    (option) => option.value === controller.viewport,
  );

  return (
    <div className={styles.controlDeck}>
      <section
        className={styles.fixturePanel}
        aria-labelledby="email-preview-fixture-title"
      >
        <header className={styles.panelHeading}>
          <span className={styles.stepNumber} aria-hidden="true">01</span>
          <div>
            <p className={styles.eyebrow}>Project scenario</p>
            <h2 id="email-preview-fixture-title">Choose the enquiry</h2>
          </div>
          <Badge>
            Example {String(position.current).padStart(2, '0')} of{' '}
            {position.total}
          </Badge>
        </header>

        <div className={styles.fixtureFields}>
          <Select
            label="Customer type"
            value={controller.customerType}
            disabled={controller.controlsLocked}
            onChange={(event) =>
              controller.setCustomerType(
                event.target.value as PreviewCustomerType,
              )
            }
          >
            {previewCustomerTypes.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          {!professional ? (
            <>
              <Select
                label="Roof form"
                value={controller.roofForm}
                disabled={controller.controlsLocked}
                onChange={(event) =>
                  controller.setRoofForm(
                    event.target.value as PreviewRoofForm,
                  )
                }
              >
                {previewRoofForms.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Select
                label="Outdoor blinds"
                value={controller.blinds}
                disabled={controller.controlsLocked}
                onChange={(event) =>
                  controller.setBlinds(
                    event.target.value as PreviewBlindsOption,
                  )
                }
              >
                {previewBlindsOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </>
          ) : (
            <p className={styles.professionalNote}>
              Professional uses the fixed KiwiRail Head Office reference;
              roof and blinds do not apply.
            </p>
          )}
        </div>

        <div className={styles.fixtureIdentity}>
          {controller.preview?.image ? (
            <Image
              className={styles.fixtureImage}
              src={controller.preview.image.imageUrl}
              alt={controller.preview.image.imageAlt}
              width={144}
              height={96}
              unoptimized
            />
          ) : (
            <div className={styles.fixtureImagePlaceholder} aria-hidden="true" />
          )}
          <div>
            <span>Completed project shown</span>
            <strong>
              {controller.preview?.image?.projectTitle
                ?? 'Resolving project reference'}
            </strong>
            {controller.preview?.image ? (
              <p>
                {controller.preview.image.location} ·{' '}
                {controller.preview.image.roofApproach}
              </p>
            ) : null}
          </div>
          {controller.preview?.image ? (
            <Badge tone="info">
              {imageMatchLabels[controller.preview.image.match]}
            </Badge>
          ) : null}
        </div>
      </section>

      <section
        className={styles.viewPanel}
        aria-labelledby="email-preview-view-title"
      >
        <header className={styles.panelHeading}>
          <span className={styles.stepNumber} aria-hidden="true">02</span>
          <div>
            <p className={styles.eyebrow}>Design review</p>
            <h2 id="email-preview-view-title">Compare the emails</h2>
          </div>
          <div className={styles.utilityActions}>
            <Button
              size="small"
              variant="quiet"
              leadingIcon={<RefreshCw aria-hidden="true" />}
              disabled={controller.controlsLocked}
              onClick={controller.refresh}
            >
              Refresh
            </Button>
            <Button
              size="small"
              variant="quiet"
              leadingIcon={<RotateCcw aria-hidden="true" />}
              disabled={controller.controlsLocked}
              onClick={controller.reset}
            >
              Reset
            </Button>
          </div>
        </header>

        <div className={styles.viewControls}>
          <EmailPreviewSegmentedControl
            label="Mode"
            options={previewDisplayModeOptions}
            value={controller.displayMode}
            disabled={controller.controlsLocked}
            controls="email-preview-canvas"
            onChange={controller.setDisplayMode}
          />
          <EmailPreviewSegmentedControl
            label="Viewport"
            options={previewViewportOptions}
            value={controller.viewport}
            disabled={controller.controlsLocked}
            showDescriptions
            controls="email-preview-canvas"
            onChange={controller.setViewport}
          />
          <EmailPreviewSegmentedControl
            label="Simulation"
            options={previewThemeOptions}
            value={controller.theme}
            disabled={controller.controlsLocked}
            controls="email-preview-canvas"
            onChange={controller.setTheme}
          />
          <EmailPreviewSegmentedControl
            label="Zoom"
            options={previewZoomOptions}
            value={controller.zoom}
            disabled={controller.controlsLocked}
            controls="email-preview-canvas"
            onChange={controller.setZoom}
          />
        </div>
        <p className={styles.viewSummary} id="email-preview-view-summary">
          <strong>
            {displayMode?.label ?? 'Compare'} · {viewport?.label ?? 'Desktop'}{' '}
            {viewport?.width ?? 760}px · {controller.theme} · {controller.zoom}%
          </strong>
          <span>
            {displayMode?.description}. Theme is simulated; the exact email
            HTML remains isolated.
          </span>
        </p>
      </section>

      <EmailPreviewDeliveryPanel controller={controller} />
    </div>
  );
}
