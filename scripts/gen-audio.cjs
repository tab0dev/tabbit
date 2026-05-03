/**
 * gen-audio.cjs — Step-sequencer based audio generator for Tabbit music layers.
 *
 * GRID: All note timing is specified in 16th-note STEPS (integers).
 *       This guarantees every track is phase-locked to the same sample boundary.
 *
 * Step grid reference (2 bars, 4/4, 72 BPM):
 *
 *  Steps: 0  1  2  3 | 4  5  6  7 | 8  9 10 11 |12 13 14 15 |16 17 18 19 |20 21 22 23 |24 25 26 27 |28 29 30 31
 *  Beat:  1  +  &  a | 2  +  &  a | 3  +  &  a | 4  +  &  a | 1  +  &  a | 2  +  &  a | 3  +  &  a | 4  +  &  a
 *  Bar:   [──────────────────────────── Bar 1 ────────────────────────────][──────────────────────────── Bar 2 ────────────────────────────]
 *
 *  Note durations in steps:
 *    Whole note     = 16 steps
 *    Half note      =  8 steps
 *    Dotted quarter =  6 steps
 *    Quarter note   =  4 steps
 *    Dotted 8th     =  3 steps
 *    8th note       =  2 steps
 *    16th note      =  1 step
 *
 * To edit a pattern: change the { step, note, len } entries below.
 * To add a note: { step: <0-31>, note: '<name>', len: <1-32> }
 *
 * Run: node scripts/gen-audio.cjs
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Grid constants ───────────────────────────────────────────────────────────

const SAMPLE_RATE          = 44100;
const BPM                  = 72;
const BARS                 = 2;
const BEATS_PER_BAR        = 4;
const SIXTEENTHS_PER_BEAT  = 4;

const TOTAL_STEPS   = BARS * BEATS_PER_BAR * SIXTEENTHS_PER_BEAT; // 32
const BEAT_SECS     = 60 / BPM;                                     // 0.8333 s/beat
const STEP_SECS     = BEAT_SECS / SIXTEENTHS_PER_BEAT;              // 0.2083 s/step
const STEP          = Math.round(STEP_SECS * SAMPLE_RATE);          // samples per 16th
const TOTAL_SAMPLES = TOTAL_STEPS * STEP;                            // exact — no round-off
const TOTAL_SECS    = TOTAL_SAMPLES / SAMPLE_RATE;

// ─── Note frequency table ─────────────────────────────────────────────────────

const FREQ = {
  'E2':  82.41, 'G2':  98.00, 'A2': 110.00, 'C3': 130.81,
  'E3': 164.81, 'G3': 196.00, 'A3': 220.00,
  'B3': 246.94, 'C4': 261.63, 'D4': 293.66, 'E4': 329.63,
  'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
  'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46,
  'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
};

// ─── WAV writer ───────────────────────────────────────────────────────────────

function writeWav(filePath, samples) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');       buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');       buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16,          16);  buf.writeUInt16LE(1,           20); // PCM
  buf.writeUInt16LE(1,           22);  buf.writeUInt32LE(SAMPLE_RATE, 24); // mono
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); buf.writeUInt16LE(2,         32);
  buf.writeUInt16LE(16,          34);  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize,    40);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
  console.log(`  ✓ ${path.basename(filePath).padEnd(18)} (${(buf.length / 1024).toFixed(1)} KB, step=${STEP} samples)`);
}

// ─── Step sequencer core ──────────────────────────────────────────────────────

const expEnv = (t, rate) => Math.exp(-t * rate);

/**
 * Render a note into `buf` starting at 16th-note `step` for `len` steps.
 * gen(i, t, durSecs) returns a sample value; return null to cut early.
 */
function renderNote(buf, step, len, gen) {
  const startSample = step * STEP;
  const maxSamples  = len  * STEP;
  const durSecs     = len  * STEP_SECS;
  for (let i = 0; i < maxSamples && startSample + i < buf.length; i++) {
    const v = gen(i, i / SAMPLE_RATE, durSecs);
    if (v === null) break;
    buf[startSample + i] += v;
  }
}

