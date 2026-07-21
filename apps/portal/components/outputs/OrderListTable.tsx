'use client';

import styles from '@/components/ui/surface/PortalSurface.module.css';
import type { AcrylicLine, HardwareLine, PowdercoatLine } from '@/lib/outputs/types';

type PowdercoatProps = {
  kind: 'powdercoat';
  rows: PowdercoatLine[];
};

type AcrylicProps = {
  kind: 'acrylic';
  rows: AcrylicLine[];
};

type HardwareProps = {
  kind: 'hardware';
  rows: HardwareLine[];
};

type Props = (PowdercoatProps | AcrylicProps | HardwareProps) & { title: string };

export default function OrderListTable({ title, kind, rows }: Props) {
  return (
    <section className={styles.section} aria-label={title}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        <span className={styles.muted}>{rows.length} items</span>
      </div>
      <div className={styles.sectionBody}>
        {rows.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {kind === 'powdercoat' ? (
                    <>
                      <th>Profile</th>
                      <th>Colour</th>
                      <th>Stock length</th>
                      <th>Unit</th>
                      <th>Qty</th>
                      <th>Notes</th>
                    </>
                  ) : null}
                  {kind === 'acrylic' ? (
                    <>
                      <th>Item</th>
                      <th>Colour</th>
                      <th>Length</th>
                      <th>Unit</th>
                      <th>Qty</th>
                      <th>Notes</th>
                    </>
                  ) : null}
                  {kind === 'hardware' ? (
                    <>
                      <th>Item</th>
                      <th>Unit</th>
                      <th>Qty</th>
                      <th>Notes</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  if (kind === 'powdercoat') {
                    const r = row as PowdercoatLine;
                    return (
                      <tr key={`${r.profile}-${idx}`}>
                        <td>{r.profile}</td>
                        <td className={styles.muted}>{r.colour}</td>
                        <td className={styles.muted}>{r.stock_length_m}m</td>
                        <td className={styles.muted}>{r.unit}</td>
                        <td>{r.qty}</td>
                        <td className={styles.muted}>{r.notes ?? ''}</td>
                      </tr>
                    );
                  }
                  if (kind === 'acrylic') {
                    const r = row as AcrylicLine;
                    return (
                      <tr key={`${r.item}-${idx}`}>
                        <td>{r.item}</td>
                        <td className={styles.muted}>{r.colour ?? ''}</td>
                        <td className={styles.muted}>{typeof r.stock_length_m === 'number' ? `${r.stock_length_m}m` : ''}</td>
                        <td className={styles.muted}>{r.unit}</td>
                        <td>{r.qty}</td>
                        <td className={styles.muted}>{r.notes ?? ''}</td>
                      </tr>
                    );
                  }
                  const r = row as HardwareLine;
                  return (
                    <tr key={`${r.item}-${idx}`}>
                      <td>{r.item}</td>
                      <td className={styles.muted}>{r.unit}</td>
                      <td>{r.qty}</td>
                      <td className={styles.muted}>{r.notes ?? ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.note}>No items.</p>
        )}
      </div>
    </section>
  );
}
