// Node 22+, no install. Exercise the same codec/catalog as the public Pages reader.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { state, designOf, designsFor, art } from '../celebration-studio/public/shared.js';
import {
  startCard,
  newID,
  makeInvite,
  readInvite,
  readReply,
  pack,
  unpack,
  httpsMedia,
  contacts,
} from '../celebration-studio/public/pages/links.js';
import { editionsV1 } from '../celebration-studio/public/pages/editions-v1.js';
import {
  addPreset,
  listPresets,
  deletePreset,
  readPreset,
  cardFromPreset,
} from '../celebration-studio/public/pages/presets.js';
import { createHash } from 'node:crypto';
const seed = JSON.parse(
  readFileSync(new URL('../celebration-studio/public/pages/catalog-v1.json', import.meta.url)),
);
state.catalog = editionsV1(seed);
const id = newID(),
  card = () => ({ ...startCard(designOf('wedding-nocturne')), person: 'आशा', host: 'A & K' });

test('each of 13 occasions has exactly 100 distinct, reproducible templates, including its original three', () => {
  assert.equal(seed.templates.length, 39);
  assert.equal(state.catalog.occasions.length, 13);
  assert.deepEqual(editionsV1(seed), state.catalog);
  const codes = new Set(),
    plates = new Set();
  for (const e of state.catalog.occasions) {
    const ts = designsFor(e.id);
    assert.equal(ts.length, 100);
    assert.equal(new Set(ts.map((t) => t.name)).size, 100);
    assert.deepEqual(
      ts.slice(0, 3),
      seed.templates.filter((t) => t.occasion === e.id),
    );
    assert.equal(e.pages.length, 6);
    for (const t of ts) {
      codes.add(t.code);
      const image = art(t);
      assert(image.startsWith('data:image/svg+xml;'));
      plates.add(createHash('sha256').update(image).digest('hex'));
      const d = { ...startCard(t), person: 'गेस्ट 🎉' };
      for (const [key, menu] of Object.entries({
        palette: 'palettes',
        opening: 'openings',
        font: 'fonts',
        music: 'music',
      }))
        assert(Object.hasOwn(state.catalog[menu], d[key]), t.code + ' ' + key);
      const token = makeInvite(id, d, {});
      assert.ok(token.length < 200);
      assert.deepEqual(readInvite(unpack(token)).data, d);
    }
  }
  assert.equal(codes.size, 1300);
  assert.equal(plates.size, 1300);
});
test('a personal template is reusable but its private key and label never become a guest dependency', () => {
  const values = new Map();
  globalThis.localStorage = {
    get length() {
      return values.size;
    },
    key: (i) => [...values.keys()][i],
    setItem: (k, v) => values.set(k, v),
    getItem: (k) => values.get(k) ?? null,
    removeItem: (k) => values.delete(k),
  };
  try {
    values.set('wishcraft.v1.drafts', 'unrelated');
    values.set('celebration.pages.preset.v1.badrecord0000000', 'not JSON');
    const base = 'diwali-v1-garden-citron',
      v = {
        base,
        name: '  Only on my phone  ',
        palette: 'press-lapis',
        font: 'hand',
        opening: 'diya',
        music: 'festive',
        language: 'hi',
        message: 'दीप जलाएँ।',
        email: 'private@example.test',
      };
    assert.throws(() => addPreset({ ...v, name: '   ' }));
    assert.throws(() => addPreset({ ...v, font: 'toString' }));
    assert.throws(() => addPreset({ ...v, base: 'nonexistent' }));
    const p = addPreset(v);
    assert.equal(readPreset(p.id).name, 'Only on my phone');
    assert.deepEqual(listPresets('diwali'), [p]);
    assert.deepEqual(listPresets('birthday'), []);
    const d = cardFromPreset(readPreset(p.id)),
      other = cardFromPreset(p);
    d.person = 'Party';
    assert.equal(other.person, '');
    assert.equal(d.email, '');
    const token = makeInvite(id, d, {});
    const raw = unpack(token);
    assert.equal(raw[1], base);
    assert(!JSON.stringify(raw).includes(p.id));
    assert(!JSON.stringify(raw).includes(p.name));
    deletePreset(p.id);
    assert.throws(() => readPreset(p.id));
    assert.deepEqual(listPresets('diwali'), []);
    const result = readInvite(raw);
    assert.deepEqual(result.data, d);
    assert.equal(result.data.message, 'दीप जलाएँ।');
    assert.equal(values.get('wishcraft.v1.drafts'), 'unrelated');
  } finally {
    delete globalThis.localStorage;
  }
});
test('guest copy is self-contained, bilingual, versioned and excludes device IDs, unused contact & replies', () => {
  const d = {
    ...card(),
    message: 'निमंत्रण ❤️',
    messageAlt: 'Welcome!',
    fields: { partner: 'Rahul' },
    email: 'private@example.org',
    photo: 'local-only-id',
    gallery: [{ kind: 'video', id: 'another-private-id', caption: 'फिल्म' }],
    replies: ['a guest name'],
  };
  const data = {
    photo: 'data:image/png;base64,aGVsbG8=',
    gallery: { 'another-private-id': 'https://media.example.org/film.webm' },
  };
  const token = makeInvite(id, d, data),
    raw = unpack(token),
    invite = readInvite(raw);
  assert.doesNotMatch(JSON.stringify(raw), /private|guest name|local-only/);
  assert.equal(invite.media.photo, data.photo);
  assert.equal(invite.media.gallery.g0, data.gallery['another-private-id']);
  assert.equal(invite.data.messageAlt, d.messageAlt);
  assert.equal(invite.data.fields.partner, 'Rahul');
  d.person = 'Updated';
  assert.notEqual(makeInvite(id, d, data), token);
  assert.equal(readInvite(unpack(token)).data.person, 'आशा');
});
test('links reject oversized, unknown-version, corrupt and out-of-schema data', () => {
  const token = pack(['reader']),
    corrupt = Buffer.from(token.slice(3), 'base64url');
  corrupt[corrupt.length - 1] ^= 5;
  for (const bad of [
    '',
    token.slice(0, -4),
    'v2.AA',
    'v1.XXX!',
    'v1.' + 'A'.repeat(8000),
    'v1.' + corrupt.toString('base64url'),
    'v1.' + deflateSync(Buffer.alloc(70000, 65)).toString('base64url'),
  ])
    assert.throws(() => unpack(bad));
  for (const delta of [
    { date: '2027-02-30' },
    { time: '30:11' },
    { fields: { badKey: 'oops' } },
    { palette: 'toString' },
    { photo: 'data:text/html;base64,Zm9v' },
    { video: 'blob:local' },
    { map: 'https://example.org/' },
    { gallery: Array(9).fill('g') },
    { messageAlt: 'a'.repeat(1601) },
    JSON.parse('{"__proto__":{"altered":true}}'),
  ])
    assert.throws(() => readInvite([id, 'wedding-nocturne', { person: 'x', ...delta }]));
  for (const url of [
    'http://example.org/v',
    'blob:x',
    'data:image/svg+xml,anything',
    'https://user@public.example/a',
    'https://localhost/secret',
    'https://192.168.1.1/f',
    'https://127.0.0.2/v',
  ])
    assert.throws(() => httpsMedia(url));
  assert.throws(() => readInvite([id, 'missing-edition', { person: 'x' }]));
});
test('RSVP requires an intentional destination; slip identifies the invitation and bounds the party', () => {
  assert.throws(() => contacts({ ...card(), rsvp: true }));
  for (const invalid of [
    { phone: '++9199' },
    { email: 'host@example.org\nbcc:X' },
    { phone: 'call123abc' },
  ])
    assert.throws(() => contacts({ ...card(), rsvp: true, ...invalid }));
  const c = { ...card(), rsvp: true, phone: '+91 (98765) 43210', email: 'host+demo@example.org' };
  assert.deepEqual(contacts(c), { phone: '919876543210', email: c.email });
  assert.equal(readInvite(unpack(makeInvite(id, c, {}))).data.email, c.email);
  const receipt = newID(),
    r = [id, receipt, c.person, 'Guest', 'yes', 3, 'दोस्त'];
  assert.deepEqual(readReply(unpack(pack(r))), {
    invite: id,
    key: receipt,
    event: 'आशा',
    name: 'Guest',
    attendance: 'yes',
    party: 3,
    note: 'दोस्त',
  });
  for (const [answer, seats] of [
    ['no', 2],
    ['yes', 0],
    ['yes', 21],
    ['maybe', 1],
  ])
    assert.throws(() => readReply([...r.slice(0, 4), answer, seats, '']));
});

