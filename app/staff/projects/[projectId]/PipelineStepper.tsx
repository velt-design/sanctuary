'use client';

import { PROJECT_STATUS_ORDER, projectStatusLabel, type ProjectStatus } from '@/lib/types/project';
import { useEffect, useRef, useState } from 'react';
import styles from '../projects.module.css';

type StepState = 'done' | 'current' | 'todo' | 'inactive';

function stepState(current: ProjectStatus, step: ProjectStatus): StepState {
  if (current === step) return 'current';
  const curIdx = PROJECT_STATUS_ORDER.indexOf(current);
  const stepIdx = PROJECT_STATUS_ORDER.indexOf(step);
  if (curIdx === -1 || stepIdx === -1) return 'todo';
  return stepIdx < curIdx ? 'done' : 'todo';
}

function classForState(state: StepState): string {
  switch (state) {
    case 'done':
      return styles.pipelineButtonDone;
    case 'current':
      return styles.pipelineButtonCurrent;
    case 'inactive':
      return styles.pipelineButtonInactive;
    case 'todo':
    default:
      return styles.pipelineButtonTodo;
  }
}

export default function PipelineStepper({
  currentStatus,
  onRequestChange,
}: {
  currentStatus: ProjectStatus;
  onRequestChange: (next: ProjectStatus, label: string, trigger: HTMLButtonElement) => void;
}) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [fade, setFade] = useState({ left: false, right: false });

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;

    let raf = 0;

    const compute = () => {
      cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
        const left = el.scrollLeft > 1;
        const right = el.scrollLeft < maxScroll - 1;
        setFade((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
      });
    };

    compute();
    const onScroll = () => compute();
    el.addEventListener('scroll', onScroll, { passive: true });

    const onResize = () => compute();
    window.addEventListener('resize', onResize);

    const ro = new ResizeObserver(() => compute());
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={stripRef}
      className={[
        styles.pipelineStrip,
        fade.left ? styles.pipelineStripFadeLeft : null,
        fade.right ? styles.pipelineStripFadeRight : null,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Project pipeline"
    >
      <ol className={styles.pipeline} role="list">
        {PROJECT_STATUS_ORDER.map((status, idx) => {
          const label = projectStatusLabel(status);
          const state = stepState(currentStatus, status);
          const isFirst = idx === 0;
          const classes = [
            styles.pipelineButton,
            isFirst && styles.pipelineButtonFirst,
            classForState(state),
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <li
              key={status}
              className={styles.pipelineStep}
              style={{
                zIndex: state === 'current' ? 4 : state === 'done' ? 3 : state === 'todo' ? 2 : 1,
              }}
            >
              <button
                type="button"
                className={classes}
                aria-current={state === 'current' ? 'step' : undefined}
                aria-label={`Set pipeline status: ${label}`}
                onClick={(e) => onRequestChange(status, label, e.currentTarget)}
                disabled={state === 'current'}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
