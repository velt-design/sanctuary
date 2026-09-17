'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

const excluded = ['/configurator-preview', '/design-enquiry', '/simple-cover-calculator', '/quote', '/invoice', '/staff', '/admin', '/pricebook', '/__foundation', '/%5F%5Ffoundation'];
export default function EditorialWebsite({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const enabled = !excluded.some(route => pathname === route || pathname.startsWith(route + '/'));
  return <div data-editorial-website={enabled || undefined}>{children}</div>;
}
