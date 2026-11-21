/* ============================================================================
   online-tools.js — the live-data tools, each pinned to one free, key-free API
   ----------------------------------------------------------------------------
   Rules this file follows, so the site stays trustworthy:

   • Every tool names the ONE host it contacts, and the UI prints that host
     before the user presses anything.
   • No API keys, no accounts, no OAuth. If the only way to do a job is a keyed
     API, the tool does not pretend: it says so and points at the offline studio
     that does the job locally instead.
   • Every request goes through OBNet.request, which times out, omits credentials,
     sends no referrer, and turns failures into a readable sentence.
   • Nothing here loads a script from a CDN. All code is served from this repo.
   ========================================================================== */
'use strict';

/* ------------------------------------------------------------------ catalog */
/* `host` is what we print. `free:false` entries are listed for honesty only and
   are never called. `offline:` points at the equivalent local tool. */
const OB_TOOLS = [
  {
    id: 'translate',
    cat: 'text',
    host: 'api.mymemory.translated.net',
    free: true,
    t: { en: ['Translate text', 'English ⇄ Hindi and 190 more pairs. Free tier: about 1,000 words a day per visitor.'],
         hi: ['Text translate karein', 'English ⇄ Hindi aur 190+ aur pairs. Free tier: lagbhag 1,000 words/din.'] },
    run: 'translate',
  },
  {
    id: 'dictionary',
    cat: 'text',
    host: 'api.dictionaryapi.dev',
    free: true,
    t: { en: ['Dictionary', 'Definitions, phonetics and examples for any English word.'],
         hi: ['Dictionary', 'Kisi bhi English word ka meaning, phonetics aur example.'] },
    run: 'dictionary',
  },
  {
    id: 'wiki',
    cat: 'text',
    host: 'en.wikipedia.org',
    free: true,
    t: { en: ['Wikipedia lookup', 'Summaries and images — handy for subtitle research and fact checks.'],
         hi: ['Wikipedia lookup', 'Summary aur images — subtitles aur fact-check ke liye.'] },
    run: 'wiki',
  },
  {
    id: 'subs-translate',
    cat: 'text',
    host: 'api.mymemory.translated.net',
    free: true,
    t: { en: ['Translate a subtitle file', 'Load an .srt and get a translated .srt back — then import it into the Subtitle Adder.'],
         hi: ['Subtitle file translate karein', 'Ek .srt load karein, translated .srt milega — phir Subtitle Adder me import karein.'] },
    run: 'subsTranslate',
  },
  {
    id: 'stockimage',
    cat: 'media',
    host: 'commons.wikimedia.org',
    free: true,
    t: { en: ['Free stock images', 'Search Wikimedia Commons for openly licensed photos, save the ones you need.'],
         hi: ['Free stock images', 'Wikimedia Commons se open-licensed photos search karein aur save karein.'] },
    run: 'stockImage',
  },
  {
    id: 'emoji',
    cat: 'media',
    host: '(bundled)',
    free: true,
    t: { en: ['Emoji picker', 'Copy emoji for titles and captions. Bundled list — works offline.'],
         hi: ['Emoji picker', 'Titles aur captions ke liye emoji copy karein. Bundled — offline bhi chalta hai.'] },
    run: 'emoji',
  },
  {
    id: 'currency',
    cat: 'data',
    host: 'open.er-api.com',
    free: true,
    t: { en: ['Currency rates', 'Convert between 160 currencies. Rates from open.er-api.com, updated daily.'],
         hi: ['Currency rates', '160 currencies ke beech convert karein. Rates open.er-api.com se, roz update.'] },
    run: 'currency',
  },
  {
    id: 'weather',
    cat: 'data',
    host: 'api.open-meteo.com',
    free: true,
    t: { en: ['Weather + forecast', 'Current conditions and 7-day forecast for any city. No key, no signup.'],
         hi: ['Weather + forecast', 'Kisi bhi city ka current weather aur 7-din forecast. Key nahi chahiye.'] },
    run: 'weather',
  },
  {
    id: 'ip',
    cat: 'data',
    host: 'ipapi.co',
    free: true,
    t: { en: ['IP address lookup', 'Your public IP and its approximate location.'],
         hi: ['IP address lookup', 'Aapka public IP aur uska approximate location.'] },
    run: 'ip',
  },
  {
    id: 'qr',
    cat: 'data',
    host: 'api.qrserver.com',
    free: true,
    t: { en: ['QR code', 'Make a QR code for a link or text, then download the PNG.'],
         hi: ['QR code', 'Link ya text ka QR code banayein, PNG download karein.'] },
    run: 'qr',
  },
  /* ---- listed, never called: honest about what we left out -------------- */
  {
    id: 'tts-pro',
    cat: 'blocked',
    host: 'elevenlabs.io',
    free: false,
    t: { en: ['Natural TTS voices', 'Studio-grade voices need a paid key, so this stays honest: use the built-in Text to Speech (offline) instead.'],
         hi: ['Natural TTS voices', 'Studio voices ke liye paid key chahiye, isliye yeh nahi hai — built-in Text to Speech (offline) use karein.'] },
    offline: '../audio-video/#tts',
  },
  {
    id: 'bgremove',
    cat: 'blocked',
    host: 'remove.bg',
    free: false,
    t: { en: ['AI background removal', 'remove.bg needs a key per image. The timeline’s chroma-key + blur runs locally instead.'],
         hi: ['AI background removal', 'remove.bg ko key chahiye. Timeline ka chroma-key + blur locally chalta hai.'] },
    offline: '../audio-video/#timelinepro',
  },
  {
    id: 'stt-pro',
    cat: 'blocked',
    host: 'assemblyai.com',
    free: false,
    t: { en: ['Accurate transcription', 'Best-in-class speech-to-text is a paid API. The built-in Speech to Text uses your browser’s engine.'],
         hi: ['Accurate transcription', 'Sabse accha speech-to-text paid API hai. Built-in Speech to Text browser engine use karta hai.'] },
    offline: '../audio-video/#stt',
  },
];

