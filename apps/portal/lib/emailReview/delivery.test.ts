import {describe,it,expect} from 'vitest';
import {reviewDelivery} from './delivery';
const thread={messageId:'one',subject:'Scope',webLink:'https://outlook.office.com/mail/one',matchedRecipient:'customer@example.invalid'};
describe('displayed delivery choice',()=>{
 it('automatically retains one matching conversation and exact reply subject',()=>{expect(reviewDelivery([thread],'CUSTOMER@example.invalid','Re: Scope')).toEqual({mode:'reply',subject:'Re: Scope',threadMessageId:'one'});});
 it.each([[],[thread,{...thread,messageId:'two'}],[{...thread,matchedRecipient:'other@example.invalid'}]].map(threads=>({threads})))('uses a fresh message for missing, ambiguous or mismatched candidates',({threads})=>{expect(reviewDelivery(threads,'customer@example.invalid','Re: Re: Scope')).toEqual({mode:'new',subject:'Scope',threadMessageId:null});});
 it('preserves revised subject semantics in a fresh message',()=>{expect(reviewDelivery([thread],'customer@example.invalid','A different question')).toEqual({mode:'new',subject:'A different question',threadMessageId:null});});
});
