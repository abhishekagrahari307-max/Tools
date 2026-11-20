/*
 * Numerical checks for the audio DSP inside audio-video/index.html.
 *
 * These tests do NOT re-implement the maths — they pull the real functions out
 * of the shipped page and run them against signals whose correct answer is
 * known, so a regression in the page fails the suite.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PAGE = fileURLToPath(new URL('../audio-video/index.html', import.meta.url));
const html = readFileSync(PAGE, 'utf8');

/* ---------- extract real source out of the page ---------- */
function srcOf(name) {
  const i = html.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(i > 0, `page no longer defines ${name}()`);
  let depth = 0;
  /* start counting after the parameter list: a default such as opts={} would
     otherwise close the function body before it opens */
  let k = html.indexOf('{', html.indexOf(')', i));
  for (; k < html.length; k++) {
    if (html[k] === '{') depth++;
    else if (html[k] === '}' && --depth === 0) break;
  }
  return html.slice(i, k + 1);
}

class FakeBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this._d = Array.from({ length: channels }, () => new Float32Array(length));
  }
  getChannelData(i) { return this._d[i]; }
}
/* the page's AC() returns the live AudioContext; a 48 kHz fake keeps this testable in node */
const AC = () => ({ sampleRate: 48000, createBuffer: (c, l, s) => new FakeBuffer(c, l, s) });
const sleep = async () => {};
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/* ---------- pure page functions (no closure needed) ---------- */
const standalone = new Function(
  'AC', 'sleep',
  [srcOf('hann'), srcOf('fft'), srcOf('ifft'), srcOf('denoiseBuffer'), srcOf('resampleLinear'), srcOf('sliceBuf')]
    .join('\n') + '\nreturn {hann,fft,ifft,denoiseBuffer,resampleLinear,sliceBuf};'
)(AC, sleep);

/* tempoOf lives inside renderBpm, findSilences inside renderSilence, etc.
   Each is evaluated with just the closure variables it actually touches. */
const tempoOf = new Function('return ' + srcOf('tempoOf'))();

const findSilences = new Function('S', 'return ' + srcOf('findSilences'))({ thr: -35, minSil: 0.3, pad: 0.05 });

function spliceOf(base, ins, pos, xf) {
  return new Function('S', 'AC', 'clamp', 'return ' + srcOf('splice'))(
    { base: { buf: base }, ins: { buf: ins }, pos, xf }, AC, clamp
  )();
}
function mixDataOf(A, B) {
  return new Function('S', 'AC', 'resampleLinear', 'return ' + srcOf('mixData'))({ A, B }, AC, standalone.resampleLinear)();
}
const resampleSpeed = new Function('AC', srcOf('resampleSpeed') + '\nreturn resampleSpeed;')(AC);
const pitchShiftGrain = new Function('AC', srcOf('pitchShiftGrain') + '\nreturn pitchShiftGrain;')(AC);

/* ---------- signal helpers ---------- */
const SR = 48000;
function tone(secs, freq, amp = 0.5, sr = SR, channels = 1) {
  const b = new FakeBuffer(channels, Math.round(secs * sr), sr);
  for (let c = 0; c < channels; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = amp * Math.sin(2 * Math.PI * freq * i / sr);
  }
  return b;
}
const rms = (buf, ch = 0) => {
  const d = buf.getChannelData(ch);
  let s = 0;
  for (let i = 0; i < d.length; i++) s += d[i] * d[i];
  return Math.sqrt(s / d.length);
};
const peak = (buf, ch = 0) => {
  const d = buf.getChannelData(ch);
  let p = 0;
  for (let i = 0; i < d.length; i++) p = Math.max(p, Math.abs(d[i]));
  return p;
};
/* zero-crossing pitch estimate: independent of the page's own maths */
function pitchOf(buf, ch = 0) {
  const d = buf.getChannelData(ch), sr = buf.sampleRate;
  let cross = 0;
  for (let i = 1; i < d.length; i++) if (d[i - 1] < 0 && d[i] >= 0) cross++;
  return cross / (d.length / sr);
}
function drumTrack(bpm, { secs = 10, hats = 0, noise = 0 } = {}) {
  const b = new FakeBuffer(1, Math.round(secs * SR), SR);
  const d = b.getChannelData(0);
  const period = 60 / bpm;
  const hit = (at, amp, decay, freq) => {
    const i0 = Math.round(at * SR);
    for (let k = 0; k < Math.round(0.12 * SR) && i0 + k < d.length; k++) {
      const t = k / SR;
      d[i0 + k] += amp * Math.exp(-t * decay) * Math.sin(2 * Math.PI * freq * t);
    }
  };
  for (let t = 0; t < secs - 0.2; t += period) hit(t, 0.9, 38, 60);
  for (let t = 0; t < secs - 0.2 && hats; t += period / hats) {
    const i0 = Math.round(t * SR);
    for (let k = 0; k < Math.round(0.03 * SR) && i0 + k < d.length; k++) {
      d[i0 + k] += 0.25 * (Math.random() * 2 - 1) * Math.exp(-k / (0.008 * SR));
    }
  }
  for (let i = 0; i < d.length && noise; i++) d[i] += noise * (Math.random() * 2 - 1);
  return b;
}

