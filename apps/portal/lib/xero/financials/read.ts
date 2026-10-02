import 'server-only';
import { z } from 'zod';
import { readFinancePosition, parseFinanceReport, type PositionDependencies } from '../financePosition';
import { PositionReadError, POSITION_SCOPES } from '../financePositionProvider';
import { financialsSchema, previousQuery, yearAgoQuery, trendQueries, type FinancialsQuery, type ReportEvidence } from './contract';

/** One source owner, with exact dated reports. Comparative failure never becomes a zero. */
export async function readFinancials(query: FinancialsQuery, deps: PositionDependencies, signal: AbortSignal) {
  let financialYearEnd: { month: number; day: number } | null = null;
  const position = await readFinancePosition(query, { ...deps, read: async (input, readSignal) => {
    const values = await deps.read(input, readSignal);
    if (input.family === 'organisation' && values.length === 1) {
      const parsed = z.object({ FinancialYearEndMonth: z.number().int().min(1).max(12), FinancialYearEndDay: z.number().int().min(1).max(31) }).safeParse(values[0]);
      if (parsed.success) {
        const { FinancialYearEndMonth: month, FinancialYearEndDay: day } = parsed.data;
        if (new Date(Date.UTC(2000, month - 1, day)).getUTCMonth() === month - 1) financialYearEnd = { month, day };
      }
    }
    return values;
  } }, signal);
  const previous = previousQuery(query), yearAgo = yearAgoQuery(query), months = trendQueries(query);
  const key = (q: FinancialsQuery) => `${q.from}/${q.to}/${q.basis}`;
  const reports = new Map<string, ReportEvidence>([[key(query), position.profitAndLoss]]);
  const pending = [...new Map([previous, yearAgo, ...months].filter(q => !reports.has(key(q))).map(q => [key(q), q])).values()];
  const binding = async () => {
    signal.throwIfAborted(); const current = await deps.binding(signal);
    if (current.tenantId !== position.identity.tenantId || current.scope !== position.identity.scope) throw new Error('POSITION_AUTHORITY_CHANGED');
  };
  async function read(query: FinancialsQuery): Promise<ReportEvidence> {
    if (position.organisation.status !== 'available') return { status: 'unavailable', reason: 'metadata_unavailable', requiredScopes: [POSITION_SCOPES.organisation[0]] };
    await binding();
    try {
      const values = await deps.read({ family: 'profitAndLoss', tenantId: position.identity.tenantId, query, page: 1 }, signal);
      if (values.length !== 1) throw new PositionReadError('invalid_response');
      return { status: 'available', complete: true, checkedAt: deps.now().toISOString(), data: parseFinanceReport(values[0], 'profitAndLoss', query, position.organisation.data.baseCurrency) };
    } catch (error) {
      signal.throwIfAborted();
      if (!(error instanceof PositionReadError) && !(error instanceof z.ZodError)) throw error;
      return { status: 'unavailable', reason: error instanceof PositionReadError ? error.reason : 'invalid_response', requiredScopes: [POSITION_SCOPES.profitAndLoss[0]] };
    }
  }
  // Two simultaneous reads at most. At most eight extra exact reports; overlapping periods are reused.
  for (let index = 0; index < pending.length; index += 2) {
    const pair = pending.slice(index, index + 2);
    const values = await Promise.all(pair.map(read));
    pair.forEach((query, i) => reports.set(key(query), values[i]));
  }
  await binding();
  const dated = (query: FinancialsQuery) => ({ query, report: reports.get(key(query))! });
  const result = financialsSchema.parse({ schemaVersion: 'sanctuary.financials.v1', position, financialYearEnd, checkedAt: deps.now().toISOString(),
    previous: dated(previous), yearAgo: dated(yearAgo), months: months.map(dated) });
  if (Buffer.byteLength(JSON.stringify(result)) > 4 * 1024 * 1024) throw new PositionReadError('limit_exceeded');
  return result;
}
