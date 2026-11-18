import {
  $,
  h,
  ic,
  options,
  state,
  designOf,
  designsFor,
  eventOf,
  modal,
  toast,
  message,
} from '../shared.js';
import { editionCard } from '../library.js';
import { chapter } from '../chapters.js';
import { addPreset, listPresets, deletePreset, cardFromPreset } from './presets.js';
import { startCard } from './links.js';

const PAGE_SIZE = 12;
export function shelf(root, e, personal = false) {
  const base = designsFor(e.id),
    addURL = '#/add-template/' + e.id;
  let mine = [],
    storageNote = '',
    page = 0;
  const reload = () => {
    try {
      mine = listPresets(e.id);
      storageNote = '';
    } catch {
      mine = [];
      storageNote =
        'Personal templates are unavailable while browser storage is blocked. All studio templates still work.';
    }
  };
  reload();
  root.innerHTML = `<div class="gallery-head shelf-head"><div><span class="eyeline"><i></i> THE ${h(e.name.toUpperCase())} COLLECTION</span><h2>Choose a <em>template.</em></h2><p>${base.length} invitation designs · छह पन्ने, आपके अपने अंदाज़ में।</p></div><a class="btn primary" href="${addURL}">${ic('plus', 16)} Add template</a></div>
    <div class="shelf-tools"><div class="chips" role="group" aria-label="Template collection"><button type="button" data-scope="library">Studio library <b>${base.length}</b></button><button type="button" data-scope="mine">My templates <b data-my-count></b></button></div><label class="template-search">${ic('search', 16)}<input type="search" data-search placeholder="Find a template…" aria-label="Search template names, styles or numbers"></label></div>
    <p class="fine" role="status" data-range></p><div class="edition-grid"></div><nav class="shelf-pages" aria-label="Template pages" hidden><button class="btn mini" data-prev-page>← Previous</button><label>Page <select data-page aria-label="Template page"></select></label><button class="btn mini" data-next-page>Next →</button></nav>`;
  const grid = $('.edition-grid', root),
    pager = $('.shelf-pages', root),
    search = $('[data-search]', root);
  function paint() {
    const q = search.value.trim().toLocaleLowerCase();
    const rows = (
      personal ? mine.map((p) => ({ t: designOf(p.base), p })) : base.map((t) => ({ t }))
    )
      .map((r, i) => ({ ...r, i }))
      .filter(({ t, p, i }) =>
        `${p?.name || ''} ${t.name} ${t.caption} ${String(i + 1).padStart(2, '0')}`
          .toLocaleLowerCase()
          .includes(q),
      );
    const pages = Math.ceil(rows.length / PAGE_SIZE);
    page = Math.max(0, Math.min(page, pages - 1));
    const start = page * PAGE_SIZE,
      visible = rows.slice(start, start + PAGE_SIZE);
    $('[data-my-count]', root).textContent = mine.length;
    root
      .querySelectorAll('[data-scope]')
      .forEach((b) => b.setAttribute('aria-pressed', (b.dataset.scope === 'mine') === personal));
    $('[data-range]', root).textContent = [
      personal && storageNote,
      rows.length
        ? `Showing ${start + 1}–${start + visible.length} of ${rows.length} ${personal ? 'personal' : 'studio'} templates`
        : '0 templates',
    ]
      .filter(Boolean)
      .join(' · ');
    grid.innerHTML = visible
      .map(({ t, i, p }) =>
        p
          ? `<div class="personal-tile">${editionCard(t, i, p)}<button class="text-link" data-remove-preset="${h(p.id)}" aria-label="Remove ${h(p.name)} from my templates">${ic('trash', 13)} Remove</button></div>`
          : editionCard(t, i),
      )
      .join('');
    if (!rows.length)
      grid.innerHTML = `<div class="shelf-empty"><h3>${q ? 'No matching templates.' : 'Your template shelf.'}</h3><p>${q ? 'Try another name, style or template number.' : 'Save a design with your own colors and words, then reuse it for your next invitation.'}</p>${q ? '<button class="btn plain" data-clear>Clear search</button>' : `<a class="btn plain" href="${addURL}">Add template ${ic('plus', 13)}</a>`}</div>`;
    pager.hidden = pages <= 1;
    $('[data-prev-page]', pager).disabled = page === 0;
    $('[data-next-page]', pager).disabled = page + 1 >= pages;
    $('[data-page]', pager).innerHTML = Array.from(
      { length: pages },
      (_, i) => `<option value="${i}" ${i === page ? 'selected' : ''}>${i + 1} / ${pages}</option>`,
    ).join('');
  }
  function turn(n) {
    page = n;
    paint();
    $('.shelf-tools', root).scrollIntoView({ block: 'start' });
    $('.edition-card', grid)?.focus({ preventScroll: true });
  }
  search.oninput = () => {
    page = 0;
    paint();
  };
  $('[data-page]', pager).onchange = (ev) => turn(Number(ev.target.value));
  root.onclick = (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-prev-page')) turn(page - 1);
    if (b.hasAttribute('data-next-page')) turn(page + 1);
    if (b.hasAttribute('data-clear')) {
      search.value = '';
      page = 0;
      paint();
      search.focus();
    }
    if (b.dataset.scope) {
      personal = b.dataset.scope === 'mine';
      search.value = '';
      page = 0;
      history.replaceState(null, '', `#/studio/${e.id}${personal ? '/mine' : ''}`);
      paint();
    }
    if (b.dataset.removePreset) {
      const p = mine.find((v) => v.id === b.dataset.removePreset);
      const m = modal(
        'Remove this template?',
        `<p><b>${h(p.name)}</b> will be removed from this browser. Invitations and guest links already made with it will keep working.</p><div class="actions"><button class="btn plain" data-cancel>Keep template</button><button class="btn primary" data-confirm>Remove template</button></div><p role="alert" class="error"></p>`,
      );
      $('[data-cancel]', m).onclick = () => m.close();
      $('[data-confirm]', m).onclick = () => {
        try {
          deletePreset(p.id);
          reload();
          m.close();
          paint();
          toast('Template removed.');
        } catch {
          $('.error', m).textContent =
            'Could not remove the template. Check site storage and try again.';
        }
      };
    }
  };
  paint();
}

