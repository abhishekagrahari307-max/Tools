import { checkWish, wishURL } from './model.js';
import { LinkSizeError } from '../celebration-studio/public/pages/snapshot-v1.js';
function loadImage(src) {
  return new Promise((ok, no) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => no(Error('That image could not be opened. Try a JPG, PNG or WebP.'));
    im.src = src;
  });
}
function resize(im, edge, format, quality) {
  const ratio = Math.min(1, edge / Math.max(im.naturalWidth, im.naturalHeight));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(im.naturalWidth * ratio));
  cv.height = Math.max(1, Math.round(im.naturalHeight * ratio));
  const ctx = cv.getContext('2d');
  if (!ctx)
    throw Error(
      'This browser cannot resize photos. Try a different browser or make a letter without photos.',
    );
  ctx.fillStyle = '#fffaf2';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(im, 0, 0, cv.width, cv.height);
  const out = cv.toDataURL(format, quality);
  if (!/^data:image\/(webp|jpeg|png);base64,/.test(out))
    throw Error('Photo conversion was unavailable.');
  return out;
}
export async function importPhoto(file) {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    !file.size ||
    file.size > 8 * 1024 * 1024
  )
    throw Error('Choose a JPG, PNG or WebP up to 8 MB per photo.');
  const url = URL.createObjectURL(file);
  try {
    const im = await loadImage(url);
    for (const size of [1024, 768, 512]) {
      const src = resize(im, size, 'image/jpeg', 0.82);
      if (src.length <= 850000) return src;
    }
    throw Error('This photo is too large. Choose a smaller version.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
// No save or permission prompt in the sharing path. Keep all photos together;
// a text-only alternative must be explicitly accepted and never edits the draft.
export async function prepareShare(raw, base) {
  const d = checkWish(raw),
    attempt = (photos) => {
      try {
        return wishURL({ ...d, photos }, base);
      } catch (e) {
        if (e instanceof LinkSizeError) return '';
        throw e;
      }
    };
  const full = attempt(d.photos);
  if (full) return { url: full, note: d.photos.length ? 'All photos included.' : '' };
  if (d.photos.length) {
    try {
      const loaded = await Promise.all(d.photos.map(loadImage));
      for (const edge of [144, 96, 64, 40, 24]) {
        const thumbs = loaded.map((im, i) => {
          const small = resize(im, edge, 'image/webp', 0.6);
          return small.length < d.photos[i].length ? small : d.photos[i];
        });
        const url = attempt(thumbs);
        if (url)
          return {
            url,
            note: 'All photos are included as small previews. The keepsake keeps the larger saved copies.',
          };
      }
    } catch {
      /* A disabled canvas must not prevent a text link or keepsake. */
    }
    const alternative = attempt([]);
    if (alternative) return { alternative, count: d.photos.length };
  }
  return { tooLong: true };
}
