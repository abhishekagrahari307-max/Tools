// Device-only organizer workspace. The public reader never looks up a local draft.
import { newID, httpsMedia } from './links.js';
import { prepareLink } from './portable.js';

const drafts = 'drafts',
  media = 'media',
  replies = 'replies';
let opening;
function db() {
  if (!opening)
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open('celebration.pages.v1', 1);
      let abandoned = false;
      const fail = (text) => {
        abandoned = true;
        clearTimeout(timer);
        reject(Error(text));
      };
      // Some WebViews leave open() pending instead of reporting a storage error.
      const timer = setTimeout(
        () => fail('Device storage did not open. Keep this tab open and try Save draft again.'),
        8000,
      );
      req.onblocked = () =>
        fail(
          'Device storage is busy in another tab. Close the other studio tab and try Save draft again.',
        );
      req.onupgradeneeded = () => {
        const d = req.result;
        d.createObjectStore(drafts, { keyPath: 'id' });
        d.createObjectStore(media, { keyPath: ['invite', 'id'] });
        d.createObjectStore(replies, { keyPath: ['invite', 'key'] });
      };
      req.onsuccess = () => {
        clearTimeout(timer);
        if (abandoned) {
          req.result.close();
          return;
        }
        req.result.onversionchange = () => {
          req.result.close();
          opening = null;
        };
        resolve(req.result);
      };
      req.onerror = () =>
        fail('Cannot open device storage. Allow site storage to save drafts in this browser.');
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
// Commit the draft, its *new* attachments, and its last accepted link together.
// Reuse the session ID on retry; never overwrite a newer or deleted draft.
async function persist(id, { data, version }, slug, attachments) {
  return transaction([drafts, media], 'readwrite', async (s) => {
    const old = await read(s(drafts).get(id));
    const row = !old && version === 0 ? { id, version: 0 } : old;
    checkVersion(row, version);
    const live = new Set(refs(data));
    for (const key of old ? refs(old.data) : []) if (!live.has(key)) s(media).delete([id, key]);
    for (const [key, value] of attachments)
      if (live.has(key)) s(media).put({ invite: id, id: key, value });
    Object.assign(row, {
      data,
      slug,
      published: !!slug,
      updated: Date.now(),
      version: version + 1,
    });
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
// The editing session owns its media even before the first successful save. An
// IndexedDB write (including one stuck behind another tab) never gates sharing.
export function openDraft(record) {
  const id = record.id || newID(),
    originals = new Map(),
    pending = new Map();
  async function getMedia(key) {
    if (!originals.has(key)) {
      const item = await get(media, [id, key]);
      if (!item) throw Error('A local file is missing. Add it again or remove it from the draft.');
      originals.set(key, item.value);
    }
    return originals.get(key);
  }
  return {
    getMedia,
    prepareLink: (data) => prepareLink(id, data, getMedia),
    addMedia(kind, value) {
      if (typeof value === 'string') value = httpsMedia(value.trim());
      else if (
        !(value instanceof Blob) ||
        !types[kind]?.includes(value.type) ||
        !value.size ||
        value.size > (kind === 'photo' ? 4 : 12) * 1024 ** 2
      )
        throw Error('Choose JPG, PNG or WebP (up to 4 MB) or MP4 or WebM (up to 12 MB).');
      const key = newID();
      originals.set(key, value);
      pending.set(key, value);
      return { id: key, kind };
    },
    forget(key) {
      originals.delete(key);
      pending.delete(key);
    },
    async save(body, slug) {
      const batch = new Map(pending);
      const row = await persist(id, body, slug, batch);
      for (const key of batch.keys()) pending.delete(key);
      return row;
    },
  };
}
