// Static-only end to end check. Two isolated browser profiles, served at the actual
// /Tools/ prefix. Optionally run against a deployed site with STUDIO_PAGES_SITE.
const assert = require('node:assert/strict'),
  fs = require('node:fs/promises'),
  path = require('node:path'),
  os = require('node:os'),
  http = require('node:http');
const puppeteer = require('puppeteer-core'),
  jsQR = require('jsqr');
const root = path.resolve(__dirname, '../..');
async function fixture() {
  const mime = {
    html: 'text/html',
    css: 'text/css',
    js: 'text/javascript',
    json: 'application/json',
    woff2: 'font/woff2',
    svg: 'image/svg+xml',
    webp: 'image/webp',
  };
  const server = http.createServer(async (req, res) => {
    let p = new URL(req.url, 'http://example.test').pathname;
    if (p.endsWith('/')) p += 'index.html';
    if (
      (p.startsWith('/Tools/') &&
        ['index.html', 'celebration-studio/index.html', 'birthday-wishes/index.html'].includes(
          p.slice(7),
        )) ||
      /^\/Tools\/celebration-studio\/public\/[\w./-]+$/.test(p)
    ) {
      try {
        const body = await fs.readFile(path.join(root, p.slice(7)));
        res.writeHead(200, {
          'Content-Type': mime[p.split('.').pop()] || 'application/octet-stream',
        });
        return res.end(body);
      } catch {}
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((ok) => server.listen(0, '0.0.0.0', ok));
  return {
    base: `http://127.0.0.1:${server.address().port}/Tools/celebration-studio/`,
    close: () => server.close(),
  };
}
const click = async (p, s) => {
  await p.waitForSelector(s, { visible: true });
  await p.click(s);
};
const get = (p, s) => p.$eval(s, (e) => e.textContent);
const set = (p, s, value, type = 'input') =>
  p.$eval(
    s,
    (el, [v, t]) => {
      el.value = v;
      el.dispatchEvent(new Event(t, { bubbles: true }));
    },
    [value, type],
  );
const route = async (p, hash, s) => {
  await p.evaluate((h) => {
    location.hash = h;
  }, hash);
  await p.waitForSelector(s);
};
async function decodeQR(p) {
  const { w, data } = await p.$eval('.share-qr img', async (im) => {
    await im.decode();
    const cv = document.createElement('canvas');
    cv.width = cv.height = im.naturalWidth / 2;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, 0, 0, cv.width, cv.height);
    const rgba = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let s = '';
    for (let i = 0; i < rgba.length; i += 4) s += String.fromCharCode(rgba[i]);
    return { w: cv.width, data: btoa(s) };
  });
  const rgba = new Uint8ClampedArray(w * w * 4);
  Buffer.from(data, 'base64').forEach((n, i) => rgba.set([n, n, n, 255], i * 4));
  return jsQR(rgba, w, w)?.data;
}
async function filmFixture(page) {
  return Buffer.from(
    await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 48;
      const ctx = c.getContext('2d'),
        stream = c.captureStream(10),
        recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' }),
        chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      const done = new Promise((ok) => (recorder.onstop = ok));
      recorder.start();
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 ? '#6a5831' : '#bc976c';
        ctx.fillRect(0, 0, 64, 48);
        await new Promise((ok) => setTimeout(ok, 100));
      }
      recorder.stop();
      await done;
      stream.getTracks().forEach((t) => t.stop());
      return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
    }),
  );
}
async function download(page, context, dir, selector) {
  const c = await page.createCDPSession();
  await fs.mkdir(dir);
  await c.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: dir,
    eventsEnabled: true,
    ...(context.id ? { browserContextId: context.id } : {}),
  });
  const done = new Promise((ok, no) => {
    const timeout = setTimeout(() => no(Error('Card download timed out')), 12000);
    c.on('Browser.downloadProgress', (e) => {
      if (e.state === 'completed') {
        clearTimeout(timeout);
        ok();
      }
    });
  });
  try {
    await click(page, selector);
    await done;
  } finally {
    await c.detach();
  }
  return path.join(dir, (await fs.readdir(dir))[0]);
}
(async () => {
  const site = process.env.STUDIO_PAGES_SITE
      ? { base: process.env.STUDIO_PAGES_SITE, close() {} }
      : await fixture(),
    base = site.base,
    home = new URL('../', base).href;
  const binary = { headless: true, executablePath: process.env.CHROME_BIN };
  if (process.env.STUDIO_LAMBDA_CHROME) {
    const c = require('@sparticuz/chromium');
    binary.executablePath = await c.executablePath();
    binary.args = c.args.filter((a) => a !== '--single-process');
  }
  const browser = await puppeteer.launch(binary),
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-pages-')),
    errors = [];
  try {
    const hostContext = await browser.createBrowserContext(),
      guestContext = await browser.createBrowserContext(),
      host = await hostContext.newPage(),
      guest = await guestContext.newPage();
    let film;
    for (const p of [host, guest]) {
      p.setDefaultTimeout(10000);
      await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      p.on('pageerror', (e) => errors.push(e.message));
      p.on('response', (r) => {
        if (r.url().startsWith(base) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
      });
      p.on('console', (m) => {
        if (m.type() === 'error' && /Content Security Policy/.test(m.text())) errors.push(m.text());
      });
      await p.setRequestInterception(true);
      p.on('request', (req) => {
        const url = req.url();
        if (url === 'https://media.example.test/memory.webm')
          return req.respond({ status: 200, contentType: 'video/webm', body: film }); // deterministic external media fixture; no account/upload.
        if (!/^https?:/.test(url)) return req.continue();
        if (new URL(url).origin !== new URL(base).origin) return req.abort();
        if (/\/(api|s)\//.test(new URL(url).pathname) || req.method() !== 'GET')
          errors.push('Unexpected server dependency: ' + url);
        return req.continue();
      });
    }
    await host.setViewport({ width: 1280, height: 920 });
    await guest.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await guest.goto(home + 'birthday-wishes/');
    await guest.waitForSelector('#workspace:not([hidden])');
    await route(guest, '/wish/garima', '.gift-screen[aria-label="Birthday wish for Garima"]');
    assert.match(await guest.title(), /Garima/);
    await host.goto(home);
    await click(host, '.tool-card a[href="./celebration-studio/"]');
    await host.waitForSelector('.occasion-tile');
    assert.equal(await host.$('#login'), null);
    assert.equal((await host.$$('.occasion-tile')).length, 13);
    const occasions = await host.$$eval('[data-occasion]', (els) =>
        els.map((e) => e.dataset.occasion),
      ),
      plates = new Set();
    for (const id of occasions) {
      await route(host, '/studio/' + id, `.function-room[data-studio="${id}"]`);
      const images = await host.$$eval('.edition-face img', async (els) => {
        await Promise.all(els.map((el) => el.decode()));
        return els.map((el) => el.src);
      });
      assert.equal(images.length, 3);
      images.forEach((v) => plates.add(v));
      await click(host, '.edition-card');
      await host.waitForSelector('.program-editor');
      for (let i = 0; i < 6; i++) {
        await host.select('[data-edit-page]', String(i));
        assert.equal(
          await host.$eval('#live-poster article', (e) => e.dataset.page),
          String(i + 1),
        );
      }
    }
    assert.equal(plates.size, 39);
    await route(host, '/new/diwali-nocturne', '.program-editor[data-studio="diwali"]');
    await set(host, '[data-key="person"]', 'दीपोत्सव');
    await set(host, '[data-key="host"]', 'The host');
    await host.select('[data-edit-page]', '1');
    await set(host, '[data-key="message"]', 'हमारे आँगन में आइए।');
    await set(host, '[data-key="messageAlt"]', 'Come light a diya.');
    await host.select('[data-edit-page]', '5');
    await click(host, '[data-key="rsvp"]');
    await click(host, '[data-do="publish"]');
    await host.waitForFunction(() =>
      document.querySelector('.save-error').textContent.includes('page 06'),
    );
    const phone = '+1 202-555-0142',
      email = 'organizer@example.test';
    await set(host, '[data-key="phone"]', phone);
    await set(host, '[data-key="email"]', email);
    await click(host, '[data-tab="2"]');
    await set(host, '[data-key="venue"]', 'Varanasi courtyard');
    await set(host, '[data-key="date"]', '2028-10-21', 'change');
    await click(host, '[data-tab="1"]');
    await host.select('[data-key="music"]', 'none');
    const picture = await host.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 32;
      c.height = 24;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#a16742';
      ctx.fillRect(0, 0, 32, 24);
      return c.toDataURL().split(',')[1];
    });
    const png = path.join(tmp, 'portrait.png');
    await fs.writeFile(png, Buffer.from(picture, 'base64'));
    await (await host.$('[data-file="photo"]')).uploadFile(png);
    await host.waitForSelector('[data-remove="photo"]', { visible: true });
    film = await filmFixture(host);
    const video = path.join(tmp, 'film.webm');
    await fs.writeFile(video, film);
    await click(host, '[data-add-url]');
    await host.select('#modal [name="slot"]', 'gallery-video');
    await set(host, '#modal [name="src"]', 'https://media.example.test/memory.webm');
    await click(host, '#modal form button');
    await host.waitForSelector('.album-row');
    await set(host, '[data-caption]', 'A memory');
    await click(host, '[data-do="save"]');
    await host.waitForFunction(
      () =>
        location.hash.startsWith('#/edit/') &&
        document.querySelector('#save-state').textContent === 'Saved on this device',
    );
    const edit = host.url();
    await host.reload();
    await host.waitForSelector('#live-poster .portrait');
    await click(host, '[data-tab="1"]');
    assert.equal(await host.$eval('[data-caption]', (el) => el.value), 'A memory');
    await click(host, '[data-do="play"]');
    await click(host, '#cinema .open-card');
    await host.waitForSelector('#cinema .countdown');
    await click(host, '#cinema .back');
    await click(host, '[data-do="publish"]');
    await host.waitForSelector('#modal[open] #share-url', { visible: true });
    const url = await host.$eval('#share-url', (el) => el.value);
    assert(url.startsWith(base + '#/i/v1.'));
    const scanned = await decodeQR(host);
    assert.equal(scanned, url);
    assert.equal(
      await host.$eval('#modal a[href^="https://wa.me/"]', (a) =>
        new URL(a.href).searchParams.get('text'),
      ),
      'You’re invited! ' + url,
    );
    await guest.goto(scanned);
    await guest.waitForSelector('.ticket-face');
    assert.equal(await get(guest, '.ticket-face h1'), 'दीपोत्सव');
    await click(guest, '.open-card');
    await guest.waitForFunction(() => document.querySelector('.portrait')?.naturalWidth === 32);
    await guest.select('[data-contents]', '1');
    assert.equal(await get(guest, '.letter-msg'), 'हमारे आँगन में आइए।');
    await click(guest, '.language');
    assert.equal(await get(guest, '.letter-msg'), 'Come light a diya.');
    await guest.select('[data-contents]', '3');
    await click(guest, '[data-album="1"]');
    await guest.waitForFunction(
      () => document.querySelector('figure:not([hidden]) video')?.videoWidth === 64,
    );
    await guest.select('[data-contents]', '4');
    assert.equal(
      await guest.$eval('.map-link', (a) => new URL(a.href).searchParams.get('query')),
      'Varanasi courtyard',
    );
    await guest.select('[data-contents]', '5');
    await guest.evaluate(() => {
      window.print = () => (window.printed = true);
    });
    await click(guest, '.guest-actions .print');
    await guest.waitForFunction(() => window.printed);
    assert.equal(await guest.$eval('#print-sheet .printed-link a', (a) => a.href), url);
    const pdf = Buffer.from(await guest.pdf({ format: 'A4' }));
    assert.equal(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length, 6);
    await set(guest, '[name="name"]', 'नया मेहमान');
    await set(guest, '[name="party"]', '3');
    await set(guest, '[name="note"]', 'Will bring sweets.');
    await click(guest, '.rsvp-form button');
    await guest.waitForSelector('[data-send-wa]');
    async function slip(page, n) {
      const wa = new URL(await page.$eval('[data-send-wa]', (a) => a.href)),
        mail = new URL(await page.$eval('[data-send-mail]', (a) => a.href));
      assert.equal(wa.origin + wa.pathname, 'https://wa.me/12025550142');
      assert.equal(decodeURIComponent(mail.pathname), email);
      assert.equal(mail.searchParams.get('body'), wa.searchParams.get('text'));
      assert.match(wa.searchParams.get('text'), new RegExp('Guests: ' + n));
      const reply = wa.searchParams.get('text').split(' ').pop();
      assert(reply.startsWith(base + '#/reply/v1.'));
      return reply;
    }
    const reply = await slip(guest, 3);
    assert.match(await get(guest, '.reply-status'), /Nothing has been sent/);
    await host.goto(reply);
    await click(host, '[data-import]');
    await host.waitForSelector('#confirmed');
    assert.equal(await get(host, '#confirmed'), '3');
    await set(guest, '[name="party"]', '2');
    assert.equal(await guest.$('[data-send-wa]'), null);
    await click(guest, '.rsvp-form button');
    await guest.waitForSelector('[data-send-mail]');
    await host.goto(await slip(guest, 2));
    await click(host, '[data-import]');
    await host.waitForSelector('#confirmed');
    assert.equal(await get(host, '#confirmed'), '2');
    assert.equal(await get(host, '#reply-count'), '1');
    assert.equal(await get(host, 'tbody td'), 'नया मेहमान');
    assert(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    // Realistic local video is NOT silently dropped. A full standalone attachment can be sent instead.
    await host.goto(edit);
    await host.waitForSelector('.program-editor');
    await click(host, '[data-tab="1"]');
    const padded = Buffer.concat([film, Buffer.alloc(4096)]);
    await fs.writeFile(video, padded);
    await (await host.$('[data-file="video"]')).uploadFile(video);
    await host.waitForSelector('[data-remove="video"]', { visible: true });
    await click(host, '[data-do="publish"]');
    await host.waitForFunction(() =>
      document.querySelector('.save-error').textContent.includes('film is too large'),
    );
    const file = await download(host, hostContext, path.join(tmp, 'download'), '[data-do="card"]');
    const html = await fs.readFile(file, 'utf8');
    assert(
      html.includes('id="leaf-6"') &&
        html.includes('data:video/webm;base64,' + padded.toString('base64')) &&
        html.includes('data:image/png;base64,' + picture) &&
        html.includes('https://media.example.test/memory.webm') &&
        !html.includes('blob:') &&
        html.includes('mailto:organizer@example.test'),
    );
    await click(host, '[data-remove="video"]');
    await (
      await host.$('[data-file="photo"]')
    ).uploadFile(path.join(root, 'celebration-studio/public/assets/atelier.webp'));
    await host.waitForFunction(
      () => document.querySelector('#live-poster .portrait')?.naturalWidth > 160,
    );
    await click(host, '[data-tab="0"]');
    await set(host, '[data-key="person"]', 'New snapshot');
    await click(host, '[data-do="publish"]');
    await host.waitForSelector('#modal[open] #share-url', { visible: true });
    const revised = await host.$eval('#share-url', (el) => el.value);
    assert.notEqual(revised, url);
    await guest.goto(revised);
    await click(guest, '.open-card');
    await guest.waitForFunction(() => {
      const w = document.querySelector('.portrait')?.naturalWidth;
      return w > 0 && w <= 160;
    });
    // Deleting the workspace must not break (or mutate) a card already sent to a guest.
    await click(host, '#modal [data-close]');
    await click(host, 'nav a[href="#/dashboard"]');
    await click(host, '[data-delete]');
    await click(host, '[data-confirm-delete]');
    await host.waitForSelector('.empty');
    await guest.goto(url);
    await guest.waitForSelector('.ticket-face');
    assert.equal(await get(guest, '.ticket-face h1'), 'दीपोत्सव');
    await guest.goto(edit);
    await guest.waitForSelector('.gate .error');
    assert.match(await get(guest, '.gate .error'), /device draft/);
    await guest.goto(base + '#/i/v1.bad');
    await guest.waitForSelector('.gate h1');
    assert.equal(await get(guest, '.gate h1'), 'Invitation unavailable');
    assert.deepEqual(errors, []);
    console.log(
      'PASS: /Tools/ homepage + original Garima route; 13 studios / 39 plates / 78 proofs; login-free device draft, reload, photo and film → decoded QR → independent mobile guest, album, language, Maps, 6-page PDF → addressed WhatsApp & email handoff → returned reply imported by host, 3→2 without duplicates; full HTML with local video; old link survives edits/deletion. No API requests.',
    );
  } finally {
    await browser.close();
    site.close();
    await fs.rm(tmp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
