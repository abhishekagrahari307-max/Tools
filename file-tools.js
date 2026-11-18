// Working browser-only file tools. Images use canvas; PDFs load pdf-lib and
// pdf.js on demand from the local vendor folder, so nothing is uploaded.
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const MB = 1024 * 1024;
const MAX_FILE = 60 * MB;
const MAX_IMAGES = 20;
const MAX_PDFS = 20;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const state = { convert: [], resize: [], merge: [], compress: [], word: [] };
const busy = {};

const sizeText = (n) =>
  n < 1024
    ? n + ' B'
    : n < MB
      ? (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB'
      : (n / MB).toFixed(2) + ' MB';
const stem = (name) =>
  (name.replace(/\.[^.]+$/, '') || 'file').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
function uniqueNamer() {
  const used = new Map();
  return (name) => {
    const seen = used.get(name) || 0;
    used.set(name, seen + 1);
    if (!seen) return name;
    const dot = name.lastIndexOf('.');
    return dot > 0
      ? name.slice(0, dot) + '-' + (seen + 1) + name.slice(dot)
      : name + '-' + (seen + 1);
  };
}
const extOf = (type) =>
  ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[type] ||
  'img';
const same = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();

function say(id, text, kind = '') {
  const el = $('#' + id + '-msg');
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
}
function bar(id, ratio) {
  const wrap = $('#' + id + '-progress');
  if (!wrap) return;
  wrap.hidden = ratio == null;
  wrap.querySelector('i').style.width =
    ratio == null ? '0%' : Math.round(Math.min(1, Math.max(0, ratio)) * 100) + '%';
}
function save(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function addOutput(container, name, blob, note) {
  const row = document.createElement('div');
  row.className = 'row';
  const nm = document.createElement('span');
  nm.className = 'nm';
  nm.textContent = name;
  const sz = document.createElement('span');
  sz.className = 'sz';
  sz.textContent = [sizeText(blob.size), note].filter(Boolean).join(' · ');
  const link = document.createElement('a');
  link.className = 'btn';
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.textContent = 'Download';
  row.append(nm, sz, link);
  container.append(row);
  return link;
}
const list = (tool) => $('[data-files="' + tool + '"]');
function clearOut(tool) {
  $('#' + tool + '-out').replaceChildren();
  say(tool, '');
  bar(tool, null);
}
function renderFiles(tool, { reorder = false } = {}) {
  const ul = list(tool);
  ul.replaceChildren();
  state[tool].forEach((file, index) => {
    const li = document.createElement('li');
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = file.name;
    const sz = document.createElement('span');
    sz.className = 'sz';
    sz.textContent = sizeText(file.size);
    li.append(nm, sz);
    if (reorder) {
      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'mini';
      up.textContent = '↑';
      up.title = 'Move up';
      up.setAttribute('aria-label', 'Move ' + file.name + ' up');
      up.disabled = index === 0;
      up.addEventListener('click', () => {
        [state[tool][index - 1], state[tool][index]] = [state[tool][index], state[tool][index - 1]];
        renderFiles(tool, { reorder: true });
      });
      const down = document.createElement('button');
      down.type = 'button';
      down.className = 'mini';
      down.textContent = '↓';
      down.title = 'Move down';
      down.setAttribute('aria-label', 'Move ' + file.name + ' down');
      down.disabled = index === state[tool].length - 1;
      down.addEventListener('click', () => {
        [state[tool][index + 1], state[tool][index]] = [state[tool][index], state[tool][index + 1]];
        renderFiles(tool, { reorder: true });
      });
      li.append(up, down);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'mini';
    remove.textContent = '×';
    remove.title = 'Remove';
    remove.setAttribute('aria-label', 'Remove ' + file.name);
    remove.addEventListener('click', () => {
      state[tool].splice(index, 1);
      renderFiles(tool, { reorder });
      syncButtons(tool);
    });
    li.append(remove);
    ul.append(li);
  });
  syncButtons(tool);
}
function syncButtons(tool) {
  const ok = state[tool].length > 0;
  const run = $('#' + tool + '-run');
  const clear = $('#' + tool + '-clear');
  if (run) run.disabled = !ok || !!busy[tool];
  if (clear) clear.disabled = !ok || !!busy[tool];
}
function acceptFiles(tool, incoming, limit, filter) {
  const files = Array.from(incoming);
  const tooBig = files.filter((f) => f.size > MAX_FILE);
  const wrong = files.filter((f) => !filter(f));
  const usable = files.filter((f) => filter(f) && f.size <= MAX_FILE);
  if (tool === 'compress' || tool === 'word') state[tool] = usable.slice(0, 1);
  else {
    const room = limit - state[tool].length;
    const unique = usable.filter(
      (f) =>
        !state[tool].some(
          (x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified,
        ),
    );
    state[tool].push(...unique.slice(0, Math.max(0, room)));
    if (unique.length > Math.max(0, room))
      say(tool, 'Only the first ' + limit + ' files were kept.', 'warn');
  }
  const notes = [];
  if (tooBig.length) notes.push(tooBig.length + ' file(s) were over 60 MB and were skipped.');
  if (wrong.length)
    notes.push(
      'Only ' +
        (tool === 'merge' || tool === 'compress' || tool === 'word' ? 'PDF' : 'image') +
        ' files are supported here.',
    );
  if (notes.length) say(tool, notes.join(' '), 'bad');
  renderFiles(tool, { reorder: tool === 'merge' });
}
function wireDrop(tool, { limit = MAX_IMAGES, filter }) {
  const drop = $('[data-drop="' + tool + '"]');
  const input = $('[data-input="' + tool + '"]');
  input.addEventListener('change', () => {
    acceptFiles(tool, input.files || [], limit, filter);
    input.value = '';
  });
  ['dragenter', 'dragover'].forEach((type) =>
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.add('over');
    }),
  );
  ['dragleave', 'drop'].forEach((type) =>
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      if (type === 'dragleave' && drop.contains(event.relatedTarget)) return;
      drop.classList.remove('over');
    }),
  );
  drop.addEventListener('drop', (event) => {
    if (event.dataTransfer?.files?.length)
      acceptFiles(tool, event.dataTransfer.files, limit, filter);
  });
  $('#' + tool + '-clear').addEventListener('click', () => {
    state[tool] = [];
    renderFiles(tool, { reorder: tool === 'merge' });
    clearOut(tool);
  });
}
const isImage = (file) =>
  IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
