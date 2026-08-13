'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  previewVariantForSelection,
  type PreviewBlindsOption,
  type PreviewCustomerType,
  type PreviewDisplayMode,
  type PreviewLayoutId,
  type PreviewRoofForm,
  type PreviewTheme,
  type PreviewViewport,
  type PreviewZoom,
} from './emailPreviewOptions';
import { loadEmailPreview, sendEmailPreview } from './emailPreviewApi';
import type {
  DeliveryConfirmation,
  DeliveryState,
  LayoutPreview,
  PreviewResponse,
} from './emailPreviewTypes';

const DEFAULTS = {
  customerType: 'residential',
  roofForm: 'pitched',
  blinds: 'without-blinds',
  displayMode: 'compare',
  selectedLayoutId: 'editorial-refined',
  viewport: 'desktop',
  theme: 'light',
  zoom: 50,
} as const;

function deliveryLabel(layouts: readonly LayoutPreview[]): string {
  if (layouts.length === 1) return layouts[0]?.name ?? 'selected layout';
  return `all ${layouts.length} alternatives`;
}

export function useEmailPreviewWorkbench(previewEndpoint?: string) {
  const [customerType, setCustomerType] =
    useState<PreviewCustomerType>(DEFAULTS.customerType);
  const [roofForm, setRoofForm] =
    useState<PreviewRoofForm>(DEFAULTS.roofForm);
  const [blinds, setBlinds] =
    useState<PreviewBlindsOption>(DEFAULTS.blinds);
  const [displayMode, setDisplayMode] =
    useState<PreviewDisplayMode>(DEFAULTS.displayMode);
  const [selectedLayoutId, setSelectedLayoutId] =
    useState<PreviewLayoutId>(DEFAULTS.selectedLayoutId);
  const [viewport, setViewport] =
    useState<PreviewViewport>(DEFAULTS.viewport);
  const [theme, setTheme] = useState<PreviewTheme>(DEFAULTS.theme);
  const [zoom, setZoom] = useState<PreviewZoom>(DEFAULTS.zoom);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [renderRevision, setRenderRevision] = useState(0);
  const [deliveryConfirmation, setDeliveryConfirmation] =
    useState<DeliveryConfirmation | null>(null);
  const [delivery, setDelivery] =
    useState<DeliveryState>({ status: 'idle' });

  const variant = previewVariantForSelection(
    customerType,
    roofForm,
    blinds,
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    setPreview(null);
    setDeliveryConfirmation(null);
    setDelivery({ status: 'idle' });

    void loadEmailPreview(variant, controller.signal, previewEndpoint)
      .then((body) => {
        if (body.variant !== variant) {
          throw new Error('The preview response did not match the selected enquiry.');
        }
        setPreview(body);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(
          caught instanceof Error
            ? caught.message
            : 'Unable to load these email previews.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [previewEndpoint, renderRevision, variant]);

  const selectedLayout = useMemo(
    () =>
      preview?.layouts.find((layout) => layout.id === selectedLayoutId)
      ?? preview?.layouts[0]
      ?? null,
    [preview, selectedLayoutId],
  );

  const isSending = delivery.status === 'sending';
  const controlsLocked = isSending || Boolean(deliveryConfirmation);

  function refresh() {
    if (controlsLocked) return;
    setRenderRevision((revision) => revision + 1);
  }

  function reset() {
    if (controlsLocked) return;
    setCustomerType(DEFAULTS.customerType);
    setRoofForm(DEFAULTS.roofForm);
    setBlinds(DEFAULTS.blinds);
    setDisplayMode(DEFAULTS.displayMode);
    setSelectedLayoutId(DEFAULTS.selectedLayoutId);
    setViewport(DEFAULTS.viewport);
    setTheme(DEFAULTS.theme);
    setZoom(DEFAULTS.zoom);
    setRenderRevision((revision) => revision + 1);
  }

  function requestDelivery(layouts: readonly LayoutPreview[]) {
    if (!preview?.sendReady || isSending || layouts.length === 0) return;
    setDelivery({ status: 'idle' });
    setDeliveryConfirmation({
      layoutIds: layouts.map((layout) => layout.id),
      label: deliveryLabel(layouts),
    });
  }

  function requestSelectedDelivery() {
    if (selectedLayout) requestDelivery([selectedLayout]);
  }

  function requestAllDelivery() {
    if (preview) requestDelivery(preview.layouts);
  }

  function cancelDelivery() {
    if (isSending) return;
    setDeliveryConfirmation(null);
  }

  async function deliverLayouts(layoutIds: readonly PreviewLayoutId[]) {
    if (!preview?.sendReady || layoutIds.length === 0) return;
    const recipient = preview.recipient ?? 'the configured review inbox';
    const acceptedLayoutIds: PreviewLayoutId[] = [];

    for (const [index, layoutId] of layoutIds.entries()) {
      setDelivery({
        status: 'sending',
        completed: index,
        total: layoutIds.length,
        currentLayout: layoutId,
      });
      try {
        await sendEmailPreview(variant, layoutId, previewEndpoint);
        acceptedLayoutIds.push(layoutId);
      } catch (caught) {
        setDelivery({
          status: 'error',
          acceptedLayoutIds,
          failedLayoutId: layoutId,
          message:
            caught instanceof Error
              ? caught.message
              : 'Unable to send this email preview.',
        });
        return;
      }
    }

    setDelivery({
      status: 'success',
      acceptedLayoutIds,
      recipient,
    });
  }

  async function confirmDelivery() {
    if (!deliveryConfirmation || isSending) return;
    const layoutIds = deliveryConfirmation.layoutIds;
    setDeliveryConfirmation(null);
    await deliverLayouts(layoutIds);
  }

  async function retryFailedDelivery() {
    if (delivery.status !== 'error' || isSending) return;
    await deliverLayouts([delivery.failedLayoutId]);
  }

  function dismissDeliveryFeedback() {
    if (!isSending) setDelivery({ status: 'idle' });
  }

  return {
    customerType,
    setCustomerType,
    roofForm,
    setRoofForm,
    blinds,
    setBlinds,
    displayMode,
    setDisplayMode,
    selectedLayoutId,
    setSelectedLayoutId,
    viewport,
    setViewport,
    theme,
    setTheme,
    zoom,
    setZoom,
    variant,
    preview,
    selectedLayout,
    loading,
    loadError,
    renderRevision,
    deliveryConfirmation,
    delivery,
    isSending,
    controlsLocked,
    refresh,
    reset,
    requestSelectedDelivery,
    requestAllDelivery,
    cancelDelivery,
    confirmDelivery,
    retryFailedDelivery,
    dismissDeliveryFeedback,
  };
}

export type EmailPreviewWorkbenchController =
  ReturnType<typeof useEmailPreviewWorkbench>;
