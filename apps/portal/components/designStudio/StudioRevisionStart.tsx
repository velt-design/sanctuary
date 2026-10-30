'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/foundation';
import { COMMERCIAL_INTERNAL_NAME_MAX_LENGTH, validateCommercialInternalName } from '@/lib/commercial/internalName';
import StudioCreateAction from './StudioCreateAction';

export default function StudioRevisionStart({ actorId, projectId, estimateId, revision, updatedAt, duplicateName, mode = 'clone', openOnCreated=false }: {
  actorId: string; projectId: string; estimateId: string; revision: number; updatedAt: string; duplicateName?: string; mode?: 'clone' | 'import'; openOnCreated?:boolean;
}) {
  const [name, setName] = useState(duplicateName ?? '');
  const validated = validateCommercialInternalName(name);
  return <>
    {!openOnCreated&&<p>{mode === 'import' ? 'Import these saved selections into a new unpriced design. The original estimate and its quotes stay unchanged.' : duplicateName === undefined ? 'Create a new revision to make changes.' : 'Create a separate copy of this saved design.'}</p>}
    {duplicateName !== undefined && <div style={{ marginBottom: 24 }}><Input label="Internal name (optional)" value={name} maxLength={COMMERCIAL_INTERNAL_NAME_MAX_LENGTH} onChange={event => setName(event.target.value)} /></div>}
    {!validated.ok ? <p role="alert">{validated.error}</p> : <StudioCreateAction openOnCreated={openOnCreated} scope={{ actorId, projectId }} intent={{ ...(mode === 'import' ? { mode, expectedRevision: 0 } as const : { mode, expectedRevision: revision }), sourceEstimateId: estimateId, expectedUpdatedAt: updatedAt, ...(duplicateName !== undefined ? { internalName: validated.value } : {}) }} />}
  </>;
}
