import { redirect } from 'next/navigation';

export default function AdminOverheadsRedirect() {
  redirect('/pricebook#overheads');
}