const isPdf = (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

async function bitmapOf(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to the <img> path */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = () => reject(Error('This image could not be opened. Try JPG, PNG or WebP.'));
      node.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight, node, close() {}, isNode: true };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
function paint(source, width, height, background) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('This browser cannot draw images. Try Chrome, Edge, Firefox or Safari.');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source.isNode ? source.node : source, 0, 0, canvas.width, canvas.height);
  return canvas;
}
function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob && blob.type === type
          ? resolve(blob)
          : reject(
              Error(
                'This browser cannot write ' +
                  extOf(type).toUpperCase() +
                  ' files. Choose another format.',
              ),
            ),
      type,
      type === 'image/png' ? undefined : quality,
    ),
  );
}

async function getPdfLib() {
  if (window.PDFLib) return window.PDFLib;
  if (!getPdfLib.promise) {
    getPdfLib.promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('./vendor/pdf-lib.min.js', import.meta.url).href;
      script.onload = () =>
        window.PDFLib ? resolve(window.PDFLib) : reject(Error('The PDF library did not start.'));
      script.onerror = () =>
        reject(Error('The PDF library could not be loaded. Check your connection and reload.'));
      document.head.append(script);
    }).catch((error) => {
      getPdfLib.promise = null;
      throw error;
    });
  }
  return getPdfLib.promise;
}
async function getPdfjs() {
  if (!getPdfjs.promise) {
    getPdfjs.promise = import('./vendor/pdfjs/pdf.min.js').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL(
        './vendor/pdfjs/pdf.worker.min.js',
        import.meta.url,
      ).href;
      return lib;
    });
  }
  return getPdfjs.promise;
}
function pdfError(error) {
  const text = String(error && error.message ? error.message : error);
  if (/encrypt|password/i.test(text))
    return 'This PDF is password-protected. Remove the password, then try again.';
  if (/invalid|header|structure|corrupt/i.test(text))
    return 'That file does not look like a complete PDF.';
  return 'The PDF could not be read. ' + (text.length < 120 ? text : '');
}
async function bytesOf(file) {
  return new Uint8Array(await file.arrayBuffer());
}

