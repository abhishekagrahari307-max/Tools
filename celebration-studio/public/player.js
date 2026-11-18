import {
  $,
  h,
  ic,
  eventOf,
  art,
  choose,
  local,
  api,
  asset,
  state,
  toast,
  message,
  qrURL,
  showLink,
} from './shared.js';
import { chapter, wireChapter, vars, editionOf, honoree } from './chapters.js';

const bits = {
  envelope:
    '<path fill="#e7cbaa" d="M12 38h116v73H12z"/><path fill="#fff0d8" d="m12 111 58-48 58 48z"/><path class="lift" fill="#edcfaa" d="m12 38 58 47 58-47z"/><circle cx="70" cy="75" r="9" fill="#9a4357"/>',
  gift: '<path fill="#dbac86" d="M27 53h86v63H27z"/><path fill="#9f4054" d="M63 51h14v65H63z"/><g class="lift"><path fill="#f5d4ab" d="M20 44h100v16H20z"/><path d="M70 45C22 46 38 2 58 21c9 8 12 24 12 24zm0 0c46-1 37-41 17-26-10 8-17 26-17 26z" fill="#b75a64"/></g>',
  balloon:
    '<g class="burst"><ellipse cx="70" cy="53" rx="32" ry="40" fill="#e2a4a9"/><path d="m70 93-5 6h11z" fill="#a15c75"/><path d="M76 22q9 4 13 13" stroke="#ffe2de" stroke-width="5"/></g><path d="M70 99q17 9 1 21" fill="none"/>',
  ring: '<g class="lift"><rect x="30" y="27" width="80" height="57" rx="12" fill="#a65c72"/><rect x="37" y="34" width="66" height="44" rx="9" fill="#77384e"/></g><circle cx="70" cy="77" r="18" fill="none" stroke="#d1a855" stroke-width="5"/><path d="m61 57 5-8h9l6 8-11 11z" fill="#fff3c8"/><path d="m24 87 12 26h69l12-26z" fill="#b67a83"/>',
  scratch:
    '<rect x="15" y="31" width="110" height="69" rx="7" fill="#f2ddb0"/><path d="m69 42 7 15 17 3-12 12 2 17-14-9-16 9 4-18-13-11 18-3z" fill="#af7754"/>',
  hearts:
    '<g class="float"><path d="M70 101 29 60C4 27 48 4 70 37 93 2 135 28 112 58z" fill="#d88c9d"/><path d="m103 50-17-17c-10-13 7-22 17-10 9-12 26-3 16 10z" fill="#f5c7bf"/></g>',
  diya: '<g class="flame"><path d="M70 73C41 57 69 35 74 10c23 34 25 53-4 63z" fill="#f5ba54"/><path d="M71 72q-12-11 4-34 12 26-4 34" fill="#ffefbb"/></g><path d="M16 73q53 17 108 0-13 42-54 44-40-3-54-44z" fill="#a95942"/><path d="M24 76q45 22 92 1" fill="none" stroke="#ffd99b" stroke-width="4"/>',
  confetti:
    '<path d="m22 116 22-56 35 34z" fill="#d69778"/><path d="m31 94 23 9m-16-25 29 15" stroke="#f4d7a0" stroke-width="5"/><g class="burst" fill="#b45e79"><path d="m82 51 4-12 5 12 13 3-12 5-5 11-4-12-11-4z"/><circle cx="106" cy="30" r="5"/><circle cx="66" cy="39" r="4"/><path d="M52 46q-3-24 11-26m32 58q14-16 29-10" fill="none"/></g>',
};
function scene(type) {
  return `<div class="scene-icon ${h(type)}"><svg viewBox="0 0 140 130" fill="none" stroke="#80604b" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">${bits[type] || bits.envelope}</svg>${type === 'scratch' ? '<canvas width="140" height="100" aria-hidden="true"></canvas>' : ''}</div>`;
}
const openText = {
  gift: ['Unwrap the gift', 'उपहार खोलें'],
  envelope: ['Open your envelope', 'लिफ़ाफ़ा खोलें'],
  ring: ['Open the ring box', 'अंगूठी का डिब्बा खोलें'],
  balloon: ['Pop the balloon', 'गुब्बारा फोड़ें'],
  scratch: ['Reveal the card', 'कार्ड खोलें'],
  diya: ['Light the diya', 'दीप जलाएँ'],
  hearts: ['Release the hearts', 'प्यार के रंग खोलें'],
  confetti: ['Start the celebration', 'जश्न शुरू करें'],
};
function synth(style) {
  let ctx, loop;
  function stop() {
    clearTimeout(loop);
    if (ctx) {
      ctx.close().catch(() => {});
      ctx = null;
    }
  }
  function start() {
    stop();
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio || style === 'none') return;
    try {
      ctx = new Audio();
      ctx.resume().catch(() => {});
      function tune() {
        if (!ctx) return;
        let t = ctx.currentTime + 0.04;
        const seq = style === 'festive' ? [0, 4, 7, 12, 9, 7, 4, 2, 0] : [0, 7, 12, 9, 4, 7, 2, 0];
        const step = style === 'festive' ? 0.35 : 0.56;
        for (const n of seq) {
          const osc = ctx.createOscillator(),
            g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = 329.63 * 2 ** (n / 12);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.06, t + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, t + step * 1.8);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + step * 2);
          t += step;
        }
        loop = setTimeout(tune, (step * seq.length + 2) * 1000);
      }
      tune();
    } catch {
      stop();
    }
  }
  return { start, stop };
}
function receipt(slug) {
  const k = 'celebration.reply.' + slug;
  let v;
  try {
    v = localStorage.getItem(k);
  } catch {}
  if (!/^[0-9a-f]{48}$/.test(v || '')) {
    v = Array.from(crypto.getRandomValues(new Uint8Array(24)), (n) =>
      n.toString(16).padStart(2, '0'),
    ).join('');
    try {
      localStorage.setItem(k, v);
    } catch {}
  }
  return v;
}
function rsvp(root, slug, lang, draft, d, inviteID) {
  const t = (en, hi) => choose(lang, en, hi);
  root.innerHTML = `<h3>${t('Will you join us?', 'क्या आप आएँगे?')}</h3><p>${state.pages ? t('Prepare your reply, then send it to the host in WhatsApp or email.', 'अपना जवाब तैयार करें, फिर WhatsApp या ईमेल से मेज़बान को भेजें।') : t('Only the host and administrator can see your reply.', 'आपका जवाब केवल मेज़बान और एडमिन देख सकते हैं।')}</p><form class="rsvp-form"><label class="field">${t('Your name', 'आपका नाम')}<input name="name" required maxlength="80" autocomplete="name" value="${h(draft.name)}"></label><div class="two"><label class="field">${t('Your response', 'आपका जवाब')}<select name="attendance">${[
    ['yes', 'Yes, I’ll be there', 'हाँ, ज़रूर आऊँगा/आऊँगी'],
    ['maybe', 'Maybe', 'शायद'],
    ['no', 'Unable to attend', 'नहीं आ पाऊँगा/पाऊँगी'],
  ]
    .map(
      ([v, en, hi]) =>
        `<option value="${v}" ${draft.attendance === v ? 'selected' : ''}>${t(en, hi)}</option>`,
    )
    .join(
      '',
    )}</select></label><label class="field">${t('Guests, including you', 'आप सहित मेहमानों की संख्या')}<input name="party" type="number" min="1" max="20" value="${h(draft.party)}" required></label></div><label class="field">${t('A note for the host (optional)', 'मेज़बान के लिए संदेश (वैकल्पिक)')}<textarea name="note" rows="2" maxlength="300">${h(draft.note)}</textarea></label><button class="btn primary">${state.pages ? t('Prepare my reply', 'जवाब तैयार करें') : draft.sent ? t('Update my RSVP', 'जवाब बदलें') : t('Send RSVP', 'जवाब भेजें')} ${ic('arrow')}</button><p role="status" class="reply-status"></p></form>`;
  const f = $('form', root),
    btn = $('button', f),
    status = $('.reply-status', f),
    sync = () => {
      for (const k of ['name', 'attendance', 'note', 'party']) draft[k] = f.elements[k].value;
      if (state.pages) status.replaceChildren();
      f.party.disabled = f.attendance.value !== 'yes';
    };
  sync();
  f.oninput = f.onchange = sync;
  function confirmation() {
    const r = draft.sent;
    if (!r) return;
    status.className = 'reply-status success';
    status.textContent =
      r.attendance === 'yes'
        ? t(
            `Thank you! ${r.party} guest${r.party === 1 ? '' : 's'} confirmed. Your host has your reply.`,
            `धन्यवाद! ${r.party} मेहमानों की उपस्थिति दर्ज हुई। आपका जवाब मेज़बान को मिल गया है।`,
          )
        : t('Thank you! Your host has your response.', 'धन्यवाद! आपका जवाब मेज़बान को मिल गया है।');
    btn.textContent = t('Update my RSVP', 'जवाब बदलें');
  }
  confirmation();
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    btn.disabled = true;
    sync();
    try {
      if (state.pages) {
        state.pages.prepareReply(status, d, inviteID, draft, lang);
        return;
      }
      draft.sent = await api(`public/${slug}/rsvp`, {
        method: 'POST',
        auth: false,
        body: {
          name: draft.name,
          attendance: draft.attendance,
          party: Number(draft.party),
          note: draft.note,
          receipt: draft.key,
        },
      });
      confirmation();
    } catch (err) {
      status.textContent = message(err);
      status.className = 'reply-status error';
    } finally {
      btn.disabled = false;
    }
  };
}
async function dataURL(url) {
  if (!url || url.startsWith('data:') || (state.pages && /^https:\/\//.test(url))) return url || '';
  const resp = await fetch(url, { credentials: 'omit' });
  if (!resp.ok) throw Error('Could not prepare the card image.');
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
function book(d, opts) {
  return eventOf(d.occasion)
    .pages.map(
      (_, i) =>
        `<section class="book-sheet" id="leaf-${i + 1}">${chapter(d, i, opts)}${opts.mode === 'offline' ? `<nav class="offline-nav">${i ? `<a href="#leaf-${i}">← ${choose(opts.lang, 'Previous', 'पिछला')}</a>` : ''}<span>${i + 1} / 6</span>${i < 5 ? `<a href="#leaf-${i + 2}">${choose(opts.lang, 'Next', 'अगला')} →</a>` : ''}</nav>` : ''}</section>`,
    )
    .join('');
}
export async function keepsake(d, media = {}, slug = '', lang = d.language || 'hi') {
  const [cover, photo, qr, css, albumEntries, video] = await Promise.all([
    dataURL(art(d.design)),
    dataURL(media.photo),
    slug ? dataURL(qrURL(slug)) : '',
    fetch(asset('card.css')).then((r) => {
      if (!r.ok) throw Error('Could not prepare the card styles.');
      return r.text();
    }),
    Promise.all(
      (d.gallery || [])
        .filter((m) => state.pages || m.kind === 'photo')
        .map(async (m) => [m.id, await dataURL(media.gallery?.[m.id])]),
    ),
    state.pages ? dataURL(media.video) : '',
  ]);
  const card = book(d, {
    media: { photo, video, gallery: Object.fromEntries(albumEntries) },
    slug,
    lang,
    mode: 'offline',
    cover,
    qr,
  });
  const file = new Blob(
    [
      `<!doctype html><html lang="${lang === 'hi' ? 'hi' : 'en'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(honoree(d) || 'Celebration')} · Invitation</title><style>${css}\nbody{margin:24px auto;max-width:740px;padding:0 14px;background:#fbf7f1;color:#40352f;font:16px/1.5 Georgia,serif}img{max-width:100%}*{box-sizing:border-box}.book-sheet{margin-bottom:22px}</style><main>${card}</main></html>`,
    ],
    { type: 'text/html;charset=utf-8' },
  );
  const u = URL.createObjectURL(file),
    a = document.createElement('a');
  a.href = u;
  a.download =
    (honoree(d) || 'Celebration').replace(/[^\p{L}\p{M}\p{N} _-]/gu, '').slice(0, 60) +
    ' invitation.html';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 20000);
}
function preparePrint(d, media, slug, lang) {
  const sheet = $('#print-sheet');
  sheet.innerHTML = book(d, { media, mode: 'print', lang, slug, qr: slug ? qrURL(slug) : '' });
  return sheet;
}
export async function printCard(d, media = {}, slug = '', lang = d.language || 'hi') {
  const sheet = preparePrint(d, media, slug, lang);
  await Promise.all([...sheet.querySelectorAll('img')].map((im) => im.decode().catch(() => {})));
  window.print();
}
function countdown(d, lang) {
  const t = (a, b) => choose(lang, a, b),
    s = Math.ceil((new Date(d.date + 'T' + (d.time || '00:00') + ':00+05:30') - Date.now()) / 1000);
  if (s <= 0) return t('The celebration has begun', 'उत्सव का समय आ गया है');
  return [
    Math.floor(s / 86400) + t('d', ' दिन'),
    (Math.floor(s / 3600) % 24) + t('h', ' घंटे'),
    (Math.floor(s / 60) % 60) + t('m', ' मिनट'),
    (s % 60) + t('s', ' सेकंड'),
  ].join('  ·  ');
}
function scratch(canvas, btn, label) {
  if (!canvas) return;
  const c = canvas.getContext('2d');
  c.fillStyle = '#bb9f75';
  c.fillRect(0, 0, 140, 100);
  c.fillStyle = '#fff7dd';
  c.textAlign = 'center';
  c.font = '15px Georgia';
  c.fillText(label, 70, 54);
  let down = false;
  function erase(ev) {
    if (!down) return;
    const rect = canvas.getBoundingClientRect();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.arc(
      ((ev.clientX - rect.left) * 140) / rect.width,
      ((ev.clientY - rect.top) * 100) / rect.height,
      13,
      0,
      Math.PI * 2,
    );
    c.fill();
    const pixels = c.getImageData(0, 0, 140, 100).data;
    let blank = 0;
    for (let i = 3; i < pixels.length; i += 16) if (pixels[i] < 32) blank++;
    if (blank > 1350) btn.click();
  }
  canvas.onpointerdown = (ev) => {
    down = true;
    canvas.setPointerCapture(ev.pointerId);
    erase(ev);
  };
  canvas.onpointermove = erase;
  canvas.onpointerup = canvas.onpointercancel = () => (down = false);
}
export function play(
  root,
  d,
  { slug = '', inviteID = '', photo = '', video = '', gallery = {}, close = null } = {},
) {
  const e = eventOf(d.occasion),
    music = synth(d.music),
    media = { photo, video, gallery },
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches,
    draft = {
      key: slug ? (state.pages ? state.pages.guestKey(inviteID) : receipt(slug)) : '',
      name: '',
      attendance: 'yes',
      note: '',
      party: '1',
      sent: null,
    };
  let lang = d.language || 'hi',
    index = 0,
    opened = false,
    on = d.music !== 'none',
    timer,
    tick,
    fxTimer;
  const t = (a, b) => choose(lang, a, b);
  root.innerHTML = `<div class="theatre theatre-${editionOf(d)}" data-function="${h(d.occasion)}" style="${vars(d)}"><div class="theatre-tools"><span class="mini-brand"><img alt="" src="${asset('assets/mark.svg')}">Celebration Studio</span><div class="reader-tools"></div></div><div class="guest-stage"></div><div class="theatre-end">✦ &nbsp; Celebration Studio</div></div>`;
  const stage = $('.guest-stage', root),
    theatre = $('.theatre', root);
  function tools() {
    theatre.lang = lang;
    $('.reader-tools', root).innerHTML =
      `<button class="btn mini language" lang="${lang === 'en' ? 'hi' : 'en'}" aria-label="${t('Read in Hindi', 'Read in English')}">${t('हिन्दी', 'English')}</button>${d.music !== 'none' ? `<button class="btn mini sound" aria-pressed="${on}">${ic('sound', 14)} ${on ? t('Sound on', 'ध्वनि चालू') : t('Sound off', 'ध्वनि बंद')}</button>` : ''}${close ? `<button class="btn mini back" aria-label="${t('Close preview', 'प्रीव्यू बंद करें')}">${ic('close', 14)} ${t('Close', 'बंद करें')}</button>` : ''}`;
    $('.language', root).onclick = () => {
      lang = lang === 'hi' ? 'en' : 'hi';
      tools();
      if (opened) draw(false);
      else ticket();
      $('.language', root).focus({ preventScroll: true });
    };
    if (close) $('.back', root).onclick = close;
    const sound = $('.sound', root);
    if (sound)
      sound.onclick = () => {
        on = !on;
        if (on && opened) music.start();
        else music.stop();
        tools();
        $('.sound', root).focus({ preventScroll: true });
      };
  }
  function flip(n) {
    if (n < 0 || n >= e.pages.length || n === index) return;
    index = n;
    draw(true);
  }
  function draw(focus) {
    clearInterval(tick);
    const pages = e.pages;
    stage.innerHTML = `<div class="guest-book"><div class="book-toolbar"><span>${t('THE INVITATION BOOK', 'निमंत्रण पुस्तिका')}</span><label>${t('Contents', 'पृष्ठ सूची')} <select data-contents>${pages.map((p, i) => `<option value="${i}" ${index === i ? 'selected' : ''}>${i + 1}. ${h(local(p.title, lang))}</option>`).join('')}</select></label></div>${chapter(d, index, { media, lang, mode: slug ? 'guest' : 'preview' })}${!index && d.countdown && d.date ? '<div class="countdown"></div>' : ''}<nav class="page-turns" aria-label="${t('Chapter navigation', 'पृष्ठ बदलें')}"><button class="btn plain" data-prev ${index === 0 ? 'disabled' : ''}>${ic('back', 14)} ${t('Previous', 'पिछला')}</button><span aria-live="polite">${t('Page', 'पृष्ठ')} ${index + 1} / ${pages.length}</span><button class="btn primary" data-next ${index === pages.length - 1 ? 'disabled' : ''}>${t('Next', 'अगला')} ${ic('arrow', 14)}</button></nav><div class="guest-actions"><button class="btn plain print">${t('Print / Save PDF', 'प्रिंट / PDF')}</button><button class="btn plain download">${ic('download', 13)} ${t('Download card', 'कार्ड डाउनलोड करें')}</button>${slug ? `<button class="btn plain share">${ic('letter', 13)} ${t('Share / QR', 'शेयर / QR')}</button>` : ''}</div></div>`;
    wireChapter(stage);
    const cd = $('.countdown', stage);
    if (cd) {
      const update = () => (cd.textContent = countdown(d, lang));
      update();
      tick = setInterval(update, 1000);
    }
    const response = $('.response', stage);
    if (response && slug) rsvp(response, slug, lang, draft, d, inviteID);
    $('[data-prev]', stage).onclick = () => flip(index - 1);
    $('[data-next]', stage).onclick = () => flip(index + 1);
    $('[data-contents]', stage).onchange = (ev) => flip(Number(ev.target.value));
    $('.print', stage).onclick = () =>
      printCard(d, media, slug, lang).catch((e) => toast(message(e)));
    $('.download', stage).onclick = () =>
      keepsake(d, media, slug, lang).catch((e) => toast(message(e)));
    if (slug) $('.share', stage).onclick = () => showLink({ slug }, lang);
    if (focus) {
      const title = $('h2', stage);
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
      if (close) root.scrollTop = 0;
      else window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }
  function fx() {
    if (reduced || !['balloon', 'confetti', 'gift', 'scratch'].includes(d.opening)) return;
    const el = document.createElement('div');
    el.className = 'confetti-fx';
    el.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 28; i++) {
      const p = document.createElement('i');
      p.style.cssText = `left:${Math.random() * 100}%;background:${['#d09e51', '#a05868', '#799880', '#deb2a2'][i % 4]};animation-delay:${Math.random() * 0.5}s;--drift:${Math.random() * 90 - 45}px`;
      el.append(p);
    }
    root.append(el);
    fxTimer = setTimeout(() => el.remove(), 3500);
  }
  function ticket() {
    stage.innerHTML = `<div class="ticket"><div class="ticket-art"><img src="${h(art(d.design))}" alt=""><span>${h(d.design.name)}</span></div><div class="ticket-face"><small>${h(t(e.name, e.hi))} · ${t('A PERSONAL INVITATION', 'व्यक्तिगत निमंत्रण')}</small>${scene(d.opening)}<h1>${h(honoree(d) || local(e.pages[0].title, lang))}</h1><p>${h(local(e.pages[0].intro, lang))}</p><button class="btn open-card">${h(local(openText[d.opening] || openText.envelope, lang))} ${ic('arrow')}</button></div></div>`;
    const btn = $('.open-card', stage);
    btn.onclick = () => {
      if (btn.disabled) return;
      btn.disabled = true;
      $('.ticket', stage).classList.add('unseal');
      if (on) music.start();
      clearTimeout(timer);
      timer = setTimeout(
        () => {
          opened = true;
          draw(true);
          fx();
        },
        reduced ? 0 : 470,
      );
    };
    scratch($('canvas', stage), btn, t('Scratch here', 'यहाँ रगड़ें'));
  }
  tools();
  ticket();
  const key = (ev) => {
    if (
      !opened ||
      ev.defaultPrevented ||
      ev.altKey ||
      ev.ctrlKey ||
      ev.metaKey ||
      $('#modal').open ||
      ev.target.closest?.('input,textarea,select,video,button,summary')
    )
      return;
    if (['ArrowLeft', 'ArrowRight'].includes(ev.key)) {
      ev.preventDefault();
      flip(index + (ev.key === 'ArrowRight' ? 1 : -1));
    }
  };
  const stop = () => music.stop(),
    beforePrint = () => {
      if (!$('#print-sheet').childElementCount) preparePrint(d, media, slug, lang);
    },
    afterPrint = () => $('#print-sheet').replaceChildren();
  window.addEventListener('pagehide', stop);
  window.addEventListener('keydown', key);
  window.addEventListener('beforeprint', beforePrint);
  window.addEventListener('afterprint', afterPrint);
  return () => {
    clearTimeout(timer);
    clearTimeout(fxTimer);
    clearInterval(tick);
    window.removeEventListener('pagehide', stop);
    window.removeEventListener('keydown', key);
    window.removeEventListener('beforeprint', beforePrint);
    window.removeEventListener('afterprint', afterPrint);
    music.stop();
    afterPrint();
    root.replaceChildren();
  };
}
export function preview(d, media) {
  const el = $('#cinema');
  el.showModal();
  const cleanup = play(el, d, { ...media, close: () => el.close() });
  el.onclose = () => {
    cleanup();
    el.onclose = null;
  };
}
