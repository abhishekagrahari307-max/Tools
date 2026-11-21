/* ============================================================================
   online-core.js — shared "Online" layer for Studio Hub
   ----------------------------------------------------------------------------
   Everything in this file exists so the live-data tools can be honest:

   1. I18N      — one dictionary, English + Hinglish, persisted, applied to
                  [data-i18n] nodes. The offline studios never load this file.
   2. NET       — a fetch wrapper that (a) always times out, (b) always tells the
                  caller which host was contacted, (c) normalises the error so a
                  dead endpoint says something useful instead of "Failed to fetch".
   3. CACHE     — small localStorage cache with a TTL, so a repeated query does
                  not hit a third party twice.

   No secrets, no keys, no analytics. The only thing this file ever sends is the
   user's own query string to the host named in the call.
   ========================================================================== */
'use strict';

/* ---------------------------------------------------------------- languages */
const OB_LANGS = ['en', 'hi'];
const OB_I18N = {
  en: {
    'nav.offline': 'Studios (100% offline)',
    'nav.online': 'Online tools',
    'online.badge': 'Online',
    'online.warn': 'This tool sends your query to a third-party service. The offline studios above never do.',
    'online.host': 'Contacts',
    'online.free': 'No account or API key needed',
    'online.free.short': 'Key-free',
    'online.keyed': 'Needs your own key',
    'online.none': 'No key-free API fits this feature yet',
    'online.off': 'You appear to be offline — connect and retry.',
    'online.retry': 'Retry',
    'online.loading': 'Fetching…',
    'online.empty': 'That query returned nothing.',
    'online.failed': 'Request failed',
    'online.cached': 'cached result',
    'online.seconds': 's',
    'common.copy': 'Copy',
    'common.copied': 'Copied',
    'common.download': 'Download',
    'common.search': 'Search',
    'common.all': 'All',
    'common.result': 'result',
    'common.results': 'results',
    'common.language': 'Language',
    'common.back': 'Back to studio hub',
  },
  hi: {
    'nav.offline': 'Studios (100% offline)',
    'nav.online': 'Online tools',
    'online.badge': 'Online',
    'online.warn': 'Yeh tool aapki query kisi third-party service ko bhejta hai. Upar wale offline studios kabhi nahi bhejte.',
    'online.host': 'Contact hota hai',
    'online.free': 'Koi account ya API key nahi chahiye',
    'online.free.short': 'Key-free',
    'online.keyed': 'Apni key chahiye',
    'online.none': 'Is feature ke liye abhi koi key-free API nahi hai',
    'online.off': 'Aap offline lag rahe hain — internet jodkar retry karein.',
    'online.retry': 'Retry',
    'online.loading': 'Fetch ho raha hai…',
    'online.empty': 'Is query se kuch nahi mila.',
    'online.failed': 'Request fail hui',
    'online.cached': 'cached result',
    'online.seconds': 's',
    'common.copy': 'Copy',
    'common.copied': 'Copy ho gaya',
    'common.download': 'Download',
    'common.search': 'Search',
    'common.all': 'Sab',
    'common.result': 'result',
    'common.results': 'results',
    'common.language': 'Bhasha',
    'common.back': 'Studio hub par wapas',
  },
};

const OBLang = {
  key: 'sh.lang',
  get() {
    try {
      const v = localStorage.getItem(this.key);
      if (OB_LANGS.includes(v)) return v;
    } catch (e) { /* private mode */ }
    /* follow the browser, default to English */
    try {
      if (/^hi\b/i.test(navigator.language || '')) return 'hi';
    } catch (e) {}
    return 'en';
  },
  set(lang) {
    if (!OB_LANGS.includes(lang)) return;
    try { localStorage.setItem(this.key, lang); } catch (e) {}
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
    this.apply();
    try { window.dispatchEvent(new CustomEvent('ob:lang', { detail: lang })); } catch (e) {}
  },
  t(key, fallback) {
    const lang = this.get();
    const dict = OB_I18N[lang] || OB_I18N.en;
    return dict[key] != null ? dict[key] : (OB_I18N.en[key] != null ? OB_I18N.en[key] : (fallback != null ? fallback : key));
  },
  /* fill every [data-i18n] node; also swap placeholders/titles when asked */
  apply(root) {
    const scope = root || document;
    const lang = this.get();
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
    scope.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = this.t(key, el.textContent);
      if (/^(INPUT|TEXTAREA)$/.test(el.tagName) ) el.placeholder = val;
      else el.textContent = val;
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = this.t(el.getAttribute('data-i18n-title'), '');
    });
    scope.querySelectorAll('[data-lang-btn]').forEach(b => {
      const on = b.getAttribute('data-lang-btn') === lang;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  },
};

