const V = "M18 14 52 106 98 14";
const S = "M196 14h-62l-12 46h58l-12 46h-66";

function Strokes() {
  return <><path pathLength={1} d={V} /><path pathLength={1} d={S} /></>;
}

/** The show's VS: the same slanted strokes the film draws in light, printed blue, pink, then ink. */
export default function VsMark({ className = "" }: { className?: string }) {
  return <svg className={"vs-mark " + className} viewBox="-18 -18 244 156" aria-hidden="true" focusable="false">
    <g transform="skewX(-14) translate(26 0)">
      <g className="vs-halo"><Strokes /></g>
      <g className="vs-blue" transform="translate(-8 -6)"><g className="vs-jit"><Strokes /></g></g>
      <g className="vs-pink" transform="translate(8 6)"><g className="vs-jit"><Strokes /></g></g>
      <g className="vs-ink"><Strokes /></g>
    </g>
  </svg>;
}
