// Optional real-browser integration test. Invoked by studio.browsercheck using a disposable DB.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
(async () => {
  const base = process.env.STUDIO_TEST_BASE;
  assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  const opt = { headless: true, executablePath: process.env.CHROME_BIN };
  if (process.env.STUDIO_LAMBDA_CHROME) {
    const c = require('@sparticuz/chromium');
    opt.executablePath = await c.executablePath();
    opt.args = c.args.filter((a) => a !== '--single-process');
  }
  const browser = await puppeteer.launch(opt),
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'celebration-check-'));
  const errors = [];
  const click = async (p, s) => {
    await p.waitForSelector(s, { visible: true });
    await p.click(s);
  };
  const set = async (p, s, v, type = 'input') =>
    p.$eval(
      s,
      (e, [v, t]) => {
        e.value = v;
        e.dispatchEvent(new Event(t, { bubbles: true }));
      },
      [v, type],
    );
  const text = (p, s) => p.$eval(s, (e) => e.textContent);
  try {
    const host = await browser.newPage(),
      context = await browser.createBrowserContext(),
      guest = await context.newPage();
    for (const p of [host, guest]) {
      p.on('pageerror', (e) => errors.push(e.message));
      p.setDefaultTimeout(9000);
      await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    }
    await host.setViewport({ width: 1280, height: 920 });
    await guest.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await host.goto(base);
    await host.waitForSelector('.design-tile');
    assert.equal((await host.$$('.design-tile')).length, 6);
    await click(host, '[data-group="Festivals"]');
    assert.equal((await host.$$('.design-tile')).length, 2);
    await click(host, '[href="#/new/festive"]');
    await host.waitForSelector('[data-key="person"]');
    assert.equal(await host.$eval('[data-key="occasion"]', (el) => el.value), 'diwali');
    const title = 'मीरा & परिवार',
      note = 'दीपावली का निमंत्रण। साथ मिलकर दीप जलाएँ!';
    await set(host, '[data-key="person"]', title);
    await set(host, '[data-key="host"]', 'कश्यप परिवार');
    await set(host, '[data-key="message"]', note);
    await click(host, '[data-do="save"]');
    await host.waitForSelector('#auth-form');
    const password = crypto.randomBytes(16).toString('hex'),
      email = `check-${Date.now()}@example.test`;
    await host.type('[name="display"]', 'Preview organizer');
    await host.type('[name="email"]', email);
    await host.type('[name="password"]', password);
    await click(host, '#auth-form button');
    await host.waitForFunction(() => location.hash.startsWith('#/edit/'));
    await click(host, '[data-tab="1"]');
    await host.select('[data-key="opening"]', 'scratch');
    await host.select('[data-key="music"]', 'none');
    await host.select('[data-key="font"]', 'hand');
    const photoPath = path.join(tmp, 'family.png');
    const photo = await host.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 48;
      c.height = 32;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#a68';
      ctx.fillRect(0, 0, 48, 32);
      return c.toDataURL('image/png').split(',')[1];
    });
    await fs.writeFile(photoPath, Buffer.from(photo, 'base64'));
    await (await host.$('[data-file="photo"]')).uploadFile(photoPath);
    await host.waitForSelector('#live-poster .portrait');
    // A short, entirely synthetic film: no camera/microphone permission required.
    const clip = await host.evaluate(async () => {
      const cv = document.createElement('canvas');
      cv.width = 96;
      cv.height = 64;
      const ctx = cv.getContext('2d'),
        stream = cv.captureStream(12);
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' }),
        chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      const ended = new Promise((resolve) => (rec.onstop = resolve));
      rec.start();
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = i % 2 ? '#8c465c' : '#325546';
        ctx.fillRect(0, 0, 96, 64);
        await new Promise((r) => setTimeout(r, 90));
      }
      rec.stop();
      await ended;
      stream.getTracks().forEach((t) => t.stop());
      return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
    });
    const clipPath = path.join(tmp, 'film.webm');
    await fs.writeFile(clipPath, Buffer.from(clip));
    await (await host.$('[data-file="video"]')).uploadFile(clipPath);
    await host.waitForSelector('[data-remove="video"]', { visible: true });
    await click(host, '[data-tab="2"]');
    await set(host, '[data-key="date"]', '2028-10-21', 'change');
    await set(host, '[data-key="time"]', '18:00', 'change');
    await set(host, '[data-key="venue"]', 'Varanasi courtyard');
    await set(host, '[data-key="schedule"]', '18:00 · दीपोत्सव\n19:00 · Dinner');
    await click(host, '[data-do="play"]');
    await click(host, '#cinema .open-card');
    await host.waitForSelector('#cinema .countdown');
    assert.match(await text(host, '#cinema .preview-hint'), /preview/i);
    await click(host, '#cinema .back');
    await click(host, '[data-do="publish"]');
    await host.waitForSelector('#share-url');
    const url = await host.$eval('#share-url', (el) => el.value);
    assert(url.startsWith(base + '/i/'));
    assert(!url.includes('#'));
    assert.equal(
      await host.$eval('a[href^="https://wa.me/"]', (a) =>
        new URL(a.href).searchParams.get('text'),
      ),
      'You’re invited! ' + url,
    );
    await guest.goto(url);
    await guest.waitForSelector('.ticket-face h1');
    assert.equal(await text(guest, '.ticket-face h1'), title);
    assert(await guest.$('.scene-icon.scratch canvas'));
    await click(guest, '.open-card');
    await guest.waitForSelector('.rsvp-form');
    assert.equal(await text(guest, '.letter-msg'), note);
    assert(await guest.$('.countdown'));
    assert.match(await text(guest, '.itinerary ul'), /Dinner/);
    await guest.waitForFunction(
      () =>
        document.querySelector('.portrait').naturalWidth === 48 &&
        document.querySelector('video')?.videoWidth === 96,
    );
    await guest.evaluate(() => {
      window.print = () => {};
    });
    await click(guest, '.guest-actions .print');
    await guest.emulateMediaType('print');
    assert.equal(await guest.$eval('#print-sheet', (e) => getComputedStyle(e).display), 'block');
    assert.equal(await text(guest, '#print-sheet .letter-msg'), note);
    const pdf = await guest.pdf({ format: 'A4' });
    assert.equal(Buffer.from(pdf).subarray(0, 4).toString(), '%PDF');
    await guest.emulateMediaType('screen');
    await guest.type('.rsvp-form [name="name"]', 'एक मेहमान');
    await set(guest, '[name="party"]', '3');
    await click(guest, '.rsvp-form button');
    await guest.waitForFunction(() =>
      document.querySelector('.reply-status').textContent.includes('3 guests confirmed'),
    );
    await click(host, '#modal [data-close]');
    await click(host, 'nav a[href="#/dashboard"]');
    await click(host, 'a[href^="#/responses/"]');
    await host.waitForSelector('#confirmed');
    assert.equal(await text(host, '#confirmed'), '3');
    assert.equal(await text(host, 'tbody td'), 'एक मेहमान');
    await set(guest, '[name="party"]', '2');
    await click(guest, '.rsvp-form button');
    await guest.waitForFunction(() =>
      document.querySelector('.reply-status').textContent.includes('2 guests confirmed'),
    );
    await click(host, '#refresh-guest');
    await host.waitForFunction(() => document.querySelector('#confirmed').textContent === '2');
    assert.equal((await host.$$('tbody tr')).length, 1);
    assert(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const cdp = await guest.createCDPSession(),
      dl = path.join(tmp, 'downloads');
    await fs.mkdir(dl);
    await cdp.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      browserContextId: context.id,
      downloadPath: dl,
      eventsEnabled: true,
    });
    const downloaded = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Download timeout')), 9000);
      cdp.on('Browser.downloadProgress', (e) => {
        if (e.state === 'completed') {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    await click(guest, '.guest-actions .download');
    await downloaded;
    const file = (await fs.readdir(dl))[0];
    assert(file.endsWith('.html'));
    const standalone = await fs.readFile(path.join(dl, file), 'utf8');
    assert(standalone.includes('data:image/jpeg;base64,') && standalone.includes(note));
    await click(host, 'nav a[href="#/dashboard"]');
    await click(host, '[data-off]');
    await click(host, '#commit-action');
    await host.waitForFunction(() => !document.querySelector('#modal').open);
    await guest.reload();
    await guest.waitForSelector('.gate h1');
    assert.match(await text(guest, '.gate h1'), /unavailable/i);
    assert.deepEqual(errors, []);
    console.log(
      'PASS: separate host & mobile guest sessions; account → autosaved draft with photo/schedule → cinematic preview → stable public link → RSVP for 3 → change to 2 without duplication → real organizer dashboard → standalone download → unpublish.',
    );
  } finally {
    await browser.close();
    await fs.rm(tmp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
