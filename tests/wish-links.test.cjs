// Run with: node --test tests/wish-links.test.cjs (Node 18+, no dependencies).
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');

// Exercise the actual inline codec; index.html must also work as a single file.
const html = readFileSync(join(__dirname, '../birthday-wishes/index.html'), 'utf8');
const script = id => html.match(new RegExp(`<script[^>]* id="${id}">([\\s\\S]*?)</script>`))[1];
const links = vm.runInNewContext(script('wish-links')+'\nwishLinks', {
  URL, TextEncoder, TextDecoder, btoa, atob,
  document:{getElementById:id=>({textContent:script(id)})}
});
const base = 'https://example.org/Tools/birthday-wishes/';
const w = {theme:'midnight',to:'आशा 🎂',from:'Alex & Kim',message:'जन्मदिन मुबारक!\nLove <3 / #1',music:false,photo:''};
const decode = url => ({...links.read(new URL(url).hash)});
const fragment = fields => '#/wish/v1.'+Buffer.from(JSON.stringify(fields)).toString('base64url');

test('a link respects the Pages subpath and carries only the selected snapshot', ()=>{
  const edited = {...w,message:'A different wish'};
  const url = links.create(base+'index.html?preview=true#/edit/private-id', {...w,id:'private-id',updated:123});
  assert.ok(url.startsWith(base+'#/wish/v1.'));
  assert.deepEqual(decode(url), w);
  assert.notEqual(links.create(base,edited),url);
  assert.equal(links.create('file:///offline/index.html',w),null);
});

test('short starter link does not resolve to an edited local draft', ()=>{
  const url = links.create(base,links.garima);
  assert.equal(url,base+'#/wish/garima');
  assert.equal(decode(url).to,'Garima');
  assert.equal(decode(url).theme,'flowers');
  assert.match(decode(url).message,/प्रिय गरिमा/);
  const edit = {...links.garima,from:'New sender'};
  assert.notEqual(links.create(base,edit),url);
  assert.deepEqual(decode(links.create(base,edit)),edit);
});

test('max-length Hindi fields and an emoji survive and a large photo cannot generate an oversized link', ()=>{
  const full = {...w,to:'ज'.repeat(64),from:'क'.repeat(64),message:'श'.repeat(998)+'🎂'};
  const url = links.create(base,full);
  assert.ok(url && url.length<=8000);
  assert.deepEqual(decode(url),full);
  const photoWish = {...w,photo:'data:image/png;base64,iVBORw0KGgo='};
  assert.deepEqual(decode(links.create(base,photoWish)),photoWish);
  assert.equal(links.create(base,{...w,photo:'data:image/png;base64,'+'A'.repeat(9000)}),null);
});

test('rejects truncated, unknown-version, out-of-schema and oversized payloads', ()=>{
  const fields = [w.theme,w.to,w.from,w.message,w.music,w.photo];
  for(const hash of ['#/studio','#/wish/','#/wish/garima/extra','#/wish/v2.anything','#/wish/v1.***',
    '#/wish/v1._w',fragment(fields).slice(0,-4),fragment(fields.concat(0)),fragment({}),
    fragment(['unknown',...fields.slice(1)]),fragment([w.theme,'   ',...fields.slice(2)]),
    fragment([w.theme,w.to,w.from,'x'.repeat(1001),false,'']),fragment([...fields.slice(0,4),1,'']),
    fragment([...fields.slice(0,5),'https://example.org/photo.jpg']), '#/wish/v1.'+'A'.repeat(8000)]) {
    assert.equal(links.read(hash),null);
  }
});
