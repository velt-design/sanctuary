import {isStudioObject} from './contracts';
import {studioPriceUuid} from './pricedCandidate';

export function parseStudioQuoteReviewCommand(input:unknown) {
  if(!isStudioObject(input)||Object.keys(input).sort().join(',')!=='expectedContentDigest,requestId,schemaVersion'
    ||input.schemaVersion!=='studio_quote_review_command.v1'||!studioPriceUuid(input.requestId)
    ||typeof input.expectedContentDigest!=='string'||!/^[a-f0-9]{64}$/.test(input.expectedContentDigest))return {ok:false as const};
  return {ok:true as const,value:{schemaVersion:'studio_quote_review_command.v1' as const,requestId:input.requestId,expectedContentDigest:input.expectedContentDigest}};
}
