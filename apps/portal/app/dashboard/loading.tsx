import dash from './dashboard.module.css';

function SkeletonLine({ widthClass }: { widthClass: string }) {
  return <div className={`${dash.skeletonLine} ${widthClass}`} />;
}

export default function DashboardLoading() {
  return (
    <main className={`${dash.page} ${dash.stack}`} aria-label="Loading dashboard">
      <div className={dash.skeletonCard}>
        <SkeletonLine widthClass={dash.skeletonLineMedium} />
        <SkeletonLine widthClass={dash.skeletonLineShort} />
      </div>

      <div className={dash.kpiStrip}>
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className={dash.skeletonTile}>
            <SkeletonLine widthClass={dash.skeletonLineShort} />
            <SkeletonLine widthClass={dash.skeletonLineMedium} />
          </div>
        ))}
      </div>

      <div className={dash.grid}>
        <div className={dash.stack}>
          <div className={dash.skeletonCard}>
            <SkeletonLine widthClass={dash.skeletonLineWide} />
            <div className={dash.skeletonRow} />
            <div className={dash.skeletonRow} />
            <div className={dash.skeletonRow} />
          </div>

          <div className={dash.skeletonCard}>
            <SkeletonLine widthClass={dash.skeletonLineWide} />
            <div className={dash.skeletonRow} />
            <div className={dash.skeletonRow} />
            <div className={dash.skeletonRow} />
          </div>
        </div>

        <div className={dash.stack}>
          <div className={dash.skeletonCard}>
            <SkeletonLine widthClass={dash.skeletonLineWide} />
            <div className={dash.skeletonRow} />
            <div className={dash.skeletonRow} />
          </div>

          <div className={dash.skeletonCard}>
            <SkeletonLine widthClass={dash.skeletonLineWide} />
            <div className={dash.skeletonRow} />
            <div className={dash.skeletonRow} />
          </div>
        </div>
      </div>

      <div className={dash.skeletonCard}>
        <SkeletonLine widthClass={dash.skeletonLineMedium} />
        <div className={dash.kpiStrip}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className={dash.skeletonTile} />
          ))}
        </div>
      </div>
    </main>
  );
}
