/*
 * Tests for the online layer (assets/online-core.js, assets/online-media.js,
 * online/catalog.js) and for the honesty guarantees the site now makes.
 *
 * These run without a network: fetch is mocked, and the catalog test reads the
 * shipped JSON straight off disk. Nothing here calls a third party.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const url = p => fileURLToPath(new URL(p, import.meta.url));

const CORE = url('../assets/online-core.js');
const MEDIA = url('../assets/online-media.js');
const CATALOG = url('../online/catalog.json');
const PAGE = url('../audio-video/index.html');
const HUB = url('../index.html');

/* ------------------------------------------------------------ test doubles */
function makeWindow({ online = true } = {}) {
  const store = new Map();
  const listeners = {};
  const w = {
    navigator: { onLine: online, language: 'en-IN' },
    location: { href: 'http://localhost/studio-hub/online/' },
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    document: {
      documentElement: {},
      addEventListener: (n, fn) => { (listeners[n] = listeners[n] || []).push(fn); },
      dispatchEvent: () => true,
      querySelectorAll: () => [],
      createElement: () => ({ style: {}, appendChild() {}, remove() {}, classList: { add() {}, remove() {}, toggle() {} } }),
      body: { appendChild() {} },
    },
    addEventListener: (n, fn) => { (listeners[n] = listeners[n] || []).push(fn); },
    dispatchEvent: () => true,
    CustomEvent: class { constructor(n, o) { this.type = n; this.detail = o && o.detail; } },
    setTimeout, clearTimeout, Date, URL, JSON, Math, Promise, Error, Object, Array, String, Number,
    AbortController: globalThis.AbortController,
  };
  return w;
}

/* load online-core.js into a fake global scope and return its exports */
function loadCore(opts = {}) {
  const w = makeWindow(opts);
  const src = readFileSync(CORE, 'utf8');
  const fn = new Function('window', 'document', 'navigator', 'localStorage', 'location',
    'setTimeout', 'clearTimeout', 'fetch', 'AbortController', 'CustomEvent', 'URL',
    src + '\nreturn {OBLang, OBNet, OBDom, OB_I18N};');
  return fn(w, w.document, w.navigator, w.localStorage, w.location,
    setTimeout, clearTimeout, opts.fetch || (() => { throw new Error('no fetch in this test'); }),
    globalThis.AbortController, w.CustomEvent, URL);
}

/* ---------------------------------------------------------------- i18n */
test('i18n has the same keys in both languages, so nothing falls back to a raw key', () => {
  const { OB_I18N } = loadCore();
  const en = Object.keys(OB_I18N.en).sort();
  const hi = Object.keys(OB_I18N.hi).sort();
  assert.deepEqual(hi, en, 'Hindi and English dictionaries must cover the same keys');
  for (const k of en) {
    assert.ok(String(OB_I18N.en[k]).trim(), `en["${k}"] is empty`);
    assert.ok(String(OB_I18N.hi[k]).trim(), `hi["${k}"] is empty`);
  }
});

test('language choice persists and defaults sanely', () => {
  const { OBLang } = loadCore();
  assert.equal(OBLang.get(), 'en', 'en-IN browser locale should start in English');
  OBLang.set('hi');
  assert.equal(OBLang.get(), 'hi', 'choice must survive a reload');
  OBLang.set('klingon');                    /* invalid input must be ignored, not stored */
  assert.equal(OBLang.get(), 'hi');
});

/* ------------------------------------------------------------------ net */
test('every request carries a timeout, omits credentials and sends no referrer', async () => {
  const { OBNet } = loadCore();
  assert.ok(OBNet.timeoutMs > 0 && OBNet.timeoutMs <= 30000, 'a sane default timeout must exist');
  const src = readFileSync(CORE, 'utf8');
  assert.match(src, /credentials:\s*'omit'/, 'requests must never send cookies');
  assert.match(src, /referrerPolicy:\s*'no-referrer'/, 'requests must not leak the referrer');
  assert.match(src, /AbortController/, 'requests must be abortable');
});

test('a non-2xx reply becomes a readable message naming the host', async () => {
  const { OBNet } = loadCore({
    fetch: async () => ({ ok: false, status: 429, text: async () => '' }),
  });
  await assert.rejects(
    () => OBNet.request('https://api.example.org/v1/thing'),
    (e) => {
      assert.equal(e.host, 'api.example.org');
      assert.equal(e.status, 429);
      assert.match(e.message, /api\.example\.org/);
      assert.match(e.message, /429/);
      return true;
    }
  );
});

test('a non-JSON reply is reported as such rather than crashing the tool', async () => {
  const { OBNet } = loadCore({
    fetch: async () => ({ ok: true, status: 200, text: async () => '<html>login</html>' }),
  });
  await assert.rejects(
    () => OBNet.request('https://api.example.org/x'),
    (e) => {
      assert.equal(e.nonJson, true);
      assert.match(e.message, /JSON/i);
      return true;
    }
  );
});

test('being offline is detected before a request is attempted', async () => {
  let called = false;
  const { OBNet } = loadCore({ online: false, fetch: async () => { called = true; } });
  await assert.rejects(() => OBNet.request('https://a.example.org/'), (e) => {
    assert.equal(e.offline, true);
    return true;
  });
  assert.equal(called, false, 'no request may be sent while offline');
});

