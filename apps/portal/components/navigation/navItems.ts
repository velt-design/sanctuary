import {
  Home,
  Hammer,
  Users,
  CalendarDays,
  ArrowDownToLine,
  BookOpen,
  KeyRound,
} from 'lucide-react';

export const SIDEBAR_WIDTH_PX = 56;

export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', Icon: Home, adminOnly: false },
  { key: 'projects', label: 'Projects', href: '/projects', Icon: Hammer, adminOnly: false },
  { key: 'contacts', label: 'Contacts', href: '/contacts', Icon: Users, adminOnly: false },
  { key: 'schedule', label: 'Schedule', href: '/schedule', Icon: CalendarDays, adminOnly: false },
  { key: 'imports', label: 'Imports', href: '/imports', Icon: ArrowDownToLine, adminOnly: false },
  { key: 'pricebook', label: 'Pricebook', href: '/pricebook', Icon: BookOpen, adminOnly: false },
  { key: 'access', label: 'Access', href: '/admin/access', Icon: KeyRound, adminOnly: true },
] as const;
