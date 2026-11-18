// Device-only letter drafts. The public wish route never calls this module's DB functions.
const store = 'letters';
let opening;
function db() {
  if (!opening)
    opening = new Promise((ok, no) => {
      const req = indexedDB.open('wishlys.letters.v1', 1);
      let abandoned = false;
      const fail = () => {
        abandoned = true;
        clearTimeout(timer);
        no(
          Error(
            'Device storage could not open. Keep this tab open to share or download your letter.',
          ),
        );
      };
      const timer = setTimeout(fail, 4000);
      req.onblocked = req.onerror = fail;
      req.onupgradeneeded = () => req.result.createObjectStore(store, { keyPath: 'id' });
      req.onsuccess = () => {
        clearTimeout(timer);
        const d = req.result;
        if (abandoned) {
          d.close();
          return;
        }
        d.onversionchange = () => {
          d.close();
          opening = null;
        };
        ok(d);
      };
    }).catch((e) => {
      opening = null;
      throw e;
    });
  return opening;
}
async function tx(mode, work) {
  const d = await db();
  return new Promise((ok, no) => {
    const tr = d.transaction(store, mode);
    let result, reason;
    tr.oncomplete = () => ok(result);
    tr.onabort = () => no(reason || tr.error || Error('Draft storage unavailable.'));
    work(
      tr.objectStore(store),
      (v) => {
        result = v;
      },
      (e) => {
        reason = e;
        tr.abort();
      },
    );
  });
}
export const getDraft = (id) =>
  tx('readonly', (s, done) => {
    const req = s.get(id);
    req.onsuccess = () => done(req.result);
  });
export const listDrafts = () =>
  tx('readonly', (s, done) => {
    const rows = [],
      req = s.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        done(rows);
        return;
      }
      const { id, version, updated, data } = cursor.value;
      rows.push({
        id,
        version,
        updated,
        template: data.template,
        recipient: data.recipient,
        sender: data.sender,
      });
      cursor.continue();
    };
  });
export function writeDraft(id, version, data) {
  return tx('readwrite', (s, done, fail) => {
    const req = s.get(id);
    req.onsuccess = () => {
      if ((req.result?.version ?? 0) !== version) {
        fail(Error('This draft changed in another tab. Reopen it before saving.'));
        return;
      }
      const updated = Date.now();
      s.put({ id, data, version: version + 1, updated });
      done({ version: version + 1, updated });
    };
  });
}
export const removeDraft = (id, version) =>
  tx('readwrite', (s, done, fail) => {
    const req = s.get(id);
    req.onsuccess = () => {
      if (req.result && req.result.version !== version) {
        fail(Error('This letter changed in another tab. Refresh the shelf first.'));
        return;
      }
      s.delete(id);
    };
  });
