import { plate } from './plates.js';
export const $ = (s, root = document) => root.querySelector(s);
export const h = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const icons = {
  plus: 'M12 5v14M5 12h14',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  up: 'M6 18 18 6M7 6h11v11',
  down: 'm6 9 6 6 6-6',
  back: 'm14 5-7 7 7 7',
  close: 'M6 6l12 12M18 6 6 18',
  search: 'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  letter: 'M3 5h18v14H3zM3 6l9 7 9-7',
  feather: 'M3 21l11-11m-9 8c-2-7 6-16 15-15 1 9-8 17-15 15z',
  play: 'm8 4 12 8-12 8z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  people:
    'M16 21v-2a5 5 0 0 0-10 0v2M11 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8m7-6c3 1 3 5 0 6m1 3q3 1 3 5',
  heart: 'M12 21 3.7 12.7C-2 6 7 0 12 7c5-7 14-1 8.3 5.7z',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0zm-5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0m-9-5v6l4 2',
  lock: 'M5 10h14v11H5zm3 0V7a4 4 0 0 1 8 0v3',
  sound: 'M3 9h4l5-5v16l-5-5H3zm13-2q5 5 0 10m3-13q8 8 0 16',
  sparkle: 'M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10z',
  copy: 'M8 8h12v13H8zM4 15H3V3h12v1',
  check: 'm4 12 5 5L20 6',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  edit: 'm4 16 12-12 4 4L8 20l-5 1zM13 7l4 4',
  calendar: 'M3 5h18v16H3zM3 10h18M7 2v6m10-6v6',
  door: 'M9 3H3v18h6m5-5 5-4-5-4m-7 4h12',
  trash: 'M3 6h18M6 6l1 15h10l1-15M9 6V3h6v3',
  refresh: 'M20 8a8 8 0 1 0 0 8M20 3v6h-6',
  image: 'M3 3h18v18H3zm0 15 6-6 4 4 3-3 5 5m-5-11h.01',
  camera: 'M3 6h12v12H3zm12 5 6-4v10l-6-4',
};
export function ic(name, size = 16) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name] || icons.sparkle}"/></svg>`;
}
export const asset = (name) => new URL(name, import.meta.url).href;
export const state = { catalog: null, user: null, token: '', pages: null };
try {
  state.token = sessionStorage.getItem('celebration.session') || '';
} catch {}
export function identity(token = '', user = null) {
  state.token = token;
  state.user = user;
  try {
    if (token) sessionStorage.setItem('celebration.session', token);
    else sessionStorage.removeItem('celebration.session');
  } catch {}
}
export async function api(path, { method = 'GET', body, blob = false, auth = true } = {}) {
  const headers = {};
  if (auth && state.token) headers.Authorization = 'Bearer ' + state.token;
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const resp = await fetch('/api/' + path, {
    method,
    body,
    headers,
    credentials: 'omit',
    cache: 'no-store',
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    const e = new Error(data.error || `Request failed (${resp.status}).`);
    e.status = resp.status;
    throw e;
  }
  return blob ? resp.blob() : resp.json();
}
export const eventOf = (id) =>
  state.catalog.occasions.find((e) => e.id === id) || state.catalog.occasions[0];
export const designOf = (id) => state.catalog.templates.find((t) => t.code === id);
export const designsFor = (id) => state.catalog.templates.filter((t) => t.occasion === id);
export const choose = (lang, en, hi) => (lang === 'hi' ? hi : en);
export const local = (pair, lang) => choose(lang, pair[0], pair[1]);
export const art = (t, palette = t?.palette) => {
  const e = state.catalog.occasions.find((e) => e.id === t?.art);
  if (e) {
    if (t.print) {
      const p = state.catalog.palettes[palette];
      return plate(
        e.id,
        t.edition,
        [p[1], p[2], p[3] || e.colors[2], p[4] || e.colors[3]],
        t.print,
      );
    }
    return plate(e.id, t.edition || 'signature', e.colors);
  }
  return asset(
    'assets/' +
      (t?.art === 'classic'
        ? 'classic.svg'
        : (['royal', 'floral', 'festive', 'midnight', 'playful'].includes(t?.art)
            ? t.art
            : 'royal') + '.webp'),
  );
};
export const publicURL = (slug) =>
  state.pages
    ? state.pages.publicURL(slug)
    : new URL('/i/' + encodeURIComponent(slug), state.catalog?.publicOrigin || location.origin)
        .href;
export function initial(t, e) {
  return {
    occasion: e.id,
    template: t.code,
    design: t,
    person: '',
    host: '',
    message: e.message,
    messageAlt: '',
    language: 'hi',
    fields: {},
    gallery: [],
    date: '',
    time: '',
    venue: '',
    map: '',
    schedule: '',
    font: t.font || 'serif',
    palette: t.palette,
    opening: t.occasion ? t.opening : e.opening || t.opening,
    music: t.music || 'chimes',
    rsvp: true,
    countdown: true,
    photo: '',
    video: '',
  };
}
// Some mobile time pickers return HH:mm:00 (or .000) even for a minute-only control.
export const minuteTime = (v) =>
  typeof v === 'string' ? v.replace(/^(\d\d:\d\d):00(?:\.0+)?$/, '$1') : v;
export function dateText(d, lang = 'en') {
  if (!d) return '';
  return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    dateStyle: 'long',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(d + 'T12:00:00+05:30'));
}
export function mapLink(d) {
  if (d.map) {
    try {
      const u = new URL(d.map);
      if (
        u.protocol === 'https:' &&
        !u.username &&
        !u.password &&
        !u.port &&
        (['maps.app.goo.gl', 'maps.google.com', 'maps.google.co.in'].includes(u.hostname) ||
          (['google.com', 'www.google.com', 'www.google.co.in'].includes(u.hostname) &&
            u.pathname.startsWith('/maps')))
      )
        return u.href;
    } catch {}
  }
  return d.venue
    ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(d.venue)
    : '';
}
export function message(e) {
  return e?.message || 'Something went wrong. Please try again.';
}
let toastTimer;
export function toast(s) {
  const el = $('#toast');
  el.textContent = s;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 3800);
}
export async function copy(text, field) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Link copied · चैट में पेस्ट करें');
    return true;
  } catch {}
  const f = field || document.createElement('textarea');
  if (!field) {
    f.value = text;
    ($('#modal').open ? $('#modal') : document.body).append(f);
  }
  f.focus();
  f.select();
  f.setSelectionRange?.(0, f.value.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {}
  if (!field) f.remove();
  if (!ok && !field) window.prompt('Copy the full invitation link:', text);
  else toast(ok ? 'Link copied.' : 'Select and copy the full link.');
  return ok;
}
export function modal(title, content) {
  const el = $('#modal');
  el.innerHTML = `<div class="modal-body"><button class="circle x" data-close aria-label="Close">${ic('close')}</button><span class="eyeline">CELEBRATION STUDIO</span><h2 id="modal-title">${h(title)}</h2>${content}</div>`;
  if (!el.hasAttribute('open')) {
    // Embedded/older mobile browsers can render the studio but lack native dialogs.
    try {
      el.showModal();
    } catch {
      const trigger = document.activeElement;
      el.classList.add('fallback-dialog');
      el.setAttribute('open', '');
      if (!('open' in el))
        Object.defineProperty(el, 'open', { get: () => el.hasAttribute('open') });
      el.close = () => {
        el.removeAttribute('open');
        el.classList.remove('fallback-dialog');
        el.onkeydown = null;
        delete el.close;
        trigger?.focus();
      };
      el.onkeydown = (e) => {
        if (e.key === 'Escape') el.close();
      };
      el.querySelector('[data-close]').focus();
    }
  }
  el.querySelector('[data-close]').onclick = () => el.close();
  return el;
}
export const qrURL = (slug) =>
  state.pages ? state.pages.qrURL(slug) : '/api/public/' + encodeURIComponent(slug) + '/qr.png';
