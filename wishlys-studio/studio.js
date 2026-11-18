import {
  templates,
  templateOf,
  freshWish,
  checkWish,
  limits,
  tracks,
  newID,
  readWish,
} from './model.js';
import { h, icon, cover, gift, downloadKeepsake, two } from './cards.js';
import { importPhoto, prepareShare } from './media.js';
import { getDraft, listDrafts, writeDraft, removeDraft } from './store.js';
import { toggleSound, stopSound } from './sound.js';

const desk = document.querySelector('#desk'),
  shade = document.querySelector('#shade'),
  dialogTitle = document.querySelector('#dialog-title'),
  dialogBody = document.querySelector('#dialog-body');
let disposeGift = () => {};
let draftID = '',
  version = 0,
  wish = freshWish(),
  savedAt = '',
  editing = Date.now(),
  busy = false,
  dirty = false,
  queue = Promise.resolve(),
  toastTimer;
const toast = (() => {
  const n = document.createElement('div');
  n.id = 'toast';
  n.className = 'toast';
  n.setAttribute('role', 'status');
  document.body.append(n);
  return n;
})();
export function say(text, ok = false) {
  toast.textContent = text;
  toast.dataset.ok = ok ? '1' : '0';
  toast.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('on'), 5000);
}
function teardown() {
  stopSound();
  disposeGift();
  disposeGift = () => {};
  clearTimeout(autosave.timer);
}
function dialog(title) {
  dialogBody.innerHTML = '';
  dialogTitle.textContent = title;
  shade.hidden = false;
  dialogTitle.focus();
  return dialogBody;
}
function closeDialog() {
  shade.hidden = true;
  stopSound();
}
shade.querySelector('.close').onclick = closeDialog;
shade.addEventListener('click', (e) => {
  if (e.target === shade) closeDialog();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !shade.hidden) closeDialog();
});
const formEl = () => desk.querySelector('#letter-form');
const coarse = () => matchMedia('(pointer:coarse)').matches;

function sync() {
  const f = formEl();
  if (!f) return;
  for (const key of Object.keys(limits)) {
    const el = f.elements[key];
    if (el) wish[key] = el.value;
  }
  const checked = f.querySelector('input[name=music]:checked'),
    accent = f.querySelector('input[name=accent]:checked');
  if (checked) wish.music = checked.value;
  if (accent) wish.accent = accent.value;
  for (const key of ['confetti', 'reveal']) wish[key] = f.elements[key].checked;
  wish.template = f.dataset.template;
  draftID = f.dataset.id;
  version = Number(f.dataset.version);
}
// Mobile browsers do not reliably blur an input before a tap on another control,
// so the draft model is refreshed from the form before any save or preview.
function flush() {
  const f = formEl();
  if (!f) return false;
  const name = f.elements.recipient;
  if (name && (name === document.activeElement || coarse() || editing < Date.now() - 1100)) {
    sync();
    return true;
  }
  return false;
}
let previewTimer;
function refreshPreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    sync();
    const slot = desk.querySelector('[data-preview]');
    if (!slot) return;
    const saved = { recipient: wish.recipient, sender: wish.sender };
    wish.recipient = wish.recipient.trim() || 'Aarohi';
    wish.sender = wish.sender.trim() || '';
    slot.innerHTML = cover(wish);
    wish.recipient = saved.recipient;
    wish.sender = saved.sender;
    const meter = desk.querySelector('[data-meter]');
    if (meter)
      meter.textContent = (wish.photos.reduce((n, p) => n + p.length, 0) / 1024).toFixed(0);
  }, 260);
}
const trackName = (id) => tracks[id] || '';
function field(name, label, limit, hint = '', value = '') {
  return `<label class="field"><span>${label}<small>${hint || ''}</small></span><textarea name="${name}" maxlength="${limit}" rows="2" placeholder="${h(hint)}">${h(value)}</textarea><em data-count>0 / ${limit}</em></label>`;
}
function tours() {
  return `<section class="shell tours" aria-labelledby="tours-title"><h1 id="tours-title">Letters worth opening twice</h1><p>Six illustrated stations for one very specific person. Every letter opens with a name, a memory album and a melody of its own. No account, no email queue.</p><div class="tour-grid">${templates.map((t) => `<a class="tour" href="#/new/${t.id}"><div class="mini-wrap">${cover({ template: t.id, accent: t.color, photos: [] }, { mini: true })}</div><strong>${h(t.name)}</strong><small>${h(t.category)} · ${h(t.description)}</small></a>`).join('')}</div></section>`;
}

