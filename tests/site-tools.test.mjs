// The homepage promises working tools. This guards against dead links and
// half-built tools returning: every local link must resolve, every #fragment must
// exist, every tool tile on the tools page must have a panel and a runner, and the
// browser libraries must ship locally (no CDN at runtime).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');
const home = read('index.html');
const tools = read('file-tools.html');
const script = read('file-tools.js');
const anchors = [...home.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((match) => match[1]);
const local = anchors.filter((href) => href && !/^(https?:|mailto:|tel:|javascript:)/.test(href));

const PANELS = [
  'merge',
  'split',
  'pdftojpg',
  'imgtopdf',
  'compress',
  'word',
  'pdftext',
  'organize',
  'rotate',
  'pagenum',
  'watermark',
  'convert',
  'resize',
  'imgcompress',
  'crop',
  'rotateflip',
  'imgwatermark',
  'whitebg',
  'photosign',
  'passport',
];

test('the homepage has no placeholder links', () => {
  assert.equal(anchors.filter((href) => href === '#' || href === '').length, 0);
  assert.ok(anchors.length > 20, 'expected real links on the homepage');
  assert.ok(local.length > 20, 'expected the homepage to link every tool');
});

test('every local homepage link resolves to a real file or folder', () => {
  local.forEach((href) => {
    const [path] = href.split('#');
    if (!path) return;
    const target = new URL(path.replace(/^\.?\//, ''), root);
    const exists =
      existsSync(target) || existsSync(new URL('index.html', target.href.replace(/\/?$/, '/')));
    assert.ok(exists, 'missing target for ' + href);
  });
});

test('every in-page fragment exists in its target document', () => {
  local.forEach((href) => {
    const [path, hash] = href.split('#');
    if (!hash) return;
    const file = path ? path.replace(/^\.?\//, '') : 'index.html';
    const html = path ? read(file) : home;
    assert.match(html, new RegExp('id="' + hash + '"'), 'missing #' + hash + ' in ' + file);
  });
});

test('the homepage links all twenty tools and both groups', () => {
  PANELS.forEach((id) =>
    assert.ok(
      anchors.includes('./file-tools.html#' + id),
      'homepage should link file-tools.html#' + id,
    ),
  );
  ['#pdf-tools', '#image-tools'].forEach((hash) =>
    assert.ok(anchors.includes('./file-tools.html' + hash), 'group link ' + hash),
  );
});

test('file-tools has a panel, a drop zone and a runner for every tool', () => {
  assert.equal((tools.match(/class="panel"/g) || []).length, PANELS.length);
  PANELS.forEach((id) => {
    assert.match(tools, new RegExp(`<section class="panel" id="${id}"`), 'panel ' + id);
    assert.match(tools, new RegExp(`data-drop="${id}"`), 'drop zone ' + id);
    assert.match(tools, new RegExp(`data-input="${id}"`), 'file input ' + id);
    assert.match(tools, new RegExp(`id="${id}-run"`), 'run button ' + id);
    assert.match(tools, new RegExp(`id="${id}-out"`), 'output area ' + id);
    assert.match(script, new RegExp(`setup\\('${id}'`), 'runner wired for ' + id);
  });
});

test('each rendered tile points at a panel that exists', () => {
  const tiles = [...tools.matchAll(/class="tile" href="#([a-z]+)"/g)].map((match) => match[1]);
  assert.equal(tiles.length, PANELS.length);
  tiles.forEach((id) => assert.ok(PANELS.includes(id), 'tile target ' + id));
});

test('the tools page loads only local scripts and vendored libraries', () => {
  assert.match(tools, /<script type="module" src="\.\/file-tools\.js">/);
  assert.doesNotMatch(tools, /<script[^>]+src="https?:/);
  ['vendor/pdf-lib.min.js', 'vendor/pdfjs/pdf.min.js', 'vendor/pdfjs/pdf.worker.min.js'].forEach(
    (file) => {
      const path = new URL(file, root);
      assert.ok(existsSync(path), file + ' should be vendored');
      assert.ok(statSync(path).size > 100 * 1024, file + ' looks truncated');
    },
  );
  assert.ok(existsSync(new URL('vendor/pdfjs/LICENSE', root)), 'pdf.js license must stay');
  assert.ok(existsSync(new URL('vendor/pdf-lib-LICENSE.md', root)), 'pdf-lib license must stay');
});

test('the homepage no longer depends on an external icon font', () => {
  assert.doesNotMatch(home, /font-awesome|cdnjs\.cloudflare/);
  assert.doesNotMatch(home, /<i class="fa[bs]? /);
});

test('the page never uploads a file anywhere', () => {
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|navigator\.sendBeacon/);
  // only XML namespace identifiers may look like URLs
  assert.doesNotMatch(script, /https?:\/\/(?!schemas\.openxmlformats\.org|purl\.org|www\.w3\.org)/);
});
