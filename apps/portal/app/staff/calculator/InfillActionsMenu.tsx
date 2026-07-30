import { PortalMenu } from '@/components/ui/PortalFloatingPanel';
import styles from './CalculatorGrid.module.css';

type InfillActionsMenuProps = {
  disableMoveUp?: boolean;
  disableMoveDown?: boolean;
  disablePaste?: boolean;
  onDuplicate: () => void;
  onDuplicateBulk: () => void;
  onCopyGeometry: () => void;
  onPasteGeometry: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
};

export default function InfillActionsMenu({
  disableMoveUp = false,
  disableMoveDown = false,
  disablePaste = false,
  onDuplicate,
  onDuplicateBulk,
  onCopyGeometry,
  onPasteGeometry,
  onMoveUp,
  onMoveDown,
  onDelete,
}: InfillActionsMenuProps) {
  return (
    <PortalMenu
      label="Infill actions"
      trigger="Actions"
      triggerAriaLabel="Infill actions"
      triggerClassName={styles.infillIconButton}
      align="end"
      sideOffset={6}
      contentClassName={styles.infillPresetMenu}
      items={[
        { id: 'duplicate', label: 'Duplicate', onSelect: onDuplicate },
        { id: 'duplicate-bulk', label: 'Duplicate xN', onSelect: onDuplicateBulk },
        { id: 'copy-geometry', label: 'Copy geometry', onSelect: onCopyGeometry, separatorBefore: true },
        { id: 'paste-geometry', label: 'Paste geometry', onSelect: onPasteGeometry, disabled: disablePaste },
        { id: 'move-up', label: 'Move up', onSelect: onMoveUp, disabled: disableMoveUp, separatorBefore: true },
        { id: 'move-down', label: 'Move down', onSelect: onMoveDown, disabled: disableMoveDown },
        { id: 'delete', label: 'Delete', onSelect: onDelete, separatorBefore: true },
      ]}
    />
  );
}
