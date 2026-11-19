// The hub search box is generated from the two studios' catalogues.
//   node --test tests/
//
// If a tool is added to a studio and the index is not regenerated, the hub
// silently stops finding it — this test fails instead. It also checks that
// every indexed route really exists in the studio it points at.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

function hubIndex() {
  const html = read('index.html');
  const m = /var TOOLS = (\[.*?\]);\n/s.exec(html);
  assert.ok(m, 'the hub search index is missing from index.html');
  return JSON.parse(m[1]);
}

function avCatalogue() {
  const html = read('audio-video/index.html');
  const start = html.indexOf('const TOOLS=[');
  const block = html.slice(start, html.indexOf('\n];', start));
  return [...block.matchAll(/\{id:'([^']+)',\s*nm:'([^']+)'/g)].map((m) => ({ id: m[1], name: m[2] }));
}

function pixCatalogue() {
  const js = read('pixora/vendor/app.js');
  const start = js.indexOf('const TOOLS=[');
  const block = js.slice(start, js.indexOf('\n];', start));
  return [...block.matchAll(/\{id:'([^']+)',name:'([^']+)'/g)].map((m) => ({ id: m[1], name: m[2] }));
}

test('the hub search index lists every tool from both studios', () => {
  const index = hubIndex();
  const av = avCatalogue();
  const pix = pixCatalogue();
  assert.equal(index.length, av.length + pix.length,
    `hub index has ${index.length} rows, the studios define ${av.length + pix.length}`);

  const avRoutes = new Set(index.filter((t) => t.s === 'av').map((t) => t.r));
  for (const t of av) assert.ok(avRoutes.has(t.id), `audio/video tool "${t.id}" is not searchable from the hub`);

  const pixRoutes = new Set(index.filter((t) => t.s === 'pix').map((t) => t.r));
  for (const t of pix) assert.ok(pixRoutes.has(t.id), `pixora tool "${t.id}" is not searchable from the hub`);
});

test('every route in the search index really exists in its studio', () => {
  const index = hubIndex();
  const avHtml = read('audio-video/index.html');
  for (const t of index.filter((x) => x.s === 'av')) {
    assert.ok(new RegExp(`\\b${t.r}\\s*:\\s*render`).test(avHtml), `#${t.r} is indexed but has no route in audio-video`);
  }
  const pixJs = read('pixora/vendor/app.js');
  const pixIds = new Set(pixCatalogue().map((t) => t.id));
  for (const t of index.filter((x) => x.s === 'pix')) {
    assert.ok(pixIds.has(t.r), `#tool-${t.r} is indexed but is not a Pixora tool`);
  }
  assert.match(pixJs, /openFromHash/, 'pixora must accept #tool-<id> deep links from the hub');
});

test('the hub search markup and styles are wired', () => {
  const html = read('index.html');
  assert.ok(html.includes('id="hubSearch"'), 'the search input is missing');
  assert.ok(html.includes('assets/hub-search.css'), 'the search stylesheet is not linked');
  assert.ok(html.includes('id="navToggle"'), 'phones have no way to open the navigation');
  const css = read('assets/hub-search.css');
  for (const sel of ['.hub-search', '.hub-results', '.topnav-toggle']) {
    assert.ok(css.includes(sel), `${sel} is not styled`);
  }
});

/* A real DOM run: jsdom executes the page script, we type into the box and
   read the rendered results. This catches a typo the structural checks miss. */
let JSDOM;
try { ({ JSDOM } = await import('jsdom')); } catch { JSDOM = null; }

test('typing in the hub search finds tools from both studios', { skip: !JSDOM && 'jsdom is not installed' }, async () => {
  const html = read('index.html');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.test/' });
  const { window } = dom;
  const doc = window.document;
  await new Promise((r) => window.addEventListener('load', r));

  const input = doc.getElementById('hubSearch');
  assert.ok(input, 'the search input did not render');
  input.focus();
  input.value = 'compress';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));

  const panel = doc.querySelector('.hub-results');
  assert.ok(panel && panel.classList.contains('show'), 'the result panel did not open');
  const links = [...panel.querySelectorAll('a[data-hit]')];
  assert.ok(links.length > 1, 'compressing should match tools in both studios');
  const hrefs = links.map((a) => a.getAttribute('href'));
  assert.ok(hrefs.some((h) => h.startsWith('audio-video/#')), 'no audio/video tool in the results');
  assert.ok(hrefs.some((h) => h.startsWith('pixora/#tool-')), 'no pixora tool in the results');

  /* a query that matches nothing says so instead of showing a blank box */
  input.value = 'zzzznotatool';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.match(panel.textContent, /No tool matches/i);

  window.close();
});

test('the theme is shared with the studios and toggles both ways', async () => {
  const { JSDOM: Dom } = await import('jsdom');
  const html = read('index.html');
  const dom = new Dom(html, { runScripts: 'dangerously', url: 'https://example.test/' });
  const { window } = dom;
  const doc = window.document;
  const root = doc.documentElement;
  const btn = doc.getElementById('themeToggle');
  assert.equal(root.getAttribute('data-theme'), null, 'the hub should start dark');
  btn.click();
  assert.equal(root.getAttribute('data-theme'), 'light', 'the button did not switch to light');
  assert.equal(window.localStorage.getItem('studio-hub-theme'), 'light');
  assert.equal(window.localStorage.getItem('ae-theme'), 'light', 'the studios will not see the choice');
  btn.click();
  assert.equal(root.getAttribute('data-theme'), null, 'the button did not switch back to dark');
  assert.equal(window.localStorage.getItem('ae-theme'), 'dark');
  dom.window.close();
});

test('the tool dialog is a real bottom sheet on phones', () => {
  const css = read('pixora/index.html');
  assert.match(css, /max-height:94dvh/, 'the tool sheet has no viewport cap');
  assert.match(css, /@media\(max-width:760px\)\{[\s\S]*?\.tool-modal/, 'the phone sheet rules are missing');
  assert.match(css, /safe-area-inset-bottom/, 'the sheet ignores the phone home indicator');
});
