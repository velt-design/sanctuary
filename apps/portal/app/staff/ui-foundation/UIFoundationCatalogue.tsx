'use client';

import { useState } from 'react';
import type { PipelineStageKey } from '@/lib/projects/pipelineDefinition';
import { FoundationComponentsSection } from './FoundationComponentsSection';
import { FoundationPatternsSection } from './FoundationPatternsSection';
import { FoundationTokensSection } from './FoundationTokensSection';
import { FoundationClarityExample } from './FoundationClarityExample';
import PageHeader from '@/components/layout/PageHeader';
import { PageLayout, TabNavigation } from '@/components/ui/foundation';
import styles from './ui-foundation.module.css';

export default function UIFoundationCatalogue() {
  const [currentStage, setCurrentStage] = useState<PipelineStageKey>('quoting');
  const [page, setPage] = useState(1);
  const [section, setSection] = useState<'patterns' | 'components'>('patterns');

  return (
    <PageLayout width="full" className={styles.page} data-ui-foundation="true">
      <PageHeader title="UI Foundation" variant="index" description="Clear priorities. Useful detail. Stable journeys." />
      <TabNavigation ariaLabel="Foundation sections" selectedKey={section} onSelect={setSection} items={[
        { key: 'patterns', label: 'Page patterns', controls: 'foundation-patterns' },
        { key: 'components', label: 'Components & tokens', controls: 'foundation-components' },
      ]} />
      <div id="foundation-patterns" role="tabpanel" aria-label="Page patterns" hidden={section !== 'patterns'}><FoundationClarityExample /></div>
      <div id="foundation-components" role="tabpanel" aria-label="Components & tokens" hidden={section !== 'components'}>
      <FoundationTokensSection currentStage={currentStage} onStageChange={setCurrentStage} />
      <FoundationComponentsSection currentStage={currentStage} />
      <FoundationPatternsSection page={page} onPageChange={setPage} />
      <footer className={styles.footer}>
        <span>Typography: Barlow Condensed + Inter</span>
        <span>Icons: Lucide outline</span>
        <span>Border: 1px default / 2px emphasis</span>
        <span>Radius: 0 / 2 / 4 / 999</span>
        <span>Spacing: 4px base</span>
      </footer>
      </div>
    </PageLayout>
  );
}
