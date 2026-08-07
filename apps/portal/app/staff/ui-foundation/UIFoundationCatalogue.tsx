'use client';

import { useState } from 'react';
import type { PipelineStageKey } from '@/lib/projects/pipelineDefinition';
import { FoundationComponentsSection } from './FoundationComponentsSection';
import { FoundationPatternsSection } from './FoundationPatternsSection';
import { FoundationTokensSection } from './FoundationTokensSection';
import { PageLayout } from '@/components/ui/foundation';
import styles from './ui-foundation.module.css';

export default function UIFoundationCatalogue() {
  const [currentStage, setCurrentStage] = useState<PipelineStageKey>('quoting');
  const [page, setPage] = useState(1);

  return (
    <PageLayout
      width="full"
      className={styles.page}
      data-ui-foundation="true"
      data-portal-page-shell="ui-foundation"
      data-portal-page-shell-ready="true"
    >
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
    </PageLayout>
  );
}
