// Transport shared by the static studios: zlib + base64url with a CRC check so a
// truncated chat link fails closed. Payload allowlists stay with each studio.
import { zlibSync, unzlibSync } from './vendor/codecs.js';
export const MAX_LINK = 8000;
const MAX_RAW = 64 * 1024;
const b64 = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
export const newID = () => b64(crypto.getRandomValues(new Uint8Array(12)));
export class LinkSizeError extends Error {}
export function need(
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