/* --------------------------------------------------------------------- net */
/* a host allow-list is deliberately NOT used: each tool declares the single
   host it talks to, and the UI prints it, so the user can see it up front. */
const OBNet = {
  timeoutMs: 12000,
  lastHost: '',

  /* hostOf('https://a.b/c') -> 'a.b'  (never throws) */
  hostOf(url) {
    try { return new URL(url, location.href).host; } catch (e) { return ''; }
  },

  /* request(url, {as:'json'|'text'|'blob', timeout, signal})
     Resolves to {data, host, ms, ok}. Rejects with an Error whose .message is
     already human-readable and whose .host / .status are set. */
  async request(url, opts = {}) {
    const as = opts.as || 'json';
    const ms = opts.timeout || this.timeoutMs;
    const host = this.hostOf(url);
    this.lastHost = host;
    if (!navigator.onLine) {
      const e = new Error(OBLang.t('online.off'));
      e.host = host; e.offline = true;
      throw e;
    }
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => { try { ctrl && ctrl.abort(); } catch (e) {} }, ms);
    if (opts.signal && ctrl) {
      try { opts.signal.addEventListener('abort', () => ctrl.abort(), { once: true }); } catch (e) {}
    }
    const t0 = Date.now();
    try {
      const res = await fetch(url, {
        signal: ctrl ? ctrl.signal : undefined,
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { Accept: as === 'json' ? 'application/json' : '*/*' },
      });
      if (!res.ok) {
        const err = new Error(`${OBLang.t('online.failed')} — ${host} responded ${res.status}`);
        err.host = host; err.status = res.status;
        throw err;
      }
      let data;
      if (as === 'blob') data = await res.blob();
      else if (as === 'text') data = await res.text();
      else {
        const text = await res.text();
        try { data = JSON.parse(text); }
        catch (e) {
          const err = new Error(`${host} did not return JSON (a proxy or login page may be blocking it).`);
          err.host = host; err.nonJson = true;
          throw err;
        }
      }
      return { data, host, ms: Date.now() - t0, ok: true };
    } catch (e) {
      if (e && (e.host || e.offline || e.nonJson)) throw e;
      const aborted = e && (e.name === 'AbortError' || /abort/i.test(String(e.message)));
      const err = new Error(aborted
        ? `${host} did not answer within ${Math.round(ms / 1000)}${OBLang.t('online.seconds')} — try again.`
        : `${OBLang.t('online.failed')} — ${host} could not be reached (CORS is blocking it, or the service is down).`);
      err.host = host; err.timeout = aborted; err.cause = e;
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },

  /* -------------------------------------------------------------- cache */
  cachePrefix: 'sh.online.',
  cacheGet(key) {
    try {
      const raw = localStorage.getItem(this.cachePrefix + key);
      if (!raw) return null;
      const item = JSON.parse(raw);
      if (!item || !item.at) return null;
      if (Date.now() - item.at > (item.ttl || 60000)) { localStorage.removeItem(this.cachePrefix + key); return null; }
      return item.value;
    } catch (e) { return null; }
  },
  cacheSet(key, value, ttlMs) {
    try {
      localStorage.setItem(this.cachePrefix + key, JSON.stringify({ at: Date.now(), ttl: ttlMs || 60000, value }));
    } catch (e) { /* quota / private mode: caching is optional */ }
  },
  async cached(key, ttlMs, fn) {
    const hit = this.cacheGet(key);
    if (hit != null) return { value: hit, cached: true };
    const value = await fn();
    this.cacheSet(key, value, ttlMs);
    return { value, cached: false };
  },
};

/* small helpers the tools share */
const OBDom = {
  el(tag, attrs, text) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    if (text != null) n.textContent = text;
    return n;
  },
  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  toast(msg, bad) {
    let t = document.getElementById('ob-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'ob-toast';
      t.className = 'ob-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.toggle('bad', !!bad);
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 3200);
  },
  async copy(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand && document.execCommand('copy');
      ta.remove(); return !!ok;
    } catch (e) { return false; }
  },
  download(name, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  },
};

/* wire the language buttons once */
document.addEventListener('DOMContentLoaded', () => {
  OBLang.apply();
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-lang-btn]');
    if (b) { OBLang.set(b.getAttribute('data-lang-btn')); }
  });
});

/* expose for the tools page and for tests */
if (typeof window !== 'undefined') {
  window.OBLang = OBLang;
  window.OBNet = OBNet;
  window.OBDom = OBDom;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OBLang, OBNet, OBDom, OB_I18N };
}