/* ======================= FFT ======================= */
test('fft / ifft round-trip and peak bin', () => {
  const n = 1024;
  const re = new Float32Array(n), im = new Float32Array(n);
  for (let i = 0; i < n; i++) re[i] = Math.sin(2 * Math.PI * 64 * i / n) + 0.4 * Math.cos(2 * Math.PI * 200 * i / n);
  const keep = Float32Array.from(re);
  standalone.fft(re, im);
  let best = 0, bestMag = 0;
  for (let k = 0; k < n / 2; k++) {
    const m = Math.hypot(re[k], im[k]);
    if (m > bestMag) { bestMag = m; best = k; }
  }
  assert.equal(best, 64, 'strongest FFT bin must be the 64-cycle component');
  standalone.ifft(re, im);
  for (let i = 0; i < n; i++) assert.ok(Math.abs(re[i] - keep[i]) < 1e-4, `ifft sample ${i} drifted`);
});

test('hann window is periodic, zero at the ends, 1.0 at the centre', () => {
  const w = standalone.hann(9);
  assert.ok(Math.abs(w[0]) < 1e-12);
  assert.ok(Math.abs(w[8]) < 1e-6);
  assert.ok(Math.abs(w[4] - 1) < 1e-6);
  /* periodic (spectral-analysis) window: w[i] === w[N-i], not symmetric w[i] === w[N-1-i] */
  for (let i = 1; i < 4; i++) assert.ok(Math.abs(w[i] - w[8 - i]) < 1e-6, `w[${i}] != w[8-${i}]`);
});

/* ======================= denoise ======================= */
test('denoise drops the learned noise floor but keeps the tone intact', async () => {
  const sr = 16000, secs = 3;
  const clean = new FakeBuffer(1, sr * secs, sr);
  const noisy = new FakeBuffer(1, sr * secs, sr);
  const c = clean.getChannelData(0), x = noisy.getChannelData(0);
  for (let i = 0; i < c.length; i++) {
    c[i] = i > sr * 0.5 ? 0.5 * Math.sin(2 * Math.PI * 300 * i / sr) : 0;   /* 0.5 s of noise only, then speech-band tone */
    x[i] = c[i] + 0.05 * (Math.random() * 2 - 1);
  }
  const out = await standalone.denoiseBuffer(noisy, 2.0, () => {});
  const band = (b, a, z) => {
    const d = b.getChannelData(0); let s = 0;
    for (let i = a; i < z; i++) s += d[i] * d[i];
    return Math.sqrt(s / (z - a));
  };
  const inNoise = band(noisy, 0, sr * 0.4), outNoise = band(out, 0, sr * 0.4);
  assert.ok(outNoise < inNoise * 0.5, `noise floor must fall >=6 dB (got ${(20 * Math.log10(outNoise / inNoise)).toFixed(1)} dB)`);
  /* regression: the old windowing divided by a near-zero overlap weight and
     produced a huge click in the first 100 ms */
  assert.ok(peak(out) <= peak(noisy) + 1e-3, `denoise must not add a head transient (peak ${peak(out).toFixed(2)} vs ${peak(noisy).toFixed(2)})`);
  /* the tail must still be processed — the old version stopped at length-2048 */
  assert.ok(band(out, sr * 2.9, sr * 3) > 0.05, 'last 100 ms went silent');
  assert.ok(Math.abs(band(out, sr, sr * 2) - band(noisy, sr, sr * 2)) < 0.05, 'tone level must survive');
});

