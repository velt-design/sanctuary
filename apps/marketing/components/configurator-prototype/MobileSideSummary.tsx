import type { PreviewRoofChoices } from './GableChoices';
import { usePreviewBlinds } from './PreviewBlindProvider';
import css from './mobileExtras.module.css';

export type MobileSideFace = 'left' | 'front' | 'right';

export default function MobileSideSummary({ roof, onEdit }: { roof: PreviewRoofChoices; onEdit: (side: MobileSideFace) => void }) {
  const workspace = usePreviewBlinds()!;
  return <dl className={css.faces} aria-label="Selected side treatments">
    {(['left', 'front', 'right'] as const).map(side => {
      const openings = workspace.openings.filter(opening => opening.side === side);
      const kinds = new Set(openings.map(opening => roof.blinds?.some(blind => blind.opening === opening.id) ? 'Blinds'
        : ({ timber: 'Timber', aluminium: 'Aluminium', acrylic: 'Acrylic', open: 'Open' }[roof.sidePanels?.find(panel => panel.opening === opening.id)?.kind ?? 'open'])));
      const treatment = !openings.length ? 'Unavailable' : kinds.size === 1 ? [...kinds][0] : 'Mixed';
      return <div key={side}><dt>{side}</dt><dd><button type="button" data-side-edit={side} disabled={!openings.length}
        aria-label={`Edit ${side} side, currently ${treatment}`} aria-controls="mobile-side-editor" aria-expanded={false} onClick={() => onEdit(side)}>
        <span>{treatment}</span>{openings.length > 0 && <small>Edit</small>}
      </button></dd></div>;
    })}
  </dl>;
}
