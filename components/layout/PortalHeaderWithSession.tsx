'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PortalHeader from './PortalHeader';

export default function PortalHeaderWithSession() {
  const router = useRouter();
  const { data, status } = useSession();

  const email = typeof data?.user?.email === 'string' ? data.user.email : '';
  const role = (((data?.user as any)?.role ?? 'staff') as 'admin' | 'staff') === 'admin' ? 'admin' : 'staff';

  useEffect(() => {
    if (status !== 'unauthenticated') return;
    router.replace('/login');
  }, [router, status]);

  const safeRole = useMemo(() => (status === 'authenticated' ? role : 'staff'), [role, status]);
  const safeEmail = useMemo(() => (status === 'authenticated' ? email : ''), [email, status]);

  return <PortalHeader email={safeEmail} role={safeRole} />;
}

