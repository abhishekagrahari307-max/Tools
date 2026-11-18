// Node 22+, no install. Exercise the same codec/catalog as the public Pages reader.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { state, designOf } from '../celebration-studio/public/shared.js';
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
state.catalog = JSON.parse(
  readFileSync(new URL('../celebration-studio/public/pages/catalog-v1.json', import.meta.url)),
);
const id = newID(),
  card = () => ({ ...startCard(designOf('wedding-nocturne')), person: 'आशा', host: 'A & K' });

test('39 real editions share the six-chapter catalog; empty deltas recover the original defaults', () => {
  assert.equal(state.catalog.occasions.length, 13);
  assert.equal(state.catalog.templates.length, 39);
  for (const d of state.catalog.templates) {
    const c = { ...startCard(d), person: 'गेस्ट 🎉' };
    const token = makeInvite(id, c, {});
    assert.ok(token.length < 200);
    const result = readInvite(unpack(token));
    assert.deepEqual(result.data, c);
    assert.equal(state.catalog.occasions.find((e) => e.id === d.occasion).pages.length, 6);
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
