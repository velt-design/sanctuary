import { ArrowRight, Share2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Button, ProjectStageTracker } from '@/components/ui/foundation';
import type { PipelineStageKey } from '@/lib/projects/pipelineDefinition';
import styles from './ui-foundation.module.css';

const colourGroups = [
  {
    title: 'Surfaces',
    items: [
      ['Canvas', '--ui-canvas'],
      ['Primary', '--ui-surface-primary'],
      ['Secondary', '--ui-surface-secondary'],
      ['Elevated', '--ui-surface-elevated'],
      ['Sunken', '--ui-surface-sunken'],
      ['Inverse', '--ui-surface-inverse'],
    ],
  },
  {
    title: 'Text',
    items: [
      ['Strong', '--ui-text-strong'],
      ['Default', '--ui-text'],
      ['Muted', '--ui-text-muted'],
      ['Subtle', '--ui-text-subtle'],
      ['Inverse', '--ui-text-inverse'],
    ],
  },
  {
    title: 'Action',
    items: [
      ['Primary', '--ui-action'],
      ['Hover', '--ui-action-hover'],
      ['Pressed', '--ui-action-pressed'],
      ['Accent text', '--ui-action-text'],
    ],
  },
] as const;

const typeRows = [
  ['Dashboard display', 'Barlow Condensed / 700', '64–80px', 'Dashboard only'],
  ['Operational page', 'Barlow Condensed / 600', '34–36px', 'Index and list pages'],
  ['Detail page', 'Barlow Condensed / 600', '26–28px', 'Project and record detail'],
  ['Section heading', 'Barlow Condensed / 600', '20–24px', 'Page sections'],
  ['Card heading', 'Inter / 600', '13–16px', 'Cards and panels'],
  ['Body', 'Inter / 400', '15px / 24px', 'Operational copy'],
  ['Small body / table', 'Inter / 400', '13px / 20px', 'Tables and metadata'],
  ['Label / button', 'Inter / 600', '12px / 16px', 'Controls and labels'],
] as const;

export function FoundationTokensSection({
  currentStage,
  onStageChange,
}: {
  currentStage: PipelineStageKey;
  onStageChange: (stage: PipelineStageKey) => void;
}) {
  return (
    <>
      <section className={styles.hero} aria-labelledby="foundation-title">
        <div className={styles.heroBrand}>
          <p>Sanctuary<br />Staff Portal</p>
          <h1 id="foundation-title">UI Foundation</h1>
          <span>High-contrast. Architectural.<br />Built for Sanctuary Pergolas staff.</span>
          <div className={styles.heroMeta}><i aria-hidden="true" /> Version 1.0 <b /> 21 July 2026</div>
        </div>
        <div className={styles.headerBoard}>
          <div className={styles.sectionTitle}><h2>Page header patterns</h2><small>Approved hierarchy</small></div>
          <div className={styles.headerGrid}>
            <article>
              <span className={styles.patternLabel}>A. Dashboard header</span>
              <PageHeader
                variant="dashboard"
                headingLevel={3}
                title="Dashboard"
                description="Design bold. Build better."
                meta={<span>Friday<br /><strong>24 May 2024</strong></span>}
              />
            </article>
            <article>
              <span className={styles.patternLabel}>B. Projects index header</span>
              <PageHeader
                variant="index"
                headingLevel={3}
                title="Active projects"
                count="142 projects"
                breadcrumbs={[{ label: 'Projects' }, { label: 'All Projects' }]}
                description="Overview of all projects across the pipeline."
                primaryAction={{ label: '+ New project', href: '#components' }}
                back={{ label: 'Export', href: '#table-foundations' }}
              />
            </article>
            <article>
              <span className={styles.patternLabel}>C. Project detail header</span>
              <PageHeader
                variant="detail"
                headingLevel={3}
                title="Remuera Residence"
                breadcrumbs={[{ label: 'Projects', href: '/staff/projects' }, { label: 'P-2307' }]}
                description="P-2307 · James & Anna Wilson · Remuera, Auckland"
                right={
                  <div className={styles.headerActions}>
                    <Button variant="tertiary" leadingIcon={<Share2 aria-hidden="true" />}>Share</Button>
                    <Button variant="secondary">Edit project</Button>
                    <Button trailingIcon={<ArrowRight aria-hidden="true" />}>Create quote</Button>
                  </div>
                }
              />
              <div className={styles.projectFacts}>
                <span><small>Project value</small><strong>$78,940</strong></span>
                <span><small>Current stage</small><strong>Quoting</strong></span>
                <span><small>Project manager</small><strong>Alex Morgan</strong></span>
                <span><small>Installer</small><strong>Central Crew</strong></span>
              </div>
              <div className={styles.trackerScroll}>
                <ProjectStageTracker currentStage={currentStage} onStageChange={onStageChange} />
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.foundationGrid} aria-label="Design foundations">
        <article className={styles.catalogueSection}>
          <div className={styles.sectionTitle}><h2>1. Design tokens</h2><small>Semantic roles</small></div>
          {colourGroups.map((group) => (
            <div className={styles.tokenGroup} key={group.title}>
              <h3>{group.title}</h3>
              <div className={styles.swatchGrid}>
                {group.items.map(([label, variable]) => (
                  <div className={styles.swatch} key={variable}>
                    <span style={{ background: `var(${variable})` }} />
                    <strong>{label}</strong>
                    <code>{variable.replace('--ui-', '')}</code>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className={styles.semanticTokens}>
            {[
              ['Success', 'var(--ui-status-success-bg)', 'var(--ui-status-success-border)'],
              ['Warning', 'var(--ui-status-warning-bg)', 'var(--ui-status-warning-border)'],
              ['Error', 'var(--ui-status-error-bg)', 'var(--ui-status-error-border)'],
              ['Info', 'var(--ui-status-info-bg)', 'var(--ui-status-info-border)'],
              ['Neutral', 'var(--ui-status-neutral-bg)', 'var(--ui-status-neutral-border)'],
            ].map(([label, bg, border]) => <span key={label} style={{ background: bg, borderColor: border }}>{label}</span>)}
          </div>
        </article>

        <article className={styles.catalogueSection}>
          <div className={styles.sectionTitle}><h2>2. Typography scale</h2><small>Barlow Condensed + Inter</small></div>
          <div className={styles.typeTable}>
            {typeRows.map(([style, font, size, use]) => (
              <div key={style}>
                <strong>{style}</strong><span>{font}</span><span>{size}</span><span>{use}</span>
              </div>
            ))}
          </div>
          <div className={styles.metricExample}>
            <strong>42.7%</strong>
            <span>Primary numeric metric<br /><small>↑ 4.2% vs last month</small></span>
          </div>
        </article>
      </section>
    </>
  );
}