export function showLink(record, lang = 'en') {
  if (state.pages) return state.pages.showLink(record, lang);
  const t = (en, hi) => choose(lang, en, hi),
    url = publicURL(record.slug),
    qr = qrURL(record.slug),
    m = modal(
      t('Your invitation is live.', 'आपका निमंत्रण प्रकाशित है।'),
      `<p>${t('Send this link or share the QR. Guests can open all six pages and reply without an account.', 'यह लिंक या QR भेजें। मेहमान बिना खाते के छहों पन्ने खोलकर जवाब दे सकते हैं।')}</p><label class="field">${t('Personal invitation link', 'आपका निमंत्रण लिंक')}<input id="share-url" readonly value="${h(url)}"></label><div class="actions"><button class="btn primary" id="copy-url">${ic('copy')} ${t('Copy link', 'लिंक कॉपी करें')}</button><a class="btn plain" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=${encodeURIComponent(t('You’re invited! ', 'आप सादर आमंत्रित हैं! ') + url)}">WhatsApp ${ic('up', 13)}</a></div><div class="share-qr"><img width="112" height="112" src="${h(qr)}" alt="${t('Scan to open the guest invitation', 'निमंत्रण खोलने के लिए स्कैन करें')}"><div><b>${t('Scan to open', 'स्कैन करके खोलें')}</b><p>${t('For a printed card or a second phone.', 'छपे कार्ड या दूसरे फ़ोन के लिए।')}</p><a class="text-link" href="${h(qr)}" download="${h(record.slug)}-qr.png">${ic('download', 13)} ${t('Download QR (PNG)', 'QR डाउनलोड करें (PNG)')}</a></div></div><a class="text-link" href="${h(url)}" target="_blank" rel="noopener noreferrer">${t('Open guest view', 'मेहमान का निमंत्रण खोलें')} ${ic('up', 13)}</a><p class="fine">${t('Anyone with the link can see the invitation, not the guest list. Preview links require access to this running server.', 'लिंक वाला कोई भी व्यक्ति निमंत्रण देख सकता है, मेहमानों की सूची नहीं। यह लिंक प्रीव्यू सर्वर चलने तक उपलब्ध है।')}</p>`,
    );
  $('#copy-url', m).onclick = () => copy(url, $('#share-url', m));
}
export function options(list, value) {
  return Object.entries(list)
    .map(
      ([key, label]) =>
        `<option value="${h(key)}" ${key === value ? 'selected' : ''}>${h(Array.isArray(label) ? label[0] : label)}</option>`,
    )
    .join('');
}
export function errorBox(text) {
  return `<p class="error" role="alert">${h(text)}</p>`;
}