/* ---------------------------------------------------------------- converter */
$('#convert-quality').addEventListener('input', (event) => {
  $('#convert-quality-out').textContent = event.target.value + '%';
});
wireDrop('convert', { filter: isImage });
$('#convert-run').addEventListener('click', async () => {
  if (busy.convert || !state.convert.length) return;
  busy.convert = true;
  syncButtons('convert');
  const out = $('#convert-out');
  out.replaceChildren();
  const type = $('#convert-format').value;
  const quality = Number($('#convert-quality').value) / 100;
  const nameFor = uniqueNamer();
  let done = 0;
  const links = [];
  try {
    for (const file of state.convert) {
      say('convert', 'Converting ' + file.name + '…');
      const source = await bitmapOf(file);
      const canvas = paint(
        source,
        source.width,
        source.height,
        type === 'image/jpeg' ? '#ffffff' : null,
      );
      const blob = await toBlob(canvas, type, quality);
      links.push(
        addOutput(
          out,
          nameFor(stem(file.name) + '.' + extOf(type)),
          blob,
          source.width + '×' + source.height,
        ),
      );
      source.close?.();
      bar('convert', ++done / state.convert.length);
    }
    say(
      'convert',
      'Finished ' + done + ' image' + (done === 1 ? '' : 's') + '. Download them below.',
      'ok',
    );
    if (links.length > 1) {
      const all = document.createElement('button');
      all.type = 'button';
      all.className = 'btn ghost';
      all.textContent = 'Download all ' + links.length;
      all.addEventListener('click', async () => {
        for (const link of links) {
          link.click();
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      });
      out.append(all);
    }
  } catch (error) {
    say('convert', error.message, 'bad');
  } finally {
    busy.convert = false;
    syncButtons('convert');
    bar('convert', null);
  }
});

/* ------------------------------------------------------------------- resizer */
const refreshResizeMode = () => {
  const mode = $('#resize-mode').value;
  $$('[data-when]').forEach((node) => {
    node.hidden = !node.dataset.when.split(' ').includes(mode);
  });
};
$('#resize-mode').addEventListener('change', refreshResizeMode);
refreshResizeMode();
$('#resize-quality').addEventListener('input', (event) => {
  $('#resize-quality-out').textContent = event.target.value + '%';
});
wireDrop('resize', { filter: isImage });
$('#resize-run').addEventListener('click', async () => {
  if (busy.resize || !state.resize.length) return;
  busy.resize = true;
  syncButtons('resize');
  const out = $('#resize-out');
  out.replaceChildren();
  const mode = $('#resize-mode').value;
  const boxW = Math.max(1, Math.min(12000, Number($('#resize-w').value) || 1));
  const boxH = Math.max(1, Math.min(12000, Number($('#resize-h').value) || 1));
  const percent = Math.max(1, Math.min(400, Number($('#resize-pct').value) || 100)) / 100;
  const wanted = $('#resize-format').value;
  const quality = Number($('#resize-quality').value) / 100;
  const nameFor = uniqueNamer();
  let done = 0;
  try {
    for (const file of state.resize) {
      say('resize', 'Resizing ' + file.name + '…');
      const source = await bitmapOf(file);
      let width = source.width;
      let height = source.height;
      if (mode === 'fit') {
        const scale = Math.min(boxW / source.width, boxH / source.height);
        width = Math.max(1, Math.round(source.width * scale));
        height = Math.max(1, Math.round(source.height * scale));
      } else if (mode === 'exact') {
        width = boxW;
        height = boxH;
      } else {
        width = Math.max(1, Math.round(source.width * percent));
        height = Math.max(1, Math.round(source.height * percent));
      }
      const type =
        wanted === 'keep'
          ? IMAGE_TYPES.includes(file.type) && file.type !== 'image/gif'
            ? file.type
            : 'image/jpeg'
          : wanted;
      const canvas = paint(source, width, height, type === 'image/jpeg' ? '#ffffff' : null);
      const blob = await toBlob(canvas, type, quality);
      addOutput(
        out,
        nameFor(stem(file.name) + '-' + width + 'x' + height + '.' + extOf(type)),
        blob,
        source.width + '×' + source.height + ' → ' + width + '×' + height,
      );
      source.close?.();
      bar('resize', ++done / state.resize.length);
    }
    say('resize', 'Resized ' + done + ' image' + (done === 1 ? '' : 's') + '.', 'ok');
  } catch (error) {
    say('resize', error.message, 'bad');
  } finally {
    busy.resize = false;
    syncButtons('resize');
    bar('resize', null);
  }
});

/* -------------------------------------------------------------------- merger */
wireDrop('merge', { limit: MAX_PDFS, filter: isPdf });
$('#merge-run').addEventListener('click', async () => {
  if (busy.merge || !state.merge.length) return;
  busy.merge = true;
  syncButtons('merge');
  const out = $('#merge-out');
  out.replaceChildren();
  try {
    say('merge', 'Preparing the PDF engine…');
    const { PDFDocument } = await getPdfLib();
    const merged = await PDFDocument.create();
    merged.setProducer('ToolKit Pro · browser');
    merged.setCreationDate(new Date());
    let pages = 0;
    for (const [index, file] of state.merge.entries()) {
      say('merge', 'Adding ' + file.name + '…');
      let source;
      try {
        source = await PDFDocument.load(await bytesOf(file), { updateMetadata: false });
      } catch (error) {
        throw Error(file.name + ': ' + pdfError(error));
      }
      const copied = await merged.copyPages(source, source.getPageIndices());
      copied.forEach((page) => merged.addPage(page));
      pages += copied.length;
      bar('merge', (index + 1) / state.merge.length);
    }
    if (!pages) throw Error('Those PDFs have no pages.');
    const bytes = await merged.save({ useObjectStreams: true });
    const blob = new Blob([bytes], { type: 'application/pdf' });
    addOutput(
      out,
      'merged-' + new Date().toISOString().slice(0, 10) + '.pdf',
      blob,
      pages + ' pages',
    );
    say('merge', 'Merged ' + state.merge.length + ' files into ' + pages + ' pages.', 'ok');
  } catch (error) {
    say('merge', error.message, 'bad');
  } finally {
    busy.merge = false;
    syncButtons('merge');
    bar('merge', null);
  }
});

/* ------------------------------------------------------------------ compressor */
const refreshCompressMode = () => {
  const mode = $('#compress-mode').value;
  $$('#compress [data-when]').forEach((node) => {
    node.hidden = !node.dataset.when.split(' ').includes(mode);
  });
  $('#compress-note').hidden = false;
};
$('#compress-mode').addEventListener('change', refreshCompressMode);
$('#compress-quality').addEventListener('input', (event) => {
  $('#compress-quality-out').textContent = event.target.value + '%';
});
wireDrop('compress', { limit: 1, filter: isPdf });
$('#compress-run').addEventListener('click', async () => {
  if (busy.compress || !state.compress.length) return;
  busy.compress = true;
  syncButtons('compress');
  const out = $('#compress-out');
  out.replaceChildren();
  const file = state.compress[0];
  const mode = $('#compress-mode').value;
  try {
    say('compress', 'Loading ' + file.name + '…');
    const original = await bytesOf(file);
    let result;
    if (mode === 'raster') {
      const [pdfjs, { PDFDocument }] = await Promise.all([getPdfjs(), getPdfLib()]);
      say('compress', 'Drawing the pages…');
      let source;
      try {
        source = await pdfjs.getDocument({ data: original.slice(), isEvalSupported: false })
          .promise;
      } catch (error) {
        throw Error(pdfError(error));
      }
      if (source.numPages > 80)
        throw Error(
          'This PDF has ' + source.numPages + ' pages. Split it first, then compress the parts.',
        );
      const scale = Number($('#compress-scale').value);
      const quality = Number($('#compress-quality').value) / 100;
      const target = await PDFDocument.create();
      target.setProducer('ToolKit Pro · browser');
      for (let index = 1; index <= source.numPages; index++) {
        const page = await source.getPage(index);
        const view = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(view.width);
        canvas.height = Math.ceil(view.height);
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw Error('This browser cannot draw PDF pages. Try Chrome, Edge or Firefox.');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: view }).promise;
        const jpeg = await toBlob(canvas, 'image/jpeg', quality);
        page.cleanup?.();
        const picture = await target.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));
        const natural = page.getViewport({ scale: 1 });
        const added = target.addPage([natural.width, natural.height]);
        added.drawImage(picture, { x: 0, y: 0, width: natural.width, height: natural.height });
        bar('compress', index / source.numPages);
      }
      result = new Uint8Array(await target.save({ useObjectStreams: true }));
    } else {
      const { PDFDocument } = await getPdfLib();
      let source;
      try {
        source = await PDFDocument.load(original.slice(), { updateMetadata: false });
      } catch (error) {
        throw Error(pdfError(error));
      }
      say('compress', 'Rewriting the file…');
      result = await source.save({ useObjectStreams: true, addDefaultPage: false });
    }
    const blob = new Blob([result], { type: 'application/pdf' });
    const saved = original.length - blob.size;
    if (saved > 0) {
      addOutput(
        out,
        stem(file.name) + '-small.pdf',
        blob,
        Math.round((saved / original.length) * 100) + '% smaller',
      );
      say(
        'compress',
        'Done: ' + sizeText(original.length) + ' → ' + sizeText(blob.size) + '.',
        'ok',
      );
    } else {
      addOutput(out, stem(file.name) + '-copy.pdf', blob, 'about the same size');
      say(
        'compress',
        'This PDF is already compact — the rewrite is ' +
          sizeText(blob.size) +
          ', no smaller than the original. Keep the original.',
        'warn',
      );
    }
  } catch (error) {
    say('compress', error.message, 'bad');
  } finally {
    busy.compress = false;
    syncButtons('compress');
    bar('compress', null);
  }
});
refreshCompressMode();

