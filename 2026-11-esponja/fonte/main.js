import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const W = 1080, H = 1920;
const TL = await (await fetch('/timeline.json')).json();
const font = new FontFace('Mont', 'url(/node_modules/@fontsource/montserrat/files/montserrat-latin-900-normal.woff2)');
await font.load(); document.fonts.add(font);

// ---------------------------------------------------------------- utils
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const sm = x => x * x * (3 - 2 * x);
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eo = x => 1 - Math.pow(1 - x, 3);
const ei = x => x * x * x;
const eob = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const bump = (t, a, b) => { const x = seg(t, a, b); return Math.sin(x * Math.PI); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const vl = (a, b, t) => a.clone().lerp(b, t);
function hash3(x, y, z) { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); }
function jitter(geo, amt) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const rx = Math.round(x * 1e4), ry = Math.round(y * 1e4), rz = Math.round(z * 1e4);
    p.setXYZ(i, x + amt * (hash3(rx, ry, rz) - .5), y + amt * (hash3(ry, rz, rx) - .5), z + amt * (hash3(rz, rx, ry) - .5));
  }
  geo.computeVertexNormals(); return geo;
}
function mat(color, o = {}) { return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: .75, metalness: 0, ...o }); }
function mesh(geo, m, parent, x = 0, y = 0, z = 0, cast = true) {
  const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = cast; me.receiveShadow = true;
  if (parent) parent.add(me); return me;
}
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, c); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData = { c, g, draw }; return t; }

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.autoClear = false;
const out = document.createElement('canvas'); out.width = W; out.height = H;
const ctx = out.getContext('2d');
document.body.appendChild(out);

const scene = new THREE.Scene();
const bscene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;
const camera = new THREE.PerspectiveCamera(42, W / H, 0.01, 80);
scene.add(camera);

const hemi = new THREE.HemisphereLight(0xfff4e6, 0x8a6a4a, 1.3); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4); sun.position.set(2.5, 5, 3.5); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: .5, far: 15 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.01; scene.add(sun); scene.add(sun.target);
const headLamp = new THREE.PointLight(0xffd58a, 0, 6, 1.6); camera.add(headLamp); headLamp.position.set(0, .1, 0);
bscene.add(new THREE.HemisphereLight(0xeaffea, 0x224422, 1.6));
const bdir = new THREE.DirectionalLight(0xffffff, 1.6); bdir.position.set(1, 3, 2); bscene.add(bdir);

// ortho overlay for x-ray tint
const ocam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const oscene = new THREE.Scene();
const tintMat = new THREE.MeshBasicMaterial({ color: 0x061c3d, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
oscene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), tintMat));
tintMat.toneMapped = false;

// ---------------------------------------------------------------- palette & materials
const M = {
  wall: mat(0xf3e2cc), wall2: mat(0xe9cfae), floor: mat(0xc4935f), floor2: mat(0xb5844f),
  counter: mat(0xf7f4ee, { roughness: .45 }), cab: mat(0x58a39a), cabDoor: mat(0x6bb7ad), knob: mat(0xe0b44a, { metalness: .6, roughness: .3 }),
  steel: mat(0xc9d1d6, { metalness: .5, roughness: .3 }), steelIn: mat(0x9aa6ad, { metalness: .8, roughness: .35 }), dark: mat(0x2b3035),
  sponge: mat(0xf8c53a, { roughness: .55 }), scrub: mat(0x2e9b52, { roughness: .9 }),
  skin: mat(0xf2bf91), shirt: mat(0xff7a4f), pants: mat(0x35506b), shoe: mat(0x2a2a30), hair: mat(0x3a281d), apron: mat(0xfaf6ef),
  eye: mat(0x161616, { roughness: .2 }), cheek: mat(0xff9e8c), mouth: mat(0x7a2b22),
  plate: mat(0xffffff, { roughness: .18 }), plateRim: mat(0x9fc6e0, { roughness: .2 }),
  white: mat(0xffffff, { roughness: .12 }), chrome: mat(0xe8eef2, { metalness: .55, roughness: .18 }),
  glassBlue: mat(0xbfe6ff, { transparent: true, opacity: .55, roughness: .05, emissive: 0x8fc9ff, emissiveIntensity: .35 }),
  wood: mat(0xb07a4a), woodD: mat(0x8d5c34), plant: mat(0x4caf50), pot: mat(0xd9744a),
  mw: mat(0xe9ecef, { roughness: .4 }), mwIn: mat(0xd8d0b8, { roughness: .6 }), mwDark: mat(0x1c2024, { roughness: .3 }),
  water: mat(0x9fd8ff, { transparent: true, opacity: .55, roughness: .02, metalness: .1 }),
  foam: mat(0xffffff, { roughness: .35, transparent: true, opacity: .95 }),
  soap: mat(0x47c98a, { transparent: true, opacity: .85, roughness: .1 }), soapCap: mat(0xffffff),
  vin: mat(0xf0e2b0, { transparent: true, opacity: .7, roughness: .05 }), vinCap: mat(0xc0392b), vinLiq: mat(0xe8c56a, { transparent: true, opacity: .75, roughness: .05 }),
  fridge: mat(0xf2f5f7, { roughness: .35 }),
};

// ---------------------------------------------------------------- KITCHEN (origin)
const kitchen = new THREE.Group(); scene.add(kitchen);
{
  const fl = mesh(new THREE.BoxGeometry(14, .1, 12), M.floor, kitchen, 0, -.05, 1, false);
  for (let i = -6; i <= 6; i++) mesh(new THREE.BoxGeometry(.02, .101, 12), M.floor2, kitchen, i * .5, -.049, 1, false);
  mesh(new THREE.BoxGeometry(14, 4, .1), M.wall, kitchen, 0, 2, -1.65, false);
  mesh(new THREE.BoxGeometry(14, .9, .02), M.wall2, kitchen, 0, .45, -1.59, false);
  mesh(new THREE.BoxGeometry(.1, 4, 12), M.wall, kitchen, -4.5, 2, 1, false);
  // window
  const win = new THREE.Group(); win.position.set(.35, 1.95, -1.6); kitchen.add(win);
  mesh(new THREE.BoxGeometry(1.0, .8, .03), M.glassBlue, win, 0, 0, 0, false);
  for (const [w, h, x, y] of [[1.1, .06, 0, .43], [1.1, .06, 0, -.43], [.06, .92, -.53, 0], [.06, .92, .53, 0], [.04, .8, 0, 0], [1.0, .04, 0, 0]]) mesh(new THREE.BoxGeometry(w, h, .06), M.white, win, x, y, .02);
  mesh(new THREE.BoxGeometry(1.2, .04, .12), M.white, win, 0, -.47, .06);
  // plant on sill
  mesh(new THREE.CylinderGeometry(.06, .045, .1, 7), M.pot, win, -.38, -.4, .08);
  for (let i = 0; i < 4; i++) mesh(jitter(new THREE.IcosahedronGeometry(.055, 0), .02), M.plant, win, -.38 + (i - 1.5) * .03, -.3 + (i % 2) * .04, .08);
  // shelf
  mesh(new THREE.BoxGeometry(.9, .04, .22), M.wood, kitchen, 1.5, 1.6, -1.5);
  for (let i = 0; i < 4; i++) mesh(new THREE.CylinderGeometry(.05, .05, .14 + (i % 2) * .05, 7), [M.pot, M.cabDoor, M.knob, M.shirt][i], kitchen, 1.2 + i * .2, 1.69 + (i % 2) * .025, -1.5);
  // fridge
  const fr = mesh(new THREE.BoxGeometry(.8, 2.0, .7), M.fridge, kitchen, 3.0, 1.0, -1.25);
  mesh(new THREE.BoxGeometry(.04, .5, .04), M.chrome, kitchen, 2.7, 1.25, -.88);
  mesh(new THREE.BoxGeometry(.79, .02, .01), M.steelIn, kitchen, 3.0, 1.45, -.895);
  // back counter (along wall)
  mesh(new THREE.BoxGeometry(2.0, .86, .6), M.cab, kitchen, -2.6, .43, -1.3);
  mesh(new THREE.BoxGeometry(2.04, .05, .64), M.counter, kitchen, -2.6, .885, -1.3);
}
// island with sink
const island = new THREE.Group(); kitchen.add(island);
{
  const T = .92, th = .04;
  mesh(new THREE.BoxGeometry(3.2, .66, 1.0), M.cab, island, 0, .33, 0);
  mesh(new THREE.BoxGeometry(3.2, .24, .03), M.cab, island, 0, .78, .485);
  mesh(new THREE.BoxGeometry(3.2, .24, .03), M.cab, island, 0, .78, -.485);
  mesh(new THREE.BoxGeometry(.03, .24, 1.0), M.cab, island, -1.585, .78, 0);
  mesh(new THREE.BoxGeometry(.03, .24, 1.0), M.cab, island, 1.585, .78, 0);
  for (let i = -3; i <= 3; i++) { if (i === 0) continue; mesh(new THREE.BoxGeometry(.4, .62, .02), M.cabDoor, island, i * .45, .42, .505); mesh(new THREE.BoxGeometry(.04, .1, .03), M.knob, island, i * .45 + (i < 0 ? .14 : -.14), .58, .52); }
  mesh(new THREE.BoxGeometry(.6, .18, .02), M.cabDoor, island, 0, .54, .505);
  mesh(new THREE.BoxGeometry(.1, .04, .03), M.knob, island, 0, .54, .52);
  // top with hole x[-.35,.35] z[-.22,.22]
  mesh(new THREE.BoxGeometry(1.27, th, 1.06), M.counter, island, -.985, T - th / 2, 0);
  mesh(new THREE.BoxGeometry(1.27, th, 1.06), M.counter, island, .985, T - th / 2, 0);
  mesh(new THREE.BoxGeometry(.7, th, .31), M.counter, island, 0, T - th / 2, .375);
  mesh(new THREE.BoxGeometry(.7, th, .31), M.counter, island, 0, T - th / 2, -.375);
  // basin
  const bb = .70;
  mesh(new THREE.BoxGeometry(.7, .02, .44), M.steelIn, island, 0, bb - .01, 0);
  mesh(new THREE.BoxGeometry(.7, .22, .02), M.steel, island, 0, bb + .11, .21);
  mesh(new THREE.BoxGeometry(.7, .22, .02), M.steel, island, 0, bb + .11, -.21);
  mesh(new THREE.BoxGeometry(.02, .22, .44), M.steel, island, -.34, bb + .11, 0);
  mesh(new THREE.BoxGeometry(.02, .22, .44), M.steel, island, .34, bb + .11, 0);
  mesh(new THREE.CylinderGeometry(.045, .045, .006, 12), M.dark, island, .12, bb + .002, 0, false);
  mesh(new THREE.TorusGeometry(.045, .006, 4, 12), M.chrome, island, .12, bb + .004, 0, false).rotation.x = Math.PI / 2;
  for (let i = -1; i <= 1; i++) mesh(new THREE.BoxGeometry(.07, .004, .006), M.chrome, island, .12, bb + .005, i * .018, false);
  // faucet
  mesh(new THREE.CylinderGeometry(.03, .04, .04, 8), M.chrome, island, 0, T + .02, -.34);
  mesh(new THREE.CylinderGeometry(.018, .018, .3, 8), M.chrome, island, 0, T + .17, -.34);
  const arc = mesh(new THREE.TorusGeometry(.1, .018, 6, 10, Math.PI), M.chrome, island, 0, T + .32, -.24);
  arc.rotation.y = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(.02, .016, .06, 8), M.chrome, island, 0, T + .29, -.14);
  mesh(new THREE.BoxGeometry(.03, .02, .1), M.chrome, island, .06, T + .1, -.34);
}
const SINK_REST = new THREE.Vector3(-.13, .701, .02);
const BASIN_Y = .70, FAUCET = V(0, 1.18, -.14), DRAIN = V(.12, .70, 0);
// faucet stream
const streamMat = M.water.clone(); streamMat.opacity = .6;
const stream = mesh(new THREE.CylinderGeometry(.011, .014, 1, 7, 6, true), streamMat, scene, 0, 0, 0, false);
const vinStream = mesh(new THREE.CylinderGeometry(.006, .009, 1, 6, 4, true), M.vinLiq, scene, 0, 0, 0, false);
const soapStream = mesh(new THREE.CylinderGeometry(.006, .008, 1, 6, 4, true), M.soap, scene, 0, 0, 0, false);
function setStream(s, top, bot, wob, t) {
  if (!top) { s.visible = false; return; }
  s.visible = true; const d = top.clone().sub(bot); const L = d.length();
  s.position.copy(top).add(bot).multiplyScalar(.5);
  s.position.x += Math.sin(t * 40) * wob; s.scale.set(1 + .15 * Math.sin(t * 33), L, 1 + .15 * Math.cos(t * 29));
  s.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
}
// upper cupboard (left)
const cup = new THREE.Group(); cup.position.set(-.95, 1.72, -1.42); kitchen.add(cup);
{
  mesh(new THREE.BoxGeometry(.7, .02, .36), M.cab, cup, 0, -.3, 0); mesh(new THREE.BoxGeometry(.7, .02, .36), M.cab, cup, 0, .3, 0);
  mesh(new THREE.BoxGeometry(.02, .62, .36), M.cab, cup, -.34, 0, 0); mesh(new THREE.BoxGeometry(.02, .62, .36), M.cab, cup, .34, 0, 0);
  mesh(new THREE.BoxGeometry(.7, .62, .02), M.cabDoor, cup, 0, 0, -.17);
  mesh(new THREE.BoxGeometry(.66, .015, .32), M.cab, cup, 0, 0, 0);
}
const cupDoor = new THREE.Group(); cupDoor.position.set(-.35, 0, .18); cup.add(cupDoor);
mesh(new THREE.BoxGeometry(.7, .6, .025), M.cabDoor, cupDoor, .35, 0, 0);
mesh(new THREE.BoxGeometry(.03, .1, .03), M.knob, cupDoor, .62, -.18, .02);
function makePlate(r = .13) {
  const pts = [V(0, 0, 0), V(r * .55, 0, 0), V(r * .62, .006, 0), V(r * .72, .012, 0), V(r * .98, .022, 0), V(r, .026, 0), V(r * .97, .03, 0), V(r * .7, .018, 0), V(r * .6, .012, 0), V(0, .012, 0)].map(p => new THREE.Vector2(p.x, p.y));
  const g = new THREE.Group();
  mesh(new THREE.LatheGeometry(pts, 18), M.plate, g);
  const rim = mesh(new THREE.TorusGeometry(r * .985, .003, 3, 24), M.plateRim, g, 0, .028, 0, false); rim.rotation.x = Math.PI / 2;
  return g;
}
for (let i = 0; i < 4; i++) { const p = makePlate(); p.position.set(.1, .012 + i * .03, 0); cup.add(p); }
const plate = makePlate(); scene.add(plate);
const PLATE_IN_SINK = V(-.06, BASIN_Y + .001, .02);

