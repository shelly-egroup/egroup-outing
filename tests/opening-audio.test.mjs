import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const compiled = await readFile(new URL("../.tools/audio-tests/opening-audio.js", import.meta.url), "utf8");
const { createOpeningAudio } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

class Media extends EventTarget {
  readyState = 4;
  currentTime = 0;
  paused = true;
  muted = false;
  volume = 1;
  ended = false;
  error = null;
  calls = 0;
  loadCalls = 0;
  behavior = () => Promise.resolve();
  play() {
    this.calls++;
    const result = this.behavior();
    this.paused = false;
    return result;
  }
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
  load() { this.loadCalls++; this.error = null; }
  fire(type) { this.dispatchEvent(new Event(type)); }
}
const settle = () => new Promise(resolve => setImmediate(resolve));
function setup(time = 0) {
  const audio = new Media(), states = [];
  let elapsed = time;
  const controller = createOpeningAudio(audio, { getTime: () => elapsed, duration: 10.85, onState: state => states.push(state) });
  return { audio, states, controller, setTime: time => { elapsed = time; } };
}
test("successful autoplay stays audible and follows the visual clock", async t => {
  const { audio, controller, states } = setup(.4);
  t.after(() => controller.dispose());
  controller.start();
  await settle();
  assert.equal(audio.muted, false);
  assert.equal(audio.volume, .55);
  assert.equal(audio.currentTime, .4);
  assert.equal(states.at(-1), "playing");
});
test("blocked autoplay retries without a click, joins the clock, then stops retrying", async t => {
  const { audio, controller, states, setTime } = setup();
  t.after(() => controller.dispose());
  audio.behavior = () => Promise.reject({ name: "NotAllowedError" });
  controller.start();
  await settle();
  assert.equal(states.at(-1), "blocked");
  assert.equal(audio.muted, false);
  audio.behavior = () => Promise.resolve();
  setTime(3.2);
  await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(audio.calls, 2);
  assert.equal(audio.currentTime, 3.2);
  assert.equal(states.at(-1), "playing");
  await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(audio.calls, 2);
});

test("a click before the intro primes the same audio without audible early playback", async t => {
  const { audio, controller, states, setTime } = setup(null);
  t.after(() => controller.dispose());
  controller.interact();
  assert.equal(audio.volume, 0);
  await settle();
  assert.equal(audio.paused, true);
  setTime(0);
  controller.start();
  await settle();
  assert.equal(audio.volume, .55);
  assert.equal(audio.paused, false);
  assert.equal(states.at(-1), "playing");
});
test("slow metadata does not throw an early seek; late playback joins the current shot", async t => {
  const { audio, controller, states, setTime } = setup(.01);
  t.after(() => controller.dispose());
  audio.readyState = 0;
  let position = 0, finish;
  Object.defineProperty(audio, "currentTime", {
    get: () => position,
    set: value => { if (!audio.readyState) throw new Error("metadata unavailable"); position = value; },
  });
  audio.behavior = () => new Promise(resolve => { finish = resolve; });
  controller.start();
  assert.equal(audio.calls, 1);
  assert.equal(states.at(-1), "loading");
  audio.readyState = 4;
  setTime(2.4);
  finish();
  await settle();
  assert.equal(audio.currentTime, 2.4);
  assert.equal(states.at(-1), "playing");
});
test("an interrupted play retries and recovers without waiting for another click", async t => {
  const { audio, controller, states } = setup(.2);
  t.after(() => controller.dispose());
  audio.behavior = () => audio.calls === 1 ? Promise.reject({ name: "AbortError" }) : Promise.resolve();
  controller.start();
  await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(audio.calls, 2);
  assert.equal(states.at(-1), "playing");
});
test("unsuccessful autoplay keeps retrying beyond three attempts but stops at the ending", async t => {
  const { audio, controller, states, setTime } = setup();
  t.after(() => controller.dispose());
  audio.behavior = () => Promise.reject({ name: "NotAllowedError" });
  controller.start();
  await new Promise(resolve => setTimeout(resolve, 1650));
  assert.ok(audio.calls >= 4);
  assert.equal(states.at(-1), "blocked");
  assert.equal(audio.muted, false);
  const calls = audio.calls;
  setTime(10.85);
  await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(audio.calls, calls);
});

test("a late rejected autoplay promise cannot overwrite a successful click", async t => {
  const { audio, controller, states } = setup(1);
  t.after(() => controller.dispose());
  let rejectFirst;
  audio.behavior = () => audio.calls === 1 ? new Promise((_, reject) => { rejectFirst = reject; }) : Promise.resolve();
  controller.start();
  controller.interact();
  await settle();
  rejectFirst({ name: "NotAllowedError" });
  await settle();
  assert.equal(states.at(-1), "playing");
  assert.equal(audio.muted, false);
});
test("network failures reload and recover automatically without a click", async t => {
  const { audio, controller, states } = setup();
  t.after(() => controller.dispose());
  controller.start();
  await settle();
  audio.error = { code: 2 };
  audio.fire("error");
  assert.equal(states.at(-1), "error");
  await new Promise(resolve => setTimeout(resolve, 1150));
  assert.equal(audio.loadCalls, 1);
  assert.equal(states.at(-1), "playing");
});

test("buffering recovery seeks forward once playback resumes", async t => {
  const { audio, controller, states, setTime } = setup();
  t.after(() => controller.dispose());
  controller.start();
  await settle();
  audio.fire("waiting");
  assert.equal(states.at(-1), "loading");
  setTime(4);
  audio.fire("playing");
  assert.equal(audio.currentTime, 4);
  assert.equal(states.at(-1), "playing");
});
test("skipping cancels recovery and ignores late promises", async () => {
  const { audio, controller, states } = setup();
  let resolve;
  audio.behavior = () => new Promise(done => { resolve = done; });
  controller.start();
  controller.dispose();
  const snapshot = [...states];
  resolve();
  await settle();
  audio.fire("canplay");
  controller.interact();
  assert.deepEqual(states, snapshot);
  assert.equal(audio.calls, 1);
  assert.equal(audio.paused, true);
});
test("skip removes a scheduled retry and no sound starts after the ending", async () => {
  const { audio, controller, setTime } = setup();
  audio.behavior = () => Promise.reject({ name: "AbortError" });
  controller.start();
  await settle();
  controller.dispose();
  await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(audio.calls, 1);
  const done = setup(11);
  done.controller.start();
  done.controller.interact();
  assert.equal(done.audio.calls, 0);
  done.controller.dispose();
  setTime(11);
});

test("clicking during healthy playback does not restart or seek the music", async t => {
  const { audio, controller, setTime } = setup();
  t.after(() => controller.dispose());
  controller.start();
  await settle();
  setTime(3);
  controller.interact();
  assert.equal(audio.calls, 1);
  assert.equal(audio.currentTime, 0);
});

test("the optional click retries immediately and cancels the scheduled retry", async t => {
  const { audio, controller, states, setTime } = setup();
  t.after(() => controller.dispose());
  audio.behavior = () => Promise.reject({ name: "NotAllowedError" });
  controller.start();
  await settle();
  audio.behavior = () => Promise.resolve();
  setTime(2);
  controller.interact();
  await settle();
  assert.equal(audio.calls, 2);
  assert.equal(audio.currentTime, 2);
  assert.equal(states.at(-1), "playing");
  await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(audio.calls, 2);
});
