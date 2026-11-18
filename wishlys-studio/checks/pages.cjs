// Static-only check for the separate Wishlys studio, served under the real
// /Tools/ prefix. A fresh browser context stands in for the guest's phone.
const assert = require('node:assert/strict'),
  fs = require('node:fs/promises'),
  path = require('node:path'),
  os = require('node:os'),
  http = require('node:http'),
  puppeteer = require('puppeteer-core'),
  root = path.resolve(__dirname, '../..');
const mime = {
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  json: 'application/json',
  woff2: 'font/woff2',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
};
const allowed =
  /^\/Tools\/(wishlys-studio\/[\w./-]+|celebration-studio\/(?:index\.html|public\/[\w./-]+)|birthday-wishes\/index\.html|index\.html)$/;
async function fixture() {
  const server = http.createServer(async (req, res) => {
    let p = new URL(req.url, 'http://example.test').pathname;
    if (p.endsWith('/')) p += 'index.html';
    if (allowed.test(p)) {
      try {
        const body = await fs.readFile(path.join(root, p.slice(7)));
        const type = mime[p.split('.').pop()] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        return res.end(body);
      } catch {}
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((ok) => server.listen(0, '0.0.0.0', ok));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    get base() {
      return this.origin + '/Tools/wishlys-studio/';
    },
    close: () => server.close(),
  };
}
const retry = async (fn, tries = 12) => {
  for (let i = 0; ; i++)
    try {
      return await fn();
    } catch (e) {
      if (i >= tries || !/selector|detached|not found|Node is detached/i.test(e.message)) throw e;
      await new Promise((r) => setTimeout(r, 90));
    }
};
const text = (p, s) => retry(() => p.$eval(s, (e) => e.textContent.trim()));
const fill = (p, sel, value) =>
  p.$eval(
    sel,
    (el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    value,
  );
const click = async (p, s) => {
  await p.waitForSelector(s, { visible: true });
  await p.click(s);
};
const until = async (p, fn, label) => {
  const end = Date.now() + 12000;
  while (Date.now() < end) {
    if (await p.evaluate(fn)) return;
    await new Promise((r) => setTimeout(r, 120));
  }
  throw Error('Timed out waiting for ' + label);
};
(async () => {
  const site = await fixture(),
    base = site.base,
    home = site.origin + '/Tools/',
    binary = { headless: true, executablePath: process.env.CHROME_BIN };
  if (process.env.STUDIO_LAMBDA_CHROME) {
    const c = require('@sparticuz/chromium');
    binary.executablePath = await c.executablePath();
    binary.args = c.args.filter((a) => a !== '--single-process');
  }
  const browser = await puppeteer.launch(binary),
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'wishlys-pages-')),
    errors = [];
  const watch = async (p) => {
    p.setDefaultTimeout(12000);
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => {
      if (m.type() === 'error') errors.push('console: ' + m.text());
    });
    p.on('response', (r) => {
      if (r.url().startsWith(site.origin) && r.status() >= 400)
        errors.push(`${r.status()} ${r.url()}`);
    });
    await p.setRequestInterception(true);
    p.on('request', (req) => {
      const url = req.url();
      if (!/^https?:/.test(url)) return req.continue();
      if (new URL(url).origin !== site.origin) {
        if (/wa\.me|whatsapp/.test(url)) return req.abort();
        errors.push('external dependency: ' + url);
        return req.abort();
      }
      if (/\/(api|s)\//.test(new URL(url).pathname) || req.method() !== 'GET')
        errors.push('unexpected server dependency: ' + url);
      return req.continue();
    });
  };
  try {
    const hostContext = await browser.createBrowserContext(),
      host = await hostContext.newPage();
    await watch(host);
    await host.setViewport({ width: 1280, height: 940 });
    await host.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

    // Landing: six supplied stations, both studio entry points present.
    await host.goto(base);
    await host.waitForSelector('.hero h1');
    assert.match(await text(host, '.hero h1'), /Some birthdays deserve/);
    assert.equal(await host.$$eval('.tour', (n) => n.length), 6);
    assert.equal(
      await host.$$eval('.tour strong', (n) => n.map((x) => x.textContent).join('|')),
      'Peach Confetti|Midnight Magic|Birthday in Bloom|Let’s Celebrate|Golden Moments|Simply, With Love',
    );
    assert.equal(
      await host.$eval(
        '.nav',
        (n) => n.querySelector('a[href="../celebration-studio/#/dashboard"]') !== null,
      ),
      true,
    );

    // Compose, including a real photo import through the file picker.
    await click(host, 'a.btn.dark[href="#/new"]');
    await host.waitForSelector('#letter-form');
    assert.equal(await host.$$eval('input[name=template]', (n) => n.length), 6);
    assert.equal(await host.$$eval('input[name=music]', (n) => n.length), 4);
    await host.click('input[name=template][value=bloom]');
    await fill(host, 'input[name=recipient]', 'Aarohi');
    await fill(host, 'input[name=sender]', 'Ananya');
    await fill(host, 'input[name=date]', '1997-02-14');
    await fill(host, 'input[name=age]', '28');
    await fill(host, 'input[name=headline]', 'Happy Birthday, Aarohi');
    await fill(host, 'textarea[name=message]', 'Here’s to more laughter and little adventures.');
    await fill(
      host,
      'textarea[name=letter]',
      'Some people make the world brighter just by being in it.\n\nYou are one of them.',
    );
    await fill(host, 'input[name=age]', '29');
    const photoPath = path.join(tmp, 'photo.png');
    await fs.writeFile(
      photoPath,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIElEQVR42u3OMQEAAAgDoJnc6BpjDyQgdWXAhAkTJkyYMAFqvwFh42nJqwAAAABJRU5ErkJggg==',
        'base64',
      ),
    );
    const input = await host.$('#photo');
    await input.uploadFile(photoPath);
    await until(
      host,
      () => document.querySelectorAll('#photo-list .chip img').length === 1,
      'photo import',
    );
    await host.waitForSelector('#letter-form[data-template=bloom]');
    assert.match(await text(host, '[data-preview] .paper'), /Aarohi/);
    assert.equal(
      await host.$eval('[data-preview] .paper-to', () => true).catch(() => false),
      false,
    );
    await until(
      host,
      () => /^Saved /.test(document.querySelector('#save-line').textContent),
      'autosave',
    );
    const draftURL = host.url();
    const draftId = draftURL.split('#/edit/')[1];
    assert.match(draftId, /^[A-Za-z0-9_-]{16}$/);

    // The same device keeps the draft across a reload, with its template and photo.
    await host.reload();
    await host.waitForSelector('#letter-form');
    assert.equal(await host.$eval('input[name=recipient]', (e) => e.value), 'Aarohi');
    assert.equal(await host.$eval('input[name=age]', (e) => e.value), '29');
    assert.equal(await host.$eval('#letter-form', (e) => e.dataset.template), 'bloom');
    assert.equal(await host.$$eval('#photo-list .chip', (n) => n.length), 1);

    // A photograph can be removed again, and the proof follows.
    const add = await host.$('#photo');
    await add.uploadFile(photoPath);
    await until(
      host,
      () => document.querySelectorAll('#photo-list .chip').length === 2,
      'second photo',
    );
    await host.click('#photo-list .chip:nth-child(2) [data-drop]');
    await until(
      host,
      () => document.querySelectorAll('#photo-list .chip').length === 1,
      'photo removal',
    );

    // Validation points at the field instead of creating a broken link.
    const before = await host.$eval('#letter-form', (f) => f.dataset.version);
    await fill(host, 'input[name=recipient]', '');
    await host.click('#preview');
    await host.waitForSelector('#toast.on');
    assert.match(await text(host, '#toast'), /name/);
    assert.equal(await host.evaluate(() => document.querySelector('#shade').hidden), true);
    assert.equal(
      await host.$eval('input[name=recipient]', (e) => e === document.activeElement),
      true,
    );
    await fill(host, 'input[name=recipient]', 'Aarohi');

    // Full preview: sealed envelope, letter, memory album and melody.
    await click(host, '.lab a[href^="#/wish/preview/"]');
    await host.waitForSelector('.gift-gate h1');
    assert.match(await text(host, '.gift-gate h1'), /Aarohi/);
    await click(host, '[data-open]');
    await host.waitForSelector('.letter-body h2');
    assert.equal(await text(host, '.letter-body h2'), 'Dear Aarohi,');
    assert.match(await text(host, '.long-letter'), /brighter just by being in it/);
    assert.equal(await host.$$eval('.memories img', (n) => n.length), 1);
    await click(host, '[data-music]');
    await until(
      host,
      () => document.querySelector('[data-music]').getAttribute('aria-pressed') === 'true',
      'music start',
    );
    await click(host, '[data-music]');
    await until(
      host,
      () => document.querySelector('[data-music]').getAttribute('aria-pressed') === 'false',
      'music stop',
    );
    assert.equal(await host.$eval('[data-music]', (b) => b.textContent.trim()), 'Play music');

    // The offline keepsake carries the styles, cover artwork and photos inside one file.
    const keepsake = await host.evaluate(async () => {
      const [cards, model] = await Promise.all([import('./cards.js'), import('./model.js')]);
      const wish = model.checkWish({
        ...model.freshWish(),
        recipient: 'Aarohi',
        sender: 'Ananya',
        template: 'bloom',
      });
      let blob = null;
      const click = HTMLAnchorElement.prototype.click,
        create = URL.createObjectURL;
      HTMLAnchorElement.prototype.click = () => {};
      URL.createObjectURL = (value) => {
        blob = value;
        return create(value);
      };
      try {
        await cards.downloadKeepsake(wish);
      } finally {
        HTMLAnchorElement.prototype.click = click;
        URL.createObjectURL = create;
      }
      if (!(blob instanceof Blob)) throw Error('the keepsake did not produce a file');
      const html = await blob.text();
      return {
        length: html.length,
        closes: html.endsWith('</html>'),
        style: html.includes('.theme-bloom'),
        picture: html.includes('data:image/'),
        csp: /default-src 'none'/.test(html),
      };
    });
    assert.ok(keepsake.length > 9000, 'keepsake should inline the stationery');
    assert.equal(keepsake.closes, true);
    assert.equal(keepsake.style, true);
    assert.equal(keepsake.picture, true);
    assert.equal(keepsake.csp, true);

    // Guest link from the share dialog.
    await host.goto(draftURL);
    await host.waitForSelector('#letter-form');
    await click(host, '#preview');
    await host.waitForSelector('#make-link', { visible: true });
    await click(host, '#make-link');
    await host.waitForSelector('#url');
    const link = await host.$eval('#url', (e) => e.value);
    assert.ok(link.startsWith(base + '#/wish/v1.'), link.slice(0, 90));
    assert.ok(link.length <= 8000, 'link is ' + link.length);
    assert.match(await text(host, '#link-out'), /Copy link/);
    await host.screenshot({ path: path.join(tmp, 'share.png') });

    // A different browser profile (a guest phone) resolves the whole letter.
    const guestContext = await browser.createBrowserContext(),
      guest = await guestContext.newPage();
    await watch(guest);
    await guest.setViewport({
      width: 360,
      height: 740,
      isMobile: true,
      hasTouch: true,
    });
    await guest.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await guest.goto(link);
    await guest.waitForSelector('.gift-gate');
    assert.match(await text(guest, '.gift-gate h1'), /Aarohi/);
    assert.ok((await text(guest, '.gift-gate p:not(.overline)')).includes('Ananya'));
    assert.equal(await guest.$eval('.bar', (n) => getComputedStyle(n).display), 'none');
    await click(guest, '[data-open]');
    await guest.waitForSelector('.letter-body h2');
    assert.equal(await guest.$$eval('.memories img', (n) => n.length), 1);
    assert.match(await text(guest, '.letter-kicker'), /Turning 29/);
    assert.match(await text(guest, '.letter-kicker'), /14 February 1997/);
    assert.equal(
      await guest.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
    );
    await click(guest, '[data-music]');
    await guest.waitForSelector('[data-music][aria-pressed=true]');
    await guest.screenshot({
      path: path.join(tmp, 'guest.png'),
      fullPage: false,
    });

    // Issued links outlive the draft, and a truncated link fails closed.
    assert.equal(await host.evaluate(() => document.querySelector('#shade').hidden), false);
    const hostPage = await hostContext.newPage();
    await watch(hostPage);
    await hostPage.goto(draftURL.replace(/#.*/, '') + '#/letters');
    await hostPage.waitForSelector('.shelf');
    assert.equal(await hostPage.$$eval('.shelf-card', (n) => n.length), 1);
    assert.equal(await hostPage.evaluate(() => document.querySelector('#shade').hidden), true);
    await host.goto(draftURL.replace(/#.*/, '') + '#/letters');
    await host.waitForSelector('.shelf');
    assert.equal(await host.evaluate(() => document.querySelector('#shade').hidden), true);
    hostPage.on('dialog', (d) => d.accept());
    const del = await hostPage.$('[data-delete]');
    await del.click();
    await until(
      hostPage,
      () => document.querySelectorAll('.shelf-card').length === 0,
      'draft deletion',
    );
    await hostPage.close();
    const returning = await guestContext.newPage();
    await watch(returning);
    await returning.setViewport({ width: 1280, height: 900 });
    await returning.goto(link);
    await returning.waitForSelector('.gift-gate h1');
    assert.match(await text(returning, '.gift-gate h1'), /Aarohi/);
    await returning.goto(link.slice(0, link.length - 8));
    await returning.waitForSelector('.empty-state h1');
    assert.match(await text(returning, '.empty-state'), /incomplete/);
    await returning.close();

    // Dashboard bridge: new Wishlys entry beside the untouched Wishcraft entry.
    await host.goto(home + 'celebration-studio/#/dashboard');
    await host.waitForSelector('.desk-bridge');
    assert.equal(await host.$$eval('.desk-bridge', (n) => n.length), 2);
    assert.equal(
      await host.$eval(
        '.desk-bridge:not(.wishlys-bridge)',
        (n) => n.querySelector('a[href="../birthday-wishes/"]') !== null,
      ),
      true,
    );
    assert.equal(
      await host.$eval(
        '.wishlys-bridge',
        (n) => n.querySelector('a[href="../wishlys-studio/"]') !== null,
      ),
      true,
    );
    assert.equal(
      await host.$eval(
        '.wishlys-bridge',
        (n) => n.querySelector('a[href="../wishlys-studio/#/letters"]') !== null,
      ),
      true,
    );
    await click(host, '.wishlys-bridge a[href="../wishlys-studio/"]');
    await host.waitForSelector('.hero h1');
    await click(host, '.nav a[href="../celebration-studio/#/dashboard"]');
    await host.waitForSelector('.wishlys-bridge');

    // Classic Wishcraft is untouched and still links to its own wishes.
    const legacy = await hostContext.newPage();
    await watch(legacy);
    await legacy.goto(home + 'birthday-wishes/');
    await legacy.waitForSelector('body');
    assert.match(
      await legacy.evaluate(() => document.body.innerHTML),
      /#\/wishes|Wishcraft|birthday/i,
    );

    // Narrow phone edit: the studio itself must not scroll sideways.
    const phone = await guestContext.newPage();
    await watch(phone);
    await phone.setViewport({
      width: 320,
      height: 700,
      isMobile: true,
      hasTouch: true,
    });
    await phone.goto(base + '#/new/midnight');
    await phone.waitForSelector('#letter-form');
    await phone.waitForSelector('[data-preview] .paper');
    assert.equal(
      await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      true,
    );
    await fill(phone, 'input[name=recipient]', 'Meera');
    await fill(phone, 'input[name=sender]', 'Kabir');
    await click(phone, '#preview');
    await phone.waitForSelector('#make-link', { visible: true });
    await click(phone, '#make-link');
    await phone.waitForSelector('#url');
    assert.match(await phone.$eval('#url', (e) => e.value), /#\/wish\/v1\./);
    await phone.screenshot({ path: path.join(tmp, 'phone-share.png') });

    // Large photographs stay in the draft; sharing must still offer a usable path.
    const bigB64 = await phone.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 1400;
      c.height = 1000;
      const x = c.getContext('2d');
      const px = x.createImageData(c.width, c.height);
      let seed = 1234567;
      for (let i = 0; i < px.data.length; i += 4) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        px.data[i] = seed & 255;
        px.data[i + 1] = (seed >> 8) & 255;
        px.data[i + 2] = (seed >> 16) & 255;
        px.data[i + 3] = 255;
      }
      x.putImageData(px, 0, 0);
      return c.toDataURL('image/jpeg', 0.94);
    });
    const bigPath = path.join(tmp, 'big.jpg');
    await fs.writeFile(bigPath, Buffer.from(bigB64.split(',')[1], 'base64'));
    await phone.evaluate(() => document.querySelector('#shade .close').click());
    await phone.waitForSelector('#letter-form');
    await (await phone.$('#photo')).uploadFile(bigPath);
    await until(
      phone,
      () => document.querySelectorAll('#photo-list .chip').length === 1,
      'large photo import',
    );
    await (await phone.$('#photo')).uploadFile(bigPath);
    await until(
      phone,
      () => document.querySelectorAll('#photo-list .chip').length === 2,
      'second large photo',
    );
    await click(phone, '.send-bar [data-send]');
    await phone.waitForSelector('#make-link', { visible: true });
    await click(phone, '#make-link');
    await until(
      phone,
      () => {
        const out = document.querySelector('#link-out');
        return !!out && (!!out.querySelector('#url') || !!out.querySelector('.notice'));
      },
      'share outcome for a heavy album',
    );
    const heavy = await phone.evaluate(() => {
      const out = document.querySelector('#link-out');
      return {
        url: out.querySelector('#url')?.value || '',
        notice: out.querySelector('.notice')?.textContent || '',
        hint: out.querySelector('.hint')?.textContent || '',
      };
    });
    assert.ok(
      heavy.url || /too large/.test(heavy.notice),
      'a heavy album must still offer a link or an explicit alternative',
    );
    if (heavy.url) assert.match(heavy.hint, /small previews|All photos included/);
    assert.equal(await phone.$$eval('#photo-list .chip', (n) => n.length), 2);
    if (heavy.url) {
      const tiny = await guestContext.newPage();
      await watch(tiny);
      await tiny.setViewport({ width: 390, height: 800 });
      await tiny.goto(heavy.url);
      await tiny.waitForSelector('.gift-gate');
      await click(tiny, '[data-open]');
      await tiny.waitForSelector('.letter-body h2');
      assert.equal(await tiny.$$eval('.memories img', (n) => n.length), 2);
      assert.equal(
        await tiny.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        true,
      );
      await tiny.close();
    }

    assert.deepEqual(errors, []);
    console.log(
      'PASS: Wishlys landing / six stations / dashboard bridge both ways; bloom letter with photo autosaves and survives reload; sealed preview, letter, album, melody start + stop; keepsake inlines styles, artwork and photo; guest link ' +
        link.length +
        ' chars opens the full letter in an independent mobile profile with no server; issued link survives draft deletion; truncated link fails closed; classic Birthday Wishes untouched; 320px edit and share without overflow. No API, upload or external requests.',
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
