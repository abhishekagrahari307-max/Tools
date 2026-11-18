// Run via pages.cjs, using its static project-site fixture and a separate mobile organizer.
const assert = require('node:assert/strict');
module.exports = async ({ browser, guest, base, png, click, set }) => {
  const context = await browser.createBrowserContext();
  try {
    const host = await context.newPage(),
      errors = [];
    host.setDefaultTimeout(8000);
    host.on('pageerror', (e) => errors.push(e.message));
    await host.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const shim = await host.evaluateOnNewDocument(() => {
      window.structuredClone = undefined;
      Object.hasOwn = undefined;
      HTMLDialogElement.prototype.showModal = undefined;
      const db = window.indexedDB;
      window.restoreStorage = () =>
        Object.defineProperty(window, 'indexedDB', { configurable: true, value: db });
      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        get() {
          throw new DOMException('Storage denied', 'SecurityError');
        },
      });
      HTMLCanvasElement.prototype.getContext = () => null;
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async () => {
            throw new DOMException('Denied', 'NotAllowedError');
          },
        },
      });
      document.execCommand = () => false;
    });
    await host.goto(base + '#/new/birthday-signature');
    await host.waitForSelector('[data-key="person"]');
    await host.tap('[data-do="publish"]');
    await host.waitForFunction(
      () =>
        document.activeElement.dataset.key === 'person' &&
        document.querySelector('.save-error').textContent.includes('नाम'),
    );
    await set(host, '[data-key="person"]', 'सादर निमंत्रण', 'change'); // autofill: no input event
    await click(host, '[data-tab="2"]');
    await set(host, '[data-key="time"]', '18:30:00.000', 'change');
    await click(host, '[data-tab="1"]');
    await (await host.$('[data-file="photo"]')).uploadFile(png);
    await host.waitForSelector('[data-remove="photo"]', { visible: true });
    await host.tap('[data-do="publish"]');
    await host.waitForSelector('#modal[open] #share-url', { visible: true });
    const link = await host.$eval('#share-url', (el) => el.value);
    assert(link.startsWith(base + '#/i/v1.'));
    await host.waitForFunction(
      () =>
        document.querySelector('[data-link-storage]').textContent.includes('सेव नहीं हुए') &&
        document.querySelector('[data-optional-qr]').textContent.includes('QR'),
    );
    assert(host.url().includes('#/new/'));
    assert.equal(await host.$('.share-qr img'), null);
    await host.tap('#copy-url');
    await host.waitForFunction(() =>
      document.querySelector('[data-copy-status]').textContent.includes('दबाकर'),
    );
    assert.equal(
      await host.$eval('#share-url', (el) => el.value.slice(el.selectionStart, el.selectionEnd)),
      link,
    );
    await guest.goto(link);
    await guest.waitForSelector('.ticket-face');
    assert.equal(await guest.$eval('.ticket h1', (el) => el.textContent), 'सादर निमंत्रण');
    await click(guest, '.open-card');
    await guest.waitForFunction(() => document.querySelector('.portrait')?.naturalWidth === 32);
    const { id, data } = await guest.evaluate(async () => {
      const { unpack, readInvite } = await import('./public/pages/links.js');
      return readInvite(unpack(location.hash.split('/').pop()));
    });
    assert.equal(data.time, '18:30');
    // Storage can recover. The original pending photo, draft and already-issued invite ID must survive retry.
    await host.evaluate(() => {
      window.restoreStorage();
    });
    await click(host, '#modal [data-close]');
    await click(host, '[data-do="save"]');
    await host.waitForFunction((id) => location.hash === '#/edit/' + id, {}, id);
    await host.removeScriptToEvaluateOnNewDocument(shim.identifier);
    await host.reload();
    await host.waitForFunction(
      () => document.querySelector('#live-poster .portrait')?.naturalWidth === 32,
    );
    await click(host, 'nav a[href="#/dashboard"]');
    await click(host, '[data-share]');
    assert.equal(await host.$eval('#share-url', (el) => el.value), link);
    await click(host, '#modal [data-close]');
    await click(host, `a[href="#/edit/${id}"]`);
    await host.waitForFunction(
      () => document.querySelector('#live-poster .portrait')?.naturalWidth === 32,
    );
    // A pending open (not just a rejected promise) cannot hold a valid URL hostage.
    const pending = await context.newPage();
    await pending.evaluateOnNewDocument(() =>
      Object.defineProperty(window, 'indexedDB', {
        value: {
          open() {
            window.waitingForDisk = true;
            return {};
          },
        },
      }),
    );
    await pending.goto(base + '#/new/birthday-signature');
    await pending.waitForSelector('[data-key="person"]');
    await set(pending, '[data-key="person"]', 'Guest link before save');
    await pending.waitForFunction(() => window.waitingForDisk);
    await click(pending, '[data-do="publish"]');
    await pending.waitForSelector('#modal[open] #share-url', { visible: true });
    assert.deepEqual(errors, []);
    console.log(
      'PASS: mobile change-only name & seconds-bearing time; unsaved photo + blocked/pending IndexedDB; missing native clone/dialog/QR/clipboard; selectable URL opens in independent guest. Retrying storage keeps the original card and ID.',
    );
  } finally {
    await context.close();
  }
};