test('the cache prevents a second identical call to a third party', async () => {
  let hits = 0;
  const { OBNet } = loadCore({
    fetch: async () => ({ ok: true, status: 200, text: async () => '{"v":1}' }),
  });
  const first = await OBNet.cached('k1', 60000, async () => { hits++; return (await OBNet.request('https://a.example.org/')).data; });
  const second = await OBNet.cached('k1', 60000, async () => { hits++; return (await OBNet.request('https://a.example.org/')).data; });
  assert.equal(hits, 1, 'the second call must come from cache');
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.deepEqual(second.value, { v: 1 });
});

/* --------------------------------------------------------------- SRT */
test('SRT parse/build round-trips timings exactly', () => {
  const w = makeWindow();
  const src = readFileSync(MEDIA, 'utf8');
  const fn = new Function('window', 'document', 'navigator', 'OBNet',
    src + '\nreturn window.OBMedia;')(w, w.document, w.navigator, { request() {} });
  const srt = '1\n00:00:01,000 --> 00:00:03,500\nHello there\n\n2\n00:00:04,000 --> 00:00:06,250\nSecond line\n';
  const cues = fn.parseSrt(srt);
  assert.equal(cues.length, 2);
  assert.deepEqual(cues.map(c => [c.start, c.end]), [['00:00:01,000', '00:00:03,500'], ['00:00:04,000', '00:00:06,250']]);
  const back = fn.buildSrt(cues);
  assert.equal(fn.parseSrt(back).length, 2);
  assert.equal(fn.parseSrt(back)[1].text, 'Second line');
});

test('SRT parsing accepts WebVTT-style dots and ignores junk blocks', () => {
  const w = makeWindow();
  const src = readFileSync(MEDIA, 'utf8');
  const fn = new Function('window', 'document', 'navigator', 'OBNet',
    src + '\nreturn window.OBMedia;')(w, w.document, w.navigator, { request() {} });
  const vtt = 'WEBVTT\n\n00:00:00.500 --> 00:00:02.000\nHi\n\nnot a cue at all\n';
  const cues = fn.parseSrt(vtt);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].text, 'Hi');
});

/* --------------------------------------------------- the catalog itself */
test('the shipped API catalog is well formed and keeps its counts stable', () => {
  const cat = JSON.parse(readFileSync(CATALOG, 'utf8'));
  assert.ok(cat.rows.length > 2000, `expected 2000+ APIs, found ${cat.rows.length}`);
  assert.equal(cat.count, cat.rows.length);
  assert.ok(cat.cats.length > 40, 'category list looks truncated');
  for (const row of cat.rows) {
    assert.equal(row.length, 5, 'a row must be [name, url, description, categoryIndex, flags]');
    assert.ok(row[0] && typeof row[0] === 'string', 'name missing');
    assert.ok(/^https?:\/\//.test(row[1]), `bad URL for ${row[0]}: ${row[1]}`);
    assert.ok(row[3] >= 0 && row[3] < cat.cats.length, `category index out of range for ${row[0]}`);
    assert.ok(typeof row[4] === 'number' && row[4] >= 0 && row[4] <= 7, `flags out of range for ${row[0]}`);
  }
  /* the filter the UI advertises must actually have matches */
  const keyFreeBrowser = cat.rows.filter(r => (r[4] & 1) && (r[4] & 2)).length;
  assert.ok(keyFreeBrowser > 300, `only ${keyFreeBrowser} key-free CORS APIs — the "No key + CORS" filter would look broken`);
});

/* -------------------------------------------- the honesty guarantees */
test('the studios no longer import a model from a CDN', () => {
  const html = readFileSync(PAGE, 'utf8');
  const imports = [...html.matchAll(/import\(\s*['"](https?:\/\/[^'"]+)/g)].map(m => m[1]);
  assert.deepEqual(imports, [], `found a remote dynamic import: ${imports.join(', ')}`);
  assert.equal([...html.matchAll(/cdn\.jsdelivr\.net/g)].length, 1,
    'the only jsDelivr mention left should be the comment explaining the removal');
});

test('the two online panels are opt-in and name their host in the UI', () => {
  const html = readFileSync(PAGE, 'utf8');
  assert.match(html, /commons\.wikimedia\.org/, 'the stock-photo panel must print its host');
  assert.match(html, /api\.mymemory\.translated\.net/, 'the subtitle panel must print its host');
  /* they are behind a button, not fired on load */
  assert.match(html, /tlStockPanel[^>]*hidden/, 'the stock panel must start collapsed');
});

test('the hub only claims what is true about third-party requests', () => {
  const html = readFileSync(HUB, 'utf8');
  /* the old blanket claim must be gone: two features do use the network */
  assert.doesNotMatch(html, /no third-party request while you work/i,
    'the site can no longer promise zero third-party requests');
  assert.match(html, /online/i, 'the privacy section must mention the online section');
});

test('the online page states the network risk before any control', () => {
  const page = readFileSync(url('../online/index.html'), 'utf8');
  const warn = page.indexOf('ob-warn');
  const scripts = page.indexOf('<script');
  assert.ok(warn > 0 && warn < scripts, 'the warning must appear in the markup, not be injected later');
  assert.match(page, /third-party/i);
  /* no inline handler may make a request before the user interacts */
  assert.doesNotMatch(page, /onload=["'][^"']*fetch/i);
});