const OB_CATS = {
  text: { en: 'Text & translation', hi: 'Text aur translation' },
  media: { en: 'Images & assets', hi: 'Images aur assets' },
  data: { en: 'Live data', hi: 'Live data' },
  blocked: { en: 'Needs a paid key (not included)', hi: 'Paid key chahiye (shaamil nahi)' },
};

/* --------------------------------------------------------------- UI plumbing */

/* One standard card: title, description, the host it contacts, and a body. */
function obCard(tool, bodyHtml, opts) {
  const lang = OBLang.get();
  const [title, desc] = tool.t[lang] || tool.t.en;
  const free = tool.free !== false;
  const wrap = document.createElement('section');
  wrap.className = 'ob-card' + (free ? '' : ' blocked');
  wrap.id = 'ob-' + tool.id;
  wrap.innerHTML = `
    <header class="ob-card-h">
      <div>
        <h2>${OBDom.esc(title)}</h2>
        <p class="ob-desc">${OBDom.esc(desc)}</p>
      </div>
      <span class="ob-pill ${free ? 'free' : 'keyed'}">${free ? OBLang.t('online.free.short') : OBLang.t('online.keyed')}</span>
    </header>
    <p class="ob-host"><b>${OBLang.t('online.host')}:</b> <code>${OBDom.esc(tool.host)}</code></p>
    <div class="ob-body">${bodyHtml}</div>`;
  if (tool.offline) {
    wrap.innerHTML += `<p class="ob-offline"><a href="${tool.offline}">${OBLang.t('common.back')} →</a></p>`;
  }
  return wrap;
}

/* small status line used by every async tool */
function obStatus(node) {
  return {
    set(msg, kind) {
      node.textContent = msg || '';
      node.className = 'ob-status' + (kind ? ' ' + kind : '');
    },
    clear() { node.textContent = ''; node.className = 'ob-status'; },
  };
}

/* wire a button to an async action with disabled state + error surfacing */
function obAction(btn, status, fn) {
  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    status.clear();
    try { await fn(); }
    catch (e) {
      status.set(e.message || OBLang.t('online.failed'), 'bad');
    } finally { btn.disabled = false; }
  });
}

/* ------------------------------------------------------------- the tools */

const OB_RUN = {};

