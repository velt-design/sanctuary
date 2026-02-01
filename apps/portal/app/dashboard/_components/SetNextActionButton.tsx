'use client';

import { useState } from 'react';
import SetNextActionModal from './SetNextActionModal';
import dash from '../dashboard.module.css';

export default function SetNextActionButton(props: {
  projectId: string;
  currentAction?: string | null;
  currentDue?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={dash.linkButton} onClick={() => setOpen(true)}>
        Set next action
      </button>

      <SetNextActionModal
        open={open}
        onOpenChange={setOpen}
        projectId={props.projectId}
        initial={{
          actionLabel: props.currentAction ?? '',
          dueDate: props.currentDue ?? '',
        }}
      />
    </>
  );
}