export async function newLetter(template = 'peach') {
  teardown();
  const t = templateOf(template) ? template : 'peach';
  wish = freshWish();
  wish.template = t;
  wish.accent = templateOf(t).color;
  const id = newID();
  try {
    await writeDraft(id, 0, wish);
    draftID = id;
    version = 1;
    renderEditor(id, 1);
    history.replaceState(null, '', '#/edit/' + id);
  } catch (e) {
    draftID = '';
    version = 0;
    renderEditor('', 0);
    say('Drafts cannot save in this browser. Keep this tab open to share or download the letter.');
  }
}
export function renderEditor(id = draftID, v = version) {
  draftID = id;
  version = v;
  editing = Date.now();
  dirty = false;
  teardown();
  document.title = 'Compose a birthday letter — Wishlys';
  const t = templateOf(wish.template) || templates[0],
    c = (n) => wish[n] || '';
  desk.innerHTML = `<div class="shell editor"><aside class="rail"><div class="rail-title"><a href="#/">← The letter desk</a><h2>Compose the birthday post</h2><p>Saved on this device as you go. Share it when it reads right.</p></div><form id="letter-form" data-id="${h(id)}" data-version="${v}" data-template="${h(wish.template)}" novalidate>
  <fieldset><legend><i>01</i> Stationery</legend><div class="template-picker">${templates.map((x) => `<label class="pick${x.id === wish.template ? ' on' : ''}"><input type="radio" name="template" value="${h(x.id)}"${x.id === wish.template ? ' checked' : ''}><span class="pick-art">${cover({ template: x.id, accent: x.color, photos: [] }, { mini: true })}</span><span>${h(x.name)}</span></label>`).join('')}</div></fieldset>
  <fieldset><legend><i>02</i> Who is it for?</legend><div class="pairs"><label class="field"><span>Their name <b>*</b></span><input name="recipient" maxlength="${limits.recipient}" placeholder="Aarohi" value="${h(c('recipient'))}" autocomplete="off" aria-describedby="recipient-note"><em data-count>0 / ${limits.recipient}</em></label><label class="field"><span>Your name <b>*</b></span><input name="sender" maxlength="${limits.sender}" placeholder="Ananya" value="${h(c('sender'))}" autocomplete="off"><em data-count>0 / ${limits.sender}</em></label></div><small id="recipient-note" class="hint">Their name is the only detail printed on the outside of the post.</small></fieldset>
  <fieldset><legend><i>03</i> The date</legend><div class="pairs"><label class="field"><span>Birthday date <small>optional</small></span><input type="date" name="date" value="${h(c('date'))}"></label><label class="field"><span>Turning <small>optional</small></span><input name="age" inputmode="numeric" maxlength="${limits.age}" pattern="[0-9]*" placeholder="28" value="${h(c('age'))}"></label></div><small class="hint">A real calendar date keeps the printed day correct in every timezone.</small></fieldset>
  <fieldset><legend><i>04</i> The words</legend><label class="field"><span>Headline</span><input name="headline" maxlength="${limits.headline}" value="${h(c('headline'))}"><em data-count>0 / ${limits.headline}</em></label>${field('message', 'Opening wish', limits.message, 'One or two lines under the headline', c('message'))}${field('letter', 'The letter', limits.letter, 'A longer note for the inside page', c('letter'))}</fieldset>
  <fieldset><legend><i>05</i> The memory album</legend><div class="lab-actions"><label class="btn light add"><input id="photo" type="file" accept="image/jpeg,image/png,image/webp" multiple>${icon('photo', 15)} Add photographs</label><small>Up to six · JPG, PNG, WebP · 8 MB each</small></div><p id="photo-list" class="chips"></p><p id="photo-note" class="hint" role="status"></p></fieldset>
  <fieldset><legend><i>06</i> Ink &amp; atmosphere</legend><div class="colors" role="radiogroup" aria-label="Ink color">${templates.map((x) => `<label class="dot" style="--c:${x.color}"><input type="radio" name="accent" value="${x.color}" aria-label="${x.name} ink"${wish.accent === x.color ? ' checked' : ''}><span>${h(x.name)}</span></label>`).join('')}</div><div class="switches"><label><input type="checkbox" name="confetti"${wish.confetti ? ' checked' : ''}> Confetti when the letter opens</label><label><input type="checkbox" name="reveal"${wish.reveal ? ' checked' : ''}> Sealed envelope first</label></div></fieldset>
  <fieldset><legend><i>07</i> Music</legend><div class="tracks">${Object.entries(tracks)
    .map(
      ([tid, name]) =>
        `<label><input type="radio" name="music" value="${tid}"${wish.music === tid ? ' checked' : ''}><span>${h(name)}</span></label>`,
    )
    .join(
      '',
    )}</div><button type="button" class="btn light" id="hear">${icon('sound')} Hear the melody</button><small class="hint">Sound starts only when a guest taps play.</small></fieldset>
  <section class="publish" aria-label="Save and send"><div class="publish-head"><div><p class="overline">Ready to post?</p><h3>${h(t.name)}</h3><p>Static guest link · no server or sign-in</p></div><span data-meter>0</span><small>KB of photos</small></div><button type="button" class="btn dark wide" id="preview">Preview &amp; share</button><button type="button" class="btn light wide" id="postcard">Download printable postcard</button><small class="save-line" id="save-line" role="status">${id ? (savedAt ? 'Saved ' + h(savedAt) : 'Draft saving starts in a moment…') : 'Drafts cannot save here — download or share before leaving.'}</small></section>
  </form><div class="send-bar"><span data-sendnote>${id ? 'Saved on this device' : 'Drafts cannot save here'}</span><button type="button" class="btn dark" data-send>Preview &amp; share</button></div><nav class="rail-footer"><a href="#/letters">My letters</a><a href="../celebration-studio/#/dashboard">Dashboard ↗</a></nav></aside>
  <section class="lab"><div class="lab-top"><span>LIVE PROOF</span><span>${h(t.category)}</span></div><div class="proof-frame" data-preview></div><p>${h(t.description)}</p><div class="lab-desk" aria-hidden="true"></div><div class="lab-actions"><a class="btn light" href="#/wish/preview/${h(id)}" data-open-preview>Open the full letter</a></div></section></div>`;
  bindForm();
  refreshPreview();
  drawPhotos();
  autosave();
}
function bindForm() {
  const f = formEl();
  if (!f) return;
  const mark = () => {
    editing = Date.now();
    dirty = true;
    refreshPreview();
    autosave();
  };
  f.addEventListener('input', (e) => {
    if (e.target.type === 'file') return;
    const count = e.target.closest('.field')?.querySelector('[data-count]');
    if (count) count.textContent = `${e.target.value.length} / ${e.target.maxLength}`;
    mark();
  });
  f.addEventListener('change', (e) => {
    if (e.target.type === 'file') return;
    if (e.target.name === 'template') {
      wish.template = e.target.value;
      wish.accent = templateOf(e.target.value).color;
      f.dataset.template = wish.template;
      f.querySelectorAll('input[name=accent]').forEach((r) => {
        const on = r.value === wish.accent;
        r.checked = on;
        r.closest('.dot').classList.toggle('on', on);
      });
    }
    mark();
    if (['template', 'accent', 'music', 'confetti', 'reveal'].includes(e.target.name)) save();
    f.querySelectorAll('.pick').forEach((p) =>
      p.classList.toggle('on', p.querySelector('input').checked),
    );
    if (e.target.name === 'accent')
      f.querySelectorAll('input[name=accent]').forEach((r) =>
        r.closest('.dot').classList.toggle('on', r.checked),
      );
  });
  f.addEventListener('focusout', () => {
    if (formEl()) save();
  });
  desk.querySelector('[data-open-preview]').onclick = async (e) => {
    e.preventDefault();
    sync();
    await save();
    location.hash = '#/wish/preview/' + draftID;
  };
  f.querySelector('#photo').onchange = photos;
  f.querySelector('#photo-list').onclick = async (e) => {
    const b = e.target.closest('[data-drop]');
    if (!b) return;
    sync();
    wish.photos.splice(Number(b.dataset.drop), 1);
    drawPhotos();
    refreshPreview();
    await save();
  };
  f.querySelector('#hear').onclick = () => {
    sync();
    const b = f.querySelector('#hear');
    if (wish.music === 'none') {
      say('Choose a melody first, or keep “No music” for a silent letter.');
      return;
    }
    toggleSound(wish.music, (on) => {
      b.innerHTML = icon('sound') + ' ' + (on ? 'Stop the melody' : 'Hear the melody');
    }).catch((e) => say(e.message));
  };
  const send = () => {
    sync();
    save().then(openShare);
  };
  f.querySelector('#preview').onclick = send;
  desk.querySelector('[data-send]').onclick = send;
  f.querySelector('#postcard').onclick = async () => {
    sync();
    await save();
    try {
      await downloadKeepsake(checkWish(wish));
      say('Printable postcard downloaded.', true);
    } catch (e) {
      say(e.message);
    }
  };
  f.querySelectorAll('[data-count]').forEach((el) => {
    const input = el.closest('.field')?.querySelector('input,textarea');
    if (input) el.textContent = `${input.value.length} / ${input.maxLength}`;
  });
  f.querySelectorAll('.dot input').forEach((r) =>
    r.closest('.dot').classList.toggle('on', r.checked),
  );
}
async function photos() {
  const input = desk.querySelector('#photo'),
    note = desk.querySelector('#photo-note');
  if (!input || !input.files) return;
  const files = [...input.files];
  input.value = '';
  if (!files.length || busy) return;
  busy = true;
  sync();
  const room = Math.max(0, 6 - wish.photos.length);
  let skipped = Math.max(0, files.length - room);
  for (const file of files.slice(0, room)) {
    try {
      const src = await importPhoto(file);
      wish.photos.push(src);
    } catch (e) {
      skipped++;
      note.textContent = e.message;
    }
  }
  busy = false;
  if (!note.textContent.startsWith('Choose a JPG') && skipped)
    note.textContent = `${skipped} photograph(s) were not added.`;
  drawPhotos();
  refreshPreview();
  dirty = true;
  await save();
  const live = desk.querySelector('#photo-note');
  if (live && !skipped) live.textContent = `${wish.photos.length} of 6 photographs added.`;
}
function drawPhotos() {
  const list = desk.querySelector('#photo-list');
  if (!list) return;
  list.innerHTML = wish.photos.length
    ? wish.photos
        .map(
          (p, i) =>
            `<span class="chip"><img src="${h(p)}" alt="Photograph ${i + 1} preview">Photo ${two(i + 1)}<button type="button" data-drop="${i}" aria-label="Remove photo ${i + 1}">×</button></span>`,
        )
        .join('')
    : '<span class="empty">No photographs yet. A letter without photos is complete too.</span>';
  const meter = desk.querySelector('[data-meter]');
  if (meter) meter.textContent = (wish.photos.reduce((n, p) => n + p.length, 0) / 1024).toFixed(0);
}
function autosave() {
  clearTimeout(autosave.timer);
  autosave.timer = setTimeout(save, 300);
}
function save() {
  if (!formEl()) return Promise.resolve();
  sync();
  if (!draftID) return Promise.resolve();
  const id = draftID,
    data = JSON.parse(JSON.stringify(wish));
  // Read the version inside the queue: two quick edits must not both claim the
  // version that the first write already advanced.
  queue = queue.then(async () => {
    const line = formEl()?.querySelector('#save-line');
    try {
      const row = await writeDraft(id, version, data);
      version = row.version;
      if (draftID === id && formEl()) formEl().dataset.version = version;
      savedAt = new Date(row.updated).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      dirty = false;
      if (line && line.isConnected) line.textContent = 'Saved ' + savedAt;
      const note = desk.querySelector('[data-sendnote]');
      if (note) note.textContent = 'Saved ' + savedAt;
    } catch (e) {
      if (line && line.isConnected) line.textContent = 'Not saved · ' + e.message;
    }
  });
  return queue;
}
function unloadWarn(e) {
  if (formEl() && dirty) {
    e.preventDefault();
    e.returnValue = 'This letter has changes that are not saved yet.';
  }
}
window.addEventListener('beforeunload', unloadWarn);

