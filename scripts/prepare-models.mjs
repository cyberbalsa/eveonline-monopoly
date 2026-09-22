// One-time asset import. Only CCP mesh geometry is retained: no community
// textures, paint schemes, lighting, or reconstructed materials are copied.
// Run: node scripts/prepare-models.mjs /absolute/path/to/download-cache
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
import { MeshoptSimplifier } from 'meshoptimizer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const cache = process.argv[2];
if (!cache || !cache.startsWith('/')) throw new Error('Supply an absolute download-cache directory.');
const revision = '951c041d363ce184886a194fef67f0ae1ee5f33f';
const hulls = { rifter:587, venture:32880, catalyst:16240, caracal:621, drake:24698, gila:17715, ishtar:12005, dominix:645, providence:20183, astrahus:35832, keepstar:35834 };
await mkdir('assets/models', { recursive:true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule()});
await MeshoptSimplifier.ready;
for (const [name, id] of Object.entries(hulls)) {
  const source = `https://raw.githubusercontent.com/EstamelGG/EVE_Model_Gallery/${revision}/docs/${id >= 35832 ? 'extra_models' : 'models'}/${id}_lite.glb`;
  const cached = resolve(cache, `${id}.glb`);
  let bytes;
  try { bytes = await readFile(cached); } catch {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    bytes = new Uint8Array(await response.arrayBuffer());
    await writeFile(cached, bytes);
  }
  const input = await io.readBinary(bytes), output = new Document();
  const sourceTriangles = input.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((sum,p)=>sum+(p.getIndices()?.getCount() || 0)/3,0);
  const buffer = output.createBuffer();
  const material = output.createMaterial('Unpainted tactical miniature').setBaseColorFactor([0.55,0.6,0.65,1]).setMetallicFactor(0.45).setRoughnessFactor(0.42).setDoubleSided(true);
  const accessors = new Map(), meshes = new Map();
  function accessor(a) {
    if (!accessors.has(a)) accessors.set(a, output.createAccessor().setType(a.getType()).setArray(a.getArray().slice()).setNormalized(a.getNormalized()).setBuffer(buffer));
    return accessors.get(a);
  }
  function node(original) {
    const n = output.createNode().setMatrix(original.getMatrix());
    const mesh = original.getMesh();
    if (mesh) {
      if (!meshes.has(mesh)) {
        const m = output.createMesh(name);
        for (const p of mesh.listPrimitives()) {
          const copy = output.createPrimitive().setMode(p.getMode()).setMaterial(material);
          const indices = p.getIndices()?.getArray(), positions = p.getAttribute('POSITION').getArray();
          if (indices && p.getMode() === 4) {
            const budget = Math.min(indices.length,Math.max(300,Math.floor(indices.length * Math.min(1,5000/sourceTriangles) / 3)*3));
            const [simplified] = MeshoptSimplifier.simplify(new Uint32Array(indices),new Float32Array(positions),3,budget,0.025,['Prune']);
            const [remap,vertexCount] = MeshoptSimplifier.compactMesh(simplified);
            for(const semantic of ['POSITION','NORMAL']) {
              const sourceAttribute=p.getAttribute(semantic);if(!sourceAttribute)continue;
              const original=sourceAttribute.getArray(), array=new Float32Array(vertexCount*3);
              for(let v=0;v<remap.length;v++)if(remap[v]<vertexCount)array.set(original.subarray(v*3,v*3+3),remap[v]*3);
              copy.setAttribute(semantic,output.createAccessor().setType('VEC3').setArray(array).setBuffer(buffer));
            }
            copy.setIndices(output.createAccessor().setType('SCALAR').setArray(simplified).setBuffer(buffer));
          } else {
            for (const semantic of ['POSITION','NORMAL']) if (p.getAttribute(semantic)) copy.setAttribute(semantic, accessor(p.getAttribute(semantic)));
            if (p.getIndices()) copy.setIndices(accessor(p.getIndices()));
          }
          m.addPrimitive(copy);
        }
        meshes.set(mesh, m);
      }
      n.setMesh(meshes.get(mesh));
    }
    for (const child of original.listChildren()) n.addChild(node(child));
    return n;
  }
  const scene = output.createScene(name);
  const originalScene = input.getRoot().getDefaultScene() || input.getRoot().listScenes()[0];
  for (const child of originalScene.listChildren()) scene.addChild(node(child));
  output.getRoot().setDefaultScene(scene).setExtras({ copyright:'EVE Online geometry © CCP Games; limited fan-content permission. Conversion source: EstamelGG / iDea SP1.', source, materials:'Project-authored unpainted tactical finish; not the EVE client shader.' });
  await io.write(`assets/models/${name}.glb`, output);
  const triangles=output.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((sum,p)=>sum+(p.getIndices()?.getCount() || 0)/3,0);
  console.log(`${name}: ${sourceTriangles} → ${triangles} triangles`);
}