test('minute-only mobile times (including in existing drafts) serialize without changing the v1 format', () => {
  const d = {
    ...startCard(designOf('birthday-signature')),
    person: 'Pari',
    time: '18:30:00.000',
    fields: { cakeTime: '19:15:00' },
  };
  const r = readInvite(unpack(makeInvite(id, d, {})));
  assert.equal(r.data.time, '18:30');
  assert.equal(r.data.fields.cakeTime, '19:15');
  for (const invalid of ['24:00:00', '11:30:47'])
    assert.throws(() => makeInvite(id, { ...d, time: invalid }, {}));
});
test('a compact alternative lists omitted media, keeps linked films/captions and never changes the editable draft', async () => {
  const { prepareLink } = await import('../celebration-studio/public/pages/portable.js');
  const d = {
      ...card(),
      video: 'local-big',
      photo: 'cover',
      gallery: [{ id: 'public-film', kind: 'video', caption: 'Blessings' }],
    },
    original = structuredClone(d);
  const urls = {
    cover: 'https://media.example.org/photo.jpg',
    'public-film': 'https://media.example.org/film.webm',
    'local-big': new Blob([new Uint8Array(4000)], { type: 'video/webm' }),
  };
  const result = await prepareLink(id, d, (key) => urls[key]);
  const r = readInvite(unpack(result.slug));
  assert.equal(result.omitted.length, 1);
  assert.match(result.omitted[0], /Featured film/);
  assert.equal(r.data.video, '');
  assert.equal(r.media.photo, urls.cover);
  assert.equal(r.media.gallery.g0, urls['public-film']);
  assert.equal(r.data.gallery[0].caption, 'Blessings');
  assert.deepEqual(d, original);
  await assert.rejects(() => prepareLink(id, { ...d, rsvp: true }, (key) => urls[key]), /page 06/);
});

