import { z } from 'zod';
import { hubSchema } from './hub';
import { aucklandDay } from './contract';

export const snapshotSchema=z.object({report:hubSchema,excludedTestDates:z.array(z.string().datetime({offset:true}))});
export class SnapshotCoverageError extends Error {
  constructor(){super('These dates fall outside this preview snapshot. Choose dates from 23 September 2025 through 22 September 2026.');}
}
export function sliceSnapshot(raw:unknown,start:string,end:string,receiptsOnly=false){
  const {report,excludedTestDates}=snapshotSchema.parse(raw);
  if(end>report.end || (start<report.start && (!receiptsOnly || !report.earliestReceipt || aucklandDay(new Date(report.earliestReceipt))<report.start)))
    throw new SnapshotCoverageError();
  const within=(date:string)=>date>=start&&date<=end;
  return {...report,start,end,events:report.events.filter(e=>within(e.day)),enquiries:{...report.enquiries,start,end,
    rows:report.enquiries.rows.filter(r=>within(aucklandDay(new Date(r.receivedAt)))),
    excludedTests:excludedTestDates.filter(d=>within(aucklandDay(new Date(d)))).length}};
}
