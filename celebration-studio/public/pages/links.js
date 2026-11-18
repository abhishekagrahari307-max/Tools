// V1 is a portable snapshot, not a lookup key. Keep the v1 catalog/decoder for old links.
import { zlibSync, unzlibSync, qrcode } from './vendor/codecs.js';
import { state, initial, eventOf, designOf, mapLink, minuteTime } from '../shared.js';

const base = new URL('../../', import.meta.url).href;
export const MAX_LINK = 8000;
export const MAX_QR = 2953;
const MAX_RAW = 64 * 1024;
export const publicURL = (token) => base + '#/i/' + token;
export const replyURL = (token) => base + '#/reply/' + token;
const b64 = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
export const newID = () => b64(crypto.getRandomValues(new Uint8Array(12)));
const validID = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{16}$/.test(v);
const object = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
export class LinkSizeError extends Error {}
function need(
  ok,
  text = 'This link is incomplete or invalid. Ask the sender to copy the whole link again.',
) {
  if (!ok) throw Error(text);
}
export function pack(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (bytes.length > MAX_RAW)
    throw new LinkSizeError(
      'This invitation is too large for a link. Shorten the text or use the downloadable Card.',
    );
  return 'v1.' + b64(zlibSync(bytes, { level: 9 }));
}
export function unpack(token) {
  try {
    need(
      typeof token === 'string' && token.length <= MAX_LINK && /^v1\.[A-Za-z0-9_-]+$/.test(token),
    );
    const zipped = Uint8Array.from(
      atob(token.slice(3).replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0),
    );
    need(zipped.length >= 8);
    const bytes = unzlibSync(zipped, { out: new Uint8Array(MAX_RAW + 1) });
    need(bytes.length <= MAX_RAW);
    // Check the zlib trailer as well as JSON. Truncated chat links must fail closed.
    let a = 1,
      b = 0;
    for (const n of bytes) {
      a = (a + n) % 65521;
      b = (b + a) % 65521;
    }
    need(new DataView(zipped.buffer).getUint32(zipped.length - 4) === b * 65536 + a);
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    need(false);
  }
}
const limits = {
  person: 100,
  host: 100,
  message: 1600,
  messageAlt: 1600,
  date: 10,
  time: 5,
  venue: 240,
  map: 500,
  schedule: 650,
  phone: 32,
  email: 150,
};
const enums = { font: 'fonts', palette: 'palettes', opening: 'openings', music: 'music' };
const flags = ['rsvp', 'countdown'];
export const startCard = (t) => ({
  ...initial(t, eventOf(t.occasion)),
  rsvp: false,
  phone: '',
  email: '',
});
const short = (v, n) => typeof v === 'string' && v.length <= n;
const time = (v) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
export function contacts(d) {
  if (!d.rsvp) return { phone: '', email: '' };
  const phone = (d.phone || '')
      .trim()
      .replace(/[ ()-]/g, '')
      .replace(/^\+/, ''),
    email = (d.email || '').trim();
  need(
    !phone || /^[1-9]\d{6,14}$/.test(phone),
    'Enter the host’s WhatsApp number with country code, e.g. +91 followed by 10 digits.',
  );
  need(
    !email || (short(email, 150) && /^[a-z\d._+'-]+@[a-z\d.-]+\.[a-z]{2,}$/i.test(email)),
    'Enter a valid RSVP email address.',
  );
  need(
    phone || email,
    'On page 06, add your WhatsApp number or email for replies, or turn off RSVP.',
  );
  return { phone, email };
}
export function httpsMedia(value) {
  const err = 'Use a public, direct HTTPS photo or video address that opens without signing in.';
  need(short(value, 1500) && /^https:\/\//i.test(value) && !/[\s\\\x00-\x1f]/.test(value), err);
  let u;
  try {
    u = new URL(value);
  } catch {
    throw Error(err);
  }
  need(
    !u.username &&
      !u.password &&
      u.hostname.includes('.') &&
      !/(^localhost$|\.local$|\.localhost$|^(?:127|10|0)\.|^192\.168\.|^172\.(?:1[6-9]|2\d|3[01])\.)/i.test(
        u.hostname,
      ),
    err,
  );
  return u.href;
}
function source(src, kind) {
  need(typeof src === 'string' && ['photo', 'video'].includes(kind));
  if (!src.startsWith('data:')) return httpsMedia(src);
  const re =
    kind === 'video'
      ? /^data:video\/(mp4|webm);base64,[A-Za-z0-9+/]+=*$/
      : /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
  need(src.length < 10000 && re.test(src));
  return src;
}
// Only an allowlist of guest-visible deltas travels. In particular no draft/media keys,
// full design objects, private guest list, disabled RSVP contact or storage state.
export function makeInvite(id, d, media) {
  const seed = startCard(designOf(d.template)),
    delta = {},
    contact = contacts(d);
  for (const k of [...Object.keys(limits), ...Object.keys(enums), ...flags, 'language']) {
    const v = owns(contact, k) ? contact[k] : k === 'time' ? minuteTime(d.time) : d[k];
    if (v !== seed[k]) delta[k] = v;
  }
  const specs = eventOf(d.occasion).pages.flatMap((p) => p.fields);
  const fields = Object.fromEntries(
    Object.entries(d.fields)
      .filter(([, v]) => v)
      .map(([key, v]) => [
        key,
        specs.some((s) => s.key === key && s.kind === 'time') ? minuteTime(v) : v,
      ]),
  );
  if (Object.keys(fields).length) delta.fields = fields;
  if (d.photo) delta.photo = media.photo;
  if (d.video) delta.video = media.video;
  if (d.gallery.length)
    delta.gallery = d.gallery.map((m) => [m.kind, media.gallery[m.id], m.caption]);
  const data = [id, d.template, delta];
  readInvite(data);
  const token = pack(data);
  if (publicURL(token).length > MAX_LINK)
    throw new LinkSizeError(
      'This invitation exceeds the 8,000-character link limit. Shorten the text or send the full downloaded Card.',
    );
  return token;
}
export function readInvite(raw) {
  need(Array.isArray(raw) && raw.length === 3);
  const [id, code, delta] = raw,
    t = designOf(code);
  need(validID(id) && t?.occasion && object(delta));
  const d = startCard(t),
    e = eventOf(t.occasion),
    media = { photo: '', video: '', gallery: {} };
  for (const [k, v] of Object.entries(delta)) {
    if (k === 'time')
      need(
        typeof v === 'string' && (!v || time(v)),
        'Choose an event time in hours and minutes (HH:mm).',
      );
    else if (owns(limits, k)) need(short(v, limits[k]));
    else if (owns(enums, k)) need(typeof v === 'string' && owns(state.catalog[enums[k]], v));
    else if (flags.includes(k)) need(typeof v === 'boolean');
    else if (k === 'language') need(['hi', 'en'].includes(v));
    else if (k === 'fields') {
      need(object(v));
      const specs = e.pages.flatMap((p) => p.fields);
      for (const [key, text] of Object.entries(v)) {
        const s = specs.find((f) => f.key === key);
        need(s && short(text, s.limit));
        if (s.kind === 'age')
          need(/^[0-9०-९]{1,3}$/.test(text), 'Enter a whole number for age or years.');
        if (s.kind === 'time') need(time(text), 'Choose a valid time.');
        d.fields[key] = text;
      }
      continue;
    } else if (['photo', 'video'].includes(k)) {
      media[k] = source(v, k);
      d[k] = k;
      continue;
    } else if (k === 'gallery') {
      need(Array.isArray(v) && v.length <= 8);
      v.forEach((item, i) => {
        need(Array.isArray(item) && item.length === 3 && short(item[2], 120));
        const [kind, src, caption] = item,
          key = 'g' + i;
        media.gallery[key] = source(src, kind);
        d.gallery.push({ kind, caption, id: key });
      });
      continue;
    } else need(false);
    d[k] = v;
  }
  need(d.person.trim() && d.message.trim(), 'Enter a name and invitation message.');
  need(
    !d.date ||
      (/^\d{4}-\d\d-\d\d$/.test(d.date) &&
        Number.isFinite(Date.parse(d.date)) &&
        new Date(d.date).toISOString().startsWith(d.date + 'T')),
    'Choose a valid date.',
  );
  need(
    !d.map || mapLink({ ...d, venue: '' }),
    'Use an HTTPS Google Maps link or leave the link blank.',
  );
  Object.assign(d, contacts(d));
  return { id, data: d, media };
}
export function readReply(raw) {
  need(Array.isArray(raw) && raw.length === 7);
  const [invite, key, event, name, attendance, party, note] = raw;
  need(
    validID(invite) &&
      validID(key) &&
      short(event, 100) &&
      short(name, 80) &&
      name.trim() &&
      short(note, 300),
  );
  need(
    ['yes', 'maybe', 'no'].includes(attendance) &&
      Number.isInteger(party) &&
      (attendance === 'yes' ? party >= 1 && party <= 20 : party === 0),
  );
  return { invite, key, event, name, attendance, party, note };
}
// No invitation contents are sent to a QR service. PNGs have a four-module quiet zone.
let cachedToken, cachedQR;
export function qrURL(token) {
  if (!token) return '';
  if (token === cachedToken) return cachedQR;
  const url = publicURL(token);
  if (url.length > MAX_QR) return '';
  try {
    const code = qrcode(0, url.length <= 2331 ? 'M' : 'L');
    code.addData(url, 'Byte');
    code.make();
    const n = code.getModuleCount(),
      scale = 6,
      c = document.createElement('canvas');
    c.width = c.height = (n + 8) * scale;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#221a18';
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        if (code.isDark(y, x)) ctx.fillRect((x + 4) * scale, (y + 4) * scale, scale, scale);
    const png = c.toDataURL('image/png');
    if (!png.startsWith('data:image/png;base64,')) return '';
    cachedToken = token;
    return (cachedQR = png);
  } catch {
    // Canvas/readback may be unavailable in a privacy browser. The URL still works.
    return '';
  }
}
