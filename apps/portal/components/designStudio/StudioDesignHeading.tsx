import { studioDesignDate, type StudioDesignIdentity } from '@/lib/designStudio/studioDesignIdentity';

export default function StudioDesignHeading({ identity, versionLabel, state, onRename, renameDisabled }: {
  identity?: StudioDesignIdentity; versionLabel: string; state?: string; onRename?: () => void; renameDisabled?: boolean;
}) {
  const date = studioDesignDate(identity?.createdAt);
  return <>
    <h1 title={identity?.internalName || undefined}>{onRename ? <button type="button" onClick={onRename} disabled={renameDisabled} title={renameDisabled ? 'Save the current design before renaming' : 'Rename design'} aria-label={`Rename ${identity?.internalName || 'Studio design'}`} style={{font:'inherit',color:'inherit',padding:0,border:0,background:'transparent',textAlign:'left'}}>{identity?.internalName || 'Untitled Studio design'} <small aria-hidden="true" style={{fontSize:12,fontWeight:400}}>✎</small></button> : identity?.internalName || 'Untitled Studio design'}</h1>
    <p>{identity?.projectName || 'Project'} · Design {versionLabel} · {state || (identity?.history === 'quoted' ? 'Used by a quote' : identity?.history === 'archived' ? 'Archived design' : 'Saved design')}
      {identity?.quoteLabel && <> · {identity.quoteLabel}</>}{date && <span title="Design version created"> · {date}</span>}
    </p>
  </>;
}
