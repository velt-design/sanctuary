import {z} from 'zod';
const count=z.number().int().min(0).max(10000);
function logAdd(a: number, b: number) { const m = Math.max(a, b); return m === -Infinity ? m : m + Math.log(Math.exp(a - m) + Math.exp(b - m)); }
function binomialCdf(k: number, n: number, p: number) {
  if (p === 0) return 1; if (p === 1) return k === n ? 1 : 0;
  let term = n * Math.log1p(-p), sum = term;
  for (let i = 1; i <= k; i++) { term += Math.log(n - i + 1) - Math.log(i) + Math.log(p) - Math.log1p(-p); sum = logAdd(sum, term); }
  return Math.min(1, Math.exp(sum));
}
function invertCdf(k: number, n: number, target: number) {
  let lower = 0, upper = 1;
  for (let i = 0; i < 64; i++) { const p = (lower + upper) / 2; if (binomialCdf(k, n, p) > target) lower = p; else upper = p; }
  return (lower + upper) / 2;
}
export function exactRateRatio(control: { enquiries: number; spend: number }, challenger: { enquiries: number; spend: number }) {
  const input = z.object({ enquiries: count, spend: z.number().positive().finite().max(1000000) }).strict();
  input.parse(control); input.parse(challenger);
  const n = control.enquiries + challenger.enquiries, k = challenger.enquiries;
  if (!n) return null;
  const pLow = k === 0 ? 0 : invertCdf(k - 1, n, .975);
  const pHigh = k === n ? 1 : invertCdf(k, n, .025);
  const ratio = (p: number) => p === 1 ? null : p / (1 - p) * control.spend / challenger.spend;
  return { lower: ratio(pLow)!, upper: ratio(pHigh), upperUnbounded: pHigh === 1 };
}
