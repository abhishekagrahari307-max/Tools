// One renderer for the editor proof, guest book, printable sheets and standalone card.
// The program, not the page number, decides what is on a page (e.g. a wedding album
// belongs with the couple’s story; directions are on a housewarming’s final page).
import {
  $,
  h,
  ic,
  state,
  eventOf,
  art,
  choose,
  local,
  dateText,
  mapLink,
  publicURL,
} from './shared.js';
const unsignedWishes = {
  birthday: [
    'May this next year bring more of the things that make you smile.',
    'यह नया साल आपकी मनपसंद खुशियों से भरा हो।',
  ],
  anniversary: [
    'To the laughter you have shared, and all the years still to come.',
    'साथ बिताई हँसी और आने वाले सुनहरे वर्षों के नाम।',
  ],
  'baby-shower': [
    'May little hands always find a loving hand to hold.',
    'नन्हे हाथों को थामने के लिए सदा प्यार भरे हाथ मिलें।',
  ],
  'raksha-bandhan': [
    'Wherever life takes us, may this thread keep us close.',
    'जीवन कहीं भी ले जाए, यह डोर हमें पास रखे।',
  ],
};
const num = (n) => String(n).padStart(2, '0');
const fontMap = {
  serif: 'Fraunces,Hindi,Georgia,serif',
  sans: "'DM Sans',Hindi,sans-serif",
  hand: 'Caveat,Hindi,cursive',
};
export const editionOf = (d) =>
  ['folio', 'nocturne'].includes(d.design.edition) ? d.design.edition : 'signature';
