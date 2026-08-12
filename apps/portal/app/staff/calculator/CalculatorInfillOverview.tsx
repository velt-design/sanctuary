import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import { PortalMenu } from '@/components/ui/PortalFloatingPanel';
import type { InfillLineItem } from '@/lib/types/calculator';
import styles from './CalculatorGrid.module.css';
import type { InfillPresetKey } from './calculatorInputs';
import {
  acrylicSourceLabel,
  estimateInfillUi,
  formatInfillShapeSummary,
  infillStatusLabel,
  locationLabel,
  type InfillUiEstimate,
} from './calculatorInfillUi';
import type { InfillUiState } from './infillCompute';

export type InfillPresetCard = {
  key: InfillPresetKey;
  label: string;
};

type InfillSummaryChip = {
  key: string;
  label: string;
  count: number;
};

type InfillSummaryTotals = {
  panels: number;
  mullions: number;
};

type InfillOverviewUiState = Pick<InfillUiState, 'status' | 'estimate'>;

export function InfillAddButton({
  label,
  compact = false,
  openModal = false,
  onAddCustom,
}: {
  label: string;
  compact?: boolean;
  openModal?: boolean;
  onAddCustom: (openModal: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={compact ? styles.infillSecondaryButtonCompact : styles.infillSecondaryButton}
      onClick={() => onAddCustom(openModal)}
    >
      {label}
    </button>
  );
}

export function InfillPresetMenu({
  label,
  compact = false,
  openModal = false,
  presets,
  onAddPreset,
}: {
  label: string;
  compact?: boolean;
  openModal?: boolean;
  presets: InfillPresetCard[];
  onAddPreset: (preset: InfillPresetKey, openModal: boolean) => void;
}) {
  return (
    <PortalMenu
      label={label}
      trigger={label}
      triggerClassName={compact ? styles.infillSecondaryButtonCompact : styles.infillSecondaryButton}
      align="start"
      sideOffset={6}
      contentClassName={styles.infillPresetMenu}
      items={presets.map((preset) => ({
        id: preset.key,
        label: preset.label,
        onSelect: () => onAddPreset(preset.key, openModal),
      }))}
    />
  );
}

export function CalculatorInfillTile({
  hasInfills,
  summaryLine1,
  summaryChips,
  systemSummary,
  totals,
  presets,
  onAddCustom,
  onAddPreset,
  onOpenInfills,
  beforeSummary,
  standalone = false,
}: {
  hasInfills: boolean;
  summaryLine1: string;
  summaryChips: InfillSummaryChip[];
  systemSummary: string;
  totals: InfillSummaryTotals;
  presets: InfillPresetCard[];
  onAddCustom: (openModal: boolean) => void;
  onAddPreset: (preset: InfillPresetKey, openModal: boolean) => void;
  onOpenInfills: () => void;
  beforeSummary?: ReactNode;
  standalone?: boolean;
}) {
  return (
    <div className={styles.infillTileContent}>
      <div className={styles.infillTileBody}>
        {beforeSummary}
        <div className={styles.infillTileStatus}>{hasInfills ? summaryLine1 : 'No infills added yet'}</div>
        <p className={styles.infillTileDescription}>
          {hasInfills
            ? `Review configured infills, add new ones, or adjust the panel layout for ${standalone ? 'the existing pergola' : 'this module'}.`
            : `Add infills to ${standalone ? 'the existing pergola' : 'close exposed sides or gable ends'} for more shelter and weather protection.`}
        </p>
        {summaryChips.length ? (
          <div className={styles.infillTilePillRow}>
            {summaryChips.map((chip) => (
              <span key={chip.key} className={styles.infillChip}>
                {chip.label} {chip.count}
              </span>
            ))}
          </div>
        ) : null}
        {hasInfills ? (
          <div className={styles.infillTileMetricRow}>
            <div className={styles.infillTileMetric}>
              <span className={styles.infillTileMetricLabel}>System</span>
              <strong>{systemSummary}</strong>
            </div>
            <div className={styles.infillTileMetric}>
              <span className={styles.infillTileMetricLabel}>Panels</span>
              <strong>{totals.panels}</strong>
            </div>
            <div className={styles.infillTileMetric}>
              <span className={styles.infillTileMetricLabel}>New supports</span>
              <strong>{totals.mullions}</strong>
            </div>
          </div>
        ) : null}
      </div>
      <div className={styles.infillTileActions}>
        {hasInfills ? (
          <>
            <button type="button" className={styles.infillPrimaryButton} onClick={onOpenInfills}>
              Edit infills
            </button>
            <InfillAddButton label="Add infill" openModal onAddCustom={onAddCustom} />
            {presets.length ? <InfillPresetMenu label="Presets" presets={presets} onAddPreset={onAddPreset} /> : null}
          </>
        ) : (
          <>
            <button type="button" className={styles.infillPrimaryButton} onClick={() => onAddCustom(true)}>
              Add infill
            </button>
            {presets.length ? <InfillPresetMenu label="Use preset" openModal presets={presets} onAddPreset={onAddPreset} /> : null}
            <button type="button" className={styles.infillSecondaryButton} onClick={onOpenInfills}>
              Edit infills
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function CalculatorInfillRail({
  items,
  selectedInfillId,
  uiById,
  rafterSpacingM,
  listRef,
  summaryLine1,
  summaryLine2,
  summaryLine3,
  hasInfills,
  presets,
  onAddCustom,
  onAddPreset,
  onSelectInfill,
  onFocusPrimaryField,
  onMoveInfill,
  onRowRef,
  standalone = false,
}: {
  items: InfillLineItem[];
  selectedInfillId: string | null;
  uiById: ReadonlyMap<string, InfillOverviewUiState | undefined>;
  rafterSpacingM: number;
  listRef?: RefObject<HTMLDivElement | null>;
  summaryLine1: string;
  summaryLine2: string;
  summaryLine3: string | null;
  hasInfills: boolean;
  presets: InfillPresetCard[];
  onAddCustom: (openModal: boolean) => void;
  onAddPreset: (preset: InfillPresetKey, openModal: boolean) => void;
  onSelectInfill: (id: string) => void;
  onFocusPrimaryField: (id: string) => void;
  onMoveInfill: (id: string, direction: -1 | 1) => void;
  onRowRef: (id: string, node: HTMLButtonElement | null) => void;
  standalone?: boolean;
}) {
  return (
    <aside className={styles.infillRail} aria-label="Infill list">
      <div className={styles.infillRailHeader}>
        <div className={styles.infillRailHeaderActions}>
          <InfillAddButton label="Add infill" compact onAddCustom={onAddCustom} />
          {presets.length ? <InfillPresetMenu label="Presets" compact presets={presets} onAddPreset={onAddPreset} /> : null}
        </div>
      </div>

      <div className={styles.infillRailList}>
        {items.length ? (
          <InfillListRows
            items={items}
            selectedInfillId={selectedInfillId}
            uiById={uiById}
            rafterSpacingM={rafterSpacingM}
            listRef={listRef}
            onSelectInfill={onSelectInfill}
            onFocusPrimaryField={onFocusPrimaryField}
            onMoveInfill={onMoveInfill}
            onRowRef={onRowRef}
          />
        ) : (
          <div className={styles.infillListEmpty}>
            <strong className={styles.infillListEmptyTitle}>No infills added yet</strong>
            <p>{standalone
              ? 'Add infills to the existing pergola for more shelter and weather protection.'
              : 'Add infills to close exposed sides or gable ends for more shelter and weather protection.'}</p>
            <p>{standalone
              ? 'Use the button above to enter the first finished opening.'
              : 'Use the buttons above to add your first infill or start from a preset.'}</p>
          </div>
        )}
      </div>

      <div className={styles.infillRailFooter}>
        <strong>{hasInfills ? `${standalone ? 'Existing pergola' : 'Module'} infill summary` : 'Ready to add infills'}</strong>
        <p>{summaryLine1}</p>
        <p>{summaryLine2}</p>
        {summaryLine3 ? <p>{summaryLine3}</p> : <p>{standalone
          ? 'Add the finished openings required on the existing pergola.'
          : 'Add infills to improve shelter and weather protection on exposed sides.'}</p>}
      </div>
    </aside>
  );
}

function InfillListRows({
  items,
  selectedInfillId,
  uiById,
  rafterSpacingM,
  listRef,
  onSelectInfill,
  onFocusPrimaryField,
  onMoveInfill,
  onRowRef,
}: {
  items: InfillLineItem[];
  selectedInfillId: string | null;
  uiById: ReadonlyMap<string, InfillOverviewUiState | undefined>;
  rafterSpacingM: number;
  listRef?: RefObject<HTMLDivElement | null>;
  onSelectInfill: (id: string) => void;
  onFocusPrimaryField: (id: string) => void;
  onMoveInfill: (id: string, direction: -1 | 1) => void;
  onRowRef: (id: string, node: HTMLButtonElement | null) => void;
}) {
  return (
    <div ref={listRef} className={styles.infillListRows}>
      {items.map((item, idx) => {
        const uiState = uiById.get(item.id) ?? null;
        const estimate: InfillUiEstimate = uiState?.estimate ?? estimateInfillUi(item, rafterSpacingM);
        const title = item.label?.trim() ? item.label.trim() : `Infill ${idx + 1}`;
        const isSelected = selectedInfillId === item.id;
        const acrylicChipLabel = acrylicSourceLabel(estimate.acrylicSourceUsed);
        const canMoveUp = idx > 0;
        const canMoveDown = idx < items.length - 1;
        const status = uiState?.status ?? 'valid';
        const statusLabel = infillStatusLabel(status);
        const statusClassName =
          status === 'draft'
            ? `${styles.infillChip} ${styles.infillChipWarning}`
            : `${styles.infillChip} ${styles.infillChipSuccess}`;
        const rowDetailLine =
          estimate.estimatedMullionsTotal > 0
            ? `Panels ${estimate.panelCountTotal} | New supports ${estimate.estimatedMullionsTotal}`
            : `Panels ${estimate.panelCountTotal}`;

        return (
          <div key={item.id} className={`${styles.infillRow} ${isSelected ? styles.infillRowActive : ''}`.trim()}>
            <button
              ref={(node) => onRowRef(item.id, node)}
              type="button"
              className={styles.infillRowSelect}
              onClick={() => onSelectInfill(item.id)}
              onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  const prevId = items[idx - 1]?.id;
                  if (prevId) onSelectInfill(prevId);
                  return;
                }
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  const nextId = items[idx + 1]?.id;
                  if (nextId) onSelectInfill(nextId);
                  return;
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onFocusPrimaryField(item.id);
                }
              }}
              aria-pressed={isSelected}
            >
              <div className={styles.infillRowTitle}>
                <span>{title}</span>
                <div className={styles.infillChipRow}>
                  <span className={styles.infillChip}>{locationLabel(item.location)}</span>
                  <span className={styles.infillChip}>{acrylicChipLabel}</span>
                  <span className={statusClassName}>{statusLabel}</span>
                  {estimate.acrylicSourceAutoSwitched ? <span className={`${styles.infillChip} ${styles.infillChipWarning}`}>Auto-switched</span> : null}
                </div>
              </div>
              <div className={styles.infillRowMeta}>{`Span ${formatInfillShapeSummary(item.shape)}${estimate.qty > 1 ? ` | Qty ${estimate.qty}` : ''}`}</div>
              <div className={styles.infillRowMeta}>{rowDetailLine}</div>
            </button>
            <div className={styles.infillRowControls}>
              <button
                type="button"
                className={styles.infillRowMoveButton}
                onClick={() => onMoveInfill(item.id, -1)}
                disabled={!canMoveUp}
                aria-label={`Move ${title} up`}
              >
                ↑
              </button>
              <button
                type="button"
                className={styles.infillRowMoveButton}
                onClick={() => onMoveInfill(item.id, 1)}
                disabled={!canMoveDown}
                aria-label={`Move ${title} down`}
              >
                ↓
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
