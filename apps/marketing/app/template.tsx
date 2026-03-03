// app/template.tsx
'use client';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

const AnimatedRouteTemplate = dynamic(() => import('@/components/AnimatedRouteTemplate'), {
  loading: () => null,
});

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/' || pathname?.startsWith('/staff') || pathname?.startsWith('/admin/costs')) {
    return <main>{children}</main>;
  }
  return <AnimatedRouteTemplate routeKey={pathname || 'route'}>{children}</AnimatedRouteTemplate>;
}
