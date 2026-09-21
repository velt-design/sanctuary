'use client';
import { useState } from 'react';
import DimensionControl from './DimensionControl';
import ArrowUpRight from './ArrowUpRight';
import controls from './design-controls.module.css';

export default function DesignControlsSpecimen() {
  const [width, setWidth] = useState(6000);
  const [choice, setChoice] = useState('Open sides');
  return <div style={{ maxWidth: 560 }}>
    <DimensionControl axis="width" label="Width" value={width} min={1500} max={10000} onChange={setWidth}/>
    <fieldset style={{ border: 0, padding: 0, margin: '24px 0' }}><legend>Side configuration</legend>
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>{['Open sides', 'Left blind'].map(value => <label className={controls.choice} data-selected={choice === value} key={value} style={{ padding: 16 }}><input type="radio" name="foundation-sides" checked={choice === value} onChange={() => setChoice(value)}/> {value}</label>)}</div>
    </fieldset>
    <p>Click a dimension to edit with its value selected. Enter commits; invalid input keeps the last valid size. The message region stays reserved.</p>
    <a className={controls.action} href="/products/pergolas/pitched">Explore the product pattern <ArrowUpRight/></a>
    <a className={controls.action} data-secondary="true" style={{ marginTop: 12 }} href="/configurator-preview?open=1">Explore the full designer <ArrowUpRight/></a>
    <p>Product: furnished 3D and simplified plan. Designer: clear editing views, furnished review and detailed plan. Furniture is illustrative and never priced.</p>
  </div>;
}