// microwave
const mw = new THREE.Group(); mw.position.set(1.18, .92, -.05); mw.rotation.y = -Math.PI / 2; kitchen.add(mw);
const mwT = new THREE.Group(); const mwSlot = new THREE.Object3D();
let mwDoor, mwDisp, mwLight;
{
  const w = .62, h = .36, d = .44;
  mesh(new THREE.BoxGeometry(w, .02, d), M.mw, mw, 0, .01, 0); mesh(new THREE.BoxGeometry(w, .02, d), M.mw, mw, 0, h - .01, 0);
  mesh(new THREE.BoxGeometry(.02, h, d), M.mw, mw, -w / 2 + .01, h / 2, 0); mesh(new THREE.BoxGeometry(.02, h, d), M.mw, mw, w / 2 - .01, h / 2, 0);
  mesh(new THREE.BoxGeometry(w, h, .02), M.mw, mw, 0, h / 2, -d / 2 + .01);
  mesh(new THREE.BoxGeometry(.02, h - .04, d - .04), M.mw, mw, .1, h / 2, 0);
  // inner cavity liners
  mesh(new THREE.BoxGeometry(.38, .005, .38), M.mwIn, mw, -.09, .022, 0, false);
  mesh(new THREE.BoxGeometry(.38, .3, .005), M.mwIn, mw, -.09, .17, -.195, false);
  mesh(new THREE.BoxGeometry(.005, .3, .38), M.mwIn, mw, -.285, .17, 0, false);
  mesh(new THREE.BoxGeometry(.005, .3, .38), M.mwIn, mw, .095, .17, 0, false);
  mesh(new THREE.BoxGeometry(.38, .005, .38), M.mwIn, mw, -.09, .318, 0, false);
  // control panel
  mesh(new THREE.BoxGeometry(.19, h - .02, .02), M.mw, mw, .205, h / 2, d / 2 - .01);
  mwDisp = canvasTex(256, 96, (g) => { });
  const dm = new THREE.MeshBasicMaterial({ map: mwDisp, toneMapped: false });
  mesh(new THREE.PlaneGeometry(.15, .056), dm, mw, .205, .29, d / 2 + .001, false);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) mesh(new THREE.BoxGeometry(.035, .022, .01), M.mwDark, mw, .16 + c * .045, .21 - r * .035, d / 2 + .004);
  mesh(new THREE.CylinderGeometry(.03, .03, .015, 10), M.mwDark, mw, .205, .07, d / 2 + .006).rotation.x = Math.PI / 2;
  // turntable
  mwT.position.set(-.09, .03, 0); mw.add(mwT);
  mesh(new THREE.CylinderGeometry(.16, .16, .008, 16), M.glassBlue, mwT, 0, 0, 0, false);
  mwSlot.position.set(0, .006, 0); mwT.add(mwSlot);
  // door pivot (hinge at x=-w/2)
  mwDoor = new THREE.Group(); mwDoor.position.set(-w / 2, 0, d / 2); mw.add(mwDoor);
  const dw = .42;
  for (const [ww, hh, x, y] of [[dw, .05, dw / 2, h - .025], [dw, .05, dw / 2, .025], [.05, h, .025, h / 2], [.05, h, dw - .025, h / 2]]) mesh(new THREE.BoxGeometry(ww, hh, .025), M.mw, mwDoor, x, y, .01);
  const dots = canvasTex(768, 576, (g, c) => { g.fillStyle = 'rgba(20,24,28,0.4)'; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'destination-out'; for (let y = 3; y < c.height; y += 6) for (let x = 3; x < c.width; x += 6) { g.beginPath(); g.arc(x, y, 2.1, 0, 7); g.fill(); } });
  const glass = new THREE.MeshBasicMaterial({ map: dots, transparent: true, depthWrite: false, toneMapped: false });
  mesh(new THREE.PlaneGeometry(dw - .1, h - .1), glass, mwDoor, dw / 2, h / 2, .02, false);
  mesh(new THREE.BoxGeometry(.02, .2, .03), M.mwDark, mwDoor, dw - .04, h / 2, .03);
  mwLight = new THREE.PointLight(0xffcf73, 0, 1.2, 1.5); mwLight.position.set(-.09, .28, 0); mw.add(mwLight);
}
function drawDisp(str, on) {
  const { g, c } = mwDisp.userData; g.fillStyle = '#0b1410'; g.fillRect(0, 0, c.width, c.height);
  g.font = '900 70px Mont'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = on ? '#6dff8a' : '#2f6b3d'; g.fillText(str, c.width / 2, c.height / 2 + 4);
  mwDisp.needsUpdate = true;
}
drawDisp('12:00', false);
let lastDisp = '';

// table & chair (front)
const dining = new THREE.Group(); dining.position.set(0, 0, 2.55); kitchen.add(dining);
{
  mesh(new THREE.BoxGeometry(1.1, .06, .7), M.wood, dining, 0, .75, .35);
  for (const [x, z] of [[-.5, .05], [.5, .05], [-.5, .65], [.5, .65]]) mesh(new THREE.BoxGeometry(.06, .72, .06), M.woodD, dining, x, .36, z);
  mesh(new THREE.BoxGeometry(.45, .05, .42), M.woodD, dining, 0, .45, -.12);
  for (const [x, z] of [[-.19, -.3], [.19, -.3], [-.19, .06], [.19, .06]]) mesh(new THREE.BoxGeometry(.04, .45, .04), M.woodD, dining, x, .225, z);
  mesh(new THREE.BoxGeometry(.45, .5, .04), M.woodD, dining, 0, .7, -.33);
  const dp = makePlate(.14); dp.position.set(0, .78, .25); dining.add(dp);
  const cols = [0xfff8e7, 0xfff8e7, 0x6b3b22, 0x6b3b22, 0x6fbf4a, 0xe24d3b, 0xf2a93b];
  const rr = mulberry32(77);
  for (let i = 0; i < 26; i++) { const a = rr() * 6.28, r = rr() * .08; mesh(jitter(new THREE.IcosahedronGeometry(.018 + rr() * .012, 0), .01), mat(cols[i % cols.length]), dp, Math.cos(a) * r, .02, Math.sin(a) * r, false); }
  mesh(new THREE.CylinderGeometry(.035, .03, .11, 8), M.glassBlue, dining, .3, .835, .3);
  mesh(new THREE.BoxGeometry(.015, .005, .16), M.chrome, dining, .19, .783, .25);
}

