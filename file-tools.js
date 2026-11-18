// Working browser-only file tools. Images run through canvas, PDFs through
// pdf-lib and pdf.js loaded on demand from ./vendor, so nothing is uploaded.
// Every tool on file-tools.html is wired from the list at the bottom of this file.

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const MB = 1024 * 1024;
const MAX_FILE = 60 * MB;
const MAX_FILES = 20;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const isImage = (file) =>
  IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
const isPdf = (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

const sizeText = (n) =>
  n < 1024
    ? n + ' B'
    : n < MB
      ? (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB'
      : (n / MB).toFixed(2) + ' MB';
const stem = (name) =>
  (name.replace(/\.[^.]+$/, '') || 'file').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 70);
const extOf = (type) =>
  ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[type] ||
  'img';
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

const state = {};
const busy = {};
const TOOLS = {};

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
function downloadAllButton(container, links) {
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
  container.append(all);
  return all;
}

const filesOf = (tool) => (state[tool] ||= []);
function clearOut(tool) {
  $('#' + tool + '-out').replaceChildren();
  say(tool, '');
  bar(tool, null);
}
function syncButtons(tool) {
  const ok = filesOf(tool).length > 0;
  const run = $('#' + tool + '-run');
  const clear = $('#' + tool + '-clear');
  if (run) run.disabled = !ok || !!busy[tool];
  if (clear) clear.disabled = !ok || !!busy[tool];
}
function renderFiles(tool, reorder = false) {
  const ul = $('[data-files="' + tool + '"]');
  if (!ul) return;
  ul.replaceChildren();
  filesOf(tool).forEach((file, index) => {
    const li = document.createElement('li');
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = file.name;
    const sz = document.createElement('span');
    sz.className = 'sz';
    sz.textContent = sizeText(file.size);
    li.append(nm, sz);
    if (reorder) {
      const move = (delta, label, glyph) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mini';
        button.textContent = glyph;
        button.title = label;
        button.setAttribute('aria-label', label + ' ' + file.name);
        button.disabled = index + delta < 0 || index + delta >= filesOf(tool).length;
        button.addEventListener('click', () => {
          const list = filesOf(tool);
          [list[index + delta], list[index]] = [list[index], list[index + delta]];
          renderFiles(tool, true);
        });
        return button;
      };
      li.append(move(-1, 'Move up', '↑'), move(1, 'Move down', '↓'));
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'mini';
    remove.textContent = '×';
    remove.title = 'Remove';
    remove.setAttribute('aria-label', 'Remove ' + file.name);
    remove.addEventListener('click', () => {
      filesOf(tool).splice(index, 1);
      renderFiles(tool, reorder);
      syncButtons(tool);
    });
    li.append(remove);
    ul.append(li);
  });
  syncButtons(tool);
}

function acceptFiles(tool, incoming) {
  const config = TOOLS[tool];
  const list = filesOf(tool);
  const incomingFiles = Array.from(incoming);
  const accepted = incomingFiles.filter((file) => config.accept(file) && file.size <= MAX_FILE);
  const tooBig = incomingFiles.filter((file) => file.size > MAX_FILE);
  const wrong = incomingFiles.filter((file) => !config.accept(file));
  const limit = config.limit || MAX_FILES;
  if (!config.multiple) list.splice(0, list.length, ...accepted.slice(0, 1));
  else {
    const fresh = accepted.filter(
      (file) =>
        !list.some(
          (old) =>
            old.name === file.name &&
            old.size === file.size &&
            old.lastModified === file.lastModified,
        ),
    );
    const room = Math.max(0, limit - list.length);
    list.push(...fresh.slice(0, room));
    if (fresh.length > room) say(tool, 'Only the first ' + limit + ' files were kept.', 'warn');
  }
  const notes = [];
  if (tooBig.length) notes.push(tooBig.length + ' file(s) over 60 MB were skipped.');
  if (wrong.length)
    notes.push(
      'This tool takes ' +
        (config.accept === isPdf ? 'PDF' : 'image') +
        ' files only — ' +
        wrong.length +
        ' file(s) were skipped.',
    );
  if (notes.length) say(tool, notes.join(' '), 'bad');
  renderFiles(tool, !!config.reorder);
}

function wireDrop(tool) {
  const drop = $('[data-drop="' + tool + '"]');
  const input = $('[data-input="' + tool + '"]');
  if (!drop || !input) return;
  input.addEventListener('change', () => {
    acceptFiles(tool, input.files || []);
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
    event.preventDefault();
    if (event.dataTransfer?.files?.length) acceptFiles(tool, event.dataTransfer.files);
  });
  $('#' + tool + '-clear')?.addEventListener('click', () => {
    filesOf(tool).length = 0;
    renderFiles(tool, !!TOOLS[tool].reorder);
    clearOut(tool);
  });
}

/* --------------------------------------------------------------- image plumbing */
async function bitmapOf(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall back to an <img> below */
    }
  }
  const url = URL.createObjectURL(file);
  const img = await new Promise((resolve, reject) => {
    const node = new Image();
    node.onload = () => resolve(node);
    node.onerror = () => reject(Error('This image could not be opened. Try JPG, PNG or WebP.'));
    node.src = url;
  });
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    node: img,
    close() {},
    isNode: true,
  };
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
  ctx.drawImage(
    source.isNode ? source.node : source,
    0,
    0,
    source.width,
    source.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}
