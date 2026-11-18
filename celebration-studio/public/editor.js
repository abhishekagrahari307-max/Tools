import {
  $,
  h,
  ic,
  state,
  api,
  options,
  eventOf,
  designOf,
  modal,
  toast,
  showLink,
  message,
} from './shared.js';
import { poster, preview, printCard, keepsake } from './player.js';

export class Editor {
  constructor(record, account) {
    this.r = record;
    this.d = record.data;
    this.account = account;
    this.queue = Promise.resolve();
    this.seq = 0;
    this.saved = 0;
    this.urls = { photo: '', video: '' };
    this.active = true;
    this.uploading = false;
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
  mount(root) {
    this.root = root;
    const d = this.d,
      c = state.catalog,
      designs = [...c.templates];
    if (!designOf(d.template)) designs.push(d.design);
    root.innerHTML = `<div class="wrap editor"><div class="crumb"><a href="#/">Studio</a> / <a href="#/dashboard">My invitations</a> / Editor</div><div class="page-head"><div><span class="eyeline">THE PERSONALIZATION ROOM</span><h1>Make it <em>yours.</em></h1><p>नाम से शुरू करें। निमंत्रण का हर विवरण आप बदल सकते हैं।</p></div><span id="save-state" role="status" class="status-pill"></span></div>
   <div class="editor-grid"><section class="panel form-panel"><div class="tabbar" role="group" aria-label="Editor sections">${['Invitation', 'Design & media', 'When & where'].map((x, i) => `<button data-tab="${i}" aria-pressed="${i === 0}">${h(x)}</button>`).join('')}</div>
   <fieldset id="editor-fields"><div class="form-section" data-section="0"><small class="eyeline">01 / YOUR OCCASION</small><h2>The invitation</h2>
   ${this.select('Occasion · अवसर', 'occasion', Object.fromEntries(c.occasions.map((e) => [e.id, e.name + ' · ' + e.hi])))}
   ${this.field('Celebrating · किसके लिए', 'person', 'text', 'maxlength="100" placeholder="e.g. Aanya & Arjun"')}${this.field('Hosted by · आयोजक', 'host', 'text', 'maxlength="100" placeholder="Your name or family"')}
   ${this.text('Your message · शुभकामना संदेश', 'message', 1600, 4)}<div class="suggest"><span>${ic('feather', 13)} Try a note</span><button data-note="message">हिंदी निमंत्रण</button><button data-note="alternate">खास संदेश</button><button data-note="english">English</button></div></div>
   <div class="form-section" data-section="1" hidden><small class="eyeline">02 / LOOK & FEEL</small><h2>Set the mood</h2>${this.select('Stationery design', 'template', Object.fromEntries(designs.map((t) => [t.code, t.name])))}<div class="two">${this.select('Color story', 'palette', c.palettes)}${this.select('Lettering', 'font', c.fonts)}</div><div class="two">${this.select('Cinematic opening', 'opening', c.openings)}${this.select('Background music', 'music', c.music)}</div>${['photo', 'video'].map((k) => `<div class="upload-field"><label class="field">${ic(k === 'photo' ? 'image' : 'camera')} ${k === 'photo' ? 'Portrait or photo · up to 4 MB' : 'Short video · up to 12 MB'}<input type="file" data-file="${k}" accept="${k === 'photo' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/webm'}"></label><button class="text-link remove-media" data-remove="${k}" ${d[k] ? '' : 'hidden'}>Remove ${k}</button></div>`).join('')}<p class="fine">Uploads stay private until you publish. Supported: JPG, PNG, WebP, MP4 & WebM.</p></div>
   <div class="form-section" data-section="2" hidden><small class="eyeline">03 / EVENT DETAILS</small><h2>When & where</h2><div class="two">${this.field('Date · तारीख', 'date', 'date')}${this.field('Time · IST (UTC+05:30)', 'time', 'time')}</div>${this.field('Venue · स्थान', 'venue', 'text', 'maxlength="240" placeholder="Venue name and address"')}${this.field('Google Maps link · optional', 'map', 'url', 'maxlength="500" placeholder="https://maps.app.goo.gl/…"')}${this.text('Schedule · one line per activity', 'schedule', 650, 3, '18:00 · Welcome\n19:30 · Dinner')}${this.toggle('Show live countdown', 'countdown')}${this.toggle('Collect guest RSVPs and party sizes', 'rsvp')}</div></fieldset>
   <p class="publish-note">${ic('lock', 12)} Drafts are private. Publishing shares your invitation, venue and attached files with anyone who has its link.</p><div class="form-actions"><button class="btn plain" data-do="save">${ic('lock', 14)} Save draft</button><button class="btn primary" data-do="publish">${ic('letter')} ${this.r.published ? 'Update live invitation' : 'Publish invitation'}</button></div><div class="save-error" role="alert"></div></section>
   <aside class="panel preview-col"><div class="preview-top"><span><i class="dot"></i> LIVE PREVIEW</span><small id="design-caption"></small></div><div class="preview-frame" id="live-poster"></div><div class="preview-foot"><button class="btn plain" data-do="play">${ic('play', 14)} Play opening</button><button class="text-link" data-do="pdf">Print / PDF</button><button class="text-link" data-do="card">${ic('download', 14)} Card</button></div></aside></div></div>`;
    this.$ = (s) => $(s, root);
    this.paint();
    this.status(
      this.r.id
        ? 'Saved to your account'
        : state.user
          ? 'New draft'
          : 'Visitor preview · Sign in to save',
    );
    root.querySelectorAll('[data-tab]').forEach(
      (b) =>
        (b.onclick = () => {
          root
            .querySelectorAll('[data-section]')
            .forEach((s) => (s.hidden = s.dataset.section !== b.dataset.tab));
          root
            .querySelectorAll('[data-tab]')
            .forEach((t) => t.setAttribute('aria-pressed', String(t === b)));
        }),
    );
    const change = (ev) => {
      const el = ev.target,
        key = el.dataset.key;
      if (!key) return;
      const old = this.d[key];
      this.d[key] = el.type === 'checkbox' ? el.checked : el.value;
      if (key === 'occasion' && old !== this.d[key]) {
        const prev = eventOf(old),
          e = eventOf(this.d.occasion);
        if (!d.message || d.message === prev.message || d.message === prev.alternate) {
          d.message = e.message;
          this.$('[data-key="message"]').value = d.message;
        }
        d.opening = e.opening;
        this.$('[data-key="opening"]').value = d.opening;
      }
      if (key === 'template') {
        d.design = designOf(d.template) || d.design;
        d.palette = d.design.palette;
        d.opening = d.design.opening;
        this.$('[data-key="palette"]').value = d.palette;
        this.$('[data-key="opening"]').value = d.opening;
      }
      this.changed();
    };
    root
      .querySelectorAll('[data-key]')
      .forEach((el) =>
        el.addEventListener(
          el.matches('select,[type="checkbox"],[type="date"],[type="time"]') ? 'change' : 'input',
          change,
        ),
      );
    root.querySelectorAll('[data-note]').forEach(
      (b) =>
        (b.onclick = () => {
          const e = eventOf(d.occasion);
          d.message =
            b.dataset.note === 'english'
              ? `Please join us for our ${e.name.toLowerCase()} celebration. It would mean so much to share this day with you!`
              : e[b.dataset.note];
          this.$('[data-key="message"]').value = d.message;
          this.changed();
        }),
    );
    root.querySelectorAll('[data-file]').forEach(
      (el) =>
        (el.onchange = () => {
          const file = el.files[0];
          if (file) this.account(() => this.addFile(el.dataset.file, file));
          el.value = '';
        }),
    );
    root.querySelectorAll('[data-remove]').forEach(
      (b) =>
        (b.onclick = () => {
          const k = b.dataset.remove;
          d[k] = '';
          URL.revokeObjectURL(this.urls[k]);
          this.urls[k] = '';
          this.changed();
        }),
    );
    root.querySelectorAll('[data-do]').forEach(
      (b) =>
        (b.onclick = () => {
          const a = b.dataset.do;
          if (a === 'play') return preview(d, this.urls);
          if (a === 'pdf') return printCard(d, this.urls.photo);
          if (a === 'card')
            return keepsake(d, this.urls.photo, this.r.published ? this.r.slug : '').catch((e) =>
              this.err(e),
            );
          if (this.uploading) return toast('Wait for the upload to finish.');
          this.account(async () => {
            if (a === 'save') {
              await this.save();
              toast('Draft saved to your account.');
            } else await this.publish();
          });
        }),
    );
    for (const k of ['photo', 'video']) if (d[k]) this.fetchMedia(k).catch((e) => this.err(e));
  }
  status(s) {
    if (this.active && this.$) this.$('#save-state').textContent = s;
  }
  err(e) {
    if (this.active) {
      this.$('.save-error').textContent = message(e);
      this.status('Not saved · check below');
    } else toast(message(e));
  }
  paint() {
    if (!this.active) return;
    this.$('#live-poster').innerHTML = poster(this.d, this.urls.photo);
    this.$('#design-caption').textContent = this.d.design.name;
    for (const k of ['photo', 'video']) this.$(`[data-remove="${k}"]`).hidden = !this.d[k];
  }
  changed() {
    this.seq++;
    this.paint();
    this.$('.save-error').textContent = '';
    clearTimeout(this.timer);
    this.status(state.user ? 'Saving changes…' : 'Visitor preview · Not saved');
    if (state.user) this.timer = setTimeout(() => this.save().catch((e) => this.err(e)), 750);
  }
  save() {
    clearTimeout(this.timer);
    const job = this.queue.then(async () => {
      if (this.r.id && this.saved === this.seq) {
        this.status('Saved to your account');
        return;
      }
      const n = this.seq,
        body = { data: structuredClone(this.d), version: this.r.version };
      this.status('Saving…');
      const r = this.r.id
        ? await api('invitations/' + this.r.id, { method: 'PUT', body })
        : await api('invitations', { method: 'POST', body });
      Object.assign(this.r, { id: r.id, slug: r.slug, version: r.version, published: r.published });
      this.saved = n;
      if (this.active && location.hash.startsWith('#/new'))
        history.replaceState(null, '', '#/edit/' + r.id);
      this.status(n === this.seq ? 'Saved to your account' : 'Saving changes…');
    });
    this.queue = job.catch(() => {});
    return job;
  }
  async publish() {
    if (!this.d.person.trim() || !this.d.message.trim()) {
      this.$('[data-tab="0"]').click();
      this.$(`[data-key="${this.d.person.trim() ? 'message' : 'person'}"]`).focus();
      throw Error('नाम और संदेश भरें, फिर प्रकाशित करें।');
    }
    const btn = this.$('[data-do="publish"]'),
      fields = this.$('#editor-fields');
    fields.disabled = btn.disabled = true;
    try {
      await this.save();
      const r = await api(`invitations/${this.r.id}/publish`, {
        method: 'POST',
        body: { version: this.r.version },
      });
      Object.assign(this.r, { slug: r.slug, published: true, version: r.version });
      btn.innerHTML = ic('letter') + ' Update live invitation';
      showLink(this.r);
    } finally {
      fields.disabled = btn.disabled = false;
    }
  }
  async fetchMedia(k) {
    const id = this.d[k],
      blob = await api(`invitations/${this.r.id}/media/${id}`, { blob: true });
    if (!this.active || id !== this.d[k]) return;
    URL.revokeObjectURL(this.urls[k]);
    this.urls[k] = URL.createObjectURL(blob);
    this.paint();
  }
  async addFile(k, file) {
    if (this.uploading) throw Error('Please finish the current upload first.');
    if (file.size > (k === 'photo' ? 4 : 12) * 1024 ** 2)
      throw Error('That file is over the size limit.');
    this.uploading = true;
    try {
      await this.save();
      this.status('Uploading ' + k + '…');
      const body = new FormData();
      body.append('file', file);
      const m = await api(`invitations/${this.r.id}/upload/${k}`, { method: 'POST', body });
      this.d[k] = m.id;
      this.seq++;
      await this.save();
      await this.fetchMedia(k);
      toast('Your ' + k + ' is ready.');
    } finally {
      this.uploading = false;
    }
  }
  async leave() {
    clearTimeout(this.timer);
    this.active = false;
    try {
      if (state.user && this.saved !== this.seq) await this.save();
      else await this.queue;
    } finally {
      for (const u of Object.values(this.urls)) if (u) URL.revokeObjectURL(u);
    }
  }
}