export function vars(d) {
  const [ink, paper, eventAccent, eventDark] = eventOf(d.occasion).colors,
    p = state.catalog.palettes[d.palette] || state.catalog.palettes.wine,
    accent = p[3] || eventAccent,
    dark =
      p[4] ||
      (d.palette === d.design.palette ? eventDark : `color-mix(in srgb,${eventDark} 30%,${p[1]})`),
    signature =
      !d.design.print &&
      !!d.design.occasion &&
      editionOf(d) === 'signature' &&
      d.palette === d.design.palette;
  return `--card-ink:${signature ? ink : p[1]};--card-paper:${signature ? paper : p[2]};--card-accent:${accent};--card-dark:${dark};--card-font:${fontMap[d.font] || fontMap.serif}`;
}
export function personal(d, lang) {
  const e = eventOf(d.occasion),
    msg = d.message || local([e.englishMessage, e.message], lang);
  if (lang !== (d.language || 'hi') && d.messageAlt?.trim()) return d.messageAlt;
  if ([e.message, e.alternate, e.englishMessage].includes(msg))
    return lang === 'en' ? e.englishMessage : msg === e.alternate ? e.alternate : e.message;
  return msg;
}
export function honoree(d) {
  return [d.person, d.fields?.partner].filter(Boolean).join(' & ');
}
function lines(text) {
  return (text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}
function entryList(values, cls = 'ledger-list') {
  return values.length
    ? `<ol class="${cls}">${values.map((s, i) => `<li><i>${num(i + 1)}</i><span>${h(s)}</span></li>`).join('')}</ol>`
    : '';
}
function note(text, cls = 'written-note') {
  return text ? `<p class="${cls}">${h(text)}</p>` : '';
}
function letter(d, lang) {
  return `<blockquote class="host-letter"><div aria-hidden="true">“</div>${note(personal(d, lang), 'letter-msg')}${d.host ? `<cite>— ${h(d.host)}</cite>` : ''}</blockquote>`;
}
function venue(d, lang) {
  const t = (a, b) => choose(lang, a, b),
    map = mapLink(d);
  return `<section class="venue-slip"><small>${ic('calendar', 13)} ${t('DATE & DESTINATION', 'तारीख और स्थान')}</small><strong>${h([dateText(d.date, lang), d.time && d.time + ' IST'].filter(Boolean).join(' · ') || t('Time to be announced', 'समय की सूचना बाद में मिलेगी'))}</strong>${d.venue ? `<p>${ic('pin', 15)} ${h(d.venue)}</p>` : ''}${map ? `<a class="map-link" target="_blank" rel="noopener noreferrer" href="${h(map)}">${t('View on Google Maps', 'Google Maps पर देखें')} ${ic('up', 13)}</a>` : ''}</section>`;
}
function album(d, media, lang, mode) {
  const t = (a, b) => choose(lang, a, b),
    all = [
      ...(d.photo ? [{ kind: 'photo', src: media.photo }] : []),
      ...(d.gallery || []).map((m) => ({ ...m, src: media.gallery?.[m.id] })),
      ...(d.video ? [{ kind: 'video', src: media.video }] : []),
    ],
    staticMode = ['print', 'offline'].includes(mode);
  if (!all.length)
    return `<div class="album-flyleaf"><span aria-hidden="true">${ic('image', 25)}</span><p>${t('This album has no shared photos or films yet.', 'इस एल्बम में अभी तस्वीरें या वीडियो नहीं जोड़े गए हैं।')}</p></div>`;
  return `<div class="chapter-album" aria-label="${t('Memory album', 'यादों का एल्बम')}">${all
    .map((m, i) => {
      const cap =
        m.caption ||
        t(
          m.kind === 'photo' ? 'Photograph' : 'Short film',
          m.kind === 'photo' ? 'तस्वीर' : 'लघु फ़िल्म',
        );
      return `<figure ${!staticMode && i ? 'hidden' : ''} data-slide="${i}">${m.kind === 'video' && staticMode && !(mode === 'offline' && state.pages && m.src) ? `<p class="film-ticket">${ic('play', 18)} ${t('Film · watch in the online invitation', 'फ़िल्म · ऑनलाइन निमंत्रण में देखें')}</p>` : m.src ? (m.kind === 'photo' ? `<img src="${h(m.src)}" alt="${h(cap)}">` : `<video controls playsinline preload="metadata" src="${h(m.src)}" aria-label="${h(cap)}"></video>`) : `<p>${t('Preparing media…', 'फ़ाइल तैयार हो रही है…')}</p>`}<figcaption><b>${num(i + 1)}</b> ${h(cap)}</figcaption></figure>`;
    })
    .join(
      '',
    )}${all.length > 1 && !staticMode ? `<div class="album-controls"><button data-album="-1" aria-label="${t('Previous memory', 'पिछली याद')}">‹</button><span data-album-count aria-live="polite">1 / ${all.length}</span><button data-album="1" aria-label="${t('Next memory', 'अगली याद')}">›</button></div>` : ''}</div>`;
}
function stamp(mark, text) {
  return `<div class="chapter-seal" aria-hidden="true"><i>${mark}</i></div>${note(text, 'seal-caption')}`;
}
function body(d, p, lang, media, mode, slug, qr) {
  const t = (a, b) => choose(lang, a, b),
    f = d.fields || {},
    e = eventOf(d.occasion),
    staticMode = ['print', 'offline'].includes(mode);
  const label = (spec) => local(spec.label, lang).split(' · ')[0];
  const letterBlock = p.blocks.includes('message') ? letter(d, lang) : '';
  let content = '';
  switch (p.kind) {
    case 'families':
    case 'portraits':
      content = `<div class="family-spread">${p.fields.map((s, i) => `<div><span>${i === 0 ? 'I' : 'II'}</span><h3>${h(p.kind === 'families' ? t(i ? 'Second family' : 'First family', i ? 'दूसरा परिवार' : 'पहला परिवार') : (i ? f.partner : d.person) || label(s))}</h3>${note(f[s.key] || t(i ? 'With our warmest welcome.' : 'With love and blessings.', i ? 'हमारा हार्दिक स्वागत।' : 'सप्रेम और आशीर्वाद सहित।'))}</div>`).join('')}</div>`;
      break;
    case 'story':
      content = `<div class="story-opening"><span>❦</span>${note(f.story || t('Every story begins with a first meeting; ours continues with this invitation.', 'एक मुलाक़ात से शुरू हुई हमारी कहानी अब इस निमंत्रण तक आ पहुँची है।'))}</div>`;
      break;
    case 'wish-wall': {
      const wishes = lines(f[p.fields[0].key]);
      content = `<div class="wish-wall">${(wishes.length ? wishes : [local(unsignedWishes[d.occasion], lang)]).map((v, i) => `<blockquote><i aria-hidden="true">${['✦', '❦', '✺'][i % 3]}</i>${h(v)}</blockquote>`).join('')}</div>`;
      break;
    }
    case 'cake':
    case 'promise':
    case 'thread': {
      const cake = p.kind === 'cake',
        thread = p.kind === 'thread',
        tag = cake
          ? t('Make a wish', 'एक इच्छा माँगें')
          : thread
            ? t('Untie the letter', 'डोर खोलकर पढ़ें')
            : t('Open the promise', 'वादा पढ़ें');
      content = `<div class="reveal-object">${stamp(cake ? '✷' : thread ? '❉' : '◇', cake ? f.cakeTime && f.cakeTime + ' IST' : thread ? f.sibling : f.ringTime && f.ringTime + ' IST')}<details ${staticMode ? 'open' : ''}><summary>${tag} <span>＋</span></summary>${note((cake ? f.surprise : thread ? f.letter : f.promise) || (cake ? t('Close your eyes and make a wish. This moment is yours!', 'आँखें बंद करें और एक इच्छा माँगें। यह पल आपका है!') : thread ? t('No matter how far we travel, this thread brings us home.', 'दूरियाँ कितनी भी हों, यह डोर हमें फिर साथ ले आती है।') : t('Today we choose each other.', 'आज हम एक-दूसरे का हाथ थामते हैं।')))}</details></div>`;
      break;
    }
    case 'timeline':
      content = `<div class="journey">${entryList(lines(f.journey).length ? lines(f.journey) : [t('The beginning', 'शुरुआत'), t('Our life together', 'साथ का सफ़र'), t('The next chapter', 'अगला अध्याय')], 'timeline-list')}</div>`;
      break;
    case 'rites':
      content =
        d.occasion === 'wedding'
          ? `<div class="rite-grid">${p.fields.map((s, i) => `<div><small>${num(i + 1)} / ${t('RITE', 'रस्म')}</small><h3>${h(label(s))}</h3>${note(f[s.key])}</div>`).join('')}</div>`
          : entryList(
              lines(f.rituals).length
                ? lines(f.rituals)
                : [t('Family puja', 'परिवार की पूजा'), t('Moonrise', 'चंद्रोदय')],
            );
      break;
    case 'lamps':
      content = `<div class="lamp-row ${staticMode ? 'lit' : ''}">${[0, 1, 2, 3, 4].map(() => '<i aria-hidden="true"><b></b></i>').join('')}</div>${staticMode ? '' : `<button class="ritual-button" data-light aria-pressed="false" data-off="${t('Light the lamps', 'दीप जलाएँ')}" data-on="${t('The lamps are lit', 'दीप जल गए हैं')}">${t('Light the lamps', 'दीप जलाएँ')}</button>`}${entryList(lines(f[p.fields[0].key]))}`;
      break;
    case 'colour-run':
      content = `<div class="colour-program" style="--gulal:#a23f67"><div class="powder-picks">${
        staticMode
          ? ''
          : [
              ['#a23f67', 'Rose', 'गुलाबी'],
              ['#267d75', 'Teal', 'फ़िरोज़ी'],
              ['#aa682d', 'Saffron', 'केसरिया'],
            ]
              .map(
                ([c, en, hi], i) =>
                  `<button data-gulal="${c}" aria-pressed="${i === 0}" aria-label="${t(en, hi)}" style="--powder:${c}">${t(en, hi)}</button>`,
              )
              .join('')
      }</div>${entryList(lines(f.rangotsav).length ? lines(f.rangotsav) : [t('A welcome with gulal', 'गुलाल से स्वागत'), t('Music and colour play', 'रंगों और संगीत का संगम')])}</div>`;
      break;
    case 'menu': {
      const food = lines(f[p.fields[0].key]);
      content = `<div class="menu-card"><small>${t('AT OUR TABLE', 'हमारी मेज़ पर')}</small><div>❧</div>${food.length ? `<ul>${food.map((v) => `<li>${h(v)}</li>`).join('')}</ul>` : note(t('A seat is waiting for you at our festive table.', 'त्योहार की थाली में आपके लिए जगह है।'))}</div>`;
      break;
    }
    case 'setlist':
      content = `<div class="set-list"><small>${t('RUN OF SHOW', 'कार्यक्रम क्रम')}</small>${entryList(lines(f[p.fields[0].key]).length ? lines(f[p.fields[0].key]) : [local(p.title, lang)], 'track-list')}</div>`;
      break;
    case 'portrait':
      content = `<div class="introduction">${media.photo ? `<img src="${h(media.photo)}" alt="" class="profile-print">` : stamp(e.mark, '')}<h3>${h(d.person || d.host || t(e.name, e.hi))}</h3>${note(f[p.fields[0].key])}</div>`;
      break;
    case 'agenda':
      content = entryList(lines(f.ceremony));
      break;
    case 'album':
      content = note(f.memory, 'album-inscription');
      break;
    case 'reply':
      content = note(f.farewell, 'album-inscription');
      break;
  }
  content += letterBlock;
  for (const block of p.blocks) {
    if (block === 'venue') content += venue(d, lang);
    if (block === 'schedule' && d.schedule)
      content += `<section class="program-slip"><small>${t('ORDER OF EVENTS', 'कार्यक्रम क्रम')}</small>${entryList(lines(d.schedule))}</section>`;
    if (block === 'gallery') content += album(d, media, lang, mode);
    if (block === 'reply') {
      if (!d.rsvp)
        content += note(
          t('The host is not collecting replies.', 'मेज़बान अभी जवाब नहीं ले रहे हैं।'),
          'preview-hint',
        );
      else if (mode === 'guest') content += '<section class="response"></section>';
      else if (!staticMode)
        content += note(
          t(
            'RSVP opens on the published guest link. This preview does not submit replies.',
            'प्रकाशित लिंक पर मेहमान जवाब दे सकेंगे। प्रीव्यू से RSVP नहीं भेजा जाता।',
          ),
          'preview-hint',
        );
      if (staticMode && state.pages && d.rsvp) content += state.pages.exportContact(d, lang);
      if (staticMode && slug)
        content += `<div class="printed-link">${qr ? `<img width="106" height="106" src="${h(qr)}" alt="QR">` : ''}<div><b>${t('Open the online invitation', 'ऑनलाइन निमंत्रण खोलें')}</b><p><a href="${h(publicURL(slug))}">${state.pages ? t('View the shared edition online ↗', 'साझा निमंत्रण ऑनलाइन देखें ↗') : h(publicURL(slug))}</a></p></div></div>`;
    }
  }
  return content;
}
export function chapter(
  d,
  i,
  {
    lang = d.language || 'hi',
    media = {},
    mode = 'preview',
    cover = art(d.design, d.palette),
    slug = '',
    qr = '',
  } = {},
) {
  const e = eventOf(d.occasion),
    p = e.pages[i],
    f = d.fields || {},
    t = (a, b) => choose(lang, a, b),
    title = local(p.title, lang),
    ed = editionOf(d),
    ename = t(e.name, e.hi),
    attr = `lang="${lang === 'hi' ? 'hi' : 'en'}" data-kind="${h(p.kind)}" data-page="${i + 1}" data-function="${h(e.id)}" data-edition="${ed}" style="${vars(d)}"`,
    folio = `<div class="leaf-folio"><span>${h(ename)} &nbsp; / &nbsp; ${h(d.design.name)}</span><b>${num(i + 1)} : 06</b></div>`;
  if (i === 0) {
    const tags = [
      f.age && t('Turning ' + f.age, 'उम्र: ' + f.age + ' वर्ष'),
      f.years && t(f.years + ' years together', f.years + ' वर्ष साथ'),
      f.house,
      dateText(d.date, lang),
    ];
    return `<article class="book-leaf cover-leaf" ${attr}>${folio}<div class="cover-grid"><div class="cover-art"><img src="${h(cover)}" alt=""><b>${h(e.mark)}</b></div><div class="cover-title"><small>${h(title)}</small>${media.photo ? `<img class="portrait" src="${h(media.photo)}" alt="${t('Photo chosen by the host', 'मेज़बान की चुनी तस्वीर')}">` : ''}<h2>${h(honoree(d) || ename)}</h2><p>${h(local(p.intro, lang))}</p>${
      tags.some(Boolean)
        ? `<div class="cover-tags">${tags
            .filter(Boolean)
            .map((x) => `<span>${h(x)}</span>`)
            .join('')}</div>`
        : ''
    }${d.host ? `<div class="cover-sign">${t('With love,', 'स्नेह सहित,')} <b>${h(d.host)}</b></div>` : ''}</div></div></article>`;
  }
  return `<article class="book-leaf chapter-leaf kind-${h(p.kind)}" ${attr}>${folio}<div class="leaf-inner"><header class="leaf-heading"><span class="chapter-mark" aria-hidden="true">${h(e.mark)}</span><small>${t('CHAPTER', 'अध्याय')} ${num(i + 1)}</small><h2>${h(title)}</h2><p>${h(local(p.intro, lang))}</p></header><div class="leaf-content">${body(d, p, lang, media, mode, slug, qr)}</div></div></article>`;
}
export function wireChapter(root) {
  const albums = root.querySelectorAll('.chapter-album');
  albums.forEach((box) => {
    let index = 0;
    const slides = [...box.querySelectorAll('figure')];
    box.querySelectorAll('[data-album]').forEach(
      (b) =>
        (b.onclick = () => {
          slides[index].querySelector('video')?.pause();
          index = (index + Number(b.dataset.album) + slides.length) % slides.length;
          slides.forEach((f, i) => (f.hidden = i !== index));
          $('[data-album-count]', box).textContent = `${index + 1} / ${slides.length}`;
        }),
    );
  });
  const lamp = $('[data-light]', root);
  if (lamp)
    lamp.onclick = () => {
      const on = $('.lamp-row', root).classList.toggle('lit');
      lamp.setAttribute('aria-pressed', String(on));
      lamp.textContent = on ? lamp.dataset.on : lamp.dataset.off;
    };
  root.querySelectorAll('[data-gulal]').forEach(
    (b) =>
      (b.onclick = () => {
        b.closest('.colour-program').style.setProperty('--gulal', b.dataset.gulal);
        root
          .querySelectorAll('[data-gulal]')
          .forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      }),
  );
}
