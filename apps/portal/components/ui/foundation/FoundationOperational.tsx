'use client';

import { useRef, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import styles from './FoundationOperational.module.css';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export type FoundationTabItem<Key extends string = string> = {
  key: Key;
  label: string;
  controls?: string;
};

export function TabNavigation<Key extends string>({
  items,
  selectedKey,
  onSelect,
  onIntent,
  ariaLabel,
  className,
  disabled = false,
}: {
  items: readonly FoundationTabItem<Key>[];
  selectedKey: Key;
  onSelect: (key: Key) => void;
  onIntent?: (key: Key) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveSelection = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (disabled) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowRight'
          ? (index + 1) % items.length
          : (index - 1 + items.length) % items.length;
    const next = items[nextIndex];
    buttonRefs.current[nextIndex]?.focus();
    onIntent?.(next.key);
    onSelect(next.key);
  };

  return (
    <nav className={cx(styles.tabsScroller, className)} aria-label={ariaLabel}>
      <div className={styles.tabs} role="tablist" aria-label={ariaLabel}>
        {items.map((item, index) => {
          const selected = item.key === selectedKey;
          return (
            <button
              key={item.key}
              ref={(node) => { buttonRefs.current[index] = node; }}
              type="button"
              className={styles.tab}
              data-selected={selected || undefined}
              aria-selected={selected}
              aria-controls={item.controls}
              role="tab"
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => onSelect(item.key)}
              onFocus={() => onIntent?.(item.key)}
              onKeyDown={(event) => moveSelection(event, index)}
              onMouseEnter={() => onIntent?.(item.key)}
              onPointerDown={() => onIntent?.(item.key)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export type KeyValueItem = {
  label: ReactNode;
  value: ReactNode;
  wide?: boolean;
};

export function KeyValueGrid({
  items,
  columns = 2,
  className,
  ariaLabel,
}: {
  items: readonly KeyValueItem[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <dl
      className={cx(styles.keyValues, className)}
      data-columns={columns}
      aria-label={ariaLabel}
    >
      {items.map((item, index) => (
        <div key={index} data-wide={item.wide || undefined}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type MetricItem = {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  emphasis?: boolean;
};

export function MetricGrid({
  items,
  columns = 4,
  className,
  ariaLabel,
}: {
  items: readonly MetricItem[];
  columns?: 2 | 3 | 4;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <dl className={cx(styles.metrics, className)} data-columns={columns} aria-label={ariaLabel}>
      {items.map((item, index) => (
        <div key={index} data-emphasis={item.emphasis || undefined}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          {item.detail ? <div className={styles.metricDetail}>{item.detail}</div> : null}
        </div>
      ))}
    </dl>
  );
}

export function ActivityTimeline({
  children,
  className,
  ariaLabel = 'Activity timeline',
}: {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return <ol className={cx(styles.timeline, className)} aria-label={ariaLabel}>{children}</ol>;
}

export function ActivityTimelineItem({
  marker,
  meta,
  children,
  footer,
  actions,
  className,
  ...props
}: HTMLAttributes<HTMLLIElement> & {
  marker?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <li className={cx(styles.timelineItem, className)} {...props}>
      <div className={styles.timelineHeader}>
        <div className={styles.timelineIdentity}>{marker}{meta}</div>
        {actions ? <div className={styles.timelineActions}>{actions}</div> : null}
      </div>
      <span className={styles.timelineRail} aria-hidden="true" />
      <div className={styles.timelineBody}>{children}</div>
      {footer ? <footer className={styles.timelineFooter}>{footer}</footer> : null}
    </li>
  );
}

export function TaskList({ children, className, ariaLabel = 'Tasks' }: {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return <ul className={cx(styles.taskList, className)} aria-label={ariaLabel}>{children}</ul>;
}

export function TaskRow({
  checked,
  disabled,
  label,
  description,
  status,
  actions,
  onChange,
  showControl = true,
  controlAriaLabel,
  className,
}: {
  checked: boolean;
  disabled?: boolean;
  label: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  onChange?: (checked: boolean) => void;
  showControl?: boolean;
  controlAriaLabel?: string;
  className?: string;
}) {
  const copy = (
    <span className={styles.taskCopy}>
      <strong>{label}</strong>
      {description ? <small>{description}</small> : null}
    </span>
  );
  return (
    <li className={cx(styles.taskRow, className)} data-complete={checked || undefined}>
      {showControl ? (
        <label className={styles.taskChoice}>
          <input
            type="checkbox"
            aria-label={controlAriaLabel}
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange?.(event.target.checked)}
          />
          <span aria-hidden="true" />
          {copy}
        </label>
      ) : <div className={styles.taskChoiceStatic}>{copy}</div>}
      {status ? <div className={styles.taskStatus}>{status}</div> : null}
      {actions ? <div className={styles.taskActions}>{actions}</div> : null}
    </li>
  );
}

export function ActionPanel({
  title,
  eyebrow,
  status,
  tone = 'default',
  children,
  footer,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  title: ReactNode;
  eyebrow?: ReactNode;
  status?: ReactNode;
  tone?: 'default' | 'inverse' | 'critical';
  footer?: ReactNode;
}) {
  return (
    <section className={cx(styles.actionPanel, className)} data-tone={tone} {...props}>
      <header>
        <div>
          {eyebrow ? <span>{eyebrow}</span> : null}
          <h3>{title}</h3>
        </div>
        {status ? <div>{status}</div> : null}
      </header>
      <div className={styles.actionPanelBody}>{children}</div>
      {footer ? <footer>{footer}</footer> : null}
    </section>
  );
}

export function OperationalGrid({
  children,
  columns = 2,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { columns?: 2 | 3 }) {
  return (
    <div className={cx(styles.operationalGrid, className)} data-columns={columns} {...props}>
      {children}
    </div>
  );
}