function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob && (!type || blob.type === type)
          ? resolve(blob)
          : reject(
              Error(
                'This browser cannot write ' +
                  (extOf(type) || type).toUpperCase() +
                  ' files. Choose another format.',
              ),
            ),
      type,
      type === 'image/png' ? undefined : quality,
    ),
  );
}

/* ----------------------------------------------------------------- pdf plumbing */
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
const bytesOf = async (file) => new Uint8Array(await file.arrayBuffer());
async function openPdf(file) {
  const pdfjs = await getPdfjs();
  const bytes = await bytesOf(file);
  try {
    return {
      pdf: await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise,
      bytes,
    };
  } catch (error) {
    throw Error(pdfError(error));
  }
}
async function pagedLib(file) {
  const PDFLib = await getPdfLib();
  try {
    return { PDFLib, doc: await PDFLib.PDFDocument.load(await bytesOf(file)) };
  } catch (error) {
    throw Error(pdfError(error));
  }
}
async function renderPage(pdf, number, scale = 1.4) {
  const page = await pdf.getPage(number);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('This browser cannot draw PDF pages.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup?.();
  return canvas;
}
async function pageLines(pdf, number) {
  const page = await pdf.getPage(number);
  const content = await page.getTextContent();
  const rows = new Map();
  for (const item of content.items) {
    if (!item || typeof item.str !== 'string' || !item.str) continue;
    const key = Math.round(item.transform[5] / 2) * 2;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push({ x: item.transform[4], text: item.str });
  }
  const lines = [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, cells]) =>
      cells
        .sort((a, b) => a.x - b.x)
        .map((cell) => cell.text)
        .join('')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
  page.cleanup?.();
  return lines;
}
async function pdfText(file, onPage) {
  const { pdf } = await openPdf(file);
  const pages = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    pages.push(await pageLines(pdf, number));
    onPage?.(number, pdf.numPages);
  }
  return pages;
}
function parsePages(input, total) {
  const text = String(input || '').trim();
  if (!text) return Array.from({ length: total }, (_, index) => index + 1);
  const picked = [];
  for (const chunk of text.split(/[,;\s]+/).filter(Boolean)) {
    const range = chunk.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      let from = Math.max(1, Number(range[1]));
      let to = Math.min(total, Number(range[2]));
      if (from > to) [from, to] = [to, from];
      for (let page = from; page <= to; page++) if (!picked.includes(page)) picked.push(page);
    } else if (/^\d+$/.test(chunk)) {
      const page = Number(chunk);
      if (page >= 1 && page <= total && !picked.includes(page)) picked.push(page);
    }
  }
  if (!picked.length)
    throw Error('No valid page numbers. Use something like 1-3, 5 (this PDF has ' + total + ').');
  return picked;
}

/* ------------------------------------------------------------------- docx writer */
const xmlEscape = (text) =>
  text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(
      /[&<>"']/g,
      (character) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character],
    );
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
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(local.buffer), name, data);
    const head = new DataView(new ArrayBuffer(46));
    head.setUint32(0, 0x02014b50, true);
    head.setUint16(4, 20, true);
    head.setUint16(6, 20, true);
    head.setUint16(8, 0x0800, true);
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

