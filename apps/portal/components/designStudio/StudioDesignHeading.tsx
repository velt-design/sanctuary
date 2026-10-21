import { studioDesignDate, type StudioDesignIdentity } from '@/lib/designStudio/studioDesignIdentity';

export default function StudioDesignHeading({ identity, versionLabel, state }: {
  identity?: StudioDesignIdentity; versionLabel: string; state?: string;
}) {
  const date = studioDesignDate(identity?.createdAt);
  return <>
    <h1 title={identity?.internalName || undefined}>{identity?.internalName || 'Untitled Studio design'}</h1>
    <p>{identity?.projectName || 'Project'} · Design {versionLabel} · {state || (identity?.history === 'quoted' ? 'Used by a quote' : identity?.history === 'archived' ? 'Archived design' : 'Saved design')}
      {identity?.quoteLabel && <> · {identity.quoteLabel}</>}{date && <span title="Design version created"> · {date}</span>}
    </p>
  </>;
}
