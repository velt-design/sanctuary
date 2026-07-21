'use client';

import { useState } from 'react';
import {
  Archive,
  Copy,
  Download,
  FileX2,
  Filter,
  History,
  Inbox,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  Button,
  AlertBanner,
  ActivityTimeline,
  ActivityTimelineItem,
  ActionPanel,
  Badge,
  CalculatorNotice,
  Card,
  DataStatePanel,
  DestructiveConfirmation,
  EmptyState,
  FinancialSummary,
  IconButton,
  Input,
  KeyValueGrid,
  LoadingSkeleton,
  MetricGrid,
  OperationalGrid,
  OverflowMenu,
  Pagination,
  PermissionBlockedControl,
  SearchFilterBar,
  SelectionTable,
  StickyActionBar,
  TabNavigation,
  TaskList,
  TaskRow,
  TaskScheduleFeedback,
  useUnsavedChangesGuard,
} from '@/components/ui/foundation';
import { Drawer } from '@/components/ui/drawer/Drawer';
import styles from './ui-foundation.module.css';

const interactionStates = [
  ['Default', 'default'],
  ['Hover', 'hover'],
  ['Pressed', 'pressed'],
  ['Focus visible', 'focus-visible'],
] as const;

export function FoundationPatternsSection({
  page,
  onPageChange,
}: {
  page: number;
  onPageChange: (page: number) => void;
}) {
  const [catalogueQuery, setCatalogueQuery] = useState('Remuera');
  const [catalogueStage, setCatalogueStage] = useState('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [confirmPending, setConfirmPending] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [operationalTab, setOperationalTab] = useState<'overview' | 'commercial' | 'activity'>('overview');
  const guardDrawerClose = useUnsavedChangesGuard(drawerOpen);

  const runDeleteDemo = () => {
    setConfirmPending(true);
    window.setTimeout(() => {
      setConfirmPending(false);
      setConfirmOpen(false);
      setConfirmText('');
    }, 500);
  };

  return (
    <section className={styles.patterns} aria-label="Interaction and responsive patterns">
      <article className={styles.patternPanel}>
        <div className={styles.sectionTitle}><h2>4. Interaction state reference</h2><small>Authoritative visual states</small></div>
        <div className={styles.interactionTable}>
          <div className={styles.interactionHeader}><span />{interactionStates.map(([label]) => <strong key={label}>{label}</strong>)}<strong>Loading</strong><strong>Disabled</strong></div>
          <div><strong>Primary button</strong>{interactionStates.map(([label, state]) => <Button key={label} data-visual-state={state}>Create quote</Button>)}<Button loading>Creating</Button><Button disabled>Create quote</Button></div>
          <div><strong>Text input</strong>{interactionStates.map(([label, state]) => <Input key={label} aria-label={`${label} input`} placeholder="Enter text…" data-visual-state={state} />)}<Input aria-label="Loading input" placeholder="Loading…" disabled /><Input aria-label="Disabled input" placeholder="Disabled" disabled /></div>
          <div><strong>Navigation item</strong>{interactionStates.map(([label, state]) => <Button key={label} variant="secondary" data-visual-state={state} leadingIcon={<Inbox />}>Projects</Button>)}<Button variant="secondary" loading>Projects</Button><Button variant="secondary" disabled>Projects</Button></div>
        </div>
      </article>

      <div className={styles.midPatternGrid}>
        <article className={styles.patternPanel}>
          <div className={styles.sectionTitle}><h2>5. Pagination</h2><small>1–25 of 142 projects</small></div>
          <Pagination currentPage={page} totalPages={6} onPageChange={onPageChange} itemSummary="1–25 of 142 projects" />
        </article>
        <article className={styles.patternPanel}>
          <div className={styles.sectionTitle}><h2>6. Overflow action menu</h2><small>Keyboard and pointer</small></div>
          <div className={styles.overflowExample}>
            <span>Project actions</span>
            <OverflowMenu
              menuLabel="Project actions"
              items={[
                { label: 'View history', icon: <History /> },
                { label: 'Duplicate', icon: <Copy /> },
                { label: 'Download PDF', icon: <Download /> },
                { label: 'Archive', icon: <Archive />, separatorBefore: true },
                { label: 'Delete', icon: <Trash2 />, destructive: true },
              ]}
            />
          </div>
        </article>
      </div>

      <article className={styles.patternPanel}>
        <div className={styles.sectionTitle}><h2>7. Sticky action bar pattern</h2><small>Desktop and mobile safe areas</small></div>
        <div className={styles.stickyDemo}>
          <StickyActionBar status="Unsaved changes" meta="Last saved 10:42 am" issues="2 issues · Margin below target">
            <Button variant="tertiary">Cancel</Button>
            <Button variant="secondary">Save draft</Button>
            <Button>Create quote</Button>
          </StickyActionBar>
        </div>
      </article>

      <div className={styles.lowerPatternGrid}>
        <article className={styles.patternPanel}>
          <div className={styles.sectionTitle}><h2>8. Empty states</h2><small>True and filtered</small></div>
          <div className={styles.emptyGrid}>
            <EmptyState compact title="No projects yet" description="Create your first project to get started." icon={<Inbox />} action={<Button leadingIcon={<Plus />}>New project</Button>} />
            <EmptyState compact title="No projects match" description="Try adjusting or clearing your filters." icon={<Filter />} action={<Button variant="tertiary">Clear filters</Button>} />
            <EmptyState compact title="Document unavailable" description="The file may have been archived." icon={<FileX2 />} />
          </div>
        </article>

        <article className={styles.patternPanel}>
          <div className={styles.sectionTitle}><h2>9. Loading skeleton</h2><small>Layout-preserving feedback</small></div>
          <LoadingSkeleton rows={5} columns={4} />
        </article>
      </div>

      <div className={styles.bottomPatternGrid}>
        <article className={styles.patternPanel}>
          <div className={styles.sectionTitle}><h2>10. Focus on inverse surfaces</h2><small>Visible in every context</small></div>
          <div className={styles.inverseFocus}>
            <Button variant="secondary" data-visual-state="focus-visible">View project</Button>
            <Button data-visual-state="focus-visible" leadingIcon={<Inbox />}>Projects</Button>
            <IconButton aria-label="Search" variant="inverse" data-visual-state="focus-visible"><Search /></IconButton>
          </div>
        </article>

        <article className={styles.patternPanel}>
          <div className={styles.sectionTitle}><h2>11. Density modes</h2><small>Same primitives, scoped tokens</small></div>
          <div className={styles.densityGrid}>
            <div data-ui-density="standard"><strong>Standard</strong><Input aria-label="Standard density input" placeholder="Project name" /><Button>Save project</Button></div>
            <div data-ui-density="compact"><strong>Compact</strong><Input aria-label="Compact density input" placeholder="Project name" /><Button>Save project</Button></div>
          </div>
        </article>
      </div>

      <article className={styles.patternPanel}>
        <div className={styles.sectionTitle}><h2>12. Responsive shells</h2><small>Expanded · collapsed · mobile</small></div>
        <AlertBanner tone="info" title="This page is the live shell specimen">
          Use the desktop collapse control or resize below 900 px to exercise the 56 px mobile bar and focus-managed navigation drawer.
        </AlertBanner>
      </article>

      <article className={styles.patternPanel}>
        <div className={styles.sectionTitle}><h2>13. Search, filters and selection</h2><small>Operational list patterns</small></div>
        <SearchFilterBar
          query={catalogueQuery}
          onQueryChange={setCatalogueQuery}
          queryPlaceholder="Project, client or address"
          filters={[{ id: 'stage', label: 'Stage', value: catalogueStage, onChange: setCatalogueStage, options: [{ value: 'all', label: 'All stages' }, { value: 'quoting', label: 'Quoting' }, { value: 'sent', label: 'Sent' }] }]}
          onClearAll={() => { setCatalogueQuery(''); setCatalogueStage('all'); }}
        />
        <SelectionTable
          columns={['Project', 'Client', 'Stage']}
          rows={[
            { id: 'p-2307', label: 'Remuera Residence', cells: ['Remuera Residence', 'James & Anna Wilson', 'Quoting'], expandedContent: 'Next action: Follow up on revised roof layout.', actions: [{ label: 'Open project' }, { label: 'Archive', separatorBefore: true }] },
            { id: 'p-2311', label: 'Takapuna Residence', cells: ['Takapuna Residence', 'Daniel Lee', 'Deposit'], expandedContent: 'Deposit invoice sent 22 May.', actions: [{ label: 'Open project' }] },
          ]}
        />
      </article>

      <article className={styles.patternPanel}>
        <div className={styles.sectionTitle}><h2>14. Data, alert and permission states</h2><small>Truthful operational feedback</small></div>
        <div className={styles.productionGrid}>
          <AlertBanner tone="info" title="Saved locally">Changes will sync when the connection returns.</AlertBanner>
          <AlertBanner tone="warning" title="Margin below target">Review material or labour assumptions.</AlertBanner>
          <AlertBanner tone="error" title="Refresh failed" action={<Button variant="secondary">Retry</Button>}>Showing the last saved project data.</AlertBanner>
          <AlertBanner tone="blocking" title="Approval required">A manager must approve this exception.</AlertBanner>
          <DataStatePanel state="filtered-empty" onClear={() => { setCatalogueQuery(''); setCatalogueStage('all'); }} />
          <DataStatePanel state="stale" onRetry={() => undefined} />
          <DataStatePanel state="conflict" />
          <PermissionBlockedControl label="Approve quote" reason="Admin permission required" />
        </div>
      </article>

      <article className={styles.patternPanel}>
        <div className={styles.sectionTitle}><h2>15. Calculator, finance, tasks and schedule</h2><small>NZ operational conventions</small></div>
        <div className={styles.productionGrid}>
          <CalculatorNotice tone="information" title="Pricing guidance">Rates include New Zealand GST assumptions where configured.</CalculatorNotice>
          <CalculatorNotice tone="warning" title="Low margin">Gross margin is below the target range.</CalculatorNotice>
          <CalculatorNotice tone="blocking" title="Missing roof dimensions">Add length and projection before generating a quote.</CalculatorNotice>
          <FinancialSummary revenue={78940} cost={45200} />
          <div className={styles.feedbackRow}>
            <TaskScheduleFeedback state="saving">Saving task locally…</TaskScheduleFeedback>
            <TaskScheduleFeedback state="saved">Task saved · sync complete</TaskScheduleFeedback>
            <TaskScheduleFeedback state="blocked">Schedule conflict · choose another crew</TaskScheduleFeedback>
            <TaskScheduleFeedback state="retry">Sync failed · retry available</TaskScheduleFeedback>
          </div>
        </div>
      </article>

      <article className={styles.patternPanel}>
        <div className={styles.sectionTitle}><h2>16. Detail-page operations</h2><small>Shared tabs, facts, metrics, activity and tasks</small></div>
        <TabNavigation
          ariaLabel="Detail-page pattern tabs"
          items={[
            { key: 'overview', label: 'Overview' },
            { key: 'commercial', label: 'Commercial' },
            { key: 'activity', label: 'Activity' },
          ]}
          selectedKey={operationalTab}
          onSelect={setOperationalTab}
        />
        <OperationalGrid>
          <Card title="Status & details" eyebrow="Project overview" padding="none">
            <KeyValueGrid
              ariaLabel="Example project details"
              items={[
                { label: 'Contact', value: 'James Wilson' },
                { label: 'Owner', value: 'Jordan' },
                { label: 'Site', value: 'Remuera, Auckland', wide: true },
              ]}
            />
          </Card>
          <Card title="Commercial summary" eyebrow="Current design" padding="compact">
            <MetricGrid
              ariaLabel="Example commercial summary"
              columns={2}
              items={[
                { label: 'Customer price', value: '$78,940', detail: 'inc GST', emphasis: true },
                { label: 'Quote', value: 'Q-2311 v2', detail: 'Sent to customer' },
              ]}
            />
          </Card>
          <ActionPanel title="Confirm site visit" eyebrow="Primary next action" tone="inverse" status={<Badge tone="warning">Due today</Badge>}>
            <KeyValueGrid columns={2} items={[{ label: 'Owner', value: 'Jordan' }, { label: 'Category', value: 'Site visit' }]} />
            <Button>Complete action</Button>
          </ActionPanel>
          <Card title="Activity" padding="none">
            <ActivityTimeline>
              <ActivityTimelineItem marker={<Badge tone="info">Project note</Badge>} meta="Today, 10:42 am" footer="Added by Jordan">
                Client confirmed the revised roof layout.
              </ActivityTimelineItem>
            </ActivityTimeline>
          </Card>
          <Card title="Tasks" padding="none">
            <TaskList>
              <TaskRow checked={false} label="Confirm site visit" description="Due tomorrow" status={<Badge tone="warning">To do</Badge>} />
              <TaskRow checked label="Send concept" status={<Badge tone="success">Done</Badge>} />
            </TaskList>
          </Card>
        </OperationalGrid>
      </article>

      <article className={styles.patternPanel}>
        <div className={styles.sectionTitle}><h2>17. Modal, drawer and destructive work</h2><small>Focus trap, return and safe cancellation</small></div>
        <div className={styles.overlayActions}>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>Open destructive confirmation</Button>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>Open editable drawer</Button>
        </div>
        <DestructiveConfirmation
          open={confirmOpen}
          title="Delete project?"
          description="The server must confirm deletion before the dialog closes."
          confirmationText="DELETE"
          value={confirmText}
          onValueChange={setConfirmText}
          pending={confirmPending}
          onCancel={() => { if (!confirmPending) { setConfirmOpen(false); setConfirmText(''); } }}
          onConfirm={runDeleteDemo}
          consequences="Project records, estimates and linked activity will be permanently removed."
        />
        <Drawer open={drawerOpen} onClose={() => guardDrawerClose(() => setDrawerOpen(false))} title="Edit project">
          <div className={styles.drawerDemo}>
            <AlertBanner tone="warning" title="Unsaved changes">Save or discard changes before navigating away.</AlertBanner>
            <Input label="Project name" defaultValue="Remuera Residence" />
            <Input label="Site address" defaultValue="Remuera, Auckland" readOnly helperText="Read-only from the client record" />
            <div className={styles.overlayActions}><Button variant="tertiary" onClick={() => guardDrawerClose(() => setDrawerOpen(false))}>Discard</Button><Button onClick={() => setDrawerOpen(false)}>Save changes</Button></div>
          </div>
        </Drawer>
      </article>
    </section>
  );
}
