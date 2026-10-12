// 秋遊特務 — trailer composition. Pure function of time: FILM.seek(t) poses every layer for t (seconds), so the renderer can
// sample sub-frames for motion blur. Layout follows ?ar=16x9 (2.39:1 picture between bars) or ?ar=9x16 (full frame).
const q = new URLSearchParams(location.search);
const AR = q.get("ar") === "9x16" ? "9x16" : "16x9";
const TALL = AR === "9x16";
document.documentElement.dataset.ar = AR;
const T = await (await fetch("../timeline.json")).json();
const { MARK_GLYPHS, MARK_AGENT, MARK_AGENT_AIM, MARK_DOT, MARK_MUZZLE, MARK_MUZZLE_UP } = await import("./mark-paths.js");
const A = (n) => "assets/" + n;

const stage = document.getElementById("stage"), pic = document.querySelector(".pic"), cam = document.querySelector(".cam"), flashEl = document.querySelector(".flash");
const canvas = document.querySelector(".fx"), g = canvas.getContext("2d");
const SW = stage.clientWidth, SH = stage.clientHeight, PW = pic.clientWidth, PH = pic.clientHeight, PY = (SH - PH) / 2;
canvas.width = SW; canvas.height = SH;
const cqh = PH / 100, cqw = PW / 100;

