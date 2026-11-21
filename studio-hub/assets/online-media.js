/* ============================================================================
   online-media.js — live-media integrations for the existing studios
   ----------------------------------------------------------------------------
   Loaded ONLY when the user opens one of these panels. The studios keep working
   if this file is absent, blocked, or offline: every entry point checks first.

   Design constraints, deliberately strict:

   • The file never runs code from a third party. Images are downloaded as blobs
     via fetch (not <script>, not remote <img> with tracking params) and handed
     to the studio as a File, so the existing local pipeline does the work.
   • Every call goes through OBNet (timeout, no credentials, no referrer).
   • No keys. If a service would need one, it is not here.
   • The only hosts contacted are the ones this file names in HOSTS, and the
     panel prints them.
   ========================================================================== */
'use strict';

(function () {
  const HOSTS = {
    translate: 'api.mymemory.translated.net',
    commons: 'commons.wikimedia.org',
  };

  /* --- a tiny toast that works inside audio-video too -------------------- */
  function say(msg, bad) {
    if (window.OBDom && window.OBDom.toast) return window.OBDom.toast(msg, bad);
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#0f172a;color:#e0f2fe;border:1px solid ' +
      (bad ? '#f87171' : '#22d3ee') + ';padding:10px 16px;border-radius:11px;font:13px system-ui;z-index:99999;max-width:86vw';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  /* ------------------------------------------------------------ images */
  /* Search Wikimedia Commons and hand back [{title, url, thumb, license}].
     Pure data: the caller decides what to do with it. */
  async function searchImages(query, limit) {
    const n = Math.max(1, Math.min(30, limit || 12));
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search' +
      '&gsrsearch=' + encodeURIComponent(query) + '&gsrnamespace=6&gsrlimit=' + n +
      '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&format=json&origin=*';
    const r = await OBNet.request(url);
    const pages = r.data && r.data.query && r.data.query.pages;
    if (!pages) return [];
    return Object.values(pages).map(p => {
      const ii = (p.imageinfo && p.imageinfo[0]) || {};
      const meta = ii.extmetadata || {};
      return {
        title: String(p.title || '').replace(/^File:/, ''),
        url: ii.url || '',
        thumb: ii.thumburl || ii.url || '',
        page: p.pageid ? 'https://commons.wikimedia.org/?curid=' + p.pageid : '',
        license: (meta.LicenseShortName && meta.LicenseShortName.value) || 'see file page',
        author: (meta.Artist && String(meta.Artist.value).replace(/<[^>]+>/g, '').trim()) || '',
      };
    }).filter(x => x.thumb);
  }

  /* fetch an image and return a File the studio can drop in like a local one */
  async function imageAsFile(hit) {
    if (!hit || !hit.url) throw new Error('That image has no file URL.');
    const r = await OBNet.request(hit.url, { as: 'blob', timeout: 30000 });
    let name = hit.title.replace(/[^\w.\-]+/g, '_') || 'image';
    if (!/\.(jpe?g|png|gif|webp|svg)$/i.test(name)) name += '.jpg';
    return new File([r.data], name, { type: r.data.type || 'image/jpeg' });
  }

  /* -------------------------------------------------------- translation */
  /* Translate a plain string. Returns the translated text. */
  async function translate(text, from, to) {
    const q = String(text || '').slice(0, 480);
    if (!q.trim()) return '';
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(q) +
      '&langpair=' + encodeURIComponent((from || 'en') + '|' + (to || 'hi'));
    const r = await OBNet.request(url, { timeout: 15000 });
    const d = r.data || {};
    if (d.responseStatus && Number(d.responseStatus) !== 200) {
      throw new Error(d.responseDetails || 'The translation service refused that request.');
    }
    return (d.responseData && d.responseData.translatedText) || '';
  }

  /* translate every cue of an SRT string, keeping timings byte-identical */
  async function translateSrt(srt, from, to, onProgress) {
    const cues = parseSrt(srt);
    if (!cues.length) throw new Error('No cues found — is this a valid .srt file?');
    if (cues.length > 100) {
      throw new Error('That file has ' + cues.length + ' cues. The free tier allows about 1,000 words a day — split it first.');
    }
    const out = [];
    for (let i = 0; i < cues.length; i++) {
      const c = cues[i];
      let text = c.text;
      try { text = (await translate(c.text, from, to)) || c.text; }
      catch (e) { /* keep the original line rather than dropping a cue */ }
      out.push({ start: c.start, end: c.end, text });
      if (onProgress) onProgress((i + 1) / cues.length);
    }
    return buildSrt(out);
  }

  /* ------- SRT parse/format: same shapes as audio-video's importer ------ */
  function parseSrt(txt) {
    const cues = [];
    for (const block of String(txt || '').replace(/\r/g, '').split(/\n{2,}/)) {
      const lines = block.trim().split('\n').filter(Boolean);
      if (!lines.length) continue;
      const ti = lines.findIndex(l => l.includes('-->'));
      if (ti < 0) continue;
      const m = lines[ti].match(/(\d+:\d+:\d+[,.]\d+)\s*-->\s*(\d+:\d+:\d+[,.]\d+)/);
      if (!m) continue;
      const text = lines.slice(ti + 1).join(' ').trim();
      if (text) cues.push({ start: m[1], end: m[2], text });
    }
    return cues;
  }
  function buildSrt(cues) {
    return cues.map((c, i) => (i + 1) + '\n' + c.start + ' --> ' + c.end + '\n' + c.text).join('\n\n') + '\n';
  }

  window.OBMedia = {
    HOSTS: HOSTS,
    searchImages: searchImages,
    imageAsFile: imageAsFile,
    translate: translate,
    translateSrt: translateSrt,
    parseSrt: parseSrt,
    buildSrt: buildSrt,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.OBMedia;
})();