// ─── 1. Kick ──────────────────────────────────────────────────────────────────
//
//  Piano roll:
//  Step: 0  .  .  . | .  .  .  . | .  .  .  . | .  .  .  . |16  .  .  . | .  .  .  . | .  .  .  . | .  .  .  .
//  Kick: K           K             K              K
//  Beats 1 & 3 of each bar → steps 0, 8, 16, 24

function generateKick() {
  const s = new Float32Array(TOTAL_SAMPLES);
  for (const step of [0, 8, 16, 24]) {
    renderNote(s, step, 4, (i, t) => {
      const freq  = 150 * Math.exp(-t * 30) + 50;
      const tone  = Math.sin(2 * Math.PI * freq * t);
      const env   = expEnv(t, 16);
      const click = i < 80 ? (1 - i / 80) * 0.5 : 0;
      return (tone * env + click) * 0.88;
    });
  }
  return s;
}

// ─── 2. Hi-hat ────────────────────────────────────────────────────────────────
//
//  Piano roll:
//  Step: 0  . 2  . | 4  . 6  . | 8  . 10  . |12 . 14  . |16 . 18 . |20 . 22  . |24 . 26 . |28 . 30 .
//  Hat:  c  . c  . | c  . O  . | c  . c   . | c . c   . | c . c  . | c . O   . | c . c  . | c . c  .
//
//  Closed (c) every 8th = every 2 steps. Open (O) on & of beat 2 each bar = steps 6, 22.

function generateHihat() {
  const s = new Float32Array(TOTAL_SAMPLES);
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff * 2 - 1;
  };
  for (let step = 0; step < TOTAL_STEPS; step += 2) {
    const isOpen = (step === 6 || step === 22);
    const len    = isOpen ? 4 : 2;
    const decay  = isOpen ? 18 : 60;
    renderNote(s, step, len, (i, t) => {
      const noise = rand();
      const metal = Math.sin(2 * Math.PI * 7000 * t) * 0.25
                  + Math.sin(2 * Math.PI * 5200 * t) * 0.15;
      return (noise * 0.55 + metal) * expEnv(t, decay) * 0.38;
    });
  }
  return s;
}

// ─── 3. Snare ─────────────────────────────────────────────────────────────────
//
//  Piano roll:
//  Step: 0  .  .  . | 4  .  .  . | 8  .  .  . |12  .  .  . |16  .  .  . |20  .  .  . |24  .  .  . |28  .  .  .
//  Snare:             S              S              S             S
//  Beats 2 & 4 of each bar → steps 4, 12, 20, 28

function generateSnare() {
  const s = new Float32Array(TOTAL_SAMPLES);
  let seed = 7;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff * 2 - 1;
  };
  for (const step of [4, 12, 20, 28]) {
    renderNote(s, step, 3, (i, t) => {
      const noise    = rand();
      const noiseEnv = expEnv(t, 24);
      const tone     = Math.sin(2 * Math.PI * 185 * t) * expEnv(t, 40);
      const click    = i < 60 ? (1 - i / 60) * 0.55 : 0;
      return (noise * noiseEnv * 0.65 + tone * 0.35 + click) * 0.78;
    });
  }
  return s;
}

// ─── 4. Bass line ─────────────────────────────────────────────────────────────
//
//  A minor groove. Quarter-note and 8th-note lines.
//
//  Piano roll:
//  Step: 0  .  .  . | 4  . 6  . | 8  .  .  . |12  .  .  . |16  .  .  . |20 . 22 . |24  .  .  . |28  .  .  .
//  Note: A2            A2  G2     A2             C3            A2            G2  E2    G2             A2
//
//  To edit: change step (0-31), note (see FREQ table), len (in 16ths).

const BASS_PATTERN = [
  { step:  0, note: 'A2', len: 4 }, // beat 1-1
  { step:  4, note: 'A2', len: 2 }, // beat 2
  { step:  6, note: 'G2', len: 2 }, // & of 2
  { step:  8, note: 'A2', len: 4 }, // beat 3
  { step: 12, note: 'C3', len: 4 }, // beat 4
  { step: 16, note: 'A2', len: 4 }, // beat 1-2
  { step: 20, note: 'G2', len: 2 }, // beat 2-2
  { step: 22, note: 'E2', len: 2 }, // & of 2-2
  { step: 24, note: 'G2', len: 4 }, // beat 3-2
  { step: 28, note: 'A2', len: 4 }, // beat 4-2
];

