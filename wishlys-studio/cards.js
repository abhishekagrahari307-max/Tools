import { templateOf, tracks } from './model.js';
import { toggleSound, stopSound } from './sound.js';
export const h = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const paths = {
  letter: 'M3 5h18v14H3z M3 6l9 7 9-7',
  pen: 'm4 16 12-12 4 4-12 12-5 1z M14 6l4 4',
  photo: 'M3 3h18v18H3z M3 17l6-7 4 4 3-3 5 6 M15 7h1',
  sound: 'M4 10h4l5-5v14l-5-5H4z M16 9q3 3 0 6 M18 6q6 6 0 12',
  spark: 'M12 2q1 9 10 10-9 1-10 10-1-9-10-10 9-1 10-10z',
  book: 'M3 4h15v16H3z M7 4v16 M10 9h5 M10 12h4',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
  up: 'M6 18 18 6 M7 6h11v11',
  tag: 'M3 3h9l9 9-9 9-9-9z M8 8h.01',
  play: 'm8 4 12 8-12 8z',
  copy: 'M8 8h12v13H8z M4 16H3V3h13v1',
};
export const icon = (id, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[id]}"/></svg>`;
export const two = (n) => String(n).padStart(2, '0');
export const wordmark = '<span class="wordmark">Wishlys<span aria-hidden="true">✳</span></span>';
export const toolBase = new URL('./', import.meta.url);
export const artURL = (t) => (t.art ? new URL(t.art, toolBase).href : '');
const stem = `<path d="M8 116Q42 72 42 12 M28 82Q6 76 8 56 31 58 28 82 M36 60Q60 58 66 36 42 37 36 60 M41 38Q21 33 21 14 41 18 41 38"/>`;
function decoration(id) {
  if (id === 'pop')
    return '<span class="balloons" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
  if (id === 'midnight')
    return '<span class="star-chart" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i><b>☾</b></span>';
  if (id === 'golden') return '<span class="gilding" aria-hidden="true"><i></i>☼</span>';
  if (id === 'simple')
    return `<svg class="sprig" viewBox="0 0 90 125" aria-hidden="true">${stem}</svg><svg class="sprig mirror" viewBox="0 0 90 125" aria-hidden="true">${stem}</svg>`;
  return '';
}
export function cover(d, { mini = false, picture = artURL(templateOf(d.template)) } = {}) {
  const id = d.template;
  const dense =
    (d.headline || '').length > 16 ||
    (d.message || '').length > 100 ||
    (d.letter || '').length > 420;
  const to = (d.recipient || '').trim();
  const showTo = !!to && !mini && !(d.headline || '').toLowerCase().includes(to.toLowerCase());
  return `<div class="paper theme-${h(id)} ${mini ? 'mini' : ''}${dense && !mini ? ' compact' : ''}" style="--accent:${h(d.accent)};${picture ? `--picture:url('${h(picture)}')` : ''}">${decoration(id)}<div class="paper-inner">${!mini && d.photos.length ? `<img class="portrait" src="${h(d.photos[0])}" alt="">` : '<span class="paper-ornament" aria-hidden="true">✦</span>'}<small>${mini ? 'BIRTHDAY POST' : 'A BIRTHDAY LETTER'}</small><div class="paper-headline">${h(mini ? 'Happy Birthday' : d.headline || 'Happy Birthday')}</div>${mini || showTo ? `<em class="paper-to">${h(mini ? 'to you' : to)}</em>` : ''}${mini ? '' : `<p class="paper-note">${h(d.message)}</p><span class="paper-sign">With love, ${h(d.sender || 'Ananya')}</span>`}</div><span class="paper-imprint">WISHLYS &nbsp; ✴ &nbsp; LETTER PRESS</span></div>`;
}
function dateLine(d) {
  return [
    d.age && 'Turning ' + d.age,
    d.date &&
      new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'long',
        timeZone: 'UTC',
      }).format(new Date(d.date + 'T12:00:00Z')),
  ]
    .filter(Boolean)
    .join(' · ');
}
export function letterBody(d) {
  return `<article class="letter-body" tabindex="-1"><div class="postline"><span>PERSONAL CORRESPONDENCE</span><span>W / 01</span></div><p class="letter-kicker">${h(d.headline || 'Happy Birthday')}${dateLine(d) ? ` · ${h(dateLine(d))}` : ''}</p><h2>Dear ${h(d.recipient)},</h2><p class="letter-message">${h(d.message)}</p><p class="long-letter">${h(d.letter)}</p><div class="signoff">With love,<em>${h(d.sender)}</em></div>${d.photos.length ? `<section class="memories"><h3>The memory album <small> / ${two(d.photos.length)}</small></h3><div>${d.photos.map((p, i) => `<figure><img src="${h(p)}" alt="Birthday memory ${i + 1}"><figcaption>Memory ${two(i + 1)}</figcaption></figure>`).join('')}</div></section>` : ''}</article>`;
}
export function gift(root, d, { back = '', preview = false } = {}) {
  root.innerHTML = `<div class="reader"><header class="reader-top">${wordmark}<span>${preview ? 'PREVIEW · ONLY YOU' : 'THE BIRTHDAY POST'}</span>${preview ? `<a class="btn light" href="${h(back)}">← Editor</a>` : ''}</header><main class="reader-stage" id="gift-main"></main>${preview ? '' : '<footer><a href="#/new">Make a birthday letter of your own ↗</a></footer>'}</div>`;
  const stage = root.querySelector('.reader-stage');
  let timer;
  function open(gesture) {
    stage.innerHTML = `<section class="opened-gift"><p class="overline">DELIVERED WITH LOVE · FOR ${h(d.recipient)}</p>${cover(d)}<div class="gift-actions"><button class="btn dark" data-read>Read the letter ↓</button>${d.music !== 'none' ? `<button class="btn light" data-music aria-pressed="false">${icon('sound')} Play music</button>` : ''}</div><p class="sound-status" role="status"></p></section>${letterBody(d)}`;
    const read = stage.querySelector('[data-read]');
    if (gesture) read.focus({ preventScroll: true });
    read.onclick = () => {
      const el = stage.querySelector('.letter-body');
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: 'start' });
    };
    const sound = stage.querySelector('[data-music]');
    if (sound)
      sound.onclick = () =>
        toggleSound(d.music, (on) => {
          sound.innerHTML = icon('sound') + ' ' + (on ? 'Stop music' : 'Play music');
          sound.setAttribute('aria-pressed', on);
          stage.querySelector('.sound-status').textContent = on ? tracks[d.music] : '';
        }).catch((e) => {
          stage.querySelector('.sound-status').textContent = e.message;
        });
    if (d.confetti && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const fx = document.createElement('div');
      fx.className = 'confetti';
      fx.setAttribute('aria-hidden', 'true');
      fx.innerHTML = Array.from(
        { length: 28 },
        (_, i) =>
          `<i style="left:${(i * 41) % 100}%;--delay:${((i * 13) % 50) / 100}s;--bit:${[d.accent, '#e3b46a', '#749584', '#bc8c9f'][i % 4]}"></i>`,
      ).join('');
      stage.append(fx);
      timer = setTimeout(() => fx.remove(), 4100);
    }
  }
  if (d.reveal) {
    stage.innerHTML = `<section class="gift-gate"><p class="overline">SPECIAL DELIVERY &nbsp; / &nbsp; BIRTHDAY POST</p><div class="envelope" aria-hidden="true"><span>W</span></div><h1>A letter for <em>${h(d.recipient)}.</em></h1><p>Sealed with love by ${h(d.sender)}.</p><button class="btn dark" data-open>Open your letter ${icon('arrow')}</button></section>`;
    stage.querySelector('[data-open]').onclick = () => open(true);
  } else open(false);
  return () => {
    clearTimeout(timer);
    stopSound();
  };
}
async function inlinePicture(t) {
  if (!t.art) return '';
  const r = await fetch(artURL(t));
  if (!r.ok) throw Error('Could not load the cover artwork. Try downloading again.');
  const blob = await r.blob();
  return new Promise((ok, no) => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result);
    fr.onerror = () => no(fr.error);
    fr.readAsDataURL(blob);
  });
}
export async function downloadKeepsake(d) {
  const [style, picture] = await Promise.all([
    fetch(new URL('stationery.css', toolBase)).then((r) => {
      if (!r.ok) throw Error('Could not load the keepsake style.');
      return r.text();
    }),
    inlinePicture(templateOf(d.template)),
  ]);
  const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>${h(d.recipient)} · Birthday letter</title><style>${style}</style></head><body class="keepsake"><main>${cover(d, { picture })}${letterBody(d)}</main></body></html>`;
  const url = URL.createObjectURL(new Blob([doc], { type: 'text/html;charset=utf-8' }));
  const a = document.createElement('a');
  a.download = 'Wishlys-birthday-letter.html';
  a.href = url;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
