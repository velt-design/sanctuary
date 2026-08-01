'use client';

import { useRef } from 'react';
import { setProjectCommandOwner, type ProjectCommandMutationResponse } from '@/lib/projects/commandCentre/client';
import {
  ENQUIRY_OWNER_KEY,
  PROJECT_OWNER_OPTIONS,
  projectOwnerHandoffGuidance,
} from '@/lib/projects/commandCentre/projectOwners';
import type { ProjectCommandOwnerSummary, ProjectOwnerKey } from '@/lib/projects/commandCentre/types';
import type { ProjectStage } from '@/lib/projects/types';
import { projectCommandIntent, StableCommandAttempt } from '@/lib/projects/workItems/stableCommandAttempt';
import { Select } from '@/components/ui/foundation';
import styles from './ProjectOwnerControls.module.css';

export default function ProjectOwnerControls({
  projectId,
  stage,
  owner,
  disabled,
  runMutation,
}: {
  projectId: string;
  stage: ProjectStage;
  owner: ProjectCommandOwnerSummary;
  disabled: boolean;
  runMutation: (operation: () => Promise<ProjectCommandMutationResponse>) => Promise<boolean>;
}) {
  const commandAttempts = useRef(new StableCommandAttempt()).current;
  const enquiryOwnerLocked = stage === 'new' || stage === 'contacted';
  const assign = async (ownerKey: ProjectOwnerKey | null) => {
    const payload = { ownerKey, expectedVersion: owner.version };
    const intent = projectCommandIntent('SET_PROJECT_OWNER', payload);
    const saved = await runMutation(() =>
      setProjectCommandOwner(projectId, {
        ...payload,
        commandId: commandAttempts.commandIdFor(intent),
      }),
    );
    if (saved) commandAttempts.committed(intent);
  };

  return (
    <div className={styles.ownerControl} data-project-owner-controls="true">
      <p className={styles.handoffGuidance} data-project-owner-handoff-guidance="true">
        {projectOwnerHandoffGuidance(stage)}
      </p>
      {owner.permissions.canManage ? (
        <Select
          label="Project owner"
          aria-label="Change project owner"
          value={owner.owner?.key ?? ''}
          disabled={disabled}
          onChange={(event) => void assign((event.target.value || null) as ProjectOwnerKey | null)}
        >
          <option value="" disabled={enquiryOwnerLocked}>
            Unassigned
          </option>
          {PROJECT_OWNER_OPTIONS.map((option) => (
            <option
              key={option.key}
              value={option.key}
              disabled={enquiryOwnerLocked && option.key !== ENQUIRY_OWNER_KEY}
            >
              {option.displayName}
            </option>
          ))}
        </Select>
      ) : null}
    </div>
  );
}
