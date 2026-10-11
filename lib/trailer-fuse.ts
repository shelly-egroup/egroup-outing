import T from "./opening-timeline.json";

/** The picture area between the letterbox bars, in CSS pixels, plus the viewport. */
export type FilmRect = { x: number; y: number; w: number; h: number; vw: number; vh: number };
type Spark = { x: number; y: number; dx: number; dy: number };

/** Height of the line the fuse burns along in the first mission shot (fraction of the picture). Matches .tr-wire. */
export const WIRE_Y = 0.3;
const EMBER = "#ffb04a";
const HERO_FIELD: [number, string][] = [[0, "#1029b8"], [0.32, "#2330c8"], [0.52, "#8a1a9e"], [0.7, "#cc0058"], [1, "#d1005a"]];
const HARMONICS = [[2, 0.05, 0.4, 1.3], [3, 0.06, 2.1, -2.2], [5, 0.035, 4.0, 3.1], [7, 0.03, 1.2, -4.4], [11, 0.022, 5.3, 5.2], [17, 0.014, 0.7, -6.8], [29, 0.009, 3.3, 8.1], [43, 0.006, 2.6, -9.5]];
const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp = (x: number) => Math.min(1, Math.max(0, x));
// Deterministic per-particle randomness, so a frame drawn at time t is identical however it is reached.
const hash = (k: number, salt: number) => { const v = Math.sin(k * 127.1 + salt * 311.7) * 43758.5453; return v - Math.floor(v); };

/** Where the spark is at time t: across the frame on the wire, then along the bottom letterbox bar until the blackout. */
export function sparkAt(t: number, r: FilmRect): Spark | null {
  if (t >= T.ignite && t < T.mission) {
    const p = smooth(clamp((t - T.ignite) / (T.mission - T.ignite)));
    return { x: r.x + r.w * (0.05 + 1.01 * p), y: r.y + r.h * WIRE_Y, dx: 1, dy: 0 };
  }
  if (t >= T.mission && t < T.blackout) {
    const end = T.blackout - 0.06;
    const p = t < T.riser ? 0.8 * (t - T.mission) / (T.riser - T.mission) : 0.8 + 0.2 * Math.pow(clamp((t - T.riser) / (end - T.riser)), 1.7);
    const bar = r.vh - (r.y + r.h);
    const y = bar >= 14 ? r.y + r.h + bar / 2 : r.y + r.h - 10;
    return { x: r.vw * (0.035 + 0.93 * clamp(p)), y, dx: 1, dy: 0 };
  }
  return null;
}

function wire(g: CanvasRenderingContext2D, t: number, r: FilmRect, s: Spark, dpr: number) {
  const onBar = t >= T.mission;
  const x0 = onBar ? r.vw * 0.035 : r.x - 20, x1 = onBar ? r.vw * 0.965 : r.x + r.w + 20;
  g.lineCap = "round";
  // unburnt cord ahead of the spark
  g.strokeStyle = "rgba(196, 186, 170, .55)"; g.lineWidth = 1.6 * dpr;
  g.beginPath(); g.moveTo(s.x * dpr, s.y * dpr); g.lineTo(x1 * dpr, s.y * dpr); g.stroke();
  // burnt trail: a glowing ember just behind the spark that cools to ash
  const trail = Math.min(s.x - x0, 160);
  const grad = g.createLinearGradient((s.x - trail) * dpr, 0, s.x * dpr, 0);
  grad.addColorStop(0, "rgba(40, 34, 30, 0)"); grad.addColorStop(0.7, "rgba(120, 60, 30, .5)"); grad.addColorStop(1, "rgba(255, 150, 60, .95)");
  g.strokeStyle = grad; g.lineWidth = 1.4 * dpr;
  g.beginPath(); g.moveTo((s.x - trail) * dpr, s.y * dpr); g.lineTo(s.x * dpr, s.y * dpr); g.stroke();
}

