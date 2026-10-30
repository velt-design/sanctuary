'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import StudioCreateAction from './StudioCreateAction';
import styles from './SavedStudioReview.module.css';
import { Input } from '@/components/ui/foundation';
import { COMMERCIAL_INTERNAL_NAME_MAX_LENGTH, validateCommercialInternalName } from '@/lib/commercial/internalName';

export default function StudioNewDesign({ projectId, initialScope = 'base', initialName = null, embedded = false }: { projectId: string; initialScope?: 'base' | 'add_on'; initialName?: string | null; embedded?: boolean }) {
  const auth = usePortalSession();
  const [scope, setScope] = useState<'base' | 'add_on'>(initialScope);
  const [name, setName] = useState(initialName ?? '');
  const validName = validateCommercialInternalName(name);
  const id = useId();
  return <section className={styles.review}>
    {!embedded&&<Link className={styles.back} href={`/staff/projects/${encodeURIComponent(projectId)}?tab=estimates`}>← Back to project</Link>}
    <header className={styles.header}>{embedded?<h2>New design</h2>:<h1>New design</h1>}</header>
    <div style={{ marginBottom: 24 }}><Input label="Internal name (optional)" value={name} maxLength={COMMERCIAL_INTERNAL_NAME_MAX_LENGTH} onChange={event => setName(event.target.value)} /></div>
    <fieldset style={{ border: 0, padding: 0, margin: '0 0 24px' }}><legend style={{ marginBottom: 12 }}>Estimate scope</legend>
      <label style={{ display: 'block', marginBottom: 12 }}><input type="radio" name={id} checked={scope === 'base'} onChange={() => setScope('base')} /> Base design</label>
      <label style={{ display: 'block' }}><input type="radio" name={id} checked={scope === 'add_on'} onChange={() => setScope('add_on')} /> Add-on scope</label>
    </fieldset>
    {!validName.ok ? <p role="alert">{validName.error}</p> : auth.user?.id ? <StudioCreateAction scope={{ actorId: auth.user.id, projectId }} intent={{ mode: 'blank', scope, internalName: validName.value }} /> : <p role="status">Waiting for your signed-in session…</p>}
  </section>;
}
