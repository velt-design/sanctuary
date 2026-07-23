import { redirect } from 'next/navigation';

export default function AdminOverheadsRedirect() {
  redirect('/admin/costing');
}