// ---------------------------------------------------------------- SHOWCASE (scene 0)
const show = new THREE.Group(); show.position.set(-20, 0, 0); scene.add(show);
const sparkTex = canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.fillStyle = 'white';
  g.beginPath(); g.moveTo(64, 0); g.lineTo(70, 58); g.lineTo(128, 64); g.lineTo(70, 70); g.lineTo(64, 128); g.lineTo(58, 70); g.lineTo(0, 64); g.lineTo(58, 58); g.closePath(); g.fill();
});
const sparkMat = new THREE.SpriteMaterial({ map: sparkTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const sparkles = [];
function addSpark(parent, x, y, z, s, ph) { const sp = new THREE.Sprite(sparkMat.clone()); sp.position.set(x, y, z); sp.userData = { s, ph }; parent.add(sp); sparkles.push(sp); return sp; }
{
  mesh(new THREE.CylinderGeometry(1.9, 2.0, .16, 16), mat(0xe8f1f8, { roughness: .3 }), show, 0, -.08, 0);
  mesh(new THREE.TorusGeometry(1.95, .045, 4, 24), mat(0xffd36b, { roughness: .3, metalness: .5 }), show, 0, 0, 0).rotation.x = Math.PI / 2;
  // trash can
  const tc = new THREE.Group(); tc.position.set(-.55, 0, 0); show.add(tc);
  const canM = mat(0x8fd6c8, { roughness: .15, metalness: .1 });
  mesh(new THREE.CylinderGeometry(.21, .17, .56, 10), canM, tc, 0, .28, 0);
  mesh(new THREE.CylinderGeometry(.225, .225, .045, 10), M.white, tc, 0, .58, 0);
  mesh(new THREE.SphereGeometry(.05, 8, 4, 0, 6.3, 0, 1.6), M.chrome, tc, 0, .6, 0);
  mesh(new THREE.BoxGeometry(.12, .025, .1), M.dark, tc, 0, .03, .2);
  mesh(new THREE.TorusGeometry(.212, .008, 4, 14), M.white, tc, 0, .5, 0).rotation.x = Math.PI / 2;
  // toilet
  const to = new THREE.Group(); to.position.set(.6, 0, 0); show.add(to); to.rotation.y = -.25;
  const bowlPts = [[.0, 0], [.12, 0], [.13, .05], [.11, .2], [.14, .3], [.19, .38], [.2, .41], [.17, .41], [.0, .33]].map(p => new THREE.Vector2(p[0], p[1]));
  const bowl = mesh(new THREE.LatheGeometry(bowlPts, 11), M.white, to, 0, 0, .05); bowl.scale.z = 1.25;
  const seat = mesh(new THREE.TorusGeometry(.165, .028, 4, 14), M.white, to, 0, .43, .05); seat.rotation.x = Math.PI / 2; seat.scale.y = 1.25;
  mesh(new THREE.BoxGeometry(.38, .34, .16), M.white, to, 0, .6, -.24);
  mesh(new THREE.BoxGeometry(.4, .04, .18), M.white, to, 0, .79, -.24);
  mesh(new THREE.CylinderGeometry(.025, .025, .015, 10), M.chrome, to, 0, .815, -.24);
  const lid = mesh(new THREE.BoxGeometry(.36, .3, .025), M.white, to, 0, .58, -.14); lid.rotation.x = -.15;
  for (let i = 0; i < 7; i++) addSpark(tc, (i % 3 - 1) * .2, .15 + i * .08, .25 - (i % 2) * .3, .14 + (i % 3) * .05, i * 1.7);
  for (let i = 0; i < 8; i++) addSpark(to, (i % 3 - 1) * .2, .1 + i * .09, .3 - (i % 2) * .4, .14 + (i % 3) * .05, i * 2.1);
  const sl1 = new THREE.SpotLight(0xffffff, 18, 6, .55, .6, 1.2); sl1.position.set(-.55, 3, 1.2); sl1.target.position.set(-.55, 0, 0); show.add(sl1, sl1.target);
  const sl2 = new THREE.SpotLight(0xffffff, 18, 6, .55, .6, 1.2); sl2.position.set(.6, 3, 1.2); sl2.target.position.set(.6, 0, 0); show.add(sl2, sl2.target);
}

// ---------------------------------------------------------------- INSIDE SPONGE
const inside = new THREE.Group(); inside.position.set(60, 0, 0); scene.add(inside);
const INS_CH = V(60, 0, -14);
{
  const r = mulberry32(1234);
  const cols = [0xd8a52a, 0xc89421, 0xe6b83a, 0xb98518, 0xf0c64a];
  const mats = cols.map(c => mat(c, { roughness: .45, emissive: 0x2a1a00, emissiveIntensity: .25 }));
  const geo = jitter(new THREE.IcosahedronGeometry(1, 1), .35);
  const N = 420; const inst = mats.map(m => { const im = new THREE.InstancedMesh(geo, m, N); im.count = 0; im.receiveShadow = false; inside.add(im); return im; });
  const dummy = new THREE.Object3D();
  function put(p, s, rot) { const im = inst[Math.floor(r() * inst.length)]; dummy.position.copy(p); dummy.scale.set(s * (0.7 + r() * .6), s * (0.7 + r() * .6), s * (0.7 + r() * .6)); dummy.rotation.set(r() * 6, r() * 6, r() * 6); dummy.updateMatrix(); im.setMatrixAt(im.count++, dummy.matrix); }
  for (let i = 0; i < 300; i++) {
    const z = 2 - r() * 18; const a = r() * Math.PI * 2;
    const inCh = Math.abs(z + 14) < 3; const R = (inCh ? 3.0 : 1.55) + r() * 1.2;
    const sway = Math.sin(z * .4) * .5;
    put(V(Math.cos(a) * R + sway, Math.sin(a) * R, z), .55 + r() * .75);
  }
  for (let i = 0; i < 26; i++) { // struts
    const z = 1 - r() * 11; const a = r() * Math.PI * 2;
    put(V(Math.cos(a) * 1.35, Math.sin(a) * 1.35, z), .35 + r() * .25);
  }
  inst.forEach(im => im.instanceMatrix.needsUpdate = true);
  // food bits
  const fcols = [0xc0392b, 0x8e5a2b, 0xe67e22, 0x6f8f2f, 0xf3e3c3, 0x5b3a1e];
  for (let i = 0; i < 80; i++) {
    const z = 1.5 - r() * 17; const a = r() * Math.PI * 2; const inCh = Math.abs(z + 14) < 3; const R = (inCh ? 2.3 : 1.05) + r() * .25;
    const sway = Math.sin(z * .4) * .5;
    const f = mesh(jitter(new THREE.IcosahedronGeometry(.08 + r() * .14, 0), .07), mat(fcols[i % fcols.length], { roughness: .5 }), inside, Math.cos(a) * R + sway - 60 + 60, Math.sin(a) * R, z, false);
    f.position.x = Math.cos(a) * R + sway; f.rotation.set(r() * 6, r() * 6, r() * 6);
  }
}
// moisture droplets
const drops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: .45, roughness: .05, flatShading: true }), 140);
inside.add(drops);
const dropData = []; { const r = mulberry32(55); for (let i = 0; i < 140; i++) dropData.push({ x: (r() - .5) * 2.4, y: (r() - .5) * 2.4, z: 2 - r() * 18, s: .02 + r() * .05, ph: r() * 6 }); }

// ---------------------------------------------------------------- SPONGE
const sponge = new THREE.Group(); scene.add(sponge);
const SP = { w: .22, h: .115, d: .13 };
const spBody = mesh(jitter(new THREE.BoxGeometry(.22, .085, .13, 5, 2, 3), .01), M.sponge, sponge, 0, .0425, 0);
const spScrub = mesh(jitter(new THREE.BoxGeometry(.224, .03, .134, 5, 1, 3), .006), M.scrub, sponge, 0, .1, 0);
const spGlowMat = new THREE.MeshBasicMaterial({ color: 0x5cff3a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const spGlow = mesh(new THREE.BoxGeometry(.235, .03, .145), spGlowMat, sponge, 0, .012, 0, false);
// x-ray edges (layer 1)
const edgeMat = new THREE.LineBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: 1, toneMapped: false });
const ghostMat = new THREE.MeshBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
function addEdges(obj, color) { const ms = []; obj.traverse(o => { if (o.isMesh && !o.userData.noEdge) ms.push(o); }); ms.forEach(o => { const gh = new THREE.Mesh(o.geometry, ghostMat); gh.layers.set(1); gh.userData.noEdge = true; o.add(gh); }); obj.traverse(o => { if (o.isMesh && !o.userData.noEdge) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), color ? new THREE.LineBasicMaterial({ color, transparent: true, toneMapped: false }) : edgeMat); e.layers.set(1); e.userData.noEdge = true; o.add(e); } }); }
spGlow.userData.noEdge = true;
addEdges(sponge); addEdges(plate);
// sponge interior bacteria (local coords)
const SPB = []; { const r = mulberry32(9); for (let i = 0; i < 200; i++) SPB.push({ p: V((r() - .5) * .2, .01 + r() * .09, (r() - .5) * .11), ph: r() * 6.28, fly: r() < .7, ft: r(), land: (() => { const a = r() * 6.28, rr = Math.sqrt(r()) * .105; return V(Math.cos(a) * rr, 0, Math.sin(a) * rr); })(), pop: r() }); }

