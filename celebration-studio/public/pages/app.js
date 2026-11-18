import {
  $,
  h,
  ic,
  asset,
  state,
  modal,
  toast,
  errorBox,
  message,
  eventOf,
  designOf,
} from '../shared.js';
import { home, studio } from '../library.js';
import { Editor } from '../editor.js';
import { play } from '../player.js';
import { publicURL, qrURL, startCard, contacts, unpack, readInvite, readReply } from './links.js';
import * as desk from './store.js';
import {
  contactFields,
  offerCompact,
  mediaControls,
  promptMedia,
  showLink,
  guestKey,
  prepareReply,
  exportContact,
  labels,
} from './sharing.js';

state.pages = {
  publicURL,
  qrURL,
  showLink,
  guestKey,
  prepareReply,
  exportContact,
  workspace: (record) => ({
    ...desk.openDraft(record),
    contactFields,
    mediaControls,
    promptMedia,
    contacts,
    offerCompact,
  }),
};
const root = $('#app'),
  brand = `<img class="brand-flower" src="${asset('assets/mark.svg')}" alt=""><span>Celebration<span class="brand-sub">S T U D I O</span></span>`;
let editor,
  cleanup,
  revision = 0;
$('.skip').onclick = (ev) => {
  ev.preventDefault();
  root.focus();
};
function shell(page) {
  $('#bar').innerHTML =
    `<div class="wrap nav"><a class="brand" href="#/" aria-label="Celebration Studio home">${brand}</a><nav aria-label="Studio"><a href="#/" class="${!['designs', 'dashboard', 'responses'].includes(page) ? 'active' : ''}">${ic('grid', 14)} Studio</a><a href="#/designs" class="${page === 'designs' ? 'active' : ''}">Occasions</a><a href="#/dashboard" class="${['dashboard', 'responses'].includes(page) ? 'active' : ''}">My invitations</a></nav><div class="account"><a class="btn plain compact" href="../">All tools ${ic('up', 12)}</a></div></div>`;
  $('#footer').innerHTML =
    `<div class="wrap footer-inner"><span class="brand tiny">${brand}</span><span>Create moments. Share happiness.</span><a href="../birthday-wishes/">Birthday Wish Studio ${ic('up', 12)}</a></div>`;
}
function guide() {
  modal(
    'An invitation in three steps.',
    `<ol class="guide"><li><b>Choose your occasion</b><p>Pick one of 39 editions. Write your six pages in Hindi or English. No account is needed.</p></li><li><b>Make it personal</b><p>Add a photo, film, schedule and venue. Drafts autosave on this browser only. To receive replies, turn on RSVP on page 06 and enter your WhatsApp number or email.</p></li><li><b>Send the guest link</b><p>Send a link or QR, print the book, or send the HTML Card with your local files. Guests send their RSVP in WhatsApp or email. Open their reply link on this device to add it to your list.</p></li></ol>`,
  );
}
async function dashboard(alive) {
  const list = await desk.listDrafts();
  if (!alive()) return;
  root.innerHTML = `<div class="wrap section-page"><div class="crumb"><a href="#/">Studio</a> / This device</div><div class="page-head"><div><span class="eyeline">THE ORGANIZER’S DESK</span><h1>My invitations.</h1><p>इस ब्राउज़र के ड्राफ़्ट · No account or cloud backup. Clearing site data removes these drafts, not links you’ve sent.</p></div><a class="btn primary" href="#/designs">${ic('plus')} Create invitation</a></div><section class="panel list-panel"><div class="list-head"><h2>Your collection</h2><small>${list.length} on this device</small></div>${list.length ? `<div class="invite-list">${list.map((r) => `<article class="invite-row"><div class="list-mark">${ic(r.slug ? 'letter' : 'feather', 20)}</div><div class="row-info"><small>${h(eventOf(r.data.occasion).name)} · ${h(r.data.design.name)}</small><h3>${h(r.data.person || 'Untitled invitation')}</h3><span class="badge ${r.slug ? 'live' : ''}">${r.slug ? 'Guest link ready' : 'Device draft'}</span></div><div class="row-tools"><a class="btn mini" href="#/edit/${r.id}">${ic('edit', 13)} Edit</a><a class="btn mini" href="#/responses/${r.id}">${ic('people', 13)} Guest list</a>${r.slug ? `<button class="btn mini" data-share="${r.id}">Last guest link</button>` : ''}<button class="circle del" data-delete="${r.id}" aria-label="Delete ${h(r.data.person || 'draft')}">${ic('trash', 15)}</button></div></article>`).join('')}</div>` : `<div class="empty"><span class="seal">${ic('letter', 22)}</span><h3>Your first invitation starts here.</h3><p>एक डिज़ाइन चुनें और अपना निमंत्रण बनाएँ।</p><a class="btn plain" href="#/designs">Browse occasions ${ic('arrow', 13)}</a></div>`}</section></div>`;
  root
    .querySelectorAll('[data-share]')
    .forEach((b) => (b.onclick = () => showLink(list.find((r) => r.id === b.dataset.share))));
  root.querySelectorAll('[data-delete]').forEach(
    (b) =>
      (b.onclick = () => {
        const m = modal(
          'Delete from this device?',
          `<p>This removes the draft, local files and imported replies. It cannot take back invitations that have already been shared.</p><div class="actions"><button class="btn plain" data-cancel>Cancel</button><button class="btn primary" data-confirm-delete>Delete draft</button></div><p class="error" role="alert"></p>`,
        );
        $('[data-cancel]', m).onclick = () => m.close();
        $('[data-confirm-delete]', m).onclick = async (ev) => {
          ev.currentTarget.disabled = true;
          try {
            await desk.deleteDraft(b.dataset.delete);
            m.close();
            await route();
          } catch (e) {
            $('.error', m).textContent = message(e);
            $('[data-confirm-delete]', m).disabled = false;
          }
        };
      }),
  );
}
function replyDetails(r) {
  return `<tr><td>${h(r.name)}</td><td>${labels[r.attendance][0]}</td><td>${r.party || '—'}</td><td>${h(r.note || '—')}</td></tr>`;
}
async function responses(id, alive) {
  const [r, list] = await Promise.all([desk.getDraft(id), desk.getReplies(id)]);
  if (!alive()) return;
  if (!r) throw Error('This invitation is not saved in this browser.');
  root.innerHTML = `<div class="wrap section-page"><div class="crumb"><a href="#/dashboard">My invitations</a> / Guest list</div><div class="page-head"><div><span class="eyeline">ON THIS DEVICE</span><h1>Guest responses.</h1><p>${h(r.data.person)} · Guests reply to your WhatsApp or email. Open the link in their message here and select “Add to guest list”. Replies are not collected automatically.</p></div><button class="btn mini" data-refresh>${ic('refresh', 14)} Refresh</button></div><div class="stats"><div><span>Confirmed guests</span><strong id="confirmed">${list.reduce((sum, x) => sum + x.party, 0)}</strong></div><div><span>Imported replies</span><strong id="reply-count">${list.length}</strong></div><div><span>Maybe</span><strong>${list.filter((x) => x.attendance === 'maybe').length}</strong></div></div><section class="panel list-panel"><div class="list-head"><h2>Guest book</h2></div>${list.length ? `<div class="table-scroll"><table><thead><tr><th>Guest</th><th>Response</th><th>Party size</th><th>Note</th></tr></thead><tbody>${list.map(replyDetails).join('')}</tbody></table></div>` : '<div class="empty"><h3>No imported replies yet.</h3><p>Your WhatsApp or email inbox is the original record.</p></div>'}</section></div>`;
  $('[data-refresh]', root).onclick = route;
}
async function openReply(token, alive) {
  const r = readReply(unpack(token)),
    owner = await desk.getDraft(r.invite).catch(() => null);
  if (!alive()) return;
  root.innerHTML = `<div class="wrap section-page"><div class="gate"><span class="eyeline">GUEST REPLY · मेहमान का जवाब</span><h1>${h(r.name)}</h1><p>RSVP · ${h(owner?.data.person || r.event)}</p><p><b>${labels[r.attendance][0]}${r.party ? ' · ' + r.party + ' guest(s)' : ''}</b></p>${r.note ? `<blockquote>${h(r.note)}</blockquote>` : ''}${owner ? '<button class="btn primary" data-import>Add to guest list / सूची में जोड़ें</button><p class="fine">A newer reply from the same guest browser replaces their previous entry.</p>' : '<p>Organizer: open this reply in the browser where you created the invitation to add it to your list. You can also keep the original message in your inbox.</p>'}</div></div>`;
  const add = $('[data-import]', root);
  if (add)
    add.onclick = async () => {
      add.disabled = true;
      try {
        await desk.importReply(r);
        location.hash = '/responses/' + r.invite;
      } catch (e) {
        toast(message(e));
        add.disabled = false;
      }
    };
}
async function route() {
  const n = ++revision,
    alive = () => n === revision;
  if ($('#cinema').open) $('#cinema').close();
  if ($('#modal').open) $('#modal').close();
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
  if (editor) {
    const old = editor;
    editor = null;
    try {
      await old.leave();
    } catch (e) {
      toast(message(e));
    }
  }
  if (!alive()) return;
  const [page, id, ...extra] = location.hash.replace(/^#\/?/, '').split('/'),
    guest = page === 'i';
  $('#bar').hidden = $('#footer').hidden = guest;
  document.title = 'Celebration Studio — Create moments, share happiness';
  try {
    if (guest) {
      if (extra.length) throw Error('Copy the complete guest link again.');
      const card = readInvite(unpack(id));
      document.title = card.data.person + ' · ' + eventOf(card.data.occasion).name + ' invitation';
      cleanup = play(root, card.data, { slug: id, inviteID: card.id, ...card.media });
    } else {
      shell(page);
      if (page === 'dashboard') await dashboard(alive);
      else if (page === 'responses') await responses(id, alive);
      else if (page === 'reply') {
        if (extra.length) throw Error('Copy the complete reply link again.');
        await openReply(id, alive);
      } else if (page === 'studio') {
        const e = state.catalog.occasions.find((e) => e.id === id);
        if (!e) throw Error('Choose a listed occasion.');
        studio(root, e);
      } else if (page === 'edit' || (page === 'new' && id)) {
        const t = designOf(id);
        const r =
          page === 'edit'
            ? await desk.getDraft(id)
            : t
              ? { id: null, version: 0, published: false, slug: '', data: startCard(t) }
              : null;
        if (!alive()) return;
        if (!r)
          throw Error(
            page === 'edit'
              ? 'This device draft is not in this browser. An editor address is not a guest link. Open the original draft on its device and choose Create guest link.'
              : 'This edition was not found. Choose a listed design.',
          );
        const active = new Editor(r, (fn) =>
          Promise.resolve()
            .then(fn)
            .catch((e) => active.err(e)),
        );
        editor = active;
        editor.mount(root);
      } else home(root, guide, page === 'designs' || page === 'new');
    }
    if (alive()) window.scrollTo(0, 0);
  } catch (e) {
    if (alive())
      root.innerHTML = `<div class="wrap section-page"><div class="gate"><span class="eyeline">CELEBRATION STUDIO</span><h1>${guest ? 'Invitation unavailable' : 'Unable to open this page'}</h1>${errorBox(message(e))}<a class="btn plain" href="#/">Back to the studio</a></div></div>`;
  }
}
async function start() {
  try {
    const res = await fetch(new URL('catalog-v1.json', import.meta.url));
    if (!res.ok) throw Error('Could not load the occasion library. Please reload.');
    state.catalog = await res.json();
    window.addEventListener('hashchange', route);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && editor && editor.saved !== editor.seq)
        editor.save().catch((e) => toast(message(e)));
    });
    await route();
  } catch (e) {
    root.innerHTML = `<div class="wrap section-page"><h1>Studio unavailable</h1>${errorBox(message(e))}</div>`;
  }
}
start();
