import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={styles.infillIconButton} aria-label="Infill actions">
          Actions
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className={styles.infillPresetMenu}>
        <DropdownMenuItem onSelect={onDuplicate}>Duplicate</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDuplicateBulk}>Duplicate xN</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onCopyGeometry}>Copy geometry</DropdownMenuItem>
        <DropdownMenuItem onSelect={onPasteGeometry} disabled={disablePaste}>
          Paste geometry
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onMoveUp} disabled={disableMoveUp}>
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onMoveDown} disabled={disableMoveDown}>
          Move down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDelete}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
