import type {DashboardData} from '@/lib/dashboard/types';
import type {VisitSnapshot} from '@/lib/siteVisits/contract';
import {visitDay} from '@/lib/siteVisits/calendarModel';
import type {RunningJobRow,RunningJobsResponse} from '@/lib/runningJobs/types';
const id='99999999-9999-4999-8999-999999999999';
export function dashboardFixture():DashboardData{
 const now=new Date().toISOString();
 return {updatedAtIso:now,kpis:{newLeads:7,quotesToSend:4,installsThisWeek:2},pipelineCounts:{NEW:7,QUOTING:4,DEPOSIT:2},pipelineCountsScope:'open_enquiry_proposal_v1',pipelineCountsAvailable:true,projectStateCounts:{totalCount:23,ACTIVE:13,WAITING:3,CLOSED:5,ARCHIVED:2},projectStateCountsAvailable:true,
 schedule:{startingSoon:[],crewAvailability:[],hrefBoard:'/staff/schedule?view=board',hrefGantt:'/staff/schedule?view=gantt'},siteVisits:{unscheduledCount:0,today:[],next7:[],hrefSiteVisits:'/staff/site-visits'},projectWorkQueue:[],projectWorkQueueAvailable:true,
 recentActivity:[{id:'fictional-note',type:'project_note',at:now,body:'Fictional review note. No customer system was contacted.',projectId:id,projectName:'Demo courtyard',authorDisplayName:'Demo team',href:'#fictional-record-notice'}],recentEstimates:[],personalTasks:[{id:'fictional-task',title:'Review fictional courtyard plan',createdAt:now,updatedAt:now,completedAt:null}]};
}
export function visitsFixture():VisitSnapshot{
 const now=new Date().toISOString(),day=visitDay(now),tomorrow=new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10);
 return {enabled:true,lastSuccess:now,lastAttempt:now,error:null,rangeStart:now,rangeEnd:now,syncing:false,events:[{id,revision:1,sourceKey:'fictional',subject:'Demo courtyard visit',startsAt:null,endsAt:null,isAllDay:true,allDayStartDate:day,allDayEndDate:tomorrow,sourceUrl:null,address:null,staff:[],assignmentHint:null,kind:'visit',sourceKind:'visit',cancelled:false,removed:false,duplicate:false,reviewReasons:[],projectId:id,projectName:'Demo courtyard',contactName:'Demo household',phone:null,linkMode:'manual',kindOverride:null}]};
}
export function sheetFixture():RunningJobsResponse{
 const now=new Date().toISOString();
 const row:RunningJobRow={projectId:id,source:'live',groupYear:2026,sourceRowNumber:null,contactId:null,siteVisitEventId:null,scheduledJobId:null,latestEstimateId:null,latestQuoteVersionId:null,legacy:null,stage:'DEPOSIT',sortDate:now.slice(0,10),rowVersion:'fictional-1',displayTextByCell:{},
 cells:{client_name:'Demo courtyard',phone_number:'',site_address:'Fictional site',site_visit_rep:null,deposit_paid_date:null,materials_ordered:false,pergola_type:'Demo pergola',estimated_start_date:null,final_payment_date:null,job_assigned_to:null,job_completed:false,lights_status:'TBC',blinds_status:'No',install_days:null,size_text:'',colour_text:'',roofing_text:'',roofing_ordered:false,running_notes:'Fictional read-only row.'},
 derived:{pergola_type:'Demo pergola',lights_status:'TBC',blinds_status:'No',size_text:null,colour_text:null,roofing_text:null},
 state:{workModelVersion:2,projectCreatedAt:now,hasSiteVisit:false,hasSchedule:false,hasCrewAssigned:false,hasEstimatedStartDate:false,hasLatestEstimate:false,tasks:{materialsOrdered:false,roofingOrdered:false,jobComplete:false},siteVisit:{salespersonId:null,status:null,updatedAt:null},schedule:{crewId:null,plannedStart:null,forecastStart:null,plannedDurationDays:null,forecastDurationDays:null,actualStart:null,actualFinish:null,status:null,updatedAt:null},meta:{rowVersion:1,lightsStatus:null,materialsOrderedAt:null,materialsOrderedBy:null,roofingOrderedAt:null,roofingOrderedBy:null,updatedAt:now}}};
 return {generatedAt:now,lookups:{crews:[],salesPeople:[]},groups:[{year:2026,rows:[row]}]};
}

export function projectsFixture(params:import('@/lib/projects/projectsIndexContract').ProjectsIndexParams):import('@/lib/projects/projectsIndexContract').ProjectsIndexResponse{
 const now='2026-10-23T00:00:00Z';
 const rows=['Alpha','Beta'].map((name,index)=>({id:'proj_fictional_'+index,projectName:'Fixture '+name,createdAt:now,updatedAt:now,status:'NEW' as const,isArchived:false}))
   .filter(row=>row.projectName.toLowerCase().includes(params.search.trim().toLowerCase())&&(params.status==='all'||params.status==='NEW'));
 const {archive,page,pageSize,...query}=params;
 return {archive,query,generatedAt:now,projects:{rows,totalCount:rows.length,truncated:false,page,pageSize,totalPages:1},contacts:{rows:[],totalCount:0,truncated:false}};
}
export function draftingFixture():import('@/lib/designPackages/types').DesignPackagesResponse{
 const now='2026-10-23T00:00:00Z';
 return {generatedAt:now,lookups:{designers:[]},rows:[{requestId:'fictional-request',projectId:'proj_fictional_alpha',estimateId:null,estimateVersionLabel:null,requestVersion:1,status:'OPEN',priorityTier:'TIER_1',priceTotalIncGstCents:null,requestSource:'legacy_backfill',requestedAt:now,dueAt:null,startedAt:null,completedAt:null,cancelledAt:null,updatedAt:now,rowVersion:'fictional-1',quoteName:'Fixture Alpha',projectName:'Fixture Alpha',clientName:'Fictional household',siteAddress:'Fictional site',siteVisitRep:null,sentAt:null,sentQuoteRef:null,visitStatus:null,visitCompletedAt:null,notes:'Fictional read-only request.',requestNote:null,designerNote:null,assignedDesignerId:null}]};
}
