import {
  createElement,
  forwardRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react';
import { Inbox } from 'lucide-react';
import styles from './FoundationSurfaces.module.css';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'inverse';

export function Badge({
  tone = 'neutral',
  edge = false,
  children,
  className,
}: {
  tone?: BadgeTone;
  edge?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx(styles.badge, styles[`badge${tone[0].toUpperCase()}${tone.slice(1)}`], edge && styles.badgeEdge, className)}>
      {children}
    </span>
  );
}

export type CardProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  padding?: 'none' | 'compact' | 'standard';
  headingLevel?: 2 | 3 | 4;
};

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { title, eyebrow, action, footer, padding = 'standard', headingLevel = 2, children, className, ...props },
  ref,
) {
  const hasHeader = Boolean(title || eyebrow || action);
  return (
    <section ref={ref} className={cx(styles.card, className)} {...props}>
      {hasHeader ? (
        <header className={styles.cardHeader}>
          <div>
            {eyebrow ? <div className={styles.cardEyebrow}>{eyebrow}</div> : null}
            {title ? createElement(`h${headingLevel}`, { className: styles.cardTitle }, title) : null}
          </div>
          {action ? <div className={styles.cardAction}>{action}</div> : null}
        </header>
      ) : null}
      <div className={cx(styles.cardBody, styles[`padding${padding[0].toUpperCase()}${padding.slice(1)}`])}>{children}</div>
      {footer ? <footer className={styles.cardFooter}>{footer}</footer> : null}
    </section>
  );
});

export const Table = forwardRef<HTMLTableElement, TableHTMLAttributes<HTMLTableElement>>(function Table(
  { className, ...props },
  ref,
) {
  return (
    <div className={styles.tableScroll}>
      <table ref={ref} className={cx(styles.table, className)} {...props} />
    </div>
  );
});

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(function TableHeader(
  { className, ...props },
  ref,
) {
  return <thead ref={ref} className={cx(styles.tableHeader, className)} {...props} />;
});

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(function TableBody(
  { className, ...props },
  ref,
) {
  return <tbody ref={ref} className={cx(styles.tableBody, className)} {...props} />;
});

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(function TableRow(
  { className, ...props },
  ref,
) {
  return <tr ref={ref} className={cx(styles.tableRow, className)} {...props} />;
});

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(function TableHead(
  { className, ...props },
  ref,
) {
  return <th ref={ref} className={cx(styles.tableHead, className)} {...props} />;
});

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(function TableCell(
  { className, ...props },
  ref,
) {
  return <td ref={ref} className={cx(styles.tableCell, className)} {...props} />;
});

export function EmptyState({
  title,
  description,
  action,
  icon,
  compact = false,
  headingLevel = 3,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
  headingLevel?: 2 | 3 | 4;
}) {
  return (
    <div className={cx(styles.emptyState, compact && styles.emptyStateCompact)}>
      <div className={styles.emptyIcon}>{icon ?? <Inbox aria-hidden="true" />}</div>
      {createElement(`h${headingLevel}`, {}, title)}
      {description ? <p>{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function LoadingSkeleton({
  rows = 4,
  columns = 4,
  label = 'Loading content',
}: {
  rows?: number;
  columns?: number;
  label?: string;
}) {
  return (
    <div className={styles.skeleton} role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div className={styles.skeletonRow} key={rowIndex}>
          {Array.from({ length: columns }, (_, columnIndex) => (
            <span key={columnIndex} style={{ '--skeleton-width': `${58 + ((rowIndex + columnIndex) % 4) * 11}%` } as CSSProperties} />
          ))}
        </div>
      ))}
      <span className="visually-hidden">{label}</span>
    </div>
  );
}

export function StickyActionBar({
  status,
  meta,
  issues,
  children,
  className,
}: {
  status: ReactNode;
  meta?: ReactNode;
  issues?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside className={cx(styles.stickyBar, className)} aria-label="Page actions">
      <div className={styles.stickyStatus}>
        <span className={styles.unsavedMark} aria-hidden="true" />
        <strong>{status}</strong>
        {meta ? <span>{meta}</span> : null}
        {issues ? <span className={styles.issueText}>{issues}</span> : null}
      </div>
      <div className={styles.stickyActions}>{children}</div>
    </aside>
  );
}
