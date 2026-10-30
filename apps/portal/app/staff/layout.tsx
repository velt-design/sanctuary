import DbGate from '@/components/sync/DbGate';
import { requireStaffPageAccess } from '@/lib/auth';
import {headers} from 'next/headers';
import {STUDIO_EDIT_CALLBACK_HEADER,studioEditCallback,studioDocumentCallback} from '@/lib/designStudio/studioEditRoute';

export const dynamic = 'force-dynamic';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const hint=(await headers()).get(STUDIO_EDIT_CALLBACK_HEADER),enabled=process.env.ENABLE_PORTAL_DESIGN_STUDIO==='1';
  if(studioDocumentCallback(hint,enabled))return <>{children}</>;
  const callback=studioEditCallback(hint,enabled);
  await requireStaffPageAccess(callback??'/staff');

  return (
    <>
      <DbGate />
      {children}
    </>
  );
}