/* --------------------------------------------------------------- tool framework */
const option = (id, key) => {
  const el = $('#' + id + '-' + key);
  if (!el) return undefined;
  if (el.type === 'checkbox') return el.checked;
  return el.value;
};
const number = (id, key, fallback = 0, min = -1e9, max = 1e9) => {
  const value = Number(option(id, key));
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

function setup(id, config) {
  TOOLS[id] = {
    accept: config.accept === 'pdf' ? isPdf : config.accept === 'any' ? () => true : isImage,
    multiple: !!config.multiple,
    limit: config.limit || MAX_FILES,
    reorder: !!config.reorder,
    run: config.run,
  };
  state[id] = [];
  wireDrop(id);
  $$('input[type=range]', $('#' + id)).forEach((input) => {
    const out = $('#' + id + '-' + input.id.slice(id.length + 1) + '-out');
    if (!out) return;
    const update = () => {
      out.textContent = input.value + (input.dataset.suffix || '');
    };
    input.addEventListener('input', update);
    update();
  });
  $('#' + id + '-run')?.addEventListener('click', () => runTool(id));
  syncButtons(id);
}

async function runTool(id) {
  const config = TOOLS[id];
  if (!config || busy[id] || !filesOf(id).length) return;
  busy[id] = true;
  syncButtons(id);
  const out = $('#' + id + '-out');
  out.replaceChildren();
  say(id, '');
  const links = [];
  const context = {
    id,
    files: filesOf(id).slice(),
    out,
    links,
    names: uniqueNamer(),
    opt: (key) => option(id, key),
    num: (key, fallback, min, max) => number(id, key, fallback, min, max),
    // handlers may call say('text', 'ok') or the older say(id, 'text', 'ok')
    say: (first, second, third) => (first === id ? say(id, second, third) : say(id, first, second)),
    bar: (first, second) => bar(id, first === id ? second : first),
    add: (name, blob, note) => {
      const link = addOutput(out, name, blob, note);
      links.push(link);
      return link;
    },
    downloadAll: () => {
      if (links.length > 1) downloadAllButton(out, links);
    },
  };
  try {
    await config.run(context);
  } catch (error) {
    say(id, error?.message || String(error), 'bad');
  } finally {
    busy[id] = false;
    syncButtons(id);
    bar(id, null);
  }
}

/* ------------------------------------------------------------------ PDF: merge */
setup('merge', {
  accept: 'pdf',
  multiple: true,
  reorder: true,
  run: async ({ files, add, say, bar }) => {
    const { PDFLib, doc } = await pagedLib(files[0]);
    for (const file of files.slice(1)) {
      const source = await pagedLib(file);
      const pages = await doc.copyPages(source.doc, source.doc.getPageIndices());
      pages.forEach((page) => doc.addPage(page));
      void PDFLib;
    }
    const blob = new Blob([await doc.save()], { type: 'application/pdf' });
    add('merged.pdf', blob, doc.getPageCount() + ' pages');
    say('merge', 'Merged ' + files.length + ' files into ' + doc.getPageCount() + ' pages.', 'ok');
    bar('merge', 1);
  },
});

/* ------------------------------------------------------------------ PDF: split */
setup('split', {
  accept: 'pdf',
  run: async ({ files, opt, add, say, names, downloadAll }) => {
    const file = files[0];
    const { PDFLib, doc } = await pagedLib(file);
    const total = doc.getPageCount();
    const mode = opt('mode');
    const groups = [];
    if (mode === 'each') {
      for (let page = 0; page < total; page++)
        groups.push({ label: String(page + 1), pages: [page] });
    } else {
      for (const chunk of String(opt('ranges') || '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)) {
        const pages = parsePages(chunk, total).map((page) => page - 1);
        groups.push({ label: chunk.replace(/\s+/g, ''), pages });
      }
      if (!groups.length) throw Error('Type the pages to keep, for example 1-3, 5.');
    }
    for (const group of groups) {
      const outDoc = await PDFLib.PDFDocument.create();
      const copied = await outDoc.copyPages(doc, group.pages);
      copied.forEach((page) => outDoc.addPage(page));
      add(
        names(stem(file.name) + '-p' + group.label + '.pdf'),
        new Blob([await outDoc.save()], { type: 'application/pdf' }),
        group.pages.length + ' page' + (group.pages.length === 1 ? '' : 's'),
      );
    }
    say('split', 'Split into ' + groups.length + ' PDF file(s).', 'ok');
    downloadAll();
  },
});

/* ------------------------------------------------------------- PDF: pages→JPG */
setup('pdftojpg', {
  accept: 'pdf',
  run: async ({ files, opt, num, add, say, bar, names, downloadAll }) => {
    const { pdf } = await openPdf(files[0]);
    const type = opt('format') === 'image/png' ? 'image/png' : 'image/jpeg';
    const quality = num('quality', 88, 30, 100) / 100;
    for (let page = 1; page <= pdf.numPages; page++) {
      say('pdftojpg', 'Drawing page ' + page + ' of ' + pdf.numPages + '…');
      const canvas = await renderPage(pdf, page, 1.6);
      const blob = await toBlob(canvas, type, quality);
      add(
        names(stem(files[0].name) + '-page-' + String(page).padStart(2, '0') + '.' + extOf(type)),
        blob,
        canvas.width + '×' + canvas.height,
      );
      bar('pdftojpg', page / pdf.numPages);
    }
    say('pdftojpg', 'Made ' + pdf.numPages + ' image(s) from the PDF.', 'ok');
    downloadAll();
  },
});

/* ------------------------------------------------------------ PDF: images→PDF */
setup('imgtopdf', {
  accept: 'image',
  multiple: true,
  run: async ({ files, opt, num, add, say, bar }) => {
    const PDFLib = await getPdfLib();
    const doc = await PDFLib.PDFDocument.create();
    const margin = (num('margin', 12, 0, 40) / 25.4) * 72;
    const pageMode = opt('size');
    for (const [index, file] of files.entries()) {
      say('imgtopdf', 'Adding ' + file.name + '…');
      let bytes = await bytesOf(file);
      let type = file.type || 'image/jpeg';
      if (!/jpeg|png/.test(type)) {
        const bitmap = await bitmapOf(file);
        const canvas = paint(bitmap, bitmap.width, bitmap.height, '#ffffff');
        bytes = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer());
        type = 'image/jpeg';
        bitmap.close?.();
      }
      const image = /png/i.test(type) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      let pageWidth = (image.width * 72) / 96 + margin * 2;
      let pageHeight = (image.height * 72) / 96 + margin * 2;
      if (pageMode === 'a4') {
        pageWidth = 595.28;
        pageHeight = 841.89;
      }
      const page = doc.addPage([pageWidth, pageHeight]);
      const box = { width: pageWidth - margin * 2, height: pageHeight - margin * 2 };
      const scale = Math.min(box.width / image.width, box.height / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      page.drawImage(image, {
        x: (pageWidth - width) / 2,
        y: (pageHeight - height) / 2,
        width,
        height,
      });
      bar('imgtopdf', (index + 1) / files.length);
    }
    add(
      'images.pdf',
      new Blob([await doc.save()], { type: 'application/pdf' }),
      doc.getPageCount() + ' pages',
    );
    say('imgtopdf', 'Combined ' + files.length + ' image(s) into one PDF.', 'ok');
  },
});

/* ------------------------------------------------------------ PDF: compress */
async function rasterPdf(pdf, scale, quality) {
  const PDFLib = await getPdfLib();
  const doc = await PDFLib.PDFDocument.create();
  for (let page = 1; page <= pdf.numPages; page++) {
    const canvas = await renderPage(pdf, page, scale);
    const jpeg = await toBlob(canvas, 'image/jpeg', quality);
    const image = await doc.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));
    const sheet = doc.addPage([canvas.width * 0.75, canvas.height * 0.75]);
    sheet.drawImage(image, {
      x: 0,
      y: 0,
      width: canvas.width * 0.75,
      height: canvas.height * 0.75,
    });
  }
  return new Blob([await doc.save()], { type: 'application/pdf' });
}

