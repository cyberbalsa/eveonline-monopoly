// Source for the checked-in static bundle. One WebGL context, shared geometry,
// scissored views. No external model service is needed at play time.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const board = document.querySelector('#board');
const canvas = document.querySelector('#model-canvas');
const stationCanvas = document.querySelector('#station-canvas');
const stationContext = stationCanvas.getContext('2d');
const status = document.querySelector('#model-status');
const loader = new GLTFLoader();
const cache = new Map();
const allowed = new Set(['rifter','venture','catalyst','caracal','drake','gila','ishtar','dominix','providence','astrahus','keepstar']);
const finishes = {rifter:0x956e50,venture:0xd5a933,catalyst:0x8e9b97,caracal:0x7c91a4,drake:0x687f91,gila:0x9a9b77,ishtar:0x6c8977,dominix:0x738577,providence:0xb79f70,astrahus:0x8b929b,keepstar:0x767d8b};
let renderer, views = [], unavailable = false, lastFrame = 0, visible = true, dirty = true;
let stationsDirty = true, stationSignature = '', pawnSignature = '', settleUntil = 0;
const metrics = {frames:0,drawMs:0,maxDrawMs:0,views:0,stationRebuilds:0};
const records = new WeakMap();
const stationViews = new Map();
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function report() {
  const failed = unavailable || views.some(v => v.element.dataset.modelState === 'fallback');
  const pending = views.some(v => v.element.dataset.modelState === 'loading');
  status.textContent = failed ? '2D FALLBACK · SOME MODELS UNAVAILABLE' : pending ? 'LOADING 3D MESHES…' : '3D MESHES · CCP HULLS';
  status.dataset.state = failed ? 'fallback' : pending ? 'loading' : 'ready';
}
function model(name) {
  if (!allowed.has(name)) return Promise.reject(new Error('Unknown hull'));
  if (!cache.has(name)) cache.set(name, loader.loadAsync(new URL(`assets/models/${name}.glb`, document.baseURI).href).then(gltf => {
    const scene = new THREE.Scene();
    const hull = new THREE.Group();
    const bounds = new THREE.Box3().setFromObject(gltf.scene), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
    gltf.scene.position.sub(center);
    hull.add(gltf.scene); hull.scale.setScalar(2.4 / Math.max(size.x,size.y,size.z));
    scene.add(hull, new THREE.HemisphereLight(0xe1f2ff, 0x384655, 1.5));
    const key = new THREE.DirectionalLight(0xffefd3, 3); key.position.set(-3,5,4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x78bdff, 1.4); rim.position.set(3,1,-3); scene.add(rim);
    const camera = new THREE.OrthographicCamera(-1.45,1.45,1.45,-1.45,0.01,100); camera.position.set(3.2,2.6,3.5); camera.lookAt(0,0,0);
    let triangles = 0;
    gltf.scene.traverse(object => { if (object.isMesh) { object.material.color.setHex(finishes[name]); if (!object.geometry.attributes.normal) object.geometry.computeVertexNormals(); triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3; } });
    return {scene,hull,camera,triangles};
  }));
  return cache.get(name);
}
function sync() {
  views = [...board.querySelectorAll('.model-slot')].map(element => {
    if (records.has(element)) return records.get(element);
    const view = {element, name:element.dataset.model, asset:null};
    records.set(element,view);
    element.dataset.modelState = unavailable ? 'fallback' : 'loading';
    if (!unavailable) model(view.name).then(asset => {
      view.asset = asset;
      if (unavailable) return;
      element.dataset.modelState = 'ready'; element.dataset.triangles = Math.floor(asset.triangles);
      dirty = true; if (element.classList.contains('structure-model')) stationsDirty = true;
      report();
    }).catch(error => { element.dataset.modelState = 'fallback'; element.dataset.modelError = error.message; report(); });
    return view;
  });
  const signature = views.filter(v=>v.element.classList.contains('structure-model')).map(v=>`${v.element.closest('.space').dataset.index}:${v.name}`).join('|');
  if (signature !== stationSignature) {stationSignature = signature; stationsDirty = true;}
  const positions = [...board.querySelectorAll('.ship-token')].map(e=>`${e.dataset.player}:${e.style.left}:${e.style.top}`).join('|');
  if (positions !== pawnSignature) {pawnSignature = positions; settleUntil = performance.now() + 240;}
  dirty = true;
  report();
}
function offset(element) {
  let x = 0, y = 0, node = element;
  while (node && node !== board) { x += node.offsetLeft; y += node.offsetTop; node = node.offsetParent; }
  return {x,y,width:element.clientWidth,height:element.clientHeight};
}
function drawView(view,time,station = false) {
  if (!view.asset || !view.element.isConnected || !view.element.clientWidth) return 0;
  const {x,y,width,height} = offset(view.element);
  if (!width || !height) return 0;
  const {scene,hull,camera} = view.asset;
  camera.left = -1.45 * width / height; camera.right = 1.45 * width / height; camera.zoom = station ? 1.05 : 1.4; camera.updateProjectionMatrix();
  hull.rotation.y = -0.55 + (station || reduced.matches ? 0 : Math.sin(time / 4800) * 0.18);
  hull.rotation.z = station || reduced.matches ? 0 : Math.sin(time / 2800) * 0.035;
  renderer.setViewport(x,1024 - y - height,width,height);
  renderer.setScissor(Math.max(0,x),Math.max(0,1024 - y - height),width,height);
  renderer.render(scene,camera);
  return 1;
}
function rebuildStations(stations) {
  const ratio = renderer.getPixelRatio();
  stationContext.clearRect(0,0,stationCanvas.width,stationCanvas.height);
  for (const view of stations) {
    if (!view.asset) continue;
    const r = offset(view.element), key = `${view.name}:${r.width}:${r.height}`;
    let cached = stationViews.get(key);
    if (!cached) {
      renderer.setScissorTest(false); renderer.clear(); renderer.setScissorTest(true);
      drawView(view,0,true);
      cached = document.createElement('canvas'); cached.width = Math.round(r.width * ratio); cached.height = Math.round(r.height * ratio);
      cached.getContext('2d').drawImage(canvas,r.x*ratio,r.y*ratio,r.width*ratio,r.height*ratio,0,0,cached.width,cached.height);
      stationViews.set(key,cached);
    }
    stationContext.drawImage(cached,r.x*ratio,r.y*ratio,r.width*ratio,r.height*ratio);
  }
}
function draw(time) {
  requestAnimationFrame(draw);
  const moving = board.querySelector('.ship-token.moving') !== null;
  if (unavailable || document.hidden || !visible || (!dirty && (reduced.matches || (!moving && time >= settleUntil))) || time - lastFrame < 33) return;
  if (document.querySelector('dialog[open]')) return;
  lastFrame = time;
  const started = performance.now(); dirty = false;
  const stations = views.filter(v=>v.element.classList.contains('structure-model'));
  // Structures do not move. Redraw their real meshes only when their scene
  // changes. Copy that pass to a separate canvas so even software WebGL avoids
  // drawing a full-board transparent texture on every movement frame.
  if (stationsDirty) {
    rebuildStations(stations);
    stationsDirty = false; metrics.stationRebuilds++;
  }
  renderer.setScissorTest(false); renderer.setViewport(0,0,1024,1024); renderer.clear();
  renderer.setScissorTest(true);
  let count = 0;
  for (const view of views) {
    if (!view.element.classList.contains('structure-model')) count += drawView(view,time);
  }
  count += stations.filter(v=>v.asset).length;
  canvas.dataset.renderedViews = count;
  metrics.frames++; metrics.drawMs = performance.now() - started; metrics.maxDrawMs = Math.max(metrics.maxDrawMs,metrics.drawMs); metrics.views = count;
}
try {
  renderer = new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1,1.5)); renderer.setSize(1024,1024,false);
  renderer.setClearColor(0x000000,0); renderer.autoClear = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  const resolution = Math.round(1024 * renderer.getPixelRatio());
  stationCanvas.width = resolution; stationCanvas.height = resolution;
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); unavailable = true; views.forEach(v => {v.element.dataset.modelState = 'fallback';}); canvas.hidden = true; stationCanvas.hidden = true; report(); });
  canvas.addEventListener('webglcontextrestored', () => {
    unavailable = false; canvas.hidden = false; stationCanvas.hidden = false;
    views.forEach(v => { if (!v.asset) records.delete(v.element); else v.element.dataset.modelState = 'ready'; });
    stationsDirty = true; sync();
  });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; dirty = true; }).observe(document.querySelector('#board-viewport'));
  requestAnimationFrame(draw);
} catch { unavailable = true; canvas.hidden = true; }
window.EveModels = {sync, metrics};
sync();
