// Device-only organizer workspace. The public reader never looks up a local draft.
import { newID, makeInvite, httpsMedia } from './links.js';

const drafts = 'drafts',
  media = 'media',
  replies = 'replies';
let opening;
function db() {
  if (!opening)
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open('celebration.pages.v1', 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        d.createObjectStore(drafts, { keyPath: 'id' });
        d.createObjectStore(media, { keyPath: ['invite', 'id'] });
        d.createObjectStore(replies, { keyPath: ['invite', 'key'] });
      };
      req.onsuccess = () => {
        req.result.onversionchange = () => {
          req.result.close();
          opening = null;
        };
        resolve(req.result);
      };
      req.onerror = () =>
        reject(
          Error('Cannot open device storage. Allow site storage to save drafts in this browser.'),
        );
    }).catch((e) => {
      opening = null;
      throw e;
    });
  return opening;
}
const read = (req) =>
  new Promise((ok, no) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => no(req.error);
  });
async function transaction(names, mode, run) {
  const tx = (await db()).transaction(names, mode);
  const done = new Promise((ok, no) => {
    tx.oncomplete = ok;
    tx.onabort = () => no(tx.error || Error('Device storage was unavailable.'));
  });
  try {
    const r = await run((name) => tx.objectStore(name));
    await done;
    return r;
  } catch (e) {
    try {
      tx.abort();
    } catch {
      /* already finished */
    }
    await done.catch(() => {});
    if (e.name === 'QuotaExceededError')
      throw Error(
        'Device storage is full. Download the card or remove unused drafts and try again.',
      );
    throw e;
  }
}
const get = (name, key) => transaction([name], 'readonly', (s) => read(s(name).get(key)));
const range = (id) => IDBKeyRange.bound([id], [id, []]);
const refs = (d) => [d.photo, d.video, ...d.gallery.map((m) => m.id)].filter(Boolean);
function checkVersion(old, version) {
  if (!old || old.version !== version)
    throw Error('This draft was changed or removed in another tab. Reload before continuing.');
}
export const getDraft = (id) => get(drafts, id);
export const listDrafts = () =>
  transaction([drafts], 'readonly', (s) => read(s(drafts).getAll())).then((list) =>
    list.sort((a, b) => b.updated - a.updated),
  );
export async function save(id, { data, version }) {
  return transaction([drafts, media], 'readwrite', async (s) => {
    const row = id
      ? await read(s(drafts).get(id))
      : { id: newID(), version: 0, slug: '', published: false };
    checkVersion(row, version);
    const live = new Set(refs(data));
    for (const key of row.data ? refs(row.data) : [])
      if (!live.has(key)) s(media).delete([row.id, key]);
    Object.assign(row, { data, updated: Date.now(), version: version + 1 });
    s(drafts).put(row);
    return row;
  });
}
export const deleteDraft = (id) =>
  transaction([drafts, media, replies], 'readwrite', (s) => {
    s(drafts).delete(id);
    s(media).delete(range(id));
    s(replies).delete(range(id));
  });
export const getReplies = (id) =>
  transaction([replies], 'readonly', (s) => read(s(replies).getAll(range(id))));
export const importReply = (response) =>
  transaction([drafts, replies], 'readwrite', async (s) => {
    if (!(await read(s(drafts).get(response.invite))))
      throw Error('Open this reply in the browser where you created the invitation.');
    s(replies).put(response); // Same invitation + guest receipt updates a row, not an extra seat.
  });
const types = {
  photo: ['image/jpeg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/webm'],
};
export async function addMedia(invite, kind, value) {
  if (typeof value === 'string') value = httpsMedia(value.trim());
  else if (
    !(value instanceof Blob) ||
    !types[kind]?.includes(value.type) ||
    !value.size ||
    value.size > (kind === 'photo' ? 4 : 12) * 1024 ** 2
  )
    throw Error('Choose JPG, PNG or WebP (up to 4 MB) or MP4 or WebM (up to 12 MB).');
  const id = newID();
  await transaction([media, drafts], 'readwrite', async (s) => {
    if (!(await read(s(drafts).get(invite)))) throw Error('Save this draft first.');
    s(media).put({ invite, id, value });
  });
  return { id, kind };
}
export async function getMedia(id, key) {
  const item = await get(media, [id, key]);
  if (!item) throw Error('A local file is missing. Add it again or remove it from the draft.');
  return item.value;
}
function dataURL(file) {
  return new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => no(r.error);
    r.readAsDataURL(file);
  });
}
async function linkPhoto(file, budget) {
  if (file.size <= budget) return dataURL(file);
  const url = URL.createObjectURL(file),
    img = new Image();
  try {
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    for (const edge of [160, 120, 96, 72, 48, 32, 24, 16]) {
      const factor = Math.min(1, edge / Math.max(img.naturalHeight, img.naturalWidth));
      c.width = Math.max(1, Math.round(img.naturalWidth * factor));
      c.height = Math.max(1, Math.round(img.naturalHeight * factor));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const thumb = c.toDataURL('image/webp', 0.63);
      if (thumb.length < (4 * budget) / 3 + 23) return thumb;
    }
    throw Error(
      'The photo will not fit in a guest link. Use a public HTTPS photo or send the full Card.',
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function publish(record) {
  const d = record.data,
    pics = d.gallery.filter((m) => m.kind === 'photo').length + Number(!!d.photo),
    budget = Math.min(1300, Math.floor(3600 / Math.max(1, pics)));
  async function forLink(id, kind) {
    if (!id) return '';
    const v = await getMedia(record.id, id);
    if (typeof v === 'string') return v;
    if (kind === 'photo') return linkPhoto(v, budget);
    if (v.size <= 3500) return dataURL(v);
    throw Error(
      'This film is too large for a guest link. Use “Add a media link” to replace it with a direct HTTPS video URL, or use Card to send the full file.',
    );
  }
  const media = {
    photo: await forLink(d.photo, 'photo'),
    video: await forLink(d.video, 'video'),
    gallery: {},
  };
  for (const m of d.gallery) media.gallery[m.id] = await forLink(m.id, m.kind);
  const slug = makeInvite(record.id, d, media);
  return transaction([drafts], 'readwrite', async (s) => {
    const row = await read(s(drafts).get(record.id));
    checkVersion(row, record.version);
    Object.assign(row, { slug, published: true, version: row.version + 1, updated: Date.now() });
    s(drafts).put(row);
    return row;
  });
}