setup('compress', {
  accept: 'pdf',
  run: async ({ files, opt, num, add, say, bar }) => {
    const file = files[0];
    const mode = opt('mode');
    const targetKb = num('target', 200, 10, 5000);
    const target = targetKb * 1024;
    if (mode === 'clean' || file.size <= target) {
      const { doc } = await pagedLib(file);
      const blob = new Blob([await doc.save({ useObjectStreams: true })], {
        type: 'application/pdf',
      });
      bar('compress', 1);
      if (blob.size < file.size) {
        add(stem(file.name) + '-clean.pdf', blob, 'structure rewritten');
        say(
          'compress',
          'Cleaned up: ' + sizeText(file.size) + ' → ' + sizeText(blob.size) + '.',
          'ok',
        );
      } else if (file.size <= target) {
        say(
          'compress',
          'This PDF is already ' +
            sizeText(file.size) +
            ' — under your ' +
            targetKb +
            ' KB target, so there is nothing worth shrinking.',
          'ok',
        );
      } else {
        say(
          'compress',
          'This PDF is already compact — the rewrite is ' +
            sizeText(blob.size) +
            ', no smaller than the original. Keep the original.',
          'warn',
        );
      }
      return;
    }
    const { pdf } = await openPdf(file);
    if (pdf.numPages > 40)
      throw Error('This PDF has ' + pdf.numPages + ' pages. Shrinking works best under 40 pages.');
    const attempts = [
      [1.4, 0.85],
      [1.2, 0.7],
      [1, 0.6],
      [0.85, 0.5],
      [0.7, 0.45],
      [0.55, 0.4],
    ];
    let best = null;
    for (const [index, [scale, quality]] of attempts.entries()) {
      say(
        'compress',
        'Trying page size ' +
          Math.round(scale * 100) +
          '% at ' +
          Math.round(quality * 100) +
          '% quality (attempt ' +
          (index + 1) +
          ' of ' +
          attempts.length +
          ')…',
      );
      const blob = await rasterPdf(pdf, scale, quality);
      bar('compress', (index + 1) / attempts.length);
      if (blob.size >= file.size) continue; // never hand back a bigger file
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= target) break;
    }
    if (!best) {
      say(
        'compress',
        'This PDF is already smaller than any picture-based rewrite (' +
          sizeText(file.size) +
          '). Keep the original.',
        'warn',
      );
      return;
    }
    add(stem(file.name) + '-small.pdf', best, 'target ' + targetKb + ' KB');
    say(
      'compress',
      best.size <= target
        ? 'Done: ' +
            sizeText(file.size) +
            ' → ' +
            sizeText(best.size) +
            ' (under ' +
            targetKb +
            ' KB).'
        : 'I got it down to ' +
            sizeText(best.size) +
            ' — close to your ' +
            targetKb +
            ' KB target but not under it. The download is the smallest version.',
      best.size <= target ? 'ok' : 'warn',
    );
  },
});

