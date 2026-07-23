import {
  Home,
  Hammer,
  Users,
  CalendarDays,
  ArrowDownToLine,
  BrainCircuit,
  KeyRound,
} from 'lucide-react';

export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', Icon: Home, adminOnly: false },
  {
    key: 'projects',
    label: 'Projects',
    href: '/staff/projects',
    Icon: Hammer,
    adminOnly: false,
    children: [
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
      { key: 'schedule-site-visits', label: 'Site visits', href: '/staff/schedule?view=site-visits' },
    ],
  },
  { key: 'imports', label: 'Imports', href: '/imports', Icon: ArrowDownToLine, adminOnly: false },
  {
    key: 'costing',
    label: 'Calculator Brain',
    href: '/admin/costing',
    Icon: BrainCircuit,
    adminOnly: true,
    children: [
      { key: 'costing-control', label: 'Control centre', href: '/admin/costing' },
      { key: 'costing-calculator', label: 'Calculator', href: '/staff/calculator' },
    ],
  },
  { key: 'access', label: 'Access', href: '/admin/access', Icon: KeyRound, adminOnly: true },
] as const;
