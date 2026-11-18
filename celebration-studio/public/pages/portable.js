// Build from the active invitation, not a saved row. No writes, uploads, or QR
// rendering belong here. A smaller candidate is NOT shared until the host accepts it.
import { makeInvite, LinkSizeError } from './links.js';

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
      if (/^data:image\/(webp|png);base64,/.test(thumb) && thumb.length < (4 * budget) / 3 + 23)
        return thumb;
    }
  } catch {
    /* If the browser cannot make a thumbnail, offer a clearly labelled alternative. */
  } finally {
    URL.revokeObjectURL(url);
  }
  return '';
}
export async function prepareLink(id, data, resolveMedia) {
  const items = [
    ...(data.photo
      ? [{ slot: 'photo', id: data.photo, kind: 'photo', label: 'Cover photo · कवर फ़ोटो' }]
      : []),
    ...(data.video
      ? [{ slot: 'video', id: data.video, kind: 'video', label: 'Featured film · मुख्य वीडियो' }]
      : []),
    ...data.gallery.map((m, i) => ({
      slot: 'gallery',
      ...m,
      label: `Album ${i + 1} · ${m.caption || (m.kind === 'photo' ? 'फ़ोटो' : 'वीडियो')}`,
    })),
  ];
  const photos = items.filter((m) => m.kind === 'photo').length;
  const budget = Math.min(1300, Math.floor(3600 / Math.max(1, photos)));
  for (const m of items) {
    const value = await resolveMedia(m.id);
    m.src =
      typeof value === 'string'
        ? value
        : m.kind === 'photo'
          ? await linkPhoto(value, budget)
          : value.size <= 3500
            ? await dataURL(value)
            : '';
  }
  const candidate = (include) => {
    const d = { ...data, photo: '', video: '', gallery: [] },
      media = { gallery: {} },
      omitted = [];
    for (const m of items) {
      if (!m.src || !include(m)) {
        omitted.push(m.label);
        continue;
      }
      if (m.slot === 'gallery') {
        d.gallery.push({ id: m.id, kind: m.kind, caption: m.caption });
        media.gallery[m.id] = m.src;
      } else {
        d[m.slot] = m.id;
        media[m.slot] = m.src;
      }
    }
    return { slug: makeInvite(id, d, media), omitted };
  };
  try {
    return candidate(() => true);
  } catch (e) {
    if (!(e instanceof LinkSizeError) || !items.length) throw e;
  }
  // Keep externally linked media if possible. Never truncate text, disable RSVP,
  // or mutate the draft to squeeze into a chat URL.
  try {
    return candidate((m) => m.src.startsWith('https://'));
  } catch (e) {
    if (!(e instanceof LinkSizeError)) throw e;
  }
  return candidate(() => false);
}
