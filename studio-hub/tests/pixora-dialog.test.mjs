// Real-DOM checks for the Pixora audit fixes (#03 deep links, #07/#08 focus,
// #10/#11 labels). jsdom has no canvas, so anything it cannot run is stubbed;
// failures that come from the harness are filtered out explicitly.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const HARNESS = /Not implemented|Could not parse CSS|textBaseline|getContext|scrollIntoView is not a function|canvas/i;

let server, port;
before(async () => {
  server = createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(root, p);
    if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});
after(() => server && server.close());

async function open(hash = '') {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!HARNESS.test(e.message)) errors.push(e.message.slice(0, 160)); });
  const dom = await JSDOM.fromURL(`http://127.0.0.1:${port}/pixora/${hash}`, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
  });
  await new Promise((r) => setTimeout(r, 3500));
  return { w: dom.window, errors };
}

test('#03 a cold deep link opens the tool without clicking "See all"', async () => {
  const { w, errors } = await open('#tool-merge-pdf');
  assert.equal(w.document.getElementById('toolModal').hidden, false, 'the dialog should be open');
  assert.match(w.document.getElementById('modalTitle').textContent, /Merge PDF/i);
  assert.equal(w.document.body.style.overflow, 'hidden', 'the page behind must not scroll');
  assert.deepEqual(errors, []);
});

test('#07/#08 the dialog traps Tab, closes on Escape and gives focus back', async () => {
  const { w, errors } = await open();
  const card = [...w.document.querySelectorAll('.tool-card')].find((c) => c.dataset.tool !== 'editor');
  card.focus();
  card.click();
  const modal = w.document.getElementById('toolModal');
  assert.equal(modal.hidden, false);
  assert.ok(modal.contains(w.document.activeElement), 'focus must move into the dialog');
  assert.equal(modal.getAttribute('role'), 'dialog');
  assert.equal(modal.getAttribute('aria-modal'), 'true');

  // Tab off the last control wraps to the first
  const f = [...modal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')]
    .filter((el) => !el.closest('[hidden]'));
  const last = f[f.length - 1];
  last.focus();
  const ev = new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  last.dispatchEvent(ev);
  assert.equal(w.document.activeElement, f[0], 'Tab must not escape the dialog');
  assert.equal(ev.defaultPrevented, true);

  // Escape closes and focus returns to the opener
  modal.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(modal.hidden, true, 'Escape must close the dialog');
  assert.equal(w.document.activeElement.dataset.tool, card.dataset.tool, 'focus must return to the card');
  assert.deepEqual(errors, []);
});

test('#03 clicking "See all" repeatedly does not stack hashchange listeners', async () => {
  const { w } = await open();
  const calls = w.eval(`(() => {
    const t = document.getElementById('toggleAll');
    for (let i = 0; i < 3; i++) t.click();
    let n = 0; const orig = window.openTool; window.openTool = function () { n++; };
    location.hash = '#tool-compress-image';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    window.openTool = orig; return n;
  })()`);
  assert.equal(calls, 1, 'one navigation must open the tool exactly once');
});

test('#10/#11 the editor inputs are labelled and the page has one <h1>', async () => {
  const { w } = await open();
  assert.ok(w.document.querySelector('label[for="edPreset"]'), '#edPreset needs an accessible name');
  assert.equal(w.document.querySelectorAll('h1').length, 1, 'exactly one <h1> per page');
});