export async function openShare() {
  sync();
  await save();
  flush();
  let d;
  try {
    d = checkWish(wish);
  } catch (e) {
    const el = formEl()?.elements[e.field];
    if (el) {
      el.focus();
      el.scrollIntoView({ block: 'center' });
    }
    return say(e.message);
  }
  const base = new URL('./', location.href).href;
  dialog('Post the birthday letter');
  dialogBody.innerHTML = `<div class="share"><div class="share-left"><div class="mini-stamp">${cover(d, { mini: true })}</div><h3>For ${h(d.recipient)}</h3><p>${d.music === 'none' ? 'No music' : 'Music: ' + h(trackName(d.music))} · ${d.photos.length} photograph(s)</p><p class="hint">The whole letter travels inside the link. Nothing is uploaded, and it keeps working even if you later delete this draft.</p></div><div class="share-right"><div class="btn-row"><button type="button" class="btn dark" id="make-link">Create guest link ${icon('arrow')}</button><button type="button" class="btn light" id="leave">Keep editing</button></div><div id="link-out" aria-live="polite"></div></div></div>`;
  dialogBody.querySelector('#leave').onclick = closeDialog;
  dialogBody.querySelector('#make-link').onclick = async (e) => {
    e.currentTarget.disabled = true;
    try {
      const out = await prepareShare(d, base),
        area = dialogBody.querySelector('#link-out');
      if (out.url) {
        area.innerHTML = `<label class="field"><span>Guest link</span><input id="url" readonly value="${h(out.url)}"></label><div class="btn-row"><button type="button" class="btn dark" id="copy">${icon('copy')} Copy link</button><a class="btn light" id="whats" href="https://wa.me/?text=${encodeURIComponent('A birthday letter for you: ' + out.url)}" target="_blank" rel="noopener noreferrer">Send on WhatsApp</a></div><p class="hint">${h(out.note)} Only a link to the letter is shared — never your draft.</p>`;
        const input = area.querySelector('#url');
        input.onfocus = () => input.select();
        area.querySelector('#copy').onclick = async () => {
          try {
            await navigator.clipboard.writeText(out.url);
            say('Guest link copied.', true);
          } catch {
            input.select();
            say('Select the field and copy the link.');
          }
        };
      } else if (out.alternative) {
        area.innerHTML = `<p class="notice">These ${out.count} photographs are too large together for an 8,000-character guest link. Share a link with the words only, or download the keepsake that keeps every photograph.</p><div class="btn-row"><a class="btn dark" href="${h(out.alternative)}">Open words-only link</a><button type="button" class="btn light" id="keep">Download keepsake</button></div>`;
        area.querySelector('#keep').onclick = () => downloadKeepsake(d);
      } else
        throw Error('This letter is too long to travel as a link. The keepsake keeps it whole.');
    } catch (err) {
      const area = dialogBody.querySelector('#link-out');
      if (area)
        area.innerHTML = `<p class="notice">${h(err.message)}</p><button type="button" class="btn light" id="keep">Download keepsake instead</button>`;
      dialogBody.querySelector('#keep')?.addEventListener('click', () => downloadKeepsake(d));
    } finally {
      const button = dialogBody.querySelector('#make-link');
      if (button) button.disabled = false;
    }
  };
}

