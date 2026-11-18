// Pages adaptation of the supplied wish.ts. The stable IDs and field order are
// the v1 guest contract. There is no owner cookie or server-side lookup.
import {
  pack,
  unpack,
  LinkSizeError,
  MAX_LINK,
} from '../celebration-studio/public/pages/snapshot-v1.js';
export { newID } from '../celebration-studio/public/pages/snapshot-v1.js';
export const templates = [
  {
    id: 'peach',
    name: 'Peach Confetti',
    category: 'Playful',
    description: 'A little sprinkle of joy',
    color: '#d87961',
    art: 'art/peach.webp',
  },
  {
    id: 'midnight',
    name: 'Midnight Magic',
    category: 'Elegant',
    description: 'For a star like them',
    color: '#cba66c',
  },
  {
    id: 'bloom',
    name: 'Birthday in Bloom',
    category: 'Elegant',
    description: 'Love, in full bloom',
    color: '#a1737b',
    art: 'art/bloom.webp',
  },
  {
    id: 'pop',
    name: 'Let’s Celebrate',
    category: 'Playful',
    description: 'Big birthday energy',
    color: '#8d79bb',
  },
  {
    id: 'golden',
    name: 'Golden Moments',
    category: 'Minimal',
    description: 'Another beautiful chapter',
    color: '#9c8251',
  },
  {
    id: 'simple',
    name: 'Simply, With Love',
    category: 'Minimal',
    description: 'The little things matter',
    color: '#789183',
  },
];
export const tracks = {
  birthday: 'Birthday melody',
  dreamy: 'Dreamy waltz',
  celebrate: 'Let’s celebrate',
  none: 'No music',
};
export const notes = {
  en: {
    headline: 'Happy Birthday',
    message: 'Here’s to more laughter, little adventures, and all the things that make you, you.',
    letter:
      'Some people make the world a little brighter just by being in it. You’re one of those people.\n\nI hope your day is filled with as much happiness as you bring to everyone around you. So grateful to have you in my life.',
  },
  hi: {
    headline: 'जन्मदिन मुबारक',
    message: 'आज का दिन तुम्हारे नाम। हर छोटी खुशी तुम्हें ढूँढ़ती हुई आए।',
    letter:
      'साल बदलते हैं, पर तुम्हारे साथ बिताए छोटे-छोटे पल याद रहते हैं। आज उन्हीं यादों के नाम यह चिट्ठी।\n\nचाहत है कि आने वाला हर दिन तुम्हें हँसने की एक नई वजह दे। ढेर सारा प्यार!',
  },
};
export const freshWish = () => ({
  template: 'peach',
  recipient: '',
  sender: '',
  date: '',
  age: '',
  ...notes.en,
  photos: [],
  music: 'birthday',
  confetti: true,
  reveal: true,
  accent: templates[0].color,
});
export const templateOf = (id) => templates.find((t) => t.id === id);
export const limits = {
  recipient: 60,
  sender: 60,
  date: 10,
  age: 3,
  headline: 70,
  message: 240,
  letter: 3000,
};
const order = [
  'template',
  ...Object.keys(limits),
  'music',
  'confetti',
  'reveal',
  'accent',
  'photos',
];
export const maxPhotos = 6;
const owns = (o, key) => Object.prototype.hasOwnProperty.call(o, key);
function check(value, field, msg) {
  if (!value) {
    const e = new Error(msg);
    e.field = field;
    throw e;
  }
}
export function checkWish(raw, { draft = false } = {}) {
  check(
    raw && typeof raw === 'object' && !Array.isArray(raw),
    'template',
    'The birthday letter is incomplete.',
  );
  check(templateOf(raw.template), 'template', 'Choose one of the six birthday templates.');
  const d = { template: raw.template };
  for (const [key, limit] of Object.entries(limits)) {
    check(
      typeof raw[key] === 'string' && raw[key].length <= limit,
      key,
      `Check the ${key} field (up to ${limit} characters).`,
    );
    d[key] = draft ? raw[key] : raw[key].trim();
  }
  if (!draft) {
    check(d.recipient, 'recipient', 'Add the birthday person’s name · नाम भरें।');
    check(d.sender, 'sender', 'Add your name so they know who sent the letter · अपना नाम भरें।');
    check(
      !d.age || /^\d{1,3}$/.test(d.age),
      'age',
      'Enter up to three digits for age or leave it blank.',
    );
    check(
      !d.date ||
        (/^\d{4}-\d{2}-\d{2}$/.test(d.date) &&
          Number.isFinite(Date.parse(d.date)) &&
          new Date(d.date).toISOString().startsWith(d.date + 'T')),
      'date',
      'Choose a valid birthday date.',
    );
  }
  check(
    typeof raw.music === 'string' && owns(tracks, raw.music),
    'music',
    'Choose a listed soundtrack.',
  );
  check(
    typeof raw.accent === 'string' && /^#[a-f0-9]{6}$/i.test(raw.accent),
    'accent',
    'Choose a valid ink color.',
  );
  check(
    typeof raw.confetti === 'boolean' && typeof raw.reveal === 'boolean',
    'reveal',
    'Invalid reveal or confetti setting.',
  );
  check(
    Array.isArray(raw.photos) &&
      raw.photos.length <= maxPhotos &&
      raw.photos.every(
        (p) =>
          typeof p === 'string' &&
          p.length <= 850000 &&
          /^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/]+={0,2}$/.test(p),
      ),
    'photos',
    'Choose up to six JPG, PNG or WebP photographs.',
  );
  return {
    ...d,
    music: raw.music,
    confetti: raw.confetti,
    reveal: raw.reveal,
    accent: raw.accent,
    photos: [...raw.photos],
  };
}
export function wishURL(raw, base) {
  const d = checkWish(raw),
    url = new URL('./', base);
  if (!['http:', 'https:'].includes(url.protocol))
    throw Error('Open Wishlys on its website to create a guest link.');
  // Do not compress megabytes of draft photos just to discover a chat link cannot hold them.
  if (d.photos.reduce((n, p) => n + p.length, 0) > 48000)
    throw new LinkSizeError('Photos are too large for a link.');
  url.hash = '/wish/' + pack(['wishlys', ...order.map((k) => d[k])]);
  if (url.href.length > MAX_LINK)
    throw new LinkSizeError('This letter exceeds the 8,000-character link limit.');
  return url.href;
}
export function readWish(token) {
  const a = unpack(token);
  if (!Array.isArray(a) || a.length !== order.length + 1 || a[0] !== 'wishlys')
    throw Error('This is not a complete Wishlys letter. Ask the sender to copy the full link.');
  return checkWish(Object.fromEntries(order.map((k, i) => [k, a[i + 1]])));
}
