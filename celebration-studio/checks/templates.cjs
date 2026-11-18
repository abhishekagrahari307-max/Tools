// Host taps real cross-studio links on a small phone screen. Nothing is uploaded.
const assert = require('node:assert/strict');
module.exports = async ({ browser, guest, base, click, set }) => {
  const context = await browser.createBrowserContext(),
    host = await context.newPage(),
    errors = [];
  try {
    host.setDefaultTimeout(9000);
    host.on('pageerror', (e) => errors.push(e.message));
    await host.setViewport({ width: 360, height: 800, isMobile: true, hasTouch: true });
    await host.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const wishes = new URL('../birthday-wishes/', base).href,
      dash = base + '#/dashboard';
    const visible = async (selector) => {
      await host.waitForSelector(selector, { visible: true });
      return host.$eval(selector, (el) => el.textContent);
    };
    await host.goto(wishes);
    const nav = 'header .connected-nav';
    await visible(nav);
    assert.equal(await host.$eval(nav, (a) => a.href), dash);
    assert(
      await host.$eval(nav, (a) => {
        const r = a.getBoundingClientRect();
        return (
          r.left >= 0 &&
          r.right <= innerWidth &&
          a.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
        );
      }),
    );
    await host.tap(nav);
    await visible('.desk-bridge');
    assert.equal(host.url(), dash);
    await click(host, '.desk-bridge a[href="../birthday-wishes/"]');
    await visible(nav);
    assert.equal(host.url(), wishes);
    // An ordinary wish still saves on its own desk, reachable from the connected dashboard.
    await click(host, '[data-tile="midnight"] .card-hit');
    await visible('#name-to');
    await set(host, '#name-to', 'My birthday draft');
    await host.tap(nav);
    await click(host, '.desk-bridge a[href$="#/wishes"]');
    await visible('.draft-grid');
    assert.match(await host.$eval('.draft-grid', (el) => el.textContent), /My birthday draft/);
    await host.goto(wishes + '#/dashboard');
    await visible('.desk-bridge');
    assert.equal(host.url(), dash);
    await click(host, '.desk-actions a[href="#/add-template"]');
    await visible('.template-form');
    await host.select('[name="occasion"]', 'wedding');
    assert.equal((await host.$$('[name="base"] option')).length, 100);
    await click(host, '.template-form [data-cancel]');
    await visible('[data-studio="wedding"]');
    await host.goto(wishes);
    await click(host, '.collection-bridge');
    await visible('[data-studio="birthday"]');
    assert.match(await visible('[data-range]'), /1–12 of 100/);
    await click(host, '[data-next-page]');
    assert.match(await visible('[data-range]'), /13–24 of 100/);
    await click(host, '[data-prev-page]');
    await set(host, '[data-search]', 'no matches here');
    await click(host, '[data-clear]');
    await set(host, '[data-search]', 'Landscape cut-paper');
    assert.equal((await host.$$('.edition-card')).length, 10);
    await click(host, '.shelf-head a');
    await visible('.template-form');
    assert.equal(await host.$eval('[name="occasion"]', (el) => el.value), 'birthday');
    const code = 'birthday-v1-garden-lapis',
      name = 'घर का <निमंत्रण>',
      msg = 'इस बार जन्मदिन साथ मनाएँ।';
    await host.select('[name="base"]', code);
    await host.select('[name="palette"]', 'press-citron');
    await host.select('[name="font"]', 'hand');
    await host.select('[name="music"]', 'none');
    await host.select('[name="opening"]', 'gift');
    await set(host, '[name="name"]', name);
    await set(host, '[name="message"]', msg);
    const image = await host.$eval('[data-proof] .cover-art img', (im) => im.src);
    await host.select('[data-proof-page]', 'message');
    assert.equal(await visible('[data-proof] .letter-msg'), msg);
    await click(host, '.template-form button[type="submit"]');
    await visible('.personal-tile');
    assert(host.url().endsWith('/studio/birthday/mine'));
    await host.reload();
    await visible('.personal-tile');
    assert.equal(await visible('.personal-tile h3'), name);
    assert.equal(await host.$eval('.personal-tile img', (im) => im.src), image);
    const launch = await host.$eval('.personal-tile a', (a) => a.href);
    await click(host, '.personal-tile a');
    await visible('.program-editor');
    assert.equal(await host.$eval('[data-key="template"]', (el) => el.value), code);
    assert.equal(await host.$eval('[data-key="message"]', (el) => el.value), msg);
    await set(host, '[data-key="person"]', 'आर्या');
    await host.tap('[data-do="publish"]');
    await visible('#modal[open] #share-url');
    const link = await host.$eval('#share-url', (el) => el.value);
    await host.waitForFunction(() => location.hash.startsWith('#/edit/'));
    const draft = host.url();
    await guest.goto(launch);
    await guest.waitForSelector('.gate .error');
    assert.match(await guest.$eval('.error', (el) => el.textContent), /personal template/);
    await guest.goto(link);
    await guest.waitForSelector('.ticket-face');
    assert.equal(await guest.$eval('.ticket-art img', (im) => im.src), image);
    await click(guest, '.open-card');
    await guest.waitForSelector('[data-contents]');
    await guest.select('[data-contents]', '1');
    assert.equal(await guest.$eval('.letter-msg', (el) => el.textContent), msg);
    await host.goto(base + '#/studio/birthday/mine');
    await click(host, '[data-remove-preset]');
    await click(host, '#modal [data-confirm]');
    await visible('.shelf-empty');
    await host.goto(draft);
    await visible('.program-editor');
    assert.equal(await host.$eval('[data-key="person"]', (el) => el.value), 'आर्या');
    await guest.reload();
    await guest.waitForSelector('.ticket-face');
    assert.equal(await guest.$eval('.ticket-face h1', (el) => el.textContent), 'आर्या');
    // Even with storage disabled, both the dashboard bridge and built-in library remain usable.
    await host.evaluateOnNewDocument(() => {
      for (const key of ['localStorage', 'indexedDB'])
        Object.defineProperty(window, key, {
          get() {
            throw new DOMException('Storage denied', 'SecurityError');
          },
        });
    });
    await host.goto(wishes);
    await host.tap(nav);
    await visible('.desk-bridge');
    assert.match(await visible('.list-panel .error'), /denied/i);
    await click(host, '.desk-actions a[href="#/add-template"]');
    await visible('.template-form');
    await set(host, '[name="name"]', 'Blocked');
    await click(host, '.template-form button[type="submit"]');
    assert.match(await visible('.template-form .error'), /not saved/i);
    await click(host, '.template-form [data-cancel]');
    assert.match(await visible('[data-range]'), /of 100/);
    assert.deepEqual(errors, []);
    console.log(
      'PASS: mobile Birthday Wishes ↔ Dashboard, saved wish, dashboard alias, searchable and paged library. Personal template saves and reloads, creates an independent guest invitation, and can be removed without affecting that guest or its draft. Blocked-storage navigation also works.',
    );
  } finally {
    await context.close();
  }
};
