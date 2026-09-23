'use client';

import { useState, type CSSProperties } from 'react';
import { Bookmark, CircleHelp, SlidersHorizontal, X, ArrowUpRight } from 'lucide-react';
import { Button, Card, DataStatePanel, MetricGrid, Select, Table } from '@/components/ui/foundation';
import { Drawer } from '@/components/ui/drawer/Drawer';
import { initialFilters, readSavedExample, selectExample, sources, type ExampleFilters, type ExampleRecord, type ExampleState } from './clarityExample';
import styles from './FoundationClarityExample.module.css';

const storageKey = 'sanctuary:foundation:example-view:v1';
type Panel = 'filters' | 'saved' | 'help' | 'record' | null;

export function FoundationClarityExample() {
  const [filters, setFilters] = useState<ExampleFilters>(initialFilters);
  const [draft, setDraft] = useState<ExampleFilters>(initialFilters);
  const [state, setState] = useState<ExampleState>('ready');
  const [panel, setPanel] = useState<Panel>(null);
  const [record, setRecord] = useState<ExampleRecord | null>(null);
  const [saved, setSaved] = useState<ExampleFilters | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const data = selectExample(filters, state);
  const available = state === 'ready' || state === 'empty';
  const display = (value: number) => available ? value : state === 'loading' ? 'Loading' : 'Unavailable';
  const max = Math.max(1, ...data.sources.map(source => source.count));
  const openSaved = () => {
    try { setSaved(readSavedExample(localStorage.getItem(storageKey))); setSaveMessage(''); }
    catch { setSaved(null); setSaveMessage('Saved views are unavailable in this browser. Your current filters still work.'); }
    setPanel('saved');
  };
  const save = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(filters)); setSaved(filters); setSaveMessage('View saved on this browser.'); }
    catch { setSaveMessage('Could not save this view. Your current filters are unchanged.'); }
  };

  return <section className={styles.example} aria-label="Clear page example">
    <div className={styles.intro}><div><h2>See the pattern in action</h2><p>Filter a source. Inspect its records. Keep your place.</p></div><span className={styles.demo}>Fictional example</span></div>
    <Card title="Enquiry overview" action={<Button variant="quiet" onClick={() => setPanel('help')} leadingIcon={<CircleHelp />}>Pattern guide</Button>}>
      <div className={styles.toolbar}>
        <Select aria-label="Example date range" value={filters.days} onChange={event => setFilters({ ...filters, days: event.target.value as ExampleFilters['days'] })}>
          <option value="7">Last 7 days</option><option value="30">Last 30 days</option>
        </Select>
        <div className={styles.actions}>
          <Button variant="secondary" leadingIcon={<SlidersHorizontal />} onClick={() => { setDraft(filters); setPanel('filters'); }}>Filters</Button>
          <Button variant="quiet" leadingIcon={<Bookmark />} onClick={openSaved}>Saved view</Button>
        </div>
      </div>
      <div className={styles.chips} aria-label="Example applied filters">{filters.source
        ? <Button variant="quiet" aria-label="Remove example source filter" onClick={() => setFilters({ ...filters, source: '' })}>Source: {filters.source}<X size={14} aria-hidden="true" /></Button>
        : <span>All sources</span>}</div>
      <MetricGrid columns={3} ariaLabel="Example enquiry summary" items={[
        { label: 'Enquiries', value: display(data.rows.length), detail: 'Selected period and source' },
        { label: 'Linked projects', value: display(data.linked), detail: 'Unique fictional projects' },
        { label: 'Source known', value: available ? `${data.known} / ${data.rows.length}` : state === 'loading' ? 'Loading' : 'Unavailable', detail: 'Unknown stays visible' },
      ]} />
      <div className={styles.content} aria-busy={state === 'loading'}>
        <section aria-labelledby="example-source-title" className={styles.chart}>
          <h3 id="example-source-title">Where enquiries start</h3><p className={styles.caption}>All sources in the selected period</p>
          <div className={styles.plot}>
            {available ? data.sources.map(({ source, count }) => <button type="button" key={source} className={styles.barRow}
              aria-label={`${source}: ${count} enquiries`} aria-pressed={filters.source === source}
              onClick={() => setFilters({ ...filters, source: filters.source === source ? '' : source })}>
              <span>{source}</span><span className={styles.track}><span style={{ '--bar-size': `${count / max * 100}%` } as CSSProperties} /></span><strong>{count}</strong>
            </button>) : <DataStatePanel state={state === 'loading' ? 'stale' : 'unavailable'} title={state === 'loading' ? 'Loading enquiries' : 'Enquiries unavailable'}
              description={state === 'loading' ? 'This example holds the layout while a read is pending.' : 'A failed read is not zero enquiries.'}
              onRetry={state === 'unavailable' ? () => setState('ready') : undefined} />}
          </div>
          <p className={styles.caption}>Select a source to inspect its records.</p>
        </section>
        <section className={styles.records} aria-labelledby="example-record-title">
          <div className={styles.recordHeader}><h3 id="example-record-title">Supporting records</h3><span role="status">{available ? `${data.rows.length} enquiries` : state === 'loading' ? 'Loading' : 'Unavailable'}</span></div>
          <div className={styles.recordScroll}>
            {available && data.rows.length > 0 ? <Table aria-label="Example supporting enquiries"><thead><tr><th scope="col">Enquiry</th><th scope="col">Source</th></tr></thead><tbody>
              {data.rows.map(row => <tr key={row.id}><td><Button variant="quiet" onClick={() => { setRecord(row); setPanel('record'); }}>{row.name}<ArrowUpRight size={14} aria-hidden="true" /></Button></td><td>{row.source}</td></tr>)}
            </tbody></Table> : <p className={styles.empty}>{available ? 'No enquiries in this example period.' : 'Records appear here when available.'}</p>}
          </div>
        </section>
      </div>
      <div className={styles.exampleControls}><span>Example states</span><Select aria-label="Example data state" value={state} onChange={event => setState(event.target.value as ExampleState)}>
        <option value="ready">Available</option><option value="loading">Loading</option><option value="empty">Empty</option><option value="unavailable">Unavailable</option>
      </Select></div>
    </Card>
    <Drawer open={panel !== null} onClose={() => setPanel(null)} title={panel === 'filters' ? 'Example filters' : panel === 'saved' ? 'Saved example view' : panel === 'record' ? record?.name ?? 'Example enquiry' : 'Pattern guide'}>
      <div className={styles.drawer}>
        {panel === 'filters' && <form onSubmit={event => { event.preventDefault(); setFilters(draft); setPanel(null); }}>
          <Select label="Observed source" value={draft.source} onChange={event => setDraft({ ...draft, source: event.target.value as ExampleFilters['source'] })}>
            <option value="">All sources</option>{sources.map(source => <option key={source}>{source}</option>)}
          </Select><div className={styles.drawerActions}><Button type="submit">Apply filters</Button><Button variant="secondary" onClick={() => setPanel(null)}>Cancel</Button></div>
        </form>}
        {panel === 'saved' && <><p>Save these filters on this browser. No record data is stored.</p><Button onClick={save}>Save current view</Button>
          {saved && <Button variant="secondary" onClick={() => { setFilters(saved); setPanel(null); }}>Restore saved view: {saved.days} days, {saved.source || 'all sources'}</Button>}
          <p role="status">{saveMessage}</p></>}
        {panel === 'record' && record && <><span className={styles.demo}>Fictional record</span><dl className={styles.facts}><dt>Reference</dt><dd>{record.id}</dd><dt>Received</dt><dd>{record.daysAgo === 0 ? 'Today' : `${record.daysAgo} days ago`}</dd><dt>Observed source</dt><dd>{record.source}</dd><dt>Project link</dt><dd>{record.linked ? 'One fictional linked project' : 'No linked project'}</dd></dl><p>This example reads no business records and sends no messages.</p><Button variant="secondary" onClick={() => setPanel(null)}>Back to records</Button></>}
        {panel === 'help' && <><h3>Clarity before decoration</h3><p>Lead with the decision, then reveal the evidence that supports it. A chart is useful when it makes a pattern easier to see.</p>
          <h3>Compact controls</h3><p>Keep frequent choices visible. Draft less-used filters in a drawer; Cancel leaves the applied view unchanged.</p>
          <h3>Numbers you can check</h3><p>The summary uses the selected period and source. Bars compare all sources in that period. Each enquiry has at most one distinct fictional project; source coverage is known sources divided by enquiries. Unknown is never assumed to be direct traffic.</p>
          <h3>Detail in context</h3><p>Inspect a record and return without losing filters or reading position. Keep blocking errors, required instructions and consequential actions visible where they matter.</p>
          <h3>Honest recovery</h3><p>Unavailable does not mean zero. Controls stay in place; Retry restores the example without discarding your selection. Saved views contain only preferences.</p>
          <h3>Existing owners</h3><p>Composes Portal Card, Select, Button, MetricGrid, Table and Drawer. These three categories use labelled button bars so pointer and keyboard users have the same action. No chart library or new visual tokens are needed.</p></>}
      </div>
    </Drawer>
  </section>;
}
