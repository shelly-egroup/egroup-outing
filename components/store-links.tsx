import type { StoreInfo } from "@/lib/store-references";

function StoreIcon({ kind }: { kind: "map" | "website" | "facebook" | "line" }) {
  if (kind === "facebook") return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14.2 21v-8.2H17l.4-3.2h-3.2V7.5c0-.9.3-1.6 1.6-1.6h1.7V3.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H8v3.2h2.8V21z" /></svg>;
  // LINE glyph from Simple Icons: https://github.com/simple-icons/simple-icons/blob/develop/icons/line.svg
  if (kind === "line") return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === "map" ? <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></> : <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18M5 6.5h14M5 17.5h14" /></>}</svg>;
}

export default function StoreLinks({ store, compact = false }: { store: StoreInfo; compact?: boolean }) {
  const links = [
    { kind: "map" as const, label: "地圖", href: store.mapsUrl || "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(store.mapsQuery) },
    ...(store.website ? [{ kind: "website" as const, label: "官網", href: store.website }] : []),
    ...(store.facebook ? [{ kind: "facebook" as const, label: "Facebook", href: store.facebook }] : []),
    ...(store.line ? [{ kind: "line" as const, label: "官方 LINE", href: store.line }] : []),
  ];
  return <nav className={"store-links" + (compact ? " store-links-compact" : "")} aria-label={store.name + "店家連結"}>
    {links.map(link => <a key={link.kind} className="store-link" title={link.label + "（另開分頁）"} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={store.name + "・" + link.label + "（另開分頁）"}>
      <span className="store-link-circle"><StoreIcon kind={link.kind} /></span>
    </a>)}
  </nav>;
}
