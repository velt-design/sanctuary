'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from '../adminCosts.module.css';

const LINKS = [
  { href: '/admin/costs/materials', label: 'Materials' },
  { href: '/admin/costs/actions', label: 'Actions' },
  { href: '/admin/costs/overheads', label: 'Overheads' },
] as const;

export default function AdminCostsNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Cost tables">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