function generateBass() {
  const s = new Float32Array(TOTAL_SAMPLES);
  for (const { step, note, len } of BASS_PATTERN) {
    const f       = FREQ[note];
    const durSecs = len * STEP_SECS;
    renderNote(s, step, len, (i, t) => {
      let env;
      if      (t < 0.008)           env = t / 0.008;
      else if (t < 0.06)            env = 1 - 0.4 * ((t - 0.008) / 0.052);
      else if (t < durSecs - 0.08)  env = 0.6;
      else                          env = 0.6 * (1 - (t - (durSecs - 0.08)) / 0.08);
      env = Math.max(0, env);
      const raw = Math.sin(2 * Math.PI * f     * t) * 0.70
                + Math.sin(2 * Math.PI * f * 2 * t) * 0.22
                + Math.sin(2 * Math.PI * f * 3 * t) * 0.08;
      return Math.tanh(raw * 1.4) * env * 0.52;
    });
  }
  return s;
}

// ─── 5. Pad melody ────────────────────────────────────────────────────────────
//
//  Soft airy sine pad in A minor.
//
//  Piano roll (each char = 2 steps = 1 eighth note):
//  Step: 0  2 | 4     | 8  10      | 16 18 | 20 22 | 24
//  Note: A4 C5| D5    | C5 A4──    | G4 A4 | C5 D5 | E5────────
//        8th  | qtr   | 8th dq     | 8ths  | 8ths  | half

const MELODY_PATTERN = [
  { step:  0, note: 'A4', len: 2 }, // 8th
  { step:  2, note: 'C5', len: 2 }, // 8th
  { step:  4, note: 'D5', len: 4 }, // quarter
  { step:  8, note: 'C5', len: 2 }, // 8th
  { step: 10, note: 'A4', len: 6 }, // dotted quarter
  { step: 16, note: 'G4', len: 2 }, // 8th
  { step: 18, note: 'A4', len: 2 }, // 8th
  { step: 20, note: 'C5', len: 2 }, // 8th
  { step: 22, note: 'D5', len: 2 }, // 8th
  { step: 24, note: 'E5', len: 8 }, // half note — held to bar end
];

function generateMelody() {
  const s = new Float32Array(TOTAL_SAMPLES);
  for (const { step, note, len } of MELODY_PATTERN) {
    const f       = FREQ[note];
    const detune  = 1.0035;
    const durSecs = len * STEP_SECS;
    renderNote(s, step, len, (i, t) => {
      let env;
      if      (t < 0.015)           env = t / 0.015;
      else if (t < 0.08)            env = 1 - 0.45 * ((t - 0.015) / 0.065);
      else if (t < durSecs - 0.12)  env = 0.55;
      else                          env = 0.55 * (1 - (t - (durSecs - 0.12)) / 0.12);
      env = Math.max(0, env);
      const v = Math.sin(2 * Math.PI * f          * t) * 0.55
              + Math.sin(2 * Math.PI * f * detune  * t) * 0.30
              + Math.sin(2 * Math.PI * f * 2       * t) * 0.12;
      return v * env * 0.33;
    });
  }
  return s;
}

// ─── 6. Lead melody ───────────────────────────────────────────────────────────
//
//  Smoky, slow saxophone-style melody in A minor / Dorian.
//  Long notes, sparse rests, jazzy b7 tension (G5).
//
//  Piano roll:
//  Step: 0──────. | 6 . | 8─────. |12─────. | [16-17 rest] 18 . |20 . |22────────────────. |30 .
//  Note: E5(dq)   D5    C5(q)    A4(q)                    C5    E5    G5 (half + rest)      D5
//        dq=dotted quarter=6 steps | q=quarter=4 | half=8
//
//  A minor scale used: A B C D E F G
//  G5 = the minor 7th — characteristic jazz tension note

