// The separate Wishlys studio keeps its own v1 guest contract and draft limits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  templates,
  freshWish,
  checkWish,
  wishURL,
  readWish,
  limits,
  tracks,
  notes,
} from '../wishlys-studio/model.js';
import { pack, unpack, LinkSizeError } from '../celebration-studio/public/pages/snapshot-v1.js';
import {
  pack as legacyPack,
  unpack as legacyUnpack,
} from '../celebration-studio/public/pages/links.js';

const base = 'https://abhishekagrahari307-max.github.io/Tools/wishlys-studio/';
const filled = {
  ...freshWish(),
  recipient: 'Aarohi',
  sender: 'Ananya',
  date: '1997-02-14',
  age: '28',
};
const tokenOf = (url) => url.slice(url.indexOf('#/wish/') + 7);

test('six supplied stations stay addressable by their stable ids', () => {
  assert.deepEqual(
    templates.map((t) => t.id),
    ['peach', 'midnight', 'bloom', 'pop', 'golden', 'simple'],
  );
  assert.equal(new Set(templates.map((t) => t.name)).size, 6);
  assert.deepEqual(Object.keys(tracks), ['birthday', 'dreamy', 'celebrate', 'none']);
});

test('a complete letter survives the guest link with its text, photos and switches', () => {
  const photo =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
  const wish = {
    ...filled,
    photos: [photo],
    music: 'celebrate',
    confetti: false,
    accent: '#8d79bb',
  };
  const url = wishURL(wish, base);
  assert.equal(new URL(url).origin, 'https://abhishekagrahari307-max.github.io');
  assert.equal(new URL(url).pathname, '/Tools/wishlys-studio/');
  const back = readWish(tokenOf(url));
  assert.equal(back.recipient, 'Aarohi');
  assert.equal(back.headline, wish.headline);
  assert.equal(back.message, wish.message);
  assert.equal(back.letter, wish.letter);
  assert.equal(back.music, 'celebrate');
  assert.equal(back.confetti, false);
  assert.equal(back.reveal, true);
  assert.equal(back.accent, '#8d79bb');
  assert.deepEqual(back.photos, [photo]);
  assert.equal(back.date, '1997-02-14');
  assert.equal(back.age, '28');
});

test('guest links are additive and reject other studios, truncation and tampering', () => {
  const token = tokenOf(wishURL(filled, base));
  assert.ok(token.startsWith('v1.'));
  assert.throws(() => readWish(token.slice(0, -6)), /incomplete|invalid/i);
  assert.throws(() => readWish('v2.' + token.slice(3)), /incomplete|invalid/i);
  const swapped = pack(['wishcraft', ...unpack(token).slice(1)]);
  assert.throws(() => readWish(swapped), /complete Wishlys letter/);
  const extra = pack([...unpack(token), 'x']);
  assert.throws(() => readWish(extra), /complete Wishlys letter/);
  assert.throws(() => readWish('not-a-token'), /incomplete|invalid/i);
});

test('empty and malformed fields fail with a field-specific message', () => {
  const bad = (patch) =>
    assert.throws(
      () => checkWish({ ...filled, ...patch }),
      (e) => typeof e.field === 'string' && e.message.length > 8,
    );
  bad({ recipient: '   ' });
  bad({ sender: '' });
  bad({ template: 'classic' });
  bad({ date: '2023-02-30' });
  bad({ date: '14/02/1997' });
  bad({ age: '1234' });
  bad({ age: 'x' });
  bad({ message: 'x'.repeat(limits.message + 1) });
  bad({ letter: 'x'.repeat(limits.letter + 1) });
  bad({ headline: 'x'.repeat(limits.headline + 1) });
  bad({ music: 'lofi' });
  bad({ accent: 'red' });
  bad({ confetti: 'yes' });
  bad({ photos: Array.from({ length: 7 }, () => 'data:image/png;base64,AA') });
  bad({ photos: ['javascript:alert(1)'] });
  bad({ photos: ['data:image/svg+xml;base64,AA'] });
});

test('both languages start from their own supplied copy', () => {
  assert.match(notes.hi.headline, /जन्मदिन/);
  assert.match(notes.en.headline, /Happy Birthday/);
  assert.notEqual(notes.hi.letter, notes.en.letter);
  assert.equal(freshWish().likes, undefined);
});

test('oversized albums are refused before an unusable chat link is produced', () => {
  const photo = 'data:image/jpeg;base64,' + 'A'.repeat(40000);
  assert.throws(() => wishURL({ ...filled, photos: [photo, photo] }, base), LinkSizeError);
  assert.throws(() => wishURL(filled, 'file:///home/user/Tools/wishlys-studio/'), /website/);
});

test('the shared transport still matches the Celebration contract exactly', () => {
  const value = { hello: 'world', count: 3 };
  assert.equal(legacyPack(value), pack(value));
  assert.deepEqual(legacyUnpack(legacyPack(value)), value);
  assert.deepEqual(unpack(pack(value)), value);
});
