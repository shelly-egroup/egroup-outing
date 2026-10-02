type Props = { tag?: string; className?: string; title?: boolean };

// Outer cyan outline, black outline with drop, gradient face: stacked copies so the face is never covered by a stroke.
function Layered({ text, className }: { text: string; className: string }) {
  return <span className={"logo-word " + className}>
    <span className="logo-halo">{text}</span>
    <span className="logo-edge">{text}</span>
    <span className="logo-face">{text}</span>
  </span>;
}

/** The show's lockup: chrome 揪, blue 是要, a bolt, pink 對決 and a black edition tag. */
export default function ShowLogo({ tag = "AUTUMN OUTING 2026", className = "", title = false }: Props) {
  const Root = title ? "h1" : "div";
  return <Root className={"show-logo " + className} aria-label="揪是要對決">
    <span className="logo-art" aria-hidden="true">
      <Layered text="揪" className="logo-jiu" />
      <span className="logo-line">
        <Layered text="是要" className="logo-blue" />
        <svg className="logo-bolt" viewBox="0 0 40 72"><path d="M25 2 3 41h15l-7 29 26-44H21l8-24z" /></svg>
        <Layered text="對決" className="logo-pink" />
      </span>
      {tag && <span className="logo-tag">{tag}</span>}
    </span>
  </Root>;
}