/* ---------------------------------------------------------- PDF: PDF→Word */
setup('word', {
  accept: 'pdf',
  run: async ({ files, opt, add, say, bar }) => {
    const pages = await pdfText(files[0], (page, total) => {
      say('word', 'Reading page ' + page + ' of ' + total + '…');
      bar('word', page / total);
    });
    const words = pages.reduce(
      (total, lines) => total + lines.join(' ').split(/\s+/).filter(Boolean).length,
      0,
    );
    const blob = wordFile(stem(files[0].name), pages, opt('detail') === 'headed');
    add(stem(files[0].name) + '.docx', blob, pages.length + ' pages · ' + words + ' words');
    say(
      'word',
      words
        ? 'Text lifted from ' +
            pages.filter((lines) => lines.length).length +
            ' of ' +
            pages.length +
            ' pages. Download the Word file below.'
        : 'No text layer was found — this looks like a scanned PDF. Try PDF → JPG to get images instead.',
      words ? 'ok' : 'warn',
    );
  },
});

/* ---------------------------------------------------------- PDF: PDF→text */
setup('pdftext', {
  accept: 'pdf',
  run: async ({ files, opt, add, say, bar }) => {
    const pages = await pdfText(files[0], (page, total) => {
      say('pdftext', 'Reading page ' + page + ' of ' + total + '…');
      bar('pdftext', page / total);
    });
    const text = pages
      .map(
        (lines, index) =>
          (opt('labels') === 'labels' ? '--- Page ' + (index + 1) + ' ---\n' : '') +
          lines.join('\n'),
      )
      .join('\n\n');
    const count = text.split(/\s+/).filter(Boolean).length;
    if (!count) throw Error('No text layer found — this PDF is probably a scan.');
    add(stem(files[0].name) + '.txt', new Blob([text], { type: 'text/plain' }), count + ' words');
    say('pdftext', 'Extracted ' + count + ' words from ' + pages.length + ' pages.', 'ok');
  },
});

/* -------------------------------------------------------- PDF: organize pages */
setup('organize', {
  accept: 'pdf',
  run: async ({ files, opt, add, say }) => {
    const file = files[0];
    const { PDFLib, doc } = await pagedLib(file);
    const total = doc.getPageCount();
    const order = parsePages(opt('order'), total);
    if (order.length === total && order.every((page, index) => page === index + 1)) {
      say(
        'organize',
        'That is the current order — change the list to reorder or remove pages.',
        'warn',
      );
      return;
    }
    const outDoc = await PDFLib.PDFDocument.create();
    const copied = await outDoc.copyPages(
      doc,
      order.map((page) => page - 1),
    );
    copied.forEach((page) => outDoc.addPage(page));
    add(
      stem(file.name) + '-reordered.pdf',
      new Blob([await outDoc.save()], { type: 'application/pdf' }),
      order.length + ' of ' + total + ' pages',
    );
    say(
      'organize',
      'Saved ' +
        order.length +
        ' page(s) in the new order' +
        (order.length < total ? ', ' + (total - order.length) + ' removed.' : '.'),
      'ok',
    );
  },
});

/* ------------------------------------------------------------ PDF: rotate */
setup('rotate', {
  accept: 'pdf',
  run: async ({ files, opt, add, say }) => {
    const file = files[0];
    const { PDFLib, doc } = await pagedLib(file);
    const angle = Number(opt('angle')) || 90;
    const pages = parsePages(opt('pages'), doc.getPageCount());
    for (const number of pages) {
      const page = doc.getPage(number - 1);
      page.setRotation(PDFLib.degrees((page.getRotation().angle + angle) % 360));
    }
    add(
      stem(file.name) + '-rotated.pdf',
      new Blob([await doc.save()], { type: 'application/pdf' }),
      pages.length + ' pages turned ' + angle + '°',
    );
    say('rotate', 'Rotated ' + pages.length + ' page(s) by ' + angle + '°.', 'ok');
  },
});

/* ------------------------------------------------------- PDF: page numbers */
setup('pagenum', {
  accept: 'pdf',
  run: async ({ files, opt, num, add, say }) => {
    const file = files[0];
    const { PDFLib, doc } = await pagedLib(file);
    const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const start = num('start', 1, 1, 9999);
    const format = opt('format');
    const position = opt('position');
    const total = doc.getPageCount();
    doc.getPages().forEach((page, index) => {
      const current = start + index;
      const label =
        format === 'of'
          ? current + ' / ' + (start + total - 1)
          : format === 'page'
            ? 'Page ' + current
            : String(current);
      const size = 11;
      const width = font.widthOfTextAtSize(label, size);
      const { width: pageWidth, height: pageHeight } = page.getSize();
      const margin = 28;
      const x =
        position === 'bottom-right' || position === 'top-right'
          ? pageWidth - width - margin
          : (pageWidth - width) / 2;
      const y = position.startsWith('top') ? pageHeight - margin : margin - 4;
      page.drawText(label, { x, y, size, font, color: PDFLib.rgb(0.25, 0.25, 0.25) });
    });
    add(
      stem(file.name) + '-numbered.pdf',
      new Blob([await doc.save()], { type: 'application/pdf' }),
      total + ' pages numbered',
    );
    say('pagenum', 'Numbered ' + total + ' pages, starting at ' + start + '.', 'ok');
  },
});

