import {
  Home,
  Hammer,
  Users,
  CalendarDays,
  ArrowDownToLine,
  BookOpen,
  KeyRound,
  Wallet,
  ChartNoAxesCombined,
} from 'lucide-react';
import { isDeveloperEmail } from '@/lib/developerAccess';

export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', Icon: Home, adminOnly: false },
  {
    key: 'projects',
    label: 'Projects',
    href: '/staff/projects',
    Icon: Hammer,
    adminOnly: false,
    children: [
      { key: 'work-queue', label: 'Work Queue', href: '/staff/projects/work-queue' },
      { key: 'new-project', label: 'New Project', href: '/staff/projects/new' },
      { key: 'design-list', label: 'Drafting Queue', href: '/staff/projects/design-packages' },
      { key: 'running-jobs', label: 'Running Jobs', href: '/staff/projects/running-jobs' },
    ],
  },
  {
    key: 'contacts',
    label: 'Contacts',
    href: '/staff/contacts',
    Icon: Users,
    adminOnly: false,
    children: [
      { key: 'new-contact', label: 'New Contact', href: '/staff/contacts/new' },
    ],
  },
  {
    key: 'schedule',
    label: 'Schedule',
    href: '/schedule',
    Icon: CalendarDays,
    adminOnly: false,
    children: [
      { key: 'schedule-board', label: 'Board', href: '/staff/schedule?view=board' },
      { key: 'schedule-gantt', label: 'Gantt', href: '/staff/schedule?view=gantt' },
    ],
  },
  { key: 'finance', label: 'Finance', href: '/staff/payments', Icon: Wallet, adminOnly: false, financeOnly: true },
  { key: 'marketing-performance', label: 'Marketing', href: '/staff/marketing-performance', Icon: ChartNoAxesCombined, adminOnly: false, developerOnly: true },
  { key: 'imports', label: 'Imports', href: '/imports', Icon: ArrowDownToLine, adminOnly: false },
  {
    key: 'pricebook',
    label: 'Pricebook',
    href: '/pricebook',
    Icon: BookOpen,
    adminOnly: true,
    children: [
      { key: 'pricebook-costing-control', label: 'Costing control centre', href: '/admin/costing' },
      { key: 'pricebook-calculator', label: 'Calculator', href: '/staff/calculator' },
    ],
  },
  { key: 'access', label: 'Access', href: '/admin/access', Icon: KeyRound, adminOnly: true },
] as const;

export function visibleNavItems(role?: string | null, financeAccess = false, email?: string | null) {
  return NAV_ITEMS.filter(item => (!item.adminOnly || role === 'admin')
    && (!('financeOnly' in item) || financeAccess)
    && (!('developerOnly' in item) || isDeveloperEmail(email)));
}
