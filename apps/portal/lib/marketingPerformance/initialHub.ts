import type { HubReport } from './hub';
import type { ColumnarReport } from './columnarReports';

export type HubReadResult = { ok: true; report: HubReport }
  | { ok: false; status: 400 | 403 | 422 | 503; error: string };

// Only this safe result crosses Flight. Authority and the auth-bound client stay
// on the server; the browser does not suspend while this promise is pending.
export type InitialHubSeed = { start: string; end: string; result: Promise<Exclude<HubReadResult, { ok: true }> | { ok: true; report: HubReport | ColumnarReport }> };
