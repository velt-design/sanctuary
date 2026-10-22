'use client';
import { useState } from 'react';
import FinanceRegister from '@/components/finance/FinanceRegister';

export default function FinanceRegisterFixture() {
  const [mode, setMode] = useState('normal');
  return <><aside style={{ padding: '12px 24px', borderBottom: '1px solid var(--ui-border)' }}>
    <strong>Synthetic local preview</strong>{' '}· Actual register components and migration SQL. No customer data or provider calls.{' '}
    <label>Fixture response <select value={mode} onChange={event => setMode(event.target.value)}><option value="normal">Normal</option><option value="slow">Delayed</option><option value="unavailable">Unavailable</option><option value="denied">No access</option></select></label>
  </aside><FinanceRegister basePath="/qa/finance-register" apiPath={`/api/qa/finance-register?mode=${mode}`} /></>;
}