/* ---- translate ---------------------------------------------------------- */
OB_RUN.translate = function (body, tool) {
  body.innerHTML = `
    <div class="ob-row">
      <textarea class="ob-inp" id="trIn" rows="3" placeholder="Hello, how are you?"></textarea>
    </div>
    <div class="ob-row ob-inline">
      <select class="ob-inp" id="trFrom"></select>
      <span class="ob-arrow">→</span>
      <select class="ob-inp" id="trTo"></select>
      <button class="ob-btn primary" id="trGo">${OBLang.t('common.search')}</button>
    </div>
    <p class="ob-status" id="trSt"></p>
    <div class="ob-out" id="trOut"></div>`;
  const langs = [['en', 'English'], ['hi', 'Hindi'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['ar', 'Arabic'], ['zh-CN', 'Chinese'], ['ja', 'Japanese'], ['pt', 'Portuguese'], ['ru', 'Russian'], ['bn', 'Bengali'], ['ta', 'Tamil'], ['te', 'Telugu'], ['mr', 'Marathi'], ['gu', 'Gujarati'], ['pa', 'Punjabi'], ['ur', 'Urdu']];
  const from = body.querySelector('#trFrom'), to = body.querySelector('#trTo');
  for (const [code, name] of langs) {
    from.appendChild(OBDom.el('option', { value: code }, name));
    to.appendChild(OBDom.el('option', { value: code }, name));
  }
  to.value = 'hi';
  const st = obStatus(body.querySelector('#trSt'));
  const out = body.querySelector('#trOut');

  obAction(body.querySelector('#trGo'), st, async () => {
    const q = body.querySelector('#trIn').value.trim();
    if (!q) { st.set(OBLang.t('online.empty'), 'bad'); return; }
    if (q.length > 500) { st.set('Keep it under 500 characters — the free tier is limited.', 'bad'); return; }
    const pair = `${from.value}|${to.value}`;
    st.set(OBLang.t('online.loading'));
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${encodeURIComponent(pair)}`;
    const { data, cached } = await OBNet.cached(`tr:${pair}:${q}`, 1000 * 60 * 60 * 24, async () => {
      const r = await OBNet.request(url);
      const d = r.data;
      if (!d || !d.responseData) throw new Error('Unexpected reply from the translation service.');
      if (d.responseStatus && +d.responseStatus !== 200) throw new Error(d.responseDetails || 'Translation failed.');
      return d.responseData.translatedText || '';
    });
    out.textContent = data;
    st.set((cached ? OBLang.t('online.cached') : 'ok') + ' · ' + tool.host, 'ok');
    const bar = OBDom.el('div', { class: 'ob-row ob-inline' });
    const cpy = OBDom.el('button', { class: 'ob-btn' }, OBLang.t('common.copy'));
    cpy.onclick = async () => { await OBDom.copy(data); OBDom.toast(OBLang.t('common.copied')); };
    bar.appendChild(cpy);
    out.appendChild(bar);
  });
};

/* ---- dictionary -------------------------------------------------------- */
OB_RUN.dictionary = function (body, tool) {
  body.innerHTML = `
    <div class="ob-row ob-inline">
      <input class="ob-inp" id="dcIn" placeholder="serendipity">
      <button class="ob-btn primary" id="dcGo">${OBLang.t('common.search')}</button>
    </div>
    <p class="ob-status" id="dcSt"></p>
    <div class="ob-out" id="dcOut"></div>`;
  const st = obStatus(body.querySelector('#dcSt')), out = body.querySelector('#dcOut');
  const go = async () => {
    const w = body.querySelector('#dcIn').value.trim();
    if (!w) return;
    st.set(OBLang.t('online.loading'));
    out.innerHTML = '';
    const { data } = await OBNet.cached(`dc:${w.toLowerCase()}`, 1000 * 60 * 60 * 24 * 7, async () => {
      const r = await OBNet.request(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);
      return r.data;
    });
    if (!Array.isArray(data) || !data.length) { st.set(OBLang.t('online.empty'), 'bad'); return; }
    for (const entry of data.slice(0, 3)) {
      const h = OBDom.el('div', { class: 'ob-entry' });
      const phon = (entry.phonetics || []).find(p => p.text) || {};
      h.appendChild(OBDom.el('h3', {}, entry.word + (phon.text ? '  ' + phon.text : '')));
      const audio = (entry.phonetics || []).find(p => p.audio);
      if (audio) {
        const a = OBDom.el('button', { class: 'ob-btn small' }, '🔊');
        a.onclick = () => { try { new Audio(audio.audio).play(); } catch (e) {} };
        h.appendChild(a);
      }
      for (const m of (entry.meanings || []).slice(0, 4)) {
        const li = OBDom.el('p', { class: 'ob-def' });
        li.innerHTML = `<i>${OBDom.esc(m.partOfSpeech || '')}</i> — ${OBDom.esc((m.definitions && m.definitions[0] && m.definitions[0].definition) || '')}`;
        h.appendChild(li);
        const ex = m.definitions && m.definitions[0] && m.definitions[0].example;
        if (ex) h.appendChild(OBDom.el('p', { class: 'ob-ex' }, '“' + ex + '”'));
      }
      out.appendChild(h);
    }
    st.set(tool.host, 'ok');
  };
  obAction(body.querySelector('#dcGo'), st, go);
  body.querySelector('#dcIn').addEventListener('keydown', e => { if (e.key === 'Enter') body.querySelector('#dcGo').click(); });
};

/* ---- wikipedia --------------------------------------------------------- */
OB_RUN.wiki = function (body, tool) {
  body.innerHTML = `
    <div class="ob-row ob-inline">
      <input class="ob-inp" id="wkIn" placeholder="Barcelona">
      <button class="ob-btn primary" id="wkGo">${OBLang.t('common.search')}</button>
    </div>
    <p class="ob-status" id="wkSt"></p>
    <div class="ob-out" id="wkOut"></div>`;
  const st = obStatus(body.querySelector('#wkSt')), out = body.querySelector('#wkOut');
  obAction(body.querySelector('#wkGo'), st, async () => {
    const q = body.querySelector('#wkIn').value.trim();
    if (!q) return;
    st.set(OBLang.t('online.loading'));
    out.innerHTML = '';
    const lang = OBLang.get() === 'hi' ? 'hi' : 'en';
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=5&prop=extracts|pageimages&exintro=1&explaintext=1&exsentences=3&piprop=thumbnail&pithumbsize=320&format=json&origin=*`;
    const { data } = await OBNet.cached(`wk:${lang}:${q}`, 1000 * 60 * 60, async () => (await OBNet.request(url)).data);
    const pages = data && data.query && data.query.pages;
    if (!pages) { st.set(OBLang.t('online.empty'), 'bad'); return; }
    Object.values(pages).sort((a, b) => (a.index || 0) - (b.index || 0)).forEach(p => {
      const card = OBDom.el('div', { class: 'ob-entry' });
      const h = OBDom.el('h3');
      h.innerHTML = `<a href="https://${lang}.wikipedia.org/?curid=${p.pageid}" target="_blank" rel="noopener noreferrer">${OBDom.esc(p.title)}</a>`;
      card.appendChild(h);
      if (p.thumbnail && p.thumbnail.source) {
        const img = OBDom.el('img', { src: p.thumbnail.source, alt: '', loading: 'lazy', class: 'ob-thumb' });
        card.appendChild(img);
      }
      if (p.extract) card.appendChild(OBDom.el('p', { class: 'ob-def' }, p.extract));
      out.appendChild(card);
    });
    st.set(tool.host, 'ok');
  });
};

/* ---- subtitle file translation ---------------------------------------- */
OB_RUN.subsTranslate = function (body, tool) {
  body.innerHTML = `
    <div class="ob-row ob-inline">
      <input type="file" class="ob-inp" id="sbFile" accept=".srt,.vtt,text/plain">
      <select class="ob-inp" id="sbTo"></select>
      <button class="ob-btn primary" id="sbGo">Translate</button>
    </div>
    <p class="ob-status" id="sbSt"></p>
    <div class="ob-out" id="sbOut"></div>`;
  const to = body.querySelector('#sbTo');
  [['hi', 'Hindi'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['ar', 'Arabic'], ['bn', 'Bengali'], ['ta', 'Tamil'], ['te', 'Telugu']]
    .forEach(([c, n]) => to.appendChild(OBDom.el('option', { value: c }, n)));
  const st = obStatus(body.querySelector('#sbSt')), out = body.querySelector('#sbOut');

  obAction(body.querySelector('#sbGo'), st, async () => {
    const file = body.querySelector('#sbFile').files[0];
    if (!file) { st.set('Choose an .srt or .vtt file first.', 'bad'); return; }
    const text = await file.text();
    const cues = obParseSrt(text);
    if (!cues.length) { st.set('No cues found — is this a valid .srt/.vtt?', 'bad'); return; }
    if (cues.length > 120) { st.set(`That is ${cues.length} cues. The free tier only allows about 1,000 words a day — split the file first.`, 'bad'); return; }
    const from = /[\u0900-\u097F]/.test(text) ? 'hi' : 'en';
    let done = 0;
    out.innerHTML = '';
    const log = OBDom.el('div', { class: 'ob-log' });
    out.appendChild(log);
    for (const c of cues) {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(c.text.slice(0, 480))}&langpair=${from}|${to.value}`;
      try {
        const r = await OBNet.request(url, { timeout: 15000 });
        const d = r.data;
        if (d && d.responseData && d.responseData.translatedText) c.out = d.responseData.translatedText;
        else c.out = c.text;
      } catch (e) {
        c.out = c.text;                       /* keep the original rather than dropping a cue */
        log.appendChild(OBDom.el('p', { class: 'ob-ex' }, `cue ${c.n}: ${e.message}`));
      }
      done++;
      st.set(`${done} / ${cues.length}`);
    }
    const srt = obBuildSrt(cues);
    const prev = OBDom.el('pre', { class: 'ob-pre' }, srt.slice(0, 4000) + (srt.length > 4000 ? '\n…' : ''));
    out.insertBefore(prev, log);
    const bar = OBDom.el('div', { class: 'ob-row ob-inline' });
    const dl = OBDom.el('button', { class: 'ob-btn primary' }, OBLang.t('common.download') + ' .srt');
    dl.onclick = () => OBDom.download(file.name.replace(/\.(srt|vtt)$/i, '') + '-' + to.value + '.srt', srt);
    bar.appendChild(dl);
    out.insertBefore(bar, log);
    st.set(`${cues.length} cues → ${to.value}`, 'ok');
  });
};

/* parse both SRT and WebVTT into {n, start, end, text, out} */
function obParseSrt(txt) {
  const cues = [];
  const blocks = String(txt).replace(/\r/g, '').split(/\n{2,}/);
  for (const b of blocks) {
    const lines = b.trim().split('\n').filter(Boolean);
    if (!lines.length) continue;
    const ti = lines.findIndex(l => /-->/.test(l));
    if (ti < 0) continue;
    const m = lines[ti].match(/(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/);
    if (!m) continue;
    const text = lines.slice(ti + 1).join(' ').trim();
    if (!text) continue;
    cues.push({
      n: cues.length + 1, start: lines[ti].split('-->')[0].trim(), end: lines[ti].split('-->')[1].trim(),
      text, out: '',
    });
  }
  return cues;
}
function obBuildSrt(cues) {
  return cues.map((c, i) => `${i + 1}\n${c.start} --> ${c.end}\n${c.out || c.text}`).join('\n\n') + '\n';
}

/* ---- stock images ------------------------------------------------------ */
OB_RUN.stockImage = function (body, tool) {
  body.innerHTML = `
    <div class="ob-row ob-inline">
      <input class="ob-inp" id="siIn" placeholder="mountain sunrise">
      <button class="ob-btn primary" id="siGo">${OBLang.t('common.search')}</button>
    </div>
    <p class="ob-status" id="siSt"></p>
    <div class="ob-grid" id="siOut"></div>`;
  const st = obStatus(body.querySelector('#siSt')), out = body.querySelector('#siOut');
  obAction(body.querySelector('#siGo'), st, async () => {
    const q = body.querySelector('#siIn').value.trim();
    if (!q) return;
    st.set(OBLang.t('online.loading'));
    out.innerHTML = '';
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&gsrlimit=18&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&format=json&origin=*`;
    const { data } = await OBNet.cached(`si:${q}`, 1000 * 60 * 30, async () => (await OBNet.request(url)).data);
    const pages = data && data.query && data.query.pages;
    if (!pages) { st.set(OBLang.t('online.empty'), 'bad'); return; }
    let n = 0;
    Object.values(pages).forEach(p => {
      const ii = p.imageinfo && p.imageinfo[0];
      if (!ii) return;
      const src = ii.thumburl || ii.url;
      const lic = (ii.extmetadata && ii.extmetadata.LicenseShortName && ii.extmetadata.LicenseShortName.value) || 'see file page';
      const card = OBDom.el('figure', { class: 'ob-shot' });
      const img = OBDom.el('img', { src, alt: p.title, loading: 'lazy' });
      card.appendChild(img);
      const cap = OBDom.el('figcaption');
      cap.innerHTML = `<span>${OBDom.esc(lic)}</span>`;
      const dl = OBDom.el('button', { class: 'ob-btn small' }, '⬇');
      dl.onclick = async () => {
        try {
          const r = await OBNet.request(src, { as: 'blob', timeout: 25000 });
          const u = URL.createObjectURL(r.data);
          const a = document.createElement('a');
          a.href = u; a.download = (p.title || 'image').replace(/^File:/, '').replace(/[^\w.-]+/g, '_');
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(u), 5000);
        } catch (e) { OBDom.toast(e.message, true); }
      };
      cap.appendChild(dl);
      card.appendChild(cap);
      out.appendChild(card);
      n++;
    });
    st.set(n ? `${n} ${OBLang.t('common.results')} · ${tool.host}` : OBLang.t('online.empty'), n ? 'ok' : 'bad');
  });
};

/* ---- emoji (bundled, works offline) ----------------------------------- */
OB_RUN.emoji = function (body) {
  const groups = {
    'Smileys': '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 💩 🤡 👹 👺 👻 👽 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾',
    'Hearts': '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ 💌 💋',
    'Hands': '👋 🤚 🖐 ✋ 🖖 👌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 💪 🦾 🖕 ✍️',
    'Clips & media': '🎬 🎥 📹 📷 🎞 📽 🔊 🔉 🔈 🎤 🎧 🎼 🎵 🎶 🎹 🥁 🎸 🎻 🎺 📺 📻 ⏯ ⏸ ⏹ ⏺ ⏭ ⏮ ⏩ ⏪ 🔀 🔁 🔂',
    'Objects & symbols': '🔥 ✨ 💫 ⚡ 💥 💯 ✅ ❌ ⭐ 🌟 💡 📌 📍 🏆 🎯 🚀 🎉 🎊 🎈 🎁 💎 🧠 👀 💬 💭 ⌛ ⏳ 🕐 📅 📈 📉 💰 🛒 🔒 🔓 📶 🔋 💻 🖥 ⌨️ 🖱 💾',
  };
  body.innerHTML = `
    <div class="ob-row ob-inline">
      <input class="ob-inp" id="emIn" placeholder="search: heart, video, star">
      ${Object.keys(groups).map(g => `<button class="ob-btn small" data-g="${g}">${g}</button>`).join('')}
    </div>
    <p class="ob-status" id="emSt"></p>
    <div class="ob-emoji" id="emOut"></div>`;
  const st = obStatus(body.querySelector('#emSt')), out = body.querySelector('#emOut');
  const all = Object.values(groups).join(' ').split(/\s+/).filter(Boolean);
  function paint(list) {
    out.innerHTML = '';
    list.forEach(ch => {
      const b = OBDom.el('button', { class: 'ob-emoji-b', title: 'Copy' }, ch);
      b.onclick = async () => { await OBDom.copy(ch); OBDom.toast(OBLang.t('common.copied') + ' ' + ch); };
      out.appendChild(b);
    });
    st.set(`${list.length} emoji`, 'ok');
  }
  paint(all);
  body.querySelectorAll('[data-g]').forEach(b => b.onclick = () => paint(groups[b.getAttribute('data-g')].split(/\s+/).filter(Boolean)));
  body.querySelector('#emIn').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) return paint(all);
    const hits = all.filter((ch) => {
      try { return ch.toLowerCase().includes(q) || ch.includes(q); } catch (err) { return false; }
    });
    paint(hits.length ? hits : all);
  });
  st.set('Bundled — no request leaves the page.', 'ok');
};

