'use client';

import type { RefObject } from 'react';
import type {
  ProjectDirection,
  ProjectPriority,
} from '../../lib/projectFinderContract';
import {
  priorityOrderByDirection,
  projectPriorityContent,
} from './projectFinderContent';
import styles from './projectFinderHomepage.module.css';

type BuildBriefProps = {
  direction: ProjectDirection;
  firstPriorityRef: RefObject<HTMLInputElement | null>;
  headingRef: RefObject<HTMLHeadingElement | null>;
  limitMessage: string;
  onChange: (priority: ProjectPriority, selected: boolean) => void;
  onClear: () => void;
  priorities: readonly ProjectPriority[];
};

export default function BuildBrief({
  direction,
  firstPriorityRef,
  headingRef,
  limitMessage,
  onChange,
  onClear,
  priorities,
}: BuildBriefProps) {
  const order = priorityOrderByDirection[direction];

  return (
    <div className={styles.briefBuilder}>
      <header className={styles.briefHeader}>
        <p className={styles.eyebrow}>Optional next step</p>
        <h3 ref={headingRef} tabIndex={-1}>What matters most for this project?</h3>
        <p>Choose up to three priorities. We will turn them into a short starting brief.</p>
      </header>
      <fieldset className={styles.priorityFieldset}>
        <legend className="visually-hidden">Project priorities</legend>
        <div className={styles.priorityStatus}>
          <span>{priorities.length} of 3 selected</span>
          {priorities.length ? (
            <button onClick={onClear} type="button">Clear all</button>
          ) : null}
        </div>
        <div className={styles.priorityGrid}>
          {order.map((priority, index) => {
            const content = projectPriorityContent[priority];
            return (
              <label className={styles.priorityChoice} key={priority}>
                <input
                  checked={priorities.includes(priority)}
                  data-project-priority={priority}
                  onChange={(event) => onChange(priority, event.currentTarget.checked)}
                  ref={index === 0 ? firstPriorityRef : undefined}
                  type="checkbox"
                  value={priority}
                />
                <span>
                  <strong>{content.label}</strong>
                  <small>{content.description}</small>
                </span>
              </label>
            );
          })}
        </div>
        <p
          className={styles.limitMessage}
          role={limitMessage ? 'alert' : undefined}
          aria-live="polite"
        >
          {limitMessage}
        </p>
      </fieldset>
    </div>
  );
}
