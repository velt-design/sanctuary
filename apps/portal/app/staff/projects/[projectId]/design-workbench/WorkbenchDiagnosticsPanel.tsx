'use client';

import { useMemo } from 'react';
import { getHouseRoofFormBehavior } from '@sp/geometry';
import {
  labelForAttachmentSideList,
  labelForRoofApproximationReason,
  labelForRoofFieldSource,
  labelForRoofGeometryKind,
} from '@/components/drawings/rail/objectRailShared';
import type { GeometryPreviewState } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
import type { DrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import styles from './DesignWorkbenchEstimateClient.module.css';

type WorkbenchDiagnosticsPanelProps = {
  store: DrawingWorkbenchStore;
  geometryPreview: GeometryPreviewState;
};

export default function WorkbenchDiagnosticsPanel({
  store,
  geometryPreview,
}: WorkbenchDiagnosticsPanelProps) {
  const attachmentZoneKindsSummary = useMemo(() => {
    const zones = store.derived.house?.attachmentZones ?? [];
    if (!zones.length) return 'none';
    const zonesBySide = new Map<string, Set<string>>();
    for (const zone of zones) {
      const existing = zonesBySide.get(zone.side) ?? new Set<string>();
      existing.add(zone.kind);
      zonesBySide.set(zone.side, existing);
    }
    return Array.from(zonesBySide.entries())
      .map(([side, kinds]) => `${side}: ${Array.from(kinds).join(', ')}`)
      .join(' | ');
  }, [store.derived.house?.attachmentZones]);
  const attachmentZoneBlockedSummary = useMemo(() => {
    const blocked = store.derived.house?.attachmentZoneDiagnostics.blocked ?? [];
    if (!blocked.length) return 'none';
    return Array.from(
      new Set(blocked.map((entry) => `${entry.side} ${entry.kind} (${entry.reason})`)),
    ).join(' | ');
  }, [store.derived.house?.attachmentZoneDiagnostics.blocked]);
  const resolvedPergolaAttachmentZoneCount = useMemo(
    () =>
      store.derived.pergolas.filter(
        (pergola) =>
          pergola.attachment.kind !== 'freestanding' &&
          pergola.attachment.resolution.status === 'resolved' &&
          pergola.attachment.attachmentZoneId !== null,
      ).length,
    [store.derived.pergolas],
  );
  const unresolvedPergolaAttachmentZoneCount = useMemo(
    () =>
      store.derived.pergolas.filter(
        (pergola) =>
          pergola.attachment.kind !== 'freestanding' &&
          pergola.attachment.resolution.status !== 'resolved',
      ).length,
    [store.derived.pergolas],
  );
  const roofControls = store.derived.roofForm
    ? getHouseRoofFormBehavior(store.derived.roofForm).controls
    : null;
  const roofControlNotUsedLabel = 'Not used for this roof';
  const roofPitchSourceLabel = roofControls?.pitch
    ? labelForRoofFieldSource(store.derived.roofProvenance?.primaryPitchDeg)
    : roofControlNotUsedLabel;
  const roofFallSourceLabel = roofControls?.primaryFallDirection
    ? labelForRoofFieldSource(store.derived.roofProvenance?.primaryFallDirection)
    : roofControlNotUsedLabel;
  const roofRidgeSourceLabel = roofControls?.ridgeAxis
    ? labelForRoofFieldSource(store.derived.roofProvenance?.ridgeAxis)
    : roofControlNotUsedLabel;
  const roofOpenEndSourceLabel = store.derived.roofForm === 'gable'
    ? labelForRoofFieldSource(store.derived.roofProvenance?.openGableEndIds)
    : roofControlNotUsedLabel;
  const roofAppendageRelevant = Boolean(roofControls?.appendage);
  const roofAppendageSourceLabel = roofAppendageRelevant
    ? labelForRoofFieldSource(store.derived.roofProvenance?.appendage)
    : roofControlNotUsedLabel;
  const roofAppendageStatusLabel = roofAppendageRelevant
    ? store.derived.roofAppendageStatus
    : roofControlNotUsedLabel;
  const roofAppendageSupportLabel = roofAppendageRelevant
    ? store.derived.roofAppendageSupportReason ??
      (store.derived.roofAppendageSupportedHostEdges.length > 0 ? 'Supported' : 'Not supported')
    : roofControlNotUsedLabel;
  const roofAppendageSupportedEdgesLabel = roofAppendageRelevant
    ? labelForAttachmentSideList(store.derived.roofAppendageSupportedHostEdges)
    : roofControlNotUsedLabel;

  return (
    <section className={styles.moduleSection}>
      <p className={styles.moduleSectionTitle}>Migration diagnostics</p>
      <div className={styles.diagnosticsList}>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Canonical tab</span>
          <span className={styles.diagnosticValue}>{store.ui.activeRailTab}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Selection family</span>
          <span className={styles.diagnosticValue}>{store.ui.activeObjectFamily}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Compatibility mode</span>
          <span className={styles.diagnosticValue}>{store.ui.workbenchMode}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Derived houses</span>
          <span className={styles.diagnosticValue}>{store.derived.houseCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Pergolas</span>
          <span className={styles.diagnosticValue}>{store.derived.pergolas.length}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Deck count</span>
          <span className={styles.diagnosticValue}>{store.derived.deckCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Opening count</span>
          <span className={styles.diagnosticValue}>{store.derived.openingCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Attachment zones</span>
          <span className={styles.diagnosticValue}>{store.derived.house?.attachmentZones.length ?? 0}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Attachment zone kinds</span>
          <span className={styles.diagnosticValue}>{attachmentZoneKindsSummary}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Attachment zone blocks</span>
          <span className={styles.diagnosticValue}>{attachmentZoneBlockedSummary}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Resolved pergola zones</span>
          <span className={styles.diagnosticValue}>{resolvedPergolaAttachmentZoneCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Unresolved pergola zones</span>
          <span className={styles.diagnosticValue}>{unresolvedPergolaAttachmentZoneCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Slider openings</span>
          <span className={styles.diagnosticValue}>{store.derived.sliderOpeningCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Invalid openings</span>
          <span className={styles.diagnosticValue}>{store.derived.invalidOpeningCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Preset decks snapped</span>
          <span className={styles.diagnosticValue}>{store.derived.snappedPresetDeckCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Preset decks floating</span>
          <span className={styles.diagnosticValue}>{store.derived.floatingPresetDeckCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Custom decks</span>
          <span className={styles.diagnosticValue}>{store.derived.customDeckCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Invalid decks</span>
          <span className={styles.diagnosticValue}>{store.derived.invalidDeckCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Deck support warnings</span>
          <span className={styles.diagnosticValue}>{store.derived.deckSupportWarningCount}</span>
        </div>
        {store.derived.activeDeckSupport ? (
          <>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Active host side</span>
              <span className={styles.diagnosticValue}>{store.derived.activeDeckSupport.activeHostSide}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Active-side deck present</span>
              <span className={styles.diagnosticValue}>
                {store.derived.activeDeckSupport.hasRelevantDeck ? 'Yes' : 'No'}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Deck support class</span>
              <span className={styles.diagnosticValue}>{store.derived.activeDeckSupport.resolvedClassification}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Deck bracket eligible</span>
              <span className={styles.diagnosticValue}>
                {store.derived.activeDeckSupport.deckBracketEligible ? 'Yes' : 'No'}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Deck support codes</span>
              <span className={styles.diagnosticValue}>
                {store.derived.activeDeckSupport.warningCodes.join(', ') || 'none'}
              </span>
            </div>
          </>
        ) : null}
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Selected deck id</span>
          <span className={styles.diagnosticValue}>{store.derived.activeDeckId ?? 'none'}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Selected opening id</span>
          <span className={styles.diagnosticValue}>{store.derived.activeOpeningId ?? 'none'}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>House polygon source</span>
          <span className={styles.diagnosticValue}>
            {store.derived.house?.footprint.mode === 'custom_polygon' ? 'custom_saved' : 'preset_derived'}
          </span>
        </div>
        {store.derived.activeDeckInteraction ? (
          <>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Selected deck type</span>
              <span className={styles.diagnosticValue}>{store.derived.activeDeckInteraction.selectedDeckType}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Deck drag eligible</span>
              <span className={styles.diagnosticValue}>
                {store.derived.activeDeckInteraction.dragEligible ? 'Yes' : 'No'}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Deck drag reason</span>
              <span className={styles.diagnosticValue}>{store.derived.activeDeckInteraction.dragReason ?? 'none'}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Deck host-edge resolvable</span>
              <span className={styles.diagnosticValue}>
                {store.derived.activeDeckInteraction.hostEdgeResolvable ? 'Yes' : 'No'}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Deck relationship dims</span>
              <span className={styles.diagnosticValue}>
                {store.derived.activeDeckInteraction.relationshipDimensionsAvailable ? 'Yes' : 'No'}
              </span>
            </div>
          </>
        ) : null}
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Warnings</span>
          <span className={styles.diagnosticValue}>{store.derived.migrationWarningCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Low confidence</span>
          <span className={styles.diagnosticValue}>{store.derived.houseIsLowConfidence ? 'Yes' : 'No'}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Selected roof form</span>
          <span className={styles.diagnosticValue}>{store.derived.roofForm ?? 'none'}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof status</span>
          <span className={styles.diagnosticValue}>
            {store.derived.roofReviewStatus === 'blocked'
              ? 'Blocked'
              : store.derived.roofReviewStatus === 'approximate'
                ? 'Approximate'
                : store.derived.roofReviewStatus === 'ready'
                  ? 'Ready'
                  : 'none'}
          </span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof approximation reasons</span>
          <span className={styles.diagnosticValue}>
            {store.derived.roofApproximationReasons.map((reason) => labelForRoofApproximationReason(reason)).join(', ') || 'none'}
          </span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof reason code</span>
          <span className={styles.diagnosticValue}>{store.derived.roofValidationCode ?? 'none'}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof geometry</span>
          <span className={styles.diagnosticValue}>{labelForRoofGeometryKind(store.derived.roofGeometryKind)}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof form source</span>
          <span className={styles.diagnosticValue}>{labelForRoofFieldSource(store.derived.roofProvenance?.form)}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof material source</span>
          <span className={styles.diagnosticValue}>{labelForRoofFieldSource(store.derived.roofProvenance?.material)}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof pitch source</span>
          <span className={styles.diagnosticValue}>{roofPitchSourceLabel}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof fall source</span>
          <span className={styles.diagnosticValue}>{roofFallSourceLabel}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof ridge source</span>
          <span className={styles.diagnosticValue}>{roofRidgeSourceLabel}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof open-end source</span>
          <span className={styles.diagnosticValue}>{roofOpenEndSourceLabel}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof appendage source</span>
          <span className={styles.diagnosticValue}>{roofAppendageSourceLabel}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof appendage</span>
          <span className={styles.diagnosticValue}>{roofAppendageStatusLabel}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Appendage support</span>
          <span className={styles.diagnosticValue}>{roofAppendageSupportLabel}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Appendage supported edges</span>
          <span className={styles.diagnosticValue}>{roofAppendageSupportedEdgesLabel}</span>
        </div>
        {store.derived.roofValidationMessage ? (
          <div className={styles.diagnosticRow}>
            <span className={styles.diagnosticLabel}>Roof note</span>
            <span className={styles.diagnosticValue}>{store.derived.roofValidationMessage}</span>
          </div>
        ) : null}
        {geometryPreview.kind !== 'error' ? (
          <>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>3D deck host side</span>
              <span className={styles.diagnosticValue}>{geometryPreview.deckSupport.activeHostSide}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>3D deck present</span>
              <span className={styles.diagnosticValue}>
                {geometryPreview.deckSupport.hasRelevantDeck ? 'Yes' : 'No'}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>3D deck class</span>
              <span className={styles.diagnosticValue}>{geometryPreview.deckSupport.resolvedClassification}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>3D deck bracket</span>
              <span className={styles.diagnosticValue}>
                {geometryPreview.deckSupport.deckBracketEligible ? 'Yes' : 'No'}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>3D deck warnings</span>
              <span className={styles.diagnosticValue}>
                {geometryPreview.deckSupport.warningCodes.join(', ') || 'none'}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>3D opening count</span>
              <span className={styles.diagnosticValue}>
                {String(geometryPreview.kind === 'ready' ? geometryPreview.scene.metadata?.houseOpeningCount ?? 0 : 0)}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>3D attachment zones</span>
              <span className={styles.diagnosticValue}>
                {String(geometryPreview.kind === 'ready' ? geometryPreview.scene.metadata?.houseAttachmentZoneCount ?? 0 : 0)}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>3D zone kinds</span>
              <span className={styles.diagnosticValue}>
                {String(
                  geometryPreview.kind === 'ready'
                    ? geometryPreview.scene.metadata?.houseAttachmentZoneKinds ?? 'none'
                    : 'none',
                )}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>3D zone blocks</span>
              <span className={styles.diagnosticValue}>
                {String(
                  geometryPreview.kind === 'ready'
                    ? geometryPreview.scene.metadata?.houseAttachmentZoneBlockedReasons ?? 'none'
                    : 'none',
                )}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>3D resolved pergola zones</span>
              <span className={styles.diagnosticValue}>
                {String(
                  geometryPreview.kind === 'ready'
                    ? geometryPreview.scene.metadata?.pergolaResolvedAttachmentZoneCount ?? 0
                    : 0,
                )}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>3D unresolved pergola zones</span>
              <span className={styles.diagnosticValue}>
                {String(
                  geometryPreview.kind === 'ready'
                    ? geometryPreview.scene.metadata?.pergolaUnresolvedAttachmentZoneCount ?? 0
                    : 0,
                )}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>3D valid openings</span>
              <span className={styles.diagnosticValue}>
                {String(geometryPreview.kind === 'ready' ? geometryPreview.scene.metadata?.houseOpeningValidCount ?? 0 : 0)}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>3D host edges resolved</span>
              <span className={styles.diagnosticValue}>
                {String(
                  geometryPreview.kind === 'ready'
                    ? geometryPreview.scene.metadata?.houseOpeningHostEdgeResolvedCount ?? 0
                    : 0,
                )}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>3D host edges unresolved</span>
              <span className={styles.diagnosticValue}>
                {String(
                  geometryPreview.kind === 'ready'
                    ? geometryPreview.scene.metadata?.houseOpeningHostEdgeUnresolvedCount ?? 0
                    : 0,
                )}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>3D rendered markers</span>
              <span className={styles.diagnosticValue}>
                {String(
                  geometryPreview.kind === 'ready'
                    ? geometryPreview.scene.metadata?.houseOpeningRenderedMarkerCount ?? 0
                    : 0,
                )}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>3D skipped invalid</span>
              <span className={styles.diagnosticValue}>
                {String(
                  geometryPreview.kind === 'ready'
                    ? geometryPreview.scene.metadata?.houseOpeningSkippedInvalidCount ?? 0
                    : 0,
                )}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>3D unresolved valid</span>
              <span className={styles.diagnosticValue}>
                {String(
                  geometryPreview.kind === 'ready'
                    ? geometryPreview.scene.metadata?.houseOpeningUnresolvedValidCount ?? 0
                    : 0,
                )}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