export async function renderGuest(token) {
  teardown();
  desk.innerHTML = '';
  let d;
  try {
    d = readWish(token);
  } catch (e) {
    return broken(e.message);
  }
  disposeGift = gift(desk, d, {});
  document.title = `A birthday letter for ${d.recipient} — Wishlys`;
}
async function renderPreview(id) {
  teardown();
  let data;
  if (id === draftID && !formEl()) data = wish;
  else
    try {
      const row = await getDraft(id);
      if (row) data = row.data;
    } catch (e) {
      return broken(e.message);
    }
  if (!data)
    return broken(
      'This preview lives in the browser where it was written. Open the guest link to see it anywhere.',
    );
  try {
    disposeGift = gift(desk, checkWish(data), {
      preview: true,
      back: '#/edit/' + h(id),
    });
  } catch (e) {
    broken(e.message);
  }
}
function broken(
  message = 'This birthday letter is incomplete. Ask the sender to copy the whole link again.',
) {
  teardown();
  desk.innerHTML = `<div class="shell empty-state"><p class="overline">UNDELIVERABLE POST</p><h1>The envelope is missing a page.</h1><p>${h(message)}</p><div class="btn-row"><a class="btn dark" href="#/">Make your own letter</a><a class="btn light" href="../celebration-studio/#/dashboard">Dashboard</a></div></div>`;
}

