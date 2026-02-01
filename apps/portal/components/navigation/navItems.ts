import {
  Home,
  Hammer,
  Users,
  CalendarDays,
  ArrowDownToLine,
  BookOpen,
} from 'lucide-react';

export const SIDEBAR_WIDTH_PX = 56;

export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', Icon: Home },
  { key: 'projects', label: 'Projects', href: '/projects', Icon: Hammer },
  { key: 'contacts', label: 'Contacts', href: '/contacts', Icon: Users },
  { key: 'schedule', label: 'Schedule', href: '/schedule', Icon: CalendarDays },
  { key: 'imports', label: 'Imports', href: '/imports', Icon: ArrowDownToLine },
  { key: 'pricebook', label: 'Pricebook', href: '/pricebook', Icon: BookOpen },
] as const;
