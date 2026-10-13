import { z } from 'zod';

// Provider enums only. Future/invalid text becomes a fixed code, never stored verbatim.
const errorNames = ['UNSPECIFIED','INVALID_CUSTOM_VARIABLE','CUSTOM_VARIABLE_NOT_ENABLED','EVENT_TOO_OLD','DENIED_CONSENT','NO_CONSENT','UNKNOWN_CONSENT','DUPLICATE_GCLID','DUPLICATE_TRANSACTION_ID','INVALID_GBRAID','INVALID_GCLID','INVALID_MERCHANT_ID','INVALID_WBRAID','INTERNAL_ERROR','DESTINATION_ACCOUNT_ENHANCED_CONVERSIONS_TERMS_NOT_SIGNED','INVALID_EVENT','INSUFFICIENT_MATCHED_TRANSACTIONS','INSUFFICIENT_TRANSACTIONS','INVALID_FORMAT','DECRYPTION_ERROR','DEK_DECRYPTION_ERROR','INVALID_WIP','INVALID_KEK','WIP_AUTH_FAILED','KEK_PERMISSION_DENIED','AWS_AUTH_FAILED','USER_IDENTIFIER_DECRYPTION_ERROR','ONE_PER_CLICK_CONVERSION_ACTION_NOT_PERMITTED_WITH_BRAID','MATCH_ID_NOT_FOUND','USER_ID_NOT_FOUND_FOR_MATCH_ID','USER_ID_NOT_FOUND_FOR_GCLID','USER_ID_NOT_FOUND_FOR_DCLID','INVALID_AD_IDENTIFIERS','INVALID_MOBILE_ID_FORMAT','ORIGINAL_CONVERSIONS_NOT_FOUND','EVENT_ID_DECODE_ERROR','USER_ID_NOT_FOUND_FOR_IMPRESSION_ID','USER_ID_NOT_FOUND','CONVERSION_PRECEDES_CLICK','TOO_RECENT_CLICK','INVALID_CLICK','INVALID_OPERATING_ACCOUNT_FOR_CLICK','CLICK_NOT_FOUND','EXTERNAL_ATTRIBUTION_DATA_MISSING','DESTINATION_TOO_RECENTLY_CREATED','EXPIRED_CLICK'];
const warningNames = ['UNSPECIFIED','KEK_PERMISSION_DENIED','DEK_DECRYPTION_ERROR','DECRYPTION_ERROR','WIP_AUTH_FAILED','INVALID_WIP','INVALID_KEK','USER_IDENTIFIER_DECRYPTION_ERROR','INTERNAL_ERROR','AWS_AUTH_FAILED'];
const errors = new Set([...errorNames.map(name=>`PROCESSING_ERROR_REASON_${name}`),'PROCESSING_ERROR_OPERATING_ACCOUNT_MISMATCH_FOR_AD_IDENTIFIER']);
const warnings = new Set(warningNames.map(name=>`PROCESSING_WARNING_REASON_${name}`));
export const providerCode = z.string().refine(code=>errors.has(code)||warnings.has(code)||code==='UNKNOWN_PROVIDER_REASON');
export const providerCount = z.object({ code: providerCode, count: z.number().int().min(0).max(1) }).strict();
export const requestStatus = z.enum(['REQUEST_STATUS_UNKNOWN','SUCCESS','PROCESSING','FAILED','PARTIAL_SUCCESS']);
export const diagnosticsSchema = z.object({ status: requestStatus, recordCount: z.number().int().min(0).max(1).nullable(),
  errors: z.array(providerCount).max(64), warnings: z.array(providerCount).max(64),
  recovery: z.enum(['ACCEPTED','POLL','RETRY','REVIEW']) }).strict();
export function sanitizeCounts(raw: { reason?: string; recordCount: string }[], severity:'errors'|'warnings') {
  const permitted = severity==='errors'?errors:warnings;
  return raw.map(row=>({code:row.reason&&permitted.has(row.reason)?row.reason:'UNKNOWN_PROVIDER_REASON',count:Number(row.recordCount)}));
}
const transient = new Set(['PROCESSING_ERROR_REASON_INTERNAL_ERROR','PROCESSING_ERROR_REASON_TOO_RECENT_CLICK','PROCESSING_ERROR_REASON_DESTINATION_TOO_RECENTLY_CREATED']);
export function recoveryFor(status:z.infer<typeof requestStatus>, errors:z.infer<typeof providerCount>[], warnings:z.infer<typeof providerCount>[]) {
  if(status==='PROCESSING'||status==='REQUEST_STATUS_UNKNOWN') return 'POLL' as const;
  const unknown = [...errors,...warnings].some(row=>row.code==='UNKNOWN_PROVIDER_REASON'||row.code.endsWith('_UNSPECIFIED'));
  if(unknown) return 'REVIEW' as const;
  if(status==='SUCCESS') return 'ACCEPTED' as const;
  if(status==='FAILED'&&errors.length>0&&errors.every(row=>row.count===1&&transient.has(row.code))) return 'RETRY' as const;
  return 'REVIEW' as const;
}
export function diagnosticLabel(code:string) {
  if(/DENIED_CONSENT|NO_CONSENT|UNKNOWN_CONSENT/.test(code))return 'Google could not accept the advertising-data permission. Review the approved policy and account settings.';
  if(code.includes('TERMS_NOT_SIGNED'))return 'Google requires conversion terms to be reviewed for this destination.';
  if(/EVENT_TOO_OLD|EXPIRED_CLICK/.test(code))return 'The sale or matching click is outside Google’s permitted window.';
  if(code.includes('DUPLICATE'))return 'Google reports an existing conversion. Reconcile the original sale before another attempt.';
  if(transient.has(code))return 'Google reported a temporary processing or account-age issue. The same sale has a bounded retry.';
  if(code.startsWith('PROCESSING_WARNING_'))return 'Google processed the request with a warning; some supplied fields may have been ignored.';
  if(code==='UNKNOWN_PROVIDER_REASON'||code.endsWith('_UNSPECIFIED'))return 'Google returned an unrecognised reason. An operator must inspect the request.';
  return 'Google could not use the event or matching details. Review the saved request before resubmitting.';
}
