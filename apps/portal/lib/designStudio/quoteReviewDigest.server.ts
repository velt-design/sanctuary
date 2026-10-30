import 'server-only';
import {createHash} from 'node:crypto';

/** JSONB preserves values and array order, not object insertion order. */
export function quoteReviewDigest(value:unknown):string {
  function canonical(v:unknown):string {
    if(Array.isArray(v))return `[${v.map(canonical).join(',')}]`;
    if(v&&typeof v==='object')return `{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical((v as Record<string,unknown>)[k])}`).join(',')}}`;
    return JSON.stringify(v);
  }
  return createHash('sha256').update(canonical(value)).digest('hex');
}
