import { STAGES } from './diagnostics';
import type { ReportQuery } from './report';

// Synthetic provider contracts only. No account or source receipt is represented.
export function coreFixture(query: ReportQuery) {
  const ranges = ['selected', ...(query.comparison ? ['prior'] : [])];
  return { reports: ['date', 'sessionDefaultChannelGroup', 'landingPage', 'eventName', null].map((dimension, index) => {
    const names = index === 3 ? [...STAGES, 'generate_lead'] : [index === 1 ? 'Organic Search' : index === 2 ? '/pergolas' : 'total'];
    const rows = names.flatMap((name, eventIndex) => ranges.map(range => ({
      dimensionValues: [...(dimension ? [{ value: dimension === 'date' ? (range === 'selected' ? query.period.start : query.comparison!.start).replaceAll('-', '') : name }] : []), ...(query.comparison ? [{ value: range }] : [])],
      metricValues: [{ value: index === 3 && eventIndex === 0 ? '0' : '13' }, ...(index === 3 ? [{ value: String([37, 21, 13, 13][eventIndex]) }] : [])],
    })));
    return { dimensionHeaders: [...(dimension ? [{ name: dimension }] : []), ...(query.comparison ? [{ name: 'dateRange' }] : [])],
      metricHeaders: [{ name: index === 3 ? 'keyEvents' : 'sessions', type: 'TYPE_INTEGER' }, ...(index === 3 ? [{ name: 'eventCount', type: 'TYPE_INTEGER' }] : [])],
      rows, rowCount: rows.length, metadata: { timeZone: 'Pacific/Auckland', subjectToThresholding: false, dataLossFromOtherRow: false } };
  }) };
}
export function acquisitionFixture(query: ReportQuery, cohorts = 3) {
  const ranges = ['selected', ...(query.comparison ? ['prior'] : [])];
  return { reports: [false, true].map(events => {
    const rows = Array.from({ length: cohorts }, (_, cohort) => (events ? [...STAGES] : ['sessions']).flatMap((event, stage) => ranges.map(range => ({
      dimensionValues: [{ value: cohort % 2 ? 'google / cpc' : 'google / organic' }, { value: `/pergolas-${cohort}` }, { value: cohort % 2 ? 'mobile' : 'desktop' },
        ...(events ? [{ value: event }] : []), ...(query.comparison ? [{ value: range }] : [])],
      metricValues: [{ value: String(events ? [7, 4, 2][stage] : cohort === 0 ? 0 : 20 + cohort) }],
    })))).flat();
    return { dimensionHeaders: ['sessionSourceMedium', 'landingPage', 'deviceCategory', ...(events ? ['eventName'] : []), ...(query.comparison ? ['dateRange'] : [])].map(name => ({ name })),
      metricHeaders: [{ name: events ? 'eventCount' : 'sessions', type: 'TYPE_INTEGER' }], rows, rowCount: cohorts * (events ? 3 : 1),
      metadata: { timeZone: 'Pacific/Auckland', subjectToThresholding: false, dataLossFromOtherRow: false } };
  }) };
}
