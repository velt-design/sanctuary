import { requireAdminPageAccess } from '@/lib/auth';

export default async function PricebookLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPageAccess('/pricebook');

  return children;
}