// ---------------------------------------------------------------- CHARACTER
function makeChar() {
  const root = new THREE.Group(); const P = { root };
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(.1 * sx, .86, 0); root.add(hip);
    mesh(new THREE.CylinderGeometry(.08, .068, .43, 7), M.pants, hip, 0, -.215, 0);
    const knee = new THREE.Group(); knee.position.y = -.43; hip.add(knee);
    mesh(new THREE.CylinderGeometry(.066, .056, .4, 7), M.pants, knee, 0, -.2, 0);
    mesh(new THREE.BoxGeometry(.12, .07, .22), M.shoe, knee, 0, -.41, .045);
    P[sx < 0 ? 'hipR' : 'hipL'] = hip; P[sx < 0 ? 'kneeR' : 'kneeL'] = knee;
  }
  const torso = new THREE.Group(); torso.position.y = .86; root.add(torso); P.torso = torso;
  mesh(jitter(new THREE.CylinderGeometry(.205, .235, .58, 9, 2), .012), M.shirt, torso, 0, .29, 0);
  mesh(new THREE.SphereGeometry(.205, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2), M.shirt, torso, 0, .58, 0);
  const apron = mesh(new THREE.CylinderGeometry(.212, .242, .5, 9, 1, true, -1.05, 2.1), M.apron, torso, 0, .25, 0); apron.userData.noEdge = true;
  mesh(new THREE.CylinderGeometry(.065, .07, .1, 7), M.skin, torso, 0, .72, 0);
  const head = new THREE.Group(); head.position.set(0, .9, 0); torso.add(head); P.head = head;
  const hd = mesh(jitter(new THREE.IcosahedronGeometry(.19, 1), .015), M.skin, head); hd.scale.set(1, 1.06, .98);
  const hair = mesh(jitter(new THREE.SphereGeometry(.2, 9, 5, 0, Math.PI * 2, 0, Math.PI * .42), .02), M.hair, head, 0, .035, -.012); hair.rotation.x = -.2;
  mesh(jitter(new THREE.IcosahedronGeometry(.07, 0), .02), M.hair, head, .06, .17, .07);
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(.026, 8, 6), M.eye, head, .07 * sx, .025, .165); e.scale.set(1, 1.25, .6); eyes.push(e);
    mesh(new THREE.SphereGeometry(.008, 5, 4), M.white, head, .07 * sx + .008, .04, .18, false);
    const br = mesh(new THREE.BoxGeometry(.06, .013, .015), M.hair, head, .075 * sx, .085, .168); br.rotation.z = -.15 * sx; P[sx < 0 ? 'browR' : 'browL'] = br;
    const ck = mesh(new THREE.SphereGeometry(.028, 8, 4), M.cheek, head, .11 * sx, -.035, .14, false); ck.scale.set(1, .6, .4);
  }
  P.eyes = eyes;
  mesh(jitter(new THREE.IcosahedronGeometry(.032, 0), .008), M.skin, head, 0, -.005, .19);
  const smile = mesh(new THREE.TorusGeometry(.055, .012, 4, 10, Math.PI), M.mouth, head, 0, -.045, .17, false); smile.rotation.z = Math.PI; P.smile = smile;
  for (const sx of [-1, 1]) mesh(jitter(new THREE.IcosahedronGeometry(.045, 0), .01), M.skin, head, .19 * sx, 0, 0);
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(.255 * sx, .55, 0); torso.add(sh);
    mesh(new THREE.SphereGeometry(.07, 7, 5), M.shirt, sh);
    mesh(new THREE.CylinderGeometry(.06, .052, .3, 7), M.shirt, sh, 0, -.15, 0);
    const el = new THREE.Group(); el.position.y = -.3; sh.add(el);
    mesh(new THREE.CylinderGeometry(.048, .042, .27, 7), M.skin, el, 0, -.135, 0);
    const hand = mesh(jitter(new THREE.IcosahedronGeometry(.062, 1), .015), M.skin, el, 0, -.3, 0); hand.scale.set(1, .9, 1.1);
    mesh(jitter(new THREE.IcosahedronGeometry(.026, 0), .006), M.skin, el, .045 * -sx, -.29, .04);
    const k = sx < 0 ? 'R' : 'L'; P['sh' + k] = sh; P['el' + k] = el; P['hand' + k] = hand;
  }
  return P;
}
const ch = makeChar(); scene.add(ch.root);
const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4();
function ik(side, target, pole) {
  const sh = ch['sh' + side], el = ch['el' + side]; const sx = side === 'R' ? -1 : 1;
  ch.root.updateMatrixWorld(true);
  const T = ch.torso.worldToLocal(target.clone());
  const S = sh.position.clone(); const a = .3, b = .3;
  const d = T.clone().sub(S); let L = d.length(); L = clamp(L, .06, a + b - .002); const dn = d.clone().normalize();
  const p = (pole || V(.7 * sx, -1, -.45)).clone().normalize();
  const pp = p.clone().sub(dn.clone().multiplyScalar(p.dot(dn))).normalize();
  const al = Math.acos(clamp((a * a + L * L - b * b) / (2 * a * L), -1, 1));
  const u = dn.clone().multiplyScalar(Math.cos(al)).add(pp.clone().multiplyScalar(Math.sin(al))).normalize();
  const E = S.clone().add(u.clone().multiplyScalar(a)); const f = S.clone().add(dn.clone().multiplyScalar(L)).sub(E).normalize();
  const Y = u.clone().negate(); let fp = f.clone().sub(u.clone().multiplyScalar(f.dot(u)));
  if (fp.length() < 1e-4) fp = pp.clone().negate(); fp.normalize();
  const Z = fp.clone().negate(); const X = new THREE.Vector3().crossVectors(Y, Z).normalize(); Z.crossVectors(X, Y).normalize();
  tmpM.makeBasis(X, Y, Z); sh.quaternion.setFromRotationMatrix(tmpM);
  el.rotation.set(Math.acos(clamp(u.dot(f), -1, 1)), 0, 0);
}
function handPos(side) { ch.root.updateMatrixWorld(true); return ch['hand' + side].getWorldPosition(new THREE.Vector3()); }
function poseRest() {
  for (const k of ['hipR', 'hipL', 'kneeR', 'kneeL']) ch[k].rotation.set(0, 0, 0);
  ch.torso.rotation.set(0, 0, 0); ch.head.rotation.set(0, 0, 0);
  ch.shR.quaternion.identity(); ch.shL.quaternion.identity(); ch.shR.rotation.z = -.12; ch.shL.rotation.z = .12; ch.elR.rotation.set(0, 0, 0); ch.elL.rotation.set(0, 0, 0);
  ch.smile.scale.set(1, 1, 1); ch.eyes.forEach(e => e.scale.set(1, 1.25, .6)); ch.browL.position.y = .085; ch.browR.position.y = .085;
}

// ---------------------------------------------------------------- props
const soapB = new THREE.Group(); scene.add(soapB);
mesh(new THREE.CylinderGeometry(.034, .04, .17, 8), M.soap, soapB, 0, .085, 0); mesh(new THREE.CylinderGeometry(.018, .022, .03, 8), M.soapCap, soapB, 0, .185, 0); mesh(new THREE.CylinderGeometry(.006, .008, .03, 6), M.soapCap, soapB, 0, .21, 0);
const vinB = new THREE.Group(); scene.add(vinB);
{
  mesh(new THREE.CylinderGeometry(.045, .048, .2, 9), M.vin, vinB, 0, .1, 0); mesh(new THREE.CylinderGeometry(.018, .043, .07, 9), M.vin, vinB, 0, .235, 0); mesh(new THREE.CylinderGeometry(.019, .019, .03, 9), M.vinCap, vinB, 0, .28, 0);
  mesh(new THREE.CylinderGeometry(.043, .046, .16, 9), M.vinLiq, vinB, 0, .085, 0, false);
  const lab = canvasTex(256, 96, (g, c) => { g.fillStyle = '#fff6dc'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#c0392b'; g.fillRect(0, 0, 256, 14); g.fillRect(0, 82, 256, 14); g.fillStyle = '#5a2a12'; g.font = '900 44px Mont'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('VINAGRE', 128, 50); });
  const lm = new THREE.MeshStandardMaterial({ map: lab, roughness: .6 });
  mesh(new THREE.CylinderGeometry(.0465, .0495, .08, 18, 1, true, -.9, 1.8), lm, vinB, 0, .1, 0, false);
}
const fork = new THREE.Group(); scene.add(fork);
mesh(new THREE.BoxGeometry(.012, .006, .14), M.chrome, fork, 0, 0, -.06); for (let i = -1; i <= 1; i++) mesh(new THREE.BoxGeometry(.003, .004, .04), M.chrome, fork, i * .008, 0, .03);
mesh(jitter(new THREE.IcosahedronGeometry(.014, 0), .006), mat(0xfff8e7), fork, 0, .008, .03);

// foam (instanced)
const foam = new THREE.InstancedMesh(jitter(new THREE.IcosahedronGeometry(1, 1), .15), M.foam, 220); scene.add(foam);
const foamD = []; { const r = mulberry32(31); for (let i = 0; i < 220; i++) { const a = r() * 6.28, b = r() * 3.14; foamD.push({ d: V(Math.cos(a) * Math.sin(b), Math.abs(Math.cos(b)) * .8 + .1, Math.sin(a) * Math.sin(b)), r: .012 + r() * .026, t: r(), drip: r() < .25, ph: r() * 5 }); } }
const waterDrops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), M.water, 60); scene.add(waterDrops);

