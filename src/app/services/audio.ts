// Chiptune audio, synthesised at runtime with the Web Audio API.
//
// No audio files anywhere. Every sound here is built from square, triangle and noise
// sources — the same synthesis model as an NES — which keeps the bundle at a few KB,
// matches the Press Start 2P / zero-radius look, and sidesteps the "where did this
// track come from?" question that sampled music would raise in a judged competition.
//
// Two rules shape the design:
//
//   1. Browsers refuse to start audio until a user gesture. `unlock()` must be called
//      from inside a real click handler — PRESS START is the natural place.
//   2. Music must never play during a drill. The whole point is that a scam call feels
//      real, so `setMusicEnabled(false)` is called the moment a drill screen opens.

const MUTE_KEY = 'safespace.muted';

// 8th notes at 112 BPM.
const STEP_SECONDS = 60 / 112 / 2;
// The scheduler only needs to wake often enough to stay ahead of SCHEDULE_AHEAD; at
// ~3.7 steps/sec, 50ms still leaves a wide margin and halves the timer wakeups.
const LOOKAHEAD_MS = 50;      // how often the scheduler wakes
const SCHEDULE_AHEAD = 0.12;  // how far ahead it queues notes, in seconds

/** MIDI note number -> frequency in Hz. */
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

// A minor: brooding but not sad, which suits "defend against scammers" better than a
// bright major loop. `null` is a rest.
const BASS: (number | null)[] = [
  45, null, 45, null, 43, null, 43, null,
  41, null, 41, null, 40, null, 40, null,
];
const ARP: (number | null)[] = [
  69, 72, 76, 72, 69, 72, 76, 79,
  68, 72, 75, 72, 68, 72, 75, 77,
];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
// One second of white noise, generated once and re-used by every hi-hat and thud.
// Building a fresh buffer per hit meant ~2,700 Math.random() calls and ~11 KB of
// garbage every second the music played.
let noiseBuffer: AudioBuffer | null = null;

let muted = false;
let musicWanted = false;   // does the current screen want music?
let step = 0;
let nextNoteTime = 0;
// Doubles as "is the music running?" — there is no state where a live timer and a
// stopped loop can disagree, so a separate flag would only be a thing to keep in sync.
let timer: number | null = null;

// --- Setup ------------------------------------------------------------------

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false; // private mode / storage disabled — sound on, just not remembered
  }
}

/**
 * Create (or resume) the AudioContext. MUST be called synchronously from a user
 * gesture or the browser leaves the context suspended and everything is silent.
 */
export function unlock(): void {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return; // no Web Audio: the app just runs silently
    ctx = new Ctor();
    muted = readMuted();

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);

    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(master);

    const frames = ctx.sampleRate; // 1s, longer than any hit we take from it
    noiseBuffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  }
  // Safari suspends the context when the tab is backgrounded, so resume every time
  // rather than only on creation.
  if (ctx.state === 'suspended') void ctx.resume();
}

// --- Mute -------------------------------------------------------------------

export function isMuted(): boolean {
  return ctx ? muted : readMuted();
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    /* not fatal — the toggle still works for this session */
  }
  if (master && ctx) {
    // Ramp rather than jump: an instant gain change clicks audibly.
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(next ? 0 : 0.5, ctx.currentTime, 0.02);
  }
  // Silencing the bus alone would leave the scheduler building oscillators nobody can
  // hear — wasted CPU and battery on a phone. Stop it outright, and pick the loop back
  // up on unmute if the screen we're on wants music.
  if (next) stopMusic();
  else if (musicWanted) startMusic();
}

// --- One-shot sound effects -------------------------------------------------

type Wave = OscillatorType;

/**
 * A single enveloped tone. `slide` bends the pitch over the note's life; `dest` routes
 * it somewhere other than the master bus (the music loop uses this to stay duckable).
 */
