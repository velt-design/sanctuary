import Link from 'next/link';
import { CalendarDays, Calculator, FolderPlus } from 'lucide-react';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { PORTAL_TIME_ZONE } from '@/lib/format/portalDateTime';
import dash from '../dashboard.module.css';

const QUICK_ACTIONS = [
  { label: 'New project', href: '/staff/projects/new', icon: FolderPlus },
  { label: 'Calculator', href: '/staff/calculator', icon: Calculator },
  { label: 'Schedule', href: '/staff/schedule', icon: CalendarDays },
] as const;

function dateParts(value: string): Record<string, string> {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return {};
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-NZ', {
      timeZone: PORTAL_TIME_ZONE,
      weekday: 'long',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
}

export default function DashboardHero({ updatedAtIso }: { updatedAtIso: string }) {
  const date = dateParts(updatedAtIso);
  return (
    <div className={dash.hero} data-dashboard-hero="true">
      <StaffPageHeader
        variant="dashboard"
        title="Dashboard"
        eyebrow="Welcome back"
        subtitle={<span className={dash.heroTagline}><span aria-hidden="true" /> Design bold. Build better.</span>}
        right={(
          <div className={dash.heroTools}>
            <section className={dash.quickActions} aria-label="Quick actions">
              <div className={dash.quickActionsLabel}>Quick actions</div>
              <div className={dash.quickActionGrid}>
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link key={action.href} href={action.href} className={dash.quickAction}>
                      <Icon aria-hidden="true" />
                      <span>{action.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
            <div className={dash.dateTile} aria-label={`${date.weekday ?? ''} ${date.day ?? ''} ${date.month ?? ''} ${date.year ?? ''}`.trim()}>
              <span>{date.weekday ?? 'Today'}</span>
              <strong>{date.day ?? '--'}</strong>
              <b>{date.month ?? ''}</b>
              <small>{date.year ?? ''}</small>
            </div>
          </div>
        )}
      />
    </div>
  );
}