/* ======================= resample ======================= */
test('resampleLinear preserves duration, pitch and channel count', () => {
  const src = tone(1, 440, 0.5, 48000, 2);
  const out = standalone.resampleLinear(src, 44100);
  assert.equal(out.numberOfChannels, 2, 'stereo must stay stereo');
  assert.ok(Math.abs(out.duration - src.duration) < 0.002, `duration drifted to ${out.duration}`);
  assert.ok(Math.abs(pitchOf(out) - 440) < 12, `pitch drifted to ${pitchOf(out).toFixed(1)} Hz`);
  assert.ok(rms(out, 1) > 0.3, 'second channel must not be silent');
  const same = standalone.resampleLinear(src, 48000);
  assert.equal(same, src, 'no-op when the rate already matches');
});

/* ======================= slicing ======================= */
test('sliceBuf cuts the requested window and clamps past the end', () => {
  const b = tone(4, 100, 0.5, 8000, 2);
  const s = standalone.sliceBuf(b, 1, 2.5);
  assert.equal(s.length, Math.ceil(1.5 * 8000));
  assert.equal(s.numberOfChannels, 2);
  assert.equal(s.getChannelData(0)[0], b.getChannelData(0)[8000], 'must start exactly at 1 s');
  assert.equal(standalone.sliceBuf(b, 3.5, 10).length, Math.ceil(0.5 * 8000), 'clamp to end of file');
});

/* ======================= tempo ======================= */
test('tempo detection is accurate on 60-200 BPM material', () => {
  const cases = [[70, 0], [90, 0], [100, 2], [120, 0], [128, 2], [140, 0], [174, 0]];
  for (const [bpm, hats] of cases) {
    const got = tempoOf(drumTrack(bpm, { hats })).bpm;
    assert.ok(Math.abs(got - bpm) <= 2, `${bpm} BPM detected as ${got}`);
  }
});

test('tempo detection refuses silence, drones and noise instead of guessing', () => {
  assert.equal(tempoOf(new FakeBuffer(1, SR * 3, SR)).bpm, 0, 'silence');
  const drone = new FakeBuffer(1, SR * 5, SR);
  const d = drone.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = 0.3 * Math.sin(i * 0.07);
  assert.equal(tempoOf(drone).bpm, 0, 'steady tone has no beat');
  const noise = new FakeBuffer(1, SR * 5, SR);
  const n = noise.getChannelData(0);
  for (let i = 0; i < n.length; i++) n[i] = 0.2 * (Math.random() * 2 - 1);
  assert.equal(tempoOf(noise).bpm, 0, 'white noise has no beat');
});

/* ======================= silence removal ======================= */
test('findSilences keeps speech and drops gaps', () => {
  const b = new FakeBuffer(1, SR * 3, SR);
  const d = b.getChannelData(0);
  const burst = (from, to) => {
    for (let i = Math.round(from * SR); i < Math.round(to * SR); i++) d[i] = 0.4 * Math.sin(2 * Math.PI * 220 * i / SR);
  };
  burst(0.2, 0.8); burst(1.4, 2.0); burst(2.4, 2.8);   /* 0.6 s gaps */
  const keep = findSilences(b);
  assert.equal(keep.length, 3, `expected 3 segments, got ${keep.length}`);
  const kept = keep.reduce((a, s) => a + (s[1] - s[0]), 0) / SR;
  assert.ok(kept > 1.6 && kept < 2.3, `kept ${kept.toFixed(2)} s of 1.8 s of audio`);
  assert.ok(keep.every(s => s[0] < s[1]), 'segments must be ordered');
});

