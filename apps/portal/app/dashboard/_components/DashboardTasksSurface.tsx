'use client';
import type { DashboardPersonalTask } from '@/lib/dashboard/types';
import { DASHBOARD_TASK_TITLE_MAX_LENGTH } from '@/lib/dashboard/types';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import dash from '../dashboard.module.css';
import { Button, Input } from '@/components/ui/foundation/FoundationControls';
import type {ReactNode} from 'react';
export type DashboardTasksSurfaceProps = {
  rows?:ReactNode;title:string;setTitle:(title:string)=>void;initialTasks:DashboardPersonalTask[]|null;
  tasks:DashboardPersonalTask[];pending?:boolean;readOnly?:boolean;error:string|null;
  setError:(error:string|null)=>void;submitting:boolean;pendingTaskIds:ReadonlySet<string>;
  createTask:()=>Promise<void>;toggleTask:(task:DashboardPersonalTask,completed:boolean)=>Promise<void>;
};
export default function DashboardTasksSurface({title,setTitle,initialTasks,tasks,pending=false,readOnly=false,error,setError,submitting,createTask,rows}:DashboardTasksSurfaceProps) {
  return (
    <section className={`${styles.section} ${dash.card} ${dash.tasksCard}`} aria-label="My Tasks">
      <div className={`${styles.sectionHeader} ${dash.cardHeader}`}>
        <div>
          <h2 className={styles.sectionTitle}>My Tasks</h2>
          <div className={`${styles.muted} ${dash.cardSubheading}`}>
            Personal reminders.
          </div>
        </div>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody}`}>
        <form
          className={dash.taskComposer}
          onSubmit={(event) => {
            event.preventDefault();
            void createTask();
          }}
        >
          <Input
            fieldClassName={dash.taskInputField}
            className={dash.taskInput}
            aria-label="New dashboard task"
            placeholder="Add a task..."
            value={title}
            maxLength={DASHBOARD_TASK_TITLE_MAX_LENGTH}
            onChange={(event) => {
              setTitle(event.target.value);
              if (error) setError(null);
            }}
            disabled={submitting}
          />
          <Button className={dash.taskAddButton} type="submit" loading={submitting} disabled={!initialTasks||readOnly||!title.trim()}>
            Add
          </Button>
        </form>
        <div className={dash.taskError} role={error ? 'alert' : undefined}>{error}</div>

        {!initialTasks?<div className={dash.emptyState} role={pending?'status':undefined}>{pending?'Reading personal tasks…':'Personal tasks unavailable.'}</div>:tasks.length ? (
          rows
        ) : (
          <div className={dash.emptyState}>No personal tasks yet.</div>
        )}
      </div>
    </section>
  );
}
