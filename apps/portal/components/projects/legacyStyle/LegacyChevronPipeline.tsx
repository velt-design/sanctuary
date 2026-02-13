'use client';

import { useEffect, useRef, useState } from 'react';
import { PIPELINE_STAGES, type PipelineStageKey } from '@/lib/projects/pipelineDefinition';
import legacy from '@/app/staff/projects/projects.module.css';

type StepState = 'done' | 'current' | 'todo' | 'inactive';

const STAGE_KEYS = PIPELINE_STAGES.map((stage) => stage.key);

function stepState(current: PipelineStageKey, step: PipelineStageKey): StepState {
  if (current === step) return 'current';
  const curIdx = STAGE_KEYS.indexOf(current);
  const stepIdx = STAGE_KEYS.indexOf(step);
  if (curIdx === -1 || stepIdx === -1) return 'todo';
  return stepIdx < curIdx ? 'done' : 'todo';
}

function classForState(state: StepState): string {
  switch (state) {
    case 'done':
      return legacy.pipelineButtonDone;
    case 'current':
      return legacy.pipelineButtonCurrent;
    case 'inactive':
      return legacy.pipelineButtonInactive;
    case 'todo':
    default:
      return legacy.pipelineButtonTodo;
  }
}

export default function LegacyChevronPipeline({
  stage,
  onRequestChange,
  disabled,
}: {
  stage: PipelineStageKey;
  onRequestChange?: (next: PipelineStageKey, label: string, trigger: HTMLButtonElement) => void;
  disabled?: boolean;
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
        legacy.pipelineStrip,
        fade.left ? legacy.pipelineStripFadeLeft : null,
        fade.right ? legacy.pipelineStripFadeRight : null,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Project pipeline"
    >
      <ol className={legacy.pipeline} role="list">
        {PIPELINE_STAGES.map((stageDef, idx) => {
          const label = stageDef.label;
          const state = stepState(stage, stageDef.key);
          const isFirst = idx === 0;
          const classes = [legacy.pipelineButton, isFirst && legacy.pipelineButtonFirst, classForState(state)]
            .filter(Boolean)
            .join(' ');

          const isInteractive = typeof onRequestChange === 'function';

          return (
            <li
              key={stageDef.key}
              className={legacy.pipelineStep}
              style={{
                zIndex: state === 'current' ? 4 : state === 'done' ? 3 : state === 'todo' ? 2 : 1,
              }}
            >
              {isInteractive ? (
                <button
                  type="button"
                  className={classes}
                  aria-current={state === 'current' ? 'step' : undefined}
                  aria-label={`Set pipeline status: ${label}`}
                  onClick={(e) => onRequestChange?.(stageDef.key, label, e.currentTarget)}
                  disabled={Boolean(disabled) || state === 'current'}
                >
                  {label}
                </button>
              ) : (
                <span className={classes} aria-current={state === 'current' ? 'step' : undefined}>
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