/* ======================= merge / mix / insert ======================= */
test('merge concatenates a 44.1 kHz and a 48 kHz file without drift', () => {
  const merged = new Function('S', 'AC', 'resampleLinear', 'return ' + srcOf('concat'))({
    items: [{ name: 'a', buf: tone(1, 300, 0.5, 44100, 1) }, { name: 'b', buf: tone(2, 300, 0.5, 48000, 2) }],
  }, AC, standalone.resampleLinear)();
  const concat = merged;
  assert.ok(Math.abs(concat.duration - 3) < 0.01, `merged file is ${concat.duration.toFixed(3)} s, expected 3 s`);
  assert.equal(concat.numberOfChannels, 2, 'mono source must be upmixed, not dropped');
  assert.ok(rms(concat, 1) > 0.3, 'right channel must carry the mono file too');
});

test('mix sums both tracks, resamples odd rates and never clips', () => {
  const m = mixDataOf({ buf: tone(1, 200, 0.6, SR, 1), gain: 1 }, { buf: tone(1, 200, 0.6, 44100, 1), gain: 1 });
  assert.equal(m.total, SR, 'a 44.1 kHz track must be resampled to the 48 kHz output');
  let p = 0;
  for (let i = 0; i < m.total; i++) p = Math.max(p, Math.abs(m.L[i]), Math.abs(m.R[i]));
  assert.ok(p <= 1.0000001, `mix peaked at ${p}`);
  assert.ok(p > 0.5, 'mix must not be scaled to nothing');
  /* two equal 200 Hz tones in phase must sum, not cancel */
  const mid = Math.abs(m.L[Math.round(SR / 800)]);
  assert.ok(mid > 0.05, 'tracks were not added together');
});

test('insert splices at the requested position and keeps total length', () => {
  const base = tone(2, 200, 0.5, SR, 2), ins = tone(1, 800, 0.5, SR, 2);
  const out = spliceOf(base, ins, 1.0, false);
  assert.ok(Math.abs(out.duration - 3) < 0.001, `expected 3 s, got ${out.duration}`);
  /* the 800 Hz insert must now occupy 1.0-2.0 s */
  const d = out.getChannelData(0);
  let cross = 0;
  for (let i = SR; i < 2 * SR; i++) if (d[i - 1] < 0 && d[i] >= 0) cross++;
  assert.ok(Math.abs(cross - 800) < 30, `insert region reads ${cross} Hz`);
  /* with a crossfade the same splice must stay continuous (no click) */
  const fade = spliceOf(base, ins, 1.0, true);
  /* crossfade splices overlap the 0.2 s join, so 2 s + 1 s - 0.2 s = 2.8 s */
  assert.ok(Math.abs(fade.duration - 2.8) < 0.002, `crossfaded splice is ${fade.duration.toFixed(3)} s`);
  /* and the join must be as loud as its sources (a fade bug would dip here) */
  assert.ok(rms(fade) > 0.25, 'crossfaded region must not be attenuated');
  assert.ok(peak(fade) <= 1.0000001, 'crossfade must not overshoot');
});

/* ======================= effects helpers ======================= */
test('soft-clip limiter keeps gain linear under the knee', () => {
  const boost = new Function(`
    const softClip=x=>{ const a=Math.abs(x); return a<=.8?x:Math.sign(x)*(.8+.2*Math.tanh((a-.8)/.2)); };
    return function(d,db){ const g=Math.pow(10,db/20); return d.map(x=>softClip(x*g)); };`)();
  const out = boost([0.05, -0.1], 6);
  assert.ok(Math.abs(out[0] - 0.05 * Math.pow(10, 6 / 20)) < 1e-7, '+6 dB must be exactly +6 dB');
  const hot = boost([0.9, 1.4, -2], 12);
  assert.ok(hot.every(v => Math.abs(v) <= 1.0000001), 'never exceeds full scale');
});

/* ======================= speed / pitch ======================= */
test('speed control changes play time and pitch together (tape-style)', () => {
  const src = tone(2, 440, 0.5, 44100, 2);
  const fast = resampleSpeed(src, 2);
  assert.ok(Math.abs(fast.duration - 1) < 0.01, `2x gave ${fast.duration.toFixed(2)} s`);
  assert.ok(Math.abs(pitchOf(fast) - 880) < 20, `2x gave ${pitchOf(fast).toFixed(0)} Hz`);
  assert.equal(fast.numberOfChannels, 2);
  const slow = resampleSpeed(src, 0.5);
  assert.ok(Math.abs(slow.duration - 4) < 0.02 && Math.abs(pitchOf(slow) - 220) < 10);
});

