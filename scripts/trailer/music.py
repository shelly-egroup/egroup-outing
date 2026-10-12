"""The trailer's score from the two supplied recordings (007 and Mission), laid under the picture in scripts/trailer/timeline.json.

  node scripts/trailer/render-score.mjs --over-music --out .trailer-build/weight.wav     (the trailer's hits, retuned)
  python scripts/trailer/music.py --007 path/to/007.m4a --mission path/to/Mission.m4a
  (needs numpy, scipy and ffmpeg with rubberband: FFMPEG_PATH, or `pip install imageio-ffmpeg`)

The recordings are quiet, mono, 64 kb/s captures with a steady broadband noise floor only 10–20 dB under the music, so each
is cleaned first: a stationary noise estimate per frequency bin and a decision-directed Wiener gain held above a −14 dB
floor (more would turn the music watery), smoothed in frequency and time; then rumble out, the 200 Hz room bump down and a
little presence back. The picture leads; the music is fitted to it (source times are transients measured in these takes):

  0 → ignite        007 0.650–10.990 s (F♯ minor), stretched without changing pitch to fill the cold open: the vamp under the
                    dots, the band entering on the first title card; from its last accent (≈ 9.6 s) it rings out into a
                    reverb tail instead of stopping, so the handover never cuts
  ignite            the Mission's percussion intro comes in under the match (its second half bar, 10.86 s)
  mission           its drum-fill bar (17.277 s), the card on its second beat
  montage[0]        the full band (19.834 s) on the montage's first cut
  title             the melody's downbeat (27.512 s); the music drops out for the blackout before it
  cut               the Mission rings out into a tail as 007's closing chord (100.207 s) takes over for the end card and burn
The Mission parts run 4 % slower (93.75 → 90 bpm) so that its downbeats land on the montage, the vault hit and the title.

Then the trailer's weight — stabs, drums, braams, impacts, the shot, the match, the fuse (render-score.mjs --over-music) —
goes on top; the music gives way under the big hits; and the mix is mastered like the original score: a glue compressor,
then gain into a look-ahead limiter until it sits at −11 LUFS. Writes .trailer-build/score.wav.
"""
import argparse, json, os, subprocess, sys, tempfile
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import uniform_filter1d

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BUILD = os.path.join(ROOT, ".trailer-build")
SR = 48000
PRE = .015            # every entry lands a hair before its transient and crossfades into it

def ffmpeg():
    if os.environ.get("FFMPEG_PATH"): return os.environ["FFMPEG_PATH"]
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"
FF = ffmpeg()

def run(args):
    r = subprocess.run([FF, "-hide_banner"] + args, capture_output=True, text=True)
    if r.returncode: sys.exit(r.stderr)
    return r.stderr

def read(path):
    sr, x = wavfile.read(path)
    x = x.astype(np.float64) / {np.dtype("int16"): 32768.0, np.dtype("int32"): 2147483648.0}.get(x.dtype, 1.0)
    return sr, x

def decode(path, tmp):
    out = os.path.join(tmp, os.path.basename(path) + ".wav")
    run(["-y", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-c:a", "pcm_f32le", out])
    return read(out)[1]

def stretch(x, ratio, tmp, name):
    """Change the length by `ratio` (>1 is slower) without changing pitch."""
    src, dst = os.path.join(tmp, name + ".wav"), os.path.join(tmp, name + "-s.wav")
    wavfile.write(src, SR, x.astype(np.float32))
    run(["-y", "-v", "error", "-i", src, "-af", f"rubberband=tempo={1 / ratio:.6f}:transients=crisp:detector=compound:pitchq=quality", dst])
    return read(dst)[1]

def biquad(kind, f0, q=.707, gain_db=0.0):
    A = 10 ** (gain_db / 40); w = 2 * np.pi * f0 / SR; c, s = np.cos(w), np.sin(w); al = s / (2 * q)
    if kind == "hp": b, a = [(1 + c) / 2, -(1 + c), (1 + c) / 2], [1 + al, -2 * c, 1 - al]
    elif kind == "peak": b, a = [1 + al * A, -2 * c, 1 - al * A], [1 + al / A, -2 * c, 1 - al / A]
    else:
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) + (A - 1) * c + sq), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sq)]
        a = [(A + 1) - (A - 1) * c + sq, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sq]
    return np.array(b) / a[0], np.array(a) / a[0]

