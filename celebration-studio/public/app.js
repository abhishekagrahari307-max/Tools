import {
  $,
  h,
  ic,
  state,
  api,
  identity,
  eventOf,
  designOf,
  initial,
  modal,
  toast,
  showLink,
  message,
  errorBox,
} from './shared.js';
import { home, studio } from './library.js';
import { Editor } from './editor.js';
import { play } from './player.js';
const root = $('#app');
$('.skip').onclick = (ev) => {
  ev.preventDefault();
  root.focus();
};
let editor = null,
  cleanup = null,
  refreshTimer,
  nav = 0;
const brand = `<img class="brand-flower" src="/s/assets/mark.svg" alt=""><span>Celebration<span class="brand-sub">S T U D I O</span></span>`;
function header() {
  const dash = location.hash.startsWith('#/dashboard') || location.hash.startsWith('#/responses');
  $('#bar').innerHTML =
    `<div class="wrap nav"><a class="brand" href="#/" aria-label="Celebration Studio home">${brand}</a><nav><a href="#/" class="${!dash && !location.hash.startsWith('#/designs') ? 'active' : ''}">${ic('grid', 14)} Studio</a><a href="#/designs" class="${location.hash.startsWith('#/designs') ? 'active' : ''}">Occasions</a><a href="#/dashboard" class="${dash ? 'active' : ''}">My invitations</a>${state.user?.admin ? '<a href="#/admin">Admin</a>' : ''}</nav><div class="account">${state.user ? `<button id="account" class="profile" aria-label="Account for ${h(state.user.name)}">${h(state.user.name.slice(0, 1).toUpperCase())}</button>` : `<button id="login" class="btn plain compact">${ic('door', 14)} Sign in</button>`}</div></div>`;
  $('#footer').innerHTML =
    `<div class="wrap footer-inner"><span class="brand tiny">${brand}</span><span>Create moments. Share happiness. ♥</span><a href="https://abhishekagrahari307-max.github.io/Tools/birthday-wishes/" target="_blank" rel="noopener noreferrer">Birthday Wish Studio ${ic('up', 12)}</a></div>`;
  $('#login')?.addEventListener('click', () => authDialog('login'));
  $('#account')?.addEventListener('click', () => {
    const el = modal(
      'Your workspace',
      `<p>Signed in as <b>${h(state.user.name)}</b><br>${h(state.user.email)}</p><div class="actions"><a class="btn plain" id="my-dash" href="#/dashboard">My invitations</a><button class="btn primary" id="logout">Sign out</button></div>`,
    );
    $('#my-dash', el).onclick = () => el.close();
    $('#logout', el).onclick = async () => {
      try {
        if (editor) await editor.leave();
        await api('auth/logout', { method: 'POST' });
        identity();
        editor = null;
        el.close();
        location.hash = '/';
        await route();
        toast('Signed out of this studio.');
      } catch (e) {
        toast(message(e));
      }
    };
  });
}
function account(fn) {
  if (state.user)
    return Promise.resolve()
      .then(fn)
      .catch((e) => toast(message(e)));
  authDialog('register', fn);
}
function authDialog(mode, next) {
  const signup = mode === 'register';
  const el = modal(
    signup ? 'Create your studio.' : 'Welcome back.',
    `<p>${signup ? 'निजी डैशबोर्ड बनाएँ। आपके निमंत्रण और मेहमानों के जवाब आपके खाते में सुरक्षित रहेंगे।' : 'अपने निजी निमंत्रण और मेहमानों के जवाब देखने के लिए साइन इन करें।'}</p><div class="auth-tabs"><button data-mode="login" aria-pressed="${!signup}">Sign in</button><button data-mode="register" aria-pressed="${signup}">Create account</button></div><form id="auth-form">${signup ? '<label class="field">Your name<input name="display" required maxlength="70" autocomplete="name" placeholder="आपका नाम"></label>' : ''}<label class="field">Email address<input type="email" name="email" required maxlength="150" autocomplete="email" placeholder="you@example.com"></label><label class="field">Password<input type="password" name="password" autocomplete="${signup ? 'new-password' : 'current-password'}" ${signup ? 'minlength="10"' : ''} maxlength="128" required placeholder="${signup ? 'At least 10 characters' : 'Your password'}"></label><div class="auth-error" role="alert"></div><button class="btn primary full">${signup ? 'Create account' : 'Sign in'} ${ic('arrow')}</button></form><p class="fine">Branch preview · Use a separate preview password. No email verification or reset service is connected.</p>`,
  );
  el.querySelectorAll('[data-mode]').forEach(
    (b) => (b.onclick = () => authDialog(b.dataset.mode, next)),
  );
  const f = $('#auth-form', el);
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = $('button', f);
    btn.disabled = true;
    $('.auth-error', f).replaceChildren();
    try {
      const r = await api('auth/' + mode, {
        auth: false,
        method: 'POST',
        body: { name: f.elements.display?.value, email: f.email.value, password: f.password.value },
      });
      identity(r.token, r.user);
      el.close();
      header();
      if (next) {
        await next();
      } else if (editor) {
        await editor.save();
      } else await route();
    } catch (e) {
      if (el.open) $('.auth-error', f).innerHTML = errorBox(message(e));
      else toast(message(e));
    } finally {
      btn.disabled = false;
    }
  };
}
function how() {
  modal(
    'An invitation in three steps.',
    `<ol class="guide"><li><b>Choose your stationery</b><p>Choose an occasion, then one of its illustrated editions. Try its six-page editor without an account.</p></li><li><b>Make it personal</b><p>नाम, तस्वीर, अपना संदेश और कार्यक्रम जोड़ें। Sign in to autosave a private draft.</p></li><li><b>Publish & welcome guests</b><p>Send the personal link. Guests reply without signing in; only you and the administrator see the guest list.</p></li></ol>`,
  );
}
function gate() {
  root.innerHTML = `<div class="wrap section-page"><div class="crumb">Studio / Private workspace</div><div class="gate"><div class="seal">${ic('lock', 27)}</div><span class="eyeline">YOUR PRIVATE WORKSPACE</span><h1>My invitations.</h1><p>ड्राफ़्ट, प्रकाशित निमंत्रण और मेहमानों के जवाब आपके खाते में मिलेंगे।</p><div class="actions"><button class="btn primary" id="gate-in">Sign in</button><button class="btn plain" id="gate-new">Create account</button></div></div></div>`;
  $('#gate-in').onclick = () => authDialog('login', route);
  $('#gate-new').onclick = () => authDialog('register', route);
}
function confirmAction(title, body, label, action) {
  const m = modal(
    title,
    `<p>${h(body)}</p><div class="actions"><button class="btn plain" id="cancel">Cancel</button><button class="btn primary" id="commit-action">${h(label)}</button></div><p class="error" role="alert"></p>`,
  );
  $('#cancel', m).onclick = () => m.close();
  $('#commit-action', m).onclick = async (e) => {
    e.currentTarget.disabled = true;
    try {
      await action();
      m.close();
      await route();
    } catch (err) {
      $('.error', m).textContent = message(err);
      $('#commit-action', m).disabled = false;
    }
  };
}
async function dashboard(admin, ticket) {
  const result = await api(admin ? 'oversight' : 'invitations');
  if (ticket !== nav) return;
  const list = result.invitations,
    total = list.reduce((s, i) => s + i.attending, 0);
  root.innerHTML = `<div class="wrap section-page"><div class="crumb"><a href="#/">Studio</a> / ${admin ? 'Administration' : 'Private workspace'}</div><div class="page-head"><div><span class="eyeline">${admin ? 'PLATFORM ADMINISTRATION' : 'THE ORGANIZER’S DESK'}</span><h1>${admin ? 'All invitations.' : 'My invitations.'}</h1><p>${admin ? 'Manage invitations across the preview.' : 'आपके ड्राफ़्ट, निमंत्रण और असली RSVP एक जगह।'}</p></div><div class="actions">${admin ? '<a class="btn plain" href="/admin/" target="_blank" rel="noopener">Manage users & templates ↗</a>' : ''}<a class="btn primary" href="#/new">${ic('plus')} Create invitation</a></div></div><div class="stats">${[
    [list.filter((x) => !x.published).length, 'Private drafts', 'feather'],
    [list.filter((x) => x.published).length, 'Published invitations', 'letter'],
    [total, 'Confirmed guests', 'people'],
  ]
    .map(([n, l, i]) => `<div><span>${ic(i, 18)} ${l}</span><strong>${n}</strong></div>`)
    .join(
      '',
    )}</div><section class="panel list-panel"><div class="list-head"><h2>${admin ? 'Invitation register' : 'Your collection'}</h2><button class="btn mini" data-refresh>${ic('refresh', 14)} Refresh</button></div>${list.length ? `<div class="invite-list">${list.map((i) => `<article class="invite-row"><div class="list-mark">${ic(i.published ? 'letter' : 'feather', 20)}</div><div class="row-info"><small>${h(eventOf(i.occasion).name)} · ${h(i.template)}</small><h3>${h(i.person || 'Untitled invitation')}</h3><p>${admin ? h(i.owner) + ' · ' : ''}<span class="badge ${i.published ? 'live' : ''}">${i.published ? 'Published' : 'Draft'}</span> · ${i.attending} attending</p></div><div class="row-tools"><a class="btn mini" href="#/edit/${i.id}">${ic('edit', 13)} Edit</a><a class="btn mini" href="#/responses/${i.id}">${ic('people', 13)} Replies (${i.replies})</a>${i.published ? `<button class="btn mini" data-share="${i.id}">Share</button><button class="link-control" data-off="${i.id}">Unpublish</button>` : ''}<button class="circle del" data-delete="${i.id}" aria-label="Delete ${h(i.person || 'invitation')}">${ic('trash', 15)}</button></div></article>`).join('')}</div>` : `<div class="empty"><span class="seal">${ic('letter', 22)}</span><h3>Your first invitation starts here.</h3><p>एक डिज़ाइन चुनें, नाम लिखें और अपना पहला निमंत्रण बनाएँ।</p><a class="btn plain" href="#/designs">Browse designs ${ic('arrow', 13)}</a></div>`}</section></div>`;
  $('[data-refresh]').onclick = route;
  root
    .querySelectorAll('[data-share]')
    .forEach((b) => (b.onclick = () => showLink(list.find((i) => i.id === b.dataset.share))));
  root
    .querySelectorAll('[data-delete]')
    .forEach(
      (b) =>
        (b.onclick = () =>
          confirmAction(
            'Delete this invitation?',
            'The link will stop working. The invitation, files and all its guest responses will be deleted.',
            'Delete invitation',
            () => api('invitations/' + b.dataset.delete, { method: 'DELETE' }),
          )),
    );
  root.querySelectorAll('[data-off]').forEach(
    (b) =>
      (b.onclick = () =>
        confirmAction(
          'Unpublish this invitation?',
          'Guests will no longer see the card or submit replies. Your draft and existing RSVPs will remain.',
          'Unpublish',
          async () => {
            const r = await api('invitations/' + b.dataset.off);
            await api(`invitations/${r.id}/unpublish`, {
              method: 'POST',
              body: { version: r.version },
            });
          },
        )),
  );
}
async function responses(id, ticket) {
  const r = await api(`invitations/${id}/responses`);
  if (ticket !== nav) return;
  root.innerHTML = `<div class="wrap section-page"><div class="crumb"><a href="#/dashboard">My invitations</a> / Guest list</div><div class="page-head"><div><span class="eyeline">PRIVATE RSVP DASHBOARD</span><h1>Guest responses.</h1><p>${h(r.invitation.data.person)} · ${h(eventOf(r.invitation.data.occasion).name)}</p></div><button class="btn plain" id="refresh-guest">${ic('refresh')} Refresh</button></div><div class="stats"><div><span>Confirmed guests</span><strong id="confirmed">${r.attending}</strong></div><div><span>Replies received</span><strong>${r.responses.length}</strong></div><div><span>Maybe</span><strong>${r.responses.filter((x) => x.attendance === 'maybe').length}</strong></div></div><section class="panel list-panel"><div class="list-head"><h2>Guest book</h2><small><i class="dot"></i> Updates every 12s</small></div>${r.responses.length ? `<div class="table-scroll"><table><thead><tr><th>Guest</th><th>Response</th><th>Party size</th><th>Note</th></tr></thead><tbody>${r.responses.map((x) => `<tr><td>${h(x.name)}</td><td>${{ yes: 'Attending', no: 'Not attending', maybe: 'Maybe' }[x.attendance]}</td><td>${x.party}</td><td>${h(x.note || '—')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><h3>No replies yet.</h3><p>प्रकाशित लिंक किसी दूसरे ब्राउज़र में खोलकर RSVP भेजकर देखें।</p></div>'}</section></div>`;
  $('#refresh-guest').onclick = () => responses(id, ticket).catch((e) => toast(message(e)));
}
async function route() {
  const ticket = ++nav;
  clearInterval(refreshTimer);
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
  if ($('#cinema').open) $('#cinema').close();
  if ($('#modal').open) $('#modal').close();
  if (editor) {
    const old = editor;
    editor = null;
    try {
      await old.leave();
    } catch (e) {
      toast(message(e));
    }
  }
  if (ticket !== nav) return;
  const [page = 'home', id] = location.hash.replace(/^#\/?/, '').split('/');
  const guest = location.pathname.match(/^\/i\/([\w-]+)\/?$/);
  $('#bar').hidden = $('#footer').hidden = !!guest;
  document.title = 'Celebration Studio — Create moments, share happiness';
  try {
    if (guest) {
      const slug = guest[1],
        r = await api('public/' + slug, { auth: false });
      if (ticket !== nav) return;
      const d = r.data;
      document.title = `${d.person} · ${eventOf(d.occasion).name} invitation`;
      cleanup = play(root, d, {
        slug,
        photo: d.photo ? `/api/public/${slug}/media/${d.photo}` : '',
        video: d.video ? `/api/public/${slug}/media/${d.video}` : '',
        gallery: Object.fromEntries(
          (d.gallery || []).map((m) => [m.id, `/api/public/${slug}/media/${m.id}`]),
        ),
      });
      return;
    }
    header();
    if (['dashboard', 'responses', 'edit', 'admin'].includes(page) && !state.user) {
      gate();
      return;
    }
    if (page === 'dashboard' || page === 'admin') {
      await dashboard(page === 'admin', ticket);
    } else if (page === 'responses') {
      await responses(id, ticket);
      if (ticket === nav)
        refreshTimer = setInterval(() => {
          if (!document.hidden) responses(id, ticket).catch(() => {});
        }, 12000);
    } else if (page === 'studio') {
      const e = state.catalog.occasions.find((e) => e.id === id);
      if (!e) throw Error('Occasion not found.');
      studio(root, e);
    } else if ((page === 'new' && id) || page === 'edit') {
      let r;
      if (page === 'edit') {
        r = await api('invitations/' + encodeURIComponent(id));
      } else {
        const t = designOf(id);
        if (!t)
          throw Error(
            'This edition is not listed. Choose another design from the occasion library.',
          );
        const initialEvent =
          {
            royal: 'wedding',
            floral: 'anniversary',
            festive: 'diwali',
            midnight: 'engagement',
            playful: 'birthday',
            classic: 'festival-party',
          }[t.art] || 'birthday';
        r = {
          id: null,
          version: 0,
          slug: '',
          published: false,
          data: initial(t, eventOf(t.occasion || initialEvent)),
        };
      }
      if (ticket !== nav) return;
      editor = new Editor(r, account);
      editor.mount(root);
    } else home(root, how, page === 'designs' || page === 'new');
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (e) {
    if (ticket !== nav) return;
    if (e.status === 401 && !guest) {
      identity();
      header();
      gate();
    } else
      root.innerHTML = `<div class="wrap section-page"><div class="gate"><span class="eyeline">CELEBRATION STUDIO</span><h1>${guest ? 'Invitation unavailable' : 'Unable to open this page'}</h1><p>${h(message(e))}</p><a class="btn plain" href="/">Back to the studio</a></div></div>`;
  }
}
(async () => {
  try {
    state.catalog = await api('catalog', { auth: false });
    if (state.token && !location.pathname.startsWith('/i/')) {
      try {
        const res = await api('me');
        state.user = res.user;
      } catch (e) {
        if (e.status === 401) identity();
        else throw e;
      }
    }
    window.addEventListener('hashchange', route);
    await route();
  } catch (e) {
    root.innerHTML = `<div class="wrap section-page"><h1>Studio unavailable</h1>${errorBox(message(e))}<p>Please reload when the preview server is ready.</p></div>`;
  }
})();
