import { redirect } from 'next/navigation';

export default function AdminActionsRedirect() {
  redirect('/pricebook#actions');
}
