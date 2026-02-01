import dash from '../dashboard.module.css';
import type { DashboardKpis } from '@/lib/dashboard/types';
import KpiTile from './KpiTile';
import { projectsHref, scheduleHref } from '@/lib/dashboard/links';

export default function KpiStrip({ kpis }: { kpis: DashboardKpis }) {
  return (
    <div className={dash.kpiStrip}>
      <KpiTile label="Actions due" value={kpis.actionsDue} href={projectsHref({ nextActionDue: true })} />
      <KpiTile label="New leads" value={kpis.newLeads} href={projectsHref({ status: 'NEW' })} />
      <KpiTile label="Quotes to send" value={kpis.quotesToSend} href={projectsHref({ status: 'QUOTING' })} />
      <KpiTile label="Installs this week" value={kpis.installsThisWeek} href={scheduleHref('board')} />
    </div>
  );
}
