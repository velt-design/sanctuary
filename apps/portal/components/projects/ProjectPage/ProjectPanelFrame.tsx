'use client';

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import styles from './ProjectPage.module.css';

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

type ProjectPanelFrameProps = {
  bodyClassName?: string;
  children?: ReactNode;
  dragging?: boolean;
  dragHandleProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  dragHandleRef?: (node: HTMLButtonElement | null) => void;
  dropTarget?: boolean;
  frameClassName?: string;
  overlay?: boolean;
  placeholder?: boolean;
  style?: CSSProperties;
  title: string;
};

export default function ProjectPanelFrame({
  bodyClassName,
  children,
  dragging = false,
  dragHandleProps,
  dragHandleRef,
  dropTarget = false,
  frameClassName,
  overlay = false,
  placeholder = false,
  style,
  title,
}: ProjectPanelFrameProps) {
  return (
    <div
      className={cx(
        styles.panelFrame,
        frameClassName,
        dragging && styles.panelFrameDragging,
        dropTarget && styles.panelFrameDropTarget,
        overlay && styles.panelFrameOverlay,
        placeholder && styles.panelFramePlaceholder,
      )}
      style={style}
      data-overlay={overlay ? 'true' : undefined}
      data-placeholder={placeholder ? 'true' : undefined}
    >
      <div className={styles.panelFrameHeader}>
        <div className={styles.panelFrameTitle}>{title}</div>
        {dragHandleProps ? (
          <button
            {...dragHandleProps}
            ref={dragHandleRef}
            type="button"
            className={styles.panelDragHandle}
            aria-label={`Drag ${title}`}
          >
            <span className={styles.panelDragGrip} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className={cx(styles.panelFrameBody, bodyClassName)}>
        {placeholder ? <div className={styles.panelPlaceholderCopy}>Drop panel here</div> : children}
      </div>
    </div>
  );
}
