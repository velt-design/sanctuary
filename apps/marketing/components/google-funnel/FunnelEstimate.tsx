'use client';
import LandingEstimate from '../../app/pergolas-auckland/LandingEstimate';
import { productSelectionDraft } from '../products/productSelection';
import { getRoofFinish } from '../configurator-prototype/roofFinish';
import { useConfiguratorPrice } from '../configurator-prototype/useConfiguratorPrice';
import type { PreviewDraft } from '../configurator-prototype/previewDraft';
import type { LandingSelectionState } from '../../app/pergolas-auckland/useLandingPrice';
import styles from './funnel.module.css';

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)]));
  return value;
}
/** Compare complete drafts, never infer a table price from dimensions alone. */
export function funnelPriceState(draft: PreviewDraft, ready: boolean): LandingSelectionState {
  const type = draft.roof.family === 'mono' ? 'pitched' : draft.roof.family === 'box' ? 'box-perimeter' : 'gable';
  const selection = { widthMm: draft.input.widthMm, projectionMm: draft.input.projectionMm, material: getRoofFinish(draft.roof).material, sides: 'open' as const, orientation: 'parallel' as const };
  const standard = productSelectionDraft(selection, type);
  const normalized = { ...draft, roof: { ...draft.roof, blinds: draft.roof.blinds ?? [] } };
  // Tint is retained in the signed design but does not enter the canonical
  // structure or accessory calculation. It must not disable exact basic totals.
  delete normalized.roof.acrylicTint;
  // The basic material controls retain their default timber choice for a return
  // to solid roofing. It is inactive under acrylic, not an additional priced option.
  // Normalize only this comparison; the saved design and all genuine extras survive.
  if (selection.material === 'acrylic' && normalized.roof.finish?.ceiling === 'thermopine-150') {
    normalized.roof.finish = { ...normalized.roof.finish };
    delete normalized.roof.finish.ceiling;
  }
  const exact = JSON.stringify(ordered(standard.draft)) === JSON.stringify(ordered(normalized));
  return { ready, resume: !exact, type, selection, failed: false, retry: () => {},
    design: ready ? { draft, issue: null, restored: !exact, projectionMax: 6000, summary: [], enquiryHref: '', designerHref: '' } : null };
}
export function useFunnelEstimate(draft: PreviewDraft, ready: boolean, attached: boolean) {
  const canonical = useConfiguratorPrice(draft, ready && attached);
  return { state: funnelPriceState(draft, ready), canonical: canonical.price };
}
export default function FunnelEstimate({ state }: { state: ReturnType<typeof useFunnelEstimate> }) {
  return <LandingEstimate state={state.state} className={styles.estimate}/>;
}