function tone(
  startAt: number,
  freq: number,
  duration: number,
  { wave = 'square' as Wave, gain = 0.3, slide = 0, dest = null as GainNode | null } = {},
) {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, startAt);
  if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, startAt + duration);

  // Fast attack, exponential decay — the shape that reads as "8-bit".
  env.gain.setValueAtTime(0.0001, startAt);
  env.gain.exponentialRampToValueAtTime(gain, startAt + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(env);
  env.connect(dest ?? master);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/** Short burst of filtered noise — used for hats and the "lose" thud. */
function noise(startAt: number, duration: number, gain = 0.15, hpHz = 6000) {
  if (!ctx || !master || !noiseBuffer) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = hpHz;
  const env = ctx.createGain();
  env.gain.setValueAtTime(gain, startAt);
  env.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  src.connect(hp);
  hp.connect(env);
  env.connect(master);
  src.start(startAt);
  src.stop(startAt + duration);
}

// Deliberately small. Every one of these has a trigger in App.tsx — a sound with no
// moment attached is just noise to maintain.
export type Sfx =
  | 'press'      // any PixelBtn
  | 'select'     // PRESS START
  | 'win'        // result-win
  | 'lose'       // result-lose
  | 'incoming';  // the drill call arriving

export function playSfx(name: Sfx): void {
  if (!ctx || muted) return;
  const t = ctx.currentTime;

  switch (name) {
    case 'press':
      tone(t, hz(81), 0.05, { gain: 0.18 });
      break;
    case 'select':
      tone(t, hz(76), 0.05, { gain: 0.2 });
      tone(t + 0.05, hz(83), 0.08, { gain: 0.2 });
      break;
    case 'win':
      [72, 76, 79, 84].forEach((m, i) => tone(t + i * 0.07, hz(m), 0.3, { gain: 0.25 }));
      break;
    case 'lose':
      // Falling, detuned, with a noise thud under it.
      tone(t, hz(60), 0.5, { gain: 0.22, wave: 'sawtooth', slide: 0.5 });
      noise(t, 0.25, 0.12, 800);
      break;
    case 'incoming':
      // Two-tone ring, deliberately unlike the music so it cuts through.
      tone(t, hz(81), 0.16, { gain: 0.22, wave: 'triangle' });
      tone(t + 0.2, hz(76), 0.16, { gain: 0.22, wave: 'triangle' });
      break;
  }
}

// --- Background music -------------------------------------------------------

function scheduleStep(atTime: number) {
  if (!ctx || !musicBus) return;

  const bass = BASS[step % BASS.length];
  const arp = ARP[step % ARP.length];

  // Routed to musicBus rather than master so the loop can fade independently of
  // sound effects.
  if (bass !== null) {
    tone(atTime, hz(bass), STEP_SECONDS * 1.6, { wave: 'square', gain: 0.22, dest: musicBus });
  }
  if (arp !== null) {
    tone(atTime, hz(arp), STEP_SECONDS * 0.7, { wave: 'triangle', gain: 0.13, dest: musicBus });
  }
  if (step % 2 === 1) noise(atTime, 0.03, 0.04, 8000);

  step += 1;
}

// A lookahead scheduler: setInterval alone drifts badly and would make the loop
// stumble. The timer only decides *what* to queue; the audio clock decides when.
function tick() {
  if (!ctx) return;
  while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(nextNoteTime);
    nextNoteTime += STEP_SECONDS;
  }
}

function startMusic() {
  // `muted` is checked here, not only in setMuted: a screen change calls this directly,
  // so without the guard, muting and then navigating restarts the scheduler behind a
  // silent master gain.
  if (!ctx || !musicBus || timer !== null || muted) return;
  step = 0;
  nextNoteTime = ctx.currentTime + 0.1;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setTargetAtTime(0.5, ctx.currentTime, 0.3); // fade in
  timer = window.setInterval(tick, LOOKAHEAD_MS);
  tick();
}

function stopMusic() {
  if (!ctx || !musicBus) return;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15); // fade out
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
}

/**
 * Whether the current screen wants music. Drill screens call this with `false` so the
 * scam call plays in silence — the sudden quiet reads as tension rather than a bug.
 */
export function setMusicEnabled(on: boolean): void {
  musicWanted = on;
  if (!ctx) return;
  if (on) startMusic();
  else stopMusic();
}
