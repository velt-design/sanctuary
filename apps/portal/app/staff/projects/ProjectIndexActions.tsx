'use client';

import { useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { Project } from '@/lib/types/project';
import { formatPortalDate } from '@/lib/format/portalDateTime';
import { PortalMenu } from '@/components/ui/PortalFloatingPanel';
import { Drawer } from '@/components/ui/drawer/Drawer';
import ProjectDeliveryAction from '@/components/projects/ProjectDeliveryAction';
import styles from './ProjectIndexActions.module.css';

type Props = {
  project: Project; host: string; client: string; nameEditor: ReactNode; phone: ReactNode; address: ReactNode;
  stageBusy: boolean; archiveBusy: boolean; isAdmin: boolean;
  onOpen: () => void; onCorrect: () => void; onArchive: () => void; onDelete: () => void;
};

export default function ProjectIndexActions(props: Props) {
  const [contactOpen, setContactOpen] = useState(false);
  const { project, host, stageBusy, archiveBusy, isAdmin } = props;
  const name = project.projectName || project.name || 'project';
  // Let the menu close and restore its persistent trigger before an overlay
  // captures return focus. The menu item itself will have unmounted.
  const afterMenu = (action: () => void) => () => { window.requestAnimationFrame(action); };
  const menu = (openDelivery?: () => void) => <PortalMenu align="end"
    label={`Actions for ${name}`} triggerAriaLabel={`Actions for ${name}`}
    trigger={<MoreHorizontal size={18} aria-hidden="true" />} triggerClassName={styles.trigger}
    items={[
      { id: 'open', label: 'Open project', onSelect: props.onOpen },
      { id: 'contact', label: 'Contact & location', onSelect: afterMenu(() => setContactOpen(true)) },
      { id: 'correct', label: 'Correct stage', disabled: stageBusy, onSelect: afterMenu(props.onCorrect) },
      ...(openDelivery ? [{ id: 'delivery', label: project.status === 'COMPLETED' || project.status === 'PAID' ? 'Delivery completed' : 'Mark delivery completed', disabled: stageBusy, onSelect: afterMenu(openDelivery) }] : []),
      ...(isAdmin ? [
        { id: 'archive', label: archiveBusy ? 'Saving…' : project.isArchived ? 'Unarchive' : 'Archive', disabled: archiveBusy, onSelect: afterMenu(props.onArchive), separatorBefore: true },
        { id: 'delete', label: 'Delete', className: styles.destructive, onSelect: afterMenu(props.onDelete) },
      ] : []),
    ]} />;
  return <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); }}>
    {!project.isArchived && project.effectiveState !== 'CLOSED'
      ? <ProjectDeliveryAction projectId={project.id} host={host} completed={project.status === 'COMPLETED' || project.status === 'PAID'} disabled={stageBusy} renderTrigger={menu} />
      : menu()}
    <Drawer title="Contact & location" open={contactOpen} onClose={() => setContactOpen(false)}>
      <div className={styles.details}><h3>{name}</h3><p>{props.client}</p>
        <div><h4>Project name</h4>{props.nameEditor}</div>
        <div><h4>Phone</h4>{props.phone}</div>
        <div><h4>Site address</h4>{props.address}</div>
        <div><h4>Project created</h4><p>{formatPortalDate(project.createdAt)}</p></div>
      </div>
    </Drawer>
  </span>;
}