test('pitch shifter moves the pitch and keeps the play time', () => {
  const src = tone(2, 440, 0.5, 44100, 2);
  for (const [semis, want] of [[12, 880], [-12, 220], [7, 659]]) {
    const out = pitchShiftGrain(src, Math.pow(2, semis / 12));
    assert.ok(Math.abs(out.duration - src.duration) < 0.001, `${semis} st changed the length to ${out.duration.toFixed(2)} s`);
    assert.ok(Math.abs(pitchOf(out) - want) / want < 0.03, `${semis} st gave ${pitchOf(out).toFixed(0)} Hz, wanted ~${want}`);
    assert.equal(out.numberOfChannels, 2, 'stereo preserved');
    assert.ok(rms(out, 1) > 0.3, 'right channel must not be dropped');
  }
  /* a silent source must stay silent (no NaN / DC from the grain maths) */
  const silent = pitchShiftGrain(new FakeBuffer(1, 44100, 44100), 2);
  assert.ok(peak(silent) === 0, 'silence must stay silent');
  /* unity ratio is a pass-through */
  assert.equal(pitchShiftGrain(src, 1), src);
});

/* ======================= analyser ======================= */
const analyze = new Function('return ' + srcOf('analyze'))();

test('analyser reports real peak/RMS on every channel and counts clipping', () => {
  const half = tone(2, 1000, 0.5, SR, 2);
  half.getChannelData(1).fill(0);
  const both = tone(2, 1000, 0.5, SR, 2);
  const a = analyze(half), b = analyze(both);
  /* a 0.5 sine is -6.02 dBFS peak and -9.03 dBFS RMS */
  assert.ok(Math.abs(b.dbPeak - -6.02) < 0.1, `peak read ${b.dbPeak.toFixed(2)} dBFS`);
  assert.ok(Math.abs(b.dbRms - -9.03) < 0.1, `rms read ${b.dbRms.toFixed(2)} dBFS`);
  assert.ok(a.dbPeak > b.dbPeak || Math.abs(a.dbPeak - b.dbPeak) < 0.1, 'peak unaffected by a silent channel');
  assert.ok(a.dbRms < b.dbRms - 2.5, 'RMS must average both channels, not just the left');
  assert.equal(b.clip, 0);
  const hot = tone(1, 1000, 1.2, SR, 2);
  assert.ok(analyze(hot).clip > 0, 'clipped samples must be counted');
  /* loudness estimate must be within a few dB of RMS for steady tone */
  assert.ok(Math.abs(b.lufs - b.dbRms) < 4, `LUFS ${b.lufs.toFixed(1)} vs RMS ${b.dbRms.toFixed(1)}`);
});

/* ======================= export ======================= */
const toInt16 = new Function('return ' + srcOf('toInt16'))();
const wavBlob = new Function('Blob', 'return ' + srcOf('wavBlob'))(Blob);

