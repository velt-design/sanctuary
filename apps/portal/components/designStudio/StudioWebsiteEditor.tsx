"use client";
import {StudioDocumentContext} from './StudioDocumentContext';
import {useContext} from 'react';
import type { StudioDesignIdentity } from "@/lib/designStudio/studioDesignIdentity";
import type { StudioEditingSessionProps } from "./useStudioEditingSession";
import { useStudioEditingSession } from "./useStudioEditingSession";
import StudioHouseWorkspace from "./StudioHouseWorkspace";
import StudioWebsiteSavedView from "./StudioWebsiteSavedView";
import Link from "next/link";
import StudioDesignHeading from "./StudioDesignHeading";
import StudioWebsiteRecovery from "./StudioWebsiteRecovery";
import css from "./StudioWebsite.module.css";
import type {StudioOpeningPrice} from '@/lib/designStudio/studioOpening';

/** One unconditional durable session. Saved-data viewing is mounted only while
 * no edit exists; obsolete authoring hooks never precede the live Workspace. */
export default function StudioWebsiteEditor(
  props: StudioEditingSessionProps & {
    versionLabel: string;
    identity?: StudioDesignIdentity;
    openingPrice?:StudioOpeningPrice;
  },
) {
  const prefetch=useContext(StudioDocumentContext)?false:undefined;
  const { scope, view, updatedAt, editable, versionLabel, identity, openingPrice } = props;
  const controller = useStudioEditingSession({
    scope,
    view,
    updatedAt,
    editable,
  });
  // Restoration owns which snapshot can open. Building a temporary saved scene
  // here starts a second renderer and solves geometry that is immediately retired.
  if (!controller.edit && controller.status === "loading")
    return (
      <main className={`${css.page} ${css.editorPage} ${css.cadEditor}`} aria-busy="true">
        <header className={css.header}>
          <div>
            <Link prefetch={prefetch} className={css.back} href={`/staff/projects/${scope.projectId}?tab=estimates`}>Sanctuary</Link>
            <StudioDesignHeading identity={identity} versionLabel={versionLabel} />
          </div>
          <div className={css.actions}>
            <button disabled>Save design</button>
            <Link prefetch={prefetch} href={`/staff/design-studio/${scope.projectId}/${scope.estimateId}`}>Review &amp; quote →</Link>
          </div>
        </header>
        <StudioWebsiteRecovery controller={controller} />
        <div className={css.workspace}>
          <section className={css.visual} aria-label="Whole design model" />
          <fieldset className={css.controls} disabled>
            <p className={css.inspectorBody} role="status">Opening your saved choices…</p>
          </fieldset>
        </div>
      </main>
    );
  return controller.edit ? (
    <StudioHouseWorkspace
      controller={controller}
      scope={scope}
      versionLabel={versionLabel}
      identity={identity}
      openingPrice={openingPrice}
    />
  ) : (
    <StudioWebsiteSavedView
      controller={controller}
      scope={scope}
      view={view}
      versionLabel={versionLabel}
      identity={identity}
    />
  );
}
