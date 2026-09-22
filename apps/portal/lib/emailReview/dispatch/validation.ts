import { EmailReviewInputError, reviewUuid } from '../validation';
import type { DispatchResult } from './contracts';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new EmailReviewInputError();
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, permitted: string[]) {
  if (Object.keys(value).some(key => !permitted.includes(key))) throw new EmailReviewInputError();
}
export function parseDispatchPrepare(value: unknown) {
  const data=record(value); keys(data,['commandId']);
  return {commandId:reviewUuid(data.commandId)};
}
export function parseDispatchClaim(value: unknown) {
  const data=record(value); keys(data,['commandId','limit']);
  if (!Number.isSafeInteger(data.limit) || Number(data.limit)<1 || Number(data.limit)>10) throw new EmailReviewInputError();
  return {commandId:reviewUuid(data.commandId),limit:Number(data.limit)};
}
export function parseDispatchResult(value: unknown): DispatchResult {
  const data=record(value); keys(data,['intentId','attemptId','outcome','outlookMessageId','outlookWebLink','note']);
  if (!['sent','uncertain'].includes(String(data.outcome))) throw new EmailReviewInputError();
  if (data.note!==undefined && (typeof data.note!=='string' || data.note.length>2000 || data.note.includes('\0'))) throw new EmailReviewInputError();
  if (data.outcome==='sent') {
    if (typeof data.outlookMessageId!=='string' || !data.outlookMessageId.trim() || data.outlookMessageId.length>2000 || /[\r\n\0]/.test(data.outlookMessageId)) throw new EmailReviewInputError();
    try {
      const url=new URL(String(data.outlookWebLink));
      if (url.protocol!=='https:' || !['outlook.office.com','outlook.office365.com'].includes(url.hostname) || url.username || url.password || url.href.length>4000) throw new Error();
    } catch { throw new EmailReviewInputError(); }
  } else if (data.outlookMessageId!==undefined || data.outlookWebLink!==undefined) throw new EmailReviewInputError();
  return {intentId:reviewUuid(data.intentId),attemptId:reviewUuid(data.attemptId),outcome:data.outcome as DispatchResult['outcome'],
    ...(data.outcome==='sent'?{outlookMessageId:data.outlookMessageId as string,outlookWebLink:data.outlookWebLink as string}:{}),
    ...(data.note!==undefined?{note:data.note as string}:{})};
}
