/* Pixora bootstrap — loads the vendored libraries in dependency order, then starts the studio. */
(function () {
  'use strict';
  var FILES = ["fabric", "pdf-lib", "regenerator", "pdfjs", "jszip", "fontkit", "tesseract", "local-engines"];

  var done = 0, failed = null;
  function load(file) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'vendor/' + file + '.js';
      s.async = false;
      s.onload = resolve;
      s.onerror = function () { reject(new Error(file)); };
      document.head.appendChild(s);
    });
  }
  function start() {
    var s = document.createElement('script');
    s.src = 'vendor/app.js';
    s.async = false;
    s.onerror = function () {
      var grid = document.getElementById('toolsGrid');
      if (grid) grid.innerHTML = '<div class="empty-state">vendor/app.js is missing — the studio bundle did not ship.</div>';
    };
    document.head.appendChild(s);
  }
  function fail(name) {
    var grid = document.getElementById('toolsGrid');
    if (grid) {
      grid.style.minHeight = '';
      grid.innerHTML = '<div class="empty-state">Could not load <code>vendor/' + name + '.js</code>. ' +
        'Serve this page over http(s) — a file:// preview blocks local scripts — then reload.</div>';
    }
    var el = document.getElementById('bootError');
    if (el) el.hidden = false;
  }
  // Fire them in order (each library is self-contained, order kept for safety).
  FILES.reduce(function (p, f) {
    return p.then(function () { return load(f).then(function(){ done++; }, function(){ failed = f; }); });
  }, Promise.resolve()).then(function () {
    if (failed) return fail(failed);
    start();
  });
})();