/* --------------------------------------------------------- PDF: watermark */
setup('watermark', {
  accept: 'pdf',
  run: async ({ files, opt, num, add, say }) => {
    const file = files[0];
    const text = String(opt('text') || '').trim();
    if (!text) throw Error('Type the watermark text first.');
    if (!/^[\x20-\x7e’‘“”–—°€£•]+$/.test(text))
      throw Error('Watermarks use Latin letters for now. Try an English word or your name.');
    const { PDFLib, doc } = await pagedLib(file);
    const font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const opacity = num('opacity', 18, 5, 60) / 100;
    const scale = num('size', 100, 40, 160) / 100;
    const diagonal = opt('angle') !== 'flat';
    doc.getPages().forEach((page) => {
      const { width, height } = page.getSize();
      const size = (Math.min(width, height) / (text.length > 12 ? 12 : 8)) * scale;
      const textWidth = font.widthOfTextAtSize(text, size);
      const x = diagonal ? (width - textWidth * 0.7071) / 2 : (width - textWidth) / 2;
      const y = diagonal ? (height - textWidth * 0.7071) / 2 : height / 2 - size / 3;
      page.drawText(text, {
        x: Math.max(12, x),
        y: Math.max(12, y),
        size,
        font,
        color: PDFLib.rgb(0.45, 0.45, 0.45),
        opacity,
        rotate: PDFLib.degrees(diagonal ? 45 : 0),
      });
    });
    add(
      stem(file.name) + '-watermarked.pdf',
      new Blob([await doc.save()], { type: 'application/pdf' }),
      doc.getPageCount() + ' pages stamped',
    );
    say('watermark', 'Added “' + text + '” to ' + doc.getPageCount() + ' pages.', 'ok');
  },
});

/* -------------------------------------------------------- IMAGE: convert */
setup('convert', {
  accept: 'image',
  multiple: true,
  run: async ({ files, opt, num, add, say, bar, names, downloadAll }) => {
    const type = opt('format') || 'image/webp';
    const quality = num('quality', 88, 40, 100) / 100;
    for (const [index, file] of files.entries()) {
      say('convert', 'Converting ' + file.name + '…');
      const source = await bitmapOf(file);
      const canvas = paint(
        source,
        source.width,
        source.height,
        type === 'image/jpeg' ? '#ffffff' : null,
      );
      const blob = await toBlob(canvas, type, quality);
      add(names(stem(file.name) + '.' + extOf(type)), blob, source.width + '×' + source.height);
      source.close?.();
      bar('convert', (index + 1) / files.length);
    }
    say(
      'convert',
      'Finished ' + files.length + ' image' + (files.length === 1 ? '' : 's') + '.',
      'ok',
    );
    downloadAll();
  },
});

/* --------------------------------------------------------- IMAGE: resize */
const refreshResizeMode = () => {
  const mode = $('#resize-mode').value;
  $$('[data-when]').forEach((node) => {
    node.hidden = !node.dataset.when.split(' ').includes(mode);
  });
};
setup('resize', {
  accept: 'image',
  multiple: true,
  run: async ({ files, opt, num, add, say, bar, names, downloadAll }) => {
    const mode = opt('mode');
    const boxW = num('w', 800, 1, 12000);
    const boxH = num('h', 800, 1, 12000);
    const percent = num('pct', 100, 1, 400) / 100;
    const wanted = opt('format');
    const quality = num('quality', 90, 40, 100) / 100;
    for (const [index, file] of files.entries()) {
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
      add(
        names(stem(file.name) + '-' + width + 'x' + height + '.' + extOf(type)),
        blob,
        sizeText(blob.size),
      );
      source.close?.();
      bar('resize', (index + 1) / files.length);
    }
    say('resize', 'Resized ' + files.length + ' image(s).', 'ok');
    downloadAll();
  },
});
$('#resize-mode')?.addEventListener('change', refreshResizeMode);
refreshResizeMode();

