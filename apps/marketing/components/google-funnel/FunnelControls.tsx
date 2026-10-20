'use client';
import Image from 'next/image';
import { useState, type ReactNode } from 'react';
import DimensionControl from '../marketing-foundation/DimensionControl';
import { getRoofFinish, previewProjectionMax } from '../configurator-prototype/roofFinish';
import type { usePreviewDraft } from '../configurator-prototype/usePreviewDraft';
import { PRODUCT_MATERIALS } from '../products/productSelectionValues';
import defaultStyles from './funnel.module.css';

const shapes = [{ value: 'mono', label: 'Pitched', image: 'pitched' }, { value: 'gable', label: 'Gable', image: 'gable' }, { value: 'box', label: 'Box', image: 'box' }] as const;
type ControlStyles = Partial<Record<'designVisual' | 'controls' | 'notice' | 'choices' | 'dimensions', string>>;
export default function FunnelControls({ state, onEdit, children, presentation = defaultStyles, projectionLabel = 'Projection', materialLabel = 'Roof material' }: { state: Pick<ReturnType<typeof usePreviewDraft>, 'input' | 'roof' | 'ready' | 'setInput' | 'setRoof'>; onEdit: () => void; children?: ReactNode; presentation?: ControlStyles; projectionLabel?: string; materialLabel?: string }) {
  const styles = { ...defaultStyles, ...presentation };
  const { input, roof } = state;
  const [sizeNotice, setSizeNotice] = useState('');
  const finish = getRoofFinish(roof);
  const shape = shapes.find(option => option.value === roof.family)!;
  const image = finish.material === 'acrylic' ? `/images/configurator/shape-${shape.image}-v1.webp` : `/images/configurator/roof-${shape.image}-${finish.material}-v1.webp`;
  function changeRoof(next: typeof roof) {
    const maximum = previewProjectionMax(next);
    setSizeNotice(input.projectionMm > maximum ? `Projection adjusted from ${(input.projectionMm / 1000).toFixed(1)} m to ${(maximum / 1000).toFixed(1)} m to fit this roof. Review your size before enquiring.` : '');
    onEdit(); state.setRoof(next);
  }
  return <>
    <div className={styles.designVisual}><Image src={image} alt={`${shape.label} pergola illustration with ${finish.material === 'acrylic' ? 'acrylic roofing' : finish.material === 'solid' ? 'a timber-lined solid roof' : 'acrylic and timber-lined roofing'}`} width={1200} height={900} sizes="(max-width:760px) 100vw, 50vw"/><p>Roof-style illustration. Your size and extras appear in the full 3D designer.</p></div>
    <div className={styles.controls}>
      {sizeNotice && <p role="status" className={styles.notice}>{sizeNotice}</p>}
      <fieldset disabled={!state.ready}><legend>Roof shape</legend><div className={styles.choices}>{shapes.map(option => <label key={option.value} data-selected={roof.family === option.value}><input type="radio" name="funnel-shape" checked={roof.family === option.value} onChange={() => changeRoof({ ...roof, family: option.value })}/><span>{option.label}</span></label>)}</div></fieldset>
      <fieldset className={styles.dimensions} disabled={!state.ready}><legend>Your space</legend><DimensionControl axis="width" label="Width" value={input.widthMm} min={1500} max={10000} onChange={widthMm => { onEdit(); state.setInput({ ...input, widthMm }); }}/><DimensionControl axis="projection" label={projectionLabel} value={input.projectionMm} min={1500} max={previewProjectionMax(roof)} onChange={projectionMm => { onEdit(); state.setInput({ ...input, projectionMm }); }}/></fieldset>
      <fieldset disabled={!state.ready}><legend>{materialLabel}</legend><div className={styles.choices}>{PRODUCT_MATERIALS.map(option => <label key={option.value} data-selected={finish.material === option.value}><input type="radio" name="funnel-material" checked={finish.material === option.value} onChange={() => changeRoof({ ...roof, finish: { ...finish, material: option.value, ...(option.value !== 'acrylic' && !finish.ceiling ? { ceiling: 'thermopine-150' } : {}) } })}/><span>{option.label}</span></label>)}</div><p>{PRODUCT_MATERIALS.find(option => option.value === finish.material)?.detail}</p></fieldset>
      {children}
    </div>
  </>;
}