export async function letters() {
  teardown();
  flush();
  let rows = [];
  try {
    rows = await listDrafts();
  } catch (e) {
    return broken(e.message);
  }
  rows.sort((a, b) => b.updated - a.updated);
  document.title = 'My birthday letters — Wishlys';
  desk.innerHTML = `<div class="shell shelf"><header class="shelf-head"><div><p class="overline">THE POST BOOK</p><h1>My birthday letters</h1><p>Drafts live only on this device. Guest links you already sent keep working after a draft is deleted.</p></div><a class="btn dark" href="#/new">Write a letter</a></header>${
    rows.length
      ? `<div class="shelf-grid">${rows
          .map((r) => {
            const t = templateOf(r.template) || templates[0];
            return `<article class="shelf-card"><div class="shelf-art">${cover({ template: t.id, accent: t.color, photos: [], recipient: r.recipient || 'Someone lovely', headline: 'Happy Birthday', message: '', sender: r.sender }, { mini: true })}</div><div class="shelf-copy"><small>${h(t.name)}</small><h2>${h(r.recipient || 'Untitled letter')}</h2><p>From ${h(r.sender || '—')} · edited ${new Date(r.updated).toLocaleDateString()}</p><div class="btn-row"><a class="btn light" href="#/edit/${h(r.id)}">Edit</a><button type="button" class="btn light" data-delete="${h(r.id)}" data-version="${r.version}">Delete</button></div></div></article>`;
          })
          .join('')}</div>`
      : '<div class="empty-state"><p>No letters yet. The first one takes about three minutes.</p><a class="btn dark" href="#/new">Write the first letter</a></div>'
  }<p class="hint shelf-help">Clearing this browser’s site data removes drafts. Download a keepsake for anything you want to keep forever.</p></div>`;
  desk.querySelector('.shelf').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-delete]');
    if (!b) return;
    if (!confirm('Delete this draft? Guest links you already sent will keep working.')) return;
    try {
      await removeDraft(b.dataset.delete, Number(b.dataset.version));
      say('Draft deleted. Sent links are unaffected.', true);
      letters();
    } catch (err) {
      say(err.message);
    }
  });
}

