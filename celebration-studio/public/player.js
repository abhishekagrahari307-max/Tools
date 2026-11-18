import {
  $,
  h,
  ic,
  state,
  eventOf,
  art,
  dateText,
  mapLink,
  api,
  toast,
  publicURL,
  message,
} from './shared.js';

const fontMap = {
  serif: 'Fraunces,Hindi,Georgia,serif',
  sans: "'DM Sans',Hindi,sans-serif",
  hand: 'Caveat,Hindi,cursive',
};
function vars(d) {
  const p = state.catalog.palettes[d.palette] || state.catalog.palettes.wine;
  return `--card-ink:${p[1]};--card-paper:${p[2]};--card-font:${fontMap[d.font] || fontMap.serif}`;
}
export function poster(d, photo = '', cover = art(d.design)) {
  const e = eventOf(d.occasion);
  return `<article class="paper-card" style="${vars(d)}"><div class="paper-art"><img src="${h(cover)}" alt="${h(d.design.name)} stationery"><span>CELEBRATION STUDIO · ${h(e.name.toUpperCase())}</span></div><div class="paper-body"><div class="paper-orn" aria-hidden="true">── ✦ ──</div><small>${h(e.hi)} · YOU ARE INVITED</small><h2>${h(d.person || e.greeting)}</h2>${photo ? `<img class="portrait" src="${h(photo)}" alt="Photo chosen by the host">` : ''}<p class="letter-msg">${h(d.message || 'आपकी उपस्थिति इस खुशी को और खास बना देगी।')}</p>${d.host ? `<p class="sign">स्नेह सहित, <b>${h(d.host)}</b></p>` : ''}${d.date || d.venue ? `<div class="paper-meta">${h([dateText(d.date), d.time && d.time + ' IST', d.venue].filter(Boolean).join(' · '))}</div>` : ''}<div aria-hidden="true" class="paper-coda">❦</div></div></article>`;
}
function itinerary(d) {
  return `<section class="itinerary"><small>THE DETAILS</small><h3>When & where</h3>${d.date || d.time ? `<p>${ic('calendar')} ${h([dateText(d.date), d.time && d.time + ' IST'].filter(Boolean).join(' · '))}</p>` : ''}${d.venue ? `<p>${ic('pin')} ${h(d.venue)}</p>` : ''}${mapLink(d) ? `<a class="text-link" rel="noopener noreferrer" target="_blank" href="${h(mapLink(d))}">View on Google Maps ${ic('up', 12)}</a>` : ''}${
    d.schedule
      ? `<h4>Event schedule · कार्यक्रम</h4><ul>${d.schedule
          .split('\n')
          .filter((s) => s.trim())
          .map((s) => `<li>${h(s)}</li>`)
          .join('')}</ul>`
      : ''
  }</section>`;
}
function hasDetails(d) {
  return d.date || d.time || d.venue || d.schedule || d.map;
}
function countdown(d) {
  if (!d.countdown || !d.date) return '';
  const seconds = Math.ceil(
    (new Date(d.date + 'T' + (d.time || '00:00') + ':00+05:30') - Date.now()) / 1000,
  );
  if (seconds <= 0) return 'The celebration has begun · उत्सव का समय आ गया है';
  return `${Math.floor(seconds / 86400)}d  ${Math.floor(seconds / 3600) % 24}h  ${Math.floor(seconds / 60) % 60}m  ${seconds % 60}s  ·  to the celebration`;
}
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
  gift: 'Unwrap the gift',
  envelope: 'Open your envelope',
  ring: 'Open the ring box',
  balloon: 'Pop the balloon',
  scratch: 'Reveal the card',
  diya: 'Light the diya',
  hearts: 'Release the hearts',
  confetti: 'Start the celebration',
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
function rsvp(root, slug) {
  root.innerHTML = `<small>RÉPONDEZ S’IL VOUS PLAÎT</small><h3>Will you join us?</h3><p>अपना जवाब मेज़बान तक पहुँचाएँ। Guest names are private.</p><form class="rsvp-form"><label class="field">Your name · आपका नाम<input name="name" required maxlength="80" autocomplete="name"></label><div class="two"><label class="field">Your response<select name="attendance"><option value="yes">Yes, I’ll be there</option><option value="maybe">Maybe</option><option value="no">Unable to attend</option></select></label><label class="field">Guests, including you<input name="party" type="number" min="1" max="20" value="1" required></label></div><label class="field">A note for the host <small>optional</small><textarea name="note" rows="2" maxlength="300"></textarea></label><button class="btn primary">Send RSVP ${ic('arrow')}</button><p role="status" class="reply-status"></p></form>`;
  const f = $('form', root),
    key = receipt(slug);
  f.attendance.onchange = () => {
    f.party.disabled = f.attendance.value !== 'yes';
  };
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const button = $('button', f),
      status = $('.reply-status', f);
    button.disabled = true;
    try {
      const result = await api(`public/${slug}/rsvp`, {
        method: 'POST',
        auth: false,
        body: {
          name: f.elements.name.value,
          attendance: f.attendance.value,
          party: Number(f.party.value),
          note: f.note.value,
          receipt: key,
        },
      });
      status.textContent =
        result.attendance === 'yes'
          ? `धन्यवाद! ${result.party} guest${result.party === 1 ? '' : 's'} confirmed. Your host has your reply.`
          : 'धन्यवाद! Your host has your response.';
      button.textContent = 'Update my RSVP';
      status.className = 'reply-status success';
    } catch (err) {
      status.textContent = message(err);
      status.className = 'reply-status error';
    } finally {
      button.disabled = false;
    }
  };
}
async function dataURL(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw Error('Could not prepare image.');
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
export async function keepsake(d, photo = '', slug = '') {
  const cover = await dataURL(art(d.design)),
    pic = photo ? await dataURL(photo) : '';
  const card =
    poster(d, pic, cover) +
    (hasDetails(d) ? itinerary(d) : '') +
    (slug ? `<p><a href="${h(publicURL(slug))}">Open online for RSVP & video</a></p>` : '');
  const css = await fetch('/s/card.css').then((r) => r.text());
  const file = new Blob(
    [
      `<!doctype html><html lang="hi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(d.person || 'Celebration')} · Invitation</title><style>${css}\nbody{margin:24px auto;max-width:650px;padding:0 16px;background:#fbf7f1;color:#40352f;font:16px/1.5 Georgia,serif}img{max-width:100%}</style><main>${card}</main></html>`,
    ],
    { type: 'text/html;charset=utf-8' },
  );
  const u = URL.createObjectURL(file),
    a = document.createElement('a');
  a.href = u;
  a.download =
    (d.person || 'Celebration').replace(/[^\p{L}\p{M}\p{N} _-]/gu, '').slice(0, 60) +
    ' invitation.html';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 20000);
}
export function printCard(d, photo) {
  $('#print-sheet').innerHTML = poster(d, photo) + (hasDetails(d) ? itinerary(d) : '');
  window.print();
}
export function play(root, d, { slug = '', photo = '', video = '', close = null } = {}) {
  const e = eventOf(d.occasion),
    music = synth(d.music),
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let on = d.music !== 'none',
    opened = false,
    timer,
    tick,
    fxTimer;
  root.innerHTML = `<div class="theatre" style="${vars(d)}"><div class="theatre-tools"><span class="mini-brand"><img alt="" src="/s/assets/mark.svg">Celebration Studio</span><div>${d.music !== 'none' ? `<button class="btn mini sound">${ic('sound')} Sound on</button>` : ''}${close ? `<button class="btn mini back">${ic('close')} Close preview</button>` : ''}</div></div><div class="guest-stage"><div class="ticket"><div class="ticket-art"><img src="${art(d.design)}" alt="${h(d.design.name)} design"><span>THE CELEBRATION COLLECTION</span></div><div class="ticket-face"><small>${h(e.name.toUpperCase())} · A PERSONAL INVITATION</small>${scene(d.opening)}<h1>${h(d.person || e.greeting)}</h1><p>${h(e.greeting)} · आपके लिए एक खास निमंत्रण</p><button class="btn open-card">${openText[d.opening] || 'Open invitation'} ${ic('arrow')}</button></div></div></div><div class="theatre-end">✦ &nbsp; Made with Celebration Studio</div></div>`;
  const stage = $('.guest-stage', root),
    btn = $('.open-card', root),
    sound = $('.sound', root);
  function reveal() {
    opened = true;
    stage.innerHTML = `<div class="guest-letter">${poster(d, photo)}${d.countdown && d.date ? '<div class="countdown"></div>' : ''}${video ? `<section class="itinerary"><small>A SHORT FILM</small><video controls playsinline preload="metadata" src="${h(video)}"></video></section>` : ''}${hasDetails(d) ? itinerary(d) : ''}${d.rsvp ? (slug ? '<section class="itinerary response"></section>' : '<p class="preview-hint">RSVP मेहमानों के प्रकाशित लिंक पर उपलब्ध होगा। This preview does not submit replies.</p>') : ''}<div class="guest-actions"><button class="btn plain print">Print / Save PDF</button><button class="btn plain download">${ic('download')} Download card</button></div></div>`;
    const title = $('h2', stage);
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
    const cd = $('.countdown', stage);
    if (cd) {
      const update = () => (cd.textContent = countdown(d));
      update();
      tick = setInterval(update, 1000);
    }
    if (slug && d.rsvp) rsvp($('.response', stage), slug);
    $('.print', stage).onclick = () => printCard(d, photo);
    $('.download', stage).onclick = () =>
      keepsake(d, photo, slug).catch(() => toast('Could not prepare the download.'));
    if (!reduced) {
      const fx = document.createElement('div');
      fx.className = 'confetti-fx';
      fx.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 40; i++) {
        const p = document.createElement('i');
        p.style.cssText = `left:${Math.random() * 100}%;background:${['#d09e51', '#a05868', '#799880', '#deb2a2'][i % 4]};animation-delay:${Math.random() * 0.5}s;--drift:${Math.random() * 100 - 50}px`;
        fx.append(p);
      }
      root.append(fx);
      fxTimer = setTimeout(() => fx.remove(), 3600);
    }
  }
  btn.onclick = () => {
    if (btn.disabled) return;
    btn.disabled = true;
    $('.ticket', root).classList.add('unseal');
    if (on) music.start();
    timer = setTimeout(reveal, reduced ? 0 : 470);
  };
  const canvas = $('canvas', root);
  if (canvas) {
    const c = canvas.getContext('2d');
    c.fillStyle = '#bb9f75';
    c.fillRect(0, 0, 140, 100);
    c.fillStyle = '#fff7dd';
    c.textAlign = 'center';
    c.font = '15px Georgia';
    c.fillText('Scratch here', 70, 54);
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
  if (sound)
    sound.onclick = () => {
      on = !on;
      if (opened && on) music.start();
      else music.stop();
      sound.innerHTML = ic('sound') + ' Sound ' + (on ? 'on' : 'off');
      sound.setAttribute('aria-pressed', String(on));
    };
  if (close) $('.back', root).onclick = close;
  const stop = () => music.stop();
  window.addEventListener('pagehide', stop);
  return () => {
    clearTimeout(timer);
    clearTimeout(fxTimer);
    clearInterval(tick);
    window.removeEventListener('pagehide', stop);
    music.stop();
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
