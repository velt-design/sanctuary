import { redirect } from 'next/navigation';

export default function LegacyPricebookRedirect() {
  redirect('/admin/costing');
}
