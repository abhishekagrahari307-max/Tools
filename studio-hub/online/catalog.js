/* ============================================================================
   catalog.js — offline browser for the public-apis catalog
   ----------------------------------------------------------------------------
   The catalog is 2,524 rows, stored once in catalog.json as
   [name, url, description, categoryIndex, flags] with flags = 1 no-auth,
   2 CORS-enabled, 4 HTTPS.

   Loading it never contacts anyone: it is a file in this folder. Filtering is
   client-side and instant. The point is that a visitor can find a service and
   copy its endpoint, without this site promising any of them work.
   ========================================================================== */
'use strict';

(function () {
  const FLAG_NOAUTH = 1, FLAG_CORS = 2, FLAG_HTTPS = 4;

  const state = { q: '', cat: '', flags: 0, page: 0, per: 60, rows: null, cats: [] };

  const $ = s => document.querySelector(s);

  function flagHtml(f) {
    const bits = [];
    if (f & FLAG_NOAUTH) bits.push('<span class="cat-tag ok">no key</span>');
    else bits.push('<span class="cat-tag">key needed</span>');
    if (f & FLAG_CORS) bits.push('<span class="cat-tag ok">CORS</span>');
    if (f & FLAG_HTTPS) bits.push('<span class="cat-tag ok">HTTPS</span>');
    return bits.join('');
  }

  function render() {
    const list = $('#cat-list');
    if (!state.rows) { list.innerHTML = '<p class="ob-status">Loading catalog…</p>'; return; }
    const q = state.q.trim().toLowerCase();
    const out = [];
    for (const r of state.rows) {
      if (state.cat && state.cats[r[3]] !== state.cat) continue;
      if (state.flags && (r[4] & state.flags) !== state.flags) continue;
      if (q && !(r[0].toLowerCase().includes(q) || r[2].toLowerCase().includes(q) || r[1].toLowerCase().includes(q))) continue;
      out.push(r);
    }
    $('#cat-count').textContent = out.length.toLocaleString() + ' of ' + state.rows.length.toLocaleString() + ' APIs';
    const pages = Math.max(1, Math.ceil(out.length / state.per));
    if (state.page >= pages) state.page = pages - 1;
    const slice = out.slice(state.page * state.per, (state.page + 1) * state.per);

    if (!slice.length) {
      list.innerHTML = '<p class="ob-status">Nothing matches those filters.</p>';
    } else {
      list.innerHTML = slice.map(r => `
        <div class="cat-row">
          <div class="cat-main">
            <a href="${String(r[1]).replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer nofollow">${esc(r[0])}</a>
            <p>${esc(r[2])}</p>
          </div>
          <div class="cat-meta">
            <span class="cat-cat">${esc(state.cats[r[3]] || '')}</span>
            ${flagHtml(r[4])}
            <button class="ob-btn small" data-copy="${esc(r[1])}">Copy URL</button>
          </div>
        </div>`).join('');
    }

    $('#cat-pager').innerHTML = pages > 1
      ? `<button class="ob-btn small" data-pg="-1" ${state.page === 0 ? 'disabled' : ''}>‹ Prev</button>
         <span class="ob-status" style="margin:0">page ${state.page + 1} / ${pages}</span>
         <button class="ob-btn small" data-pg="1" ${state.page >= pages - 1 ? 'disabled' : ''}>Next ›</button>`
      : '';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!$('#cat-list')) return;                 /* not the catalog page */
    const chips = $('#cat-cats');
    const qInp = $('#cat-q');

    /* three filter toggles: key-free, browser-callable, HTTPS */
    document.querySelectorAll('[data-flag]').forEach(b => {
      b.addEventListener('click', () => {
        const bit = Number(b.getAttribute('data-flag'));
        state.flags = (state.flags & bit) ? (state.flags & ~bit) : (state.flags | bit);
        b.classList.toggle('on', !!(state.flags & bit));
        state.page = 0;
        render();
      });
    });

    let t = 0;
    qInp.addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = e.target.value; state.page = 0; render(); }, 120);
    });

    document.addEventListener('click', e => {
      const cp = e.target.closest('[data-copy]');
      if (cp) {
        const url = cp.getAttribute('data-copy');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(() => (cp.textContent = 'Copied'), () => (cp.textContent = url.slice(0, 24) + '…'));
        } else { cp.textContent = url.slice(0, 24) + '…'; }
        return;
      }
      const pg = e.target.closest('[data-pg]');
      if (pg) { state.page += Number(pg.getAttribute('data-pg')); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      const cc = e.target.closest('[data-cat]');
      if (cc && cc.parentElement === chips) {
        state.cat = cc.getAttribute('data-cat');
        chips.querySelectorAll('[data-cat]').forEach(c => c.classList.toggle('on', c === cc));
        state.page = 0;
        render();
      }
    });

    if (typeof fetch !== 'function') {
      $('#cat-list').innerHTML = '<p class="ob-status bad">This browser has no fetch() — open the catalog in a current browser.</p>';
      return;
    }
    fetch('catalog.json', { cache: 'force-cache' })
      .then(r => { if (!r.ok) throw new Error('catalog.json returned ' + r.status); return r.json(); })
      .then(d => {
        state.rows = d.rows;
        state.cats = d.cats;
        $('#cat-source').textContent = d.count.toLocaleString() + ' APIs from ' + d.src;
        const all = document.createElement('button');
        all.className = 'ob-chip on'; all.textContent = 'All categories'; all.setAttribute('data-cat', '');
        chips.appendChild(all);
        d.cats.forEach(c => {
          const b = document.createElement('button');
          b.className = 'ob-chip'; b.textContent = c; b.setAttribute('data-cat', c);
          chips.appendChild(b);
        });
        render();
      })
      .catch(err => {
        $('#cat-list').innerHTML = '<p class="ob-status bad">' + esc(err.message) + ' — the catalog file could not be read.</p>';
      });
  });
})();
