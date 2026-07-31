'use client';

import { MoreHorizontal } from 'lucide-react';
import { PortalPanelAction, PortalPopover } from '@/components/ui/PortalFloatingPanel';
import styles from './ScheduleBoardActions.module.css';

type ScheduleBoardActionGroup = 'timing' | 'progress' | 'client' | 'exceptions';

export type ScheduleBoardMenuAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'danger';
  group?: ScheduleBoardActionGroup;
};

const GROUPS: Array<{ id: ScheduleBoardActionGroup; label: string }> = [
  { id: 'timing', label: 'Plan and timing' },
  { id: 'progress', label: 'Job progress' },
  { id: 'client', label: 'Customer' },
  { id: 'exceptions', label: 'Exceptions' },
];

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function ScheduleBoardActions({
  actions,
  projectName,
  disabled = false,
  disabledReason,
}: {
  actions: ScheduleBoardMenuAction[];
  projectName: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const items = actions.filter((action) => action && typeof action.onClick === 'function');
  if (!items.length) return null;
  const label = `Job actions for ${projectName}`;

  if (disabled) {
    return (
      <span className={styles.wrap} data-no-dnd="true">
        <button type="button" className={styles.trigger} disabled aria-label={label} title={disabledReason ?? label}>
          <MoreHorizontal aria-hidden="true" size={18} />
        </button>
      </span>
    );
  }

  return (
    <span className={styles.wrap} data-no-dnd="true">
      <PortalPopover
        label={label}
        trigger={<MoreHorizontal aria-hidden="true" size={18} />}
        triggerAriaLabel={label}
        triggerClassName={styles.trigger}
        contentClassName={styles.panel}
      >
        {({ close }) => (
          <>
            <div className={styles.header}>
              <h3 className={styles.title}>{projectName}</h3>
              <p className={styles.hint}>Choose the part of this job you need to change.</p>
            </div>
            {GROUPS.map((group) => {
              const groupItems = items.filter((action) => (action.group ?? 'exceptions') === group.id);
              if (!groupItems.length) return null;
              return (
                <section key={group.id} className={styles.group} aria-label={group.label}>
                  <h4 className={styles.groupLabel}>{group.label}</h4>
                  {groupItems.map((action) => (
                    <PortalPanelAction
                      key={action.label}
                      className={cx(styles.action, action.tone === 'danger' && styles.danger)}
                      disabled={action.disabled}
                      onClick={() => {
                        close();
                        window.setTimeout(() => action.onClick(), 0);
                      }}
                    >
                      {action.label}
                    </PortalPanelAction>
                  ))}
                </section>
              );
            })}
          </>
        )}
      </PortalPopover>
    </span>
  );
}
