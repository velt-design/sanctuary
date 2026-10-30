import {isStudioObject} from './contracts';
import {studioPriceExactKeys,studioPriceUuid} from './pricedCandidate';
export function parseStudioQuoteDraftCommand(input:unknown){
 if(!isStudioObject(input)||!studioPriceExactKeys(input,['schemaVersion','requestId','reviewId','expectedContentDigest'])
 ||input.schemaVersion!=='studio_quote_draft_command.v1'||!studioPriceUuid(input.requestId)||!studioPriceUuid(input.reviewId)
 ||typeof input.expectedContentDigest!=='string'||!/^[a-f0-9]{64}$/.test(input.expectedContentDigest))return {ok:false as const};
 return {ok:true as const,value:{schemaVersion:'studio_quote_draft_command.v1' as const,requestId:input.requestId,reviewId:input.reviewId,expectedContentDigest:input.expectedContentDigest}};
}
