import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import styles from './FoundationAlert.module.css';

export type AlertTone = 'info' | 'warning' | 'error' | 'blocking';

export function AlertBanner({ tone = 'info', title, children, action }: {
  tone?: AlertTone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = tone === 'info' ? Info : tone === 'warning' ? AlertTriangle : AlertCircle;
  const urgent = tone === 'error' || tone === 'blocking';
  return (
    <aside className={styles.alert} data-tone={tone} role={urgent ? 'alert' : 'status'} aria-live={urgent ? undefined : 'polite'}>
      <Icon aria-hidden="true" />
      <div><strong>{title}</strong>{children ? <div>{children}</div> : null}</div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </aside>
  );
}

export function AlertActionButton({ type = 'button', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={[styles.actionButton, className].filter(Boolean).join(' ')} {...props} />;
}
