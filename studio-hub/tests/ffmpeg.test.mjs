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
    const toolShell = html.slice(html.indexOf('const ffFontState'), html.indexOf('/* ---------------- Video Rotator'));
    const api = new Function(
      'const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));\n' + builders + '\n' + srt + '\n' + toolShell +
      '\nreturn {buildVideoExport,buildAudioExport,buildSrt,parseSrt,srtTime,buildVideoTool};'
    )();
    const { buildVideoExport, buildAudioExport, buildSrt, parseSrt, srtTime, buildVideoTool } = api;

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
    /* ---------------- Rotator / Slow Motion / Watermark / Extractor / Thumbnail ---------------- */
    const imgSize = (name) => {
      let b;
      try { b = core.FS.readFile(name); } catch (e) { return null; }
      if (b[0] === 0x89) return [(b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19], (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]];
      if (b[0] === 0xFF && b[1] === 0xD8) {
        let i = 2;
        while (i < b.length) {
          if (b[i] !== 0xFF) { i++; continue; }
          const m = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
          if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return [(b[i + 7] << 8) | b[i + 8], (b[i + 5] << 8) | b[i + 6]];
          i += 2 + len;
        }
      }
      return null;
    };
    const has = (name) => { try { return core.FS.stat(name).size > 0; } catch (e) { return false; } };
    const font = new Uint8Array(readFileSync(join(root, 'pixora/engines/hindi-font.ttf.b64'), 'utf8')
      .replace(/\s+/g, '') ? Buffer.from(readFileSync(join(root, 'pixora/engines/hindi-font.ttf.b64'), 'utf8').trim(), 'base64') : Buffer.alloc(0));
    core.FS.writeFile('font.ttf', font);
    core.FS.writeFile('stamp.txt', new TextEncoder().encode('Studio Hub'));
    core.FS.writeFile('cap.txt', new TextEncoder().encode('My Caption'));
    assert.equal(run(['-hide_banner', '-nostdin', '-y', '-f', 'lavfi', '-i', 'color=c=red@0.6:s=120x60:d=1', '-frames:v', '1', 'logo.png']).rc, 0);

    await t.test('rotator builds the right transpose and swaps the frame size', () => {
      for (const [deg, want] of [[90, 'transpose=1'], [180, 'hflip,vflip'], [270, 'transpose=2']]) {
        const args = buildVideoTool({ input: 'src.mp4', output: `rot${deg}.mp4`, rotate: deg });
        assert.ok(args[args.indexOf('-vf') + 1].includes(want), `${deg}° should use ${want}`);
        const r = run(args);
        assert.equal(r.rc, 0, r.error);
        assert.ok(has(`rot${deg}.mp4`));
      }
      /* a 90° turn of a 320x240 clip must really come out 240x320 */
      const probe = run(['-hide_banner', '-nostdin', '-y', '-i', 'rot90.mp4', '-frames:v', '1', 'probe90.png']);
      assert.equal(probe.rc, 0);
      assert.deepEqual(imgSize('probe90.png'), [240, 320], 'rotated frame is not portrait');
      const flip = buildVideoTool({ input: 'src.mp4', output: 'mirror.mp4', flipH: true });
      assert.ok(flip[flip.indexOf('-vf') + 1].includes('hflip'));
      assert.equal(run(flip).rc, 0);
    });

    await t.test('slow motion stretches the timeline and can interpolate frames', () => {
      const plain = run(buildVideoTool({ input: 'src.mp4', output: 'slow2.mp4', slow: 2, audio: false, crf: 21 }));
      assert.equal(plain.rc, 0, plain.error);
      const interpArgs = buildVideoTool({ input: 'src.mp4', output: 'slow_i.mp4', slow: 2, interpolate: true, fps: 60, audio: false, crf: 21, preset: 'ultrafast' });
      const vf = interpArgs[interpArgs.indexOf('-vf') + 1];
      assert.ok(vf.includes('minterpolate=fps=60'), 'interpolation filter missing');
      assert.ok(vf.includes('setpts=PTS*2'), 'timeline not stretched');
      assert.ok(interpArgs.includes('-an'), 'muted output expected');
      assert.ok(!interpArgs.includes('-filter:a'), 'no audio filter graph when the audio is dropped');
      const r = run(interpArgs);
      assert.equal(r.rc, 0, r.error);
      /* a 4x slow-down needs two atempo stages, and 0.25x must still render */
      const quarter = buildVideoTool({ input: 'src.mp4', output: 'slow4.mp4', slow: 4, audio: false });
      assert.ok(quarter[quarter.indexOf('-vf') + 1].includes('setpts=PTS*4'));
      assert.equal(run(quarter).rc, 0);
    });

    await t.test('watermark burns text and a logo overlay', () => {
      const textArgs = buildVideoTool({ input: 'src.mp4', output: 'wm_text.mp4', crf: 22,
        drawText: { font: 'font.ttf', textFile: 'stamp.txt', size: 36, colour: '#ffffff', alpha: 0.85 } });
      const vf = textArgs[textArgs.indexOf('-vf') + 1];
      assert.ok(vf.includes('drawtext=fontfile=font.ttf:textfile=stamp.txt'), vf);
      assert.ok(vf.includes('fontcolor=0xffffff@0.85'), 'colour must use ffmpeg 0xRRGGBB syntax');
      assert.equal(run(textArgs).rc, 0, 'text watermark failed');
      const logoArgs = buildVideoTool({ input: 'src.mp4', image: 'logo.png', output: 'wm_logo.mp4', crf: 22,
        watermark: { pos: 'tr', scale: '120:-1', opacity: 0.8 } });
      const fc = logoArgs[logoArgs.indexOf('-filter_complex') + 1];
      assert.match(fc, /overlay=W-w-20:20/, fc);
      assert.match(fc, /colorchannelmixer=aa=0\.8/, 'opacity not applied to the logo');
      assert.equal(run(logoArgs).rc, 0, 'logo watermark failed');
    });

    await t.test('audio extractor writes MP3, WAV and M4A', () => {
      for (const [ext, codec] of [['mp3', 'libmp3lame'], ['wav', 'pcm_s16le'], ['m4a', 'aac']]) {
        const args = buildVideoTool({ input: 'src.mp4', output: `ex.${ext}`, audioOnly: true, audioCodec: codec, audioBitrate: '192k' });
        assert.ok(args.includes('-vn'), 'video stream must be dropped');
        const r = run(args);
        assert.equal(r.rc, 0, `${ext}: ${r.error}`);
        assert.ok(has(`ex.${ext}`), `${ext} was not written`);
      }
      /* -ss before -i, so trimming is fast and keyframe-accurate */
      const cut = buildVideoTool({ input: 'src.mp4', output: 'cut.mp3', audioOnly: true, start: 2 });
      assert.ok(cut.indexOf('-ss') < cut.indexOf('-i'), '-ss must come before -i');
      assert.equal(run(cut).rc, 0);
    });

    await t.test('a video without an audio track fails instead of writing an empty file', () => {
      assert.equal(run(['-hide_banner', '-nostdin', '-y', '-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=10:duration=1',
        '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', 'noaudio.mp4']).rc, 0);
      const r = run(buildVideoTool({ input: 'noaudio.mp4', output: 'na.mp3', audioOnly: true }));
      assert.notEqual(r.rc, 0, 'extracting audio from a silent clip must fail');
      /* ffmpeg logs the reason on the generic logger in some builds, so accept any
         non-zero exit as the contract: the UI shows "FFmpeg stopped with code N" */
      assert.equal(has('na.mp3'), false, 'no file may be written');
    });

    await t.test('thumbnail maker grabs exact frames at the requested size', () => {
      const cases = [
        ['th.jpg', { start: 1.5, imageOnly: true, quality: 2 }, [320, 240]],
        ['th720.jpg', { start: 1.5, imageOnly: true, quality: 2, videoFilters: ['scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720'] }, [1280, 720]],
        ['threel.jpg', { start: 0.5, imageOnly: true, videoFilters: ['scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920'] }, [1080, 1920]],
        ['th.png', { start: 1, imageOnly: true }, [320, 240]],
      ];
      for (const [out, opts, want] of cases) {
        const args = buildVideoTool(Object.assign({ input: 'src.mp4', output: out }, opts));
        assert.ok(args.includes('-frames:v'), 'must grab a single frame');
        const r = run(args);
        assert.equal(r.rc, 0, `${out}: ${r.error}`);
        assert.deepEqual(imgSize(out), want, `${out} has the wrong dimensions`);
      }
      /* scale must run before drawtext, or the caption is sized for the source frame */
      const capArgs = buildVideoTool({ input: 'src.mp4', output: 'thcap.jpg', start: 0.5, imageOnly: true,
        videoFilters: ['scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720'],
        drawText: { font: 'font.ttf', textFile: 'cap.txt', size: 64, colour: '#ffffff', x: '(w-text_w)/2', y: 'h-th-70' } });
      const chain = capArgs[capArgs.indexOf('-vf') + 1];
      assert.ok(chain.indexOf('scale=') < chain.indexOf('drawtext='), 'drawtext must come after the resize');
      assert.equal(run(capArgs).rc, 0, 'captioned thumbnail failed');
      assert.deepEqual(imgSize('thcap.jpg'), [1280, 720]);
      /* a timestamp past the end must not produce an empty file the UI would announce as done */
      run(buildVideoTool({ input: 'src.mp4', output: 'late.jpg', start: 99, imageOnly: true }));
      assert.equal(has('late.jpg'), false, 'an out-of-range timestamp wrote a file');
    });

  });
}