function spark(g: CanvasRenderingContext2D, t: number, r: FilmRect, s: Spark, dpr: number, big: number) {
  // flying sparks: emitted at a fixed rate from wherever the spark was, each on its own ballistic arc
  const rate = 150, life = 0.42, first = Math.floor((t - life) * rate), last = Math.floor(t * rate);
  g.globalCompositeOperation = "lighter";
  for (let k = first; k <= last; k++) {
    const te = k / rate, age = t - te;
    if (age < 0 || age > life * (0.45 + 0.55 * hash(k, 1))) continue;
    const from = sparkAt(te, r); if (!from) continue;
    const ang = -Math.PI / 2 + (hash(k, 2) - 0.62) * 2.6, speed = (90 + 420 * hash(k, 3)) * big;
    const vx = Math.cos(ang) * speed - 40, vy = Math.sin(ang) * speed;
    const px = from.x + vx * age, py = from.y + vy * age + 520 * age * age;
    const qx = from.x + vx * (age - 0.016), qy = from.y + vy * (age - 0.016) + 520 * (age - 0.016) ** 2;
    const heat = 1 - age / life;
    g.strokeStyle = `rgba(255, ${Math.round(140 + 115 * heat)}, ${Math.round(60 + 160 * heat * heat)}, ${0.35 + 0.65 * heat})`;
    g.lineWidth = (0.8 + 1.1 * heat) * dpr;
    g.beginPath(); g.moveTo(qx * dpr, qy * dpr); g.lineTo(px * dpr, py * dpr); g.stroke();
  }
  // the burning head: flickering glow and a white-hot core
  const flicker = 0.82 + 0.18 * Math.sin(t * 91) * Math.sin(t * 37 + 1.3);
  const glow = g.createRadialGradient(s.x * dpr, s.y * dpr, 0, s.x * dpr, s.y * dpr, 34 * big * flicker * dpr);
  glow.addColorStop(0, "rgba(255, 236, 200, .95)"); glow.addColorStop(0.18, "rgba(255, 170, 70, .55)"); glow.addColorStop(1, "rgba(255, 90, 20, 0)");
  g.fillStyle = glow; g.beginPath(); g.arc(s.x * dpr, s.y * dpr, 34 * big * flicker * dpr, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#fff"; g.beginPath(); g.arc(s.x * dpr, s.y * dpr, 2.6 * big * dpr, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = "source-over";
  // smoke curling off the head: soft puffs that drift up, swell and thin out
  for (let k = Math.floor((t - 1.4) * 34); k <= Math.floor(t * 34); k++) {
    const te = k / 34, age = t - te; if (age < 0 || age > 1.4) continue;
    const from = sparkAt(te, r); if (!from) continue;
    const life = age / 1.4, sway = Math.sin(k * 1.7 + age * 2.4) * 16 * age;
    const px = from.x - 14 * age + sway, py = from.y - (46 + 30 * hash(k, 5)) * age * big, rad = (6 + 34 * life) * big * dpr;
    const puff = g.createRadialGradient(px * dpr, py * dpr, 0, px * dpr, py * dpr, rad);
    puff.addColorStop(0, `rgba(170, 160, 150, ${0.07 * (1 - life)})`); puff.addColorStop(1, "rgba(170, 160, 150, 0)");
    g.fillStyle = puff; g.beginPath(); g.arc(px * dpr, py * dpr, rad, 0, Math.PI * 2); g.fill();
  }
}

/** The self-destruct: a ragged hole burns out from the centre with an ember rim and leaves the hero's own blue-to-pink
    field behind, so the page opens on exactly what the last frame shows. */
function burn(g: CanvasRenderingContext2D, t: number, r: FilmRect, dpr: number) {
  const p = clamp((t - T.burn) / 0.78), cx = r.vw / 2, cy = r.vh / 2;
  const R = Math.hypot(r.vw, r.vh) * 0.62 * smooth(p) * 1.15;
  if (R <= 0) return;
  // a ragged rim: many uneven harmonics so it reads as paper burning, not a cartoon splat
  const edge = (a: number) => R * (1 + HARMONICS.reduce((sum, [k, amp, phase, speed]) => sum + amp * Math.sin(k * a + phase + t * speed), 0));
  const path = (scale: number) => { g.beginPath(); for (let i = 0; i <= 240; i++) { const a = (i / 240) * Math.PI * 2, e = edge(a) * scale; const x = cx + Math.cos(a) * e, y = cy + Math.sin(a) * e; if (i) g.lineTo(x * dpr, y * dpr); else g.moveTo(x * dpr, y * dpr); } g.closePath(); };
  g.fillStyle = "rgba(20, 12, 8, .85)"; path(1.06); g.fill();
  g.save(); g.shadowColor = "rgba(255, 110, 20, .9)"; g.shadowBlur = 26 * dpr; g.strokeStyle = EMBER; g.lineWidth = 5 * dpr; path(1.015); g.stroke(); g.restore();
  // matches .show-hero's background (linear-gradient(100deg, …)) across the viewport
  const angle = (100 - 90) * Math.PI / 180, half = (r.vw * Math.cos(angle) + r.vh * Math.sin(angle)) / 2;
  const field = g.createLinearGradient((cx - Math.cos(angle) * half) * dpr, (cy - Math.sin(angle) * half) * dpr, (cx + Math.cos(angle) * half) * dpr, (cy + Math.sin(angle) * half) * dpr);
  for (const [at, color] of HERO_FIELD) field.addColorStop(at, color);
  g.fillStyle = field; path(1); g.fill();
}

/** Draw everything the canvas owns at time t (nothing outside the mission and the burn). */
export function drawFuse(g: CanvasRenderingContext2D, t: number, r: FilmRect, dpr: number) {
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  const s = sparkAt(t, r);
  if (s) {
    wire(g, t, r, s, dpr);
    // the strike flares up for a quarter second before settling into a steady burn
    const flare = Math.max(0, 1 - (t - T.ignite) / 0.25);
    spark(g, t, r, s, dpr, t < T.mission ? 1.25 + 1.6 * flare * flare : t >= T.riser ? 1.15 : 0.8);
  }
  if (t >= T.burn) burn(g, t, r, dpr);
}
