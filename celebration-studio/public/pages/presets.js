// A personal template is a reusable starting point, NOT a new guest-link code.
// Copy only design settings and an optional message; never guests, contacts,
// files or draft IDs. One small key per preset so two tabs can add independently.
import { state, designOf, eventOf } from '../shared.js';
import { newID, startCard } from './links.js';
const prefix = 'celebration.pages.preset.v1.';
const validID = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{16}$/.test(id);
const settings = { palette: 'palettes', font: 'fonts', opening: 'openings', music: 'music' };

function clean(input) {
  const t = designOf(input.base);
  if (!t?.occasion) throw Error('Choose a base template from the library.');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 64) throw Error('Enter a template name (up to 64 characters).');
  if (
    !['en', 'hi'].includes(input.language) ||
    typeof input.message !== 'string' ||
    input.message.length > 1600
  )
    throw Error('Choose a language and use at most 1,600 characters for the starter message.');
  const p = { base: t.code, name, language: input.language, message: input.message.trim() };
  for (const [key, menu] of Object.entries(settings)) {
    const value = input[key];
    if (
      typeof value !== 'string' ||
      !Object.prototype.hasOwnProperty.call(state.catalog[menu], value)
    )
      throw Error('Choose a listed design setting.');
    p[key] = value;
  }
  return p;
}
export function addPreset(values) {
  const p = { ...clean(values), id: newID(), created: Date.now() };
  try {
    localStorage.setItem(prefix + p.id, JSON.stringify(p));
  } catch {
    throw Error('Template not saved. Allow site storage or free some space, then try again.');
  }
  return p;
}
function stored(id) {
  const text = localStorage.getItem(prefix + id);
  try {
    const p = JSON.parse(text);
    if (p?.id === id && Number.isFinite(p.created)) return { ...clean(p), id, created: p.created };
  } catch {
    /* Ignore a damaged record, not the rest of the library. */
  }
  return null;
}
export function readPreset(id) {
  if (validID(id)) {
    const p = stored(id);
    if (p) return p;
  }
  throw Error(
    'This personal template is not in this browser. To send an invitation, use Create guest link instead.',
  );
}
export function listPresets(occasion) {
  const rows = [];
  for (let n = 0; n < localStorage.length; n++) {
    const key = localStorage.key(n);
    if (!key?.startsWith(prefix)) continue;
    const id = key.slice(prefix.length),
      p = validID(id) && stored(id);
    if (p && designOf(p.base).occasion === occasion) rows.push(p);
  }
  return rows.sort((a, b) => b.created - a.created);
}
export function deletePreset(id) {
  if (validID(id)) localStorage.removeItem(prefix + id);
}
export function cardFromPreset(p) {
  const d = startCard(designOf(p.base));
  for (const key of Object.keys(settings)) d[key] = p[key];
  d.language = p.language;
  d.message =
    p.message.trim() || (p.language === 'en' ? eventOf(d.occasion).englishMessage : d.message);
  return d;
}
