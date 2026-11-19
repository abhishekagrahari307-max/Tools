/*
 * Timeline Pro model checks.
 *
 * The editor's preview and its exporter both read the same model, so these
 * tests pin the behaviour that used to be missing: clips are placed at their
 * absolute start time, layers stack in the right order, gaps stay black, and
 * an overlapping clip does not shift its neighbours.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../audio-video/index.html', import.meta.url)), 'utf8');
const start = html.indexOf('/* ================= TIMELINE PRO: project model');
assert.ok(start > 0, 'the timeline model is missing from the page');
const end = html.indexOf('function renderTimelinePro(){', start);
const model = html.slice(start, end);

const api = new Function(model + '\nreturn {tlProjectDuration,tlClipsAt,tlVisualClips,tlAudioClips,tlRenderPlan,tlPreviewAt};')();
const { tlProjectDuration, tlClipsAt, tlVisualClips, tlAudioClips, tlRenderPlan, tlPreviewAt } = api;

const video = (start, dur, name = 'v') => ({ id: name, name, start, dur, file: { type: 'video/mp4', name } });
const image = (start, dur) => ({ id: 'i', name: 'img', start, dur, file: { type: 'image/png', name: 'x.png' } });
const audio = (start, dur) => ({ id: 'a', name: 'song', start, dur, file: { type: 'audio/mpeg', name: 'a.mp3' } });
const text = (start, dur, body = 'Hello') => ({ id: 't', name: body, start, dur, text: body });
const project = (tracks) => tracks.map((clips, i) => ({
  type: ['video', 'overlay', 'audio', 'voice', 'subtitle'][i] || 'video',
  clips,
}));

test('timeline length is the end of the last clip', () => {
  assert.equal(tlProjectDuration(project([[video(0, 4)], [], [], [], []])), 4);
  assert.equal(tlProjectDuration(project([[video(0, 4)], [], [audio(2, 10)]])), 12, 'an audio tail extends the project');
  assert.ok(tlProjectDuration(project([[], [], [], [], []])) > 0, 'an empty project still has a length');
});

test('clips are placed at their absolute start, not back to back', () => {
  const p = project([[video(0, 2), video(5, 3)], [], [], [], []]);
  assert.equal(tlVisualClips(p, 1).length, 1, 'first clip visible at 1 s');
  assert.equal(tlVisualClips(p, 3).length, 0, 'the 2-5 s gap shows nothing (black frame)');
  assert.equal(tlVisualClips(p, 6).length, 1, 'second clip visible at 6 s');
  assert.equal(tlVisualClips(p, 6)[0].local, 1, 'local time inside the clip is measured from its start');
  assert.equal(tlPreviewAt(p, 6).video.clip.start, 5);
});

test('layers stack video → audio → overlay → subtitle', () => {
  const p = project([[video(0, 10)], [text(0, 10, 'BIG')], [audio(0, 10)], [], [text(0, 10, 'caption')]]);
  const order = tlClipsAt(p, 1).map(c => c.type);
  assert.deepEqual(order, ['video', 'audio', 'overlay', 'subtitle']);
  const preview = tlPreviewAt(p, 1);
  assert.equal(preview.video.clip.id, 'v', 'the picture layer is the video clip');
  assert.deepEqual(preview.overlays.map(o => o.type), ['overlay', 'subtitle'], 'text sits on top of the video');
});

test('a half-open range never double-counts a clip boundary', () => {
  const p = project([[video(0, 2), video(2, 2)]], [[], [], [], []]);
  assert.equal(tlVisualClips(p, 2).length, 1, 'exactly at 2 s only the second clip is live');
  assert.equal(tlVisualClips(p, 2)[0].clip.start, 2);
  assert.equal(tlVisualClips(p, 1.99)[0].clip.start, 0);
});

test('audio and voice tracks are collected for the mix, text tracks are not', () => {
  const p = project([[video(0, 5)], [text(0, 5)], [audio(1, 2)], [], [text(0, 5, 'sub')]]);
  const at1 = tlAudioClips(p, 1.5).map(a => a.type);
  assert.deepEqual(at1, ['video', 'audio'], 'the video soundtrack is mixed alongside the music');
  assert.equal(tlAudioClips(p, 4).length, 1, 'only the video soundtrack by 4 s');
  assert.ok(tlVisualClips(p, 1.5).every(c => c.type !== 'audio'), 'audio never paints a frame');
});

test('the render plan covers the whole project exactly once', () => {
  const p = project([[video(0, 2), video(3, 2)], [text(1, 1)], [audio(0, 4)], [], []]);
  const plan = tlRenderPlan(p);
  assert.equal(plan.duration, 5);
  assert.ok(plan.segments.length >= 4, 'each clip boundary starts a new segment');
  assert.equal(plan.segments[0].start, 0);
  assert.equal(plan.segments[plan.segments.length - 1].end, plan.duration);
  for (let i = 1; i < plan.segments.length; i++) {
    assert.equal(plan.segments[i].start, plan.segments[i - 1].end, 'segments must be contiguous');
    assert.ok(plan.segments[i].end > plan.segments[i].start, 'no empty segment');
  }
  const total = plan.segments.reduce((a, s) => a + (s.end - s.start), 0);
  assert.ok(Math.abs(total - plan.duration) < 1e-6, 'segments must add up to the project length');
});

test('the plan knows when it has nothing to draw', () => {
  const plan = tlRenderPlan(project([[video(0, 2)], [text(0, 2, 'only text')], [], [], []]));
  assert.ok(plan.segments.every(s => s.visual.length > 0), 'a text clip still counts as a visual layer');
  const empty = tlRenderPlan(project([[], [], [], [], []]));
  assert.equal(empty.segments.filter(s => s.visual.length).length, 0, 'an empty project has nothing to draw');
});

test('text-only projects preview the text layer and no video', () => {
  const p = project([[], [text(0, 3, 'TITLE')], [], [], []]);
  const preview = tlPreviewAt(p, 1);
  assert.equal(preview.video, null);
  assert.equal(preview.top.clip.text, 'TITLE');
  assert.equal(preview.layers, 1);
});
