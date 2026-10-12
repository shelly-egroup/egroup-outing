/** A loading state for a whole panel: a turning scope, what is being prepared, and a sweeping hairline. */
export default function LoadingPanel({ label = "準備中", description }: { label?: string; description?: string }) {
  return <div className="loading-panel" role="status" aria-atomic="true">
    <span className="loading-scope" aria-hidden="true"><i /><b /></span>
    <div className="loading-panel-copy">
      <span className="loading-kicker" aria-hidden="true">STANDBY</span>
      <strong>{label}<span aria-hidden="true">…</span></strong>
      {description && <p>{description}</p>}
      <span className="loading-meter" aria-hidden="true"><i /></span>
    </div>
  </div>;
}
