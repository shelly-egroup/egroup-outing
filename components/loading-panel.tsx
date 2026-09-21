export default function LoadingPanel({ label = "對決準備中", description }: { label?: string; description?: string }) {
  return <div className="loading-panel" role="status" aria-atomic="true">
    <div className="loading-duel" aria-hidden="true">
      <span className="loading-player loading-player-a">A</span>
      <span className="loading-player loading-player-b">B</span>
      <b>VS</b>
    </div>
    <div className="loading-panel-copy">
      <span className="loading-kicker" aria-hidden="true">GETTING READY</span>
      <strong>{label}<span aria-hidden="true">…</span></strong>
      {description && <p>{description}</p>}
      <span className="loading-meter" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></span>
    </div>
  </div>;
}