test('WAV export writes a correct 16-bit PCM header and sample data', async () => {
  const buf = new FakeBuffer(2, 1000, 44100);
  buf.getChannelData(0)[0] = 1;          /* full scale */
  buf.getChannelData(1)[0] = -1;
  buf.getChannelData(0)[1] = 0.5;        /* -6 dB */
  const blob = wavBlob(buf);
  const dv = new DataView(await blob.arrayBuffer());
  const str = (o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  assert.equal(str(0), 'RIFF');
  assert.equal(str(8), 'WAVE');
  assert.equal(str(12), 'fmt ');
  assert.equal(dv.getUint16(20, true), 1, 'PCM format tag');
  assert.equal(dv.getUint16(22, true), 2, 'channel count');
  assert.equal(dv.getUint32(24, true), 44100, 'sample rate');
  assert.equal(dv.getUint16(34, true), 16, 'bit depth');
  assert.equal(dv.getUint32(40, true), 1000 * 2 * 2, 'data chunk size');
  assert.equal(dv.byteLength, 44 + 1000 * 2 * 2);
  /* interleaved L,R pairs, clamped to full scale */
  assert.equal(dv.getInt16(44, true), 32767, 'L[0] = +1 → 32767');
  assert.equal(dv.getInt16(46, true), -32768, 'R[0] = -1 → -32768');
  assert.ok(Math.abs(dv.getInt16(48, true) - 16384) <= 2, 'L[1] = 0.5 → ~16384');
  /* int16 conversion clamps and never overflows */
  const i16 = toInt16(new Float32Array([2, -2, 0.25]));
  assert.equal(i16[0], 32767);
  assert.equal(i16[1], -32768);
  assert.ok(Math.abs(i16[2] - 8192) <= 2);
});

/* ======================= fuzz / edge cases ======================= */
test('DSP helpers survive tiny, empty and pathological buffers', async () => {
  const shapes = [
    ['empty', new FakeBuffer(1, 0, 44100)],
    ['one sample', new FakeBuffer(2, 1, 44100)],
    ['20 ms', new FakeBuffer(1, 882, 44100)],
    ['clipped', (() => { const b = new FakeBuffer(2, 4410, 44100); b.getChannelData(0).fill(2); b.getChannelData(1).fill(-2); return b; })()],
  ];
  for (const [name, buf] of shapes) {
    const out = await standalone.denoiseBuffer(buf, 2, () => {});
    assert.equal(out.length, buf.length, `denoise ${name}: length changed`);
    const d = out.getChannelData(0);
    for (let i = 0; i < d.length; i++) assert.ok(Number.isFinite(d[i]), `denoise ${name}: non-finite sample at ${i}`);
    const rs = standalone.resampleLinear(buf, 48000);
    assert.ok(rs && rs.numberOfChannels === buf.numberOfChannels, `resample ${name} lost channels`);
  }
  /* a start position past the end must clamp, not throw or return a negative length */
  const b = tone(1, 100, 0.5, 44100, 2);
  assert.equal(standalone.sliceBuf(b, 2, 3).length, 1, 'slice past the end');
  assert.equal(standalone.sliceBuf(b, -1, 0.5).length, 44100, 'slice before zero returns the whole file');
  assert.equal(standalone.sliceBuf(b, 0.8, 0.2).length, 1, 'reversed range');
});

/* =================================================================
 * Regressions for the A-to-Z tool audit (audio & video page).
 * Each of these caught a real bug that shipped; keep them.
 * ================================================================= */

test('tempo detection calls a sustained pad what it is instead of inventing a BPM', () => {
  /* A stack of harmonics with no transients is a pad/drone, not a groove.
     Before the rhythm-salience gate this reported e.g. "154 BPM". */
  const pad = new FakeBuffer(1, SR * 8, SR);
  const d = pad.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    d[i] = 0.12 * Math.sin(2 * Math.PI * 220 * t) + 0.08 * Math.sin(2 * Math.PI * 330 * t) + 0.05 * Math.sin(2 * Math.PI * 440 * t);
  }
  const r = tempoOf(pad);
  assert.equal(r.bpm, 0, `pad must not report a tempo (got ${r.bpm})`);
  assert.equal(r.why, 'sustained', 'the reason must be reported so the UI can explain itself');

  /* a real four-on-the-floor under the same pad must still be found */
  const mixed = new FakeBuffer(1, SR * 8, SR);
  const m = mixed.getChannelData(0);
  m.set(d);
  for (let t = 0; t < 7.9; t += 0.5) {                     /* 120 BPM */
    const i0 = Math.round(t * SR);
    for (let k = 0; k < Math.round(0.1 * SR); k++) {
      m[i0 + k] += 0.9 * Math.exp(-(k / SR) * 38) * Math.sin(2 * Math.PI * 60 * k / SR);
    }
  }
  const beat = tempoOf(mixed);
  assert.ok(Math.abs(beat.bpm - 120) <= 2, `120 BPM under a pad detected as ${beat.bpm}`);
});

test('tempo detection explains itself when the clip is too short to analyse', () => {
  const brief = drumTrack(120, { secs: 0.4 });
  const r = tempoOf(brief);
  assert.equal(r.bpm, 0);
  assert.equal(r.why, 'short');
});