/* -------------------------------------------------- IMAGE: compress to size */
setup('imgcompress', {
  accept: 'image',
  multiple: true,
  run: async ({ files, opt, num, add, say, bar, names, downloadAll }) => {
    const targetKb = num('target', 200, 10, 20000);
    const target = targetKb * 1024;
    const maxWidth = num('maxwidth', 0, 0, 12000);
    const type = opt('format') === 'image/png' ? 'image/png' : 'image/jpeg';
    for (const [index, file] of files.entries()) {
      say('imgcompress', 'Compressing ' + file.name + '…');
      const source = await bitmapOf(file);
      let width = maxWidth ? Math.min(source.width, maxWidth) : source.width;
      let height = Math.round((source.height * width) / source.width);
      let best = null;
      for (let round = 0; round < 6; round++) {
        for (const quality of [0.9, 0.75, 0.6, 0.45]) {
          const canvas = paint(source, width, height, type === 'image/jpeg' ? '#ffffff' : null);
          const blob = await toBlob(canvas, type, quality);
          if (!best || blob.size < best.size) best = blob;
          if (blob.size <= target) {
            best = blob;
            break;
          }
        }
        if (best.size <= target || width < 320) break;
        width = Math.round(width * 0.8);
        height = Math.round((source.height * width) / source.width);
      }
      add(
        names(stem(file.name) + '-small.' + extOf(type)),
        best,
        best.size <= target ? 'under ' + targetKb + ' KB' : 'closest possible',
      );
      say(
        'imgcompress',
        best.size <= target
          ? 'Done: ' +
              sizeText(file.size) +
              ' → ' +
              sizeText(best.size) +
              ' (under ' +
              targetKb +
              ' KB).'
          : 'Best result is ' + sizeText(best.size) + ' — the target was ' + targetKb + ' KB.',
        best.size <= target ? 'ok' : 'warn',
      );
      source.close?.();
      bar('imgcompress', (index + 1) / files.length);
    }
    downloadAll();
  },
});

/* ----------------------------------------------------------- IMAGE: crop */
setup('crop', {
  accept: 'image',
  multiple: true,
  run: async ({ files, num, add, say, bar, names, downloadAll }) => {
    const x = num('x', 0, 0, 20000);
    const y = num('y', 0, 0, 20000);
    const wantedW = num('w', 600, 1, 20000);
    const wantedH = num('h', 600, 1, 20000);
    for (const [index, file] of files.entries()) {
      const source = await bitmapOf(file);
      const left = Math.min(x, source.width - 1);
      const top = Math.min(y, source.height - 1);
      const width = Math.max(1, Math.min(wantedW, source.width - left));
      const height = Math.max(1, Math.min(wantedH, source.height - top));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        source.isNode ? source.node : source,
        left,
        top,
        width,
        height,
        0,
        0,
        width,
        height,
      );
      const blob = await toBlob(canvas, 'image/png');
      add(names(stem(file.name) + '-crop.png'), blob, width + '×' + height);
      source.close?.();
      say('crop', 'Cropped ' + index + 1 + ' of ' + files.length + '…');
      bar('crop', (index + 1) / files.length);
    }
    say('crop', 'Cropped ' + files.length + ' image(s).', 'ok');
    downloadAll();
  },
});

/* ------------------------------------------------- IMAGE: rotate and flip */
setup('rotateflip', {
  accept: 'image',
  multiple: true,
  run: async ({ files, opt, add, say, bar, names, downloadAll }) => {
    const angle = Number(opt('angle')) || 0;
    const flip = opt('flip');
    const radians = (angle * Math.PI) / 180;
    for (const [index, file] of files.entries()) {
      const source = await bitmapOf(file);
      const swap = angle === 90 || angle === 270;
      const width = swap ? source.height : source.width;
      const height = swap ? source.width : source.height;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.translate(width / 2, height / 2);
      ctx.rotate(radians);
      if (flip === 'h' || flip === 'both') ctx.scale(-1, 1);
      if (flip === 'v' || flip === 'both') ctx.scale(1, -1);
      ctx.drawImage(
        source.isNode ? source.node : source,
        -source.width / 2,
        -source.height / 2,
        source.width,
        source.height,
      );
      const blob = await toBlob(canvas, 'image/png');
      add(names(stem(file.name) + '-turned.png'), blob, width + '×' + height);
      source.close?.();
      bar('rotateflip', (index + 1) / files.length);
    }
    say('rotateflip', 'Turned ' + files.length + ' image(s).', 'ok');
    downloadAll();
  },
});

/* ------------------------------------------------------ IMAGE: watermark */
setup('imgwatermark', {
  accept: 'image',
  multiple: true,
  run: async ({ files, opt, num, add, say, bar, names, downloadAll }) => {
    const text = String(opt('text') || '').trim();
    if (!text) throw Error('Type the watermark text first.');
    const opacity = num('opacity', 55, 5, 100) / 100;
    const scale = num('size', 100, 30, 200) / 100;
    const where = opt('position');
    for (const [index, file] of files.entries()) {
      const source = await bitmapOf(file);
      const canvas = paint(source, source.width, source.height, null);
      const ctx = canvas.getContext('2d');
      const size = Math.max(
        14,
        Math.round((canvas.width / Math.max(10, text.length * 0.9)) * scale),
      );
      ctx.font = '700 ' + size + 'px system-ui, Arial, sans-serif';
      ctx.globalAlpha = opacity;
      ctx.textBaseline = 'alphabetic';
      const metrics = ctx.measureText(text);
      const pad = Math.round(size * 0.6);
      const x =
        where === 'bottom-right'
          ? canvas.width - metrics.width - pad
          : where === 'top-left'
            ? pad
            : (canvas.width - metrics.width) / 2;
      const y =
        where === 'top-left'
          ? pad + size
          : where === 'center'
            ? canvas.height / 2 + size / 2
            : canvas.height - pad;
      ctx.lineWidth = Math.max(2, size / 12);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.fillStyle = '#ffffff';
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
      const blob = await toBlob(canvas, 'image/png');
      add(names(stem(file.name) + '-marked.png'), blob, canvas.width + '×' + canvas.height);
      source.close?.();
      bar('imgwatermark', (index + 1) / files.length);
    }
    say('imgwatermark', 'Added “' + text + '” to ' + files.length + ' image(s).', 'ok');
    downloadAll();
  },
});