def clean(x, floor_db=-14.0):
    """Stationary noise estimate + decision-directed Wiener gain with a floor; then the corrective EQ."""
    N, H = 2048, 512
    win = np.sqrt(np.hanning(N + 1)[:-1])
    _, _, X = signal.stft(x, SR, window=win, nperseg=N, noverlap=N - H)
    P = np.abs(X) ** 2
    noise = np.percentile(uniform_filter1d(P, 9, axis=1), 6, axis=1) * 1.15
    gmin, alpha = 10 ** (floor_db / 20), .97
    G = np.empty_like(P); prev = np.zeros(P.shape[0])
    for j in range(P.shape[1]):
        prio = alpha * prev / noise + (1 - alpha) * np.maximum(P[:, j] / noise - 1, 0)
        g = np.maximum(prio / (1 + prio), gmin)
        G[:, j] = g; prev = g * g * P[:, j]
    G = uniform_filter1d(G, 3, axis=0)
    rel = np.exp(-H / SR / .06)
    for j in range(1, G.shape[1]):
        G[:, j] = np.where(G[:, j] > G[:, j - 1], G[:, j], rel * G[:, j - 1] + (1 - rel) * G[:, j])
    _, y = signal.istft(X * G, SR, window=win, nperseg=N, noverlap=N - H)
    y = y[: len(x)]
    for kind, f0, q, g in [("hp", 32, .707, 0), ("hp", 32, .707, 0), ("peak", 200, 1.4, -3.0), ("peak", 3200, .9, 2.0), ("shelf", 9000, .707, 1.5)]:
        b, a = biquad(kind, f0, q, g); y = signal.lfilter(b, a, y)
    return y / (np.max(np.abs(y)) + 1e-12) * .5

def fade(x, fin, fout):
    n_in, n_out = int(fin * SR), int(fout * SR)
    if n_in: x[:n_in] *= np.sin(np.linspace(0, np.pi / 2, n_in)) ** 2
    if n_out: x[-n_out:] *= np.cos(np.linspace(0, np.pi / 2, n_out)) ** 2
    return x

def tail(x, seconds=2.4, rt60=2.0):
    """A hall tail for a phrase that rings out: the last moments of `x` through a synthetic decaying room, wet only."""
    rng = np.random.default_rng(29)
    n = int(seconds * SR); t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-6.9 * t / rt60)
    ir[: int(.02 * SR)] = 0                                    # 20 ms pre-delay
    b, a = biquad("peak", 5200, .5, -9.0); ir = signal.lfilter(b, a, ir)
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-12
    wet = signal.fftconvolve(x, ir)[: len(x) + n]
    return wet

def rms_db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)

