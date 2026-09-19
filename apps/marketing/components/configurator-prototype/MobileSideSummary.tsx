import type { PreviewRoofChoices } from './GableChoices';
import { usePreviewBlinds } from './PreviewBlindProvider';
import css from './mobileExtras.module.css';

export default function MobileSideSummary({ roof }: { roof: PreviewRoofChoices }) {
  const workspace = usePreviewBlinds()!;
  return <dl className={css.faces} aria-label="Selected side treatments">
    {(['left', 'front', 'right'] as const).map(side => {
      const openings = workspace.openings.filter(opening => opening.side === side);
      const kinds = new Set(openings.map(opening => roof.blinds?.some(blind => blind.opening === opening.id) ? 'Blinds'
        : ({ timber: 'Timber', aluminium: 'Aluminium', acrylic: 'Acrylic', open: 'Open' }[roof.sidePanels?.find(panel => panel.opening === opening.id)?.kind ?? 'open'])));
      return <div key={side}><dt>{side}</dt><dd>{!openings.length ? 'Unavailable' : kinds.size === 1 ? [...kinds][0] : 'Mixed'}</dd></div>;
    })}
  </dl>;
}
