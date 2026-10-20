import Link from 'next/link';
import type { loadStudioProject } from '@/lib/queries/studioProject.server';
import { studioDesignDate } from '@/lib/designStudio/studioDesignIdentity';
import css from './StudioReview.module.css';

export default function StudioSavedDesigns({projectId, designs}: {
  projectId: string; designs: NonNullable<Awaited<ReturnType<typeof loadStudioProject>>>['designs'];
}) {
  return <ul className={css.savedDesigns}>{designs.map(design => {
    const href = `/staff/design-studio/${projectId}/${design.id}`;
    const date = studioDesignDate(design.createdAt);
    return <li key={design.id}>
      <div><h3>{design.label}</h3><p>Design {design.versionLabel} · {design.history}{date && <> · Created {date}</>}{design.quoteLabel && <> · {design.quoteLabel}</>}</p></div>
      <div className={css.actions}>{design.canOpenEditor && <Link href={`${href}/edit`}>Open design</Link>}<Link href={href}>{design.canOpenEditor ? 'Review' : 'Review saved design'}</Link></div>
    </li>;
  })}</ul>;
}
