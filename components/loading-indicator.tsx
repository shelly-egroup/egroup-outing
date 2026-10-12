/** A small reticle that turns while something loads; drawn in the current text colour, so it sits on any surface. */
function LoadingReticle() {
  return <span className="loading-reticle" aria-hidden="true"><i /></span>;
}

export default function LoadingIndicator({ label = "載入中", compact = false }: { label?: string; compact?: boolean }) {
  return <span className={"loading-indicator" + (compact ? " loading-compact" : "")} role="status" aria-atomic="true">
    <LoadingReticle />
    <span>{label}<span className="loading-ellipsis" aria-hidden="true">…</span></span>
  </span>;
}
