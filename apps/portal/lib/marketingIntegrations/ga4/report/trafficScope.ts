// Report-only selection. Google history and property configuration are untouched.
export const TRAFFIC_SCOPE = 'production-browsing-v1';
export const TRAFFIC_SCOPE_WARNING = `Public website scope ${TRAFFIC_SCOPE}: Sanctuary production hosts only; exact codex_qa / qa and Tag Assistant referral sessions excluded. Server events without a host are outside this view. Other unmarked testing may remain. Earlier reports without this label are unfiltered; Portal owns business outcomes.`;
export function trafficFilter(event?: string | null) {
  return { andGroup: { expressions: [
    { filter: { fieldName: 'hostName', inListFilter: { values: ['sanctuarypergolas.co.nz', 'www.sanctuarypergolas.co.nz'], caseSensitive: false } } },
    { notExpression: { filter: { fieldName: 'sessionSourceMedium', inListFilter: { values: ['codex_qa / qa', 'tagassistant.google.com / referral'], caseSensitive: false } } } },
    ...(event ? [{ filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: event, caseSensitive: true } } }] : []),
  ] } };
}
