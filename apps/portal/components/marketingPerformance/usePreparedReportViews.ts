import { useCallback, useEffect, useState } from 'react';
import type { HubView } from '@/lib/marketingPerformance/hub';

type ReportComponents = {
  overview: typeof import('./BusinessOverview').default;
  enquiries: typeof import('./EnquiryCharts').default;
  sales: typeof import('./SalesActivity').default;
  portfolio: typeof import('./PortfolioChart').default;
};
type ReportView = keyof ReportComponents;
export type ReportViewLoaders = { [View in ReportView]: () => Promise<{ default: ReportComponents[View] }> };
const defaultLoaders: ReportViewLoaders = {
  overview: () => import('./BusinessOverview'),
  enquiries: () => import('./EnquiryCharts'),
  sales: () => import('./SalesActivity'),
  portfolio: () => import('./PortfolioChart'),
};
type State = {
  owner: ReportViewLoaders;
  components: Partial<ReportComponents>;
  failure: { view: ReportView; attempt: number } | null;
};

export default function usePreparedReportViews(view: HubView | null, loaders = defaultLoaders) {
  const [attempt, setAttempt] = useState(0);
  // Store component functions inside an object, never as a React state updater.
  // This cache belongs to this mounted report and contains code, not evidence.
  const [state, setState] = useState<State>({ owner: loaders, components: {}, failure: null });
  const components = state.owner === loaders ? state.components : {};
  const selected = view && view !== 'financials' ? view : null;
  const component = selected ? components[selected] : undefined;
  const error = state.owner === loaders && state.failure?.view === selected && state.failure.attempt === attempt
    ? 'The selected report view could not be loaded. Retry to continue.' : '';

  useEffect(() => {
    if (!selected || component) return;
    let active = true;
    setState(previous => ({ owner: loaders, components: previous.owner === loaders ? previous.components : {}, failure: null }));
    // Preparing the actual component during the data wait avoids creating a new
    // React.lazy suspension when an already-downloaded module first becomes visible.
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      try {
        const module = await loaders[selected]();
        if (active) setState(previous => ({ owner: loaders, components: { ...(previous.owner === loaders ? previous.components : {}), [selected]: module.default }, failure: null }));
      } catch {
        if (active) setState(previous => ({ owner: loaders, components: previous.owner === loaders ? previous.components : {}, failure: { view: selected, attempt } }));
      }
    })();
    return () => { active = false; };
  }, [selected, component, loaders, attempt]);

  const retry = useCallback(() => setAttempt(value => value + 1), []);
  return { components, preparing: Boolean(selected && !component && !error), error, retry };
}
