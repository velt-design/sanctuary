import { z } from 'zod';

const zone='Pacific/Auckland';
const dateParts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
const offsetParts=new Intl.DateTimeFormat('en-NZ',{timeZone:zone,timeZoneName:'longOffset'});
function midnight(date:string) {
  const wall=Date.parse(`${date}T00:00:00Z`);let value=wall;
  // Re-evaluate at the resulting instant so a DST transition later that day
  // cannot give midnight the following day's offset.
  for(let i=0;i<2;i++){
    const offset=offsetParts.formatToParts(new Date(value)).find(part=>part.type==='timeZoneName')!.value.match(/^GMT([+-])(\d{2}):(\d{2})$/);
    if(!offset)throw new Error('CALENDAR_ALL_DAY_ZONE');
    value=wall-(offset[1]==='-'?-1:1)*(Number(offset[2])*60+Number(offset[3]))*60000;
  }
  return new Date(value).toISOString();
}
type Boundary={dateTime:string;timeZone:string};
export function allDayCalendarBounds(start:Boundary,end:Boundary) {
  const sourceZone=start.timeZone.trim();
  if(!sourceZone||sourceZone.length>150||sourceZone!==end.timeZone.trim())throw new Error('CALENDAR_ALL_DAY_ZONE');
  const literal=(value:string)=>value.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.0+)?(?:Z|\+00:00)?$/)?.[1];
  let first=literal(start.dateTime),last=literal(end.dateTime);
  if(!first||!last){
    // Compatibility for a UTC response that converted both NZ midnight boundaries.
    // Mixed floating/converted or non-midnight values are not safe date evidence.
    if(first||last||!['UTC','Etc/UTC'].includes(sourceZone))throw new Error('CALENDAR_ALL_DAY_BOUNDARY');
    const converted=(value:string)=>{
      const text=value.replace(/(\.\d{3})\d+/,'$1');
      const instant=new Date(/Z$|[+-]\d\d:\d\d$/.test(text)?text:`${text}Z`);
      if(!Number.isFinite(instant.valueOf()))throw new Error('CALENDAR_ALL_DAY_BOUNDARY');
      const date=dateParts.format(instant);
      if(midnight(date)!==instant.toISOString())throw new Error('CALENDAR_ALL_DAY_BOUNDARY');
      return date;
    };
    first=converted(start.dateTime);last=converted(end.dateTime);
  }
  const allDayStartDate=z.iso.date().parse(first),allDayEndDate=z.iso.date().parse(last);
  if(allDayEndDate<=allDayStartDate)throw new Error('CALENDAR_ALL_DAY_RANGE');
  return {isAllDay:true as const,allDayStartDate,allDayEndDate,startsAt:midnight(first),endsAt:midnight(last)};
}
