/**
 * A film burn on a canvas: holes open at seed points and spread through a noise field. Ahead of the front the picture
 * scorches brown, the front itself glows white-hot through amber to red, and behind it the picture is gone — covered with a
 * backing colour ("cover", for a canvas laid over live content) or cut away so whatever is under the canvas shows through
 * ("reveal", for a picture drawn into the canvas). Computed on a coarse grid and scaled up with smoothing and blur, so the
 * edges stay soft and organic. Embers and smoke lift off the front.
 */
export type BurnSeed = { x: number; y: number; delay: number };
export type BurnMode = { mode: "cover"; backing: [number, number, number] } | { mode: "reveal"; source: CanvasImageSource };

const mix = (a: number, b: number, x: number) => a + (b - a) * x;
const fract = (v: number) => v - Math.floor(v);
/** How far ahead of the front the picture scorches, and how wide the glowing rim is (in burn units). */
const SCORCH = .2, RIM = .075;

export function createFilmBurn(width: number, height: number, seeds: BurnSeed[], seed = 1) {
  const gw = Math.min(360, Math.max(48, Math.round(width / 3))), gh = Math.max(16, Math.round(gw * height / width)), aspect = width / height;
  const hash = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453);
  const smooth = (x: number, y: number, f: number) => {
    const X = Math.floor(x * f), Y = Math.floor(y * f), fx = x * f - X, fy = y * f - Y, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return mix(mix(hash(X, Y), hash(X + 1, Y), u), mix(hash(X, Y + 1), hash(X + 1, Y + 1), u), v);
  };
  const noise = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const x = i / gw * aspect, y = j / gh; noise[j * gw + i] = .55 * smooth(x, y, 2.4) + .3 * smooth(x, y, 6.5) + .15 * smooth(x, y, 17); }
  const make = () => { const c = document.createElement("canvas"); c.width = gw; c.height = gh; return c; };
  const holeC = make(), charC = make(), glowC = make();
  const holeX = holeC.getContext("2d")!, charX = charC.getContext("2d")!, glowX = glowC.getContext("2d")!;
  const hole = holeX.createImageData(gw, gh), char = charX.createImageData(gw, gh), glow = glowX.createImageData(gw, gh);
  /** Cells on the burning front this frame, as fractions of the surface: where embers lift off. */
  const front: [number, number][] = [];

  function draw(ctx: CanvasRenderingContext2D, progress: number, how: BurnMode, time = 0, rect?: [number, number, number, number]) {
    front.length = 0;
    const h = hole.data, c = char.data, g = glow.data, cover = how.mode === "cover";
    const back = cover ? how.backing : [0, 0, 0];
    // the rim breathes a little, as fire does
    const flick = .88 + .12 * Math.sin(time * 23) * Math.sin(time * 7.3 + 1);
    for (let j = 0, k = 0; j < gh; j++) for (let i = 0; i < gw; i++, k++) {
      let v = -9;
      for (const s of seeds) { const f = (progress - s.delay) * 1.7 - Math.hypot((i / gw - s.x) * aspect * .55, j / gh - s.y); if (f > v) v = f; }
      // the noise only ever holds the fire back, so at progress 0 nothing has burned and every hole starts as a point
      v += (noise[k] - 1) * .45;
      const o = k * 4;
      // burned through
      if (v > 0) {
        h[o] = back[0]; h[o + 1] = back[1]; h[o + 2] = back[2]; h[o + 3] = 255;
        // just behind the front the hole's edge still smoulders (cover: brown fading into the backing)
        const b = Math.min(1, v / .12);
        if (cover) { h[o] = mix(52, back[0], b); h[o + 1] = mix(22, back[1], b); h[o + 2] = mix(8, back[2], b); }
        c[o + 3] = 0;
      } else { h[o + 3] = 0; }
      // scorch ahead of the front: the picture browns, then blackens right at the edge
      if (v <= 0 && v > -SCORCH) {
        const s = 1 + v / SCORCH;
        c[o] = mix(70, 18, s * s); c[o + 1] = mix(34, 8, s * s); c[o + 2] = mix(12, 3, s * s); c[o + 3] = Math.round(255 * Math.min(.94, s * s * 1.05));
      } else if (v <= -SCORCH) c[o + 3] = 0;
      // the burning rim: white at the edge, amber, orange, a red fringe; a thin smoulder just inside the hole
      if (v > -RIM && v < .03) {
        const r = v <= 0 ? 1 + v / RIM : 1 - v / .03;
        g[o] = 255; g[o + 1] = Math.round(mix(52, 238, r * r)); g[o + 2] = Math.round(mix(8, 200, r * r * r)); g[o + 3] = Math.round(255 * Math.min(1, r * 1.3) * flick);
        if (r > .55 && (i * 7 + j * 3) % 7 === 0) front.push([i / gw, j / gh]);
      } else g[o + 3] = 0;
    }
    holeX.putImageData(hole, 0, 0); charX.putImageData(char, 0, 0); glowX.putImageData(glow, 0, 0);
    const [X, Y, W, H] = rect || [0, 0, ctx.canvas.width, ctx.canvas.height], soft = Math.max(1, Math.round(Math.min(W, H) / 170));
    ctx.save();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    if (!cover) { ctx.globalCompositeOperation = "source-over"; ctx.filter = "none"; ctx.drawImage(how.source, X, Y, W, H); }
    ctx.filter = `blur(${soft * 2}px)`;
    ctx.globalCompositeOperation = cover ? "source-over" : "source-atop";
    ctx.drawImage(charC, X, Y, W, H);
    ctx.filter = `blur(${soft}px)`;
    ctx.globalCompositeOperation = cover ? "source-over" : "destination-out";
    ctx.drawImage(holeC, X, Y, W, H);
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = `blur(${soft * 1.4}px)`;
    ctx.drawImage(glowC, X, Y, W, H);
    ctx.filter = `blur(${Math.max(3, Math.round(Math.min(W, H) / 24))}px)`;
    ctx.globalAlpha = .9;
    ctx.drawImage(glowC, X, Y, W, H);
    ctx.restore();
    return front;
  }
  return { draw };
}

