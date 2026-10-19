import { describe,it,expect } from 'vitest';
import { normalizeCalendar,normalizeCalendarEvent,calendarText } from './normalizeCalendar';
import { visitDay,visitTime,visibleVisits,isScheduledVisit } from './calendarModel';
import type { CalendarVisit } from './contract';
const staff=new Set(['rep@example.invalid']);
const invite=(email:string,name=email)=>({emailAddress:{address:email,name}});
const graph=(extra:Record<string,unknown>={})=>({id:'immutable-one',iCalUId:'occurrence-one',subject:'Site visit - Example',
  start:{dateTime:'2026-10-19T21:15:00.0000000',timeZone:'UTC'},end:{dateTime:'2026-10-19T21:45:00.0000000',timeZone:'UTC'},
  sensitivity:'normal',isCancelled:false,body:{contentType:'html',content:'<p>Address: 12 Example Road, Auckland</p>'},
  attendees:[invite('rep@example.invalid','Example Rep'),invite('customer@example.invalid')],categories:[],webLink:'https://outlook.office.com/calendar/item/example',...extra});
const normalize=(e:unknown)=>normalizeCalendarEvent(e,staff,'office@example.invalid');
describe('Graph calendar interpretation',()=>{
  it('uses source instants and source staff invitations without inferring acceptance or completion',()=>{
    const visit=normalize(graph())!;expect(visit).toMatchObject({sourceKey:'occurrence-one',startsAt:'2026-10-19T21:15:00.000Z',kind:'visit',staff:[{email:'rep@example.invalid',name:'Example Rep'}],address:'12 Example Road, Auckland'});
    expect(visit).not.toHaveProperty('completed');expect(visit).not.toHaveProperty('confirmed');expect(visitDay(visit.startsAt)).toBe('2026-10-20');expect(visitTime(visit.startsAt)).toMatch(/10:15/);
  });
  it('keeps recurring occurrences separate and a moved exception on the same occurrence identity',()=>{
    const entries=normalizeCalendar([graph(),graph({id:'immutable-two',iCalUId:'occurrence-two',type:'occurrence'}),graph({id:'immutable-three',iCalUId:'occurrence-three',type:'exception'})],staff,'office@example.invalid');
    expect(entries.map(e=>e.sourceKey)).toEqual(['occurrence-one','occurrence-two','occurrence-three']);
    expect(normalize(graph({id:'moved-id',type:'exception',start:{dateTime:'2026-10-19T21:25:00',timeZone:'UTC'}}))?.sourceKey).toBe('occurrence-one');
    expect(()=>normalizeCalendar([graph(),graph()],staff,'office@example.invalid')).toThrow('CALENDAR_DUPLICATE_ID');
  });
  it('preserves NZ daylight-saving offsets and rejects non-UTC or malformed Graph instants',()=>{
    expect(visitTime('2026-09-26T14:30:00Z')).toMatch(/3:30/);expect(visitTime('2026-09-25T14:30:00Z')).toMatch(/2:30/);
    expect(()=>normalize(graph({start:{dateTime:'2026-10-20T10:15:00',timeZone:'New Zealand Standard Time'}}))).toThrow('CALENDAR_TIME_ZONE');
    expect(()=>normalize(graph({end:{dateTime:'bad',timeZone:'UTC'}}))).toThrow();
  });
  it('extracts bare addresses after inline media without persisting notes or markup',()=>{
    const body='<p>Appointment notes</p><img src="cid:private-image"><div>42 Sample Avenue, Test Bay</div><script>alert(1)</script><p>Private access notes here</p>';
    const visit=normalize(graph({body:{contentType:'html',content:body},location:{displayName:'Test Bay'}}))!;
    expect(visit.address).toBe('42 Sample Avenue, Test Bay');expect(JSON.stringify(visit)).not.toContain('Private access notes');expect(calendarText(body)).not.toContain('alert');
    expect(normalize(graph({body:{contentType:'text',content:'99 Office Road\nAddress: 42 Sample Avenue'},location:{displayName:'Area'}}))?.address).toBe('42 Sample Avenue');
    expect(normalize(graph({body:{contentType:'text',content:'**ADDRESS:** 42 Sample Avenue\n![photo.jpeg](data:image/jpeg;base64,SYNTHETIC)'}}))?.address).toBe('42 Sample Avenue');
    expect(normalize(graph({body:{contentType:'text',content:'**Address:** [1/6 Samplemead, Test area](https://example.invalid/maps)'}}))?.address).toBe('1/6 Samplemead, Test area');
    expect(normalize(graph({body:{contentType:'text',content:'Address: TBC'}}))?.reviewReasons).toContain('Address is provisional. Check Outlook.');
  });
  it('accepts authored customer email fields across bold HTML/line breaks, without quoted or signature addresses',()=>{
    for(const label of ['Email to search up in info:','EMAIL TO SEARCH INFO:','Email:','<b>Email to search</b><br><span>up in info:</span>']) {
      const visit=normalize(graph({attendees:[invite('rep@example.invalid')],body:{contentType:'html',content:`<p>${label}</p><p>[customer@example.invalid]</p><p>12 Example Road</p><p>Signature signature@example.invalid</p><blockquote><p>Email: quoted@example.invalid</p></blockquote>`}}))!;
      expect(visit.customerEmails).toEqual(['customer@example.invalid']);
    }
    expect(normalize(graph({attendees:[],body:{contentType:'text',content:'Email: office@example.invalid\nFrom: other@example.invalid\nSent: yesterday\nEmail: quoted@example.invalid'}}))?.customerEmails).toEqual([]);
  });
  it('separates uncertain, provisional, cancelled and private entries; a title is not an assignment',()=>{
    expect(normalize(graph({subject:'Client appointment'}))?.kind).toBe('review');
    const provisional=normalize(graph({subject:'Placeholder - Joe',attendees:[]}))!;expect(provisional).toMatchObject({kind:'provisional',staff:[],assignmentHint:'Joe'});
    expect(normalize(graph({isCancelled:true}))?.cancelled).toBe(true);
    expect(normalize(graph({sensitivity:'private'}))).toBeNull();
    expect(()=>normalize(graph({sensitivity:undefined}))).toThrow();expect(()=>normalize(graph({isCancelled:undefined}))).toThrow();
    expect(normalize(graph({subject:'Internal team meeting',attendees:[],body:undefined}))?.kind).toBe('review');
    expect(normalize(graph({subject:'Unlabelled place',attendees:[],body:undefined}))?.kind).toBe('review');
  });
  it('uses a leading standalone customer email only on explicit/provisional visits, before inline media',()=>{
    const body={contentType:'html',content:'customer@example.invalid[photo.jpeg](https://example.invalid/photo)\n![image.jpeg](data:image/jpeg;base64,SYNTHETIC)\n42 Sample Avenue'};
    expect(normalize(graph({attendees:[],body}))?.customerEmails).toEqual(['customer@example.invalid']);
    expect(normalize(graph({subject:'Unlabelled appointment',attendees:[],body}))?.customerEmails).toEqual([]);
    expect(normalize(graph({attendees:[],body:{contentType:'text',content:'Customer notes\nsignature@example.invalid'}}))?.customerEmails).toEqual([]);
  });
  it('flags only corroborated duplicate invitations and rejects unsafe Outlook URLs',()=>{
    const entries=normalizeCalendar([graph(),graph({id:'second',iCalUId:'second',attendees:[invite('customer@example.invalid')]}),graph({id:'third',iCalUId:'third',attendees:[]})],staff,'office@example.invalid');
    expect(entries.map(e=>e.duplicate)).toEqual([false,true,false]);expect(normalize(graph({webLink:'https://outlook.office.com.evil.invalid/read'}))?.sourceUrl).toBeNull();
  });
});
describe('Agenda choices',()=>{
  const visit=(extra:Partial<CalendarVisit>={}):CalendarVisit=>({...normalize(graph())!,id:'one',revision:1,sourceKind:'visit',removed:false,projectId:null,projectName:null,contactName:null,phone:null,linkMode:'auto',kindOverride:null,...extra});
  const now=new Date('2026-10-19T23:00:00Z');
  it('does not count duplicate/uncertain/cancelled bookings as scheduled visits and keeps recovery reachable',()=>{
    const events=[visit(),visit({id:'provisional',kind:'provisional'}),visit({id:'duplicate',duplicate:true}),visit({id:'review',kind:'review'}),visit({id:'cancelled',cancelled:true}),visit({id:'excluded',kind:'excluded'})];
    expect(visibleVisits(events,'today','','',now).map(e=>e.id)).toEqual(['one','provisional']);
    expect(events.filter(isScheduledVisit)).toHaveLength(1);
    expect(visibleVisits(events,'changes','','',now).map(e=>e.id)).toEqual(['cancelled','excluded']);
    expect(visibleVisits(events,'review','','',now).map(e=>e.id)).toEqual(['one','provisional','duplicate','review']);
  });
  it('filters independently by exact staff, unassigned, words, NZ date and week',()=>{
    const events=[visit(),visit({id:'future',startsAt:'2026-10-26T00:00:00Z',endsAt:'2026-10-26T00:30:00Z',staff:[]})];
    expect(visibleVisits(events,'today','rep@example.invalid','example road',now)).toHaveLength(1);
    expect(visibleVisits(events,'today','unknown@example.invalid','',now)).toHaveLength(0);
    expect(visibleVisits(events,'upcoming','unassigned','',now).map(e=>e.id)).toEqual(['future']);
    expect(visibleVisits(events,'week','','',now).map(e=>e.id)).toEqual(['one']);
  });
});
