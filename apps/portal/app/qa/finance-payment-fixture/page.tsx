import { notFound } from 'next/navigation';
import FinancePaymentFixture from './FinancePaymentFixture';

export default function FinancePaymentFixturePage() {
  if (process.env.ENABLE_PORTAL_QA_FIXTURES !== '1') notFound();
  return <FinancePaymentFixture />;
}