type Mote = { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; kind: 0 | 1 | 2 };
/**
 * What the fire throws off, in CSS pixels on a canvas already scaled to them: sparks that streak and fall, embers that drift up
 * and wink out, and smoke that billows and thins. `spawn` takes the burn's front cells; `step` moves and draws everything.
 */
export function createEmbers(width: number, height: number, ox = 0, oy = 0) {
  const motes: Mote[] = [], scale = Math.max(.6, Math.min(1.6, Math.min(width, height) / 400));
  return {
    get count() { return motes.length; },
    spawn(front: [number, number][], n: number, smokeShare = .25) {
      for (let k = 0; k < n && front.length; k++) {
        const [fx, fy] = front[(Math.random() * front.length) | 0], roll = Math.random();
        const kind: Mote["kind"] = roll < smokeShare ? 2 : roll < smokeShare + .18 ? 0 : 1;
        const x = ox + fx * width, y = oy + fy * height;
        if (kind === 0) { const a = -Math.PI / 2 + (Math.random() - .5) * 2.4, sp = (120 + Math.random() * 260) * scale; motes.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: .35 + Math.random() * .45, size: (1 + Math.random()) * scale, kind }); }
        else if (kind === 1) motes.push({ x, y, vx: (Math.random() - .5) * 46 * scale, vy: -(24 + Math.random() * 90) * scale, age: 0, life: .7 + Math.random() * 1.1, size: (.8 + Math.random() * 1.8) * scale, kind });
        else motes.push({ x, y, vx: (Math.random() - .5) * 22 * scale, vy: -(22 + Math.random() * 40) * scale, age: 0, life: 1.4 + Math.random() * 1.6, size: (7 + Math.random() * 12) * scale, kind });
      }
    },
    step(ctx: CanvasRenderingContext2D, dt: number, smokeAlpha = .12) {
      for (let i = motes.length - 1; i >= 0; i--) {
        const m = motes[i]; m.age += dt; if (m.age > m.life) { motes.splice(i, 1); continue; }
        const px = m.x, py = m.y;
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.kind === 0) m.vy += 520 * scale * dt;
        else if (m.kind === 1) { m.vy -= 14 * dt; m.vx += Math.sin((m.age + m.y * .01) * 6) * 30 * dt; }
        else { m.vy -= 4 * dt; m.vx *= 1 - .4 * dt; }
        const k = 1 - m.age / m.life;
        if (m.kind === 2) {
          const r = m.size * (1 + m.age * 1.8), gr = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r), a = smokeAlpha * k * Math.min(1, m.age * 3), w = Math.min(1, m.age / .8);
          const cr = Math.round(mix(150, 160, w)), cg = Math.round(mix(96, 154, w)), cb = Math.round(mix(60, 150, w));
          gr.addColorStop(0, `rgba(${cr},${cg},${cb},${a.toFixed(3)})`); gr.addColorStop(.6, `rgba(${cr},${cg},${cb},${(a * .4).toFixed(3)})`); gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
          ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.fill();
        } else if (m.kind === 0) {
          ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
          ctx.strokeStyle = `rgba(255,${Math.round(150 + 100 * k)},${Math.round(60 + 140 * k * k)},${k.toFixed(3)})`; ctx.lineWidth = m.size;
          ctx.beginPath(); ctx.moveTo(px - (m.x - px) * 2, py - (m.y - py) * 2); ctx.lineTo(m.x, m.y); ctx.stroke();
        } else {
          const tw = .65 + .35 * Math.sin(m.age * 31 + m.x);
          ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = `rgba(255,${Math.round(110 + 120 * k)},${Math.round(40 + 90 * k * k)},${(k * tw).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(m.x, m.y, m.size * (.55 + .45 * k), 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalCompositeOperation = "source-over";
    },
  };
}