/* ------------------------------------------------------- IMAGE: white background */
setup('whitebg', {
  accept: 'image',
  multiple: true,
  run: async ({ files, opt, num, add, say, bar, names, downloadAll }) => {
    const colour = /^#[0-9a-f]{6}$/i.test(String(opt('colour') || '')) ? opt('colour') : '#ffffff';
    const quality = num('quality', 92, 60, 100) / 100;
    const type = opt('format') === 'image/png' ? 'image/png' : 'image/jpeg';
    for (const [index, file] of files.entries()) {
      const source = await bitmapOf(file);
      const canvas = paint(source, source.width, source.height, colour);
      const blob = await toBlob(canvas, type, quality);
      add(
        names(stem(file.name) + '-flat.' + extOf(type)),
        blob,
        canvas.width + '×' + canvas.height,
      );
      source.close?.();
      bar('whitebg', (index + 1) / files.length);
    }
    say('whitebg', 'Flattened ' + files.length + ' image(s) onto ' + colour + '.', 'ok');
    downloadAll();
  },
});

/* -------------------------------------------------- IMAGE: photo + signature */
setup('photosign', {
  accept: 'image',
  multiple: true,
  limit: 2,
  run: async ({ files, num, add, say }) => {
    if (files.length < 2)
      throw Error('Add two images: the photo first, then the signature (or the other way round).');
    const photos = [];
    for (const file of files.slice(0, 2)) photos.push(await bitmapOf(file));
    const gap = num('gap', 28, 0, 400);
    const width = Math.max(photos[0].width, photos[1].width);
    const firstHeight = Math.round((photos[0].height * width) / photos[0].width);
    const signatureWidth = Math.round(width * (num('sigwidth', 45, 10, 100) / 100));
    const secondHeight = Math.round((photos[1].height * signatureWidth) / photos[1].width);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = firstHeight + gap + secondHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(photos[0].isNode ? photos[0].node : photos[0], 0, 0, width, firstHeight);
    ctx.drawImage(
      photos[1].isNode ? photos[1].node : photos[1],
      Math.round((width - signatureWidth) / 2),
      firstHeight + gap,
      signatureWidth,
      secondHeight,
    );
    add(
      'photo-with-signature.png',
      await toBlob(canvas, 'image/png'),
      canvas.width + '×' + canvas.height,
    );
    say('photosign', 'Stacked the photo and signature into one image.', 'ok');
    photos.forEach((photo) => photo.close?.());
  },
});

/* ----------------------------------------------------- IMAGE: passport photo */
setup('passport', {
  accept: 'image',
  limit: 1,
  run: async ({ files, opt, num, add, say }) => {
    const presets = {
      in35x45: { width: 35, height: 45, label: '35 × 45 mm' },
      in2x2: { width: 51, height: 51, label: '2 × 2 in (US)' },
      in35x35: { width: 35, height: 35, label: '35 × 35 mm' },
      in50x70: { width: 50, height: 70, label: '50 × 70 mm' },
    };
    const preset = presets[opt('size')] || presets.in35x45;
    const dpi = num('dpi', 300, 150, 600);
    const targetW = Math.round((preset.width / 25.4) * dpi);
    const targetH = Math.round((preset.height / 25.4) * dpi);
    const source = await bitmapOf(files[0]);
    // cover-crop from the centre, keeping the head near the top third
    const scale = Math.max(targetW / source.width, targetH / source.height);
    const drawW = source.width * scale;
    const drawH = source.height * scale;
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      source.isNode ? source.node : source,
      (targetW - drawW) / 2,
      Math.min(0, (targetH - drawH) / 3),
      drawW,
      drawH,
    );
    add(
      'passport-' + preset.width + 'x' + preset.height + 'mm.jpg',
      await toBlob(canvas, 'image/jpeg', 0.95),
      preset.label + ' at ' + dpi + ' dpi',
    );
    say(
      'passport',
      'Made a ' + preset.label + ' photo (' + targetW + '×' + targetH + ' px).',
      'ok',
    );
    source.close?.();
  },
});
