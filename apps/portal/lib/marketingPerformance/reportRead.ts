/** Only safe public errors and verified evidence cross the Flight/API boundary. */
export type ReportRead<T> = {ok:true;report:T}|{ok:false;status:number;error:string};
export type InitialReport<T> = {key:string;result:Promise<ReportRead<T>>};
