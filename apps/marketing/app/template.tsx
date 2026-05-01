// app/template.tsx
'use client';
import { usePathname } from 'next/navigation';
import AnimatedRouteTemplate from '@/components/AnimatedRouteTemplate';

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/' || pathname?.startsWith('/staff') || pathname?.startsWith('/admin/costs')) {
    return <main>{children}</main>;
  }
  return <AnimatedRouteTemplate routeKey={pathname || 'route'}>{children}</AnimatedRouteTemplate>;
}