async function renderLanding() {
  teardown();
  flush();
  let rows = [];
  try {
    rows = await listDrafts();
  } catch {}
  rows.sort((a, b) => b.updated - a.updated);
  desk.innerHTML = `<section class="shell hero"><div class="hero-copy"><p class="overline">WISHLYS &nbsp;/&nbsp; A BIRTHDAY LETTER STUDIO</p><h1>Some birthdays deserve<br><em>more than a message.</em></h1><p class="hero-lede">Six illustrated stations, a note in your own words, a memory album and a melody. Make one in a few quiet minutes, then send a single link that opens like post.</p><div class="btn-row"><a class="btn dark" href="#/new">Start a birthday letter ${icon('arrow')}</a><a class="btn light" href="#/letters">My letters${rows.length ? ' · ' + rows.length : ''}</a></div><div class="hero-proof"><p><strong>No account. No uploads.</strong><br>The letter is assembled in this browser; the guest link carries the whole letter with it.</p></div></div><div class="hero-art">${cover({ template: 'bloom', accent: '#a1737b', photos: [], recipient: 'Aarohi', headline: 'Happy Birthday', message: '', sender: 'Ananya' })}<span class="hero-stamp">EST. 2026 · SIX STATIONS</span></div></section>${tours()}<section class="shell steps"><div><b>01</b><h2>Choose the station</h2><p>Peach, midnight, bloom, balloons, gilt or a green sprig. Each is a finished print, not a blank frame.</p></div><div><b>02</b><h2>Make it theirs</h2><p>Their name, your words, a real date, photographs and an inside-page letter. Age and album are optional.</p></div><div><b>03</b><h2>Post it</h2><p>One guest link opens the sealed envelope. Or download the printable postcard for a proper mantelpiece.</p></div></section>`;
}

async function route() {
  const hash = location.hash || '#/';
  if (!shade.hidden) closeDialog();
  document.body.classList.toggle('reading', hash.startsWith('#/wish/'));
  try {
    if (hash.startsWith('#/wish/preview/')) return renderPreview(hash.slice(15));
    if (hash.startsWith('#/wish/')) return renderGuest(hash.slice(7));
    if (hash.startsWith('#/edit/')) {
      const id = hash.slice(7),
        row = await getDraft(id);
      if (!row)
        return broken(
          'That draft is not on this device. Drafts do not travel between browsers — send yourself the guest link instead.',
        );
      wish = { ...freshWish(), ...row.data };
      return renderEditor(id, row.version);
    }
    if (hash.startsWith('#/letters')) return letters();
    const m = hash.match(/^#\/new(?:\/(peach|midnight|bloom|pop|golden|simple))?/);
    if (m) return newLetter(m[1] || 'peach');
    document.title = 'Wishlys — Birthday Letter Studio';
    return renderLanding();
  } catch (e) {
    broken(e.message);
  }
}
window.addEventListener('hashchange', route);
route();