// ── maths ──
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const E = {
  lin: (x) => x, inQ: (x) => x * x, outQ: (x) => 1 - (1 - x) ** 2, ioQ: (x) => (x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
  inC: (x) => x ** 3, outC: (x) => 1 - (1 - x) ** 3, ioC: (x) => (x < .5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  outE: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)), inE: (x) => (x <= 0 ? 0 : 2 ** (10 * x - 10)),
  ioE: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2),
  outBack: (x) => 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2,
};
const p = (t, a, b, e = E.lin) => e(clamp01((t - a) / (b - a)));
const mix = (a, b, x) => a + (b - a) * x;
/** keyframes: [[time, value, easeToNext], ...]; values may be numbers or arrays */
function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0, e = E.ioC] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) { const x = e((t - t0) / (t1 - t0)); return Array.isArray(v0) ? v0.map((v, j) => mix(v, v1[j], x)) : mix(v0, v1, x); }
  }
  return keys[keys.length - 1][1];
}
const hash = (k, s) => { const v = Math.sin(k * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const noise1 = (x, s = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return mix(hash(i, s), hash(i + 1, s), u) * 2 - 1; };

// ── DOM helpers ──
const $ = (tag, cls, parent, props) => { const e = document.createElement(tag); if (cls) e.className = cls; if (props) Object.assign(e, props); if (parent) parent.appendChild(e); return e; };
const img = (src, cls, parent) => $("img", cls, parent, { src, draggable: false, decoding: "sync" });
const css = (e, o) => { for (const k in o) e.style[k] = o[k]; };
const tf = (e, s) => { e.style.transform = s; };
const op = (e, v) => { e.style.opacity = Math.max(0, Math.min(1, v)).toFixed(4); };
const picBox = () => pic.getBoundingClientRect();

const shots = [];
function shot(a, b, build) { const el = $("div", "shot", cam); const s = { a, b, el }; s.update = build(el, s); shots.push(s); return s; }

// ── global camera shake and flashes ──
const shakes = [], flashes = [];
let shakeXY = [0, 0];
const hit = (t, amp = 1, decay = .22, flash = 0, color = "#fff") => { shakes.push([t, amp, decay]); if (flash) flashes.push([t, flash, color]); };
function camera(t) {
  let x = 0, y = 0, r = 0;
  for (const [t0, amp, dec] of shakes) {
    const l = t - t0; if (l < 0 || l > dec * 5) continue;
    const k = amp * Math.exp(-l / dec);
    x += k * 1.3 * cqh * noise1(l * 15, t0 * 3); y += k * 1.0 * cqh * noise1(l * 17, t0 * 7 + 1); r += k * .3 * noise1(l * 13, t0 * 5 + 2);
  }
  tf(cam, `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${r.toFixed(3)}deg)`); shakeXY = [x, y];
  let f = 0, col = "#fff";
  for (const [t0, peak, c] of flashes) { const l = t - t0; if (l < 0 || l > .35) continue; const v = peak * Math.exp(-l / .055); if (v > f) { f = v; col = c; } }
  flashEl.style.background = col; op(flashEl, f);
}

// ── canvas fx (stage coordinates; picture y is offset by PY) ──
const sparkBursts = [];
function streak(x1, y1, x2, y2, heat, w, hue) {
  g.strokeStyle = hue === "blue" ? `rgba(${Math.round(150 + 105 * heat)},${Math.round(190 + 65 * heat)},255,${heat.toFixed(3)})` : `rgba(255,${Math.round(120 + 135 * heat)},${Math.round(60 + 160 * heat * heat)},${(.3 + .7 * heat).toFixed(3)})`;
  g.lineWidth = w; g.beginPath(); g.moveTo(x2, y2); g.lineTo(x1, y1); g.stroke();
}
function drawSparks(t) {
  g.globalCompositeOperation = "lighter";
  for (const [t0, x0, y0, n, power, hue, dir, spread] of sparkBursts) {
    const l = t - t0; if (l < 0 || l > 1.2) continue;
    for (let k = 0; k < n; k++) {
      const life = .35 + .8 * hash(k, t0); if (l > life) continue;
      const ang = dir == null ? hash(k, t0 + 1) * Math.PI * 2 : dir + (hash(k, t0 + 1) - .5) * spread, sp = (.2 + hash(k, t0 + 2)) * power * cqh;
      const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp - power * .3 * cqh;
      const P = (u) => [x0 + vx * u, PY + y0 + vy * u + 60 * cqh * u * u], [x1, y1] = P(l), [x2, y2] = P(Math.max(0, l - .03));
      streak(x1, y1, x2, y2, 1 - l / life, .18 * cqh * (.5 + (1 - l / life)), hue);
    }
  }
  g.globalCompositeOperation = "source-over";
}
function embers(t, a, b, count, alpha = .8) {
  if (t < a || t > b) return;
  g.globalCompositeOperation = "lighter";
  for (let k = 0; k < count; k++) {
    const sx = hash(k, 3) * PW, life = 3 + 3 * hash(k, 5);
    const l = ((t - a) + hash(k, 6) * life) % life, x = sx + noise1(l * .6 + k, 9) * 4 * cqh, y = PY + PH * (1.05 - l / life * 1.1);
    const fade = Math.sin(Math.PI * l / life) * alpha * (.4 + .6 * hash(k, 7)), r = (.12 + .25 * hash(k, 8)) * cqh * 4;
    const grad = g.createRadialGradient(x, y, 0, x, y, r); grad.addColorStop(0, `rgba(255,200,150,${fade.toFixed(3)})`); grad.addColorStop(1, "rgba(255,80,40,0)");
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = "source-over";
}
/** a burning fuse head at (x, y) in stage coordinates, emitting sparks from where it has been (pos(te)) */
function fuseHead(t, t0, pos, size = 1, rate = 170) {
  const [x, y] = pos(t);
  g.globalCompositeOperation = "lighter";
  const life = .42;
  for (let k = Math.floor((t - life) * rate); k <= Math.floor(t * rate); k++) {
    const te = k / rate, age = t - te; if (age < 0 || te < t0 || age > life * (.45 + .55 * hash(k, 1))) continue;
    const [fx, fy] = pos(te), ang = -Math.PI / 2 + (hash(k, 2) - .62) * 2.6, sp = (12 + 55 * hash(k, 3)) * cqh * size;
    const vx = Math.cos(ang) * sp - 5 * cqh, vy = Math.sin(ang) * sp;
    const P = (u) => [fx + vx * u, fy + vy * u + 70 * cqh * u * u], [x1, y1] = P(age), [x2, y2] = P(Math.max(0, age - .016));
    streak(x1, y1, x2, y2, 1 - age / life, (.1 + .14 * (1 - age / life)) * cqh * size);
  }
  const flick = .82 + .18 * Math.sin(t * 91) * Math.sin(t * 37 + 1.3), R = 5 * cqh * size * flick;
  const glow = g.createRadialGradient(x, y, 0, x, y, R); glow.addColorStop(0, "rgba(255,240,210,.95)"); glow.addColorStop(.07, "rgba(255,200,120,.7)"); glow.addColorStop(.22, "rgba(255,150,60,.28)"); glow.addColorStop(.5, "rgba(255,110,30,.08)"); glow.addColorStop(1, "rgba(255,90,20,0)");
  g.fillStyle = glow; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y, .38 * cqh * size, 0, Math.PI * 2); g.fill();
  const st = g.createLinearGradient(x - 30 * cqh, 0, x + 30 * cqh, 0); st.addColorStop(0, "rgba(255,150,60,0)"); st.addColorStop(.5, `rgba(255,220,170,${(.35 * flick).toFixed(3)})`); st.addColorStop(1, "rgba(255,150,60,0)");
  g.fillStyle = st; g.fillRect(x - 30 * cqh, y - .15 * cqh, 60 * cqh, .3 * cqh);
  g.globalCompositeOperation = "source-over";
}
function cord(x0, x1, y, burnt) {
  g.lineCap = "round";
  g.strokeStyle = "rgba(196,186,170,.5)"; g.lineWidth = .22 * cqh; g.beginPath(); g.moveTo(x1, y); g.lineTo(burnt[1], y); g.stroke();
  const trail = Math.min(burnt[1] - x0, 22 * cqh), grad = g.createLinearGradient(burnt[1] - trail, 0, burnt[1], 0);
  grad.addColorStop(0, "rgba(40,34,30,0)"); grad.addColorStop(.7, "rgba(140,60,30,.6)"); grad.addColorStop(1, "rgba(255,160,70,1)");
  g.strokeStyle = grad; g.lineWidth = .2 * cqh; g.beginPath(); g.moveTo(burnt[1] - trail, y); g.lineTo(burnt[1], y); g.stroke();
}
const WIRE_Y = .3;   // the face-off wire of the last Bond card
const WIRE_TO = TALL ? .58 : .56;   // where the wire's two burning ends meet
const LEAN = .22;                    // how far the camera leans in on the burning wire
/** how much of the wire has burnt: from 007's last accent to the Mission's bass, quickening as the ends close in */
const burnAt = (t) => { const x = clamp01((t - T.button) / (T.catch - T.button)); return mix(x, x * x, .55); };
// Fuse 2: from the first montage cut to the white-out, a fuse burns along the bottom bar (in frame on 9:16)
const BAR_Y = TALL ? SH * .955 : SH - PY / 2, M0 = T.montage[0].t;
const fuse2 = (t) => { const u = clamp01((t - M0) / (T.title - .02 - M0)); return [SW * (.03 + .94 * (u < .8 ? u * .82 / .8 : .82 + .18 * ((u - .8) / .2) ** 1.5)), BAR_Y]; };
function drawFuses(t) {
  drawFuseRun(t);
  if (t >= M0 && t < T.title) { const [x, y] = fuse2(t); cord(SW * .03, SW * .97, y, [SW * .03, x]); fuseHead(t, M0, fuse2, TALL ? .7 : .55, 120); }
}

// ── reusable bits ──
function plate(parent, src, pos) { const i = img(src, "plate", parent); if (pos) i.style.objectPosition = pos; return i; }
/** a mission super: label, then the line typed character by character, MI style */
function caption(parent, en, cn) {
  const c = $("div", "caption", parent); $("i", "", c); const b = $("b", "", c, { textContent: en }), line = $("span", "txt", c);
  const chars = [...cn].map((ch) => $("span", "", line, { textContent: ch })); const cur = $("span", "cur", line);
  return (t, t0) => {
    op(c, p(t, t0, t0 + .05)); b.style.opacity = p(t, t0, t0 + .08).toFixed(3);
    const n = Math.floor(clamp01((t - t0 - .05) / .3) * chars.length + .0001);
    chars.forEach((ch, i) => { ch.style.display = i < n ? "inline" : "none"; });
    cur.style.opacity = (t - t0 < .4 || Math.floor((t - t0) / .12) % 2) ? "1" : "0";
  };
}
function reveal(e, t, a, dur = .45, dy = 2) { const x = p(t, a, a + dur, E.outE); op(e, x); e.style.translate = `0 ${((1 - x) * dy * cqh).toFixed(2)}px`; e.style.filter = x < 1 ? `blur(${((1 - x) * .8 * cqh).toFixed(2)}px)` : "none"; }
function beam(parent, cls = "") { return $("i", "beam " + cls, parent); }
function fire(e, t, t0, x, y, ang, len, dur = .26) {
  const l = t - t0; if (l < 0 || l > dur) { op(e, 0); return; }
  const grow = E.outE(clamp01(l / .05)), fade = 1 - p(l, .06, dur, E.inQ);
  css(e, { left: x + "px", top: y + "px", width: len + "px" });
  tf(e, `rotate(${ang}deg) scaleX(${grow.toFixed(3)}) scaleY(${(1 + 1.2 * (1 - fade)).toFixed(2)})`); op(e, fade);
}
function bloomAt(e, t, t0, x, y, size = 1, dur = .2) { const l = t - t0; if (l < 0 || l > dur) { op(e, 0); return; } const s = size * (.6 + .9 * E.outE(l / dur)); css(e, { left: x + "px", top: y + "px" }); tf(e, `scale(${s.toFixed(3)})`); op(e, 1 - E.inQ(l / dur)); }
/** the burn wipe: a ragged burning edge crosses the frame left to right and leaves the new shot behind it */
const burns = [];
function burnWipe(el, t, t0, dur) {
  const x = p(t, t0, t0 + dur, E.ioC) * 112 - 6;
  if (t >= t0 + dur) { el.style.clipPath = "none"; return; }
  const pts = []; for (let i = 0; i <= 24; i++) { const y = i / 24 * 100; pts.push(`${(x + 3.2 * noise1(i * .9 + t0, 4) + 1.4 * noise1(i * 3.1, 5)).toFixed(2)}% ${y.toFixed(1)}%`); }
  el.style.clipPath = `polygon(0 0, ${pts.join(", ")}, 0 100%)`;
}
/** the opposite of burnWipe: a ragged burning edge crosses left to right and leaves only black behind it */
function burnAway(el, t, t0, dur) {
  if (t < t0) { el.style.clipPath = "none"; return; }
  const x = p(t, t0, t0 + dur, E.ioC) * 112 - 6;
  const pts = []; for (let i = 0; i <= 24; i++) { const y = i / 24 * 100; pts.push(`${(x + 3.2 * noise1(i * .9 + t0, 4) + 1.4 * noise1(i * 3.1, 5)).toFixed(2)}% ${y.toFixed(1)}%`); }
  el.style.clipPath = `polygon(${pts.join(", ")}, 100% 100%, 100% 0)`;
}
function drawBurns(t) {
  for (const [t0, dur] of burns) {
    if (t < t0 || t > t0 + dur + .2) continue;
    const x = p(t, t0, t0 + dur, E.ioC) * 112 - 6, fade = 1 - p(t, t0 + dur, t0 + dur + .2);
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i <= 48; i++) {
      const v = i / 48, ex = (x + 3.2 * noise1(v * 24 * .9 / 1 + t0, 4) + 1.4 * noise1(v * 24 * 3.1, 5)) / 100 * PW, ey = PY + v * PH;
      const r = (1.2 + 2.2 * hash(i, t0)) * cqh, gl = g.createRadialGradient(ex, ey, 0, ex, ey, r);
      gl.addColorStop(0, `rgba(255,220,160,${(.85 * fade).toFixed(3)})`); gl.addColorStop(.4, `rgba(255,120,40,${(.45 * fade).toFixed(3)})`); gl.addColorStop(1, "rgba(255,60,10,0)");
      g.fillStyle = gl; g.beginPath(); g.arc(ex, ey, r, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = "source-over";
  }
}

// ════ ACT I — 007 ════
const DOTX = TALL ? [.12, .31, .5, .69, .88] : [.14, .32, .5, .68, .86];
shot(0, T.irisOpen + .25, (el) => {
  const dots = DOTX.map(() => $("i", "dot", el)), glints = DOTX.map(() => $("i", "flare white", el));
  return (t) => dots.forEach((d, k) => {
    const t0 = T.dots[k], x = p(t, t0, t0 + .16, E.outE), from = k ? DOTX[k - 1] : -.1;
    css(d, { left: (mix(from, DOTX[k], x) * 100) + "%", display: t >= t0 ? "block" : "none" });
    tf(d, `scaleX(${(1 + 1.6 * (1 - x)).toFixed(3)})`);
    const gl = glints[k], gx = p(t, t0 + .12, t0 + .45); css(gl, { left: DOTX[k] * 100 + "%", top: "50%", display: t >= t0 + .12 && t < t0 + .45 ? "block" : "none" }); op(gl, .5 * Math.sin(Math.PI * gx)); tf(gl, "scaleX(.35)");
    if (k < 4) op(d, 1 - p(t, T.irisOpen + .02, T.irisOpen + .22, E.inQ));
  });
});

const BARREL = { cx: .496, cy: .469, open: .145 };          // opening centre and radius in the barrel photo
const AIM_MUZZLE = [.128, .145];                             // red lens of the aiming cut-out
shot(T.irisOpen, T.titles[0], (el) => {
  const R = TALL ? 46 * cqw : 46 * cqh, dotR = TALL ? 5 * cqw : 3.7 * cqh, D = 2.7 * R;
  const barrel = $("div", "barrel", el); css(barrel, { width: D + "px" });
  const bore = img(A("barrel.webp"), "bore", barrel); bore.style.transformOrigin = `${BARREL.cx * 100}% ${BARREL.cy * 100}%`;
  const world = $("div", "world", barrel); const RW = BARREL.open * D * 1.02;
  css(world, { width: 2 * RW + "px", left: BARREL.cx * 100 + "%", top: BARREL.cy * 100 + "%" });
  const walk = $("div", "agent", world); img(A("agent-a-walk.webp"), "", walk);
  const aim = $("div", "agent", world); img(A("agent-a-aim.webp"), "", aim);
  const muzzle = $("i", "bloom", world); const wflash = $("i", "layer", world); css(wflash, { background: "radial-gradient(circle, #fff 0 45%, rgb(255 240 230 / .8) 75%, transparent 100%)", opacity: 0 });
  const dripWrap = $("div", "layer", barrel);
  dripWrap.innerHTML = `<svg class="drip" viewBox="0 0 200 260" preserveAspectRatio="none"><defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a0010"/><stop offset=".7" stop-color="#b3001c"/><stop offset="1" stop-color="#d0102c"/></linearGradient></defs><path fill="url(#dg)" d="M0 0H200V196C193 196 191 214 186 230 183 240 175 240 173 229 170 214 170 199 163 199 156 199 156 210 152 216 148 222 142 220 141 211 140 200 136 196 128 196 120 196 121 228 116 246 113 256 104 256 102 244 99 222 100 199 91 198 83 198 83 207 79 212 75 217 69 214 68 206 67 199 63 197 55 197 47 197 47 222 42 236 39 245 31 245 29 234 27 220 28 199 20 198 12 198 9 206 6 210 3 214 0 211 0 206Z"/></svg>`;
  const drip = dripWrap.firstChild, bleed = $("i", "bleed", barrel), iris = $("i", "iris", el);
  // on the music: he walks in on the intro, turns on the beat before the band, fires as it comes in
  const LT = T.turn - T.irisOpen, LF = T.fire - T.irisOpen, LC = T.irisClose - T.irisOpen, LE = T.titles[0] - T.irisOpen;
  hit(T.fire, 2.2, .2); hit(T.fire + .02, 1, .12);
  return (t) => {
    const l = t - T.irisOpen;
    const ir = l < LC ? mix(dotR, R, p(l, 0, .55, E.outE)) : mix(R, dotR, p(l, LC, LE - .04, E.inC));
    const ix = kf(l, [[0, DOTX[4] * PW, E.ioC], [Math.min(1.3, LT * .75), PW / 2]]);
    const iy = kf(l, [[0, PH / 2], [LF, PH / 2, E.inQ], [LF + .62, PH * .63]]);
    iris.style.webkitMaskImage = iris.style.maskImage = `radial-gradient(circle ${ir.toFixed(1)}px at ${ix.toFixed(1)}px ${iy.toFixed(1)}px, transparent ${(ir - 1.5).toFixed(1)}px, #000 ${ir.toFixed(1)}px)`;
    const drop = p(l, LF, LF + .6, E.inQ), push = kf(l, [[0, 1], [LT * .55, 1.04, E.ioQ], [LT, 1.06, E.inQ], [LF, 1.2, E.outE], [LF + .1, 1.17]]);
    css(barrel, { left: ix - (BARREL.cx - .5) * D + "px", top: iy - (BARREL.cy - .5) * D + "px" });
    tf(barrel, `rotate(${(-10 * drop).toFixed(2)}deg) scale(${push.toFixed(4)})`);
    tf(bore, `rotate(${kf(l, [[0, -28, E.lin], [LF, 18, E.outC], [LC, 70]]).toFixed(2)}deg)`);
    bore.style.filter = l > LF && l < LF + .25 ? `brightness(${(1 + 1.8 * (1 - p(l, LF, LF + .25))).toFixed(2)})` : "none";
    const walking = l < LT;
    css(walk, { display: walking ? "block" : "none", left: (kf(l, [[0, -70, E.lin], [LT, -12]]) + 50) + "%" });
    walk.firstChild.style.translate = "-55% 0";
    tf(walk, `translateY(${(-1.4 * Math.abs(Math.sin(l * Math.PI * 2.2))).toFixed(2)}%) rotate(${(.6 * Math.sin(l * Math.PI * 2.2)).toFixed(2)}deg)`);
    css(aim, { display: walking ? "none" : "block", left: "50%", transformOrigin: "50% 22%" });
    aim.firstChild.style.translate = "-52% 0";
    tf(aim, `scale(${kf(l, [[LT, 1.1, E.outE], [LT + .15, 1, E.ioQ], [LF, 1.32, E.outE], [LF + .12, 1.4, E.ioQ], [LF + .4, 1.36]]).toFixed(4)})`);
    const ab = aim.getBoundingClientRect(), wb = world.getBoundingClientRect(), sc = wb.width / world.offsetWidth || 1;
    const mx = (ab.left - wb.left) / sc + (AIM_MUZZLE[0] - .52) * ab.width / sc, my = (ab.top - wb.top) / sc + AIM_MUZZLE[1] * ab.height / sc;
    bloomAt(muzzle, l, LF, mx, my, 1.6, .22);
    op(wflash, l >= LF ? .95 * Math.exp(-(l - LF) / .06) : 0);
    drip.style.transform = `translateY(${kf(l, [[LF + .08, -101, (x) => x * x * (3 - 2 * x) * .4 + x * x * .6], [LC - .1, -12]]).toFixed(2)}%)`;
    op(bleed, p(l, LC - .25, LC + .2));
  };
});

// ── Bond titles ──
function silhouette(parent, src, ratio, color, glow) {
  const wrap = $("div", "silwrap", parent); if (glow) wrap.style.filter = glow;
  const s = $("i", "sil", wrap); css(s, { background: color, aspectRatio: String(ratio), webkitMaskImage: `url(${src})`, maskImage: `url(${src})` });
  return { wrap, s };
}
function titleCard(parent, en, cn, align) {
  const c = $("div", "card", parent); c.style.alignItems = align;
  const e = $("div", "en", c, { textContent: en }), n = $("div", "cn", c, { textContent: cn });
  return (t, a) => {
    reveal(e, t, a + .08, .6, 1.5);
    const x = p(t, a, a + .9, E.outE); op(n, p(t, a, a + .3)); n.style.letterSpacing = mix(.42, .12, x).toFixed(3) + "em";
    n.style.filter = x < .5 ? `blur(${((.5 - x) * 2.4 * cqh).toFixed(2)}px)` : "none";
  };
}
shot(T.titles[0], T.catch, (el) => {
  const c1 = $("div", "layer", el), red = $("div", "redfield", c1);
  const smoke1 = img(A("smoke.webp"), "smoke", c1); css(smoke1, { mixBlendMode: "multiply", opacity: .85 });
  const silA = silhouette(c1, A("agent-a-walk.webp"), 592 / 1200, "#050001");
  const t1 = titleCard(c1, "THIS AUTUMN", "今年秋天", TALL ? "flex-start" : "flex-end");
  const c2 = $("div", "layer", el); css(c2, { background: "#030304" });
  const smoke2 = img(A("smoke.webp"), "smoke", c2); css(smoke2, { opacity: .32 });
  const silB = silhouette(c2, A("agent-b-pose.webp"), 320 / 1200, "#c4001f", "drop-shadow(0 0 2.5cqh rgb(255 30 60 / .55))");
  const t2 = titleCard(c2, "TWO BOSSES", "兩位老闆", "flex-start");
  const c3 = $("div", "layer", el), duo = $("div", "duo-tone", c3); const arena = plate(duo, A("arena.webp")); $("i", "", duo);
  const smoke3 = img(A("smoke.webp"), "smoke", c3); css(smoke3, { opacity: .3 });
  const t3 = titleCard(c3, "ONE BATTLEFIELD", "一個戰場", "flex-start");
  const c4 = $("div", "layer", el); css(c4, { background: "#030304" });
  const wire = $("i", "wire", c4); wire.style.top = WIRE_Y * 100 + "%";
  const fA = silhouette(c4, A("agent-a-walk.webp"), 592 / 1200, "#efe9df"), fB = silhouette(c4, A("agent-b-pose.webp"), 320 / 1200, "#efe9df");
  const t4 = titleCard(c4, "ONLY ONE TEAM WINS", "只有一隊能贏", "center");
  if (TALL) c4.querySelector(".cn").style.fontSize = "11cqw";
  const place = (c, x, y, ax = 0) => { css(c, { left: x, top: y }); c.style.translate = `${-ax * 100}% -50%`; };
  const cards = [...el.querySelectorAll(".card")];
  if (TALL) {
    css(silA.s, { position: "absolute", left: "-12%", bottom: "-4%", height: "72%" }); place(cards[0], "8%", "16%");
    css(silB.s, { position: "absolute", right: "2%", bottom: "-4%", height: "74%" }); place(cards[1], "8%", "16%");
    place(cards[2], "8%", "16%");
    css(fA.s, { position: "absolute", left: "0%", bottom: "-8%", height: "62%" }); css(fB.s, { position: "absolute", right: "2%", bottom: "-8%", height: "62%" }); place(cards[3], "50%", "14%", .5);
  } else {
    // whole heads: the figures stop a little under the top of the 2.39:1 picture
    css(silA.s, { position: "absolute", left: "3%", bottom: "-36%", height: "132%" }); place(cards[0], "92%", "50%", 1);
    css(silB.s, { position: "absolute", right: "6%", bottom: "-36%", height: "132%" }); place(cards[1], "8%", "50%");
    place(cards[2], "8%", "50%");
    css(fA.s, { position: "absolute", left: "4%", bottom: "-36%", height: "132%" }); css(fB.s, { position: "absolute", right: "8%", bottom: "-36%", height: "132%" }); place(cards[3], "50%", "64%", .5);
  }
  const [a1, a2, a3, a4] = T.titles;
  hit(a4, .6, .14); hit(T.button, .5, .12, .2, "#ff8a96");   // the wire catches on 007's last accent
  return (t) => {
    const o1 = 1 - p(t, a2 - .12, a2 + .1), o2 = p(t, a2 - .12, a2 + .1) * (1 - p(t, a3 - .12, a3 + .1)), o3 = p(t, a3 - .12, a3 + .1) * (t < a4 ? 1 : 0);
    css(c1, { display: o1 > 0 ? "block" : "none" }); op(c1, o1); css(c2, { display: o2 > 0 ? "block" : "none" }); op(c2, o2); css(c3, { display: o3 > 0 ? "block" : "none" }); op(c3, o3);
    css(c4, { display: t >= a4 ? "block" : "none" });
    red.style.clipPath = `circle(${mix(TALL ? 5 : 3.7, 170, p(t, a1, a1 + .4, E.ioC))}% at 50% 63%)`;
    tf(smoke1, `scale(${(1.1 + .12 * p(t, a1, a2 + .2)).toFixed(3)}) rotate(${(-4 + 6 * p(t, a1, a2 + .2)).toFixed(2)}deg)`); op(smoke1, .85 * p(t, a1 + .1, a1 + .5));
    tf(silA.wrap, `translateX(${(-3 + 4 * p(t, a1, a2 + .2)).toFixed(2)}%) scale(${(1.04 - .03 * p(t, a1, a2)).toFixed(3)})`); op(silA.wrap, p(t, a1 + .1, a1 + .45));
    t1(t, a1 + .12);
    tf(smoke2, `scale(${(1.15 + .1 * p(t, a2 - .2, a3 + .2)).toFixed(3)}) rotate(${(3 - 5 * p(t, a2 - .2, a3 + .2)).toFixed(2)}deg)`);
    tf(silB.wrap, `translateX(${(3 - 4 * p(t, a2 - .2, a3 + .2)).toFixed(2)}%)`);
    t2(t, a2);
    tf(arena, `scale(${(1.12 + .22 * p(t, a3 - .2, a4, E.inQ)).toFixed(4)}) rotate(${(-1.5 + 2 * p(t, a3 - .2, a4)).toFixed(2)}deg)`);
    tf(smoke3, `scale(${(1.3 + .4 * p(t, a3 - .2, a4)).toFixed(3)}) translateX(${(-4 * p(t, a3 - .2, a4)).toFixed(2)}%)`);
    t3(t, a3);
    // the wire is a fuse: on 007's last accent it catches at both ends and burns in to one point (drawWireBurn) while the
    // Mission builds underneath; the camera leans in on it and the card sinks back into the dark until the ends meet
    const B = T.button, burn = burnAt(t), lean = p(t, B, T.catch, E.inQ);
    wire.style.transformOrigin = `${WIRE_TO * 100}% 50%`;
    tf(wire, `scaleX(${(p(t, a4, a4 + .22, E.outE) * (1 - burn)).toFixed(3)})`);
    op(wire, t >= B ? 1 : t > a4 + .85 ? .6 + .4 * Math.abs(Math.sin(t * 60)) : 1);
    wire.style.filter = t >= B ? `brightness(${(1 + 2.2 * burn).toFixed(2)}) saturate(${(1 - .5 * burn).toFixed(2)})` : "none";
    c4.style.transformOrigin = `${WIRE_TO * 100}% ${WIRE_Y * 100}%`; tf(c4, `scale(${(1 + LEAN * lean).toFixed(4)})`);
    tf(fA.wrap, `translateX(${(-6 * (1 - p(t, a4, a4 + 1, E.outE))).toFixed(2)}%)`); tf(fB.wrap, `translateX(${(6 * (1 - p(t, a4, a4 + 1, E.outE))).toFixed(2)}%)`);
    const dim = 1 - .62 * p(t, B + .3, T.catch - .2); op(fA.wrap, dim); op(fB.wrap, dim);
    t4(t, T.titleText); op(cards[3], 1 - .55 * p(t, B + .6, T.catch - .1));
  };
});

/** 007 hands over to the Mission in one light: the last card's wire burns in from both ends like a fuse */
function drawWireBurn(t) {
  const B = T.button; if (t < B || t >= T.catch) return;
  // the card leans in around the meeting point, so the two burning ends ride the same zoom
  const X = WIRE_TO * PW, Y = PY + WIRE_Y * PH, s = 1 + LEAN * p(t, B, T.catch, E.inQ), size = .85 + .55 * burnAt(t);
  fuseHead(t, B, (te) => [X - X * (1 - burnAt(te)) * s, Y], size, 170);
  fuseHead(t, B, (te) => [X + (PW - X) * (1 - burnAt(te)) * s, Y], size, 170);
}

// ════ ACT II — the mission ════
// The wire's flash is the fuse catching, on the Mission's first bass downbeat; the camera chases the spark along the floor.
const CATCH = T.catch;
/** a photo on an explicit box, so image coordinates map to the picture; frame() is a virtual camera: zoom k, image point (u, v) placed at picture fraction (x, y) */
function rig(parent, src, ar) {
  const box = $("div", "", parent), im = img(src, "", box);
  const DW = Math.max(PW, PH * ar), DH = DW / ar;
  css(box, { position: "absolute", left: (PW - DW) / 2 + "px", top: (PH - DH) / 2 + "px", width: DW + "px", height: DH + "px", transformOrigin: "50% 50%" });
  css(im, { width: "100%", height: "100%" });
  const R = { box, im, DW, DH, k: 1, tx: 0, ty: 0 };
  R.frame = (k, u, v, x, y) => {
    const mx = Math.max(0, (k * DW - PW) / 2), my = Math.max(0, (k * DH - PH) / 2);
    R.k = k; R.tx = Math.max(-mx, Math.min(mx, x * PW - PW / 2 - k * (u - .5) * DW)); R.ty = Math.max(-my, Math.min(my, y * PH - PH / 2 - k * (v - .5) * DH));
    tf(box, `translate(${R.tx.toFixed(2)}px, ${R.ty.toFixed(2)}px) scale(${k.toFixed(4)})`);
  };
  R.at = (u, v) => [PW / 2 + R.tx + R.k * (u - .5) * DW, PH / 2 + R.ty + R.k * (v - .5) * DH];
  return R;
}
/** a path through image points [u, v, cord width], Catmull-Rom smoothed; s runs by depth-weighted length (thin = far = slower on screen) */
function pathOf(pts, ar, wExp = .6) {
  const P = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d = pts[Math.min(pts.length - 1, i + 2)];
    for (let j = 0; j < 8; j++) { const s = j / 8, s2 = s * s, s3 = s2 * s; P.push(b.map((_, m) => .5 * (2 * b[m] + (c[m] - a[m]) * s + (2 * a[m] - 5 * b[m] + 4 * c[m] - d[m]) * s2 + (3 * b[m] - a[m] - 3 * c[m] + d[m]) * s3))); }
  }
  P.push(pts[pts.length - 1]);
  const L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot((P[i][0] - P[i - 1][0]) * ar, P[i][1] - P[i - 1][1]) / ((P[i][2] + P[i - 1][2]) / 2) ** wExp);
  const total = L[L.length - 1];
  const at = (s) => { const x = clamp01(s) * total; let i = 1; while (i < L.length - 1 && L[i] < x) i++; const f = clamp01((x - L[i - 1]) / (L[i] - L[i - 1] || 1)); return P[i - 1].map((v, m) => mix(v, P[i][m], f)); };
  return { P, L, total, at };
}
// the cord as photographed: centre line and width (fraction of image width), from the near end to the far end
const FUSE = TALL
  ? { src: "fuse-tall.webp", ar: 941 / 1672, pts: [[.42, 1, .29], [.45, .9, .25], [.475, .8, .21], [.5, .7, .17], [.524, .64, .14], [.522, .58, .13], [.507, .52, .115], [.47, .468, .095], [.43, .43, .08], [.405, .4, .065], [.407, .37, .05], [.433, .345, .036], [.469, .325, .028], [.509, .31, .024], [.549, .3, .021], [.584, .2875, .019], [.598, .2725, .017], [.589, .2575, .016], [.558, .245, .015], [.513, .235, .014], [.469, .2275, .013], [.433, .2175, .012], [.415, .203, .011], [.426, .189, .01], [.452, .175, .009], [.49, .165, .008], [.515, .16, .007]] }
  : { src: "fuse-wide.webp", ar: 1672 / 941, pts: [[-.02, .752, .062], [.1, .712, .056], [.2, .676, .051], [.3, .636, .046], [.4, .588, .041], [.445, .552, .036], [.484, .5, .029], [.496, .448, .023], [.499, .405, .019], [.504, .376, .016], [.52, .357, .014], [.546, .344, .012], [.58, .335, .011], [.62, .328, .0095], [.68, .326, .0082], [.74, .322, .0072], [.8, .315, .0064], [.845, .307, .0057], [.864, .298, .0053], [.87, .285, .005], [.865, .272, .0048], [.853, .26, .0046], [.849, .249, .0045], [.856, .24, .0044], [.876, .231, .0042], [.9, .223, .004], [.93, .213, .0036], [.966, .205, .0032], [1.02, .197, .003]] };
const fusePath = pathOf(FUSE.pts, FUSE.ar);
const headS = (t) => { const x = clamp01((t - CATCH) / (T.mission - .08 - CATCH)); return mix(x, x * x, .25); };
let fuseRig = null;
shot(T.catch, T.mission, (el) => {
  // the fuse: a dim plate, a bright copy revealed only where the spark lights the floor, and the spark's warm cast
  const fL = $("div", "layer", el), fuse = rig(fL, A(FUSE.src), FUSE.ar); fuseRig = fuse;
  fuse.im.style.filter = "brightness(.42) saturate(.8)";
  const lit = img(A(FUSE.src), "", fuse.box), tint = $("i", "", fuse.box);
  css(lit, { position: "absolute", inset: "0", width: "100%", height: "100%", filter: "brightness(1.4) contrast(1.1) sepia(.12) saturate(1.2)" });
  css(tint, { position: "absolute", inset: "0", mixBlendMode: "screen" });
  // the super
  const typed = $("div", "typed", el), meta = $("div", "meta", el, { textContent: "MISSION BRIEFING  ·  10.29" });
  const chars = [..."任務簡報"].map((c) => $("span", "", typed, { textContent: c })); const caret = $("i", "caret", typed);
  css(typed, TALL ? { left: "8%", top: "8.5%", fontSize: "11cqw" } : { left: "6%", top: "12%", fontSize: "8.4cqh" });
  css(meta, TALL ? { left: "8%", top: "15.5%", fontSize: "2.8cqw" } : { left: "6%", top: "25%" });
  typed.style.textShadow = `0 .4cqh 3cqh rgba(0,0,0,.9), 0 0 3cqh rgba(255,170,80,.35)`;
  hit(CATCH, 1.2, .16, .55, "#ffe6c8");   // the wire's flash, and the fuse has caught
  fuse.frame(1.08, ...fusePath.at(0).slice(0, 2), TALL ? .5 : .42, TALL ? .66 : .62); const [cx0, cy0] = fuse.at(...fusePath.at(.012).slice(0, 2));
  sparkBursts.push([CATCH, Math.max(4 * cqh, cx0), Math.min(PH - 4 * cqh, cy0), 60, TALL ? 80 : 66, ""]);
  return (t) => {
    const x = p(t, CATCH, T.mission, E.ioQ), [lu, lv] = fusePath.at(headS(t - .14));
    fuse.frame(mix(1.08, 1.36, p(t, CATCH, T.mission, E.inQ)), lu, lv, TALL ? .5 : mix(.42, .6, x), TALL ? mix(.66, .44, x) : mix(.62, .45, x));
    const [hu, hv, hw] = fusePath.at(headS(t)), fl = .85 + .15 * Math.sin(t * 83) * Math.sin(t * 31 + 2), cx = hu * fuse.DW, cy = hv * fuse.DH;
    const R = Math.max(100, Math.min(.3 * Math.max(PW, PH), hw * fuse.DW * 3.6)) * fl * (1 + .4 * Math.exp(-(t - CATCH) / .08));
    lit.style.webkitMaskImage = lit.style.maskImage = `radial-gradient(circle ${R.toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px, #000 0%, rgba(0,0,0,.5) 35%, transparent 100%)`;
    tint.style.background = `radial-gradient(circle ${(R * 1.25).toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px, rgba(255,150,60,${(.32 * fl).toFixed(3)}), rgba(255,90,20,.07) 45%, transparent 75%)`;
    const [ta, tb] = T.typing[0];
    chars.forEach((c, i) => { c.style.display = t >= ta + (tb - ta) * i / chars.length ? "inline" : "none"; });
    op(typed, t >= ta ? 1 : 0); op(caret, t < tb ? 1 : (Math.floor((t - tb) / .25) % 2 ? 0 : 1));
    reveal(meta, t, ta + .7, .6, 1);
  };
});
/** the burning run: the cord behind the spark is the same photo burnt black (mask drawn off screen, so overlaps never band), embers glow
 *  a few cord-widths back (perspective-true), smoke shows only in the spark's light, and the spark is sized by its distance to the lens */
const charC = document.createElement("canvas"), cg = charC.getContext("2d"), emC = document.createElement("canvas"), eg = emC.getContext("2d");
charC.width = emC.width = SW; charC.height = emC.height = SH;
function drawFuseRun(t) {
  if (!fuseRig || t < CATCH || t >= T.mission) return;
  const R = fuseRig, [sx, sy] = shakeXY, toStage = (u, v) => { const [x, y] = R.at(u, v); return [x + sx, PY + y + sy]; };
  const sNow = headS(t), cut = sNow * fusePath.total, { P, L } = fusePath, head = fusePath.at(sNow), [hx, hy] = toStage(head[0], head[1]);
  const segs = [];
  for (let i = 1; i < P.length && L[i - 1] < cut; i++) { const end = L[i] <= cut ? P[i] : head; segs.push([toStage(P[i - 1][0], P[i - 1][1]), toStage(end[0], end[1]), end[2] * R.DW * R.k]); }
  // charred cord: stroke a soft-edged mask, then pour the darkened photo into it
  cg.clearRect(0, 0, SW, SH); cg.lineCap = "round"; cg.strokeStyle = "#fff";
  for (const [wMul, alpha, soft] of [[.9, .55, .07], [.66, 1, .025]]) {
    cg.globalAlpha = alpha;
    for (const [[ax, ay], [bx, by], w] of segs) { cg.filter = `blur(${Math.max(.5, w * soft).toFixed(1)}px)`; cg.lineWidth = w * wMul; cg.beginPath(); cg.moveTo(ax, ay); cg.lineTo(bx, by); cg.stroke(); }
  }
  cg.globalAlpha = 1; cg.filter = "none";
  if (segs.length) {   // cut the round cap off flush with the spark
    const [[ax, ay], [bx, by], w] = segs[segs.length - 1];
    cg.save(); cg.translate(bx, by); cg.rotate(Math.atan2(by - ay, bx - ax)); cg.globalCompositeOperation = "destination-out"; cg.fillRect(0, -w, w, 2 * w); cg.restore();
  }
  cg.globalCompositeOperation = "source-in"; cg.filter = "brightness(.3) contrast(1.25) saturate(.45)";
  cg.drawImage(R.im, PW / 2 + R.tx - R.k * R.DW / 2 + sx, PY + PH / 2 + R.ty - R.k * R.DH / 2 + sy, R.k * R.DW, R.k * R.DH);
  cg.filter = "none"; cg.globalCompositeOperation = "source-over";
  g.drawImage(charC, 0, 0);
  // embers: walk back from the spark in units of cord width
  // embers: the last few cord-widths behind the spark, as continuous strokes (deep red, orange, white-hot), softened like the lens
  eg.clearRect(0, 0, SW, SH); eg.lineCap = "round"; eg.lineJoin = "round"; eg.globalCompositeOperation = "lighter";
  const hw = segs.length ? segs[segs.length - 1][2] : 0, fl = .78 + .22 * noise1(t * 26, 13);
  for (const [reach, wMul, col] of [[3.2, .26, "255,60,20,.55"], [1.4, .3, "255,140,50,.6"], [.45, .34, "255,225,170,.8"]]) {
    let D = 0; eg.beginPath(); let started = false;
    for (let i = segs.length - 1; i >= 0 && D < reach; i--) {
      const [[ax, ay], [bx, by], w] = segs[i];
      if (!started) { eg.moveTo(bx, by); started = true; }
      eg.lineTo(ax, ay); D += Math.hypot(bx - ax, by - ay) / Math.max(1, w);
    }
    eg.filter = `blur(${Math.max(.6, hw * .05).toFixed(1)}px)`; eg.strokeStyle = `rgba(${col.split(",").slice(0, 3).join(",")},${(Number(col.split(",")[3]) * fl).toFixed(3)})`; eg.lineWidth = hw * wMul; eg.stroke();
  }
  eg.filter = "none"; eg.globalCompositeOperation = "source-over";
  g.globalCompositeOperation = "lighter"; g.drawImage(emC, 0, 0); g.globalCompositeOperation = "source-over";
  // smoke off the burnt cord
  for (let k = 0; k < 60; k++) {
    const te = CATCH + k * .03; if (te > t) break;
    const age = t - te, life = 1.1; if (age > life) continue;
    const [u, v, w] = fusePath.at(headS(te)), [x0, y0] = toStage(u, v), cw = w * R.DW * R.k;
    const r = cw * (.9 + 1.8 * age) + 1.2 * cqh * age, X = x0 + noise1(age * 2 + k, 11) * cw, Y = y0 - cw * 2.6 * age - 8 * cqh * age * age;
    const a = .13 * (1 - age / life) * Math.exp(-Math.hypot(X - hx, Y - hy) / (head[2] * R.DW * R.k * 5 + 4 * Math.min(cqh, cqw * .75))); if (a < .005) continue;
    const gr = g.createRadialGradient(X, Y, 0, X, Y, r); gr.addColorStop(0, `rgba(215,195,175,${a.toFixed(3)})`); gr.addColorStop(1, "rgba(215,195,175,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(X, Y, r, 0, Math.PI * 2); g.fill();
  }
  const U = Math.min(cqh, cqw * .75), size = Math.max(.35, Math.min(3, head[2] * R.DW * R.k / (1.7 * U))) * U / cqh;
  fuseHead(t, CATCH, (te) => { const q = fusePath.at(headS(Math.max(te, CATCH))); return toStage(q[0], q[1]); }, size, 220);
}

const PAGES = { a: [.355, .49], b: [.597, .49] };              // where the photos land on the two pages of desk.webp
const PAGE_BOX = { a: [.253, .291, .469, .8], b: [.494, .276, .716, .787] };   // the pages themselves (left, top, right, bottom)
function bracket(e, c) {
  const l = `linear-gradient(${c}, ${c})`;
  e.style.background = [`${l} 0 0 / 22% 3px`, `${l} 0 0 / 3px 22%`, `${l} 100% 0 / 22% 3px`, `${l} 100% 0 / 3px 22%`, `${l} 0 100% / 22% 3px`, `${l} 0 100% / 3px 22%`, `${l} 100% 100% / 22% 3px`, `${l} 100% 100% / 3px 22%`].join(",");
  e.style.backgroundRepeat = "no-repeat";
}
shot(T.mission, T.montage[0].t + .4, (el) => {
  const desk = $("div", "layer", el); const deskImg = plate(desk, A("desk.webp")); css(deskImg, { objectFit: "fill" });
  const ratio = 1672 / 941, DW = TALL ? PH * ratio : Math.max(PW, PH * ratio), DH = DW / ratio;
  css(desk, { inset: "auto", width: DW + "px", height: DH + "px", left: (PW - DW) / 2 + "px", top: (PH - DH) / 2 + "px" });
  const photos = [["a", A("host-a.webp"), "代號　紅不讓", -4], ["b", A("host-b.webp"), "代號　刀槍Blue", 3]].map(([k, src, label, rot]) => {
    const ph = $("div", "desk-photo", desk); const inner = $("div", "", ph); img(src, "", inner);
    const lock = $("i", "lock", inner); bracket(lock, k === "a" ? "#ff2a44" : "#4d8dff");
    const tag = $("div", "", desk, { textContent: label }); css(tag, { position: "absolute", font: `500 ${(.011 * DW).toFixed(1)}px/1 "JetBrains Mono", monospace`, color: "#2a2622", letterSpacing: ".2em", whiteSpace: "nowrap", translate: "-50% 0", mixBlendMode: "multiply" });
    // a print with a white border and a deeper foot (padding in px: CSS percentages would follow the desk, not the print)
    css(ph, { width: .118 * DW + "px", padding: `${(.007 * DW).toFixed(1)}px ${(.007 * DW).toFixed(1)}px ${(.026 * DW).toFixed(1)}px`, left: PAGES[k][0] * 100 + "%", top: PAGES[k][1] * 100 + "%", translate: "-50% -50%" });
    css(tag, { left: PAGES[k][0] * 100 + "%", top: (PAGES[k][1] + .17) * 100 + "%" });
    return { ph, tag, rot, k, lock };
  });
  // the file printed on each page (it rides the camera with the desk): a stamp and the file line above the photo, redactions under it
  const px = (v) => (v * DW).toFixed(1) + "px";
  for (const [k, n, lead, rot] of [["a", "01", "RED LEADER", -5], ["b", "02", "BLUE LEADER", 4]]) {
    const [u0, v0] = PAGE_BOX[k];
    const head = $("div", "desk-ink", desk); css(head, { left: (u0 + .014) * 100 + "%", top: (v0 + .012) * 100 + "%", gap: px(.008), font: `500 ${px(.0072)}/1 "JetBrains Mono", monospace` });
    const stamp = $("b", "stamp", head, { textContent: "機密" }); css(stamp, { fontSize: px(.0135), padding: `${px(.0012)} ${px(.005)}`, borderWidth: px(.0013), rotate: rot + "deg" });
    $("span", "", head, { textContent: `FILE ${n} · ${lead}` });
    const notes = $("div", "desk-ink notes", desk); css(notes, { left: (u0 + .03) * 100 + "%", top: (PAGES[k][1] + .21) * 100 + "%", gap: px(.0042), font: `500 ${px(.0062)}/1 "JetBrains Mono", monospace` });
    notes.innerHTML = [`<span>STATUS ▸ ACTIVE · 10.29 · LAZERTREKS</span>`, [.06, .035, .075], [.045, .09]].map((r) => typeof r === "string" ? `<p>${r}</p>` : `<p>${r.map((w) => `<i style="width:${px(w)};height:${px(.0058)}"></i>`).join("")}</p>`).join("");
    for (const i of notes.querySelectorAll("i")) i.style.marginRight = px(.006);
  }
  const scrim = $("i", "layer", el); css(scrim, { background: TALL ? "linear-gradient(0deg, rgb(3 3 4 / .92) 0 20%, rgb(3 3 4 / .3) 40%, rgb(3 3 4 / 0) 58%)" : "linear-gradient(90deg, rgb(3 3 4 / .9) 0 38%, rgb(3 3 4 / .25) 70%, rgb(3 3 4 / 0))", opacity: 0 });
  const line = $("div", "orders", el), l1 = $("div", "line", line);
  const typeChars = [..."你的任務——"].map((c) => $("span", "", l1, { textContent: c }));   // …finished before the title
  const big = $("div", "orders", el), b1 = $("div", "big", big); b1.innerHTML = "10.29 攻佔<em>六度空間</em>";
  const sweep = $("i", "flare warm", el);
  if (TALL) { css(line, { left: "7%", top: "8%" }); l1.style.fontSize = "4.6cqw"; css(big, { left: "7%", top: "78%" }); b1.style.fontSize = "15cqw"; }
  else { css(line, { left: "6%", top: "10%" }); css(big, { left: "6%", top: "54%", translate: "0 -50%" }); }
  hit(T.cardA, .4, .1); hit(T.cardB, .4, .1); hit(T.missionLine, 1.4, .18, .3);
  return (t) => {
    const l = t - T.mission;
    // opens on file A's head (the stamp), tilts down as its photo lands, across to file B, then back: on 16:9 the files sit right
    // of frame and the orders own the left; on 9:16 the orders take the dark desk under the folder
    const [h, a, b, end] = TALL ? [[.33, .38], [.355, .48], [.597, .48], [.476, .5]] : [[.355, .35], [.355, .41], [.597, .41], [.36, .4]];
    const focus = kf(l, [[0, h, E.ioC], [.62, a, E.ioC], [.75, a, E.ioC], [1.05, b, E.ioC], [1.3, end]]);
    const zoom = kf(l, [[0, 2.35, E.outC], [.4, 2.1, E.ioC], [1.05, 2.0, E.ioE], [1.3, TALL ? 1.03 : 1.18, E.lin], [2.4, TALL ? 1.0 : 1.12]]);
    tf(desk, `scale(${zoom.toFixed(4)}) translate(${((.5 - focus[0]) * DW).toFixed(1)}px, ${((.5 - focus[1]) * DH).toFixed(1)}px) rotate(${kf(l, [[0, -2], [2, 1]]).toFixed(2)}deg)`);
    photos.forEach(({ ph, tag, rot, k, lock }) => {
      const t0 = k === "a" ? T.cardA : T.cardB, x = p(t, t0, t0 + .22, E.outBack);
      op(ph, p(t, t0, t0 + .05)); tf(ph, `scale(${mix(1.5, 1, x).toFixed(3)}) rotate(${mix(rot * 3, rot, x).toFixed(2)}deg)`);
      ph.style.boxShadow = `0 ${mix(6, 2, x) * cqh}px ${mix(10, 4, x) * cqh}px rgb(0 0 0 / ${mix(.3, .65, x).toFixed(2)})`;
      op(lock, p(t, t0 + .12, t0 + .2)); tf(lock, `scale(${mix(1.6, 1, p(t, t0 + .12, t0 + .24, E.outBack)).toFixed(3)})`);
      op(tag, p(t, t0 + .15, t0 + .3));
    });
    const [ta, tb] = T.typing[1];
    typeChars.forEach((c, i) => { c.style.display = t >= ta + (tb - ta) * i / typeChars.length ? "inline" : "none"; });
    op(line, 1 - p(t, T.missionLine - .05, T.missionLine + .1));
    op(scrim, p(t, T.missionLine - .04, T.missionLine + .12));
    const s = p(t, T.missionLine, T.missionLine + .35, E.outE); op(big, p(t, T.missionLine, T.missionLine + .08));
    tf(b1, `scale(${mix(1.25, 1, s).toFixed(4)})`); b1.style.filter = s < .6 ? `blur(${((.6 - s) * 2 * cqh).toFixed(2)}px)` : "none";
    const sw = p(t, T.missionLine + .05, T.missionLine + .55, E.ioC); css(sweep, { left: mix(-20, 70, sw) + "%", top: TALL ? "86%" : "54%" }); op(sweep, Math.sin(Math.PI * sw) * .9);
  };
});

// ── whip pans between adjacent cuts ──
const whips = [];
function whip(outName, inName, dir = -1, len = .09) { whips.push({ out: outName, in: inName, dir, len }); }
function applyWhips(t) {
  for (const w of whips) {
    const so = byName[w.out], si = byName[w.in]; if (!so || !si) continue;
    const tc = si.a, xo = p(t, tc - w.len, tc, E.inQ), xi = 1 - p(t, tc, tc + w.len, E.outQ);
    if (t >= tc - w.len && t < tc) tf(so.el, `translateX(${(w.dir * 70 * xo).toFixed(2)}%)`); else if (t < tc) so.el.style.transform = "";
    if (t >= tc && t < tc + w.len) tf(si.el, `translateX(${(-w.dir * 70 * xi).toFixed(2)}%)`); else if (t >= tc + w.len) si.el.style.transform = "";
  }
}
const byName = {};

// ── the montage ──
const M = Object.fromEntries(T.montage.map((m, i) => [m.shot, { t: m.t, end: (T.montage[i + 1]?.t ?? T.title) }]));
function cut(name, end, build) { const m = M[name]; const s = shot(m.t, end ?? m.end, build); byName[name] = s; return s; }

// into the arena behind a burning edge (the fuse's own wipe)
burns.push([M.arena.t, .38]);
cut("arena", null, (el) => {
  const bg = plate(el, A("arena.webp")); const fog = img(A("smoke.webp"), "smoke", el); css(fog, { opacity: .38 });
  const beams = [beam(el), beam(el, "blue"), beam(el)];
  const cap = caption(el, "LOCATION", "六度空間　LAZERTREKS");
  hit(M.arena.t, .9, .16, .3);
  return (t) => {
    const l = t - M.arena.t, d = p(l, 0, .8, E.outC);
    burnWipe(el, t, M.arena.t, .38);
    tf(bg, `scale(${mix(1.06, 1.26, d).toFixed(4)}) translateY(${mix(1.5, -1, d).toFixed(2)}%)`);
    tf(fog, `scale(${mix(1.3, 1.9, d).toFixed(4)}) translateX(${mix(0, -6, d).toFixed(2)}%)`);
    beams.forEach((b, i) => { const ang = [-8, 6, -3][i] + 10 * (l - .4) * [1, -1, .6][i]; css(b, { left: "-10%", top: [38, 58, 72][i] + "%", width: "120%" }); tf(b, `rotate(${ang.toFixed(2)}deg)`); op(b, .85 * p(l, .15 + .05 * i, .25 + .05 * i)); });
    cap(t, M.arena.t + .3);
  };
});
cut("teams", null, (el) => {
  const bg = plate(el, A("walkout.webp"), TALL ? "50% 50%" : null); const fl = $("i", "flare", el); const cap = caption(el, "10.29 THU 12:00", "週四中午・六度空間集合");
  return (t) => { const l = t - M.teams.t; tf(bg, `scale(${mix(1.04, 1.16, p(l, 0, .8, E.outQ)).toFixed(4)})`); css(fl, { left: "50%", top: "44%" }); op(fl, .55 + .25 * Math.sin(l * 9)); tf(fl, `scaleX(${(.8 + .3 * p(l, 0, .8)).toFixed(3)})`); cap(t, M.teams.t + .04); };
});
function duel(el, cutSrc, muzzle, color, tShots, capEn, capCn) {
  const bg = plate(el, A("arena.webp")); bg.style.filter = "blur(.5cqh) brightness(.75)";
  const fog = img(A("smoke.webp"), "smoke", el); css(fog, { opacity: .22 });
  const subj = img(A(cutSrc), "plate", el); subj.style.objectFit = "contain";
  if (TALL) css(subj, { objectPosition: "50% 100%", transformOrigin: "50% 100%" });
  const beams = tShots.map(() => beam(el, color)), blooms = tShots.map(() => $("i", "bloom " + color, el));
  const cap = capEn ? caption(el, capEn, capCn) : null;
  return (t, t0, dur) => {
    const l = t - t0, d = p(l, 0, dur);
    tf(bg, `scale(${mix(1.12, 1.18, d).toFixed(4)}) translateX(${mix(1.5, -1.5, d).toFixed(2)}%)`);
    tf(fog, `scale(1.4) translateX(${mix(4, -8, d).toFixed(2)}%)`);
    const s = TALL ? 2.1 : 1.08, tx = TALL ? 16 : 6;
    tf(subj, `translateX(${mix(tx + 3, tx - 2, d).toFixed(2)}%) scale(${mix(s, s * 1.04, d).toFixed(4)})`);
    const r = subj.getBoundingClientRect(), pr = picBox();
    const iw = Math.min(r.width, r.height * 1672 / 941), ih = iw * 941 / 1672;
    const mx = r.left - pr.left + (r.width - iw) / 2 + muzzle[0] * iw, my = r.top - pr.top + (TALL ? r.height - ih : (r.height - ih) / 2) + muzzle[1] * ih;
    tShots.forEach((ts, i) => { fire(beams[i], t, ts, mx, my, 180 + (i ? -3 : 2), mx + 10 * cqw, .3); bloomAt(blooms[i], t, ts, mx, my, 1.1, .22); });
    if (cap) cap(t, t0 + .04);
  };
}
shot(M.fireA.t, M.aimB.t, (el) => {
  const u = duel(el, "cut-fire-a.webp", [.194, .439], "", [M.fireA.t + .01, M.fireA2.t], "VIP", "保護老闆");
  hit(M.fireA.t, 1.1, .12, .16, "#ff3a4f"); hit(M.fireA2.t, 1.1, .12, .16, "#ff3a4f");
  return (t) => u(t, M.fireA.t, M.aimB.t - M.fireA.t);
});
shot(M.aimB.t, M.faceoff.t, (el) => {
  const u = duel(el, "cut-aim-b.webp", [.144, .475], "blue", [M.aimB2.t], null);
  hit(M.aimB2.t, 1, .12, .16, "#9fc2ff");
  return (t) => u(t, M.aimB.t, M.faceoff.t - M.aimB.t);
});
// the captains face off in one frame — red turned to face blue — each aiming at the other; on the beat both fire and the two
// beams meet in the middle (T.clash)
cut("faceoff", null, (el) => {
  const bg = plate(el, A("arena.webp")); bg.style.filter = "blur(.45cqh) brightness(.5) saturate(1.15)";
  const tint = $("i", "layer", el); tint.style.background = "linear-gradient(90deg, rgb(255 30 60 / .32), rgb(255 30 60 / 0) 42%, rgb(40 110 255 / 0) 58%, rgb(40 110 255 / .32))"; tint.style.mixBlendMode = "screen";
  const fog = img(A("smoke.webp"), "smoke", el); css(fog, { opacity: .2 });
  const red = img(A("cut-fire-a.webp"), "", el), blue = img(A("cut-aim-b.webp"), "", el);
  for (const e of [red, blue]) e.style.webkitMaskImage = e.style.maskImage = "linear-gradient(to bottom, #000 70%, transparent 97%)";
  const AR = 1672 / 941, box = (e, w, h, l, tp) => css(e, { position: "absolute", width: w + "px", height: h + "px", left: l + "px", top: tp + "px" });
  let mR, mB;   // where the beams start (picture fractions)
  if (TALL) {
    // a phone is too narrow for both: red, then blue, each in close-up aiming out of frame at the other; the beams then come
    // in from the edges (red's face sits at u .41 of the turned image, blue's at u .56)
    const HR = PH * .62, HB = PH * .6;
    box(red, HR * AR, HR, .32 * PW - .41 * HR * AR, .42 * PH - .3 * HR);
    box(blue, HB * AR, HB, .68 * PW - .56 * HB * AR, .45 * PH - .3 * HB);
    mR = [-.05, .44]; mB = [1.05, .44];
  } else {
    const H = PH * .84, W = H * AR, y0 = .41;
    mR = [.37, y0]; mB = [.63, y0 + .015];
    box(red, W, H, mR[0] * PW - (1 - .194) * W, mR[1] * PH - .439 * H);
    box(blue, W, H, mB[0] * PW - .144 * W, mB[1] * PH - .475 * H);
  }
  const beamR = beam(el), beamB = beam(el, "blue"), bloomR = $("i", "bloom", el), bloomB = $("i", "bloom blue", el), ring = $("i", "shock", el);
  const cx = PW / 2, cy = (mR[1] + mB[1]) / 2 * PH;
  if (TALL) hit(M.faceoff.t + (T.clash - M.faceoff.t) / 2, .6, .1);
  hit(T.clash, 1.7, .2, .5, "#ffffff");
  sparkBursts.push([T.clash, cx, cy, 70, 64, "red"], [T.clash, cx, cy, 70, 64, "blue"]);
  const shoot = (e, t, x0, y0b) => {
    const k = t - T.clash; if (k < 0 || k > .55) { op(e, 0); return; }
    const len = Math.hypot(cx - x0, cy - y0b), ang = Math.atan2(cy - y0b, cx - x0) * 180 / Math.PI;
    css(e, { left: x0 + "px", top: y0b + "px", width: len + "px" });
    tf(e, `rotate(${ang.toFixed(2)}deg) scaleX(${E.outE(clamp01(k / .06)).toFixed(3)}) scaleY(${(1.4 + .5 * Math.sin(k * 90)).toFixed(2)})`); op(e, 1 - p(k, .3, .55));
  };
  return (t) => {
    const l = t - M.faceoff.t, d = p(l, 0, M.faceoff.end - M.faceoff.t, E.outQ), lean = 2 * p(t, M.faceoff.t, T.clash, E.inQ);
    tf(bg, `scale(${mix(1.14, 1.2, d).toFixed(4)})`);
    if (TALL) {
      const mid = M.faceoff.t + (T.clash - M.faceoff.t) / 2;
      op(red, t < mid ? 1 : 0); op(blue, t >= mid && t < T.clash ? 1 : 0);
      tf(red, `scale(${mix(1.07, 1, p(t, M.faceoff.t, mid, E.outC)).toFixed(4)}) scaleX(-1)`); tf(blue, `scale(${mix(1.07, 1, p(t, mid, T.clash, E.outC)).toFixed(4)})`);
    } else { tf(red, `translateX(${lean.toFixed(2)}%) scaleX(-1)`); tf(blue, `translateX(${(-lean).toFixed(2)}%)`); }
    shoot(beamR, t, mR[0] * PW, mR[1] * PH); shoot(beamB, t, mB[0] * PW, mB[1] * PH);
    bloomAt(bloomR, t, T.clash, cx - 1.2 * cqh, cy, 1.9, .5); bloomAt(bloomB, t, T.clash, cx + 1.2 * cqh, cy, 1.9, .5);
    const k = p(t, T.clash, T.clash + .5, E.outC); css(ring, { left: cx + "px", top: cy + "px" });
    op(ring, t >= T.clash && k < 1 ? (1 - k) * .9 : 0); tf(ring, `scale(${(.2 + 6 * k).toFixed(3)})`);
  };
});
cut("tea", null, (el) => {
  const bg = plate(el, A("tea.webp")); const fl = $("i", "flare warm", el); const cap = caption(el, "AFTER", "戰後・飯店下午茶");
  return (t) => { const l = t - M.tea.t; tf(bg, `scale(${mix(1.14, 1.06, p(l, 0, .4, E.outE)).toFixed(4)})`); css(fl, { left: "50%", top: "30%" }); op(fl, .5); cap(t, M.tea.t + .02); };
});
cut("vault", null, (el) => {
  const bg = plate(el, A("vault-bg.webp")); const grid = $("div", "layer", el);
  const lasers = Array.from({ length: 9 }, () => { const b = beam(grid); b.style.height = ".25cqh"; return b; });
  const subj = img(A("cut-wire.webp"), "plate", el); subj.style.objectFit = "contain";
  const cables = [0, 1].map(() => { const c = $("i", "layer", el); css(c, { inset: "auto", width: "2px", background: "linear-gradient(#1a1a1c, #2b2b2e)" }); return c; });
  const dust = img(A("smoke.webp"), "smoke", el); css(dust, { opacity: .18 });
  hit(M.vault.t, 1.3, .2, .35);
  return (t) => {
    const l = t - M.vault.t, d = p(l, 0, .8);
    tf(bg, `scale(${mix(1.08, 1.14, d).toFixed(4)}) translateY(${mix(-1, 1, d).toFixed(2)}%)`);
    lasers.forEach((b, i) => { const ang = (i % 2 ? 1 : -1) * (6 + i * 1.2) + 2 * Math.sin(l * 2 + i); css(b, { left: "-10%", top: 46 + i * 5.5 + "%", width: "120%" }); tf(b, `rotate(${ang.toFixed(2)}deg)`); op(b, .55 + .3 * Math.sin(l * 14 + i * 2)); });
    const s = TALL ? 1.75 : 1.02, x = TALL ? 8 : -2;
    tf(subj, `translate(${x}%, ${mix(-14, -2, p(l, 0, .8, E.outC)).toFixed(2)}%) scale(${s}) rotate(${(.6 * Math.sin(l * 2.2)).toFixed(2)}deg)`);
    const r = subj.getBoundingClientRect(), pr = picBox(), iw = Math.min(r.width, r.height * 1672 / 941), ih = iw * 941 / 1672, top = r.top - pr.top + (r.height - ih) / 2;
    cables.forEach((c, i) => { const cx = r.left - pr.left + (r.width - iw) / 2 + [.401, .508][i] * iw; css(c, { left: cx - 1 + "px", top: "-2%", height: Math.max(0, top + 6 + PH * .02) + "px" }); });
    tf(dust, `scale(1.5) translateY(${mix(0, -5, d).toFixed(2)}%)`);
  };
});
function lock(name, src, color, en, cn) {
  return cut(name, null, (el) => {
    const bg = plate(el, A(src), TALL ? "46% 50%" : null); const ret = $("i", "reticle " + color, el); const tag = $("div", "tag " + color, el); tag.innerHTML = `${en}<b>${cn}</b>`;
    const fx = TALL ? 46 : 48, fy = TALL ? 40 : 38;
    css(ret, { left: fx + "%", top: fy + "%" }); css(tag, TALL ? { left: "8%", bottom: "12%" } : { left: `calc(${fx}% + 24cqh)`, top: `calc(${fy}% - 14cqh)` });
    hit(M[name].t, .8, .1, .2, color ? "#9fc2ff" : "#ff8a96");
    return (t) => { const l = t - M[name].t; tf(bg, `scale(${mix(1.3, 1.12, p(l, 0, .4, E.outE)).toFixed(4)})`); const r = p(l, 0, .3, E.outBack); tf(ret, `scale(${mix(2.4, 1, r).toFixed(3)}) rotate(${mix(70, 0, r).toFixed(2)}deg)`); op(ret, p(l, 0, .06)); reveal(tag, t, M[name].t + .08, .25, 1); };
  });
}
lock("lockA", "close-a.webp", "", "TARGET · RED LEADER", "紅不讓隊長");
lock("lockB", "close-b.webp", "blue", "TARGET · BLUE LEADER", "刀槍Blue隊長");
// the captains' stunts: the red captain's combat roll (the camera whips along with it), the blue captain's knee slide, firing
cut("stuntA", null, (el) => {
  // dive, tucked roll, rising, up on one knee firing — one set-up, each frame nudged so he keeps travelling left to right
  // [file, nudge (% of the frame), wide framing, tall framing] — framed high enough that his head stays in as he comes up
  const FRAMES = [["stunt-roll-1.webp", 0, "50% 38%", "33% 50%"], ["stunt-roll.webp", -3, "50% 30%", "64% 50%"], ["stunt-roll-3.webp", 0, "50% 12%", "48% 50%"], ["stunt-roll-4.webp", -2, "50% 14%", "72% 50%"]];
  const frames = FRAMES.map(([src, , wide, tall]) => plate(el, A(src), TALL ? tall : wide));
  const flash = $("i", "layer", el); flash.style.background = `radial-gradient(circle at ${TALL ? 62 : 80}% 46%, rgb(255 120 135 / .7), rgb(255 42 74 / .25) 22%, transparent 48%)`;
  hit(T.rollFire, .95, .1, .26, "#ff8a96");
  return (t) => {
    const l = t - M.stuntA.t, d = p(l, 0, .8, E.ioQ), k = T.rollBeats.reduce((n, b, i) => (t >= b ? i : n), 0);
    frames.forEach((f, i) => {
      const since = t - T.rollBeats[k];   // each frame dissolves in over the one before, on the eighth
      f.style.opacity = i === k ? String(Math.min(1, Math.max(0, since) / .07)) : i === k - 1 && since < .07 ? "1" : "0";
      const dx = TALL ? 0 : FRAMES[i][1], tilt = i === 1 ? -1.5 : i === 0 ? -2.5 : 0;
      tf(f, `translateX(${(dx + mix(1, -1, d)).toFixed(2)}%) scale(${mix(1.12, 1.06, d).toFixed(4)}) rotate(${tilt}deg)`);
    });
    op(flash, t >= T.rollFire ? Math.max(0, 1 - (t - T.rollFire) / .22) : 0);
  };
});
// the blue captain's knee slide: one plate the camera rides with, the spray kept flying off her (drawSpray), a shot on the beat
const SLIDE_MUZZLE = [.4175, .317];
let slideRig = null;
cut("stuntB", null, (el) => {
  const R = rig(el, A("stunt-slide.webp"), 1672 / 941); slideRig = R;
  const shotBeam = beam(el, "blue"), bl = $("i", "bloom blue", el);
  hit(M.stuntB.t, .7, .1, .22, "#9fc2ff"); hit(T.slideFire, .5, .1, .16, "#9fc2ff");
  return (t) => {
    const l = t - M.stuntB.t, d = p(l, 0, M.stuntB.end - M.stuntB.t, E.outQ);
    R.frame(mix(1.24, 1.12, d), TALL ? .6 : .5, .5, TALL ? mix(.53, .47, d) : mix(.54, .46, d), .5);   // 9:16: her, gun hand to face
    const [mx, my] = R.at(...SLIDE_MUZZLE);
    fire(shotBeam, t, T.slideFire, mx, my, 183.6, 1.3 * Math.max(PW, PH), .3); bloomAt(bl, t, T.slideFire, mx, my, 1.3, .26);
  };
});
// before the title the briefing's line comes back to finish itself — 如果你選擇接受…… — and the title is the answer
shot(T.accept[0] - .25, T.title, (el) => {
  const shade = $("i", "layer", el); shade.style.background = "linear-gradient(0deg, rgb(3 3 4 / .8), rgb(3 3 4 / .28) 34%, rgb(3 3 4 / 0) 56%)";
  const box = $("div", "accept", el), en = $("small", "", box, { textContent: "SHOULD YOU CHOOSE TO ACCEPT IT" }), line = $("p", "", box);
  const chars = [..."如果你選擇接受……"].map((c) => $("span", "", line, { textContent: c })), caret = $("i", "caret", line);
  return (t) => {
    const [a, b] = T.accept;
    op(shade, p(t, a - .25, a + .1)); reveal(en, t, a - .2, .45, 1);
    chars.forEach((c, i) => { c.style.display = t >= a + (b - a) * i / chars.length ? "inline" : "none"; });
    op(caret, t < b ? 1 : Math.floor((t - b) / .2) % 2 ? 0 : 1);
  };
});
/** droplets thrown up and back off her knees and heels, in the plate's own coordinates so they ride the camera move */
function drawSpray(t) {
  const s = M.stuntB; if (!slideRig || t < s.t || t >= s.end) return;
  const R = slideRig, rate = 240, life = .55, fade = p(t, s.t, s.t + .08);
  g.globalCompositeOperation = "lighter"; g.lineCap = "round";
  for (let k = Math.floor((t - life) * rate); k <= Math.floor(t * rate); k++) {
    const te = k / rate, age = t - te, lf = life * (.5 + .5 * hash(k, 21)); if (age < 0 || age > lf) continue;
    const e = hash(k, 22), u0 = mix(.58, .82, e), v0 = mix(.7, .62, e) + .02 * hash(k, 23);
    const vu = (.08 + .32 * hash(k, 24)) * (.6 + .6 * e), vv = -(.15 + .45 * hash(k, 25)) * (1.1 - .4 * e);
    const P = (a) => R.at(u0 + vu * a, v0 + vv * a + 1.1 * a * a), [x1, y1] = P(age), [x2, y2] = P(Math.max(0, age - .03)), heat = 1 - age / lf;
    g.strokeStyle = `rgba(${Math.round(200 + 40 * heat)},${Math.round(222 + 25 * heat)},255,${(.5 * heat * fade).toFixed(3)})`; g.lineWidth = (.08 + .12 * hash(k, 26)) * cqh;
    g.beginPath(); g.moveTo(x1, PY + y1); g.lineTo(x2, PY + y2); g.stroke();
  }
  g.globalCompositeOperation = "source-over";
}

// ════ ACT III — the title in the arena, the date, the classic line, the self-destruct ════
let titleFuse = null;
/** The site's mark (components/title-mark.tsx, outlines from lib/title-mark-paths.ts): a 430 × 100 box, glyph i at x = 110 i. */
const CENTRES = MARK_GLYPHS.map((_, i) => i * 110 + 50);
/** the red glow just inside the raised pistol's muzzle (the barrel points straight up) */
const TIP = { x: MARK_MUZZLE_UP.cx, y: +(MARK_MUZZLE_UP.cy + .9).toFixed(2) };
function titleMark(parent) {
  const stops = (list) => list.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("");
  // 遊 carries the agent in both poses: aiming (he fires from it) and pistol raised (where he ends)
  const shape = (i, fill, extra = "", agentFill = fill, cls = "") => `<path d="${MARK_GLYPHS[i]}" fill="${fill}" ${cls ? `class="${cls}"` : ""} ${extra}/>${i === 1
    ? `<path class="${cls} tm-pose-up" d="${MARK_AGENT}" fill="${agentFill}" ${extra}/><path class="${cls} tm-pose-aim" d="${MARK_AGENT_AIM}" fill="${agentFill}" ${extra}/>` : ""}`;
  const box = $("div", "mark", parent);
  box.innerHTML = `<svg class="tm-word" viewBox="0 0 430 100"><defs>
    <linearGradient id="tm-c" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="98">${stops([[0, "#fff"], [.3, "#e9ecef"], [.47, "#9aa1aa"], [.53, "#f6f7f8"], [.7, "#c4c9cf"], [1, "#5f666f"]])}</linearGradient>
    <linearGradient id="tm-g" gradientUnits="userSpaceOnUse" x1="0" y1="18" x2="0" y2="86">${stops([[0, "#d9dde2"], [.28, "#7d848d"], [.5, "#2c3036"], [.52, "#5a6068"], [1, "#1d2025"]])}</linearGradient>
    <linearGradient id="tm-rr" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="430" y2="0">${stops([[0, "#ff2a4a", .9], [.4, "#ff2a4a", .55], [.56, "#ff2a4a", 0]])}</linearGradient>
    <linearGradient id="tm-rb" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="430" y2="0">${stops([[.44, "#2f74ff", 0], [.6, "#2f74ff", .55], [1, "#4a8bff", .9]])}</linearGradient>
    <linearGradient id="tm-sh" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="0">${stops([[0, "#fff", 0], [.5, "#fff", .95], [.56, "#ffd6dc", .8], [1, "#fff", 0]])}</linearGradient>
    <radialGradient id="tm-glow">${stops([[0, "#ff2a4a", .85], [.45, "#ff2a4a", .28], [1, "#ff2a4a", 0]])}</radialGradient>
    <radialGradient id="tm-dotg">${stops([[0, "#fff"], [.28, "#ff9aa8"], [.62, "#ff2a4a"], [1, "#c2102a"]])}</radialGradient>
    ${CENTRES.map((cx, i) => `<clipPath id="tm-i${i}"><circle class="tm-iris" cx="${cx}" cy="50" r="76"/></clipPath>`).join("")}
    <clipPath id="tm-w">${MARK_GLYPHS.map((d) => `<path d="${d}"/>`).join("")}<path d="${MARK_AGENT}"/></clipPath>
    <filter id="tm-ds" x="-10%" y="-30%" width="120%" height="170%"><feDropShadow dx="0" dy="2.6" stdDeviation="3.2" flood-color="#000" flood-opacity=".62"/></filter>
    <filter id="tm-rim" x="-5%" y="-10%" width="110%" height="120%"><feGaussianBlur stdDeviation=".9"/></filter>
  </defs><g filter="url(#tm-ds)">${MARK_GLYPHS.map((_, i) => `<g clip-path="url(#tm-i${i})"><g filter="url(#tm-rim)">${shape(i, "url(#tm-rr)", 'transform="translate(-1.6 -.3)"')}${shape(i, "url(#tm-rb)", 'transform="translate(1.6 -.3)"')}</g>${shape(i, "url(#tm-c)", "", "url(#tm-g)")}${shape(i, "none", "", "none", "tm-edge")}${i === 1 ? `<path class="tm-agent-line tm-pose-up" d="${MARK_AGENT}" fill="none" stroke="url(#tm-c)"/><path class="tm-agent-line tm-pose-aim" d="${MARK_AGENT_AIM}" fill="none" stroke="url(#tm-c)"/><g class="tm-muzzle"><circle cx="${TIP.x}" cy="${TIP.y}" r="3.6" fill="url(#tm-glow)"/><circle cx="${TIP.x}" cy="${TIP.y}" r="1.2" fill="url(#tm-dotg)"/></g>` : ""}</g>`).join("")}</g>
  <g clip-path="url(#tm-w)"><rect class="tm-sheen" x="-120" y="-10" width="120" height="120" fill="url(#tm-sh)"/></g>
  <line class="tm-shot" x1="${MARK_MUZZLE.cx}" y1="${MARK_MUZZLE.cy}" x2="${MARK_DOT.cx}" y2="${MARK_DOT.cy}" pathLength="1"/>
  <circle class="tm-flash" cx="${MARK_MUZZLE.cx}" cy="${MARK_MUZZLE.cy}" r="7" fill="url(#tm-glow)"/>
  <circle class="tm-halo" cx="${MARK_DOT.cx}" cy="${MARK_DOT.cy}" r="${MARK_DOT.r * 2.4}" fill="url(#tm-glow)"/>
  <circle class="tm-laser" cx="${MARK_DOT.cx}" cy="${MARK_DOT.cy}" r="${MARK_DOT.r * .74}" fill="url(#tm-dotg)"/>
  ${CENTRES.map((cx) => `<circle class="tm-dot" cx="${cx}" cy="50" r="9" fill="#fff"/>`).join("")}</svg>`;
  const q = (sel) => [...box.querySelectorAll(sel)];
  return { box, irises: q(".tm-iris"), dots: q(".tm-dot"), shot: box.querySelector(".tm-shot"), flash: box.querySelector(".tm-flash"), laser: box.querySelector(".tm-laser"), halo: box.querySelector(".tm-halo"), sheen: box.querySelector(".tm-sheen"),
    aim: q(".tm-pose-aim"), up: q(".tm-pose-up"), muzzle: box.querySelector(".tm-muzzle") };
}
// One end frame in the arena, on the Mission still playing: the montage fuse reaches its end and the title is blown out (the
// slam), the agent in 遊 fires, the date is slammed in like a release-date card, the classic line is typed, and on 007's last
// chord the self-destruct slams in where the line was — then the frame burns.
shot(T.title, T.duration + 1, (el) => {
  // what burns at the end: the whole frame; the smoke left behind stays
  const frame = $("div", "layer", el), residue = img(A("smoke.webp"), "smoke", el); css(residue, { opacity: 0 });
  const room = plate(frame, A("arena.webp")); room.style.filter = "brightness(.46) saturate(1.1)";
  const smoke = img(A("smoke.webp"), "smoke", frame); css(smoke, { opacity: 0 });
  const scrim = $("i", "layer", frame); scrim.style.background = "radial-gradient(ellipse 64% 60% at 50% 48%, rgb(3 3 4 / .66), rgb(3 3 4 / .3) 62%, rgb(3 3 4 / .1))";
  const rakeR = $("i", "flare", frame), rakeB = $("i", "flare blue", frame);
  const rings = ["", "warm", "red"].map((c) => $("i", "shock " + c, frame));
  const title = $("div", "title finale", frame);
  const mark = titleMark(title);
  const rule = $("div", "rule", title), sub = $("div", "sub", title); sub.innerHTML = "<span>AUTUMN</span><i></i><span>AGENTS</span>";
  const date = $("div", "date", title); date.innerHTML = '<div class="d"><b>10.29</b><span>THU</span></div>';
  const scan = $("i", "scan", date);
  const where = $("div", "where", title); where.innerHTML = "12:00<b>・</b>六度空間 LAZERTREKS";
  const VOW = "一如往常，若你被雷射擊中，主辦單位將否認知情。", HOT = VOW.indexOf("主辦單位將否認知情");
  const vow = $("p", "disavow", frame), vowChars = [...VOW].map((c, i) => $("span", i >= HOT && i < HOT + 9 ? "hot" : "", vow, { textContent: c }));
  const msg = $("div", "destruct", frame), msgLine = $("p", "", msg), msgEn = $("small", "", msg, { textContent: "THIS MESSAGE WILL SELF-DESTRUCT" });
  [..."本訊息將自動銷毀"].forEach((c) => $("span", "", msgLine, { textContent: c }));
  const count = $("b", "count", msgLine), alarm = $("i", "layer alarm", frame);
  // the billing block, as under any one-sheet
  const billing = $("div", "billing", frame);
  billing.innerHTML = "<p>EGROUP 出品<b>·</b>秋遊特務製作委員會<b>·</b>主演 紅不讓隊長 × 刀槍BLUE隊長<b>·</b>全體探員</p><p>拍攝地 六度空間 LAZERTREKS<b>·</b>戰後補給 飯店下午茶<b>·</b>10.29 僅此一場</p>";
  hit(T.title, 2.6, .3, 1);                          // the fuse reaches the end: the blast
  sparkBursts.push([T.title, PW / 2, PH * (TALL ? .26 : .26), 90, TALL ? 90 : 76, ""], [T.date, PW / 2, PH * (TALL ? .42 : .54), 50, 50, ""]);
  const SHOT = T.laser - T.title, RAISE = SHOT + .46;   // the agent fires, the laser dot lands on 特 — then he raises his pistol
  hit(T.laser, .6, .1, .22, "#ff8a96"); hit(T.date, 1.5, .2, .42, "#fff3e0"); hit(T.destruct, 1.9, .22, .75, "#ffffff");   // ignition
  T.countdown.forEach((c, i) => hit(c, .5 + .25 * i, .1, .07 + .04 * i, "#ff4a5f")); hit(T.burn, .8, .16, .22, "#ffb04a");
  const tfb = (e, v) => { e.style.transformBox = "fill-box"; e.style.transformOrigin = "center"; e.style.transform = v; };
  /** a slam: in large and hot, settled in a third of a second */
  const slam = (e, l, from, dur = .3) => {
    op(e, l >= 0 ? 1 : 0); if (l < 0) return;
    tf(e, `scale(${mix(from, 1, p(l, 0, dur, E.outE)).toFixed(4)})`);
    e.style.filter = l < .18 ? `blur(${((.18 - l) / .18 * 1.3 * cqh).toFixed(2)}px) brightness(${(1 + 2.2 * (.18 - l) / .18).toFixed(2)})` : "none";
  };
  mark.dots.forEach((d) => { d.style.opacity = "0"; });
  return (t) => {
    const l = t - T.title;
    tf(frame, `scale(${(1 + .006 * l).toFixed(4)})`);   // a slow push over the whole end frame
    tf(room, `scale(${(1.16 + .012 * l).toFixed(4)}) translateY(${(-1 + .35 * l).toFixed(2)}%)`);
    tf(smoke, `scale(${(1.25 + .02 * l).toFixed(4)}) rotate(${(-3 + .6 * l).toFixed(2)}deg)`); op(smoke, .3 * p(l, .05, 1));
    // a shock ring off each slam: the title, the date, the self-destruct
    [[T.title, TALL ? 26 : 26.4], [T.date, TALL ? 42 : 54.4], [T.destruct, TALL ? 60 : 73.6]].forEach(([t0, y], i) => {
      const k = p(t, t0, t0 + .55, E.outC); css(rings[i], { left: "50%", top: y + "%" });
      op(rings[i], t >= t0 && k < 1 ? (1 - k) * .9 : 0); tf(rings[i], `scale(${(.2 + 7 * k).toFixed(3)})`);
    });
    css(rakeR, { left: "30%", top: TALL ? "16%" : "9%" }); tf(rakeR, `rotate(-6deg) scaleX(${(.6 + .4 * p(l, 0, 1.2, E.outC)).toFixed(3)})`); op(rakeR, .3 * p(l, .3, .9));
    css(rakeB, { left: "70%", top: TALL ? "80%" : "92%" }); tf(rakeB, `rotate(5deg) scaleX(${(.6 + .4 * p(l, 0, 1.2, E.outC)).toFixed(3)})`); op(rakeB, .3 * p(l, .3, .9));
    // the title: out of the blast at once
    slam(title, l, 1.45, .32);
    mark.irises.forEach((c) => tfb(c, "scale(1)"));
    // the shot
    const s1 = p(l, SHOT, SHOT + .42);
    mark.shot.style.strokeDasharray = "1 1"; mark.shot.style.strokeDashoffset = (s1 < .45 ? 1 - s1 / .45 : -(s1 - .45) / .55).toFixed(3);
    mark.shot.style.opacity = s1 > 0 && s1 < 1 ? String(s1 < .45 ? 1 : 1 - (s1 - .45) / .55) : "0";
    const f1 = p(l, SHOT - .03, SHOT + .47); op(mark.flash, f1 > 0 && f1 < 1 ? (f1 < .25 ? f1 / .25 : 1 - (f1 - .25) / .75) : 0); tfb(mark.flash, `scale(${(f1 < .25 ? .3 + 1.5 * f1 / .25 : 1.8 - 1.2 * (f1 - .25) / .75).toFixed(3)})`);
    const d1 = p(l, SHOT + .16, SHOT + .66, E.outBack); op(mark.laser, d1 > 0 ? 1 : 0); tfb(mark.laser, `scale(${(2.6 - 1.6 * d1).toFixed(3)})`);
    op(mark.halo, d1 * (.75 + .2 * Math.sin(l * 4)));
    // arm out until the shot has landed, then the pistol comes up beside his face and its muzzle glows
    const up = p(l, RAISE, RAISE + .2, E.outBack), m1 = p(l, RAISE + .14, RAISE + .64, E.outC);
    for (const e of mark.aim) e.style.opacity = String(1 - p(l, RAISE, RAISE + .12));
    for (const e of mark.up) e.style.opacity = String(Math.min(1, up));   // opacity only: the rim copies keep their own offset transform
    op(mark.muzzle, m1 * (.85 + .15 * Math.sin(l * 3))); tfb(mark.muzzle, `scale(${(2.2 - 1.2 * m1).toFixed(3)})`);
    mark.sheen.style.transform = `translateX(${mix(-140, 560, p(l, .3, 1.4, E.ioC)).toFixed(1)}px)`;
    tf(rule, `scaleX(${p(l, .2, .7, E.outE).toFixed(3)})`); reveal(sub, t, T.title + .3, .7, 1.4);
    for (const w of sub.querySelectorAll("span")) w.style.letterSpacing = mix(1.3, .82, p(l, .3, 1.4, E.outC)).toFixed(3) + "em";
    // the date, on the brass: slammed in, a laser reads across it, then where and when
    const ld = t - T.date; slam(date, ld, 1.55, .3);
    const sc = p(ld, .1, .6, E.ioC); css(scan, { left: mix(-4, 104, sc).toFixed(2) + "%" }); op(scan, ld > .1 ? Math.sin(Math.PI * sc) : 0);
    reveal(where, t, T.date + .26, .5, 1); reveal(billing, t, T.date + .45, .8, .6);
    // the classic line, typed under the date; it gives its place to the self-destruct warning when the count starts
    const [va, vb] = T.disavow, C0 = T.countdown[0], gone = p(t, C0 - .06, C0 + .08);
    op(vow, p(t, va - .12, va) * (1 - gone)); vow.style.filter = gone > 0 ? `blur(${(gone * 1.4 * cqh).toFixed(2)}px)` : "none";
    vowChars.forEach((c, i) => { c.style.visibility = t >= va + (vb - va) * i / vowChars.length ? "visible" : "hidden"; });
    // the self-destruct: five counts on the Mission's beat — a red alarm pulse and the frame jolting, harder each time — then
    // ignition on 007's chord
    const k = T.countdown.reduce((n, c, i) => (t >= c ? i : n), -1), lk = k >= 0 ? t - T.countdown[k] : 9;
    op(msg, t >= C0 - .02 ? 1 : 0); reveal(msgEn, t, C0 + .08, .35, 1); slam(msgLine, t - C0, 1.45, .28);
    count.textContent = t >= T.destruct ? "0" : String(5 - Math.max(0, k));
    tf(count, `scale(${mix(1.8, 1, p(t >= T.destruct ? t - T.destruct : lk, 0, .18, E.outE)).toFixed(3)})`);
    const ignite = t >= T.destruct ? Math.exp(-(t - T.destruct) / .35) : 0;
    op(alarm, k >= 0 ? Math.max(Math.exp(-lk / .3) * (.3 + .1 * k), ignite) : 0);
    const jolt = k >= 0 && t < T.destruct && lk < .1 ? (.4 + .3 * k) * (hash(Math.floor(t * 48), k + 3) - .5) * 2 : 0;
    frame.style.translate = `${jolt.toFixed(2)}% 0`;
    op(residue, 0);
  };
});
const BURN = 1.8;
/** The film burn (the site's lib/film-burn.ts, made a pure function of time): holes catch at seed points and spread through a
 *  noise field; ahead of the front the picture scorches, the front glows white-hot to red, behind it is black. */
const endBurn = (() => {
  const W = PW, H = PH, gw = 360, gh = Math.round(gw * H / W), aspect = W / H;
  const seeds = TALL ? [[.5, .7, 0], [.2, .3, .1], [.82, .22, .18], [.86, .86, .28], [.12, .9, .34]] : [[.5, .78, 0], [.18, .28, .16], [.86, .22, .24], [.9, .86, .34], [.06, .9, .4]];
  const fr = (v) => v - Math.floor(v), hh = (x, y) => fr(Math.sin(x * 127.1 + y * 311.7 + 7 * 74.7) * 43758.5453);
  const sm = (x, y, f) => { const X = Math.floor(x * f), Y = Math.floor(y * f), fx = x * f - X, fy = y * f - Y, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return mix(mix(hh(X, Y), hh(X + 1, Y), u), mix(hh(X, Y + 1), hh(X + 1, Y + 1), u), v); };
  const noise = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const x = i / gw * aspect, y = j / gh; noise[j * gw + i] = .55 * sm(x, y, 2.4) + .3 * sm(x, y, 6.5) + .15 * sm(x, y, 17); }
  const mk = () => { const c = document.createElement("canvas"); c.width = gw; c.height = gh; return c; };
  const holeC = mk(), charC = mk(), glowC = mk(), hx = holeC.getContext("2d"), cx = charC.getContext("2d"), gx = glowC.getContext("2d");
  const hole = hx.createImageData(gw, gh), char = cx.createImageData(gw, gh), glow = gx.createImageData(gw, gh);
  const spread = (t) => .08 + .34 * Math.max(0, t - T.burn);    // catches at once, the picture is gone by about 1.6 s
  const field = (t, cb) => {
    const sp = spread(t);
    for (let j = 0, k = 0; j < gh; j++) for (let i = 0; i < gw; i++, k++) {
      let v = -9; for (const [sx, sy, d] of seeds) { const f = (sp - d) * 1.7 - Math.hypot((i / gw - sx) * aspect * .55, j / gh - sy); if (f > v) v = f; }
      cb(k, i, j, v + (noise[k] - 1) * .45);
    }
  };
  // where the front was at each instant, so the embers it throws are a function of time too
  const fronts = [];
  for (let n = 0; n <= 60; n++) { const t = T.burn + n / 60 * BURN, list = []; field(t, (k, i, j, v) => { if (v > -.05 && v < .01 && (i * 7 + j * 3) % 11 === 0) list.push([i / gw, j / gh]); }); fronts.push(list); }
  function draw(t) {
    if (t < T.burn) return;
    const flick = .88 + .12 * Math.sin(t * 23) * Math.sin(t * 7.3 + 1);
    field(t, (k, i, j, v) => {
      const o = k * 4;
      if (v > 0) { const bb = Math.min(1, v / .12); hole.data[o] = mix(52, 3, bb); hole.data[o + 1] = mix(22, 3, bb); hole.data[o + 2] = mix(8, 4, bb); hole.data[o + 3] = 255; char.data[o + 3] = 0; }
      else { hole.data[o + 3] = 0; if (v > -.2) { const q = 1 + v / .2; char.data[o] = mix(70, 18, q * q); char.data[o + 1] = mix(34, 8, q * q); char.data[o + 2] = mix(12, 3, q * q); char.data[o + 3] = Math.round(255 * Math.min(.94, q * q * 1.05)); } else char.data[o + 3] = 0; }
      if (v > -.075 && v < .03) { const r = v <= 0 ? 1 + v / .075 : 1 - v / .03; glow.data[o] = 255; glow.data[o + 1] = Math.round(mix(52, 238, r * r)); glow.data[o + 2] = Math.round(mix(8, 200, r * r * r)); glow.data[o + 3] = Math.round(255 * Math.min(1, r * 1.3) * flick); }
      else glow.data[o + 3] = 0;
    });
    hx.putImageData(hole, 0, 0); cx.putImageData(char, 0, 0); gx.putImageData(glow, 0, 0);
    const soft = Math.max(1, Math.round(H / 170));
    g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.filter = `blur(${soft * 2}px)`; g.drawImage(charC, 0, PY, W, H);
    g.filter = `blur(${soft}px)`; g.drawImage(holeC, 0, PY, W, H);
    g.globalCompositeOperation = "lighter";
    g.filter = `blur(${soft * 1.4}px)`; g.drawImage(glowC, 0, PY, W, H);
    g.filter = `blur(${Math.round(H / 24)}px)`; g.globalAlpha = .9; g.drawImage(glowC, 0, PY, W, H);
    g.restore();
  }
  /** sparks (streak and fall), embers (drift up, wink out) and smoke, each born on the front at its own instant */
  function motes(t) {
    if (t < T.burn) return;
    g.save();
    for (let k = 0; k < 520; k++) {
      const born = T.burn + hash(k, 61) * BURN * .92, age = t - born; if (age < 0) continue;
      const list = fronts[Math.min(60, Math.round((born - T.burn) / BURN * 60))]; if (!list.length) continue;
      const [fx0, fy0] = list[Math.floor(hash(k, 62) * list.length)], x0 = fx0 * PW, y0 = PY + fy0 * PH, kind = hash(k, 63);
      if (kind < .2) {   // spark
        const life = .35 + .45 * hash(k, 64); if (age > life) continue;
        const a = -Math.PI / 2 + (hash(k, 65) - .5) * 2.4, sp = (12 + 26 * hash(k, 66)) * cqh, vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
        const P = (u) => [x0 + vx * u, y0 + vy * u + 50 * cqh * u * u], [x1, y1] = P(age), [x2, y2] = P(Math.max(0, age - .03));
        streak(x1, y1, x2, y2, 1 - age / life, .22 * cqh);
      } else if (kind < .78) {   // ember
        const life = .8 + 1.2 * hash(k, 67); if (age > life) continue;
        const q = 1 - age / life, x = x0 + (hash(k, 68) - .5) * 5 * cqh * age + Math.sin(age * 5 + k) * .6 * cqh, y = y0 - (2.5 + 9 * hash(k, 69)) * cqh * age;
        const tw = .65 + .35 * Math.sin(age * 31 + k);
        g.globalCompositeOperation = "lighter"; g.fillStyle = `rgba(255,${Math.round(110 + 120 * q)},${Math.round(40 + 90 * q * q)},${(q * tw).toFixed(3)})`;
        g.beginPath(); g.arc(x, y, (.12 + .2 * hash(k, 70)) * cqh * (.55 + .45 * q), 0, Math.PI * 2); g.fill();
      } else {   // smoke
        const life = 1.6 + 1.6 * hash(k, 71); if (age > life) continue;
        const q = 1 - age / life, x = x0 + (hash(k, 72) - .5) * 3 * cqh * age, y = y0 - (2 + 4 * hash(k, 73)) * cqh * age, r = (1 + 1.6 * hash(k, 74)) * cqh * (1 + age * 1.8);
        const w = Math.min(1, age / .8), cr = Math.round(mix(150, 160, w)), cg = Math.round(mix(96, 154, w)), cb = Math.round(mix(60, 150, w)), al = .13 * q * Math.min(1, age * 3);
        const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${cr},${cg},${cb},${al.toFixed(3)})`); gr.addColorStop(.6, `rgba(${cr},${cg},${cb},${(al * .4).toFixed(3)})`); gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        g.globalCompositeOperation = "source-over"; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    }
    g.restore();
    // the flare where it catches
    const l = t - T.burn;
    if (l < .42) { const q = l / .42, [sx, sy] = seeds[0], x = sx * PW, y = PY + sy * PH, R = Math.max(PW, PH) * (.08 + .35 * q), gr = g.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, `rgba(255,244,222,${(.85 * (1 - q)).toFixed(3)})`); gr.addColorStop(.35, `rgba(255,160,70,${(.35 * (1 - q)).toFixed(3)})`); gr.addColorStop(1, "rgba(255,90,30,0)");
      g.globalCompositeOperation = "lighter"; g.fillStyle = gr; g.fillRect(0, 0, SW, SH); g.globalCompositeOperation = "source-over"; }
  }
  return { draw, motes };
})();
// ── the clock ──
function seek(t) {
  for (const s of shots) s.el.style.display = t >= s.a && t < s.b ? "block" : "none";
  for (const s of shots) if (t >= s.a && t < s.b) s.update(t);
  applyWhips(t);
  camera(t);
  g.clearRect(0, 0, SW, SH);
  drawFuses(t); drawWireBurn(t); drawSpray(t); drawBurns(t); drawSparks(t);
  endBurn.draw(t); endBurn.motes(t);
  if (titleFuse) { const tp = titleFuse(t); if (tp) fuseHead(t, T.title, (te) => titleFuse(Math.max(te, T.title)) || tp, 1.1); }
  embers(t, T.title, T.burn + .2, 46, .7);
}
const fast = [[T.dots[0] - .05, T.irisOpen + .3], [T.turn - .1, T.titles[0] + .5], [T.titles[3], T.titles[3] + .3], [T.button - .05, T.button + .4], [T.catch - .3, T.catch + .5], [T.cardA, T.cardB + .3], [T.missionLine, T.missionLine + .4], [T.montage[0].t, T.title + 1.2], [T.laser - .05, T.laser + .5], [T.date - .05, T.date + .5], [T.clash - .05, T.clash + .5], ...T.countdown.map((c) => [c - .02, c + .2]), [T.destruct - .05, T.destruct + .45]];
const samplesAt = (t) => (fast.some(([a, b]) => t >= a && t <= b) ? 8 : 4);

await document.fonts.load('900 100px "Noto Serif TC"', "今年秋天兩位老闆一個戰場只有一隊能贏秋遊特務一如往常若你被雷射擊中主辦單位將否認知情");
await document.fonts.load('900 100px "Noto Sans TC"', "任務簡報攻佔六度空間紅隊藍隊長不讓刀槍Blue");
await document.fonts.load('700 100px "Noto Sans TC"', "你的任務如果你選擇接受中午十二點集合感應背心雷射槍週四戰後飯店下午茶保護老闆");
await document.fonts.load('500 40px "Cinzel"', "THIS AUTUMN TWO BOSSES ONE BATTLEFIELD AUTUMN AGENTS");
await document.fonts.load('700 40px "Cinzel"', "AUTUMN AGENTS");
await document.fonts.load('600 40px "Oswald"', "AUTUMN AGENTS 10.29 THU");
await document.fonts.load('500 40px "JetBrains Mono"', "MISSION BRIEFING 10.29 代號紅不讓刀槍Blue隊長");
await document.fonts.load('700 40px "JetBrains Mono"', "MISSION 10.29 THU 12:00 六度空間 LAZERTREKS・");
await document.fonts.load('700 40px "JetBrains Mono"', "LOCATION GEAR VIP AFTER TARGET RED BLUE LEADER THU 12:00");
await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
seek(0);
window.FILM = { duration: T.duration, fps: T.fps, isReady: true, seek, samplesAt };
