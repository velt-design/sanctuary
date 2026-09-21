'use client';

import {useRail} from './RailProvider';
import BlindControls from './BlindControls';
import RoofBattenControls from './RoofBattenControls';
import RoofFinishChoices from "./RoofFinishChoices";
import { previewProjectionMax } from "./roofFinish";

import { useState } from 'react';
import DimensionControl from '../marketing-foundation/DimensionControl';
import { CUSTOMER_DIMENSION_BOUNDS } from '@sp/configurator/core';
import {
  SIMPLE_COVER_WIDTH_MIN_MM, SIMPLE_COVER_WIDTH_MAX_MM,
  SIMPLE_COVER_PROJECTION_MIN_MM, SIMPLE_COVER_PROJECTION_MAX_MM,
  type SimpleCoverInput,
} from '../../lib/simpleCoverCalculator';
import { constrainPreviewConnection, metres, PREVIEW_SOFFIT_MAX_PROJECTION_MM } from './model';
import type { PreviewDimensionAxis } from './usePreviewDimension';
import AttachmentChoices from './AttachmentChoices';
import styles from './prototype.module.css';
import ui from './sectionControls.module.css';
import GableChoices, { RoofTypeChoice, type PreviewRoofChoices } from './GableChoices';

export default function PreviewControls({ input, roof, onRoofChange, onChange, onDimensionActivity, mode = 'full' }: {
  mode?: 'full' | 'size' | 'details';
  roof: PreviewRoofChoices; onRoofChange: (roof: PreviewRoofChoices) => void;
  input: SimpleCoverInput; onChange: (input: SimpleCoverInput) => void;
  onDimensionActivity: (axis: PreviewDimensionAxis | null) => void;
}) {
  const {section: railSection}=useRail();
  const section = mode === 'full' ? railSection : 'structure';
  const [connectionNotice, setConnectionNotice] = useState('');
  const [projectionNotice, setProjectionNotice] = useState('');
  const projectionMax = previewProjectionMax(roof);
  function updateRoof(next: PreviewRoofChoices) {
    const max = previewProjectionMax(next);
    setProjectionNotice(input.projectionMm > max ? `Projection adjusted to ${metres(max)} for this roof.` : '');
    onRoofChange(next);
  }
  const soffitUnavailable = input.projectionMm > PREVIEW_SOFFIT_MAX_PROJECTION_MM;
  function update(next: SimpleCoverInput) {
    setProjectionNotice('');
    const valid = constrainPreviewConnection(next, roof.family);
    setConnectionNotice(valid.connection !== next.connection ? `Switched to ${valid.connection}. ` : '');
    onChange(valid);
  }
  return <div className={styles.controls} data-preview-controls={mode}>
    <div className={ui.section} hidden={section!=='structure'}>
    <div hidden={mode === 'details'}>
    {mode === 'full' && <div className={styles.sectionLabel}><h2>Size & shape</h2></div>}
    {mode === 'full' && <RoofTypeChoice value={roof} onChange={updateRoof} />}
    {mode!=='size'&&<p className={styles.small}>{roof.attachmentIntent==='freestanding'?'Choose the width and projection of your freestanding pergola.':'Width runs along the house. Projection is how far your pergola extends out from it.'}</p>}
    <div className={styles.dimensions}>
    <DimensionControl axis="width" onActivity={axis => onDimensionActivity(axis as PreviewDimensionAxis | null)} label="Width" value={input.widthMm} min={Math.max(SIMPLE_COVER_WIDTH_MIN_MM, CUSTOMER_DIMENSION_BOUNDS.lengthMm.minimum)} max={SIMPLE_COVER_WIDTH_MAX_MM}
      onChange={(widthMm) => update({ ...input, widthMm })} />
    <DimensionControl key={projectionMax} axis="projection" onActivity={axis => onDimensionActivity(axis as PreviewDimensionAxis | null)} label="Projection" value={input.projectionMm} min={Math.max(SIMPLE_COVER_PROJECTION_MIN_MM, CUSTOMER_DIMENSION_BOUNDS.projectionMm.minimum)} max={projectionMax}
      onChange={(projectionMm) => update({ ...input, projectionMm })} />
    </div>
    {projectionMax < SIMPLE_COVER_PROJECTION_MAX_MM && <p className={styles.inputNotice}>Maximum projection for this roof: {metres(projectionMax)}.</p>}
    {projectionNotice && <p className={styles.inputNotice} role="status">{projectionNotice}</p>}
    </div>
    <div hidden={mode === 'size'}>
    <GableChoices value={roof} onChange={updateRoof} />
    <div className={ui.group}><div className={styles.sectionLabel}><h2>House connection</h2></div>
    <fieldset className={styles.choices}><legend>Position</legend>
      {(['attached','freestanding','unsure'] as const).map(choice=><label key={choice} data-selected={(roof.attachmentIntent??'attached')===choice}>
        <input type="radio" name="pergola-position" checked={(roof.attachmentIntent??'attached')===choice} onChange={()=>updateRoof({...roof,attachmentIntent:choice==='attached'?undefined:choice})}/>
        {choice==='attached'?'Attached to house':choice==='freestanding'?'Freestanding':'Not sure'}
      </label>)}
    </fieldset>
    {roof.attachmentIntent==='freestanding'?<p className={styles.small}>Supported by posts, with no house connection.</p>:roof.attachmentIntent==='unsure'?<p className={styles.small}>Your estimate uses the lowest-priced available attachment. We’ll confirm what suits your home.</p>:roof.family === 'gable' && roof.orientation === 'away' ? <p className={styles.small}>Fascia attachment · Dutch-gable roof</p>
      : <><AttachmentChoices key={roof.family} allowFascia={roof.family !== 'box'} value={input.connection} soffitUnavailable={soffitUnavailable} onChange={connection => update({ ...input, connection })} />
    {soffitUnavailable && <p className={styles.inputNotice} role="status">{connectionNotice}Soffit brackets are available up to 4.0 m projection.</p>}</>}
    <fieldset className={`${styles.choices} ${ui.options}`}><legend>Site level</legend>
      {(['ground', 'elevated'] as const).map((level) => <label key={level} data-selected={input.level === level}>
        <input type="radio" name="level" value={level} checked={input.level === level} disabled={mode === 'details' && roof.attachmentIntent === 'freestanding' && level === 'elevated'}
          onChange={() => update({ ...input, level })} />{level === 'ground' ? 'Ground level' : 'Elevated'}
      </label>)}
    </fieldset>
    {input.level === 'elevated' && <p className={styles.small}>First-floor deck · shown 2.7 m above ground.</p>}
    </div>
    </div>
    </div>
    <div hidden={section!=='roof'}><div className={styles.sectionLabel}><h2>Roof & ceiling</h2></div><p className={ui.intro}>Choose your balance of daylight, shade and timber finishes.</p>
    <RoofFinishChoices roof={roof} input={input} onChange={updateRoof} />
    <RoofBattenControls roof={roof} onChange={updateRoof} />
    {roof.family === 'box' && <div className={styles.gableChoices}><p className={styles.small}>A level frame with the roof tucked inside. The roof changes to a shallow gable when needed to maintain drainage.</p></div>}
</div>
    <div hidden={section!=='sides'}><BlindControls /></div>

  </div>;
}
