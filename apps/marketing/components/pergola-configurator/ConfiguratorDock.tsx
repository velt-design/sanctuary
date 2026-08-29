'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { CustomerPergolaConfigurationV1 } from '@sp/configurator/core';
import { getConfiguratorRoutePolicy } from '../../lib/pergola-configurator/routePolicy';
import { useConfiguratorSnapshot, useConfiguratorStore } from './ConfiguratorProvider';
import styles from './configuratorDock.module.css';

const FAMILY_LABELS = {
  mono: 'Pitched',
  gable: 'Gable',
  hip: 'Hip',
  box: 'Box perimeter',
} as const;
const TINT_LABELS = {
  clear: 'Clear acrylic',
  light_grey: 'Light grey acrylic',
  dark_grey: 'Dark grey acrylic',
  opal: 'Opal acrylic',
} as const;

function formatMetres(millimetres: number): string {
  return (millimetres / 1_000).toFixed(1);
}

export function getConfiguratorDockSummary(
  configuration: CustomerPergolaConfigurationV1,
): string {
  const pergola = configuration.intent.pergola;
  const roof = pergola.roof.system === 'acrylic'
    ? TINT_LABELS[pergola.roof.tint]
    : pergola.roof.system === 'mixed'
      ? 'Timber + acrylic'
      : 'Timber sarking';
  const optionCount = pergola.edgeTreatments.filter(({ treatment }) => treatment.kind !== 'none').length
    + (pergola.lighting.downlights === 'none' ? 0 : 1)
    + (pergola.lighting.ledStripInterest ? 1 : 0)
    + (pergola.heatingInterest === 'interested' ? 1 : 0);
  return [
    FAMILY_LABELS[pergola.family],
    `${formatMetres(pergola.dimensions.lengthMm)} × ${formatMetres(pergola.dimensions.projectionMm)} m`,
    roof,
    optionCount > 0 ? `${optionCount} option${optionCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ');
}

function isEditableElement(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.matches('input, textarea, select, [contenteditable="true"]')
    || Boolean(target.closest('[contenteditable="true"]'))
  );
}

function useDockSuppressedForInput(): boolean {
  const [suppressed, setSuppressed] = useState(false);
  useEffect(() => {
    const updateFocusedState = () => setSuppressed(isEditableElement(document.activeElement));
    const handleFocusIn = (event: FocusEvent) => setSuppressed(isEditableElement(event.target));
    const handleFocusOut = () => window.requestAnimationFrame(updateFocusedState);
    const handleViewport = () => {
      const viewport = window.visualViewport;
      setSuppressed(isEditableElement(document.activeElement) || Boolean(
        viewport && viewport.height < window.innerHeight * 0.72,
      ));
    };
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    window.visualViewport?.addEventListener('resize', handleViewport);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      window.visualViewport?.removeEventListener('resize', handleViewport);
    };
  }, []);
  return suppressed;
}

export default function ConfiguratorDock() {
  const pathname = usePathname();
  const policy = getConfiguratorRoutePolicy(pathname);
  const store = useConfiguratorStore();
  const snapshot = useConfiguratorSnapshot();
  const suppressedForInput = useDockSuppressedForInput();
  const configured = snapshot.configuration !== null;
  const visible = snapshot.hydrated
    && policy.enabled
    && !suppressedForInput
    && (configured || snapshot.engaged || policy.initialDockVisibility === 'immediate');
  if (!visible) return null;

  const importantStatus = snapshot.saveStatus === 'memory_only'
    || snapshot.saveStatus === 'recovery_required';

  return (
    <aside
      className={styles.dock}
      aria-label="Your pergola"
      data-configurator-dock
      data-configurator-state={configured ? 'configured' : 'empty'}
      data-route-policy={policy.reason}
    >
      <div className={styles.copy}>
        <p className={styles.label}>Your pergola</p>
        <p className={configured ? styles.summary : styles.emptySummary}>
          {snapshot.configuration
            ? getConfiguratorDockSummary(snapshot.configuration)
            : 'A design to carry through the site.'}
        </p>
        <p
          className={importantStatus ? styles.status : styles.statusVisuallyHidden}
          aria-live="polite"
          data-configurator-save-status={snapshot.saveStatus}
        >
          {snapshot.saveStatusMessage}
        </p>
      </div>
      <div className={styles.actions}>
        {configured ? (
          <button type="button" className={styles.secondaryAction} onClick={() => store.reset()}>
            Reset
          </button>
        ) : null}
        <button type="button" className={styles.primaryAction} onClick={() => store.requestOpen()}>
          {configured ? 'Edit' : 'Start designing'}
        </button>
      </div>
    </aside>
  );
}
