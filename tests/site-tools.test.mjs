// The homepage promises working tools. This guards against dead links returning:
// every local link must resolve, every #fragment must exist, and the tool page
// must ship its browser libraries locally (no CDN at runtime).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');
const home = read('index.html');
const tools = read('file-tools.html');
const anchors = [...home.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((match) => match[1]);
const local = anchors.filter((href) => href && !/^(https?:|mailto:|tel:|javascript:)/.test(href));

test('the homepage has no placeholder links', () => {
  assert.deepEqual(
    anchors.filter((href) => href === '#' || href === ''),
    [],
  );
  assert.ok(local.length > 8, 'expected the homepage to link its tools');
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

test('the homepage advertises the tools that actually exist', () => {
  ['img-compress.html', 'pho-en.html', 'file-tools.html'].forEach((file) =>
    assert.ok(existsSync(new URL(file, root)), file + ' should exist'),
  );
  ['#convert', '#resize', '#merge', '#compress', '#word'].forEach((hash) =>
    assert.ok(anchors.includes('./file-tools.html' + hash), 'homepage should link ' + hash),
  );
});

test('file-tools ships five working panels and its libraries locally', () => {
  ['convert', 'resize', 'merge', 'compress', 'word'].forEach((id) =>
    assert.match(tools, new RegExp('id="' + id + '"')),
  );
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
