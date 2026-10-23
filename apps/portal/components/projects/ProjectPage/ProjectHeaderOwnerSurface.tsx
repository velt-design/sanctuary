import styles from './ProjectPage.module.css';

export default function ProjectHeaderOwnerSurface({ pending = true, displayName, ownerKey = 'unknown' }: { pending?: boolean; displayName?: string; ownerKey?: string }) {
  return <span className={styles.mastheadOwner} data-project-owner={ownerKey}><strong>Owner</strong>
    <span>{displayName ?? (pending ? 'Reading owner' : 'Owner unavailable')}</span></span>;
}