/* ----------------------------------------------------------------- PDF to Word */
wireDrop('word', { limit: 1, filter: isPdf });
async function pageText(pdf, number) {
  const page = await pdf.getPage(number);
  const content = await page.getTextContent();
  const lines = [];
  let current = null;
  for (const item of content.items) {
    if (!item || typeof item.str !== 'string' || !item.str.trim()) continue;
    const y = item.transform[5];
    const x = item.transform[4];
    if (!current || Math.abs(current.y - y) > 3) {
      current = { y, parts: [] };
      lines.push(current);
    }
    current.parts.push({ x, text: item.str });
  }
  page.cleanup?.();
  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) =>
      line.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.text)
        .join('')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}
const xmlEscape = (text) =>
  text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(
      /[&<>"']/g,
      (character) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character],
    );

/* A tiny, dependency-free ZIP writer (stored entries) so the result is a real
   .docx Word can open without the “format and extension don’t match” warning. */
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function zipStored(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const now = new Date();
  const time = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() / 2)) & 0xffff;
  const date =
    (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
  const encoder = new TextEncoder();
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.text);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), name, data);
    const head = new DataView(new ArrayBuffer(46));
    head.setUint32(0, 0x02014b50, true);
    head.setUint16(4, 20, true);
    head.setUint16(6, 20, true);
    head.setUint16(8, 0x0800, true);
    head.setUint16(10, 0, true);
    head.setUint16(12, time, true);
    head.setUint16(14, date, true);
    head.setUint32(16, crc, true);
    head.setUint32(20, data.length, true);
    head.setUint32(24, data.length, true);
    head.setUint16(28, name.length, true);
    head.setUint32(42, offset, true);
    central.push(new Uint8Array(head.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((total, part) => total + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
function wordFile(title, pages, headed) {
  const paragraph = (text, options = {}) =>
    '<w:p><w:pPr><w:spacing w:after="' +
    (options.after ?? 120) +
    '"/>' +
    (options.heading ? '<w:rPr><w:b/><w:color w:val="777777"/><w:sz w:val="18"/></w:rPr>' : '') +
    '</w:pPr><w:r>' +
    (options.heading ? '<w:rPr><w:b/><w:color w:val="777777"/><w:sz w:val="18"/></w:rPr>' : '') +
    '<w:t xml:space="preserve">' +
    xmlEscape(text) +
    '</w:t></w:r></w:p>';
  const body = pages
    .map((lines, index) => {
      const head = headed ? paragraph('Page ' + (index + 1), { heading: true, after: 180 }) : '';
      const text = lines.length
        ? lines.map((line) => paragraph(line)).join('')
        : paragraph('This page has no text layer — it may be a scan or a picture.', {
            heading: true,
          });
      const pageBreak =
        index === pages.length - 1 ? '' : '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      return head + text + pageBreak;
    })
    .join('');
  const document =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    body +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
    '</w:body></w:document>';
  const files = [
    {
      name: '[Content_Types].xml',
      text:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '</Types>',
    },
    {
      name: '_rels/.rels',
      text:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '</Relationships>',
    },
    { name: 'word/document.xml', text: document },
    {
      name: 'docProps/core.xml',
      text:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">' +
        '<dc:title>' +
        xmlEscape(title) +
        '</dc:title><dc:creator>ToolKit Pro</dc:creator></cp:coreProperties>',
    },
    {
      name: 'docProps/app.xml',
      text:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>ToolKit Pro</Application></Properties>',
    },
  ];
  return zipStored(files);
}
$('#word-run').addEventListener('click', async () => {
  if (busy.word || !state.word.length) return;
  busy.word = true;
  syncButtons('word');
  const out = $('#word-out');
  out.replaceChildren();
  const file = state.word[0];
  try {
    say('word', 'Reading ' + file.name + '…');
    const pdfjs = await getPdfjs();
    let pdf;
    try {
      pdf = await pdfjs.getDocument({ data: (await bytesOf(file)).slice(), isEvalSupported: false })
        .promise;
    } catch (error) {
      throw Error(pdfError(error));
    }
    const pages = [];
    let words = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      say('word', 'Reading page ' + number + ' of ' + pdf.numPages + '…');
      const lines = await pageText(pdf, number);
      words += lines.join(' ').split(/\s+/).filter(Boolean).length;
      pages.push(lines);
      bar('word', number / pdf.numPages);
    }
    const blob = wordFile(stem(file.name), pages, $('#word-detail').value === 'headed');
    addOutput(out, stem(file.name) + '.docx', blob, pdf.numPages + ' pages · ' + words + ' words');
    say(
      'word',
      words
        ? 'Text lifted from ' +
            pages.filter((lines) => lines.length).length +
            ' of ' +
            pdf.numPages +
            ' pages. Download the Word file below.'
        : 'No text layer was found — this looks like a scanned PDF. Try the “Shrink pages as images” option in the PDF compressor instead.',
      words ? 'ok' : 'warn',
    );
  } catch (error) {
    say('word', error.message, 'bad');
  } finally {
    busy.word = false;
    syncButtons('word');
    bar('word', null);
  }
});

/* Keep the tool links honest: mark the tile of the section in view. */
const tiles = $$('.tile[data-tab]');
const panels = tiles.map((tile) => document.getElementById(tile.dataset.tab)).filter(Boolean);
if ('IntersectionObserver' in window && panels.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const tile = tiles.find((node) => node.dataset.tab === entry.target.id);
        if (tile) tile.setAttribute('aria-current', entry.isIntersecting ? 'true' : 'false');
      });
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  panels.forEach((panel) => observer.observe(panel));
}