const LEAD_PATTERN = [
  // Bar 1 — descending sigh phrase
  { step:  0, note: 'E5', len: 6 }, // dotted quarter — open & airy
  { step:  6, note: 'D5', len: 2 }, // 8th
  { step:  8, note: 'C5', len: 4 }, // quarter
  { step: 12, note: 'A4', len: 4 }, // quarter — resolves home (steps 12-15, ends at bar seam)
  // step 16 = 2-step rest / breath before bar 2 answer phrase
  // Bar 2 — response, rises to the b7 then falls unresolved (loops back to E5 perfectly)
  { step: 18, note: 'C5', len: 2 }, // 8th pickup
  { step: 20, note: 'E5', len: 2 }, // 8th
  { step: 22, note: 'G5', len: 8 }, // HALF NOTE — minor 7th, luxurious hold
  { step: 30, note: 'D5', len: 2 }, // 8th — falls, unresolved into loop
];

function generateLead() {
  const s = new Float32Array(TOTAL_SAMPLES);
  for (const { step, note, len } of LEAD_PATTERN) {
    const f       = FREQ[note];
    const durSecs = len * STEP_SECS;
    renderNote(s, step, len, (i, t) => {
      let env;
      if      (t < 0.020)           env = t / 0.020;                        // 20ms attack
      else if (t < 0.08)            env = 1 - 0.25 * ((t - 0.020) / 0.06); // light decay → 0.75
      else if (t < durSecs - 0.12)  env = 0.75;
      else                          env = 0.75 * (1 - (t - (durSecs - 0.12)) / 0.12);
      env = Math.max(0, env);
      // Warm overtone series — rounded, saxophone/muted trumpet character
      const v = Math.sin(2 * Math.PI * f     * t) * 0.65
              + Math.sin(2 * Math.PI * f * 2 * t) * 0.22
              + Math.sin(2 * Math.PI * f * 3 * t) * 0.09
              + Math.sin(2 * Math.PI * f * 4 * t) * 0.03;
      return v * env * 0.32;
    });
  }
  return s;
}

// ─── 7. Vocal "ah" ────────────────────────────────────────────────────────────
//
//  Short human-like "ah" breath on beat 1 of each bar. Everything else is silence.
//  Duration: 2 steps (~0.42 s). The loop seams at beat 1 of bar 1 naturally.
//
//  Piano roll:
//  Step: 0  . | [silence] |16  . | [silence]
//  Ah:   Ah   |           | Ah   |
//
//  Pitch: A3 (220 Hz) — matches bass root.

function generateVocal() {
  const s = new Float32Array(TOTAL_SAMPLES);
  let seed = 99;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff * 2 - 1;
  };
  const FUND = 220.0;
  for (const step of [0, 16]) {
    renderNote(s, step, 2, (i, t) => {
      // 30ms rise, smooth exponential decay
      const env    = t < 0.030 ? t / 0.030 : Math.exp(-(t - 0.030) * 9.0);
      // Breathy "h" consonant at onset, gone by 25ms
      const hNoise = t < 0.025 ? rand() * (1 - t / 0.025) * 0.25 : 0;
      // Formant-lite vowel: 3 harmonics, fundamental-dominant
      const f0  = FUND * (1 + 0.003 * Math.sin(2 * Math.PI * 5.5 * t));
      const vow = Math.sin(2 * Math.PI * f0     * t) * 0.75
                + Math.sin(2 * Math.PI * f0 * 2 * t) * 0.18
                + Math.sin(2 * Math.PI * f0 * 3 * t) * 0.06;
      return (vow + hNoise) * env * 0.45;
    });
  }
  return s;
}

// ─── Generate all files ───────────────────────────────────────────────────────

const outDir = path.join(__dirname, '..', 'public', 'audio');
fs.mkdirSync(outDir, { recursive: true });

console.log(`\nGenerating ${BARS}-bar loops @ ${BPM} BPM  |  ${TOTAL_STEPS} steps  |  ${STEP} samples/step  |  ${TOTAL_SECS.toFixed(3)}s total\n`);

writeWav(path.join(outDir, 'kick_loop.wav'),   generateKick());
writeWav(path.join(outDir, 'hihat_loop.wav'),  generateHihat());
writeWav(path.join(outDir, 'snare_loop.wav'),  generateSnare());
writeWav(path.join(outDir, 'bass_loop.wav'),   generateBass());
writeWav(path.join(outDir, 'melody_loop.wav'), generateMelody());
writeWav(path.join(outDir, 'lead_loop.wav'),   generateLead());
writeWav(path.join(outDir, 'vocal_loop.wav'),  generateVocal());

console.log('\nDone. Audio files written to public/audio/');
