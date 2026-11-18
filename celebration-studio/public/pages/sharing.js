import { $, h, ic, choose, copy, modal, message } from '../shared.js';
import {
  publicURL,
  qrURL,
  replyURL,
  newID,
  pack,
  readReply,
  contacts,
  httpsMedia,
} from './links.js';

export function showLink({ slug }, lang = 'en') {
  const t = (en, hi) => choose(lang, en, hi),
    url = publicURL(slug),
    qr = qrURL(slug);
  const el = modal(
    t('Your guest link is ready.', 'आपका निमंत्रण लिंक तैयार है।'),
    `
    <p>${t('Send this copy to your guests. It opens all six pages without a login.', 'यह कॉपी मेहमानों को भेजें। वे बिना लॉगिन छहों पन्ने खोल सकते हैं।')}</p>
    <label class="field">${t('Full guest link', 'पूरा निमंत्रण लिंक')}<input id="share-url" readonly value="${h(url)}"></label>
    <div class="actions"><button class="btn primary" id="copy-url">${ic('copy')} ${t('Copy link', 'लिंक कॉपी करें')}</button><a class="btn plain" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=${encodeURIComponent(t('You’re invited! ', 'आप सादर आमंत्रित हैं! ') + url)}">WhatsApp ${ic('up', 13)}</a></div>
    ${qr ? `<div class="share-qr portable-qr"><img src="${h(qr)}" alt="${t('Scan to open the invitation', 'निमंत्रण खोलने के लिए स्कैन करें')}"><a class="text-link" download="invitation-qr.png" href="${h(qr)}">${ic('download')} ${t('Download QR (PNG)', 'QR डाउनलोड करें (PNG)')}</a></div>` : `<p class="fine">${t('This link works, but is too long for one QR code. For a QR, shorten the text or replace embedded photos with direct HTTPS links.', 'लिंक काम करता है लेकिन एक QR में नहीं समाएगा। QR के लिए संदेश छोटा करें या फ़ोटो के HTTPS लिंक लगाएँ।')}</p>`}
    <a class="text-link" data-open-guest href="${h(url)}" target="_blank" rel="noopener noreferrer">${t('Open guest view', 'मेहमान का निमंत्रण खोलें')} ${ic('up', 13)}</a>
    <p class="fine">${t('Anyone with the link can read or forward this copy, including any venue and RSVP contact. Editing or deleting a draft does not change links already sent.', 'लिंक वाला कोई भी व्यक्ति स्थान और RSVP संपर्क सहित यह कॉपी पढ़ या भेज सकता है। ड्राफ़्ट बदलने या हटाने से भेजे हुए लिंक नहीं बदलते।')}</p>`,
  );
  $('#copy-url', el).onclick = () => copy(url, $('#share-url', el));
}
export function contactFields(editor) {
  return `<div data-contact-fields><p class="fine">Guests send their reply to you, not to a server. Add a WhatsApp number or an email. Anyone with the guest link can see this contact.</p>${editor.field('Host WhatsApp · देश कोड सहित', 'phone', 'tel', 'maxlength="32" placeholder="+91 …"')}${editor.field('Host email · ईमेल', 'email', 'email', 'maxlength="150" placeholder="host@example.com"')}</div>`;
}
export function mediaControls() {
  return `<button class="btn plain" data-add-url>${ic('plus', 14)} Add a media link</button><p class="fine">For a guest link, use direct public HTTPS links for full-size photos and films. Local photos travel as small thumbnails. Most local videos will not fit in a link. The downloadable HTML Card keeps your original local photos and videos; linked media still need internet.</p>`;
}
export function promptMedia(editor) {
  const el = modal(
    'Add a media link',
    `<p>Paste a direct HTTPS file address that anyone can open, not a private drive, YouTube or album page. No file is uploaded here.</p><form><label class="field">Use on<select name="slot"><option value="photo">Cover photo · replaces current cover</option><option value="video">Featured film · replaces current film</option><option value="gallery-photo">Album · another photo</option><option value="gallery-video">Album · another film</option></select></label><label class="field">Public photo / video URL<input type="url" name="src" required maxlength="1500" placeholder="https://…"></label><button class="btn primary">Add to draft</button><p class="error" role="alert"></p></form>`,
  );
  const form = $('form', el);
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = $('button', form);
    btn.disabled = true;
    try {
      const src = httpsMedia(form.elements.namedItem('src').value.trim()),
        [slot, kind] = form.elements.namedItem('slot').value.split('-');
      await editor.addFiles(slot, [src], kind || slot);
      el.close();
    } catch (e) {
      $('.error', form).textContent = message(e);
    } finally {
      btn.disabled = false;
    }
  };
}
export const labels = {
  yes: ['Attending', 'आएँगे'],
  maybe: ['Maybe', 'शायद'],
  no: ['Not attending', 'नहीं आएँगे'],
};
const guestKeys = new Map();
export function guestKey(id) {
  const k = 'celebration.pages.receipt.' + id;
  if (!guestKeys.has(k)) {
    let v;
    try {
      v = localStorage.getItem(k);
    } catch {}
    if (!/^[A-Za-z0-9_-]{16}$/.test(v || '')) v = newID();
    try {
      localStorage.setItem(k, v);
    } catch {}
    guestKeys.set(k, v);
  }
  return guestKeys.get(k);
}
function destinations(d, subject, text) {
  const { phone, email } = contacts(d);
  return {
    whatsapp: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : '',
    mail: email
      ? `mailto:${encodeURIComponent(email).replace('%40', '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
      : '',
  };
}
export function prepareReply(root, d, id, draft, lang) {
  const t = (en, hi) => choose(lang, en, hi),
    name = draft.name.trim();
  if (!name) throw Error(t('Enter your name first.', 'पहले अपना नाम लिखें।'));
  const fields = [
      id,
      draft.key,
      d.person,
      name,
      draft.attendance,
      draft.attendance === 'yes' ? Number(draft.party) : 0,
      draft.note.trim(),
    ],
    r = readReply(fields);
  const slip = replyURL(pack(fields)),
    subject = 'RSVP · ' + d.person;
  const body = [
    subject,
    `${r.name} — ${t(...labels[r.attendance])}`,
    r.party ? `${t('Guests', 'मेहमान')}: ${r.party}` : '',
    r.note,
    `${t('Reply for the organizer’s guest list', 'आयोजक की सूची में जोड़ने का लिंक')}: ${slip}`,
  ]
    .filter(Boolean)
    .join('\n');
  const { whatsapp, mail } = destinations(d, subject, body);
  root.className = 'reply-status reply-handoff';
  root.innerHTML = `<strong>${t('One more step: send it to your host.', 'एक कदम बाकी है: मेज़बान को भेजें।')}</strong><span>${t('Open the message and press Send in your app. Nothing has been sent yet.', 'नीचे संदेश खोलें और अपने ऐप में Send दबाएँ। अभी जवाब नहीं भेजा गया है।')}</span><span class="actions">${whatsapp ? `<a data-send-wa class="btn primary" target="_blank" rel="noopener noreferrer" href="${h(whatsapp)}">WhatsApp ${ic('up', 13)}</a>` : ''}${mail ? `<a data-send-mail class="btn plain" href="${h(mail)}">${t('Email host', 'ईमेल करें')} ${ic('up', 13)}</a>` : ''}</span><button type="button" class="text-link" data-copy-reply>${t('Or copy reply link to send yourself', 'या जवाब का लिंक कॉपी करके भेजें')}</button>`;
  $('[data-copy-reply]', root).onclick = () => copy(slip);
}
export function exportContact(d, lang) {
  const t = (en, hi) => choose(lang, en, hi),
    subject = 'RSVP · ' + (d.person || 'Invitation');
  try {
    const { whatsapp, mail } = destinations(
      d,
      subject,
      subject + '\n' + t('My response: ', 'मेरा जवाब: '),
    );
    return `<p class="export-contact">${t('RSVP directly to your host', 'मेज़बान को जवाब भेजें')}: ${[whatsapp && `<a href="${h(whatsapp)}" rel="noreferrer">WhatsApp +${h(contacts(d).phone)}</a>`, mail && `<a href="${h(mail)}">${h(d.email)}</a>`].filter(Boolean).join(' · ')}</p>`;
  } catch {
    return '';
  } // An unfinished draft can still be downloaded.
}
