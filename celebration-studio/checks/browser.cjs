// Optional real-browser integration test. Invoked by studio.browsercheck using a disposable DB.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const jsQR = require('jsqr');
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
    await host.waitForSelector('.occasion-tile');
    assert.equal((await host.$$('.occasion-tile')).length, 13);
    // Anonymous studio tour: every function has three distinct plates and its own six proofs.
    const catalog = await host.evaluate(() => fetch('/api/catalog').then((r) => r.json()));
    const plates = new Set();
    for (const e of catalog.occasions) {
      await click(host, `[data-occasion="${e.id}"]`);
      await host.waitForSelector(`.function-room[data-studio="${e.id}"]`);
      const images = await host.$$eval('.edition-face img', async (imgs) => {
        await Promise.all(imgs.map((im) => im.decode()));
        return imgs.map((im) => im.src);
      });
      assert.equal(images.length, 3);
      images.forEach((img) => plates.add(img));
      await click(host, '.edition-card[data-edition="signature"]');
      await host.waitForSelector(`.program-editor[data-studio="${e.id}"]`);
      assert.equal((await host.$$('[data-key="template"] option')).length, 3);
      for (let i = 0; i < 6; i++) {
        await host.select('[data-edit-page]', String(i));
        assert.equal(
          await host.$eval('#live-poster .book-leaf', (el) => el.dataset.kind),
          e.pages[i].kind,
        );
        assert.equal(
          (await host.$$(`[data-pane="${i}"]:not([hidden]) [data-chapter-field]`)).length,
          e.pages[i].fields.length,
        );
      }
      if (e.id === 'birthday') {
        await host.select('[data-edit-page]', '4');
        await set(host, '[data-chapter-field="surprise"]', 'A birthday poem.');
        await click(host, '#live-poster summary');
        assert.match(await text(host, '#live-poster details[open]'), /A birthday poem/);
      } else if (e.id === 'wedding') {
        await host.select('[data-edit-page]', '0');
        await set(host, '[data-key="person"]', 'Aanya');
        await set(host, '[data-chapter-field="partner"]', 'Arjun');
        assert.equal(await text(host, '#live-poster h2'), 'Aanya & Arjun');
        await host.select('[data-edit-page]', '3');
        assert.equal((await host.$$('.rite-grid h3')).length, 4);
      } else if (e.id === 'holi') {
        await host.select('[data-edit-page]', '2');
        await click(host, '[data-gulal="#267d75"]');
        assert.equal(
          await host.$eval('[data-gulal="#267d75"]', (el) => el.getAttribute('aria-pressed')),
          'true',
        );
      }
      await click(host, '.crumb a[href="#/"]');
      await host.waitForSelector('.occasion-tile');
    }
    assert.equal(plates.size, 39);
    await click(host, '[data-group="Festivals"]');
    assert.equal((await host.$$('.occasion-tile')).length, 6);
    await click(host, '[data-occasion="diwali"]');
    await click(host, '[href="#/new/diwali-folio"]');
    await host.waitForSelector('.program-editor[data-studio="diwali"]');
    const title = 'मीरा & परिवार',
      note = 'दीपावली का निमंत्रण। साथ मिलकर दीप जलाएँ!';
    await set(host, '[data-key="person"]', title);
    await set(host, '[data-key="host"]', 'कश्यप परिवार');
    const english = 'Come light a diya in our courtyard.';
    await host.select('[data-edit-page]', '1');
    await set(host, '[data-key="message"]', note);
    await click(host, '.translation-note summary');
    await set(host, '[data-key="messageAlt"]', english);
    await host.select('[data-edit-page]', '2');
    await set(host, '[data-chapter-field="puja"]', '18:15 · लक्ष्मी पूजा');
    await host.select('[data-edit-page]', '4');
    await set(host, '[data-chapter-field="dinner"]', 'खीर');
    await host.select('[data-edit-page]', '0');
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
    await host.select('[data-key="template"]', 'diwali-nocturne');
    assert.equal(await host.$eval('#live-poster article', (el) => el.dataset.edition), 'nocturne');
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
    await (await host.$('[data-file="gallery"]')).uploadFile(photoPath, clipPath);
    await host.waitForSelector('.album-row:nth-child(2)');
    await host.waitForSelector('.album-thumb img');
    await set(host, '.album-row:nth-child(1) [data-caption]', 'First diya in the courtyard');
    await set(host, '.album-row:nth-child(2) [data-caption]', 'Lighting the lamps');
    await click(host, '[data-album-action="up"][data-index="1"]');
    await click(host, '[data-tab="2"]');
    await set(host, '[data-key="date"]', '2028-10-21', 'change');
    await set(host, '[data-key="time"]', '18:00', 'change');
    await set(host, '[data-key="venue"]', 'Varanasi courtyard');
    await set(host, '[data-key="schedule"]', '18:00 · दीपोत्सव\n19:00 · Dinner');
    await host.waitForFunction(
      () => document.querySelector('#save-state').textContent === 'Saved to your account',
    );
    await host.reload();
    await host.waitForSelector('.program-editor');
    await click(host, '[data-tab="1"]');
    assert.deepEqual(await host.$$eval('[data-caption]', (els) => els.map((el) => el.value)), [
      'Lighting the lamps',
      'First diya in the courtyard',
    ]);
    await click(host, '[data-do="play"]');
    await click(host, '#cinema .open-card');
    await host.waitForSelector('#cinema .countdown');
    await host.select('#cinema [data-contents]', '5');
    assert.match(await text(host, '#cinema .preview-hint'), /प्रीव्यू/);
    assert.equal(await host.$('#cinema .rsvp-form'), null);
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
    const pixels = await host.$eval('.share-qr img', async (im) => {
      await im.decode();
      const cv = document.createElement('canvas');
      cv.width = im.naturalWidth;
      cv.height = im.naturalHeight;
      const ctx = cv.getContext('2d');
      ctx.drawImage(im, 0, 0);
      const { data } = ctx.getImageData(0, 0, cv.width, cv.height);
      return {
        w: cv.width,
        h: cv.height,
        gray: Array.from({ length: cv.width * cv.height }, (_, i) => data[i * 4]),
      };
    });
    const rgba = new Uint8ClampedArray(pixels.w * pixels.h * 4);
    pixels.gray.forEach((v, i) => {
      rgba.set([v, v, v, 255], i * 4);
    });
    const decoded = jsQR(rgba, pixels.w, pixels.h);
    assert.equal(decoded?.data, url);
    await guest.goto(decoded.data);
    await guest.waitForSelector('.ticket-face h1');
    assert.equal(await text(guest, '.ticket-face h1'), title);
    assert(await guest.$('.scene-icon.scratch canvas'));
    await click(guest, '.open-card');
    await guest.waitForSelector('.cover-leaf');
    assert(await guest.$('.countdown'));
    assert.equal(await guest.$('.rsvp-form'), null);
    await guest.waitForFunction(() => document.querySelector('.portrait')?.naturalWidth === 48);
    await click(guest, '[data-next]');
    assert.equal(await text(guest, '.letter-msg'), note);
    await click(guest, '.language');
    assert.equal(await text(guest, '.letter-msg'), english);
    await click(guest, '[data-prev]');
    assert.equal(await guest.$eval('.book-leaf', (p) => p.dataset.page), '1');
    await click(guest, '[data-next]');
    await click(guest, '[data-next]');
    await click(guest, '[data-light]');
    assert(await guest.$('.lamp-row.lit'));
    assert.match(await text(guest, '.ledger-list'), /लक्ष्मी/);
    await click(guest, '[data-next]');
    assert.equal((await guest.$$('[data-slide]')).length, 4);
    await click(guest, '[data-album="1"]');
    assert.match(await text(guest, 'figure:not([hidden]) figcaption'), /Lighting the lamps/);
    await guest.waitForFunction(
      () => document.querySelector('figure:not([hidden]) video')?.videoWidth === 96,
    );
    await click(guest, '[data-album="1"]');
    assert.match(await text(guest, 'figure:not([hidden]) figcaption'), /First diya/);
    await click(guest, '[data-next]');
    assert.match(await text(guest, '.menu-card'), /खीर/);
    assert.match(await text(guest, '.program-slip'), /Dinner/);
    assert.equal(
      await guest.$eval('.map-link', (a) => new URL(a.href).searchParams.get('query')),
      'Varanasi courtyard',
    );
    await click(guest, '[data-next]');
    await guest.waitForSelector('.rsvp-form');
    assert(await guest.$('[data-next]:disabled'));
    await guest.evaluate(() => {
      window.print = () => {
        window.testPrint = true;
      };
    });
    await click(guest, '.guest-actions .print');
    await guest.waitForFunction(() => window.testPrint);
    await guest.emulateMediaType('print');
    assert.equal(await guest.$eval('#print-sheet', (e) => getComputedStyle(e).display), 'block');
    assert.equal(await text(guest, '#print-sheet .letter-msg'), english);
    assert.equal((await guest.$$('#print-sheet .book-leaf')).length, 6);
    assert(await guest.$('#print-sheet .printed-link img'));
    const pdf = await guest.pdf({ format: 'A4' });
    assert.equal(Buffer.from(pdf).subarray(0, 4).toString(), '%PDF');
    assert.equal(
      Buffer.from(pdf)
        .toString('latin1')
        .match(/\/Type\s*\/Page\b/g)?.length,
      6,
    );
    await guest.emulateMediaType('screen');
    await guest.type('.rsvp-form [name="name"]', 'एक मेहमान');
    await set(guest, '[name="party"]', '3');
    await click(guest, '[data-prev]');
    await click(guest, '[data-next]');
    assert.equal(await guest.$eval('[name="name"]', (e) => e.value), 'एक मेहमान');
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
    assert(
      standalone.includes('data:image/jpeg;base64,') &&
        standalone.includes(english) &&
        standalone.includes('First diya in the courtyard') &&
        standalone.includes('id="leaf-6"') &&
        standalone.includes('data:image/png;base64,'),
    );
    await click(host, 'nav a[href="#/dashboard"]');
    await click(host, '[data-off]');
    await click(host, '#commit-action');
    await host.waitForFunction(() => !document.querySelector('#modal').open);
    await guest.reload();
    await guest.waitForSelector('.gate h1');
    assert.match(await text(guest, '.gate h1'), /unavailable/i);
    assert.deepEqual(errors, []);
    console.log(
      'PASS: 13 distinct studios, 39 plates, 78 chapter proofs; separate host & mobile guest sessions; account → autosaved bilingual album and schedule → cinematic preview → scanned published QR → guest chapter navigation, video, Maps & six-leaf print/PDF → RSVP for 3 → change to 2 without duplication → real organizer dashboard → standalone download → unpublish.',
    );
  } finally {
    await browser.close();
    await fs.rm(tmp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
