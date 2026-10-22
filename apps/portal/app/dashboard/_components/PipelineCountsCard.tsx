import type {ComponentProps} from 'react';
import type {PipelineCounts} from '@/lib/dashboard/types';
import {normalizePipelineStageKey,toCanonicalStageCounts} from '@/lib/projects/pipelineDefinition';
import {aggregateProjectStageCountsByJourney} from '@/lib/projects/projectJourney';
import PipelineCountsSurface from './PipelineCountsSurface';
export function preparePipelineCounts(counts:PipelineCounts){
  const normalized = toCanonicalStageCounts(counts);
  const journeyCounts = aggregateProjectStageCountsByJourney(normalized);
if (process.env.NODE_ENV !== 'production') {
    const unknown = Object.keys(counts ?? {}).filter((key) => !normalizePipelineStageKey(key));
    if (unknown.length) {
      console.warn('Unknown pipeline stage keys:', unknown);
    }
  }


 return journeyCounts;
}
export default function PipelineCountsCard({counts,...props}:Omit<ComponentProps<typeof PipelineCountsSurface>,'journeyCounts'>&{counts:PipelineCounts}){return <PipelineCountsSurface {...props} journeyCounts={preparePipelineCounts(counts)}/>;}