test('previously delivered v1 guest links still decode', () => {
  const issued =
    'v1.eNqLVip1LnD0iIzwN8hPdTfLSSxW0lFKyiwqyUhJrNQtzkzPSywpLUpV0qlWKkgtKs7PU7JSerBkzoMlKx4s7X2wZN2DJcseLNkP5Co8WDL1wZJ9QAoouQ0suQJoVG5pcWYyUE9efl6qUm0sAHF7M80';
  assert.equal(readInvite(unpack(issued)).data.person, 'जन्मदिन का जश्न');
});
test('over-budget attachments yield an explicitly labelled text link, not truncated invitation text', async () => {
  const { prepareLink } = await import('../celebration-studio/public/pages/portable.js');
  const { randomBytes } = await import('node:crypto');
  const d = {
    ...card(),
    message: 'नमस्ते 🙏',
    gallery: Array.from({ length: 8 }, (_, i) => ({
      id: 'm' + i,
      kind: 'photo',
      caption: 'Album memory ' + i,
    })),
  };
  const result = await prepareLink(
    id,
    d,
    () => 'https://media.example.org/' + randomBytes(1060).toString('base64url'),
  );
  assert.equal(result.omitted.length, 8);
  assert.equal(result.omitted[7], 'Album 8 · Album memory 7');
  const { data } = readInvite(unpack(result.slug));
  assert.equal(data.message, d.message);
  assert.deepEqual(data.gallery, []);
});
