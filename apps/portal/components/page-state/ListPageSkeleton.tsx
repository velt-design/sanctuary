import type { CSSProperties } from 'react';
import styles from './PageState.module.css';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function ListPageSkeleton({
  title,
  actionCount,
  filterFieldCount,
  columnCount,
  rowCount,
  filterTitle = 'Filters',
  listTitle = 'Items',
}: {
  title: string;
  actionCount: number;
  filterFieldCount: number;
  columnCount: number;
  rowCount: number;
  filterTitle?: string;
  listTitle?: string;
}) {
  return (
    <main className={styles.listPage} aria-label={`Loading ${title.toLowerCase()}`}>
      <div className={styles.listHeader}>
        <h1 className={styles.listTitle}>{title}</h1>
        <div className={styles.listActionRow}>
          {Array.from({ length: actionCount }).map((_, index) => (
            <div
              key={index}
              className={cx(styles.listActionPill, styles.skeletonShimmer, styles.skeletonBlock)}
            />
          ))}
        </div>
      </div>

      <section className={styles.section} aria-label={`${filterTitle} loading`}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{filterTitle}</h2>
        </div>
        <div
          className={styles.sectionBody}
          style={{
            gridTemplateColumns:
              filterFieldCount > 1 ? `repeat(${filterFieldCount}, minmax(0, 1fr))` : undefined,
          }}
        >
          <div className={styles.fieldGrid} style={{ gridTemplateColumns: `repeat(${Math.max(1, filterFieldCount)}, minmax(0, 1fr))` }}>
            {Array.from({ length: filterFieldCount }).map((_, index) => (
              <div key={index} className={styles.fieldBlock}>
                <div className={cx(styles.fieldLabel, styles.skeletonShimmer, styles.skeletonLine)} />
                <div className={cx(styles.fieldInput, styles.skeletonShimmer, styles.skeletonBlock)} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-label={`${listTitle} loading`}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{listTitle}</h2>
          <div className={cx(styles.sectionMeta, styles.skeletonShimmer, styles.skeletonLine)} />
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.tableShell}>
            <div className={styles.tableHead} style={{ '--table-columns': columnCount } as CSSProperties}>
              {Array.from({ length: columnCount }).map((_, index) => (
                <div
                  key={index}
                  className={cx(styles.tableHeadCell, styles.skeletonShimmer, styles.skeletonLine)}
                />
              ))}
            </div>
            <div className={styles.tableBody}>
              {Array.from({ length: rowCount }).map((_, rowIndex) => (
                <div
                  key={rowIndex}
                  className={styles.tableRow}
                  style={{ '--table-columns': columnCount } as CSSProperties}
                >
                  {Array.from({ length: columnCount }).map((_, cellIndex) => (
                    <div
                      key={cellIndex}
                      className={cx(
                        styles.tableCell,
                        styles.skeletonShimmer,
                        styles.skeletonLine,
                        cellIndex === 0 && styles.skeletonLineWide,
                        cellIndex > 0 && cellIndex < columnCount - 1 && styles.skeletonLineMedium,
                        cellIndex === columnCount - 1 && styles.skeletonLineShort,
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
