'use client';

import { useRef } from 'react';
import {
  setProjectCommandOwner,
  type ProjectCommandMutationResponse,
} from '@/lib/projects/commandCentre/client';
import { PROJECT_OWNER_OPTIONS } from '@/lib/projects/commandCentre/projectOwners';
import type { ProjectCommandOwnerSummary, ProjectOwnerKey } from '@/lib/projects/commandCentre/types';
import {
  projectCommandIntent,
  StableCommandAttempt,
} from '@/lib/projects/workItems/stableCommandAttempt';
import { Select } from '@/components/ui/foundation';
import styles from './ProjectOwnerControls.module.css';

export default function ProjectOwnerControls({
  projectId,
  owner,
  disabled,
  runMutation,
}: {
  projectId: string;
  owner: ProjectCommandOwnerSummary;
  disabled: boolean;
  runMutation: (operation: () => Promise<ProjectCommandMutationResponse>) => Promise<boolean>;
}) {
  const commandAttempts = useRef(new StableCommandAttempt()).current;
  const assign = async (ownerKey: ProjectOwnerKey | null) => {
    const payload = { ownerKey, expectedVersion: owner.version };
    const intent = projectCommandIntent('SET_PROJECT_OWNER', payload);
    const saved = await runMutation(() => setProjectCommandOwner(projectId, {
      ...payload,
      commandId: commandAttempts.commandIdFor(intent),
    }));
    if (saved) commandAttempts.committed(intent);
  };

  return <div className={styles.ownerControl} data-project-owner-controls="true">
    {owner.permissions.canManage ? <Select
        label="Project owner"
        aria-label="Change project owner"
        value={owner.owner?.key ?? ''}
        disabled={disabled}
        onChange={(event) => void assign((event.target.value || null) as ProjectOwnerKey | null)}
      >
        <option value="">Unassigned</option>
        {PROJECT_OWNER_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.displayName}</option>)}
      </Select> : null}
  </div>;
}
