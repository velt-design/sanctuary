'use client';

import { useMemo, useState } from 'react';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';

export default function OldCalculatorClient({
  email,
  role,
}: {
  email: string;
  role: 'admin' | 'staff';
}) {
  const { signOut } = usePortalSession();
  const [length, setLength] = useState<number>(3);
  const [width, setWidth] = useState<number>(3);
  const [rate, setRate] = useState<number>(1000);

  const area = useMemo(() => {
    const a = Number(length) * Number(width);
    return Number.isFinite(a) ? a : 0;
  }, [length, width]);

  const total = useMemo(() => area * rate, [area, rate]);

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '24px',
      }}
    >
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1>Old Calculator</h1>
            <p style={{ marginTop: 4 }}>
              Signed in as {email} ({role})
            </p>
          </div>
          <button onClick={() => void signOut('/login')}>Sign out</button>
        </div>

        <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          <label>
            Length (m)
            <input
              style={{ width: '100%' }}
              type="number"
              min={0}
              step={0.1}
              value={length}
              onChange={(e) => {
                const next = Number.parseFloat(e.target.value);
                setLength(Number.isFinite(next) ? next : 0);
              }}
            />
          </label>

          <label>
            Width (m)
            <input
              style={{ width: '100%' }}
              type="number"
              min={0}
              step={0.1}
              value={width}
              onChange={(e) => {
                const next = Number.parseFloat(e.target.value);
                setWidth(Number.isFinite(next) ? next : 0);
              }}
            />
          </label>

          {role === 'admin' ? (
            <label>
              Rate ($/m²) — admin only
              <input
                style={{ width: '100%' }}
                type="number"
                min={0}
                step={1}
                value={rate}
                onChange={(e) => {
                  const next = Number.parseFloat(e.target.value);
                  setRate(Number.isFinite(next) ? next : 0);
                }}
              />
            </label>
          ) : (
            <p>Rate: ${rate.toFixed(0)} / m²</p>
          )}

          <hr />

          <p>
            Area: <strong>{area.toFixed(2)} m²</strong>
          </p>
          <p>
            Estimate: <strong>${total.toFixed(2)}</strong>
          </p>
        </div>
      </div>
    </main>
  );
}
