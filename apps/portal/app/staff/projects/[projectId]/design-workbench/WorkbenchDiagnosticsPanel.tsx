'use client';

import {
  labelForRoofApproximationReason,
  labelForRoofFieldSource,
  labelForRoofGeometryKind,
} from '@/components/drawings/rail/objectRailShared';
import type { GeometryPreviewState } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
import type {
  DrawingWorkbenchCompatibilitySelectionState,
  DrawingWorkbenchUiState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { ObjectWorkbenchInspectorFacade } from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import styles from './DesignWorkbenchEstimateClient.module.css';

type WorkbenchDiagnosticsPanelProps = {
  objectWorkbench: ObjectWorkbenchInspectorFacade;
  ui: DrawingWorkbenchUiState;
  compatibilitySelection: DrawingWorkbenchCompatibilitySelectionState;
  geometryPreview: GeometryPreviewState;
};

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : null;
}

function metadataNumber(metadata: Record<string, unknown> | undefined, key: string): number | null {
  const value = metadata?.[key];
  return typeof value === 'number' ? value : null;
}

function numericStringValue(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatRoofPitchDeg(value: number | null): string {
  if (value === null) return 'none';
  return `${Number.isInteger(value) ? value : Number(value.toFixed(2))} deg`;
}

function formatRidgeAxis(value: string | null, notUsedLabel: string): string {
  if (!value) return notUsedLabel;
  return `Ridge ${value.toUpperCase()}`;
}

export default function WorkbenchDiagnosticsPanel({
  objectWorkbench,
  ui,
  compatibilitySelection,
  geometryPreview,
}: WorkbenchDiagnosticsPanelProps) {
  const diagnostics = objectWorkbench.diagnostics;
  const roof = diagnostics.roof;
  const roofControls = roof.controls;
  const roofControlNotUsedLabel = 'Not used for this roof';
  const roofPitchSourceLabel = roofControls?.pitch
    ? labelForRoofFieldSource(roof.provenance.primaryPitchDeg)
    : roofControlNotUsedLabel;
  const roofFallSourceLabel = roofControls?.primaryFallDirection
    ? labelForRoofFieldSource(roof.provenance.primaryFallDirection)
    : roofControlNotUsedLabel;
  const roofRidgeSourceLabel = roofControls?.ridgeAxis
    ? labelForRoofFieldSource(roof.provenance.ridgeAxis)
    : roofControlNotUsedLabel;
  const roofOpenEndSourceLabel = roof.intent.form === 'hipped'
    ? labelForRoofFieldSource(roof.provenance.openGableEndIds)
    : roofControlNotUsedLabel;
  const sceneMetadata = geometryPreview.kind === 'ready' ? geometryPreview.scene.metadata : undefined;
  const sceneRoofQaStatusLabel = metadataString(sceneMetadata, 'houseRoofQaStatus') ?? 'not available';
  const sceneRoofExpectedSolidCount = metadataNumber(sceneMetadata, 'houseRoofSolidExpectedCount') ?? 0;
  const sceneRoofRenderedSolidCount =
    metadataNumber(sceneMetadata, 'houseRoofSolidRenderedCount') ??
    metadataNumber(sceneMetadata, 'houseRoofSolidSceneCount') ??
    0;
  const sceneRoofSkippedSolidCount = metadataNumber(sceneMetadata, 'houseRoofSolidSkippedCount') ?? 0;
  const sceneRoofSolidsLabel =
    `${sceneRoofRenderedSolidCount}/${sceneRoofExpectedSolidCount} rendered, ${sceneRoofSkippedSolidCount} skipped`;
  const sceneRoofGeometryKind = metadataString(sceneMetadata, 'houseRoofGeometryKind') ?? roof.geometryKind;
  const sceneRoofGeometryLabel = labelForRoofGeometryKind(sceneRoofGeometryKind);
  const healedRoofPitchDeg =
    metadataNumber(sceneMetadata, 'houseRoofHealedPitchDeg') ?? numericStringValue(roof.intent.primaryPitchDeg);
  const healedRoofRidgeAxis = metadataString(sceneMetadata, 'houseRoofHealedRidgeAxis') ?? (
    roofControls?.ridgeAxis ? roof.intent.ridgeAxis : null
  );
  const healedRoofRidgeLabel = roofControls?.ridgeAxis
    ? formatRidgeAxis(healedRoofRidgeAxis, 'none')
    : roofControlNotUsedLabel;

  return (
    <section className={styles.moduleSection}>
      <p className={styles.moduleSectionTitle}>Object diagnostics</p>
      <div className={styles.diagnosticsList}>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Canonical tab</span>
          <span className={styles.diagnosticValue}>{ui.activeRailTab}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Selection family</span>
          <span className={styles.diagnosticValue}>{ui.activeObjectFamily}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Workbench mode</span>
          <span className={styles.diagnosticValue}>{compatibilitySelection.workbenchMode}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Active trust</span>
          <span className={styles.diagnosticValue}>{diagnostics.activeTrustLabel}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Trust issues</span>
          <span className={styles.diagnosticValue}>
            {diagnostics.activeTrust.issues.join(', ') || 'none'}
          </span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>House forms</span>
          <span className={styles.diagnosticValue}>{diagnostics.houseCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Pergolas</span>
          <span className={styles.diagnosticValue}>{diagnostics.pergolaCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Deck count</span>
          <span className={styles.diagnosticValue}>{diagnostics.deckCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Opening count</span>
          <span className={styles.diagnosticValue}>{diagnostics.openingCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Attachment zones</span>
          <span className={styles.diagnosticValue}>{diagnostics.attachmentZoneCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Attachment zone kinds</span>
          <span className={styles.diagnosticValue}>{diagnostics.attachmentZoneKindsSummary}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Attachment zone blocks</span>
          <span className={styles.diagnosticValue}>{diagnostics.attachmentZoneBlockedSummary}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Resolved pergola zones</span>
          <span className={styles.diagnosticValue}>{diagnostics.resolvedPergolaAttachmentZoneCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Unresolved pergola zones</span>
          <span className={styles.diagnosticValue}>{diagnostics.unresolvedPergolaAttachmentZoneCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Slider openings</span>
          <span className={styles.diagnosticValue}>{diagnostics.sliderOpeningCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Invalid openings</span>
          <span className={styles.diagnosticValue}>{diagnostics.invalidOpeningCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Preset decks snapped</span>
          <span className={styles.diagnosticValue}>{diagnostics.snappedPresetDeckCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Preset decks floating</span>
          <span className={styles.diagnosticValue}>{diagnostics.floatingPresetDeckCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Custom decks</span>
          <span className={styles.diagnosticValue}>{diagnostics.customDeckCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Invalid decks</span>
          <span className={styles.diagnosticValue}>{diagnostics.invalidDeckCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Deck support warnings</span>
          <span className={styles.diagnosticValue}>{diagnostics.deckSupportWarningCount}</span>
        </div>
        {diagnostics.activeDeckSupport ? (
          <>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Active host side</span>
              <span className={styles.diagnosticValue}>{diagnostics.activeDeckSupport.activeHostSide}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Active-side deck present</span>
              <span className={styles.diagnosticValue}>
                {diagnostics.activeDeckSupport.hasRelevantDeck ? 'Yes' : 'No'}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Deck support class</span>
              <span className={styles.diagnosticValue}>{diagnostics.activeDeckSupport.resolvedClassification}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Deck bracket eligible</span>
              <span className={styles.diagnosticValue}>
                {diagnostics.activeDeckSupport.deckBracketEligible ? 'Yes' : 'No'}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Deck support codes</span>
              <span className={styles.diagnosticValue}>
                {diagnostics.activeDeckSupport.warningCodes.join(', ') || 'none'}
              </span>
            </div>
          </>
        ) : null}
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Selected deck id</span>
          <span className={styles.diagnosticValue}>{diagnostics.activeDeckId ?? 'none'}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Selected opening id</span>
          <span className={styles.diagnosticValue}>{diagnostics.activeOpeningId ?? 'none'}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>House polygon source</span>
          <span className={styles.diagnosticValue}>
            {diagnostics.footprintSource}
          </span>
        </div>
        {diagnostics.activeDeckInteraction ? (
          <>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Selected deck type</span>
              <span className={styles.diagnosticValue}>{diagnostics.activeDeckInteraction.selectedDeckType}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Deck drag eligible</span>
              <span className={styles.diagnosticValue}>
                {diagnostics.activeDeckInteraction.dragEligible ? 'Yes' : 'No'}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Deck drag reason</span>
              <span className={styles.diagnosticValue}>{diagnostics.activeDeckInteraction.dragReason ?? 'none'}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Deck host-edge resolvable</span>
              <span className={styles.diagnosticValue}>
                {diagnostics.activeDeckInteraction.hostEdgeResolvable ? 'Yes' : 'No'}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Deck relationship dims</span>
              <span className={styles.diagnosticValue}>
                {diagnostics.activeDeckInteraction.relationshipDimensionsAvailable ? 'Yes' : 'No'}
              </span>
            </div>
          </>
        ) : null}
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Warnings</span>
          <span className={styles.diagnosticValue}>{diagnostics.migrationWarningCount}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Low confidence</span>
          <span className={styles.diagnosticValue}>{diagnostics.lowConfidence ? 'Yes' : 'No'}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Selected roof form</span>
          <span className={styles.diagnosticValue}>{roof.intent.form ?? 'none'}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof status</span>
          <span className={styles.diagnosticValue}>
            {roof.validationStatus === 'invalid'
              ? 'Blocked'
              : roof.validationStatus === 'approximate'
                ? 'Approximate'
                : roof.validationStatus === 'valid'
                  ? 'Ready'
                  : 'none'}
          </span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof approximation reasons</span>
          <span className={styles.diagnosticValue}>
            {roof.approximationReasons.map((reason) => labelForRoofApproximationReason(reason)).join(', ') || 'none'}
          </span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof reason code</span>
          <span className={styles.diagnosticValue}>{roof.validationCode ?? 'none'}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof geometry</span>
          <span className={styles.diagnosticValue}>{labelForRoofGeometryKind(roof.geometryKind)}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>3D roof QA</span>
          <span className={styles.diagnosticValue}>{sceneRoofQaStatusLabel}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>3D roof solids</span>
          <span className={styles.diagnosticValue}>{sceneRoofSolidsLabel}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>3D roof geometry</span>
          <span className={styles.diagnosticValue}>{sceneRoofGeometryLabel}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Healed roof pitch</span>
          <span className={styles.diagnosticValue}>{formatRoofPitchDeg(healedRoofPitchDeg)}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Healed roof ridge</span>
          <span className={styles.diagnosticValue}>{healedRoofRidgeLabel}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof form source</span>
          <span className={styles.diagnosticValue}>{labelForRoofFieldSource(roof.provenance.form)}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof material source</span>
          <span className={styles.diagnosticValue}>{labelForRoofFieldSource(roof.provenance.material)}</span>
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
        {roof.validationMessage ? (
          <div className={styles.diagnosticRow}>
            <span className={styles.diagnosticLabel}>Roof note</span>
            <span className={styles.diagnosticValue}>{roof.validationMessage}</span>
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
