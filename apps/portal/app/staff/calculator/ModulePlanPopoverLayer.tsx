import type { CSSProperties } from 'react';
import styles from './CalculatorGrid.module.css';
import type { ModulePlanModel } from './moduleViews';
import type {
  ModuleFootprintEditorProps,
  ModulePlanSheetInteractionProps,
} from './ModuleDrawingContracts';
import { HOUSE_FOOTPRINT_PRESET_OPTIONS } from './ModulePlanFootprintPresentation';

type ModulePlanPopoverLayerProps = {
  activeEdgeTagLabel: string | null;
  activeEdgeTagStyle?: CSSProperties;
  footprintEditor?: ModuleFootprintEditorProps;
  houseFootprintPreset: ModulePlanModel['houseFootprintPreset'];
  housePopoverStyle?: CSSProperties;
  isSheetFootprintEditor: boolean;
  pergolaPopoverStyle: CSSProperties;
  sheetPlanInteraction?: ModulePlanSheetInteractionProps;
  showHousePopover: boolean;
  showPergolaPopover: boolean;
};

export function ModulePlanPopoverLayer({
  activeEdgeTagLabel,
  activeEdgeTagStyle,
  footprintEditor,
  houseFootprintPreset,
  housePopoverStyle,
  isSheetFootprintEditor,
  pergolaPopoverStyle,
  sheetPlanInteraction,
  showHousePopover,
  showPergolaPopover,
}: ModulePlanPopoverLayerProps) {
  return (
    <>
      {showHousePopover && housePopoverStyle ? (
        <div className={styles.moduleSheetPlanPopoverOverlay} style={housePopoverStyle}>
          <div
            className={styles.moduleSheetPlanPopover}
            data-sheet-plan-popover="house"
            onPointerEnter={() => footprintEditor?.onContextPopoverHoverChange?.(true)}
            onPointerLeave={() => footprintEditor?.onContextPopoverHoverChange?.(false)}
          >
            <label className={styles.moduleSheetPlanPopoverField}>
              <span className={styles.moduleSheetPlanPopoverLabel}>House type</span>
              <select
                className={styles.moduleSheetPlanPopoverSelect}
                aria-label="House footprint preset"
                value={houseFootprintPreset}
                onChange={(event) => footprintEditor?.onPresetSelect(event.target.value as ModulePlanModel['houseFootprintPreset'])}
              >
                {HOUSE_FOOTPRINT_PRESET_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : null}
      {showPergolaPopover ? (
        <div className={styles.moduleSheetPlanPopoverOverlay} style={pergolaPopoverStyle}>
          <div
            className={styles.moduleSheetPlanPopover}
            data-sheet-plan-popover="pergola"
            onPointerEnter={() => sheetPlanInteraction?.onPergolaPopoverHoverChange?.(true)}
            onPointerLeave={() => sheetPlanInteraction?.onPergolaPopoverHoverChange?.(false)}
          >
            <span className={styles.moduleSheetPlanPopoverLabel}>Rotate</span>
            <div className={styles.moduleSheetPlanPopoverButtonRow}>
              <button type="button" className={styles.moduleSheetPlanPopoverButton} onClick={() => footprintEditor?.onRotate(-1)}>
                Rotate -90
              </button>
              <button type="button" className={styles.moduleSheetPlanPopoverButton} onClick={() => footprintEditor?.onRotate(1)}>
                Rotate +90
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {activeEdgeTagLabel && activeEdgeTagStyle ? (
        <div
          className={`${styles.moduleFootprintEdgeBadgeOverlay} ${isSheetFootprintEditor ? styles.moduleFootprintEdgeBadgeOverlaySheet : ''}`}
          style={activeEdgeTagStyle}
          aria-hidden="true"
        >
          <span className={`${styles.moduleFootprintEdgeBadgePill} ${isSheetFootprintEditor ? styles.moduleFootprintEdgeBadgePillSheet : ''}`}>
            {activeEdgeTagLabel}
          </span>
        </div>
      ) : null}
    </>
  );
}
