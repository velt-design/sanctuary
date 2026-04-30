'use client';

import { useCallback, useMemo, useState } from 'react';
import { type ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import SanctuaryWorkbenchRail from '@/components/drawings/rail/SanctuaryWorkbenchRail';
import { labelForAttachmentSideList } from '@/components/drawings/rail/objectRailShared';
import type {
  GeometryEditIntent,
  GeometryEditState,
} from '@/lib/drawings/geometry/geometryEditAdapter';
import type { HouseAssemblyModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { PergolaModel } from '@/lib/drawings/state/houseFirstWorkbenchModel';
import type {
  CalculatorHouseAttachmentStrategy,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import type { CommitResult } from './objectWorkbenchClientTypes';
import styles from './DesignWorkbenchEstimateClient.module.css';

type PergolaAttachmentKind = PergolaModel['attachment']['kind'];
type PergolaAttachmentStrategyValue = CalculatorHouseAttachmentStrategy | 'auto';

type PergolaInspectorModule = {
  id: string;
  label: string;
  pergolaId: string | null;
};

type PergolaInspectorProps = {
  activePergolaModel: PergolaModel | null;
  activeModuleInput: CalculatorModuleInputs | null;
  activeModuleIndex: number;
  activeModuleLabel: string;
  disabled?: boolean;
  geometryState: GeometryEditState | null;
  houseAssembly: HouseAssemblyModel | null;
  modules: PergolaInspectorModule[];
  supportsSanctuaryEditing: boolean;
  view: ModuleViewsTab;
  onOpenHouseForms: () => void;
  onSelectPergolaByModule: (pergolaId: string | null) => void;
  onStartDrawOutline?: () => Promise<CommitResult> | CommitResult;
  onCommitGeometryEdit?: (intent: GeometryEditIntent) => Promise<CommitResult> | CommitResult;
  onCommitConnectionKind?: (
    pergolaId: string,
    kind: PergolaAttachmentKind,
  ) => Promise<CommitResult> | CommitResult;
  onCommitAttachmentStrategy?: (
    pergolaId: string,
    strategy: PergolaAttachmentStrategyValue,
  ) => Promise<CommitResult> | CommitResult;
  onCommitAttachmentEdge?: (pergolaId: string, edgeId: string) => Promise<CommitResult> | CommitResult;
  onCommitAttachmentZone?: (pergolaId: string, zoneId: string) => Promise<CommitResult> | CommitResult;
};

const PERGOLA_CONNECTION_OPTIONS = [
  { value: 'soffit', label: 'Soffit attached' },
  { value: 'fascia', label: 'Fascia attached' },
  { value: 'wall', label: 'Wall attached' },
  { value: 'freestanding', label: 'Freestanding' },
] as const;

const PERGOLA_ATTACHMENT_STRATEGY_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'soffit_brackets', label: 'Soffit brackets' },
  { value: 'fascia_under_gutter', label: 'Fascia under gutter' },
  { value: 'facade_ledger', label: 'Facade ledger' },
  { value: 'post_supported_tieback', label: 'Post supported tieback' },
  { value: 'none', label: 'None' },
] as const;

function resolvePergolaZoneKind(
  kind: PergolaAttachmentKind,
): 'wall' | 'soffit' | 'fascia' | null {
  if (kind === 'freestanding') return null;
  if (kind === 'wall') return 'wall';
  return kind;
}

export default function PergolaInspector({
  activePergolaModel,
  activeModuleInput,
  activeModuleIndex,
  activeModuleLabel,
  disabled = false,
  geometryState,
  houseAssembly,
  modules,
  supportsSanctuaryEditing,
  view,
  onOpenHouseForms,
  onSelectPergolaByModule,
  onStartDrawOutline,
  onCommitGeometryEdit,
  onCommitConnectionKind,
  onCommitAttachmentStrategy,
  onCommitAttachmentEdge,
  onCommitAttachmentZone,
}: PergolaInspectorProps) {
  const [pendingFieldId, setPendingFieldId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const activePergolaZoneKind = activePergolaModel
    ? resolvePergolaZoneKind(activePergolaModel.attachment.kind)
    : null;
  const compatiblePergolaZones = useMemo(() => {
    if (!activePergolaModel || !activePergolaZoneKind) return [];
    return (houseAssembly?.derivedEnvelope?.attachmentZones ?? []).filter(
      (zone) => zone.kind === activePergolaZoneKind,
    );
  }, [activePergolaModel, activePergolaZoneKind, houseAssembly?.derivedEnvelope?.attachmentZones]);
  const compatiblePergolaEdges = useMemo(() => {
    const allowedEdgeIds = new Set(
      compatiblePergolaZones
        .map((zone) => zone.hostEdgeId)
        .filter((hostEdgeId): hostEdgeId is string => typeof hostEdgeId === 'string' && hostEdgeId.length > 0),
    );
    return (houseAssembly?.derivedEnvelope?.edges ?? []).filter((edge) => allowedEdgeIds.has(edge.id));
  }, [compatiblePergolaZones, houseAssembly?.derivedEnvelope?.edges]);
  const selectedPergolaEdgeOptionMissing = Boolean(
    activePergolaModel?.attachment.attachmentEdgeId &&
      !compatiblePergolaEdges.some((edge) => edge.id === activePergolaModel.attachment.attachmentEdgeId),
  );
  const selectedPergolaZoneOptionMissing = Boolean(
    activePergolaModel?.attachment.attachmentZoneId &&
      !compatiblePergolaZones.some((zone) => zone.id === activePergolaModel.attachment.attachmentZoneId),
  );

  const runAttachmentAction = useCallback(
    async (
      fieldId: string,
      action: Promise<CommitResult> | CommitResult | undefined,
      fallbackMessage: string,
    ) => {
      setPendingFieldId(fieldId);
      const result = await Promise.resolve(action ?? { ok: false, error: fallbackMessage });
      setFieldErrors((current) => ({
        ...current,
        [fieldId]: result.ok ? '' : result.error ?? fallbackMessage,
      }));
      setPendingFieldId((current) => (current === fieldId ? null : current));
    },
    [],
  );

  return (
    <>
      <section className={styles.moduleSection}>
        <p className={styles.moduleSectionTitle}>Pergola Inspector</p>
        <p className={styles.noticeText}>
          Geometry, roof, supports, and overrides live here. Footprint and drawing rotation still live in House Forms.
        </p>
        <button type="button" className={styles.modeButton} onClick={onOpenHouseForms}>
          Open House Forms
        </button>
      </section>

      {activePergolaModel ? (
        <section className={styles.moduleSection}>
          <p className={styles.moduleSectionTitle}>Host Attachment</p>
          <label className={styles.moduleSectionTitle} htmlFor="pergola-connection-type">
            Connection
          </label>
          <select
            id="pergola-connection-type"
            className={styles.moduleSelect}
            aria-label="Pergola connection"
            value={activePergolaModel.attachment.kind}
            disabled={disabled || pendingFieldId === 'pergola-connection'}
            onChange={(event) =>
              runAttachmentAction(
                'pergola-connection',
                onCommitConnectionKind?.(activePergolaModel.id, event.target.value as PergolaAttachmentKind),
                'Unable to update the pergola connection.',
              )
            }
          >
            {PERGOLA_CONNECTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label className={styles.moduleSectionTitle} htmlFor="pergola-attachment-strategy">
            Attachment strategy
          </label>
          <select
            id="pergola-attachment-strategy"
            className={styles.moduleSelect}
            aria-label="Pergola attachment strategy"
            value={activePergolaModel.attachment.strategy ?? 'auto'}
            disabled={
              disabled ||
              activePergolaModel.attachment.kind === 'freestanding' ||
              pendingFieldId === 'pergola-strategy'
            }
            onChange={(event) =>
              runAttachmentAction(
                'pergola-strategy',
                onCommitAttachmentStrategy?.(
                  activePergolaModel.id,
                  event.target.value as PergolaAttachmentStrategyValue,
                ),
                'Unable to update the pergola attachment strategy.',
              )
            }
          >
            {PERGOLA_ATTACHMENT_STRATEGY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label className={styles.moduleSectionTitle} htmlFor="pergola-host-edge">
            Host edge
          </label>
          <select
            id="pergola-host-edge"
            className={styles.moduleSelect}
            aria-label="Pergola host edge"
            value={activePergolaModel.attachment.attachmentEdgeId ?? ''}
            disabled={
              disabled ||
              activePergolaModel.attachment.kind === 'freestanding' ||
              (!compatiblePergolaEdges.length && !selectedPergolaEdgeOptionMissing) ||
              pendingFieldId === 'pergola-edge'
            }
            onChange={(event) =>
              runAttachmentAction(
                'pergola-edge',
                onCommitAttachmentEdge?.(activePergolaModel.id, event.target.value),
                'Unable to update the pergola host edge.',
              )
            }
          >
            {selectedPergolaEdgeOptionMissing && activePergolaModel.attachment.attachmentEdgeId ? (
              <option value={activePergolaModel.attachment.attachmentEdgeId}>Unavailable saved edge</option>
            ) : null}
            {compatiblePergolaEdges.map((edge) => (
              <option key={edge.id} value={edge.id}>
                {edge.label}
              </option>
            ))}
          </select>

          <label className={styles.moduleSectionTitle} htmlFor="pergola-host-zone">
            Host zone
          </label>
          <select
            id="pergola-host-zone"
            className={styles.moduleSelect}
            aria-label="Pergola host zone"
            value={activePergolaModel.attachment.attachmentZoneId ?? ''}
            disabled={
              disabled ||
              activePergolaModel.attachment.kind === 'freestanding' ||
              (!compatiblePergolaZones.length && !selectedPergolaZoneOptionMissing) ||
              pendingFieldId === 'pergola-zone'
            }
            onChange={(event) =>
              runAttachmentAction(
                'pergola-zone',
                onCommitAttachmentZone?.(activePergolaModel.id, event.target.value),
                'Unable to update the pergola host zone.',
              )
            }
          >
            {selectedPergolaZoneOptionMissing && activePergolaModel.attachment.attachmentZoneId ? (
              <option value={activePergolaModel.attachment.attachmentZoneId}>Unavailable saved zone</option>
            ) : null}
            {compatiblePergolaZones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.label}
              </option>
            ))}
          </select>

          <div className={styles.diagnosticsList}>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Resolution</span>
              <span className={styles.diagnosticValue}>{activePergolaModel.attachment.resolution.status}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Host side</span>
              <span className={styles.diagnosticValue}>
                {labelForAttachmentSideList([activePergolaModel.attachment.side])}
              </span>
            </div>
          </div>

          {activePergolaModel.attachment.resolution.message ? (
            <p className={styles.noticeText}>{activePergolaModel.attachment.resolution.message}</p>
          ) : null}
          {fieldErrors['pergola-connection'] ? (
            <p className={styles.noticeText}>{fieldErrors['pergola-connection']}</p>
          ) : null}
          {fieldErrors['pergola-strategy'] ? (
            <p className={styles.noticeText}>{fieldErrors['pergola-strategy']}</p>
          ) : null}
          {fieldErrors['pergola-edge'] ? <p className={styles.noticeText}>{fieldErrors['pergola-edge']}</p> : null}
          {fieldErrors['pergola-zone'] ? <p className={styles.noticeText}>{fieldErrors['pergola-zone']}</p> : null}
        </section>
      ) : null}

      {modules.length > 1 ? (
        <section className={styles.moduleSection}>
          <p className={styles.moduleSectionTitle}>Module</p>
          <select
            className={styles.moduleSelect}
            aria-label="Drawing module"
            value={String(activeModuleIndex)}
            onChange={(event) =>
              onSelectPergolaByModule(modules[Number(event.target.value)]?.pergolaId ?? null)
            }
          >
            {modules.map((module, index) => (
              <option key={module.id} value={String(index)}>
                {module.label}
              </option>
            ))}
          </select>
        </section>
      ) : null}

      {supportsSanctuaryEditing && activeModuleInput && activePergolaModel ? (
        <>
          <section className={styles.moduleSection}>
            <p className={styles.moduleSectionTitle}>Selection</p>
            <div className={styles.diagnosticsList}>
              <div className={styles.diagnosticRow}>
                <span className={styles.diagnosticLabel}>Active pergola</span>
                <span className={styles.diagnosticValue}>{activePergolaModel.label || activePergolaModel.id}</span>
              </div>
              <div className={styles.diagnosticRow}>
                <span className={styles.diagnosticLabel}>Module</span>
                <span className={styles.diagnosticValue}>{activeModuleLabel}</span>
              </div>
            </div>
          </section>
          <SanctuaryWorkbenchRail
            moduleLabel={activeModuleLabel}
            geometryState={geometryState}
            view={view}
            disabled={disabled}
            canStartDrawOutline={!disabled}
            onStartDrawOutline={onStartDrawOutline}
            onCommitGeometryEdit={onCommitGeometryEdit}
            chrome="embedded"
            renderSummary={false}
            sections={{
              geometry: true,
              roof: true,
              gable: true,
              houseContext: 'none',
              supports: true,
              overrides: true,
            }}
          />
        </>
      ) : activePergolaModel ? (
        <section className={styles.notice}>
          <p className={styles.noticeTitle}>Editing Deferred</p>
          <p className={styles.noticeText}>
            This pergola family is not supported for native editing yet, but it can still be reviewed in the canonical workbench.
          </p>
        </section>
      ) : null}
    </>
  );
}
