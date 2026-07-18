import type { InfillLineItem } from '@/lib/types/calculator';
import InfillActionsMenu from './InfillActionsMenu';
import { InfillAddButton } from './CalculatorInfillOverview';
import styles from './CalculatorGrid.module.css';

type InfillEditorHeaderProps = {
  items: InfillLineItem[];
  selectedItem: InfillLineItem;
  selectedIndex: number;
  locationLabel: string;
  disablePaste: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDuplicateBulk: () => void;
  onCopyGeometry: () => void;
  onPasteGeometry: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
};

export default function InfillEditorHeader({
  items,
  selectedItem,
  selectedIndex,
  locationLabel,
  disablePaste,
  onSelect,
  onAdd,
  onDuplicate,
  onDuplicateBulk,
  onCopyGeometry,
  onPasteGeometry,
  onMoveUp,
  onMoveDown,
  onDelete,
}: InfillEditorHeaderProps) {
  const selectedLabel = selectedItem.label?.trim() || `Infill ${selectedIndex + 1}`;
  return (
    <div className={styles.infillEditorHeader}>
      <div className={styles.infillEditorIdentity}>
        <h3 className={styles.infillEditorTitle}>{selectedLabel}</h3>
        <p className={styles.infillEditorSubtitle}>{locationLabel}</p>
        <label className={styles.infillMobileSelectLabel} htmlFor="infill-mobile-select">Editing infill</label>
        <select
          id="infill-mobile-select"
          className={styles.infillMobileSelect}
          value={selectedItem.id}
          onChange={(event) => onSelect(event.target.value)}
        >
          {items.map((item, index) => (
            <option key={item.id} value={item.id}>{item.label?.trim() || `Infill ${index + 1}`}</option>
          ))}
        </select>
      </div>
      <div className={styles.infillEditorActions}>
        <InfillAddButton label="Add infill" onAddCustom={onAdd} />
        <InfillActionsMenu
          disableMoveUp={selectedIndex <= 0}
          disableMoveDown={selectedIndex >= items.length - 1}
          disablePaste={disablePaste}
          onDuplicate={onDuplicate}
          onDuplicateBulk={onDuplicateBulk}
          onCopyGeometry={onCopyGeometry}
          onPasteGeometry={onPasteGeometry}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