const selectField = (label, key, choices) =>
  `<label class="field">${label}<select name="${key}">${options(choices, '')}</select></label>`;
export function addTemplate(root, occasion) {
  const c = state.catalog,
    first = c.occasions.find((e) => e.id === occasion) || c.occasions[0];
  root.innerHTML = `<div class="wrap section-page template-workshop"><div class="crumb"><a href="#/dashboard">Dashboard</a> / Template workshop</div><div class="page-head"><div><span class="eyeline">THE TEMPLATE WORKSHOP</span><h1>Add a <em>template.</em></h1><p>एक डिज़ाइन को अपना बनाएँ। Save a reusable starting point in this browser. No account needed.</p></div></div>
    <div class="editor-grid"><form class="panel template-form"><span class="eyeline">01 / YOUR RECIPE</span>
      ${selectField('Occasion · अवसर', 'occasion', Object.fromEntries(c.occasions.map((e) => [e.id, e.name + ' · ' + e.hi])))}
      <label class="field">Template name · टेम्पलेट का नाम<input name="name" required maxlength="64" placeholder="e.g. Our family invitation" autocomplete="off"></label>
      ${selectField('Base design', 'base', {})}<div class="two">${selectField('Color story', 'palette', c.palettes)}${selectField('Lettering', 'font', c.fonts)}</div><div class="two">${selectField('Opening', 'opening', c.openings)}${selectField('Music', 'music', c.music)}</div>
      ${selectField('Invitation language', 'language', { hi: 'हिन्दी', en: 'English' })}<label class="field">Starter message (optional)<textarea name="message" rows="3" maxlength="1600" placeholder="Leave blank to use the occasion’s message."></textarea></label>
      <p class="fine">The template name is private. Guests see the design and the words you choose for their invitation.</p><p class="error" role="alert"></p>
      <div class="actions"><button class="btn primary" type="submit">${ic('plus', 15)} Save template</button><a class="btn plain" data-cancel>Cancel</a></div></form>
      <aside class="panel preview-col"><div class="preview-top"><span><i class="dot"></i> TEMPLATE PROOF</span><label><select data-proof-page aria-label="Template proof page"><option value="cover">Cover</option><option value="message">Message</option></select></label></div><div class="preview-frame" data-proof></div><p class="template-foot">Names, event details and photos can be added when you use this template.</p></aside></div></div>`;
  const form = $('.template-form', root),
    f = form.elements,
    val = () => Object.fromEntries(new FormData(form));
  const proof = () => {
    const d = cardFromPreset(val()),
      messagePage = eventOf(d.occasion).pages.findIndex((p) => p.blocks.includes('message'));
    $('[data-proof]', root).innerHTML = chapter(
      d,
      $('[data-proof-page]', root).value === 'message' ? Math.max(0, messagePage) : 0,
    );
  };
  function defaults() {
    const d = startCard(designOf(f.base.value));
    for (const key of ['palette', 'font', 'opening', 'music']) f[key].value = d[key];
  }
  function choose() {
    const ts = designsFor(f.occasion.value);
    f.base.innerHTML = options(Object.fromEntries(ts.map((t) => [t.code, t.name])), ts[0].code);
    $('[data-cancel]', form).href = '#/studio/' + f.occasion.value;
    defaults();
  }
  f.occasion.value = first.id;
  choose();
  proof();
  form.onchange = (ev) => {
    if (ev.target === f.occasion) choose();
    else if (ev.target === f.base) defaults();
    proof();
  };
  f.message.oninput = proof;
  $('[data-proof-page]', root).onchange = proof;
  form.onsubmit = (ev) => {
    ev.preventDefault();
    try {
      addPreset(val());
      toast('Template saved · टेम्पलेट सहेजा गया');
      location.hash = '/studio/' + f.occasion.value + '/mine';
    } catch (e) {
      $('.error', form).textContent = message(e);
    }
  };
}