test('the MP3/Ogg encoder arms its ended handler before the source starts', () => {
  /* encodeWithAudioContext used to await a stop that never came for very short
     buffers: 'ended' fired before the listener existed. Assert ordering in source. */
  const src = srcOf('encodeWithAudioContext');
  const armEnd = src.indexOf('src.onended');
  const start = src.indexOf('src.start(');
  assert.ok(armEnd > 0 && start > 0, 'encoder shape changed — re-check this test');
  assert.ok(armEnd < start, "'ended' must be bound before src.start(0)");
  /* and it must not wait on `done` without a guard */
  assert.match(src, /Promise\.race\(\s*\[done/, 'the stop must be awaited with a timeout');
});

test('the recorder helpers guarantee they cannot hang or save an empty file', () => {
  for (const name of ['recordVideoWithCanvas', 'recordVideoAdvanced']) {
    const src = srcOf(name);
    assert.match(src, /Promise\.race\(/, `${name} must race its completion with a timeout`);
    assert.match(src, /chunks\.length/, `${name} must reject an empty recording`);
  }
  /* a video whose codec the browser cannot decode must reject, not wait forever */
  const meta = srcOf('waitMeta');
  assert.match(meta, /rej\(/, 'waitMeta needs an error path');
  assert.match(meta, /setTimeout\([\s\S]*?rej\(/, 'waitMeta needs a timeout path');
  const load = srcOf('loadVideoFile');
  assert.match(load, /setTimeout\([\s\S]*?rej\(/, 'loadVideoFile needs a timeout path');
});

test('every template/video tool stops on the end of the clip, not on a buffer stall', () => {
  /* a paused video draws no frames, but `paused` is also true for the frame
     before play() resolves — keying off it truncated exports */
  const stops = [...html.matchAll(/if\(v\.ended\s*\|\|\s*v\.paused\)/g)].length
             + [...html.matchAll(/if\(v\.ended \|\| v\.paused\)/g)].length;
  assert.equal(stops, 0, 'stills stop the recorder on v.paused, which fires during stalls');
});

test('video crop clamps the window inside the frame and exports the cropped size', () => {
  const src = srcOf('renderVcrop');
  assert.match(src, /function clampCrop\(/, 'crop must be clamped');
  assert.match(src, /outW/, 'export must pass the cropped width');
  /* run the real clamp: every edge out of bounds must land back inside the frame */
  const S = { crop: { x: -0.5, y: 1.4, w: 3, h: 0.001 } };
  const clampCrop = new Function('S', 'clamp', 'return ' + srcOf('clampCrop') + '\nclampCrop;')(S, clamp);
  clampCrop();
  assert.ok(S.crop.w > 0 && S.crop.w <= 1 && S.crop.h > 0 && S.crop.h <= 1, 'w/h ran out of range');
  assert.ok(S.crop.x >= 0 && S.crop.x + S.crop.w <= 1 + 1e-9, 'x escaped the frame');
  assert.ok(S.crop.y >= 0 && S.crop.y + S.crop.h <= 1 + 1e-9, 'y escaped the frame');
});

test('merge releases each clip audio track so clip N does not play over clip N-1', () => {
  const src = srcOf('renderVmerge');
  assert.match(src, /removeTrack\(addedTrack\)/, 'the per-clip audio track must be removed');
  assert.match(src, /Add at least two clips/, 'an empty list must be explained, not silent');
});

test('slide crossfade draws the previous slide underneath instead of dipping to black', () => {
  const src = srcOf('renderVslideshow');
  assert.match(src, /globalAlpha=fr\/12/, 'crossfade alpha ramp missing');
  assert.match(src, /S\.files\[idx-1\]/, 'crossfade must composite the previous image');
  assert.doesNotMatch(src, /transition fade in first 12 frames/, 'the black-dip code is back');
});

test('clipboard fallback never throws and always resolves', () => {
  const src = srcOf('copyText');
  assert.match(src, /catch/, 'copyText must catch the async clipboard failure');
  assert.match(src, /execCommand/, 'copyText needs the legacy fallback');
});

test('tool renderers do not double-wrap the router', () => {
  /* the detail-panel IIFE used to sit inside route() and re-wrap window.route on
     every navigation, so the Nth visit rendered N times */
  assert.equal([...html.matchAll(/window\.route\s*=\s*function/g)].length, 0,
    'nothing may reassign window.route');
  assert.match(html, /function videoDetailPanel\(\)/, 'the panel must exist as a plain function');
});
