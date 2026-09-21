import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
async function load(name) {
  const source = await readFile(new URL("../.tools/draw-tests/" + name + ".js", import.meta.url), "utf8");
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}
const { createDrawTimeline, randomChoiceIndex } = await load("light-draw");
const { startDrawSound } = await load("light-draw-sound");

test("every candidate can win equally without weighting by its position", () => {
  for (const count of [2, 3, 5, 8]) {
    const tallies = Array(count).fill(0);
    for (let value = 0; value < count * 100; value++) tallies[randomChoiceIndex(count, () => value)]++;
    assert.deepEqual(tallies, Array(count).fill(100));
  }
});
test("random sampling rejects the unequal tail instead of introducing modulo bias", () => {
  const samples = [4294967295, 5];
  assert.equal(randomChoiceIndex(3, () => samples.shift()), 2);
  assert.equal(samples.length, 0);
});
test("successive draws sample again and may legitimately repeat the same result", () => {
  let calls = 0;
  const sample = () => { calls++; return 1; };
  assert.equal(randomChoiceIndex(2, sample), 1);
  assert.equal(randomChoiceIndex(2, sample), 1);
  assert.equal(calls, 2);
});
test("every outcome lands on the chosen candidate after continuously slowing beats", () => {
  for (const count of [2, 3, 8, 17]) {
    const ids = Array.from({ length: count }, (_, i) => "option-" + i);
    for (let winner = 0; winner < count; winner++) {
      const beats = createDrawTimeline(ids, ids[1], winner);
      assert.equal(beats.at(-1).id, ids[winner]);
      assert.ok(beats.at(-1).at >= 3.4 && beats.at(-1).at <= 5.2);
      let previous = 0;
      for (let i = 1; i < beats.length; i++) {
        const interval = beats[i].at - beats[i-1].at;
        assert.ok(interval + 1e-10 >= previous);
        assert.equal(ids.indexOf(beats[i].id), (ids.indexOf(beats[i-1].id) + 1) % count);
        previous = interval;
      }
    }
  }
});

class FakeAudioContext {
  static last;
  state = "running"; currentTime = 10; baseLatency = .02; destination = {};
  sources = []; closeCalls = 0; stamp = null;
  constructor() { FakeAudioContext.last = this; }
  resume() { return Promise.resolve(); }
  close() { this.closeCalls++; this.state = "closed"; return Promise.resolve(); }
  getOutputTimestamp() { return this.stamp || {}; }
  createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  createOscillator() {
    const source = { frequency: { setValueAtTime() {} }, connect() {}, disconnect() {}, start(at) { this.startedAt = at; }, stop(at) { this.stoppedAt = at; } };
    this.sources.push(source); return source;
  }
}
test("ticks and landing chord are scheduled on the visual timeline's exact beats", async t => {
  const original = globalThis.AudioContext; globalThis.AudioContext = FakeAudioContext;
  t.after(() => { globalThis.AudioContext = original; });
  const beats = createDrawTimeline(["A", "B", "C"], "A", 2);
  const abort = new AbortController();
  t.after(() => abort.abort());
  const sound = await startDrawSound(beats, abort.signal);
  const context = FakeAudioContext.last;
  assert.ok(sound);
  const expected = beats.slice(0,-1).map(beat => 10.06 + beat.at);
  expected.push(...Array(3).fill(10.06 + beats.at(-1).at));
  assert.deepEqual(context.sources.map(source => source.startedAt), expected);
  context.stamp = { contextTime: 10.5, performanceTime: performance.now() };
  assert.ok(Math.abs(sound.elapsed() - .44) < .03);
  abort.abort();
  sound.stop();
  assert.equal(context.closeCalls, 1);
});
test("canceling during audio activation resolves promptly and schedules no stale sounds", async t => {
  const original = globalThis.AudioContext;
  class PendingAudio extends FakeAudioContext { resume() { return new Promise(() => {}); } }
  globalThis.AudioContext = PendingAudio;
  t.after(() => { globalThis.AudioContext = original; });
  const abort = new AbortController();
  const waiting = startDrawSound([{ id: "A", at: 0 }], abort.signal);
  abort.abort();
  assert.equal(await waiting, null);
  assert.equal(FakeAudioContext.last.sources.length, 0);
  assert.equal(FakeAudioContext.last.closeCalls, 1);
});
