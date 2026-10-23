'use client';
import { useState } from 'react';
import FinanceRegister from '@/components/finance/FinanceRegister';
import PortalFrame, { usePortalFrameNavigation } from '@/components/layout/PortalFrame';
import { PortalAuthContext } from '@/components/auth/PortalAuthProvider';
import styles from '@/components/finance/FinanceRegister.module.css';

// Display identity only, inside the development + explicit-flag server route.
// No auth session, token, role lookup, local storage or provider client is created.
const syntheticSession = {
  status: 'authenticated' as const, user: { id: 'synthetic-finance-preview', email: 'preview@example.invalid' },
  email: 'preview@example.invalid', role: 'admin' as const, isAdmin: true,
  signOut: async () => 'cancelled' as const, refresh: async () => {},
};

export default function FinanceRegisterFixture() {
  const [mode, setMode] = useState('normal');
  const navigation = usePortalFrameNavigation();
  return <PortalAuthContext.Provider value={syntheticSession}><PortalFrame financeAccess navigation={navigation}>
    <aside className={styles.previewNotice}>
      <span><strong>Preview only</strong> · Synthetic examples in the normal Portal layout</span>
      <details><summary>Preview checks</summary><label>Fixture response <select value={mode} onChange={event => setMode(event.target.value)}><option value="normal">Normal</option><option value="slow">Delayed</option><option value="unavailable">Unavailable</option><option value="denied">No access</option></select></label><p>No customer data or provider calls. Job and PDF links require normal Portal access.</p></details>
    </aside>
    <FinanceRegister basePath="/qa/finance-register" apiPath={`/api/qa/finance-register?mode=${mode}`} />
  </PortalFrame></PortalAuthContext.Provider>;
}
