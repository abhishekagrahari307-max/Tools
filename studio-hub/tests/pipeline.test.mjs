// Headless test for the audio/video export pipelines.
//   node --test tests/
//
// jsdom has no real canvas, no MediaRecorder and no media clock, so this test
// installs small stubs for those three APIs and then drives the studio's real
// encodeAudio() / recordVideoAdvanced() functions. It proves the wiring — a
// frame is drawn, progress reaches 100%, the output size is honoured, errors
// reject — not that a browser's encoder produces valid pixels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let JSDOM, VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = await import('jsdom'));
} catch {
  test('pipeline test (skipped: jsdom is not installed)', { skip: true }, () => {});
  JSDOM = null;
}

function serve() {
  return createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(root, p);
    if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' });
    res.end(readFileSync(f));
  });
}

if (JSDOM) test('audio and video export pipelines actually run', async (t) => {
  const server = serve();
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!/Not implemented/.test(e.message)) errors.push(e.message); });

  const dom = await JSDOM.fromURL(`http://127.0.0.1:${port}/audio-video/`, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      // ---------- canvas ----------
      const calls = [];
      w.__ctxCalls = calls;
      w.HTMLCanvasElement.prototype.getContext = function () {
        if (this.__ctx) return this.__ctx;
        const rec = (name) => (...args) => { calls.push(name); return { addColorStop() {} }; };
        const api = {};
        for (const k of ['save', 'restore', 'translate', 'scale', 'rotate', 'drawImage', 'fillRect',
          'clearRect', 'setTransform', 'beginPath', 'arc', 'fill', 'stroke', 'fillText', 'moveTo',
          'lineTo', 'closePath', 'rect', 'createLinearGradient']) api[k] = rec(k);
        ['filter', 'fillStyle', 'strokeStyle', 'lineWidth'].forEach((k) => { api[k] = ''; });
        this.__ctx = api;
        return api;
      };
      w.HTMLCanvasElement.prototype.captureStream = () => ({ getAudioTracks: () => [], getVideoTracks: () => [] });
      w.URL.createObjectURL = () => 'blob:test-' + Math.random().toString(36).slice(2);
      w.URL.revokeObjectURL = () => {};

      // ---------- MediaRecorder ----------
      class FakeRecorder {
        constructor(stream, opts) { this.mimeType = (opts && opts.mimeType) || 'video/webm'; this.state = 'inactive'; }
        static isTypeSupported(m) { return /video\/(webm|mp4)|audio\/(ogg|webm|mp4)/.test(m); }
        start() {
          this.state = 'recording';
          setTimeout(() => this.ondataavailable && this.ondataavailable({ data: new Blob(['x'.repeat(32)]) }), 5);
        }
        stop() { this.state = 'inactive'; setTimeout(() => this.onstop && this.onstop(), 10); }
      }
      w.MediaRecorder = FakeRecorder;

      // ---------- Web Audio ----------
      w.__fakeBuffer = (len = 4410, sr = 44100, ch = 2) => {
        const data = Array.from({ length: ch }, () => new Float32Array(len).map((_, i) => Math.sin(i / 8) * 0.3));
        return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: (i) => data[i] };
      };
      w.AudioContext = w.webkitAudioContext = class {
        constructor() { this.sampleRate = 44100; this.destination = {}; }
        createBuffer(ch, len, sr) { return w.__fakeBuffer(len, sr, ch); }
        createMediaStreamDestination() { return { stream: { getAudioTracks: () => [] } }; }
        createBufferSource() { return { connect() {}, start() { setTimeout(() => this.onended && this.onended(), 10); } }; }
      };
    },
  });

  const w = dom.window;
  await new Promise((r) => w.addEventListener('load', r));
  await new Promise((r) => setTimeout(r, 500));

  // ---------- media element stubs (installed after boot, like a real device would) ----------
  const proto = Object.getPrototypeOf(w.document.createElement('video'));
  const dur = 2;
  let clock = 0;
  Object.defineProperty(proto, 'duration', { configurable: true, get: () => dur });
  Object.defineProperty(proto, 'videoWidth', { configurable: true, get: () => 640 });
  Object.defineProperty(proto, 'videoHeight', { configurable: true, get: () => 360 });
  Object.defineProperty(proto, 'readyState', { configurable: true, get: () => 4 });
  Object.defineProperty(proto, 'currentTime', { configurable: true, get: () => clock, set: (v) => { clock = v; } });
  Object.defineProperty(proto, 'ended', { configurable: true, get: () => clock >= dur });
  Object.defineProperty(proto, 'src', {
    configurable: true,
    get() { return this.__src || ''; },
    set(v) { this.__src = v; setTimeout(() => this.onloadedmetadata && this.onloadedmetadata(), 5); },
  });
  proto.load = function () {};
  proto.play = function () {
    const el = this;
    const tick = () => { if (clock >= dur) { el.onended && el.onended(); return; } clock += 0.05; setTimeout(tick, 4); };
    setTimeout(tick, 4);
    return Promise.resolve();
  };
  proto.pause = function () {};
  proto.captureStream = () => ({ getAudioTracks: () => [], getVideoTracks: () => [] });

  const evalIn = (code) => w.eval(`(async () => { ${code} })()`);

  await t.test('audio → WAV returns a blob', async () => {
    const out = await evalIn(`
      const b = window.__fakeBuffer(4410, 44100, 2);
      const r = await encodeAudio(b, 'wav', 192, () => {});
      return { size: r.blob.size, ext: r.ext };`);
    assert.equal(out.ext, 'wav');
    assert.ok(out.size > 44, 'WAV should contain a 44-byte header plus samples');
  });

  await t.test('audio → OGG goes through the browser encoder', async () => {
    const out = await evalIn(`
      const b = window.__fakeBuffer(4410, 44100, 2);
      const r = await encodeAudio(b, 'ogg', 192, () => {});
      return { size: r.blob.size, ext: r.ext };`);
    assert.equal(out.ext, 'ogg');
    assert.ok(out.size > 0);
  });

  await t.test('video export draws frames, reports progress and honours the size', async () => {
    const out = await evalIn(`
      const file = new File([new Uint8Array(512)], 'clip.mp4', { type: 'video/mp4' });
      const steps = [];
      const r = await recordVideoAdvanced(file, {
        width: 640, height: 360, fps: 30, bitrate: 2000000,
        mime: pickVideoMime('mp4'), start: 0, end: 1, fit: 'fit', audio: false
      }, (p) => steps.push(p));
      return { size: r.blob.size, w: r.w, h: r.h, ext: r.ext, steps: steps.length, last: steps[steps.length - 1] };`);
    assert.ok(out.size > 0, 'recording should produce data');
    assert.equal(out.w, 640);
    assert.equal(out.h, 360);
    assert.ok(['mp4', 'webm'].includes(out.ext));
    assert.ok(out.steps > 0, 'progress callbacks should fire');
    assert.equal(out.last, 1, 'progress should finish at 100%');
    assert.ok(w.__ctxCalls.includes('drawImage'), 'a frame should be drawn to the canvas');
    assert.ok(w.__ctxCalls.includes('translate'), 'the canvas transform should be applied');
  });

  await t.test('a video with no picture track rejects with a clear message', async () => {
    const msg = await evalIn(`
      const target = Object.getPrototypeOf(document.createElement('video'));
      const original = Object.getOwnPropertyDescriptor(target, 'videoWidth');
      Object.defineProperty(target, 'videoWidth', { configurable: true, get: () => 0 });
      try {
        await recordVideoAdvanced(new File([new Uint8Array(8)], 'x.mp4'), { audio: false });
        return 'no error';
      } catch (e) { return 'rejected: ' + e.message; }
      finally { if (original) Object.defineProperty(target, 'videoWidth', original); }`);
    assert.match(msg, /rejected:/);
  });

  await t.test('every route still renders', async () => {
    const routes = w.eval('Object.keys(routes)');
    assert.ok(routes.length >= 62, 'the studio should expose its full route table');
    for (const r of ['aconv', 'vconv', 'vresize']) {
      assert.ok(routes.includes(r), `${r} is not routed`);
      w.location.hash = '#' + r;
      await new Promise((res) => setTimeout(res, 50));
      assert.ok(w.document.getElementById('page').innerHTML.length > 500, `${r} rendered nothing`);
    }
  });

  /* A tool that throws while it builds its panel leaves a blank page — this walks
     the whole route table (not just three routes) and fails on any exception. */
  await t.test('no route throws while rendering', async () => {
    const seen = [];
    const onErr = (e) => seen.push(`${e.message || e.error}`);
    w.addEventListener('error', onErr);
    const routes = w.eval('Object.keys(routes)');
    const blank = [];
    for (const r of routes) {
      const before = seen.length;
      w.location.hash = '#' + r;
      await new Promise((res) => setTimeout(res, 40));
      const html = w.document.getElementById('page').innerHTML;
      if (html.length < 300) blank.push(`${r} (${html.length} chars)`);
      if (seen.length > before) blank.push(`${r} threw: ${seen[seen.length - 1]}`);
    }
    w.removeEventListener('error', onErr);
    assert.deepEqual(blank, [], 'these routes failed to render');
  });

  await t.test('text to speech degrades cleanly when the browser has no voice engine', async () => {
    const saved = Object.getOwnPropertyDescriptor(w, 'speechSynthesis');
    try {
      delete w.speechSynthesis;              /* Firefox-on-Linux case */
      w.location.hash = '#tts';
      await new Promise((res) => setTimeout(res, 80));
      const html = w.document.getElementById('page').innerHTML;
      assert.ok(html.length > 300, 'TTS panel must still render');
      assert.match(html, /Not supported|speech/i, 'the panel must explain the missing engine');
    } finally {
      if (saved) Object.defineProperty(w, 'speechSynthesis', saved);
    }
  });

  w.close();
  server.close();
});
