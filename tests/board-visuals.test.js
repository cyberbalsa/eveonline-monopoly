const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {createHash} = require('node:crypto');
const C = require('../board-camera.js');

test('auto-fit leaves all four board edges inside any browser shape', () => {
  for (const [w,h] of [[300,480],[128,120],[390,390],[1440,800],[2200,1200],[700,260]]) {
    const t=C.fitTransform(w,h);
    assert.ok(t.x>=0 && t.y>=0);
    assert.ok(t.x+C.SIZE*t.scale<=w);
    assert.ok(t.y+C.SIZE*t.scale<=h);
  }
});
test('focus clamps zoom and panning without exposing blank space at board edges', () => {
  for(const x of [-1000,0,500,1024,2000])for(const y of [-1000,0,500,1024,2000]) {
    const t=C.focusTransform(390,390,{x,y},20),fit=C.fitTransform(390,390);
    assert.equal(t.scale,fit.scale*4);
    assert.ok(t.x<=8 && t.y<=8);
    assert.ok(t.x+C.SIZE*t.scale>=382 && t.y+C.SIZE*t.scale>=382);
  }
});
test('four co-located ships get separate inward berths at every corner', () => {
  for(const [index,x,y]of [[0,910,910],[10,0,910],[20,0,0],[30,910,0]]) {
    const points=[0,1,2,3].map(slot=>C.pawnPoint({x,y,width:110,height:110},index,slot));
    assert.equal(new Set(points.map(p=>`${p.x},${p.y}`)).size,4);
    for(const p of points)assert.ok(p.x>36&&p.x<988&&p.y>34&&p.y<990);
  }
});
test('all nine hulls and both citadels contain local 3D geometry, not image billboards', () => {
  const names=['rifter','venture','catalyst','caracal','drake','gila','ishtar','dominix','providence','astrahus','keepstar'];
  for(const name of names) {
    const bytes=fs.readFileSync(`assets/models/${name}.glb`);
    assert.equal(bytes.toString('ascii',0,4),'glTF'); assert.equal(bytes.readUInt32LE(4),2);
    assert.equal(bytes.readUInt32LE(8),bytes.length);
    const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
    assert.ok(json.meshes.length>0);
    assert.ok(json.meshes.some(m=>m.primitives.some(p=>json.accessors[p.attributes.POSITION].count>1000)),name);
    assert.ok(!json.images?.length && !json.textures?.length,'community textures are not redistributed');
    assert.ok(json.buffers.every(b=>!b.uri),'no remote buffer dependencies');
    assert.ok(json.extras.source.includes('951c041d363ce184886a194fef67f0ae1ee5f33f'));
  }
});
test('Phoebe icons are byte-identical to the official pack extracts', () => {
  const provenance=JSON.parse(fs.readFileSync('assets/icons/provenance.json'));
  assert.equal(provenance.icons.length,10);
  for(const item of provenance.icons) {
    const bytes=fs.readFileSync(`assets/icons/${item.name}.png`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);
    assert.equal(bytes.readUInt32BE(16),64);assert.equal(bytes.readUInt32BE(20),64);
  }
});
test('static renderer bundle and MIT license ship with the Pages site', () => {
  assert.ok(fs.statSync('vendor/board-models.min.js').size>10000);
  assert.match(fs.readFileSync('vendor/THREE-LICENSE.txt','utf8'),/MIT License/);
  const html=fs.readFileSync('index.html','utf8');
  assert.ok(html.includes('vendor/board-models.min.js'));
  assert.ok(!html.includes('SRP DENIED')&&!html.includes('M2 GHOST SHIP'));
});
