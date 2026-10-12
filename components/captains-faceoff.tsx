"use client";
import { Fragment, useEffect, useState } from "react";
import { useInView } from "./use-in-view";

type Key = "red" | "blue";
type Side = { key: Key; src: string; title: string; en: string };
/** Each cut-out's size and where the face sits in it (left, top, right, bottom as fractions), for the recognition box. */
const CUT: Record<Key, { w: number; h: number; face: [number, number, number, number]; muzzle: [number, number] }> = {
  red: { w: 1218, h: 900, face: [.32, .08, .6, .56], muzzle: [.963, .479] },
  blue: { w: 1221, h: 900, face: [.44, .09, .68, .57], muzzle: [.03, .524] },
};

/**
 * The two team captains in a stand-off, like a fight-night poster: each on a half of the frame graded in the team colour,
 * the halves meeting on a diagonal laser seam, the two of them aiming at each other across it — their beams clash behind a
 * chrome VS slammed onto the seam — and a target lock snapping on to each face. On scroll-in the halves slide in and
 * collide; the pointer gives the scene a little parallax.
 */
export default function CaptainsFaceOff({ red, blue, backdrop, smoke }: { red: string; blue: string; backdrop: string; smoke: string }) {
  // plays every time it comes on screen
  const [ref, seen, round] = useInView<HTMLDivElement>("0px 0px -18% 0px"), [still, setStill] = useState(false);
  useEffect(() => { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setStill(true); }, []);
  // the recognition box sits on the face wherever the layout puts the cut-out
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const place = () => {
      const muzzles: Partial<Record<Key, [number, number]>> = {};
      for (const side of el.querySelectorAll<HTMLElement>(".fo-side")) {
        const key = side.dataset.side as Key, img = side.querySelector<HTMLElement>(".fo-cut"), lock = side.querySelector<HTMLElement>(".fo-lock");
        if (!img || !lock) continue;
        const [l, t, r, b] = CUT[key].face, [mx, my] = CUT[key].muzzle, x = img.offsetLeft, y = img.offsetTop, w = img.offsetWidth, h = img.offsetHeight;
        Object.assign(lock.style, { left: x + l * w + "px", top: y + t * h + "px", width: (r - l) * w + "px", height: (b - t) * h + "px" });
        muzzles[key] = [side.offsetLeft + x + mx * w, side.offsetTop + y + my * h];
      }
      // the beams run from each muzzle to the clash point on the seam
      const { red: a, blue: b } = muzzles;
      if (!a || !b) return;
      const cx = el.clientWidth / 2, cy = (a[1] + b[1]) / 2;
      el.style.setProperty("--clash-y", cy + "px");
      for (const [key, [mx, my]] of [["red", a], ["blue", b]] as const) {
        const beam = el.querySelector<HTMLElement>(".fo-beam.is-" + key); if (!beam) continue;
        const dx = cx - mx, dy = cy - my;
        Object.assign(beam.style, { left: mx + "px", top: my - 1.5 + "px", width: Math.max(0, Math.hypot(dx, dy)) + "px", rotate: Math.atan2(dy, dx) + "rad" });
      }
    };
    place();
    const ro = new ResizeObserver(place); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // parallax: the captains lean with the pointer, the VS against it
  useEffect(() => {
    const el = ref.current; if (!el || still || !window.matchMedia("(hover: hover)").matches) return;
    let frame = 0, x = 0, y = 0;
    const apply = () => { frame = 0; el.style.setProperty("--px", x.toFixed(3)); el.style.setProperty("--py", y.toFixed(3)); };
    const move = (event: PointerEvent) => { const r = el.getBoundingClientRect(); x = (event.clientX - r.left) / r.width - .5; y = (event.clientY - r.top) / r.height - .5; if (!frame) frame = requestAnimationFrame(apply); };
    const leave = () => { x = 0; y = 0; if (!frame) frame = requestAnimationFrame(apply); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); cancelAnimationFrame(frame); };
  }, [still]);
  const sides: Side[] = [
    { key: "red", src: red, title: "紅不讓隊長", en: "RED TEAM LEAD" },
    { key: "blue", src: blue, title: "刀槍Blue隊長", en: "BLUE TEAM LEAD" },
  ];
  return <div ref={ref} className="faceoff" data-seen={seen} role="group" aria-label="紅不讓隊長對決刀槍Blue隊長" style={{ "--backdrop": `url(${backdrop})` } as React.CSSProperties}><Fragment key={round}>
    {sides.map(side => <figure key={side.key} className={"fo-side is-" + side.key} data-side={side.key}>
      <i className="fo-bg" aria-hidden="true" />
      <img className="fo-cut" src={side.src} width={CUT[side.key].w} height={CUT[side.key].h} loading="lazy" decoding="async" alt={side.title + "舉著雷射槍瞄準對手"} />
      <span className="fo-lock" aria-hidden="true"><i /><i /><i /><i /></span>
      <i className="fo-scan" aria-hidden="true" />
      <figcaption className="fo-id">
        <span className="fo-en">{side.en}</span>
        <strong>{side.title}</strong>
      </figcaption>
    </figure>)}
    <img className="fo-smoke" src={smoke} alt="" aria-hidden="true" loading="lazy" decoding="async" />
    <i className="fo-seam" aria-hidden="true" />
    <i className="fo-beam is-red" aria-hidden="true" /><i className="fo-beam is-blue" aria-hidden="true" /><i className="fo-clash" aria-hidden="true" />
    <div className="fo-vs" aria-hidden="true"><span className="fo-v">V</span><span className="fo-s">S</span><i className="fo-slash" /></div>
    <i className="fo-flash" aria-hidden="true" />
  </Fragment></div>;
}
