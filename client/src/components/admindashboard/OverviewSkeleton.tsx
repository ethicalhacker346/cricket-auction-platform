export function OverviewSkeleton() {
  return (
    <div className="skeleton-dashboard" aria-label="Loading dashboard">
      <div className="skeleton-hero" />
      <div className="skeleton-kpis">{[1, 2, 3, 4].map((item) => <div className="skeleton-block" key={item} />)}</div>
      <div className="skeleton-main"><div className="skeleton-block large" /><div className="skeleton-block side" /></div>
    </div>
  );
}
