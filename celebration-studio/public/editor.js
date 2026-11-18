import {
  $,
  h,
  ic,
  state,
  api,
  options,
  minuteTime,
  choose,
  eventOf,
  designOf,
  designsFor,
  local,
  toast,
  showLink,
  message,
} from './shared.js';
import { chapter, wireChapter, personal } from './chapters.js';
import { preview, printCard, keepsake } from './player.js';
// Draft data is JSON. Original blobs live separately; older webviews need no structuredClone.
const cloneCard = (d) => JSON.parse(JSON.stringify(d));
const num = (n) => String(n).padStart(2, '0');
const notePage = (e) => e.pages.findIndex((p) => p.blocks.includes('message'));
const accept = { photo: 'image/jpeg,image/png,image/webp', video: 'video/mp4,video/webm' };
export class Editor {
  constructor(record, account) {
    this.r = record;
    this.d = record.data;
    this.d.language ||= 'hi';
    this.d.fields ||= {};
    this.d.gallery ||= [];
    this.d.messageAlt ||= '';
    this.e = eventOf(this.d.occasion);
    this.account = account;
    this.desk = state.pages?.workspace(record);
    this.savedText = this.desk ? 'Saved on this device' : 'Saved to your account';
    this.queue = Promise.resolve();
    this.seq = 0;
    this.saved = 0;
    this.assets = new Map();
    this.pending = new Map();
    this.active = true;
    this.uploading = false;
    this.index = 0;
  }
  get media() {
    const lookup = (id) => this.assets.get(id) || '';
    return {
      photo: lookup(this.d.photo),
      video: lookup(this.d.video),
      gallery: Object.fromEntries(this.d.gallery.map((m) => [m.id, lookup(m.id)])),
    };
  }
  field(label, id, type = 'text', extra = '') {
    return `<label class="field">${label}<input type="${type}" data-key="${id}" value="${h(this.d[id])}" ${extra}></label>`;
  }
  select(label, id, choices) {
    return `<label class="field">${label}<select data-key="${id}">${options(choices, this.d[id])}</select></label>`;
  }
  text(label, id, limit, rows = 3, placeholder = '') {
    return `<label class="field">${label}<textarea data-key="${id}" rows="${rows}" maxlength="${limit}" placeholder="${h(placeholder)}">${h(this.d[id])}</textarea></label>`;
  }
  toggle(label, id) {
    return `<label class="check-line"><input type="checkbox" data-key="${id}" ${this.d[id] ? 'checked' : ''}>${label}</label>`;
  }
  chapterField(s) {
    const v = h(this.d.fields[s.key]),
      attrs = `data-chapter-field="${s.key}" maxlength="${s.limit}"`;
    return `<label class="field"><span>${h(s.label[0])} <small lang="hi">· ${h(s.label[1])}</small></span>${['lines', 'note'].includes(s.kind) ? `<textarea ${attrs} rows="3">${v}</textarea>` : `<input ${attrs} type="${s.kind === 'time' ? 'time' : 'text'}" ${s.kind === 'age' ? 'inputmode="numeric" pattern="[0-9०-९]{1,3}"' : ''} value="${v}">`}</label>`;
  }
  pane(p, i) {
    const d = this.d,
      personLabel =
        {
          wedding: 'First partner',
          engagement: 'First partner',
          anniversary: 'First partner',
          'baby-shower': 'Mother-to-be',
          housewarming: 'Family or host',
          birthday: 'Birthday name',
        }[d.occasion] || 'Name on the invitation';
    return `<section class="chapter-pane" data-pane="${i}" ${i ? 'hidden' : ''}><div class="pane-line"><b>${num(i + 1)}</b><div><h3>${h(p.title[0])}</h3><small lang="hi">${h(p.title[1])}</small></div></div>${!i ? this.field(personLabel + ' · नाम', 'person', 'text', 'maxlength="100"') + this.field('Hosted by · आयोजक', 'host', 'text', 'maxlength="100"') : ''}${p.fields.map((f) => this.chapterField(f)).join('')}${p.blocks.includes('message') ? `${this.text('Your invitation message · आपका संदेश', 'message', 1600, 4)}<div class="suggest"><span>${ic('feather', 13)} Try a note</span><button data-note="message">हिंदी निमंत्रण</button><button data-note="alternate">खास संदेश</button><button data-note="english">English</button></div><details class="translation-note"><summary>Add a translation · दूसरी भाषा में संदेश</summary>${this.text('Same message in the other language (optional)', 'messageAlt', 1600, 3)}<p class="fine">The guest can switch languages. Your own words, names and captions are kept as written unless you provide a translation of the invitation message.</p></details>` : ''}${p.blocks.includes('gallery') ? `<button class="chapter-jump" data-to-tab="1">${ic('image', 14)} Add album photos & films ${ic('arrow', 13)}</button>` : ''}${p.blocks.includes('venue') || p.blocks.includes('schedule') ? `<button class="chapter-jump" data-to-tab="2">${ic('calendar', 14)} Set the date, schedule & directions ${ic('arrow', 13)}</button>` : ''}${p.blocks.includes('reply') ? this.toggle('Accept guest RSVPs · उपस्थिति दर्ज करें', 'rsvp') + (this.desk ? this.desk.contactFields(this) : '') : ''}${i === 0 ? `<button class="chapter-jump" data-to-tab="1">${ic('image', 14)} Add a cover photo or change the design ${ic('arrow', 13)}</button>` : ''}</section>`;
  }
  mount(root) {
    const d = this.d,
      e = this.e,
      c = state.catalog,
      designs = [...designsFor(e.id)];
    if (!designs.some((t) => t.code === d.template)) designs.push(d.design);
    root.innerHTML = `<div class="wrap editor program-editor" data-studio="${e.id}" style="--tint:${e.colors[0]};--tint-paper:${e.colors[1]}"><div class="crumb"><a href="#/">Occasions</a> / <a href="#/studio/${e.id}">${h(e.name)} studio</a> / Editor</div><div class="page-head"><div><span class="eyeline"><i></i> THE PERSONALIZATION ROOM &nbsp; / &nbsp; ${h(e.hi)}</span><h1>${h(e.name)} <em>studio.</em></h1><p>${h(e.pages[0].intro[1])} &nbsp;·&nbsp; Write the six pages of your invitation.</p></div><span id="save-state" role="status" class="status-pill"></span></div><div class="editor-grid"><section class="panel form-panel"><div class="tabbar" role="group" aria-label="Editor sections">${['Six pages', 'Design & media', 'When & where'].map((v, i) => `<button data-tab="${i}" aria-pressed="${i === 0}">${v}</button>`).join('')}</div><fieldset id="editor-fields"><div class="form-section" data-section="0"><small class="eyeline">01 / THE MANUSCRIPT</small><h2>Write your chapters</h2><div class="writing-desk">${this.select('Invitation language · भाषा', 'language', { hi: 'हिन्दी', en: 'English' })}<label class="field">Chapter to edit · पृष्ठ चुनें<select data-edit-page>${e.pages.map((p, i) => `<option value="${i}">${num(i + 1)} · ${h(local(p.title, d.language))}</option>`).join('')}</select></label></div>${e.pages.map((p, i) => this.pane(p, i)).join('')}<div class="editor-turns"><button data-step="-1">← Previous page</button><button data-step="1">Next page →</button></div></div>
 <div class="form-section" data-section="1" hidden><small class="eyeline">02 / STATIONERY & ALBUM</small><h2>Design & media</h2>${this.select(h(e.name) + ' edition', 'template', Object.fromEntries(designs.map((t) => [t.code, t.name])))}<div class="two">${this.select('Color story', 'palette', c.palettes)}${this.select('Lettering', 'font', c.fonts)}</div><div class="two">${this.select('Cinematic opening', 'opening', c.openings)}${this.select('Background music', 'music', c.music)}</div>${['photo', 'video'].map((k) => `<div class="upload-field"><label class="field">${ic(k === 'photo' ? 'image' : 'camera', 14)} ${k === 'photo' ? 'Cover portrait · JPG, PNG, WebP · 4 MB' : 'Featured film · MP4, WebM · 12 MB'}<input type="file" data-file="${k}" accept="${accept[k]}"></label><button class="text-link" data-remove="${k}" ${d[k] ? '' : 'hidden'}>Remove ${k}</button></div>`).join('')}<div class="album-editor"><span class="eyeline">THE MEMORY ALBUM</span><h3>Gallery pages</h3><p class="fine">Your cover photo and film also appear here. Add up to 8 more photos or short films, in the order guests should see them.</p><div id="album-list"></div><label class="field">Add memories · तस्वीरें या वीडियो<input type="file" multiple data-file="gallery" accept="${accept.photo},${accept.video}"></label></div>${this.desk ? this.desk.mediaControls() : '<p class="fine">Uploads stay private until you publish.</p>'}</div>
 <div class="form-section" data-section="2" hidden><small class="eyeline">03 / HOST’S NOTES</small><h2>When & where</h2><div class="two">${this.field('Date · तारीख', 'date', 'date')}${this.field('Time · IST (UTC+05:30)', 'time', 'time')}</div>${this.field('Venue · स्थान', 'venue', 'text', 'maxlength="240" placeholder="Venue name and address"')}${this.field('Google Maps link · optional', 'map', 'url', 'maxlength="500" placeholder="https://maps.app.goo.gl/…"')}${this.text('Schedule · one line per activity', 'schedule', 650, 3, '18:00 · Welcome\n19:30 · Dinner')}${this.toggle('Show a live countdown on the cover', 'countdown')}<p class="fine">RSVP is controlled on page 06. Venue and schedule appear in the chapters for this occasion.</p></div></fieldset>
 <p class="publish-note">${ic('lock', 12)} ${this.desk ? 'Drafts stay in this browser. Anyone with a guest link can read and forward that copy. After editing, share a new link; old copies cannot be changed or revoked. A printed QR opens the last shared copy.' : 'Drafts are private. Publishing shares your invitation, venue and attached files with anyone who has its link. Print/download uses this draft; a shared QR always opens the last published version.'}</p><div class="form-actions"><button class="btn plain" data-do="save">${ic('lock', 14)} Save draft</button><button class="btn primary" data-do="publish">${ic('letter')} ${this.desk ? 'Create guest link · लिंक बनाएँ' : this.r.published ? 'Update live invitation' : 'Publish invitation'}</button></div><div class="save-error" role="alert"></div></section>
 <aside class="panel preview-col"><div class="preview-top"><span><i class="dot"></i> LIVE PAGE PROOF</span><small id="design-caption"></small></div><div class="preview-frame" id="live-poster"></div><div class="proof-nav"><button data-step="-1" aria-label="Previous proof page">←</button><span id="proof-count"></span><button data-step="1" aria-label="Next proof page">→</button></div><div class="preview-foot"><button class="btn plain" data-do="play">${ic('play', 14)} Play invitation</button><button class="text-link" data-do="pdf">Print / PDF</button><button class="text-link" data-do="card">${ic('download', 14)} Card</button></div></aside></div></div>`;
    this.el = root.firstElementChild;
    this.$ = (s) => $(s, this.el);
    this.paint();
    this.paintGallery();
    this.status(
      this.r.id
        ? this.savedText
        : this.desk
          ? 'Device draft · no account'
          : state.user
            ? 'New draft'
            : 'Visitor preview · Sign in to save',
    );
    this.el.onclick = (ev) => {
      const b = ev.target.closest('button');
      if (!b || b.disabled) return;
      const k = b.dataset;
      if ('tab' in k || 'toTab' in k) this.tab(Number(k.tab ?? k.toTab));
      if ('step' in k) this.page(this.index + Number(k.step));
      if (k.note) {
        const value = k.note === 'english' ? e.englishMessage : e[k.note];
        d.message = value;
        d.messageAlt = '';
        d.language = k.note === 'english' ? 'en' : 'hi';
        for (const key of ['language', 'message', 'messageAlt'])
          this.$(`[data-key="${key}"]`).value = d[key];
        this.changed();
      }
      if (k.remove) {
        const key = k.remove;
        this.forget(d[key]);
        d[key] = '';
        this.changed();
      }
      if ('addUrl' in k) this.desk.promptMedia(this);
      if (k.albumAction) this.albumAction(k.albumAction, Number(k.index));
      if (k.do) this.action(k.do).catch((err) => this.err(err));
    };
    const change = (ev) => {
      const el = ev.target,
        k = el.dataset,
        fromChange = ev.type === 'change';
      if (k.file) {
        if (fromChange && el.files.length) {
          const files = [...el.files];
          this.account(() => this.addFiles(k.file, files));
          el.value = '';
        }
        return;
      }
      if ('editPage' in k) {
        if (fromChange) this.page(Number(el.value));
        return;
      }
      // Some keyboards/autofill commit text with just `change`. Handle either event;
      // equality checks below avoid a second save when both are delivered.
      el.setCustomValidity?.('');
      if (k.key) {
        const key = k.key,
          val =
            el.type === 'checkbox'
              ? el.checked
              : el.type === 'time'
                ? minuteTime(el.value)
                : el.value;
        if (d[key] === val) return;
        if (key === 'language' && d.language !== val) {
          const old = d.message;
          d.message = personal(d, val);
          if (d.messageAlt) d.messageAlt = old;
          this.$('[data-key="message"]').value = d.message;
          this.$('[data-key="messageAlt"]').value = d.messageAlt;
        }
        d[key] = val;
        if (key === 'template') {
          d.design = designOf(val) || d.design;
          for (const key of ['palette', 'opening']) {
            d[key] = d.design[key];
            this.$(`[data-key="${key}"]`).value = d[key];
          }
        }
      } else if (k.chapterField) {
        const val = el.type === 'time' ? minuteTime(el.value) : el.value;
        if (val === (d.fields[k.chapterField] || '')) return;
        d.fields[k.chapterField] = val;
      } else if (k.caption) {
        const m = d.gallery.find((m) => m.id === k.caption);
        if (m.caption === el.value) return;
        m.caption = el.value;
      } else return;
      this.changed();
    };
    this.el.oninput = change;
    this.el.onchange = change;
    this.readyMedia().catch((err) => this.err(err));
  }
  tab(i) {
    this.el
      .querySelectorAll('[data-section]')
      .forEach((s) => (s.hidden = Number(s.dataset.section) !== i));
    this.el
      .querySelectorAll('[data-tab]')
      .forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.tab) === i)));
  }
  page(i) {
    if (i < 0 || i >= this.e.pages.length) return;
    this.index = i;
    this.paint();
  }
  status(s) {
    if (this.active && this.$) this.$('#save-state').textContent = s;
  }
  err(e) {
    if (this.active) {
      this.$('.save-error').textContent = message(e);
      this.status('Check the message below');
    } else toast(message(e));
  }
  paint() {
    if (!this.active) return;
    const i = this.index,
      d = this.d,
      ps = this.$('[data-edit-page]');
    ps.value = i;
    for (const [n, p] of this.e.pages.entries())
      ps.options[n].textContent = num(n + 1) + ' · ' + local(p.title, d.language);
    this.el
      .querySelectorAll('[data-pane]')
      .forEach((p) => (p.hidden = Number(p.dataset.pane) !== i));
    this.el
      .querySelectorAll('[data-step]')
      .forEach(
        (b) =>
          (b.disabled =
            i + Number(b.dataset.step) < 0 || i + Number(b.dataset.step) >= this.e.pages.length),
      );
    const contacts = this.$('[data-contact-fields]');
    if (contacts) contacts.hidden = !d.rsvp;
    const box = this.$('#live-poster');
    box.innerHTML = chapter(d, i, { media: this.media });
    wireChapter(box);
    this.$('#design-caption').textContent = d.design.name;
    this.$('#proof-count').textContent = `PAGE ${num(i + 1)} / 06`;
    for (const k of ['photo', 'video']) this.$(`[data-remove="${k}"]`).hidden = !d[k];
  }
  paintGallery() {
    if (!this.active) return;
    this.$('#album-list').innerHTML = this.d.gallery
      .map(
        (m, i) =>
          `<div class="album-row"><div class="album-thumb">${m.kind === 'photo' && this.assets.has(m.id) ? `<img alt="" src="${h(this.assets.get(m.id))}">` : ic(m.kind === 'photo' ? 'image' : 'camera', 20)}</div><label class="field">${num(i + 1)} · ${m.kind} caption<input type="text" maxlength="120" data-caption="${h(m.id)}" value="${h(m.caption)}" placeholder="A few words about this memory"></label><div class="album-order">${[
            ['up', '↑', 'Move earlier', !i],
            ['down', '↓', 'Move later', i === this.d.gallery.length - 1],
            ['remove', '×', 'Remove memory', false],
          ]
            .map(
              ([a, s, title, off]) =>
                `<button data-album-action="${a}" data-index="${i}" aria-label="${title} ${i + 1}" ${off ? 'disabled' : ''}>${s}</button>`,
            )
            .join('')}</div></div>`,
      )
      .join('');
    this.$('[data-file="gallery"]').disabled = this.d.gallery.length >= 8;
  }
  albumAction(action, i) {
    const list = this.d.gallery;
    if (!list[i]) return;
    if (action === 'remove') {
      this.forget(list[i].id);
      list.splice(i, 1);
    } else {
      const j = i + (action === 'up' ? -1 : 1);
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
    }
    this.paintGallery();
    this.changed();
  }
  changed() {
    this.seq++;
    this.paint();
    this.$('.save-error').textContent = '';
    clearTimeout(this.timer);
    this.status(this.desk || state.user ? 'Saving changes…' : 'Visitor preview · Not saved');
    if (this.desk || state.user)
      this.timer = setTimeout(() => this.save().catch((e) => this.err(e)), 750);
  }
  save() {
    clearTimeout(this.timer);
    const job = this.queue.then(async () => {
      if (this.r.id && this.saved === this.seq) {
        this.status(this.savedText);
        return;
      }
      const n = this.seq,
        body = { data: cloneCard(this.d), version: this.r.version };
      this.status('Saving…');
      const r = this.desk
        ? await this.desk.save(body, this.r.slug)
        : this.r.id
          ? await api('invitations/' + this.r.id, { method: 'PUT', body })
          : await api('invitations', { method: 'POST', body });
      Object.assign(this.r, { id: r.id, version: r.version });
      // A previous autosave may finish after a new guest URL has already been displayed.
      if (!this.desk) Object.assign(this.r, { slug: r.slug, published: r.published });
      this.saved = n;
      if (this.active && location.hash.startsWith('#/new'))
        history.replaceState(null, '', '#/edit/' + r.id);
      this.status(n === this.seq ? this.savedText : 'Saving changes…');
    });
    this.queue = job.catch(() => {});
    return job;
  }
  async action(action) {
    if (this.uploading) return toast('Wait for the upload to finish.');
    if (['play', 'pdf', 'card'].includes(action)) {
      await this.readyMedia();
      if (!this.active) return;
      const slug = this.r.published ? this.r.slug : '';
      if (action === 'play') return preview(cloneCard(this.d), this.media);
      if (action === 'pdf') return printCard(this.d, this.media, slug);
      return keepsake(this.d, this.media, slug);
    }
    return this.account(async () => {
      if (action === 'save') {
        await this.save();
        toast(this.savedText + '.');
      } else await this.publish();
    });
  }
  completeShare(slug) {
    if (!this.active) return;
    const t = (en, hi) => choose(this.d.language, en, hi);
    Object.assign(this.r, { slug, published: true });
    this.seq++; // Persist even if only the accepted link changed.
    const m = showLink({ slug, fromEditor: true }, this.d.language);
    const note = $('[data-link-storage]', m);
    this.$('.save-error').textContent = '';
    // Showing/copying this URL must never wait on a slow, full or blocked device DB.
    this.save()
      .then(() => {
        note.textContent = t(
          'Draft and guest link saved on this device.',
          'ड्राफ़्ट और लिंक इस डिवाइस पर सेव हो गए।',
        );
      })
      .catch((e) => {
        note.textContent = t(
          'Your link works. The draft and link could not be saved on this device. Copy the link before leaving.',
          'लिंक काम करता है। इस डिवाइस पर ड्राफ़्ट और लिंक सेव नहीं हुए। पेज बंद करने से पहले लिंक कॉपी करें।',
        );
        if (this.active && this.r.slug === slug) {
          this.status(t('Link ready · not saved', 'लिंक तैयार है · सेव नहीं हुआ'));
          this.$('.save-error').textContent = note.textContent + ' ' + message(e);
        }
      });
  }
  invalid(control, text) {
    control.setCustomValidity(text);
    control.focus();
    control.reportValidity?.();
    throw Error(text);
  }
  async publish() {
    const d = this.d;
    if (!d.person.trim() || !d.message.trim()) {
      this.tab(0);
      this.page(d.person.trim() ? notePage(this.e) : 0);
      this.invalid(
        this.$(`[data-key="${d.person.trim() ? 'message' : 'person'}"]`),
        d.person.trim()
          ? 'Add an invitation message · पहले निमंत्रण संदेश लिखें।'
          : 'Add the name on the invitation · पहले निमंत्रण पर नाम लिखें।',
      );
    }
    if (this.desk && d.rsvp) {
      try {
        this.desk.contacts(d);
      } catch (err) {
        this.tab(0);
        this.page(this.e.pages.findIndex((p) => p.blocks.includes('reply')));
        this.invalid(
          this.$(
            `[data-key="${d.email && !this.$('[data-key="email"]').validity.valid ? 'email' : 'phone'}"]`,
          ),
          message(err),
        );
      }
    }
    const btn = this.$('[data-do="publish"]'),
      fields = this.$('#editor-fields');
    fields.disabled = btn.disabled = true;
    try {
      if (this.desk) {
        btn.textContent = 'Preparing link… · लिंक बन रहा है…';
        const { slug, omitted } = await this.desk.prepareLink(cloneCard(d));
        if (!this.active) return;
        if (omitted.length) {
          this.desk.offerCompact(
            omitted,
            d.language,
            () => this.completeShare(slug),
            () => this.action('card').catch((e) => this.err(e)),
          );
        } else this.completeShare(slug);
        return;
      }
      await this.save();
      const r = await api(`invitations/${this.r.id}/publish`, {
        method: 'POST',
        body: { version: this.r.version },
      });
      Object.assign(this.r, { slug: r.slug, published: true, version: r.version });
      if (this.active) {
        btn.innerHTML = ic('letter') + ' Update live invitation';
        showLink(this.r);
      }
    } finally {
      fields.disabled = btn.disabled = false;
      if (this.desk) btn.innerHTML = ic('letter') + ' Create guest link · लिंक बनाएँ';
    }
  }
  ids() {
    return [this.d.photo, this.d.video, ...this.d.gallery.map((m) => m.id)].filter(Boolean);
  }
  forget(id) {
    if (this.assets.get(id)?.startsWith('blob:')) URL.revokeObjectURL(this.assets.get(id));
    this.assets.delete(id);
    this.desk?.forget(id);
  }
  fetchMedia(id) {
    if (!id || this.assets.has(id)) return Promise.resolve();
    if (this.pending.has(id)) return this.pending.get(id);
    const p = (
      this.desk
        ? this.desk.getMedia(id)
        : api(`invitations/${this.r.id}/media/${id}`, { blob: true })
    )
      .then((blob) => {
        if (this.active && this.ids().includes(id)) {
          this.assets.set(id, typeof blob === 'string' ? blob : URL.createObjectURL(blob));
          this.paint();
          const thumb = this.$(`[data-caption="${id}"]`)
            ?.closest('.album-row')
            ?.querySelector('.album-thumb');
          if (thumb && this.d.gallery.find((m) => m.id === id)?.kind === 'photo')
            thumb.innerHTML = `<img alt="" src="${h(this.assets.get(id))}">`;
        }
      })
      .finally(() => this.pending.delete(id));
    this.pending.set(id, p);
    return p;
  }
  readyMedia() {
    return Promise.all(this.ids().map((id) => this.fetchMedia(id)));
  }
  async addFiles(slot, files, urlKind) {
    if (this.uploading) throw Error('Please finish the current upload first.');
    if (slot === 'gallery' && this.d.gallery.length + files.length > 8)
      throw Error('Choose at most eight additional memories.');
    this.uploading = true;
    try {
      if (!this.desk) await this.save();
      for (const file of files) {
        if (!this.active) break;
        const kind =
          urlKind ||
          (slot === 'gallery' ? (file.type.startsWith('video/') ? 'video' : 'photo') : slot);
        if (file.size > (kind === 'photo' ? 4 : 12) * 1024 ** 2)
          throw Error('That ' + kind + ' is over the size limit.');
        this.status((this.desk ? 'Adding ' : 'Uploading ') + kind + '…');
        let m;
        if (this.desk) m = this.desk.addMedia(kind, file);
        else {
          const body = new FormData();
          body.append('file', file);
          m = await api(`invitations/${this.r.id}/upload/${kind}`, { method: 'POST', body });
        }
        if (!this.active) break;
        if (slot === 'gallery') this.d.gallery.push({ ...m, caption: '' });
        else {
          this.forget(this.d[slot]);
          this.d[slot] = m.id;
        }
        if (this.desk) this.changed();
        else {
          this.seq++;
          await this.save();
        }
        this.paintGallery();
        await this.fetchMedia(m.id);
      }
      if (this.active) toast('Media added to your draft.');
    } finally {
      this.uploading = false;
    }
  }
  async leave() {
    clearTimeout(this.timer);
    this.active = false;
    try {
      if ((this.desk || state.user) && this.saved !== this.seq) await this.save();
      else await this.queue;
    } finally {
      for (const u of this.assets.values()) if (u.startsWith('blob:')) URL.revokeObjectURL(u);
      this.assets.clear();
      $('#print-sheet').replaceChildren();
    }
  }
}