/* ---- currency ---------------------------------------------------------- */
OB_RUN.currency = function (body, tool) {
  body.innerHTML = `
    <div class="ob-row ob-inline">
      <input class="ob-inp" id="cuAmt" type="number" value="100" min="0" step="any" style="max-width:120px">
      <select class="ob-inp" id="cuFrom"></select>
      <span class="ob-arrow">→</span>
      <select class="ob-inp" id="cuTo"></select>
      <button class="ob-btn primary" id="cuGo">${OBLang.t('common.search')}</button>
    </div>
    <p class="ob-status" id="cuSt"></p>
    <div class="ob-out" id="cuOut"></div>`;
  const st = obStatus(body.querySelector('#cuSt')), out = body.querySelector('#cuOut');
  const from = body.querySelector('#cuFrom'), to = body.querySelector('#cuTo');
  obAction(body.querySelector('#cuGo'), st, async () => {
    st.set(OBLang.t('online.loading'));
    const { data, cached } = await OBNet.cached('fx:latest', 1000 * 60 * 60 * 6, async () => {
      const r = await OBNet.request('https://open.er-api.com/v6/latest/USD');
      if (!r.data || !r.data.rates) throw new Error('The rate feed did not return any currencies.');
      return r.data;
    });
    if (!from.options.length) {
      const codes = Object.keys(data.rates).sort();
      codes.forEach(c => { from.appendChild(OBDom.el('option', { value: c }, c)); to.appendChild(OBDom.el('option', { value: c }, c)); });
      from.value = 'USD'; to.value = 'INR';
    }
    const amt = Number(body.querySelector('#cuAmt').value) || 0;
    const rate = data.rates[to.value] / data.rates[from.value];
    const val = amt * rate;
    out.innerHTML = `<div class="ob-big">${val.toLocaleString(undefined, { maximumFractionDigits: 2 })} <b>${OBDom.esc(to.value)}</b></div>
      <p class="ob-ex">1 ${OBDom.esc(from.value)} = ${rate.toFixed(4)} ${OBDom.esc(to.value)} · ${cached ? OBLang.t('online.cached') : 'live'} · ${OBDom.esc(data.time_last_update_utc || '')}</p>`;
    st.set(tool.host, 'ok');
  });
};

