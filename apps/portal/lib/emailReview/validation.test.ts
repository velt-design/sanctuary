import { describe,it,expect } from 'vitest';
import { parseReviewCommand,parseReviewImport } from './validation';
const id='00000000-0000-4000-8000-000000000001';
const input=()=>({commandId:id,sourceKey:'synthetic',title:'Review',reviewerId:id,items:[{sourceId:'a',projectId:id,to:'a@example.invalid',subject:'Re: Scope',body:'Hello',prerequisites:['Check scope'],evidence:[],context:''}]});
describe('email review request contracts',()=>{
 it.each([undefined,'',' \n\t'])('requires a nonblank skip explanation: %s',note=>{expect(()=>parseReviewCommand({commandId:id,expectedRevision:1,action:'skip',...(note===undefined?{}:{note})})).toThrow();});
 it('preserves exact text and adds empty candidate list',()=>{const x=input();x.items[0].body='  Hello\n\nthere  ';expect(parseReviewImport(x).items[0]).toMatchObject({body:x.items[0].body,threads:[]});});
 it.each(['actorId','approvedBy','status','dispatchId'])('rejects client authority field %s',key=>{expect(()=>parseReviewCommand({commandId:id,expectedRevision:1,action:'skip',[key]:id})).toThrow();});
 it('rejects duplicate IDs, oversized manifests, header injection and non-HTTPS evidence',()=>{const x=input();x.items.push(x.items[0]);expect(()=>parseReviewImport(x)).toThrow();expect(()=>parseReviewImport({...input(),items:Array(501).fill(input().items[0])})).toThrow();for(const patch of [{to:'a@example.invalid,b@example.invalid'},{subject:'Re: Scope\r\nBcc: x'},{evidence:[{label:'x',url:'javascript:alert(1)'}]}])expect(()=>parseReviewImport({...input(),items:[{...input().items[0],...patch}]})).toThrow();});
 it('requires both explicit approval confirmations',()=>{expect(()=>parseReviewCommand({commandId:id,expectedRevision:1,action:'approve',prerequisitesConfirmed:true})).toThrow();expect(parseReviewCommand({commandId:id,expectedRevision:1,action:'approve',prerequisitesConfirmed:true,threadConfirmed:true}).threadConfirmed).toBe(true);});
 it('requires displayed hash for explicit context rebase, supports thread deselection',()=>{expect(()=>parseReviewCommand({commandId:id,expectedRevision:1,action:'save',acknowledgeContextChange:true})).toThrow();expect(parseReviewCommand({commandId:id,expectedRevision:1,action:'save',threadMessageId:null}).threadMessageId).toBeNull();});
 it('rejects untrusted thread locations and fabricated metadata fields',()=>{expect(()=>parseReviewImport({...input(),items:[{...input().items[0],threads:[{messageId:'m',webLink:'https://evil.invalid/mail',subject:'Scope',matchedRecipient:'a@example.invalid'}]}]})).toThrow();});
});
