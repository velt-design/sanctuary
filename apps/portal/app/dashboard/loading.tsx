import dash from './dashboard.module.css';
import skeleton from '@/components/page-state/PageState.module.css';

function SkeletonLine({ widthClass }: { widthClass: string }) {
  return <div className={`${dash.skeletonLine} ${skeleton.skeletonShimmer} ${widthClass}`} />;
}

export default function DashboardLoading() {
  return (
    <main className={dash.page} aria-label="Loading dashboard">
      <div className={`${dash.skeletonCard} ${skeleton.skeletonBlock}`}>
        <SkeletonLine widthClass={skeleton.skeletonLineMedium} />
        <SkeletonLine widthClass={skeleton.skeletonLineShort} />
      </div>

      <div className={dash.layout}>
        <div className={dash.kpiStrip}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className={`${dash.skeletonTile} ${skeleton.skeletonBlock}`}>
              <SkeletonLine widthClass={skeleton.skeletonLineShort} />
              <SkeletonLine widthClass={skeleton.skeletonLineMedium} />
            </div>
          ))}
        </div>

        <div className={dash.grid}>
          <div className={dash.columnStack}>
            <div className={`${dash.skeletonCard} ${skeleton.skeletonBlock}`}>
              <SkeletonLine widthClass={skeleton.skeletonLineWide} />
              <div className={`${dash.skeletonRow} ${skeleton.skeletonShimmer}`} />
              <div className={`${dash.skeletonRow} ${skeleton.skeletonShimmer}`} />
              <div className={`${dash.skeletonRow} ${skeleton.skeletonShimmer}`} />
            </div>

            <div className={`${dash.skeletonCard} ${skeleton.skeletonBlock}`}>
              <SkeletonLine widthClass={skeleton.skeletonLineWide} />
              <div className={`${dash.skeletonRow} ${skeleton.skeletonShimmer}`} />
              <div className={`${dash.skeletonRow} ${skeleton.skeletonShimmer}`} />
              <div className={`${dash.skeletonRow} ${skeleton.skeletonShimmer}`} />
            </div>
          </div>

          <div className={dash.columnStack}>
            <div className={`${dash.skeletonCard} ${skeleton.skeletonBlock}`}>
              <SkeletonLine widthClass={skeleton.skeletonLineWide} />
              <div className={`${dash.skeletonRow} ${skeleton.skeletonShimmer}`} />
              <div className={`${dash.skeletonRow} ${skeleton.skeletonShimmer}`} />
            </div>

            <div className={`${dash.skeletonCard} ${skeleton.skeletonBlock}`}>
              <SkeletonLine widthClass={skeleton.skeletonLineWide} />
              <div className={`${dash.skeletonRow} ${skeleton.skeletonShimmer}`} />
              <div className={`${dash.skeletonRow} ${skeleton.skeletonShimmer}`} />
            </div>
          </div>
        </div>

        <div className={`${dash.skeletonCard} ${skeleton.skeletonBlock}`}>
          <SkeletonLine widthClass={skeleton.skeletonLineMedium} />
          <div className={dash.kpiStrip}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className={`${dash.skeletonTile} ${skeleton.skeletonBlock} ${skeleton.skeletonShimmer}`}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
