// @vitest-environment node
import { describe,it,expect,vi } from 'vitest';
import { readGraphCalendar } from './graphCalendar';
import type { OutlookCalendarConfig } from './config';
const cfg:OutlookCalendarConfig={tenantId:'tenant',clientId:'client',mailboxId:'mailbox',mailbox:'office@example.invalid',calendarId:'calendar/id',staffEmails:new Set(),binding:'binding',origin:'https://portal.example.invalid'};
const path='https://graph.microsoft.com/v1.0/users/mailbox/calendars/calendar%2Fid/calendarView';
const from='2026-10-01T00:00:00Z',to='2026-11-01T00:00:00Z';
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status});
const run=(fetcher:ReturnType<typeof vi.fn>)=>readGraphCalendar(cfg,'signed-assertion',from,to,new AbortController().signal,fetcher as typeof fetch);
describe('Bounded Microsoft Graph read',()=>{
  it('uses federation and the bound mailbox/calendar, expands calendarView and consumes every page',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(response({access_token:'access',token_type:'Bearer'})).mockResolvedValueOnce(response({value:[{id:'occurrence'}],'@odata.nextLink':`${path}?$skiptoken=next`})).mockResolvedValueOnce(response({value:[{id:'exception'}]}));
    expect(await run(fetcher)).toEqual([{id:'occurrence'},{id:'exception'}]);
    expect(fetcher.mock.calls[0][0]).toBe('https://login.microsoftonline.com/tenant/oauth2/v2.0/token');
    const token=fetcher.mock.calls[0][1];expect(token.body.get('client_assertion')).toBe('signed-assertion');expect(token.body.has('client_secret')).toBe(false);
    const url=new URL(fetcher.mock.calls[1][0]);expect(url.pathname).toBe(new URL(path).pathname);expect(url.searchParams.get('startDateTime')).toBe(from);
    expect(fetcher.mock.calls[1][1]).toMatchObject({redirect:'error',headers:{Prefer:'outlook.timezone="UTC", outlook.body-content-type="text", IdType="ImmutableId"'}});
  });
  it('never returns a partial page set on provider failure or bad pagination',async()=>{
    for(const next of ['https://evil.invalid/steal',path.replace('/mailbox/','/other/'),'relative-link']){
      const fetcher=vi.fn().mockResolvedValueOnce(response({access_token:'access',token_type:'Bearer'})).mockResolvedValueOnce(response({value:[{id:'first'}],'@odata.nextLink':next}));
      await expect(run(fetcher)).rejects.toThrow();expect(fetcher).toHaveBeenCalledTimes(2);
    }
    const fail=vi.fn().mockResolvedValueOnce(response({access_token:'access',token_type:'Bearer'})).mockResolvedValueOnce(response({value:[{id:'first'}],'@odata.nextLink':`${path}?page=2`})).mockResolvedValueOnce(response({error:'private provider detail'},503));
    await expect(run(fail)).rejects.toMatchObject({code:'SOURCE_UNAVAILABLE'});
  });
  it('bounds page count, detects loops, fails closed on malformed payloads and sanitizes access errors',async()=>{
    const loop=vi.fn().mockResolvedValueOnce(response({access_token:'access',token_type:'Bearer'})).mockImplementation(async()=>response({value:[],'@odata.nextLink':`${path}?loop=1`}));
    await expect(run(loop)).rejects.toMatchObject({code:'SOURCE_INVALID'});expect(loop).toHaveBeenCalledTimes(3);
    const many=vi.fn().mockResolvedValueOnce(response({access_token:'access',token_type:'Bearer'})).mockImplementation(async()=>response({value:[],'@odata.nextLink':`${path}?page=${many.mock.calls.length}`}));
    await expect(run(many)).rejects.toMatchObject({code:'SOURCE_LIMIT'});expect(many).toHaveBeenCalledTimes(21);
    await expect(run(vi.fn().mockResolvedValue(response({error:'sensitive tenant detail'},403)))).rejects.toMatchObject({message:'ACCESS_REQUIRED'});
    await expect(run(vi.fn().mockResolvedValueOnce(response({access_token:'access',token_type:'Bearer'})).mockResolvedValueOnce(response({value:'not-an-array'})))).rejects.toThrow();
  });
});