// bacteria layer
const bactMat = new THREE.MeshStandardMaterial({ color: 0x74ff3e, emissive: 0x2fd400, emissiveIntensity: .85, roughness: .35, flatShading: true });
const BMAX = 2600;
const bact = new THREE.InstancedMesh(jitter(new THREE.IcosahedronGeometry(1, 1), .12), bactMat, BMAX); bact.frustumCulled = false; bscene.add(bact);
const bEyeMat = new THREE.MeshBasicMaterial({ color: 0x0b2a05 });
const glowTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(140,255,90,.9)'); gr.addColorStop(.4, 'rgba(90,255,40,.35)'); gr.addColorStop(1, 'rgba(60,255,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), glowMat, BMAX); glow.frustumCulled = false; bscene.add(glow);
const BL = []; // per-frame list {p, s, g}
const dmy = new THREE.Object3D();
function flushBact() {
  const n = Math.min(BL.length, BMAX); bact.count = n; glow.count = n;
  for (let i = 0; i < n; i++) {
    const b = BL[i]; dmy.position.copy(b.p); dmy.quaternion.set(0, 0, 0, 1); dmy.rotation.set(b.p.x * 30, b.p.y * 30, 0); dmy.scale.set(b.s * (b.sx || 1), b.s * (b.sy || 1), b.s * (b.sx || 1)); dmy.updateMatrix(); bact.setMatrixAt(i, dmy.matrix);
    dmy.quaternion.copy(camera.quaternion); const gs = b.s * (b.g == null ? 4.2 : b.g); dmy.scale.set(gs, gs, gs); dmy.updateMatrix(); glow.setMatrixAt(i, dmy.matrix);
  }
  bact.instanceMatrix.needsUpdate = true; glow.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- division tree
function makeTree(seed, levels, r0, grow) {
  const r = mulberry32(seed); const P = [[V(0, 0, 0)]];
  for (let L = 0; L < levels; L++) {
    const prev = P[L], next = new Array(prev.length * 2); const rad = r0 * Math.pow(grow, L);
    for (let i = 0; i < prev.length; i++) { const u = r() * 2 - 1, a = r() * 6.28, s = Math.sqrt(1 - u * u); const o = V(s * Math.cos(a), u * .8, s * Math.sin(a)).multiplyScalar(rad * (.7 + r() * .6)); next[i] = prev[i].clone().addScaledVector(o, -.5); next[i + prev.length] = prev[i].clone().addScaledVector(o, .5); }
    P.push(next);
  }
  return P;
}
const TREE = makeTree(42, 9, .16, 1.22);
function treeBacteria(center, T0, gens, t, size, out, scl = 1) {
  if (t < T0) return;
  const appear = eob(seg(t, T0, T0 + .3));
  let g = 0; while (g < gens.length && t >= gens[g]) g++;
  // g = number of completed divisions
  const L = Math.min(g, TREE.length - 1);
  let prog = 1, parentL = L;
  if (g < gens.length && g < TREE.length - 1) { const tg = gens[g]; const dur = Math.min(.22, (gens[g] - (g ? gens[g - 1] : T0)) * .6); prog = seg(t, tg - dur, tg); }
  const cur = TREE[L]; const nxt = TREE[Math.min(L + 1, TREE.length - 1)]; const n = cur.length;
  for (let i = 0; i < n; i++) {
    const wob = .012 * Math.sin(t * 7 + i);
    if (prog < 1 && L + 1 < TREE.length && prog > 0) {
      const e = eio(prog);
      for (const j of [i, i + n]) { const pp = vl(cur[i], nxt[j], e); out.push({ p: pp.multiplyScalar(scl).add(center).addScalarY(wob), s: size * appear * (1 - .15 * Math.sin(e * Math.PI)), sx: 1 + .25 * Math.sin(e * Math.PI) }); }
    } else out.push({ p: cur[i].clone().multiplyScalar(scl).add(center).addScalarY(wob), s: size * appear });
  }
}
THREE.Vector3.prototype.addScalarY = function (v) { this.y += v; return this; };

// ---------------------------------------------------------------- timeline helpers
const SC = TL.scenes;
const ST = i => SC[i].start, SD = i => SC[i].dur;
const n0 = (i, k) => SC[i].narr[k][0] - SC[i].start;
const n1 = (i, k) => SC[i].narr[k][0] + SC[i].narr[k][1] - SC[i].start;
const TOTAL = TL.total;

// cue times (scene-local definitions -> absolute)
const Q = {};
Q.whip = n0(0, 2) - .14;
Q.s1squirt = [1.05, 2.0]; Q.s1scrub = [2.05, 3.5]; Q.s1push = SD(1) - .45;
Q.bact0 = n0(2, 1) + .6 * SC[2].narr[1][1];
{ let t = Q.bact0 + .5, iv = [.55, .5, .45, .4, .36, .32, .28, .25, .22]; Q.gens = iv.map(x => (t += x) - x); }
Q.s3cut = n0(3, 2) - .05; Q.squeeze = n0(3, 2) + .7;
Q.s4off = n0(4, 2) - .05; Q.s4cup = n1(4, 2) + .1;
Q.s4clink = SD(4) - .95; Q.s4door = SD(4) - .5;
Q.x1 = n1(5, 0) - .1; Q.x2 = n1(5, 1) - .1; Q.toss = n0(5, 2) + .25; Q.slam = Q.toss + .85;
Q.mwShot = n0(5, 3) - .05; Q.humOn = n0(5, 3) + .15; Q.xrayMw = n0(5, 3) + .7; Q.pop0 = n0(5, 4) + .25;
Q.popEnd = 1.9; Q.beep = 2.15; Q.doorOpen = 2.75; Q.place = n0(6, 2) - .1; Q.drain = Q.place + .85; Q.drop = Q.drain + .35; Q.glow = Q.drop + .3; Q.ping = n1(6, 2) - .35;
Q.s7pan = 2.3;
// pops: assign times (absolute) to microwave bacteria
const MWB = SPB.slice(0, 120);
{
  const a = ST(5) + Q.pop0, b = ST(6) + Q.popEnd; const n = MWB.length; const idx = MWB.map((_, i) => i).sort((x, y) => MWB[x].pop - MWB[y].pop);
  idx.forEach((k, j) => { const u = j / (n - 1); MWB[k].popT = a + (b - a) * (1 - Math.pow(1 - u, 2.2)); });
}

// ---------------------------------------------------------------- per-frame state
let ST_ = {};
function reset() {
  ST_ = { xray: 0, whip: 0, flash: 0, flashCol: '255,255,255', fade: 0, stamp: null, depthBact: false, bg: 0xbfe0f5, hud: 0, tint: 0x061c3d };
  BL.length = 0; scene.fog = null; bscene.fog = null; headLamp.intensity = 0; hemi.intensity = 1.25; sun.intensity = 2.4; renderer.toneMappingExposure = 1.0;
  show.visible = false; inside.visible = false; kitchen.visible = true; ch.root.visible = true;
  stream.visible = vinStream.visible = soapStream.visible = false; soapB.visible = vinB.visible = fork.visible = false;
  foam.count = 0; waterDrops.count = 0; spGlowMat.opacity = 0; sponge.visible = true; sponge.scale.set(1, 1, 1); sponge.rotation.set(0, 0, 0);
  M.sponge.color.setHex(0xf8c53a); M.sponge.emissive.setHex(0); M.sponge.roughness = .55;
  plate.visible = true; plate.position.copy(PLATE_IN_SINK); plate.rotation.set(0, 0, 0); plate.scale.set(1, 1, 1);
  mwDoor.rotation.y = 0; mwLight.intensity = 0; cupDoor.rotation.y = 0; edgeMat.opacity = 1;
  ch.root.position.set(0, 0, -.88); ch.root.rotation.set(0, 0, 0); poseRest();
  sparkles.forEach(s => s.visible = true);
  camera.fov = 42; camera.up.set(0, 1, 0);
}
function cam(pos, look, fov = 42, shake = 0, t = 0) {
  camera.position.copy(pos);
  if (shake) camera.position.add(V(Math.sin(t * 37) * shake, Math.sin(t * 29 + 1) * shake, Math.sin(t * 23 + 2) * shake * .5));
  camera.lookAt(look); camera.fov = fov; camera.updateProjectionMatrix();
}
function spongeAt(p, q) { sponge.position.copy(p); if (q) sponge.quaternion.copy(q); }
function spongeBact(t, amt, opts = {}) {
  sponge.updateMatrixWorld(true);
  const list = opts.list || SPB; const sz = opts.size || .006;
  for (const b of list) {
    if (opts.skip && opts.skip(b)) continue;
    const p = b.p.clone(); p.y *= sponge.scale.y / 1; // scale handled by matrix anyway
    const jig = (opts.jig || .002); const lp = b.p.clone().add(V(Math.sin(t * 9 + b.ph) * jig, Math.cos(t * 11 + b.ph) * jig, Math.sin(t * 8 + b.ph * 2) * jig));
    const wp = lp.applyMatrix4(sponge.matrixWorld);
    BL.push({ p: wp, s: sz * amt * (opts.sc ? opts.sc(b) : 1), g: 3.2 });
  }
}
function holdSponge(side, center, t) { // place hand under sponge center
  ik(side, center.clone().add(V(0, -.015, 0)));
  const hp = handPos(side); spongeAt(hp.clone().add(V(0, .0, 0)));
}
function updFoam(center, amt, t, dripY) {
  const n = Math.floor(220 * clamp(amt)); foam.count = n;
  for (let i = 0; i < n; i++) {
    const f = foamD[i]; let p = center.clone().add(V(f.d.x * .12, f.d.y * .07 + .02, f.d.z * .08));
    let s = f.r * clamp(amt * 1.6 - f.t * .6, 0, 1);
    if (f.drip && dripY != null) { const ph = ((t * .9 + f.ph) % 1); p.y -= ph * .35; s *= 1 - ph * .5; p.x = center.x + f.d.x * .1; }
    dmy.position.copy(p); dmy.rotation.set(i, i * 2, 0); dmy.scale.setScalar(s); dmy.updateMatrix(); foam.setMatrixAt(i, dmy.matrix);
  }
  foam.instanceMatrix.needsUpdate = true;
}
function updDrops(list) { waterDrops.count = list.length; list.forEach((d, i) => { dmy.position.copy(d.p); dmy.rotation.set(0, 0, 0); dmy.scale.set(d.s, d.s * (d.st || 1), d.s); dmy.updateMatrix(); waterDrops.setMatrixAt(i, dmy.matrix); }); waterDrops.instanceMatrix.needsUpdate = true; }
function dripFrom(p, t, n = 3, per = .55, fall = .3) { const L = []; for (let i = 0; i < n; i++) { const ph = ((t + i * per / n) / per) % 1; L.push({ p: p.clone().add(V((i - 1) * .04, -ph * ph * fall, 0)), s: .006 + .003 * (1 - ph), st: 1.3 }); } return L; }
function sparkleShow(t) { sparkles.forEach(s => { const v = Math.max(0, Math.sin(t * 4 + s.userData.ph)); s.scale.setScalar(s.userData.s * (.2 + v)); s.material.opacity = v; }); }
function blink(t, period = 3.1) { const ph = t % period; const c = ph < .12 ? .15 : 1; ch.eyes.forEach(e => e.scale.y = 1.25 * c); }

// ---------------------------------------------------------------- SHOTS
function shot0(t, D) {
  if (t < Q.whip + .12) {
    show.visible = true; kitchen.visible = false; ch.root.visible = false; sponge.visible = false; plate.visible = false;
    ST_.bg = 0x9dd0ef; hemi.intensity = 1.1; sparkleShow(t);
    const o = show.position;
    const a = seg(t, n0(0, 1) - .2, n0(0, 1) + .55);
    const x = lerp(-.55, .6, eio(a));
    const push = t * .05;
    const pos = V(o.x + x + .25, 1.05 - push * .4, 2.35 - push * 1.5 - .15 * a);
    const look = V(o.x + x, .4, 0);
    cam(pos, look, 40);
    if (t > Q.whip) { const w = seg(t, Q.whip, Q.whip + .12); camera.rotateOnWorldAxis(V(0, 1, 0), -ei(w) * 1.3); }
    ST_.whip = bump(t, Q.whip - .02, Q.whip + .36);
  } else {
    const sp = SINK_REST.clone(); spongeAt(sp); sponge.rotation.set(0, .35, .18);
    ch.root.visible = false; plate.visible = false;
    M.sponge.roughness = .3;
    const w = seg(t, Q.whip + .12, Q.whip + .38);
    const look = sp.clone().add(V(0, .05, 0));
    const pos = sp.clone().add(V(.08, .66 - .18 * eo(seg(t, Q.whip + .3, D)), .3 - .08 * eo(seg(t, Q.whip + .3, D))));
    cam(pos, look, 50, .004 * bump(t, Q.whip + .3, Q.whip + .6), t);
    camera.rotateOnWorldAxis(V(0, 1, 0), (1 - eo(w)) * 1.1 - Math.sin(w * Math.PI) * .05);
    ST_.whip = Math.max(ST_.whip, bump(t, Q.whip - .02, Q.whip + .36));
    // puddle drops
    updDrops([...dripFrom(FAUCET, t, 2, .7, FAUCET.y - BASIN_Y), { p: sp.clone().add(V(.13, .004, .02)), s: .03, st: .12 }, { p: sp.clone().add(V(-.12, .004, -.03)), s: .022, st: .12 }]);
  }
}
const CH_STAND = V(0, 0, -.82);
function shot1(t, D) {
  ST_.bg = 0xf3e2cc;
  ch.root.position.copy(CH_STAND); blink(t);
  stream.visible = true; setStream(stream, FAUCET, V(0, BASIN_Y, -.1), .001, t);
  const sq = Q.s1squirt, sc = Q.s1scrub;
  // sponge position
  let sp = V(.22, 1.02, -.32);
  const lift = eob(seg(t, 0, .5));
  sp = vl(V(.22, .97, -.25), V(.2, 1.14, -.3), t < .95 ? lift : 1 - eio(seg(t, .95, 1.3)) * .9);
  if (t > sc[0] && t < sc[1]) { const k = Math.sin((t - sc[0]) * 26); sp.x += k * .025; sp.z += Math.cos((t - sc[0]) * 26) * .01; }
  holdSponge('L', sp, t);
  // left/right hand
  if (t < sq[0] - .2) { ik('R', V(-.15, 1.0, -.55)); }
  soapB.visible = t > sq[0] - .35 && t < sq[1] + .3;
  if (soapB.visible) {
    const a = eio(seg(t, sq[0] - .35, sq[0])), b = eio(seg(t, sq[1], sq[1] + .3));
    const bp = vl(vl(V(-.35, .92, -.2), V(.0, sp.y + .17, sp.z - .02), a), V(-.35, .92, -.2), b);
    soapB.position.copy(bp); soapB.rotation.set(0, 0, lerp(0, -2.3, a * (1 - b)));
    ik('R', bp.clone().add(V(0, .06, 0)));
    if (t > sq[0] && t < sq[1]) { const tip = new THREE.Vector3(0, .22, 0).applyEuler(soapB.rotation).add(bp); setStream(soapStream, tip, sp.clone().add(V(0, .12, 0)), .0005, t); }
  }
  if (t > sc[0] - .1) { // rubbing with right hand
    const k = Math.sin((t - sc[0]) * 26);
    ik('R', sp.clone().add(V(-.04 - .03 * k, .14, .02)), V(-.6, -.8, -.6));
    if (t > sc[1]) ik('R', vl(sp.clone().add(V(-.05, .14, .02)), V(-.2, .95, -.55), eio(seg(t, sc[1], sc[1] + .4))));
  }
  const foamAmt = seg(t, sq[0] + .3, sc[1] - .2);
  updFoam(sponge.position, foamAmt, t, t > sc[1] ? 1 : null);
  ch.head.rotation.x = .35; ch.head.rotation.y = .12;
  ch.smile.scale.set(1.15, 1.15, 1);
  // camera
  if (t < 3.45) {
    const pos = vl(V(.55, 1.5, 1.75), V(.4, 1.42, 1.35), eio(seg(t, 0, 3.4)));
    cam(pos, V(0.1, 1.3, -.5), 46);
  } else {
    const u = eio(seg(t, 3.45, Q.s1push));
    const look = sponge.position.clone().add(V(0, -.02, 0));
    let pos = vl(look.clone().add(V(.25, .12, .62)), look.clone().add(V(.16, .06, .48)), u);
    const v = ei(seg(t, Q.s1push, D)); pos = vl(pos, sponge.position.clone().add(V(.01, .07, .06)), v);
    cam(pos, vl(look, sponge.position.clone().add(V(0, .06, -.05)), v), 55);
    ST_.flash = Math.pow(seg(t, D - .18, D), 2); ST_.flashCol = '248,197,58';
  }
  // drips from sponge (soap/water)
  if (t > 3.3) updDrops(dripFrom(sponge.position.clone().add(V(0, -.005, .02)), t, 4, .5, .3));
}
function shot2(t, D) {
  inside.visible = true; kitchen.visible = false; ch.root.visible = false; sponge.visible = false; plate.visible = false;
  ST_.bg = 0x140d02; scene.fog = new THREE.Fog(0x1a1204, 1.2, 9); bscene.fog = scene.fog;
  hemi.intensity = .35; sun.intensity = 0; headLamp.intensity = 7; ST_.depthBact = true;
  ST_.flash = 1 - seg(t, 0, .45); ST_.flashCol = '248,197,58';
  const o = inside.position;
  const k = seg(t, 0, 4.4); const z = lerp(1.5, -10.8, 1 - Math.pow(1 - k, 2.2));
  const sway = Math.sin(z * .4) * .5;
  const pos = V(o.x + sway + Math.sin(t * 1.3) * .15, Math.sin(t * 1.1) * .12, z);
  const lookZ = z - 2.5; const look = V(o.x + Math.sin(lookZ * .4) * .5 * (1 - seg(t, 3, 4.5)), 0, lookZ);
  const lookB = INS_CH.clone();
  cam(pos, vl(look, lookB, eio(seg(t, 3, 4.6))), 55, .01, t);
  droplets(t);
  treeBacteria(INS_CH, Q.bact0, Q.gens.map(x => x), t, .07, BL);
}
function droplets(t) { dropData.forEach((d, i) => { dmy.position.set(inside.position.x + d.x + Math.sin(t * .5 + d.ph) * .2, d.y + Math.sin(t * .7 + d.ph) * .15, d.z); dmy.rotation.set(0, 0, 0); dmy.scale.setScalar(d.s); dmy.updateMatrix(); drops.setMatrixAt(i, dmy.matrix); }); drops.instanceMatrix.needsUpdate = true; }
const EXTRA = [[V(1.6, .9, -1.2), .4], [V(-1.7, -.6, -.6), .7], [V(.3, -1.5, .9), 1.0], [V(-.9, 1.4, 1.2), 1.3]];
function shot3(t, D) {
  if (t < Q.s3cut) {
    inside.visible = true; kitchen.visible = false; ch.root.visible = false; sponge.visible = false; plate.visible = false;
    ST_.bg = 0x140d02; scene.fog = new THREE.Fog(0x1a1204, 1.2, 10); bscene.fog = scene.fog;
    hemi.intensity = .35; sun.intensity = 0; headLamp.intensity = 7; ST_.depthBact = true;
    const T = t + SD(2);
    const a = t * .35 + .2; const R = lerp(3.2, 4.6, eio(seg(t, 0, Q.s3cut)));
    const pos = INS_CH.clone().add(V(Math.sin(a) * R * .6, .4 + t * .15, Math.cos(a) * R));
    cam(pos, INS_CH, 55, .008, t);
    droplets(T);
    treeBacteria(INS_CH, Q.bact0, Q.gens, T, .07, BL);
    EXTRA.forEach(([off, dl], i) => { const t0 = SD(2) + dl - .3; const gens = []; let g = t0 + .3; for (let k = 0; k < 9; k++) { g += .2 - k * .008; gens.push(g); } treeBacteria(INS_CH.clone().add(off), t0, gens, T, .06, BL, .8); });
    ST_.flash = Math.max(0, 1 - (Q.s3cut - t) / .08) * .0;
    return;
  }
  // squeeze in x-ray over plate
  ST_.bg = 0xf3e2cc; blink(t);
  ch.root.position.copy(CH_STAND);
  const tt = t - Q.s3cut;
  ST_.xray = eo(seg(tt, .0, .3)); ST_.hud = 1; ST_.flash = .7 * (1 - seg(tt, 0, .2)); ST_.flashCol = '127,233,255';
  const sq = eo(seg(t, Q.squeeze, Q.squeeze + .18));
  const rel = seg(t, D - .25, D) * 0;
  const center = V(-.06, .98 + .02 * Math.sin(tt * 2), .02);
  sponge.scale.set(1 + .12 * sq, 1 - .5 * sq, 1 + .12 * sq);
  spongeAt(center.clone().add(V(0, -.0, 0)));
  ik('L', center.clone().add(V(0, SP.h * (1 - .5 * sq) + .03, 0)), V(.8, .2, -.6));
  ik('R', V(-.25, .92, -.45));
  ch.head.rotation.x = .4;
  // bacteria: in sponge or flying to plate
  sponge.updateMatrixWorld(true);
  const plateTop = PLATE_IN_SINK.clone().add(V(0, .015, 0));
  for (const b of SPB) {
    const w = b.p.clone().add(V(Math.sin(t * 9 + b.ph) * .002, 0, Math.cos(t * 11 + b.ph) * .002)).applyMatrix4(sponge.matrixWorld);
    if (b.fly) {
      const t0 = Q.squeeze + .04 + b.ft * .9, fd = .32 + b.ft * .15;
      if (t > t0) {
        const u = seg(t, t0, t0 + fd); const L = plateTop.clone().add(b.land);
        const p = vl(w, L, u); p.y += Math.sin(u * Math.PI) * .04 - 0;
        if (u >= 1) { p.y += Math.abs(Math.sin((t - t0) * 12 + b.ph)) * .004 * Math.exp(-(t - t0 - fd) * 4); }
        BL.push({ p, s: .006, g: 3.2 }); continue;
      }
    }
    BL.push({ p: w, s: .006, g: 3.2 });
  }
  // water squirt drops
  if (t > Q.squeeze) updDrops(dripFrom(center.clone().add(V(0, 0, .02)), t, 5, .3, .25));
  const pos = V(.1, 1.12, .78), look = V(-.06, .86, .02);
  cam(vl(pos, V(.08, 1.08, .68), eio(seg(tt, 0, 3))), look, 50, .006 * bump(t, Q.squeeze, Q.squeeze + .3), t);
}
function plateBact(t, out, size = .0042) {
  const plateTop = plate.position.clone().add(V(0, .015, 0));
  for (const b of SPB) if (b.fly) { const p = plateTop.clone().add(b.land.clone().applyAxisAngle(V(0, 1, 0), plate.rotation.y)); p.y += Math.abs(Math.sin(t * 6 + b.ph)) * .0015; out.push({ p, s: size * (1 + .15 * Math.sin(t * 8 + b.ph)), g: 3.2 }); }
}
function shot4(t, D) {
  ST_.bg = 0xf3e2cc; blink(t);
  if (t < Q.s4off + .25) {
    ch.root.visible = false; sponge.visible = false;
    plate.position.copy(PLATE_IN_SINK);
    const x = t < Q.s4off ? 1 : (Math.floor((t - Q.s4off) * 40) % 2 ? 1 : .2) * (1 - seg(t, Q.s4off, Q.s4off + .25));
    ST_.xray = x; ST_.hud = x;
    if (x > .3) plateBact(t, BL);
    const a = t * .25;
    const pc = plate.position;
    cam(pc.clone().add(V(Math.sin(a) * .16, .34 - t * .015, Math.cos(a) * .16)), pc.clone().add(V(0, .01, 0)), 40);
    camera.rotateZ(.0);
    if (t > Q.s4off) { sparkles[0].visible = true; }
    return;
  }
  if (t < Q.s4cup) {
    // character smiling, admiring plate
    ch.root.position.copy(CH_STAND); ch.root.position.x = .45; sponge.position.set(-.12, BASIN_Y + .001, .02);
    const pp = V(.47, 1.33, -.45); plate.position.copy(pp); plate.rotation.set(1.2, 0, 0);
    ik('L', pp.clone().add(V(.12, -.03, -.02))); ik('R', pp.clone().add(V(-.12, -.03, -.02)));
    ch.head.rotation.set(.12, 0, .12 * Math.sin((t - Q.s4off) * 3)); ch.smile.scale.set(1.5, 1.6, 1);
    ch.eyes.forEach(e => e.scale.y = .45); // happy squint
    ch.browL.position.y = .1; ch.browR.position.y = .1;
    const u = t - Q.s4off;
    cam(V(.6, 1.52, .95 - u * .08), V(.45, 1.42, -.6), 44);
    ST_.glint = { p: pp.clone().add(V(.06, .04, .03)), a: bump(u, .1, .9) };
    return;
  }
  // put plate in cupboard
  const u = t - Q.s4cup;
  ch.root.position.set(lerp(0, -.45, eio(seg(u, 0, .4))), 0, -.95); ch.root.rotation.y = lerp(0, -1.6, eio(seg(u, 0, .45)));
  const shelf = cup.localToWorld(V(-.12, .012 + 0.03, 0)); const doorClose = SD(4) - Q.s4cup - .5;
  cupDoor.rotation.y = -1.9 * (1 - eio(seg(u, doorClose - .25, doorClose)));
  const rel = doorClose - .45;
  const hand0 = V(-.25, 1.33, -.55);
  if (u < rel) { const pp = vl(hand0, shelf.clone().add(V(0, .03, .05)), eio(seg(u, .15, rel))); plate.position.copy(pp); plate.rotation.set(lerp(1.2, 0, eio(seg(u, .1, rel))), 0, 0); ik('R', pp.clone().add(V(0, -.02, .1))); ik('L', V(-.3, .95, -.7)); }
  else { plate.position.copy(shelf); ik('R', vl(shelf.clone().add(V(0, -.02, .1)), V(-.5, 1.0, -.6), eio(seg(u, rel, rel + .3)))); }
  ch.smile.scale.set(1.3, 1.3, 1);
  cam(V(.55, 1.55, 1.25), V(-.75, 1.5, -1.2), 42);
  sponge.position.set(-.12, BASIN_Y + .001, .02);
}
function shot5(t, D) {
  ST_.bg = 0xf3e2cc; blink(t);
  ch.root.position.copy(CH_STAND);
  plate.visible = false;
  if (t < n0(5, 2) - .05) {
    const center = V(.03, .92, -.18);
    ch.torso.rotation.x = .4; holdSponge('L', center, t); ik('R', V(-.25, .92, -.5));
    ST_.xray = .85 * eo(seg(t, 0, .25)); ST_.hud = 1;
    spongeBact(t, 1, { jig: .003 });
    if (t < n1(5, 0) + .1) setStream(stream, FAUCET, sponge.position.clone().add(V(0, .12, 0)), .001, t), updDrops(dripFrom(sponge.position.clone().add(V(0, 0, .02)), t, 5, .35, .25));
    if (t > n0(5, 1) - .2) {
      vinB.visible = true; const a = eob(seg(t, n0(5, 1) - .2, n0(5, 1) + .25));
      const bp = vl(V(.45, 1.45, -.15), sponge.position.clone().add(V(.1, .26, 0)), a); vinB.position.copy(bp); vinB.rotation.set(0, 0, 2.1 * a);
      if (t > n0(5, 1) + .3) { const tip = V(0, .3, 0).applyEuler(vinB.rotation).add(bp); setStream(vinStream, tip, sponge.position.clone().add(V(0, .12, 0)), .0008, t); updDrops(dripFrom(sponge.position.clone().add(V(0, 0, .02)), t, 4, .4, .25)); }
    }
    if (t > Q.x1 && t < Q.x1 + .9) ST_.stamp = { k: seg(t, Q.x1, Q.x1 + .9) };
    if (t > Q.x2 && t < n0(5, 2) - .05) ST_.stamp = { k: seg(t, Q.x2, Q.x2 + .9) };
    const look = sponge.position.clone().add(V(0, .1, 0));
    cam(look.clone().add(V(.2 + t * .01, .1, .55)), look, 50, .003 * bump(t, Q.x1, Q.x1 + .15) + .003 * bump(t, Q.x2, Q.x2 + .15), t);
    return;
  }
  if (t < Q.mwShot) {
    // toss to microwave
    const slot = mwSlot.getWorldPosition(new THREE.Vector3());
    mwDoor.rotation.y = -1.75 * (1 - eio(seg(t, Q.slam - .18, Q.slam)));
    const start = V(.22, 1.12, -.5);
    if (t < Q.toss) { holdSponge('L', vl(V(.15, 1.0, -.45), start, eio(seg(t, n0(5, 2), Q.toss)))); }
    else { const u = seg(t, Q.toss, Q.toss + .55); const p = vl(start, slot, eio(u)); p.y += Math.sin(u * Math.PI) * .25; spongeAt(p); sponge.rotation.set(u * 6, u * 3, 0); ik('L', vl(start.clone().add(V(.15, .05, .1)), V(.3, .95, -.6), seg(t, Q.toss + .3, Q.toss + .7))); }
    ik('R', V(-.25, .92, -.5));
    ch.head.rotation.y = .5; ch.smile.scale.set(1.3, 1.3, 1);
    cam(V(.75, 1.4, 1.6), V(.65, 1.05, -.35), 42);
    return;
  }
  microwaveShot(t - Q.mwShot, t, 5);
}
function microwaveShot(u, t, sceneIdx) {
  ch.root.visible = false; plate.visible = false;
  const abs = ST(sceneIdx) + t;
  const humA = ST(5) + Q.humOn, humB = ST(6) + Q.beep;
  const on = abs > humA && abs < humB;
  mwLight.intensity = on ? 1.8 : (abs < humA ? 0 : .0);
  const ang = on ? (abs - humA) * 1.4 : (abs >= humB ? (humB - humA) * 1.4 : 0);
  mwT.rotation.y = ang;
  mwSlot.updateMatrixWorld(true);
  spongeAt(mwSlot.getWorldPosition(new THREE.Vector3()), mwSlot.getWorldQuaternion(new THREE.Quaternion()));
  // display
  const remain = Math.max(0, 120 * (1 - seg(abs, humA, humB)));
  let s = abs < humA ? '2:00' : `${Math.floor(remain / 60)}:${String(Math.floor(remain % 60)).padStart(2, '0')}`;
  if (abs > humB) s = (Math.floor((abs - humB) * 4) % 2) ? 'END' : '0:00';
  if (s !== lastDisp) { drawDisp(s, true); lastDisp = s; }
  // x-ray + pops
  const xr = eo(seg(abs, ST(5) + Q.xrayMw, ST(5) + Q.xrayMw + .3)) * (1 - seg(abs, ST(6) + Q.popEnd + .1, ST(6) + Q.popEnd + .4));
  ST_.xray = xr * .9; ST_.hud = xr;
  sponge.updateMatrixWorld(true);
  if (xr > .02) {
    const vib = seg(abs, ST(5) + Q.xrayMw, ST(5) + Q.pop0 + .5);
    for (const b of MWB) {
      const dt = abs - b.popT;
      const j = .002 + .006 * vib;
      const w = b.p.clone().add(V(Math.sin(abs * 47 + b.ph) * j, Math.cos(abs * 53 + b.ph) * j, Math.sin(abs * 41 + b.ph * 3) * j)).applyMatrix4(sponge.matrixWorld);
      if (dt < 0) BL.push({ p: w, s: .0055, g: 3.2 });
      else if (dt < .07) BL.push({ p: w, s: .0055 * (1 + dt / .07 * 1.4), g: 6 });
      else if (dt < .4) { const k = seg(dt, .07, .4); for (let i = 0; i < 6; i++) { const a = i * 1.047 + b.ph; BL.push({ p: w.clone().add(V(Math.cos(a), Math.sin(a * 1.7) * .6 + .3, Math.sin(a)).multiplyScalar(.035 * eo(k))), s: .003 * (1 - k), g: 3 }); } }
    }
  }
  // door + camera
  const openA = ST(6) + Q.doorOpen;
  mwDoor.rotation.y = -1.6 * eio(seg(abs, openA, openA + .4));
  const camLocal = vl(V(-.07, .2, .5), V(-.08, .19, .36), eio(seg(abs, ST(5) + Q.mwShot, ST(6) + Q.popEnd)));
  const pullback = eio(seg(abs, openA - .1, openA + .6));
  const cl = vl(camLocal, V(-.02, .26, .62), pullback);
  const p = mw.localToWorld(cl.clone()), lk = mw.localToWorld(V(-.09, .1, 0));
  cam(p, lk, 40, .0015 * (on ? 1 : 0), abs);
  if (abs > openA + .2) { // shiny clean
    M.sponge.color.setHex(0xffd65a); M.sponge.emissive.setHex(0x553a00); M.sponge.emissiveIntensity = .25;
    ST_.glint = { p: sponge.position.clone().add(V(.06, .11, .05)), a: bump(abs, openA + .3, openA + 1.1) };
    ST_.glint2 = { p: sponge.position.clone().add(V(-.07, .06, .07)), a: bump(abs, openA + .6, openA + 1.3) };
  }
}
function shot6(t, D) {
  ST_.bg = 0xf3e2cc;
  if (t < Q.place) { microwaveShot(t, t, 6); return; }
  ch.root.position.copy(CH_STAND); blink(t);
  plate.visible = false;
  const restP = SINK_REST.clone();
  M.sponge.color.setHex(0xffd65a);
  if (t < Q.drain) {
    const u = seg(t, Q.place, Q.place + .45);
    const p = vl(V(-.1, 1.02, -.15), restP, eio(u)); spongeAt(p); sponge.rotation.y = .2;
    if (u < 1) ik('L', p.clone().add(V(0, .135, 0)), V(.8, .2, -.6)); else ik('L', vl(restP.clone().add(V(0, .135, 0)), V(.35, .95, -.55), eio(seg(t, Q.place + .45, Q.place + .8))), V(.8, .2, -.6));
    ik('R', V(-.25, .92, -.5));
    ST_.glint = { p: p.clone().add(V(.06, .11, .05)), a: .6 * (1 - u) };
    cam(V(.15, 1.25, .55), V(.0, .8, 0), 40);
    return;
  }
  spongeAt(restP); sponge.rotation.y = .2;
  ik('L', V(.35, .95, -.55)); ik('R', V(-.25, .92, -.5));
  const u = eio(seg(t, Q.drain, Q.drain + .5));
  const look = vl(V(-.1, .74, 0), V(-.01, .71, .01), u);
  cam(vl(V(-.05, 1.45, .4), V(0, 1.32, .3), u), look, 46);
  const L = [];
  const dt = t - Q.drop;
  if (dt > -.4 && dt < 0) { const k = seg(dt, -.4, 0); L.push({ p: vl(FAUCET.clone().add(V(0, -.01, 0)), V(-.01, BASIN_Y + .01, .02), k * k), s: .009, st: 1.4 }); }
  else if (dt < -.4) L.push({ p: FAUCET.clone().add(V(0, -.012, 0)), s: .006 + .004 * seg(dt, -1.2, -.4), st: 1.2 });
  else if (dt < .35) { const k = seg(dt, 0, .35); for (let i = 0; i < 6; i++) { const a = i * 1.05; L.push({ p: V(-.01 + Math.cos(a) * .03 * k, BASIN_Y + .005 + Math.sin(k * Math.PI) * .02, .02 + Math.sin(a) * .03 * k), s: .004 * (1 - k) + .001 }); } }
  L.push({ p: V(-.04, BASIN_Y + .002, .03), s: .05 * eo(seg(dt, 0, .5)), st: .1 });
  updDrops(L);
  const g = eo(seg(t, Q.glow, Q.glow + .5));
  spGlowMat.opacity = g * (.55 + .2 * Math.sin(t * 10));
  M.sponge.emissive.setHex(0x1f7a00); M.sponge.emissiveIntensity = g * .6;
  if (g > 0) { BL.push({ p: restP.clone().add(V(0, .015, 0)), s: .02 * g, g: 9, sx: 3 }); }
  ST_.depthBact = true;
}
function shot7(t, D) {
  ST_.bg = 0xf3e2cc; blink(t, 2.7);
  plate.visible = false;
  const restP = SINK_REST.clone(); spongeAt(restP); sponge.rotation.y = .2;
  spGlowMat.opacity = .45 + .25 * Math.sin(t * 4);
  M.sponge.emissive.setHex(0x1f7a00); M.sponge.emissiveIntensity = .45;
  // seated character
  const seat = dining.localToWorld(V(0, 0, -.12));
  ch.root.position.set(seat.x, -.36, seat.z - .02); ch.root.rotation.y = 0;
  ch.hipL.rotation.x = ch.hipR.rotation.x = -1.57; ch.kneeL.rotation.x = ch.kneeR.rotation.x = 1.57;
  const ph = ((t + .3) % 1.4) / 1.4; // eating loop
  const platePos = dining.localToWorld(V(0, .8, .25)); const mouth = ch.head.getWorldPosition(new THREE.Vector3()).add(V(0, -.05, .2));
  const up = ph < .5 ? eio(seg(ph, .1, .45)) : 1 - eio(seg(ph, .6, .95));
  const hp = vl(platePos.clone().add(V(.05, .03, -.02)), mouth.clone().add(V(.02, -.02, .03)), up);
  ik('R', hp, V(-.8, -.7, -.3)); ik('L', platePos.clone().add(V(.22, -.03, -.1)), V(.8, -.6, -.3));
  const h = handPos('R'); fork.visible = true; fork.position.copy(h).add(V(0, .02, .02)); fork.rotation.set(-.6 - up * .9, 0, 0);
  ch.head.rotation.x = .25 - up * .25; ch.smile.scale.set(1.2, 1.0 + .3 * Math.abs(Math.sin(t * 9)) * (1 - up), 1);
  ch.torso.rotation.x = .08;
  // camera
  const k = eio(seg(t, Q.s7pan, D - .2));
  const p0 = V(.35, 1.2, 4.35), l0 = V(0, 1.0, 2.35);
  const p1 = V(-.08, 1.45, .4), l1 = restP.clone().add(V(0, .04, 0));
  const mid = V(.5, 1.75, 2.2);
  const pos = k < .5 ? vl(p0, mid, eio(k * 2)) : vl(mid, p1, eio((k - .5) * 2));
  cam(pos, vl(l0, l1, sm(clamp(k * 1.4))), lerp(40, 34, k));
  BL.push({ p: restP.clone().add(V(0, .015, 0)), s: .02 * (.8 + .2 * Math.sin(t * 4)), g: 9, sx: 3 });
  ST_.depthBact = true;
  ST_.fade = seg(t, D - .35, D);
}
const SHOTS = [shot0, shot1, shot2, shot3, shot4, shot5, shot6, shot7];

// ---------------------------------------------------------------- captions & overlays
const HL = ['SUJO', 'LIXO', 'VASO', 'ESPONJA', 'SABÃO', 'LIMPA', 'SELVA', 'BACTÉRIAS', 'MULTIPLICAM', 'APERTA', 'EXPULSAS', 'TEMPERANDO', 'VÊ', 'CALOR', 'MICRO-ONDAS', 'EXPLODEM', 'ZERAR', 'JOGO', 'VOLTA', 'JANTAR', 'NÃO', 'ISSO', 'VINAGRE', 'ÁGUA', 'DOIS', 'MINUTOS'];
const GREEN = ['BACTÉRIAS', 'MULTIPLICAM', 'EXPULSAS', 'TEMPERANDO', 'SELVA', 'VOLTA'];
function drawCaption(t) {
  const c = TL.captions.find(c => t >= c.t0 && t < c.t1 + .06);
  if (!c) return;
  const age = t - c.t0; const s = eob(clamp(age / .14)) * .25 + .75;
  const words = c.text.toUpperCase().split(' ');
  ctx.save(); ctx.translate(W / 2, 1330); ctx.scale(s, s);
  ctx.font = '900 96px Mont'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const widths = words.map(w => ctx.measureText(w + ' ').width); let tot = widths.reduce((a, b) => a + b, 0) - ctx.measureText(' ').width;
  let scale = 1; if (tot > W - 110) { scale = (W - 110) / tot; ctx.scale(scale, scale); }
  let x = -tot / 2;
  words.forEach((w, i) => {
    const clean = w.replace(/[.,:…!?]/g, '');
    const hl = HL.includes(clean); const gr = GREEN.includes(clean);
    ctx.lineWidth = 18; ctx.strokeStyle = '#111'; ctx.strokeText(w, x, 0);
    ctx.fillStyle = gr ? '#7dff4a' : hl ? '#ffd93b' : '#ffffff'; ctx.fillText(w, x, 0);
    x += widths[i];
  });
  ctx.restore();
}
function drawStamp(k) {
  const a = eob(clamp(k / .25)); const fade = 1 - seg(k, .7, 1);
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(W / 2, 760); ctx.scale(2.2 - 1.2 * a, 2.2 - 1.2 * a); ctx.rotate(-.12);
  ctx.lineCap = 'round'; ctx.strokeStyle = '#111'; ctx.lineWidth = 70;
  for (const s of [1, -1]) { ctx.beginPath(); ctx.moveTo(-150, -150 * s); ctx.lineTo(150, 150 * s); ctx.stroke(); }
  ctx.strokeStyle = '#ff2d2d'; ctx.lineWidth = 48;
  for (const s of [1, -1]) { ctx.beginPath(); ctx.moveTo(-150, -150 * s); ctx.lineTo(150, 150 * s); ctx.stroke(); }
  ctx.restore();
}
function drawGlint(g) {
  if (!g || g.a <= 0) return; const v = g.p.clone().project(camera); if (v.z > 1) return;
  const x = (v.x * .5 + .5) * W, y = (-v.y * .5 + .5) * H; const s = 120 * g.a;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = g.a; ctx.translate(x, y); ctx.rotate(g.a * .8);
  ctx.drawImage(sparkTex.userData.c, -s, -s, s * 2, s * 2); ctx.restore();
}
const vign = (() => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const gr = g.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .62); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.38)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); return c; })();
const scan = (() => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = 'rgba(127,233,255,.07)'; for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2); return c; })();

