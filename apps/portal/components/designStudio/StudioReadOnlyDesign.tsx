'use client';
import { useContext, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { createStudioAuthoringEdit, type StudioAuthoringView } from '@/lib/designStudio/authoringView';
import type { StudioSaveScope } from '@/lib/designStudio/saveTransport';
import type { StudioDesignIdentity } from '@/lib/designStudio/studioDesignIdentity';
import { StudioDocumentContext } from './StudioDocumentContext';
import { loadStudioHouseCanvasModule } from './studioLeafLoading';
import { useStudioResolvedScene } from './useStudioResolvedScene';
import type { StudioSceneView } from './studioHouseContext';
import StudioDesignSelector from './StudioDesignSelector';
import StudioDesignHeading from './StudioDesignHeading';
import StudioDesignSpecification from './StudioDesignSpecification';
import StudioRevisionStart from './StudioRevisionStart';
import css from './StudioWebsite.module.css';
import viewCss from './StudioReadOnlyDesign.module.css';

const Canvas = dynamic(loadStudioHouseCanvasModule, { ssr:false });

/** Exact freshly admitted saved source. Only camera/inspection state is local:
 * no editing session, retained working copy, journal replay, pricing or gestures. */
export default function StudioReadOnlyDesign({scope, view, updatedAt, versionLabel, identity}: {
  scope: StudioSaveScope; view: StudioAuthoringView; updatedAt: string | null;
  versionLabel: string; identity?: StudioDesignIdentity;
}) {
  const prefetch = useContext(StudioDocumentContext) ? false : undefined;
  const edit = useMemo(() => createStudioAuthoringEdit(view), [view]);
  const scopeKey = JSON.stringify([scope, view.designId, view.revision, updatedAt]);
  const resolved = useStudioResolvedScene(edit, scopeKey)!;
  const objects = [...resolved.houseRecords.map(h => ({id:h.id,label:h.label})), ...resolved.rows.map(p => ({id:p.object.id,label:p.object.label}))];
  const [selectedId, select] = useState(''), [sceneView, setView] = useState<StudioSceneView>('3D');
  const selected = objects.some(o => o.id === selectedId) ? selectedId : resolved.rows[0]?.object.id ?? objects[0]?.id ?? '';
  return <main className={`${css.page} ${css.editorPage} ${css.cadEditor} ${viewCss.page}`} data-studio-read-only>
    <header className={css.header}>
      <div>
        <Link prefetch={prefetch} className={css.back} href={`/staff/projects/${scope.projectId}?tab=estimates`}>Sanctuary</Link>
        <StudioDesignSelector projectId={scope.projectId} estimateId={scope.estimateId} renameAllowed={false}>
          <StudioDesignHeading identity={identity} versionLabel={versionLabel} state={identity?.history === 'archived' ? 'Archived · read only' : 'Quoted · read only'} />
        </StudioDesignSelector>
      </div>
      <div className={css.actions}>
        <Link prefetch={prefetch} href={`/staff/design-studio/${scope.projectId}/${scope.estimateId}`}>Review &amp; quote</Link>
        {updatedAt ? <StudioRevisionStart key={scopeKey} actorId={scope.actorId} projectId={scope.projectId} estimateId={scope.estimateId} revision={view.revision} updatedAt={updatedAt} openOnCreated />
          : <span role="status">Reopen the saved design before starting a revision.</span>}
      </div>
    </header>
    <div className={css.workspace}>
      <section className={css.visual} aria-label="Whole design model">
        <nav className={css.objectNavigator} aria-label="Design objects">
          {objects.map(object => <button key={object.id} type="button" aria-pressed={selected===object.id} onClick={() => select(object.id)}>{object.label}</button>)}
        </nav>
        <Canvas key={scopeKey} edit={edit} resolvedScene={resolved} selected={selected} onSelect={select}
          cad refinedHouse persistentViewport readOnly movementLocked showMeasurements={false}
          cameraStorageKey={`${scopeKey}:read-only-camera`} view={sceneView} onView={setView} />
      </section>
      <aside className={`${css.controls} ${viewCss.choices}`} aria-label="Read-only design choices">
        <StudioDesignSpecification edit={edit} />
      </aside>
    </div>
  </main>;
}
