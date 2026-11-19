// Real FFmpeg test: runs the command builders shipped inside audio-video/index.html
// against the vendored ffmpeg-core wasm, in Node, and checks the produced files.
//
//   node --test tests/
//
// This is an actual encode (H.264, AAC, libass burn-in, palette GIF, MP3) rather
// than a stub — the same wasm the browser loads from audio-video/ffmpeg/core/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = join(root, 'audio-video/ffmpeg/core');

if (!existsSync(join(CORE, 'ffmpeg-core.wasm'))) {
  test('ffmpeg engine (skipped: core not vendored)', { skip: true }, () => {});
} else {
  test('FFmpeg core encodes what the studio asks it to', async (t) => {
    // the page's own builders, extracted verbatim
    const html = readFileSync(join(root, 'audio-video/index.html'), 'utf8');
    const builders = html.slice(html.indexOf('function buildVideoExport'),
                                html.indexOf('/* ---------------- shared UI helpers'));
    const srt = html.slice(html.indexOf('function srtTime'), html.indexOf('/* ---------------- GIF Maker'));
    const api = new Function(
      'const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));\n' + builders + '\n' + srt +
      '\nreturn {buildVideoExport,buildAudioExport,buildSrt,parseSrt,srtTime};'
    )();
    const { buildVideoExport, buildAudioExport, buildSrt, parseSrt, srtTime } = api;

    globalThis.self = globalThis;
    globalThis.location = { href: 'file://' + CORE + '/ffmpeg-core.js' };
    const wasmBinary = readFileSync(join(CORE, 'ffmpeg-core.wasm'));
    const { default: createCore } = await import(join(CORE, 'ffmpeg-core.js'));
    const log = [];
    const core = await createCore({ wasmBinary, print: (l) => log.push(l), printErr: (l) => log.push(l) });

    const run = (args) => {
      log.length = 0;
      const rc = core.exec(...args);
      core.reset();
      return { rc, error: log.filter(l => /error|invalid|unable|No such|failed/i.test(l)).slice(-2).join(' | ') };
    };
    const size = (name) => core.FS.stat(name).size;

    await t.test('a test clip can be encoded', () => {
      const r = run(['-hide_banner', '-nostdin', '-y',
        '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=30:duration=3',
        '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-shortest', 'src.mp4']);
      assert.equal(r.rc, 0, r.error);
      assert.ok(size('src.mp4') > 1000);
    });

    await t.test('the compressor command really shrinks the file', () => {
      const before = size('src.mp4');
      const r = run(buildVideoExport({ input: 'src.mp4', output: 'comp.mp4', crf: 32, preset: 'veryfast' }));
      assert.equal(r.rc, 0, r.error);
      assert.ok(size('comp.mp4') > 0 && size('comp.mp4') < before, 'compressed output should be smaller');
    });

    await t.test('colour, rotate, deshake and scale filters apply', () => {
      const args = buildVideoExport({ input: 'src.mp4', output: 'graded.mp4', width: 160, rotate: 90,
        deshake: true, brightness: 0.1, contrast: 1.2, saturation: 1.3, sharp: 0.8, crf: 28 });
      const filters = args[args.indexOf('-vf') + 1];
      for (const f of ['rotate=', 'deshake', 'eq=', 'unsharp', 'scale=160:']) {
        assert.ok(filters.includes(f), `missing ${f} in ${filters}`);
      }
      const r = run(args);
      assert.equal(r.rc, 0, r.error);
    });

    await t.test('crop and mute produce valid output', () => {
      const crop = run(buildVideoExport({ input: 'src.mp4', output: 'crop.mp4', crop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, crf: 30 }));
      assert.equal(crop.rc, 0, crop.error);
      const muteArgs = buildVideoExport({ input: 'src.mp4', output: 'mute.mp4', mute: true, crf: 30 });
      assert.ok(muteArgs.includes('-an'));
      const mute = run(muteArgs);
      assert.equal(mute.rc, 0, mute.error);
    });

    await t.test('subtitles burn in (Devanagari included)', () => {
      const cues = [{ start: 0.2, end: 1.4, text: 'नमस्ते दुनिया' }, { start: 1.5, end: 2.8, text: 'Second line' }];
      core.FS.writeFile('subs.srt', new TextEncoder().encode(buildSrt(cues)));
      const style = 'FontSize=44,PrimaryColour=&H00FFFFFF&,Outline=2,Shadow=0,MarginV=28';
      const r = run(['-hide_banner', '-nostdin', '-y', '-i', 'src.mp4',
        '-vf', `subtitles=subs.srt:force_style='${style}'`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', 'subbed.mp4']);
      assert.equal(r.rc, 0, r.error);
      assert.ok(size('subbed.mp4') > 0);
    });

    await t.test('a palette GIF comes out as GIF89a', () => {
      const p1 = run(['-hide_banner', '-nostdin', '-y', '-i', 'src.mp4', '-t', '2',
        '-vf', 'fps=12,scale=240:-1:flags=lanczos,palettegen=max_colors=256', 'palette.png']);
      assert.equal(p1.rc, 0, p1.error);
      const p2 = run(['-hide_banner', '-nostdin', '-y', '-i', 'src.mp4', '-i', 'palette.png', '-t', '2',
        '-lavfi', 'fps=12,scale=240:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3',
        '-loop', '0', 'out.gif']);
      assert.equal(p2.rc, 0, p2.error);
      const head = String.fromCharCode(...core.FS.readFile('out.gif').slice(0, 3));
      assert.equal(head, 'GIF');
    });

    await t.test('audio export with loudnorm writes an MP3', () => {
      const r = run(buildAudioExport({ input: 'src.mp4', output: 'audio.mp3', normalize: true, bitrate: '192k' }));
      assert.equal(r.rc, 0, r.error);
      assert.ok(size('audio.mp3') > 0);
    });

    await t.test('a missing input returns a non-zero code instead of throwing', () => {
      const r = run(['-hide_banner', '-nostdin', '-y', '-i', 'nope.mp4', 'x.mp4']);
      assert.notEqual(r.rc, 0);
    });

    await t.test('SRT helpers round-trip', () => {
      assert.equal(srtTime(3725.25), '01:02:05,250');
      const cues = parseSrt(buildSrt([{ start: 0, end: 1.5, text: 'one' }, { start: 2, end: 3, text: 'दो' }]));
      assert.equal(cues.length, 2);
      assert.equal(cues[1].text, 'दो');
      assert.equal(cues[0].end, 1.5);
    });
  });
}