// ---------------------------------------------------------------- frame
function renderFrame(T) {
  reset();
  let si = SC.findIndex(s => T >= s.start && T < s.start + s.dur); if (si < 0) si = SC.length - 1;
  const t = T - ST(si);
  SHOTS[si](t, SD(si));
  scene.background = null;
  renderer.setClearColor(ST_.bg, 1);
  // xray: kitchen dims
  flushBact();
  renderer.clear();
  renderer.shadowMap.autoUpdate = true;
  camera.layers.set(0); renderer.render(scene, camera);
  renderer.shadowMap.autoUpdate = false;
  if (ST_.xray > .01) {
    tintMat.opacity = .72 * ST_.xray; renderer.render(oscene, ocam);
    edgeMat.opacity = ST_.xray; ghostMat.opacity = .22 * ST_.xray; camera.layers.set(1); renderer.render(scene, camera); camera.layers.set(0);
  }
  if (BL.length) {
    bactMat.emissiveIntensity = ST_.xray > .01 ? 1.2 : .85;
    if (!ST_.depthBact) renderer.clearDepth();
    renderer.render(bscene, camera);
  }
  // composite
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  if (ST_.whip > .01) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const n = 9; for (let i = 0; i < n; i++) { ctx.globalAlpha = 1 / (i * .7 + 1) * .55 + .1; ctx.drawImage(renderer.domElement, (i - n / 2) * 60 * ST_.whip, 0); }
    ctx.globalAlpha = 1;
  } else ctx.drawImage(renderer.domElement, 0, 0);
  drawGlint(ST_.glint); drawGlint(ST_.glint2);
  if (ST_.xray > .01) { ctx.globalAlpha = ST_.xray; ctx.drawImage(scan, 0, 0); ctx.globalAlpha = 1; }
  if (ST_.hud > .01) {
    ctx.save(); ctx.globalAlpha = ST_.hud; ctx.font = '900 54px Mont'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(4,20,40,.65)'; ctx.beginPath(); ctx.roundRect(W / 2 - 170, 200, 340, 92, 46); ctx.fill();
    ctx.fillStyle = (Math.floor(T * 2.5) % 2) ? '#ff3b3b' : '#7a1d1d'; ctx.beginPath(); ctx.arc(W / 2 - 112, 246, 15, 0, 7); ctx.fill();
    ctx.fillStyle = '#7fe9ff'; ctx.fillText('RAIO-X', W / 2 + 20, 248); ctx.restore();
  }
  ctx.drawImage(vign, 0, 0);
  if (ST_.stamp) drawStamp(ST_.stamp.k);
  if (ST_.flash > .001) { ctx.fillStyle = `rgba(${ST_.flashCol},${ST_.flash})`; ctx.fillRect(0, 0, W, H); }
  drawCaption(T);
  if (ST_.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${ST_.fade})`; ctx.fillRect(0, 0, W, H); }
  return out;
}

// cue export for audio
function cues() {
  const A = (i, x) => +(ST(i) + x).toFixed(3);
  const C = {};
  C.total = TOTAL;
  C.scenes = SC.map(s => [s.start, s.dur]);
  C.swoosh = [A(0, Q.whip)]; C.impact = [A(0, Q.whip + .3)];
  C.water = [[A(1, 0), A(1, SD(1))], [A(5, 0), A(5, n1(5, 0) + .1)]];
  C.squirt = [[A(1, Q.s1squirt[0]), A(1, Q.s1squirt[1])]];
  C.scrub = [[A(1, Q.s1scrub[0]), A(1, Q.s1scrub[1])]];
  C.dive = [A(1, Q.s1push)];
  C.underwater = [[A(2, 0), A(3, Q.s3cut)]];
  C.bactAppear = A(2, Q.bact0);
  C.gens = Q.gens.map(g => A(2, g));
  C.tickStart = A(2, Q.bact0); C.tickEnd = A(3, Q.s3cut);
  C.xrayOn = [A(3, Q.s3cut), A(5, 0), A(5, Q.xrayMw)];
  C.squeeze = A(3, Q.squeeze); C.splash = A(3, Q.squeeze + .45);
  C.musicStop = A(4, 0); C.musicResume = A(5, 0); C.musicEnd = A(7, 0);
  C.glitch = A(4, Q.s4off); C.glint = [A(4, Q.s4off + .15), A(6, Q.doorOpen + .35)];
  C.plateClink = A(4, Q.s4clink); C.cupDoor = A(4, Q.s4door);
  C.stamps = [A(5, Q.x1), A(5, Q.x2)];
  C.vinegar = [A(5, n0(5, 1) + .3), A(5, n0(5, 2) - .1)];
  C.toss = A(5, Q.toss); C.slam = A(5, Q.slam);
  C.hum = [A(5, Q.humOn), A(6, Q.beep)];
  C.pops = MWB.map(b => +b.popT.toFixed(3)).sort((a, b) => a - b);
  C.beep = A(6, Q.beep); C.doorOpen = A(6, Q.doorOpen);
  C.place = A(6, Q.place + .42); C.drop = A(6, Q.drop); C.ping = A(6, Q.ping);
  const clinks = []; for (let t = 0; t < SD(7); t += .01) { } // computed below
  { const D = SD(7); for (let k = 0; k < 10; k++) { const t = k * 1.4 - .3 + .1 * 1.4; if (t > 0 && t < D - .2) clinks.push(A(7, t)); } }
  C.clinks = clinks;
  return C;
}
window.__ready = true;
window.renderFrame = (T, q = .9) => { renderFrame(T); return out.toDataURL('image/jpeg', q); };
window.renderOnly = (T) => { renderFrame(T); return true; };
window.getCues = cues;
window.renderFrameCanvas = (T) => {
  const saved = TL.captions; TL.captions = []; renderFrame(T); TL.captions = saved;
  const g = ctx; g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const lines = [['O OBJETO MAIS', '#fff'], ['SUJO DA SUA', '#ffd93b'], ['COZINHA', '#fff'], ['NÃO É O LIXO', '#7dff4a']];
  lines.forEach(([s, c], i) => { g.font = '900 118px Mont'; g.lineWidth = 22; g.strokeStyle = '#111'; g.strokeText(s, W / 2, 560 + i * 140); g.fillStyle = c; g.fillText(s, W / 2, 560 + i * 140); });
  return out.toDataURL('image/jpeg', .92);
};
