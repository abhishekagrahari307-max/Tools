/* Pixora bootstrap.

   Two groups, deliberately not one:

   CRITICAL  fabric + app.js. app.js touches `fabric` and `PDFLib` while it
             executes (top-level `initEditor`-style wiring and lookups), so
             fabric must be there before it runs. These two are what the home
             screen — the tool grid — actually needs.

   DEFERRED  pdf-lib, regenerator, pdfjs, jszip, fontkit, tesseract,
             local-engines. Every reference to these in app.js is inside a
             function or a click handler; none of them runs at load. They used
             to be fetched serially, eight round trips deep, before the grid was
             allowed to paint — and because the old loader was all-or-nothing,
             one 404 blanked the whole studio.

             They now load in PARALLEL, start immediately after CRITICAL, and a
             failure is remembered instead of being fatal. A tool that needs a
             library nobody managed to load reports it when opened, which is
             where the user actually asked for it.

   Why PDFLib is still awaited before `start()`: it is on the critical path
   already in practice (app.js reads it during load), so it stays in the first
   await batch. It is fetched in parallel with fabric, not after it. */
(function () {
  'use strict';

  var CRITICAL = ["fabric", "pdf-lib"];
  var DEFERRED = ["regenerator", "pdfjs", "jszip", "fontkit", "tesseract", "local-engines"];

  var appStarted = false;
  var libraryState = {};

  function load(file) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'vendor/' + file + '.js';
      s.async = true;
      s.onload = function () { libraryState[file] = 'ok'; resolve(file); };
      s.onerror = function () { libraryState[file] = 'failed'; resolve(file); }; // never reject: one library must not sink the app
      document.head.appendChild(s);
    });
  }

  function start() {
    if (appStarted) return;
    appStarted = true;
    var s = document.createElement('script');
    s.src = 'vendor/app.js';
    s.async = true;
    s.onerror = function () {
      var grid = document.getElementById('toolsGrid');
      if (grid) grid.innerHTML = '<div class="empty-state">vendor/app.js is missing — the studio bundle did not ship.</div>';
    };
    document.head.appendChild(s);
  }

  function fail(name) {
    /* Only a CRITICAL failure is worth taking over the screen: without fabric
       there is no editor at all. */
    var grid = document.getElementById('toolsGrid');
    if (grid) {
      grid.style.minHeight = '';
      grid.innerHTML = '<div class="empty-state">Could not load <code>vendor/' + name + '.js</code>. ' +
        'Serve this page over http(s) — a file:// preview blocks local scripts — then reload.</div>';
    }
    var el = document.getElementById('bootError');
    if (el) el.hidden = false;
  }

  /* Exposed so app.js can tell the user which feature is missing rather than
     throwing "PDFLib is not defined" from inside a tool. */
  window.__pixoraLib = function (name) {
    return libraryState[name] !== 'failed';
  };

  Promise.all(CRITICAL.map(load)).then(function () {
    var criticalFailed = CRITICAL.filter(function (f) { return libraryState[f] === 'failed'; });
    if (criticalFailed.length) { fail(criticalFailed[0]); return; }
    start();
    /* Freed from the critical path — fetch in parallel, ignore failures. */
    DEFERRED.forEach(function (f) { load(f); });
  });
})();