def compress(x, threshold_db=-24.0, ratio=2.5, attack=.015, release=.25):
    """A gentle RMS compressor (keeps the quiet vamp audible next to the band)."""
    env = np.sqrt(signal.lfilter([1 - np.exp(-1 / (.01 * SR))], [1, -np.exp(-1 / (.01 * SR))], x ** 2) + 1e-12)
    level = 20 * np.log10(env)
    over = np.maximum(0, level - threshold_db)
    target = -over * (1 - 1 / ratio)
    g = np.empty_like(target); v = 0.0
    a_c, r_c = np.exp(-1 / (attack * SR)), np.exp(-1 / (release * SR))
    for i, tg in enumerate(target):
        v = a_c * v + (1 - a_c) * tg if tg < v else r_c * v + (1 - r_c) * tg
        g[i] = v
    return x * 10 ** (g / 20)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--007", dest="bond", required=True); ap.add_argument("--mission", required=True)
    ap.add_argument("--target", type=float, default=-11.0); ap.add_argument("--weight-gain", type=float, default=0.0)
    ap.add_argument("--out", default=os.path.join(BUILD, "score.wav"))
    o = ap.parse_args()
    T = json.load(open(os.path.join(ROOT, "scripts/trailer/timeline.json"), encoding="utf-8"))
    ig, mission, m0, title, cut = T["ignite"], T["mission"], T["montage"][0]["t"], T["title"], T["cut"]
    tmp = tempfile.mkdtemp(prefix="trailer-music-")
    bond, mi = clean(decode(o.bond, tmp)), clean(decode(o.mission, tmp))

    # ── the cold open: 007's first 25 beats fill 0 → ignite; from its last accent it rings out instead of stopping
    a0, a1, last = .650, 10.990, 10.573
    k007 = ig / (a1 - a0)
    xa = stretch(bond[int(a0 * SR): int((a1 + .6) * SR)], k007, tmp, "a")
    t_last = (last - a0) * k007                                  # ≈ 9.6 s
    n_end = int((t_last + 1.0) * SR)
    xa = xa[:n_end].copy()
    dry_out = np.ones(len(xa)); i0 = int(t_last * SR)
    dry_out[i0:] = np.cos(np.linspace(0, np.pi / 2, len(xa) - i0)) ** 2
    seg = xa[int((t_last - .5) * SR): i0 + int(.12 * SR)]
    ring = tail(seg * np.hanning(len(seg)), 2.6, 2.2)          # the last bar's ring, from just before the accent
    xa = fade(xa * dry_out, .004, 0)
    k = int(6.0 * SR)   # the vamp is soft by nature: lift it until the band comes in
    xa[:k] *= 10 ** (np.interp(np.arange(k), [0, int(4.5 * SR), k], [7.0, 5.0, 0.0]) / 20)
    xa = compress(xa)

    # ── the Mission, 4 % slower so three of its bars span the montage exactly
    kmi = (title - m0) / (27.512 - 19.834)
    def mi_part(s0, s1, name, fin=.03, fout=.015):
        x = stretch(mi[int((s0 - PRE) * SR): int((s1 - PRE) * SR)], kmi, tmp, name)
        return fade(x, fin, fout)
    xb = mi_part(12.14 - (11.336 - ig) / kmi, 12.14, "b", fin=.25)          # the intro's second half bar, under the match
    xc = mi_part(17.277, 19.834, "c")                                        # the drum fill
    xd = mi_part(19.834, 19.834 + (cut - m0) / kmi + PRE, "d", fout=.0)      # the band, the melody
    t_c = m0 - len(xc) / SR + PRE                                            # the fill ends exactly on the montage's downbeat
    t_b = t_c - len(xb) / SR
    gate = np.ones(len(xd)); at = lambda t: int((t - (m0 - PRE)) * SR)
    g0, g1, r0, r1 = at(T["blackout"] - .04), at(T["blackout"]), at(title - PRE), at(title - PRE + .004)
    gate[g0:g1] = np.linspace(1, 0, g1 - g0); gate[g1:r0] = 0; gate[r0:r1] = np.linspace(0, 1, r1 - r0)
    xd *= gate
    n = int(.45 * SR)
    d_ring = tail(xd[-n:] * np.hanning(2 * n)[n:], 2.4, 1.8)  # the band's last moments, ringing on under the chord
    xd = fade(xd, 0, .03)
    xe = fade(bond[int((100.207 - PRE) * SR): int(104.3 * SR)].copy(), .03, 1.2)

    # ── levels: everything balanced to the Mission's full band
    L = rms_db(xd[int(.2 * SR): int((T["blackout"] - m0 - .2) * SR)])
    ga = L - .5 - rms_db(xa[int(6.2 * SR): int(9.4 * SR)])
    gc = L - 2.0 - rms_db(xc[int(.2 * SR): int(2.4 * SR)])
    ge = L + .5 - rms_db(xe[int(.05 * SR): int(1.2 * SR)])
    music = np.zeros(int((T["duration"] + .2) * SR))
    def lay(x, t, gain_db):
        i = int(round(t * SR)); j = min(len(music), i + len(x)); music[i:j] += x[: j - i] * 10 ** (gain_db / 20)
    lay(xa, 0.0, ga); lay(ring, t_last - .5, ga - 4)
    lay(xb, t_b, gc + 7)   # the intro is near silent in the take: lift it so the handover never dips into a gap
    lay(xc, t_c, gc)
    lay(xd, m0 - PRE, 0.0); lay(d_ring, cut - .45 - PRE, -5)
    lay(xe, cut - PRE, ge)
    music = music / (np.max(np.abs(music)) + 1e-12) * .5
    print(f"placed: 007 0–{t_last + 1.0:.2f}s (rings out from {t_last:.2f}s), intro {t_b:.3f}, fill {t_c:.3f}, band {m0 - PRE:.3f}, chord {cut - PRE:.3f}; Mission x{kmi:.4f}")

    # ── the trailer's weight on top; the music gives way under the big hits
    path = os.path.join(BUILD, "weight.raw.wav")
    if not os.path.exists(path): sys.exit("render the hits first: node scripts/trailer/render-score.mjs --over-music --out .trailer-build/weight.wav")
    sr, fx = read(path)
    assert sr == SR
    fx = fx[: len(music)]
    if len(fx) < len(music): fx = np.pad(fx, ((0, len(music) - len(fx)), (0, 0)))
    fx *= 10 ** (o.weight_gain / 20) * .62 / (np.max(np.abs(fx)) + 1e-12)
    env = np.abs(fx).max(axis=1)
    att, rel = np.exp(-1 / (.003 * SR)), np.exp(-1 / (.22 * SR))
    follow = np.empty_like(env); v = 0.0
    for i, e in enumerate(env):
        v = att * v + (1 - att) * e if e > v else rel * v + (1 - rel) * e
        follow[i] = v
    duck = 1 - .5 * np.clip(follow / (np.percentile(follow, 99.7) + 1e-12), 0, 1) ** 1.5
    mix = np.stack([music * duck] * 2, axis=1) + fx
    pre = os.path.join(BUILD, "score.premaster.wav"); out = os.path.abspath(o.out)
    os.makedirs(BUILD, exist_ok=True); wavfile.write(pre, SR, mix.astype(np.float32))
    np.save(os.path.join(BUILD, "music-bed.npy"), music)

    def loud(flt):
        text = run(["-i", pre, "-af", (flt + "," if flt else "") + "loudnorm=print_format=json", "-f", "null", "-"])
        j = json.loads(text[text.rindex("{"): text.rindex("}") + 1]); return float(j["input_i"]), float(j["input_tp"])
    glue = "acompressor=threshold=0.16:ratio=2:attack=15:release=200:makeup=1"
    chain = lambda g: f"{glue},volume={g:.2f}dB,alimiter=limit=0.76:attack=4:release=90:level=false"
    g = o.target - loud(glue)[0]
    for p in range(5):
        i, tp = loud(chain(g)); print(f"master pass {p}: +{g:.2f} dB -> {i} LUFS, TP {tp}")
        if abs(i - o.target) < .2: break
        g += o.target - i
    run(["-y", "-v", "error", "-i", pre, "-af", chain(g), "-ar", str(SR), "-c:a", "pcm_s16le", out])
    print("wrote", os.path.relpath(out, ROOT))

if __name__ == "__main__":
    main()
