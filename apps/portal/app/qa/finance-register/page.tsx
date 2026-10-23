import { notFound } from 'next/navigation';
import FinanceRegisterFixture from './FinanceRegisterFixture';

export default function Page() {
  if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_PORTAL_QA_FIXTURES !== '1') notFound();
  return <FinanceRegisterFixture />;
}
