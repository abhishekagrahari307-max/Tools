import { $, h, ic, state, asset, art, designsFor } from './shared.js';

const num = (n) => String(n).padStart(2, '0');
const study = (e) => art({ art: e.id, edition: 'signature' });
function studioCard(e, i) {
  const count = designsFor(e.id).length;
  return `<a class="occasion-tile" data-occasion="${e.id}" href="#/studio/${e.id}" style="--tint:${e.colors[0]}"><div class="plate-face"><img src="${h(study(e))}" alt="" ${i > 3 ? 'loading="lazy"' : ''}><small>Nº ${num(i + 1)}</small></div><div class="plate-slip"><span class="plate-kicker">${h(e.group)} <i></i> ${count} ${count === 1 ? 'edition' : 'editions'}</span><h3>${h(e.name)}</h3><p lang="hi">${h(e.hi)}</p><span class="plate-go" aria-hidden="true">${ic('up', 16)}</span></div></a>`;
}
export function home(root, how, libraryOnly = false) {
  const events = state.catalog.occasions,
    designs = state.catalog.templates.filter((t) => t.occasion);
  root.innerHTML = `<div class="wrap occasion-home"><div class="breadcrumb-line"><span>${ic('grid', 12)} Workspace <b>/</b> Occasion library</span><small><i></i> INVITATION ATELIER</small></div>${libraryOnly ? '' : `<section class="catalog-intro"><img src="${asset('assets/atelier.webp')}" alt="" class="catalog-photo"><div><span class="eyeline"><i></i> CELEBRATION STUDIO &nbsp; / &nbsp; VOL. 02</span><h1>Every occasion,<br><em>its own story.</em></h1><p>अपना अवसर चुनें। Six pages, illustrated for the people you’re inviting.</p></div><button id="how" class="intro-stamp" aria-label="How the invitation studio works">Studio guide ${ic('up', 12)}</button></section>`}<section class="occasion-library" aria-labelledby="collection-title"><div class="gallery-head"><div><span class="eyeline"><i></i> THE FUNCTION INDEX</span><h2 id="collection-title">Choose your <em>occasion.</em></h2></div><span class="design-total">${num(events.length)} studios &nbsp; / &nbsp; ${designs.length} designs</span></div><div class="index-bar"><div class="chips" role="group" aria-label="Filter occasions">${['All occasions', 'Milestones', 'Family', 'Festivals'].map((g, i) => `<button data-group="${g}" aria-pressed="${i === 0}">${i === 0 ? ic('grid', 13) : ''}${g}</button>`).join('')}</div><small>ILLUSTRATED IN INDIA’S FESTIVE TRADITIONS</small></div><div class="occasion-grid"></div></section></div>`;
  const filter = (group) => {
    $('.occasion-grid', root).innerHTML = events
      .map((e, i) => (group === 'All occasions' || e.group === group ? studioCard(e, i) : ''))
      .join('');
    root
      .querySelectorAll('[data-group]')
      .forEach((b) => b.setAttribute('aria-pressed', b.dataset.group === group));
  };
  filter('All occasions');
  root.querySelectorAll('[data-group]').forEach((b) => (b.onclick = () => filter(b.dataset.group)));
  $('#how', root)?.addEventListener('click', how);
}
export function studio(root, e) {
  const designs = designsFor(e.id),
    ename = h(e.name),
    seq = num(state.catalog.occasions.indexOf(e) + 1);
  document.title = `${e.name} invitation studio · Celebration Studio`;
  root.innerHTML = `<div class="wrap function-room" data-studio="${e.id}" style="--tint:${e.colors[0]};--tint-paper:${e.colors[1]};--tint-dark:${e.colors[3]}"><div class="crumb"><a href="#/">Occasions</a> / ${ename} studio</div><section class="room-hero"><div class="room-type"><span class="room-folio">COLLECTION ${seq} &nbsp; / &nbsp; ${h(e.group.toUpperCase())}</span><h1>${ename}<br><em>invitation studio.</em></h1><p><b lang="hi">${h(e.hi)}</b> &nbsp;·&nbsp; ${h(e.pages[0].intro[0])}</p></div><div class="room-illustration"><img src="${h(study(e))}" alt="${ename} signature illustration"></div></section><div class="room-chapters"><span>IN SIX CHAPTERS</span><ol>${e.pages.map((p, i) => `<li><small>${num(i + 1)}</small>${h(p.title[0])}</li>`).join('')}</ol></div><section class="edition-library"><div class="gallery-head"><div><span class="eyeline"><i></i> THE ${ename.toUpperCase()} COLLECTION</span><h2>Pick an <em>edition.</em></h2><p>एक डिज़ाइन खोलें और अपने छह पन्ने सजाएँ।</p></div><a class="text-link" href="#/designs">All occasions ${ic('up', 12)}</a></div><div class="edition-grid">${designs.map((t, i) => `<a class="edition-card" href="#/new/${h(t.code)}" data-edition="${h(t.edition)}"><div class="edition-face"><img src="${h(art(t))}" alt=""><span>ED. ${num(i + 1)}</span></div><div class="edition-slip"><small>${h(t.caption)}</small><h3>${h(t.name)}</h3><span class="tile-arrow">${ic('arrow', 16)}</span></div></a>`).join('') || '<p>No editions are listed for this occasion yet.</p>'}</div></section></div>`;
}
