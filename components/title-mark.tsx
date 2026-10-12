/** The film's title as the site's mark: 秋遊特務 in brushed chrome, with an optional English line beneath. */
export default function TitleMark({ className = "", sub }: { className?: string; sub?: string }) {
  return <div className={"title-mark " + className} role="img" aria-label="秋遊特務">
    <span className="tm-word" aria-hidden="true"><span className="tm-face">秋遊特務</span><span className="tm-sheen">秋遊特務</span></span>
    {sub && <span className="tm-sub" aria-hidden="true">{sub}</span>}
  </div>;
}