/* ---- weather ----------------------------------------------------------- */
OB_RUN.weather = function (body, tool) {
  body.innerHTML = `
    <div class="ob-row ob-inline">
      <input class="ob-inp" id="weIn" placeholder="Lucknow">
      <button class="ob-btn primary" id="weGo">${OBLang.t('common.search')}</button>
    </div>
    <p class="ob-status" id="weSt"></p>
    <div class="ob-out" id="weOut"></div>`;
  const st = obStatus(body.querySelector('#weSt')), out = body.querySelector('#weOut');
  obAction(body.querySelector('#weGo'), st, async () => {
    const q = body.querySelector('#weIn').value.trim();
    if (!q) return;
    st.set(OBLang.t('online.loading'));
    out.innerHTML = '';
    const geo = await OBNet.cached(`geo:${q}`, 1000 * 60 * 60 * 24, async () => {
      const r = await OBNet.request(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`);
      const list = r.data && r.data.results;
      if (!list || !list.length) throw new Error(`No place called “${q}” was found.`);
      return list[0];
    });
    const g = geo.value;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=7`;
    const { data } = await OBNet.request(url);
    const cur = data.current || {};
    const weatherWord = code => {
      const map = { 0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Freezing fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Heavy showers', 95: 'Thunderstorm', 96: 'Thunderstorm + hail', 99: 'Severe thunderstorm' };
      return map[code] || '—';
    };
    out.innerHTML = `<div class="ob-big">${Math.round(cur.temperature_2m)}°C</div>
      <p class="ob-def">${OBDom.esc(g.name)}${g.country ? ', ' + OBDom.esc(g.country) : ''} — ${OBDom.esc(weatherWord(cur.weather_code))}</p>
      <p class="ob-ex">Humidity ${cur.relative_humidity_2m ?? '—'}% · Wind ${cur.wind_speed_10m ?? '—'} km/h</p>`;
    const d = data.daily || {};
    if (d.time) {
      const row = OBDom.el('div', { class: 'ob-week' });
      d.time.forEach((day, i) => {
        row.appendChild(OBDom.el('div', { class: 'ob-day' },
          `${day.slice(5)}|${Math.round(d.temperature_2m_max[i])}° / ${Math.round(d.temperature_2m_min[i])}°|${weatherWord(d.weather_code[i])}`));
      });
      out.appendChild(row);
    }
    st.set(tool.host, 'ok');
  });
};

/* ---- ip ----------------------------------------------------------------- */
OB_RUN.ip = function (body, tool) {
  body.innerHTML = `
    <div class="ob-row ob-inline"><button class="ob-btn primary" id="ipGo">Look up my IP</button></div>
    <p class="ob-status" id="ipSt"></p>
    <div class="ob-out" id="ipOut"></div>`;
  const st = obStatus(body.querySelector('#ipSt')), out = body.querySelector('#ipOut');
  obAction(body.querySelector('#ipGo'), st, async () => {
    st.set(OBLang.t('online.loading'));
    const { data } = await OBNet.request('https://ipapi.co/json/');
    if (!data || !data.ip) throw new Error('That service did not return an address.');
    out.innerHTML = `<div class="ob-big">${OBDom.esc(data.ip)}</div>
      <p class="ob-def">${OBDom.esc([data.city, data.region, data.country_name].filter(Boolean).join(', '))}</p>
      <p class="ob-ex">Network: ${OBDom.esc(data.org || '—')} · ${OBDom.esc(data.timezone || '')}</p>`;
    st.set(tool.host, 'ok');
  });
};

/* ---- qr ----------------------------------------------------------------- */
OB_RUN.qr = function (body, tool) {
  body.innerHTML = `
    <div class="ob-row"><input class="ob-inp" id="qrIn" placeholder="https://example.com"></div>
    <div class="ob-row ob-inline">
      <input class="ob-inp" id="qrPx" type="number" value="320" min="80" max="1000" step="20" style="max-width:110px">
      <button class="ob-btn primary" id="qrGo">Make QR</button>
    </div>
    <p class="ob-status" id="qrSt"></p>
    <div class="ob-out ob-center" id="qrOut"></div>`;
  const st = obStatus(body.querySelector('#qrSt')), out = body.querySelector('#qrOut');
  obAction(body.querySelector('#qrGo'), st, async () => {
    const v = body.querySelector('#qrIn').value.trim();
    if (!v) { st.set('Type a link or some text first.', 'bad'); return; }
    const px = Math.max(80, Math.min(1000, Number(body.querySelector('#qrPx').value) || 320));
    st.set(OBLang.t('online.loading'));
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${px}x${px}&data=${encodeURIComponent(v)}`;
    const r = await OBNet.request(url, { as: 'blob', timeout: 15000 });
    const u = URL.createObjectURL(r.data);
    out.innerHTML = '';
    const img = OBDom.el('img', { src: u, alt: 'QR code', class: 'ob-qr' });
    out.appendChild(img);
    const dl = OBDom.el('button', { class: 'ob-btn primary' }, OBLang.t('common.download') + ' PNG');
    dl.onclick = () => {
      const a = document.createElement('a');
      a.href = u; a.download = 'qr.png';
      document.body.appendChild(a); a.click(); a.remove();
    };
    out.appendChild(dl);
    st.set(tool.host, 'ok');
  });
};

/* --------------------------------------------------------------- page boot */
function obMount(id) {
  const card = document.querySelector('#ob-' + id);
  if (!card) return;
  const tool = OB_TOOLS.find(t => t.id === id);
  const body = card.querySelector('.ob-body');
  if (!tool || !body) return;
  if (tool.free === false) { body.innerHTML = `<p class="ob-def">${OBLang.t('online.none')}</p>`; return; }
  const runner = OB_RUN[tool.run];
  if (runner) { try { runner(body, tool); } catch (e) { body.innerHTML = `<p class="ob-status bad">${OBDom.esc(e.message)}</p>`; } }
}

/* exported for the page and for node tests */
if (typeof window !== 'undefined') {
  window.OB_TOOLS = OB_TOOLS;
  window.OB_RUN = OB_RUN;
  window.obMount = obMount;
  window.obParseSrt = obParseSrt;
  window.obBuildSrt = obBuildSrt;
  window.obCard = obCard;
  window.OB_CATS = OB_CATS;
  document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('ob-grid');
    if (!grid) return;                       /* not the online page */
    const chips = document.getElementById('ob-chips');
    const draw = (cat) => {
      grid.innerHTML = '';
      OB_TOOLS.filter(t => !cat || t.cat === cat).forEach(t => {
        const c = obCard(t, '');
        grid.appendChild(c);
        if (t.free !== false) obMount(t.id);
        else obMount(t.id);
      });
      OBLang.apply(grid);
    };
    Object.entries(OB_CATS).forEach(([k, names]) => {
      const b = OBDom.el('button', { class: 'ob-chip', 'data-cat': k }, names[OBLang.get()] || names.en);
      b.onclick = () => {
        chips.querySelectorAll('.ob-chip').forEach(c => c.classList.toggle('on', c === b));
        draw(k);
      };
      chips.appendChild(b);
    });
    const allBtn = OBDom.el('button', { class: 'ob-chip on', 'data-cat': '' }, OBLang.t('common.all'));
    allBtn.onclick = () => {
      chips.querySelectorAll('.ob-chip').forEach(c => c.classList.toggle('on', c === allBtn));
      draw('');
    };
    chips.insertBefore(allBtn, chips.firstChild);
    draw('');
    window.addEventListener('ob:lang', () => {
      const active = chips.querySelector('.ob-chip.on');
      draw(active ? active.getAttribute('data-cat') : '');
      chips.querySelectorAll('.ob-chip').forEach(c => {
        const k = c.getAttribute('data-cat');
        c.textContent = k ? (OB_CATS[k][OBLang.get()] || OB_CATS[k].en) : OBLang.t('common.all');
      });
    });
  });
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OB_TOOLS, OB_RUN, obParseSrt, obBuildSrt, OB_CATS };
}
