'use client';
import ScheduleCrewFilterSurface, {type ScheduleCrewFilterProps} from './ScheduleCrewFilterSurface';
import ScheduleCrewFilterPanel from './ScheduleCrewFilterPanel';
export type {ScheduleCrewFilterOption} from './ScheduleCrewFilterSurface';
export default function ScheduleCrewFilter(props:ScheduleCrewFilterProps){
  return <ScheduleCrewFilterSurface {...props} panel={props.panel??<ScheduleCrewFilterPanel {...props}/>}/>;
}
