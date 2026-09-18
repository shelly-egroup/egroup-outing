export default function LoadingIndicator({ label = "載入中", compact = false }: {label?: string; compact?: boolean}) {
  return <span className={"loading-indicator" + (compact ? " loading-compact" : "")} role="status">
    <span className="loading-blocks" aria-hidden="true"><i /><i /><i /></span>
    <span>{label}<span className="loading-ellipsis" aria-hidden="true">…</span></span>
  </span>;
}
