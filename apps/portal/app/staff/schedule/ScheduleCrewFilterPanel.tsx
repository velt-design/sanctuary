'use client';
import {useLayoutEffect,useRef} from 'react';
import type {ScheduleCrewFilterProps} from './ScheduleCrewFilterSurface';
import styles from './ScheduleCrewFilter.module.css';
function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function ScheduleCrewFilterPanel({crews,hiddenCrewIds,hiddenItemCount,emptyCrewIds,disabled:disabledProp=false,readState,onToggleCrew,onHideCrews,onShowAllCrews}:ScheduleCrewFilterProps){
  const disabled=disabledProp||Boolean(readState);
  const hiddenCount=hiddenCrewIds.size;
  const callbacks=useRef({onToggleCrew,onHideCrews,onShowAllCrews});callbacks.current={onToggleCrew,onHideCrews,onShowAllCrews};
  const alive=useRef(true);useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  return <>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.title}>Crews in Schedule</div>
            <div className={styles.summary} aria-live="polite">
              {readState?readState==='pending'?'Reading crews and scheduled work…':'Crew evidence unavailable':hiddenCount > 0
                ? `${pluralize(hiddenCount, 'crew', 'crews')} hidden${!readState && hiddenItemCount > 0 ? ` / ${pluralize(hiddenItemCount, 'item')} hidden` : ''}`
                : 'All crews visible'}
            </div>
          </div>
          <button
            type="button"
            className={styles.textButton}
            disabled={disabled || hiddenCount === 0}
            onClick={()=>{if(alive.current&&callbacks.current.onShowAllCrews===onShowAllCrews)onShowAllCrews();}}
          >
            Show all
          </button>
        </div>

        <p className={styles.help}>Saved on this browser. This only changes Schedule views; it does not deactivate crews or change access.</p>

        <fieldset className={styles.crewList} disabled={disabled}>
          <legend className={styles.legend}>Choose visible crews</legend>
          {crews.map((crew) => (
            <label key={crew.id} className={styles.crewOption}>
              <input
                type="checkbox"
                data-crew-id={crew.id}
                checked={!hiddenCrewIds.has(crew.id)}
                onChange={() => {if(alive.current&&callbacks.current.onToggleCrew===onToggleCrew)onToggleCrew(crew.id);}}
              />
              <span className={styles.crewDot} style={{ background: crew.color }} aria-hidden="true" />
              <span className={styles.crewName}>{crew.name}</span>
              <span className={styles.itemCount}>{readState?'Not loaded':pluralize(crew.itemCount, 'item')}</span>
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          className={styles.secondaryButton}
          disabled={disabled || emptyCrewIds.length === 0 || emptyCrewIds.every((crewId) => hiddenCrewIds.has(crewId))}
          onClick={() => {if(alive.current&&callbacks.current.onHideCrews===onHideCrews)onHideCrews(emptyCrewIds);}}
        >
          Hide empty crews
        </button>
  </>;
}
