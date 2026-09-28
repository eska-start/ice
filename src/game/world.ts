import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { std, tex } from './textures';
import { addWorldOutlines } from './toon';
import type { MapId } from './types';

export interface Collider {
  type: 'box' | 'circle';
  x: number;
  z: number;
  hw: number;
  hd: number;
  r: number;
  h: number;
}

export const BOUNDS = { minX: -15, maxX: 15, minZ: -21, maxZ: 21 };

export interface ThemeDef {
  sky: number;
  skyTop: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  hemi: [number, number, number];
  sun: [number, number];
  env: number;
  ground: number;
  groundTex: 'grass' | 'sand' | 'snow';
  path: number;
  tree: 'pine' | 'round' | 'palm';
  leaf: number[];
  pile: 'snow' | 'bush' | 'sand';
  snowy: boolean;
  sea: boolean;
  night: boolean;
  water: number;
  flowers: boolean;
  snowmen: boolean;
  fruit: number | null;
  wallA: number;
  roofA: number;
  wallB: number;
  roofB: number;
}

export const THEMES: Record<MapId, ThemeDef> = {
  plaza: { sky: 0xbfe6ff, skyTop: 0x5fb4f0, fog: 0xd9efff, fogNear: 34, fogFar: 70, hemi: [0xf2f8ff, 0x7aa35e, 1.1], sun: [0xfff1d8, 2.3], env: 0.45, ground: 0x8fd16f, groundTex: 'grass', path: 0xf0e2c6, tree: 'round', leaf: [0x5dbb5a, 0x4eaa52, 0x72c65e], pile: 'bush', snowy: false, sea: false, night: false, water: 0x7fd4ff, flowers: true, snowmen: false, fruit: 0xff5a4a, wallA: 0xfff3dc, roofA: 0xe0605a, wallB: 0xfdf6ec, roofB: 0x5a8fe0 },
  beach: { sky: 0xc9f0ff, skyTop: 0x4fb8ee, fog: 0xdff6ff, fogNear: 34, fogFar: 72, hemi: [0xf8fcff, 0xd9c69a, 1.15], sun: [0xfff4dc, 2.5], env: 0.5, ground: 0xf4dfae, groundTex: 'sand', path: 0xf6ead0, tree: 'palm', leaf: [0x4cbf5c, 0x3faf55, 0x5fcf66], pile: 'sand', snowy: false, sea: true, night: false, water: 0x49c3e6, flowers: false, snowmen: false, fruit: null, wallA: 0xfffaf0, roofA: 0x4fb8c4, wallB: 0xfff3e0, roofB: 0xf5a660 },
  snow: { sky: 0xdcefff, skyTop: 0x8dc4ec, fog: 0xe0eefa, fogNear: 30, fogFar: 64, hemi: [0xeef6ff, 0xa8bcd4, 1.15], sun: [0xfff4e4, 2.2], env: 0.5, ground: 0xf6f9ff, groundTex: 'snow', path: 0xd8d0ca, tree: 'pine', leaf: [0x3d8a5a, 0x347d50, 0x4a9a64], pile: 'snow', snowy: true, sea: false, night: false, water: 0xbfe9ff, flowers: false, snowmen: true, fruit: null, wallA: 0xfff3dc, roofA: 0xd9534f, wallB: 0xeaf4ff, roofB: 0x4f86d9 },
  night: { sky: 0x1b2d5c, skyTop: 0x070f28, fog: 0x1a2a55, fogNear: 22, fogFar: 58, hemi: [0x6a7fc0, 0x1a2140, 0.8], sun: [0xb4c4ff, 0.9], env: 0.18, ground: 0x5d8f74, groundTex: 'grass', path: 0x8f94ab, tree: 'round', leaf: [0x3f8a5c, 0x357a50, 0x4a9866], pile: 'bush', snowy: false, sea: true, night: true, water: 0x23498a, flowers: true, snowmen: false, fruit: 0xffb347, wallA: 0xe6dac4, roofA: 0x9a4040, wallB: 0xd2dcee, roofB: 0x34508f },
};

export interface WorldData {
  colliders: Collider[];
  spawnPoints: THREE.Vector2[];
  itemPoints: THREE.Vector2[];
  startRed: THREE.Vector2[];
  startBlue: THREE.Vector2[];
  startTagger: THREE.Vector2;
  startRunners: THREE.Vector2[];
  animated: { obj: THREE.Object3D; kind: 'water' | 'smoke' | 'sea' | 'foam' | 'cloud' }[];
  lampPositions: THREE.Vector3[];
}

// ---------------------------------------------------------------- merged geometry batches (few draw calls)
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function xf(px: number, py: number, pz: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(px, py, pz), _q, _s.set(sx, sy, sz));
}
class Batch {
  parts: THREE.BufferGeometry[] = [];
  add(geo: THREE.BufferGeometry, color: number, m: THREE.Matrix4, parent?: THREE.Matrix4) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(parent ? parent.clone().multiply(m) : m);
    const n = g.attributes.position.count;
    const c = new THREE.Color(color);
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    this.parts.push(g);
  }
  /** outline: false = no line art, number = line color (hex) for the colored line-art pass */
  build(scene: THREE.Scene, mat: THREE.Material, cast = true, receive = false, outline: false | number = false) {
    if (!this.parts.length) return;
    const merged = mergeGeometries(this.parts, false);
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    if (outline === false) mesh.userData.noOutline = true;
    else mesh.userData.outlineColor = outline;
    scene.add(mesh);
  }
}

const G = {
  sph: new THREE.SphereGeometry(1, 16, 12),
  sphLo: new THREE.SphereGeometry(1, 8, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cylTaper: new THREE.CylinderGeometry(0.7, 1, 1, 12),
  cone: new THREE.ConeGeometry(1, 1, 14),
  cone5: new THREE.ConeGeometry(1, 1, 5),
  box: new THREE.BoxGeometry(1, 1, 1),
  half: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
};

function sh<T extends THREE.Mesh>(o: T, cast = true, receive = true): T {
  o.castShadow = cast;
  o.receiveShadow = receive;
  return o;
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function buildWorld(scene: THREE.Scene, map: MapId): WorldData {
  const T = THEMES[map];
  const colliders: Collider[] = [];
  const animated: WorldData['animated'] = [];
  const lampPositions: THREE.Vector3[] = [];

  // materials
  const snowMat = std(0xffffff, { tex: 'snow', rx: 2 });
  const woodMat = std(0xb07a48, { tex: 'wood', bump: 0.6 });
  const woodLight = std(0xd9a86a, { tex: 'wood', bump: 0.6 });
  const stoneMat = std(0xc9c3bc, { tex: 'stone', rx: 2, bump: 0.8 });
  const barkMat = std(0xffffff, { tex: 'bark', vertexColors: true });
  // canopy sways gently above the trunk (BotW-style living foliage)
  const leafMat = std(0xffffff, { tex: 'leaf', rx: 2, vertexColors: true, wind: T.tree === 'palm' ? 0.03 : 0.022, windBase: 1.1 });
  const flatMat = std(0xffffff, { tex: 'soft', vertexColors: true, kind: 'world' });
  const winMat = std(0xffe6a0, { rough: 0.2, emissive: T.night ? 0xffb347 : 0x9a7a30, emissiveIntensity: T.night ? 1.3 : 0.35 });
  const trunkB = new Batch(), leafB = new Batch(), flatB = new Batch(), grassB = new Batch(), snowB = new Batch();

  const addBox = (x: number, z: number, hw: number, hd: number, h: number) => colliders.push({ type: 'box', x, z, hw, hd, r: 0, h });
  const addCircle = (x: number, z: number, r: number, h: number) => colliders.push({ type: 'circle', x, z, r, hw: 0, hd: 0, h });
  const sym = (fn: (x: number, z: number) => void, x: number, z: number) => { fn(x, z); fn(-x, -z); };

  // ---------------------------------------------------------------- ground
  const groundGeo = new THREE.PlaneGeometry(90, 100, 60, 66);
  const pos = groundGeo.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  const base = new THREE.Color(T.ground);
  const tint = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const inside = Math.abs(x) < 16 && Math.abs(y) < 22;
    const n = Math.sin(x * 0.7) * Math.cos(y * 0.6) * 0.5 + Math.sin(x * 1.9 + y * 1.3) * 0.25;
    let h = inside ? n * 0.04 : n * 0.4 + 0.12 + Math.max(0, Math.abs(x) - 18) * 0.05;
    if (T.sea && x > 16.5) h = -0.9;
    pos.setZ(i, h);
    tint.copy(base);
    const v = 1 + n * 0.07 + (Math.sin(x * 0.23 + y * 0.17) * 0.05);
    tint.multiplyScalar(v);
    if (T.groundTex === 'grass') tint.offsetHSL(Math.sin(x * 0.15 - y * 0.11) * 0.02, 0, 0);
    if (T.sea && x > 12) tint.lerp(new THREE.Color(T.night ? 0x8a8a70 : 0xf7e9c4), Math.min(1, (x - 12) / 4));
    colors.push(tint.r, tint.g, tint.b);
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, std(0xffffff, { tex: T.groundTex, rx: 30, ry: 33, vertexColors: true, rough: T.snowy ? 0.7 : 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------------------------------------------------------------- cobblestone plaza + path
  const plaza = sh(new THREE.Mesh(new THREE.CircleGeometry(5.2, 48), std(T.path, { tex: 'cobble', rx: 3.5, bump: 1.4 })), false, true);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  scene.add(plaza);
  const border = sh(new THREE.Mesh(new THREE.TorusGeometry(5.25, 0.16, 8, 64), stoneMat), false, true);
  border.rotation.x = -Math.PI / 2;
  border.scale.z = 0.45;
  border.position.y = 0.03;
  scene.add(border);
  const pathStrip = sh(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 42), std(T.path, { tex: 'cobble', rx: 1, ry: 17, bump: 1.4 })), false, true);
  pathStrip.rotation.x = -Math.PI / 2;
  pathStrip.position.y = 0.015;
  scene.add(pathStrip);
  for (let z = -20.5; z <= 20.5; z += 0.7) {
    if (Math.abs(z) < 5.3) continue;
    for (const s of [-1, 1]) flatB.add(G.sph, 0xbdb6ad, xf(s * 1.28, 0.02, z + rnd(-0.1, 0.1), 0, rnd(0, 3), 0, rnd(0.18, 0.24), 0.08, rnd(0.2, 0.28)));
  }

  // team base mats
  for (const [z, col] of [[18.5, 0xffb4b0], [-18.5, 0xaccdff]] as const) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(3.2, 40), std(col, { tex: 'fabric', rx: 4, transparent: true, opacity: T.night ? 0.4 : 0.55, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0.025, z);
    m.receiveShadow = true;
    scene.add(m);
  }

  // ---------------------------------------------------------------- gable roof helper
  const gable = (g: THREE.Group, w: number, d: number, h: number, rh: number, roofC: number, wallC: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(0, rh); shape.closePath();
    const tri = sh(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }), std(wallC, { tex: 'plaster' })));
    tri.position.set(0, h, -d / 2);
    g.add(tri);
    const ov = 0.35;
    const ang = Math.atan2(rh, w / 2);
    const len = Math.hypot(w / 2, rh) + ov;
    const roofMat = std(roofC, { tex: 'shingle', rx: 3, ry: 2, bump: 1.5 });
    for (const s of [-1, 1]) {
      const p = sh(new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, d + 0.6), roofMat));
      p.rotation.z = -s * ang;
      p.position.set(s * (w / 4 + Math.cos(ang) * ov / 2 - 0.02), h + rh / 2 - Math.sin(ang) * ov / 2 + 0.1, 0);
      g.add(p);
      if (T.snowy) {
        const sn = sh(new THREE.Mesh(new THREE.BoxGeometry(len * 0.92, 0.14, d + 0.5), snowMat));
        sn.rotation.z = -s * ang;
        sn.position.copy(p.position);
        sn.position.x += s * Math.sin(ang) * 0.12;
        sn.position.y += Math.cos(ang) * 0.13;
        g.add(sn);
      }
    }
    const ridge = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, d + 0.7, 10), std(roofC, { tex: 'soft' })));
    ridge.rotation.x = Math.PI / 2;
    ridge.position.y = h + rh + 0.13;
    g.add(ridge);
  };

  const flowerAt = (b: Batch, x: number, y: number, z: number, col: number, s = 1, parent?: THREE.Matrix4) => {
    b.add(G.cyl, 0x4f9a3f, xf(x, y + 0.12 * s, z, 0, 0, 0, 0.018 * s, 0.24 * s, 0.018 * s), parent);
    b.add(G.sphLo, 0x5fae48, xf(x + 0.05 * s, y + 0.07 * s, z, 0, 0, 0.6, 0.06 * s, 0.02 * s, 0.035 * s), parent);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      b.add(G.sphLo, col, xf(x + Math.cos(a) * 0.055 * s, y + 0.25 * s, z + Math.sin(a) * 0.055 * s, 0, 0, 0, 0.05 * s, 0.025 * s, 0.05 * s), parent);
    }
    b.add(G.sphLo, 0xffe066, xf(x, y + 0.26 * s, z, 0, 0, 0, 0.032 * s), parent);
  };
  const flowerCols = [0xff7eb3, 0xffe05c, 0xffffff, 0xff9f5a, 0xb48cff, 0xff5d6c];
  const pickCol = () => flowerCols[Math.floor(Math.random() * flowerCols.length)];

  // ---------------------------------------------------------------- houses
  const house = (x: number, z: number, w: number, d: number, h: number, wallC: number, roofC: number) => {
    const g = new THREE.Group();
    const found = sh(new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, 0.3, d + 0.25), stoneMat));
    found.position.y = 0.15;
    g.add(found);
    const wall = sh(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(wallC, { tex: 'siding', rx: 2, ry: 2, bump: 0.8 })));
    wall.position.y = h / 2 + 0.2;
    g.add(wall);
    // corner trims
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const tr = sh(new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.16), std(0xffffff, { tex: 'wood' })));
      tr.position.set(sx * w / 2, h / 2 + 0.2, sz * d / 2);
      g.add(tr);
    }
    gable(g, w + 0.02, d + 0.02, h + 0.2, 1.6, roofC, wallC);
    const fz = d / 2;
    // door with frame, knob, awning, step
    const frame = sh(new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.75, 0.08), std(0xffffff, { tex: 'wood' })), false);
    frame.position.set(0, 1.07, fz + 0.03);
    g.add(frame);
    const door = sh(new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.58, 0.1), std(0x8a5530, { tex: 'wood', bump: 0.8 })), false);
    door.position.set(0, 1.0, fz + 0.06);
    g.add(door);
    const doorWin = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), winMat);
    doorWin.position.set(0, 1.42, fz + 0.115);
    g.add(doorWin);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), std(0xffd24a, { rough: 0.25 }));
    knob.position.set(0.3, 0.95, fz + 0.14);
    g.add(knob);
    const awn = sh(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.55), std(roofC, { tex: 'shingle', rx: 2 })));
    awn.position.set(0, 2.05, fz + 0.28);
    awn.rotation.x = 0.25;
    g.add(awn);
    const step = sh(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 0.5), stoneMat));
    step.position.set(0, 0.08, fz + 0.35);
    g.add(step);
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), std(0xd9534f, { tex: 'fabric', rx: 2 }));
    mat.rotation.x = -Math.PI / 2;
    mat.position.set(0, 0.17, fz + 0.4);
    g.add(mat);
    // windows with frame, cross, shutters & flower box
    for (const s of [-1, 1]) {
      const wx = s * w * 0.3, wy = h * 0.58 + 0.2;
      const wf = sh(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.08), std(0xffffff, { tex: 'wood' })), false);
      wf.position.set(wx, wy, fz + 0.03);
      g.add(wf);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.62), winMat);
      glass.position.set(wx, wy, fz + 0.075);
      g.add(glass);
      const cv = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.03), std(0xffffff));
      cv.position.set(wx, wy, fz + 0.09);
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.05, 0.03), std(0xffffff));
      ch.position.set(wx, wy, fz + 0.09);
      g.add(cv, ch);
      for (const t of [-1, 1]) {
        const sht = sh(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.82, 0.06), std(roofC, { tex: 'wood' })), false);
        sht.position.set(wx + t * 0.6, wy, fz + 0.04);
        g.add(sht);
      }
      const bx = sh(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.2, 0.26), woodLight), false);
      bx.position.set(wx, wy - 0.5, fz + 0.14);
      g.add(bx);
    }
    // chimney
    const chim = sh(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.5), std(0xb0644f, { tex: 'cobble', rx: 1, bump: 1 })));
    chim.position.set(w * 0.25, h + 1.35, -d * 0.15);
    g.add(chim);
    const smoke = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), std(0xffffff, { kind: 'world', transparent: true, opacity: 0.6 }));
      s.userData.o = i / 3;
      smoke.add(s);
    }
    smoke.position.set(w * 0.25, h + 2.1, -d * 0.15);
    g.add(smoke);
    animated.push({ obj: smoke, kind: 'smoke' });
    // mailbox
    const post = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), woodMat));
    post.position.set(w / 2 - 0.2, 0.45, fz + 0.9);
    g.add(post);
    const box = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.26, 4, 10), std(roofC, { rough: 0.4 })));
    box.rotation.x = Math.PI / 2;
    box.position.set(w / 2 - 0.2, 0.98, fz + 0.9);
    g.add(box);
    g.position.set(x, 0, z);
    g.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(g);
    // flowers in window boxes / snow drift (world space via group matrix)
    g.updateMatrixWorld(true);
    for (const s of [-1, 1]) {
      const wx = s * w * 0.3, wy = h * 0.58 + 0.2;
      if (T.snowy) snowB.add(G.half, 0xffffff, xf(wx, wy - 0.4, fz + 0.14, 0, 0, 0, 0.45, 0.12, 0.13), g.matrixWorld);
      else for (let k = 0; k < 4; k++) flowerAt(flatB, wx - 0.33 + k * 0.22, wy - 0.42, fz + 0.14, pickCol(), 0.8, g.matrixWorld);
    }
    if (T.snowy) snowB.add(G.half, 0xffffff, xf(-w * 0.25, 0, fz + 0.2, 0, 0, 0, w * 0.35, 0.3, 0.5), g.matrixWorld);
    else if (T.flowers) for (let k = 0; k < 3; k++) leafB.add(G.sph, T.leaf[k % 3], xf(-w / 2 + 0.4 + k * 0.32, 0.22, fz + 0.4, 0, 0, 0, 0.24, 0.22, 0.22), g.matrixWorld);
    addBox(x, z, d / 2, w / 2, h + 1.5);
  };
  sym((x, z) => house(x, z, 4.4, 4.2, 3.0, T.wallA, T.roofA), -11, -3.5);
  sym((x, z) => house(x, z, 4.0, 4.0, 2.6, T.wallB, T.roofB), -11, 3.3);

  // ---------------------------------------------------------------- log cabin
  const cabin = (x: number, z: number) => {
    const g = new THREE.Group();
    const logMat = std(0x9a6a40, { tex: 'bark', bump: 0.8 });
    const endMat = std(0xe0b07a, { tex: 'wood' });
    const core = sh(new THREE.Mesh(new THREE.BoxGeometry(3.1, 2.1, 2.5), std(0x8a5a33, { tex: 'wood', rx: 2 })));
    core.position.y = 1.05;
    g.add(core);
    for (let i = 0; i < 5; i++) {
      for (const zz of [-1.3, 1.3]) {
        const log = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.5, 12), logMat));
        log.rotation.z = Math.PI / 2;
        log.position.set(0, 0.22 + i * 0.42, zz);
        g.add(log);
        for (const xx of [-1.75, 1.75]) {
          const end = new THREE.Mesh(new THREE.CircleGeometry(0.2, 14), endMat);
          end.position.set(xx + Math.sign(xx) * 0.005, 0.22 + i * 0.42, zz);
          end.rotation.y = Math.sign(xx) * Math.PI / 2;
          g.add(end);
        }
      }
    }
    gable(g, 3.3, 2.7, 2.1, 1.3, T.snowy ? 0x7a5a3a : 0x6b4a2e, 0x8a5a33);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.6), winMat);
    win.position.set(1.56, 1.3, 0);
    win.rotation.y = Math.PI / 2;
    g.add(win);
    const door = sh(new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.8), std(0x6b4423, { tex: 'wood' })), false);
    door.position.set(-1.56, 0.75, 0);
    g.add(door);
    g.position.set(x, 0, z);
    scene.add(g);
    addBox(x, z, 1.8, 1.55, 3.5);
  };
  // pulled 0.5m inward: the corridor behind it (to the map edge) is now wide enough to run through
  sym(cabin, -11.0, 12.8);

  // ---------------------------------------------------------------- trees (batched)
  const leafCol = () => T.leaf[Math.floor(Math.random() * T.leaf.length)];
  const tree = (x: number, z: number, s = 1) => {
    const M = xf(x, 0, z, 0, Math.random() * 6, 0, s);
    if (T.tree === 'pine') {
      trunkB.add(G.cylTaper, 0x8a6040, xf(0, 0.55, 0, 0, 0, 0, 0.22, 1.1, 0.22), M);
      for (let i = 0; i < 4; i++) {
        const r = 1.35 - i * 0.28, y = 1.2 + i * 0.72;
        leafB.add(G.cone, leafCol(), xf(0, y, 0, 0, i, 0, r, 1.25, r), M);
        if (T.snowy) snowB.add(G.cone, 0xffffff, xf(0, y + 0.3, 0, 0, i, 0, r * 0.72, 0.62, r * 0.72), M);
      }
    } else if (T.tree === 'round') {
      trunkB.add(G.cylTaper, 0x9a6a44, xf(0, 0.7, 0, 0, 0, 0, 0.2, 1.4, 0.2), M);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        trunkB.add(G.sphLo, 0x8a5a38, xf(Math.cos(a) * 0.2, 0.05, Math.sin(a) * 0.2, 0, 0, 0, 0.14, 0.12, 0.14), M);
      }
      leafB.add(G.sph, leafCol(), xf(0, 2.15, 0, 0, 0, 0, 1.15, 1.05, 1.15), M);
      const puffs: [number, number, number, number][] = [[0.7, 1.85, 0.3, 0.72], [-0.65, 1.8, -0.35, 0.7], [0.1, 2.0, 0.75, 0.68], [-0.2, 1.95, -0.75, 0.66], [0.25, 2.85, 0.1, 0.6]];
      for (const [px, py, pz, r] of puffs) leafB.add(G.sph, leafCol(), xf(px, py, pz, 0, 0, 0, r), M);
      if (T.fruit !== null && Math.random() < 0.8) {
        for (let k = 0; k < 5; k++) {
          const a = Math.random() * Math.PI * 2, e = rnd(-0.3, 0.6);
          flatB.add(G.sph, T.fruit, xf(Math.cos(a) * 1.08 * Math.cos(e), 2.15 + Math.sin(e) * 1.0, Math.sin(a) * 1.08 * Math.cos(e), 0, 0, 0, 0.11), M);
        }
      }
    } else {
      for (let i = 0; i < 6; i++) trunkB.add(G.cylTaper, i % 2 ? 0xb08a5a : 0xa07a4a, xf(i * 0.07, 0.3 + i * 0.58, 0, 0, 0, -0.1, 0.17 - i * 0.01, 0.6, 0.17 - i * 0.01), M);
      const top = [0.42, 3.6, 0];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const fm = new THREE.Matrix4().multiplyMatrices(xf(top[0], top[1], top[2], 0, a, 0), xf(0, 0, 0, 0.5, 0, 0));
        leafB.add(G.sph, leafCol(), xf(0, -0.05, 0.75, 0.15, 0, 0, 0.32, 0.07, 0.9), new THREE.Matrix4().multiplyMatrices(M, fm));
        leafB.add(G.sph, leafCol(), xf(0, -0.45, 1.55, 0.6, 0, 0, 0.26, 0.06, 0.6), new THREE.Matrix4().multiplyMatrices(M, fm));
      }
      for (let i = 0; i < 3; i++) flatB.add(G.sph, 0x7a4a26, xf(top[0] + Math.cos(i * 2.1) * 0.18, top[1] - 0.22, Math.sin(i * 2.1) * 0.18, 0, 0, 0, 0.15), M);
    }
  };
  // layout pass for AI flow:
  //  - removed (-5.5,9.5): it formed a sealed diagonal wall with (-4.5,8.5) and the rock, and a 0.9m slot with a crate
  //  - removed (-13.2,18.8): overlapped its neighbour and turned the map corner into a dead-end pocket
  const trees: [number, number][] = [[7, 12.5], [-13, -17.5], [4.5, -8.5], [13, -18], [2.8, 15.8]];
  for (const [x, z] of trees) sym((xx, zz) => { tree(xx, zz); addCircle(xx, zz, T.tree === 'palm' ? 0.4 : 0.55, 5); }, x, z);
  for (let i = 0; i < 54; i++) {
    const side = i % 4;
    let x = 0, z = 0;
    if (side === 0 || (side === 1 && T.sea)) { x = -17.5 - Math.random() * 13; z = (Math.random() - 0.5) * 64; }
    else if (side === 1) { x = 17.5 + Math.random() * 13; z = (Math.random() - 0.5) * 64; }
    else { x = (Math.random() - 0.5) * 42; z = (side === 2 ? -1 : 1) * (23.5 + Math.random() * 14); if (T.sea && x > 15) x -= 22; }
    tree(x, z, 1.05 + Math.random() * 0.6);
  }

  // ---------------------------------------------------------------- fountain
  {
    const g = new THREE.Group();
    const basin = sh(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.8, 36), stoneMat));
    basin.position.y = 0.4;
    g.add(basin);
    const rim = sh(new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.16, 10, 48), stoneMat));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.82;
    g.add(rim);
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.0, 36), std(T.water, { tex: 'water', rx: 2, rough: 0.05, transparent: true, opacity: 0.88, emissive: T.snowy ? 0x3a6a88 : 0x1a5a7a, emissiveIntensity: 0.35 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.74;
    g.add(water);
    const pillar = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 1.6, 16), stoneMat));
    pillar.position.y = 1.2;
    g.add(pillar);
    const bowl = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.35, 0.38, 24), stoneMat));
    bowl.position.y = 2.0;
    g.add(bowl);
    const bw = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), water.material);
    bw.rotation.x = -Math.PI / 2;
    bw.position.y = 2.17;
    g.add(bw);
    const orb = sh(new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), stoneMat));
    orb.position.y = 2.35;
    g.add(orb);
    if (T.snowy) snowB.add(G.half, 0xffffff, xf(0, 2.2, 0, 0, 0, 0, 0.8, 0.22, 0.8));
    const jet = new THREE.Group();
    const dm = std(0xd8f4ff, { kind: 'world', emissive: 0x3a8ab0, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 12; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), dm);
      d.userData.a = (i / 12) * Math.PI * 2;
      jet.add(d);
    }
    jet.position.y = 2.25;
    g.add(jet);
    animated.push({ obj: jet, kind: 'water' });
    scene.add(g);
    addCircle(0, 0, 2.3, 1.2);
  }

  // ---------------------------------------------------------------- benches
  const bench = (x: number, z: number) => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const slat = sh(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.07, 0.17), woodLight));
      slat.position.set(0, 0.46, -0.2 + i * 0.2);
      g.add(slat);
    }
    for (let i = 0; i < 2; i++) {
      const b = sh(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.06), woodLight));
      b.position.set(0, 0.72 + i * 0.2, -0.3);
      b.rotation.x = -0.12;
      g.add(b);
    }
    for (const s of [-0.95, 0.95]) {
      const leg = sh(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), std(0x2f3b33, { rough: 0.4 })));
      leg.position.set(s, 0.45, -0.28);
      g.add(leg);
      const leg2 = sh(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.08), std(0x2f3b33, { rough: 0.4 })));
      leg2.position.set(s, 0.23, 0.18);
      g.add(leg2);
    }
    if (T.snowy) snowB.add(G.box, 0xffffff, xf(0, 0.53, 0, 0, 0, 0, 2.05, 0.07, 0.5), xf(x, 0, z, 0, z < 0 ? Math.PI : 0, 0));
    g.position.set(x, 0, z);
    if (z < 0) g.rotation.y = Math.PI;
    scene.add(g);
    addBox(x, z, 1.15, 0.35, 0.9);
  };
  sym(bench, 0, 4.6);
  sym(bench, -6.5, -9.5);

  // ---------------------------------------------------------------- crates
  const crateMat = std(0xd39a58, { tex: 'wood', bump: 0.8 });
  const crateEdge = std(0x8a5a2b, { tex: 'wood' });
  const crate = (x: number, z: number) => {
    const g = new THREE.Group();
    const b = sh(new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), crateMat));
    b.position.y = 0.55;
    g.add(b);
    for (const y of [0.08, 1.02]) {
      const e = sh(new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.14, 1.16), crateEdge), false);
      e.position.y = y;
      g.add(e);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const p = sh(new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), crateEdge), false);
      p.position.set(sx * 0.51, 0.55, sz * 0.51);
      g.add(p);
    }
    const r = (Math.random() - 0.5) * 0.3;
    if (T.snowy) snowB.add(G.half, 0xffffff, xf(0, 1.1, 0, 0, 0, 0, 0.55, 0.14, 0.55), xf(x, 0, z, 0, r, 0));
    g.position.set(x, 0, z);
    g.rotation.y = r;
    scene.add(g);
    addBox(x, z, 0.58, 0.58, 1.15);
  };
  // twin crates now sit flush in a straight line (no concave notch to get wedged in)
  sym(crate, 5, 6);
  sym(crate, 6.16, 6.0);
  // moved away from the cabin / tree so both lanes around it are ≥1.1m
  sym(crate, 7.0, -10.2);
  sym(crate, 10.5, 9.5);

  // ---------------------------------------------------------------- rocks (organic)
  const rockMat = std(T.pile === 'sand' ? 0xc4b194 : 0xa4abb3, { tex: 'stone', bump: 1.2 });
  const rock = (x: number, z: number, r: number) => {
    const geo = new THREE.IcosahedronGeometry(r, 2);
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const k = 1 + Math.sin(vx * 5.1 + vz * 3.3) * 0.08 + Math.cos(vy * 4.7) * 0.06;
      p.setXYZ(i, vx * k, vy * k * 0.72, vz * k);
    }
    geo.computeVertexNormals();
    const m = sh(new THREE.Mesh(geo, rockMat));
    m.position.set(x, r * 0.45, z);
    m.rotation.y = Math.random() * 6;
    scene.add(m);
    if (T.snowy) snowB.add(G.half, 0xffffff, xf(x, r * 0.8, z, 0, 0, 0, r * 0.75, r * 0.3, r * 0.75));
    else if (T.groundTex === 'grass') for (let k = 0; k < 4; k++) { const a = Math.random() * 6; grassB.add(G.cone5, leafCol(), xf(x + Math.cos(a) * r * 0.95, 0.12, z + Math.sin(a) * r * 0.95, 0, a, rnd(-0.3, 0.3), 0.08, 0.3, 0.08)); }
    addCircle(x, z, r * 0.9, r * 1.2);
  };
  // moved out of the lamp / tree chain (was leaving only 0.4~0.9m slots)
  sym((x, z) => rock(x, z, 0.8), -4.4, 5.2);
  sym((x, z) => rock(x, z, 0.6), 11.8, 15.5);
  sym((x, z) => rock(x, z, 0.7), -2, -13.5);

  // ---------------------------------------------------------------- piles (cover): bush / snow / dune
  const pile = (x: number, z: number, r: number, h: number) => {
    if (T.pile === 'bush') {
      leafB.add(G.sph, leafCol(), xf(x, h * 0.45, z, 0, 0, 0, r, h * 0.75, r * 0.8));
      leafB.add(G.sph, leafCol(), xf(x + r * 0.55, h * 0.35, z + 0.2, 0, 0, 0, r * 0.62, h * 0.6, r * 0.55));
      leafB.add(G.sph, leafCol(), xf(x - r * 0.5, h * 0.32, z - 0.15, 0, 0, 0, r * 0.55, h * 0.55, r * 0.5));
      if (T.flowers) for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2, e = rnd(0.2, 0.9);
        flatB.add(G.sph, pickCol(), xf(x + Math.cos(a) * r * 0.9 * Math.cos(e), h * 0.45 + Math.sin(e) * h * 0.72, z + Math.sin(a) * r * 0.72 * Math.cos(e), 0, 0, 0, 0.09));
      }
    } else {
      const col = T.pile === 'snow' ? 0xffffff : 0xf0dcaa;
      const b = T.pile === 'snow' ? snowB : grassB;
      b.add(G.half, col, xf(x, 0, z, 0, 0, 0, r, T.pile === 'sand' ? h * 0.8 : h, r * 0.8));
      b.add(G.half, col, xf(x + r * 0.5, 0, z + 0.2, 0, 0, 0, r * 0.6, h * 0.8, r * 0.5));
      if (T.pile === 'sand') for (let i = 0; i < 3; i++) flatB.add(G.sph, [0xffc2c8, 0xfff0d8, 0xffd0a0][i], xf(x + rnd(-r, r) * 0.8, 0.05, z + r * 0.9 + rnd(0, 0.3), 0, rnd(0, 3), 0, 0.09, 0.04, 0.11));
    }
    addCircle(x, z, r * 0.9, h);
  };
  // shifted so it no longer seals the fenced pen next to the base
  sym((x, z) => pile(x, z, 1.3, 1.1), -5.4, 14.4);
  sym((x, z) => pile(x, z, 1.3, 1.1), 6.5, 16.5);
  sym((x, z) => pile(x, z, 1.2, 1.05), -2.8, 11.5);
  // was fused with the other pile + a house wall into one long barrier → now free-standing cover near the plaza
  sym((x, z) => pile(x, z, 1.3, 1.1), 6.6, -2.6);
  sym((x, z) => pile(x, z, 1.1, 1.0), 3.2, 9.5);
  sym((x, z) => pile(x, z, 1.2, 1.1), -8, 7.5);

  // walkable decor: flower beds / dunes / snow mounds
  for (const [x, z] of [[-3, 18], [9, 19], [12, -12.5], [-12.5, 9], [5, 2]] as [number, number][]) {
    sym((xx, zz) => {
      if (T.snowy || T.pile === 'sand') {
        (T.snowy ? snowB : grassB).add(G.half, T.snowy ? 0xf2f6ff : 0xecd8a4, xf(xx, 0, zz, 0, 0, 0, 1.6, 0.16, 1.3));
      } else {
        const soil = new THREE.Mesh(new THREE.CircleGeometry(1.25, 20), std(0x7a5236, { tex: 'soft' }));
        soil.rotation.x = -Math.PI / 2;
        soil.position.set(xx, 0.03, zz);
        soil.receiveShadow = true;
        scene.add(soil);
        const ringS = sh(new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.1, 6, 28), stoneMat), false, true);
        ringS.rotation.x = -Math.PI / 2;
        ringS.position.set(xx, 0.04, zz);
        scene.add(ringS);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + rnd(-0.1, 0.1), rr = i % 2 ? 0.45 : 0.9;
          flowerAt(flatB, xx + Math.cos(a) * rr, 0.03, zz + Math.sin(a) * rr, pickCol(), 1.1);
        }
      }
    }, x, z);
  }

  // ---------------------------------------------------------------- fences (batched, picket style)
  const fenceB = new Batch();
  const fenceCol = T.night ? 0xd8ccb2 : T.snowy ? 0xb88a5a : 0xfff4de;
  const fence = (x: number, z: number, len: number, alongX: boolean, collide = true) => {
    const M = xf(x, 0, z, 0, alongX ? 0 : Math.PI / 2, 0);
    const n = Math.max(2, Math.round(len / 0.34));
    for (let i = 0; i <= n; i++) {
      const px = -len / 2 + (i * len) / n;
      fenceB.add(G.box, fenceCol, xf(px, 0.42, 0, 0, 0, 0, 0.14, 0.84, 0.05), M);
      fenceB.add(G.cone5, fenceCol, xf(px, 0.9, 0, 0, Math.PI / 4, 0, 0.1, 0.14, 0.05), M);
      if (T.snowy && i % 2 === 0) snowB.add(G.sphLo, 0xffffff, xf(px, 0.86, 0, 0, 0, 0, 0.1, 0.06, 0.07), M);
    }
    for (const y of [0.28, 0.64]) fenceB.add(G.box, fenceCol, xf(0, y, -0.04, 0, 0, 0, len, 0.08, 0.04), M);
    if (collide) {
      if (alongX) addBox(x, z, len / 2, 0.12, 0.95);
      else addBox(x, z, 0.12, len / 2, 0.95);
    }
  };
  // shorter free-standing fence near the base (was one side of a closed pen)
  sym((x, z) => fence(x, z, 2.4, true), -8.8, 16.8);
  // detached from the house corner: no more L-shaped pocket
  sym((x, z) => fence(x, z, 2.2, false), 12.8, 8.0);
  // removed the fence that was glued to the cabin (it closed the pen together with the pile)
  fence(0, BOUNDS.maxZ + 0.3, 30.6, true, false);
  fence(0, BOUNDS.minZ - 0.3, 30.6, true, false);
  fence(BOUNDS.minX - 0.3, 0, 42.6, false, false);
  fence(BOUNDS.maxX + 0.3, 0, 42.6, false, false);
  fenceB.build(scene, std(0xffffff, { tex: 'wood', vertexColors: true }), true, true, T.night ? 0x3a3448 : 0x7a6258);

  // ---------------------------------------------------------------- lamps
  const lampMat = std(0x2d4a3e, { rough: 0.35 });
  const glowMat = std(0xfff2c0, { emissive: 0xffd27a, emissiveIntensity: T.night ? 2.2 : 0.6, rough: 0.1 });
  const lamp = (x: number, z: number) => {
    const g = new THREE.Group();
    const baseM = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 12), lampMat));
    baseM.position.y = 0.15;
    g.add(baseM);
    const p = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 10), lampMat));
    p.position.y = 1.4;
    g.add(p);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.36, 6), glowMat);
    glass.position.y = 2.75;
    g.add(glass);
    const cap = sh(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.26, 6), lampMat));
    cap.position.y = 3.06;
    g.add(cap);
    const bot = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.08, 6), lampMat));
    bot.position.y = 2.55;
    g.add(bot);
    if (T.snowy) snowB.add(G.half, 0xffffff, xf(x, 3.16, z, 0, 0, 0, 0.24, 0.1, 0.24));
    g.position.set(x, 0, z);
    scene.add(g);
    addCircle(x, z, 0.15, 3);
    lampPositions.push(new THREE.Vector3(x, 2.75, z));
  };
  sym(lamp, 2.1, 6.5);
  sym(lamp, -2.1, 6.5);

  // ---------------------------------------------------------------- sea / pier / boat / umbrellas
  if (T.sea) {
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(60, 130), std(T.water, { tex: 'water', rx: 12, ry: 26, rough: 0.08, transparent: true, opacity: 0.92, emissive: T.night ? 0x0a1a3a : 0x0a4a66, emissiveIntensity: 0.4 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(47, 0, 0);
    sea.receiveShadow = true;
    scene.add(sea);
    animated.push({ obj: sea, kind: 'sea' });
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 130), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, map: tex('water', 1, 30) }));
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(16.9, 0.03, 0);
    scene.add(foam);
    animated.push({ obj: foam, kind: 'foam' });
    const pier = new THREE.Group();
    const deck = sh(new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.16, 2.4), std(0xa0703f, { tex: 'wood', rx: 3, bump: 0.8 })));
    deck.position.y = 0.75;
    pier.add(deck);
    for (const px of [-3.8, 0, 3.8]) for (const pz of [-1.1, 1.1]) {
      const post = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 10), std(0x7a5230, { tex: 'bark' })));
      post.position.set(px, 0.55, pz);
      pier.add(post);
      if (T.night) {
        const lt = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), glowMat);
        lt.position.set(px, 1.55, pz);
        pier.add(lt);
      }
    }
    pier.position.set(19.8, 0, 0);
    scene.add(pier);
    const boat = new THREE.Group();
    const hull = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.6, 6, 12), std(T.night ? 0x8a3a3a : 0xe05a4a, { tex: 'wood' })));
    hull.rotation.z = Math.PI / 2;
    hull.scale.set(0.7, 1, 1);
    hull.position.y = 0.2;
    boat.add(hull);
    const mast = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), woodMat));
    mast.position.y = 1.5;
    boat.add(mast);
    const sail = sh(new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.4, 1.0), std(0xfff7e0, { tex: 'fabric', rx: 2 })), true, false);
    sail.position.set(0, 1.7, 0.5);
    boat.add(sail);
    boat.position.set(21, 0, 5.5);
    boat.rotation.y = 0.4;
    scene.add(boat);
    if (!T.night) {
      for (const [ux, uz, col] of [[13.6, 12.6, 0xff7a7a], [13.6, -9.2, 0x4fb3bf]] as [number, number, number][]) {
        const g = new THREE.Group();
        const pole = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), std(0xffffff, { rough: 0.4 })));
        pole.position.y = 1.1;
        g.add(pole);
        const canopy = sh(new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.5, 12), std(col, { tex: 'stripe', rx: 4 })));
        canopy.position.y = 2.2;
        g.add(canopy);
        const towel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 1.6), std(0xffe07a, { tex: 'stripe', rx: 2 }));
        towel.position.set(0.9, 0.03, 0.4);
        towel.receiveShadow = true;
        g.add(towel);
        g.position.set(ux, 0, uz);
        scene.add(g);
        addCircle(ux, uz, 0.15, 3);
      }
    }
  }

  // ---------------------------------------------------------------- snowmen + ice ponds
  if (T.snowmen) {
    for (const [sx, sz] of [[-3, 18], [3, -18]] as [number, number][]) {
      const g = new THREE.Group();
      const sizes = [0.55, 0.42, 0.3];
      let y = 0;
      sizes.forEach((r, i) => {
        y += i === 0 ? r : sizes[i - 1] * 0.8 + r * 0.6;
        const b = sh(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), snowMat));
        b.position.y = y;
        g.add(b);
      });
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 10), std(0xff8a2a));
      nose.rotation.x = Math.PI / 2;
      nose.position.set(0, y, 0.32);
      g.add(nose);
      for (const s of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), std(0x222222, { rough: 0.2 }));
        e.position.set(s * 0.1, y + 0.08, 0.27);
        g.add(e);
        const arm = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), std(0x5a3a1c, { tex: 'bark' })));
        arm.position.set(s * 0.6, y - 0.6, 0);
        arm.rotation.z = s * 1.2;
        g.add(arm);
      }
      const hat = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.28, 16), std(0x333333, { rough: 0.5 })));
      hat.position.y = y + 0.3;
      g.add(hat);
      const brim = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 16), std(0x333333, { rough: 0.5 })));
      brim.position.y = y + 0.17;
      g.add(brim);
      const scarf = sh(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 20), std(0xe8413c, { tex: 'stripe', rx: 4 })));
      scarf.rotation.x = Math.PI / 2;
      scarf.position.y = y - 0.3;
      g.add(scarf);
      g.position.set(sx, 0, sz);
      g.rotation.y = sz > 0 ? Math.PI : 0;
      scene.add(g);
      addCircle(sx, sz, 0.6, 2);
    }
    for (const [px, pz] of [[10.5, -10.5], [-10.5, 10.5]] as [number, number][]) {
      const pond = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), std(0xd6f2ff, { tex: 'water', rough: 0.05, emissive: 0x2a4a66, emissiveIntensity: 0.3 }));
      pond.rotation.x = -Math.PI / 2;
      pond.position.set(px, 0.03, pz);
      pond.receiveShadow = true;
      scene.add(pond);
      snowB.add(new THREE.TorusGeometry(2.3, 0.22, 8, 32), 0xf2f6ff, xf(px, 0.02, pz, -Math.PI / 2, 0, 0, 1, 1, 0.4));
    }
  }

  // ---------------------------------------------------------------- grass tufts / flowers / pebbles scattered
  const freeSpot = (x: number, z: number, pad: number) => !(Math.abs(x) < 1.5 || Math.hypot(x, z) < 5.6 || Math.hypot(x, Math.abs(z) - 18.5) < 3.3 || pointBlocked(colliders, x, z, pad));
  if (T.groundTex === 'grass') {
    let placed = 0;
    for (let tries = 0; tries < 1400 && placed < 420; tries++) {
      const x = rnd(-15, 15), z = rnd(-21, 21);
      if (!freeSpot(x, z, 0.3)) continue;
      const c = leafCol();
      for (let k = 0; k < 3; k++) grassB.add(G.cone5, c, xf(x + rnd(-0.08, 0.08), 0.1, z + rnd(-0.08, 0.08), rnd(-0.35, 0.35), rnd(0, 6), rnd(-0.35, 0.35), 0.045, rnd(0.18, 0.3), 0.045));
      placed++;
    }
    if (T.flowers) {
      let fl = 0;
      for (let tries = 0; tries < 400 && fl < 40; tries++) {
        const x = rnd(-14, 14), z = rnd(-20, 20);
        if (!freeSpot(x, z, 0.6)) continue;
        const col = pickCol();
        for (let i = 0; i < 4; i++) flowerAt(flatB, x + rnd(-0.4, 0.4), 0, z + rnd(-0.4, 0.4), col, rnd(0.9, 1.2));
        fl++;
      }
    }
  } else if (T.groundTex === 'sand') {
    for (let i = 0; i < 90; i++) {
      const x = rnd(-15, 15), z = rnd(-21, 21);
      if (!freeSpot(x, z, 0.3)) continue;
      flatB.add(G.sphLo, [0xffc2c8, 0xfff0d8, 0xc9b8a0, 0xffd0a0][i % 4], xf(x, 0.03, z, 0, rnd(0, 3), 0, rnd(0.06, 0.12), 0.04, rnd(0.06, 0.12)));
    }
    for (let i = 0; i < 60; i++) {
      const x = rnd(-15, 12), z = rnd(-21, 21);
      if (!freeSpot(x, z, 0.3)) continue;
      for (let k = 0; k < 3; k++) grassB.add(G.cone5, 0x8fbf5a, xf(x + rnd(-0.1, 0.1), 0.12, z + rnd(-0.1, 0.1), rnd(-0.4, 0.4), rnd(0, 6), rnd(-0.4, 0.4), 0.035, 0.32, 0.035));
    }
  } else {
    for (let i = 0; i < 120; i++) {
      const x = rnd(-15, 15), z = rnd(-21, 21);
      if (!freeSpot(x, z, 0.3)) continue;
      snowB.add(G.half, 0xffffff, xf(x, 0, z, 0, 0, 0, rnd(0.15, 0.35), rnd(0.06, 0.12), rnd(0.15, 0.35)));
    }
  }

  // ---------------------------------------------------------------- sky: clouds / night stars & moon
  if (!T.night) {
    const cm = std(0xffffff, { rough: 1, emissive: 0xffffff, emissiveIntensity: 0.35 });
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Group();
      const n = 4 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const s = new THREE.Mesh(G.sph, cm);
        const r = rnd(1.2, 2.2);
        s.scale.set(r, r * 0.75, r);
        s.position.set((k - n / 2) * 1.6 + rnd(-0.3, 0.3), rnd(-0.3, 0.5), rnd(-0.8, 0.8));
        c.add(s);
      }
      const a = (i / 9) * Math.PI * 2;
      c.position.set(Math.cos(a) * rnd(32, 46), rnd(16, 24), Math.sin(a) * rnd(34, 50));
      c.userData.speed = rnd(0.2, 0.5);
      scene.add(c);
      animated.push({ obj: c, kind: 'cloud' });
    }
  } else {
    const N = 600;
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2, ph = 0.05 + Math.random() * 1.2, r = 85;
      arr[i * 3] = r * Math.sin(ph) * Math.cos(th);
      arr[i * 3 + 1] = r * Math.cos(ph);
      arr[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, fog: false, transparent: true, opacity: 0.9 })));
    const moon = new THREE.Mesh(new THREE.SphereGeometry(3.5, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }));
    moon.position.set(-40, 42, -55);
    scene.add(moon);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.12, fog: false, depthWrite: false }));
    halo.position.copy(moon.position);
    scene.add(halo);
  }

  // build batches
  // colored line art per material family (Genshin-style: lines are a darker shade of the surface, never pure black)
  trunkB.build(scene, barkMat, true, true, T.night ? 0x1e1626 : 0x3e2a22);
  leafB.build(scene, leafMat, true, true, T.night ? 0x0f2622 : T.snowy ? 0x1c3a30 : 0x24502e);
  flatB.build(scene, flatMat, true, false, false);
  // grass tufts / dune grass wave in the wind; no outlines keeps the meadow soft and painterly
  grassB.build(scene, std(0xffffff, { tex: T.groundTex === 'sand' ? 'sand' : 'soft', vertexColors: true, kind: 'leaf', wind: 0.38, windBase: 0.0, rim: 0.12 }), false, true, false);
  snowB.build(scene, std(0xffffff, { tex: 'snow', rx: 2, vertexColors: true, shadow: 0xa8c0f0, step: 0.42 }), true, true, 0x8a9cc4);

  // cel outlines on solid world props (skip ground / water / particles)
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    // huge ground / sea planes — no outline
    // large un-tagged meshes (terrain) get no line art; batches opt in via outlineColor
    if (m.userData.outlineColor === undefined && (m.geometry.type === 'PlaneGeometry' || m.geometry.type === 'BufferGeometry')) {
      const pos = m.geometry.attributes.position;
      if (pos && pos.count > 2000) m.userData.noOutline = true;
    }
    if (m.material && (m.material as THREE.Material).transparent) m.userData.noOutline = true;
  });
  addWorldOutlines(scene, T.night ? 0x0a1020 : 0x1c2030);

  // ---------------------------------------------------------------- spawn / start points
  const sp: [number, number][] = [
    [-4.5, 14], [4.5, 14.5], [0, 13], [-8.5, 13.5], [8.5, 14], [-1.5, 9], [4.5, 11],
    [-6, 5.5], [6.5, 8.5], [-3, 3], [3, -1.5], [8, 1.2], [-12, 8.3], [12.5, 11.8], [0, 16.8],
    [-4.8, 18.5], [4.2, 19],
  ];
  const spawnPoints: THREE.Vector2[] = [];
  for (const [x, z] of sp) spawnPoints.push(new THREE.Vector2(x, z), new THREE.Vector2(-x, -z));
  const ip: [number, number][] = [[-6, 0.3], [6, -0.3], [0, 8.8], [0, -8.8], [-9, -9], [9, 9], [-12, 9.8], [12, -9.8], [-4.5, -13], [4.5, 13], [13.8, 9], [-13.8, -9]];
  const itemPoints = ip.map(([x, z]) => new THREE.Vector2(x, z)).filter((p) => !pointBlocked(colliders, p.x, p.y, 0.7));
  const startRed = [new THREE.Vector2(-4.5, 17.8), new THREE.Vector2(0, 19), new THREE.Vector2(4.5, 17.8)];
  const startBlue = startRed.map((v) => new THREE.Vector2(-v.x, -v.y));
  const startTagger = new THREE.Vector2(-3.6, 0);
  const startRunners = [new THREE.Vector2(-8, 18.5), new THREE.Vector2(8, 18.5), new THREE.Vector2(-8, -18.5), new THREE.Vector2(8, -18.5), new THREE.Vector2(13.5, -0.5)];

  return { colliders, spawnPoints, itemPoints, startRed, startBlue, startTagger, startRunners, animated, lampPositions };
}

// ---- collision helpers
export function pointBlocked(colliders: Collider[], x: number, z: number, pad: number, y = 0): boolean {
  if (x < BOUNDS.minX + pad || x > BOUNDS.maxX - pad || z < BOUNDS.minZ + pad || z > BOUNDS.maxZ - pad) return true;
  for (const c of colliders) {
    if (y > c.h) continue;
    if (c.type === 'box') {
      if (Math.abs(x - c.x) < c.hw + pad && Math.abs(z - c.z) < c.hd + pad) return true;
    } else {
      const dx = x - c.x, dz = z - c.z;
      if (dx * dx + dz * dz < (c.r + pad) * (c.r + pad)) return true;
    }
  }
  return false;
}

export function resolveCircle(colliders: Collider[], p: THREE.Vector3, r: number) {
  for (const c of colliders) {
    if (c.type === 'box') {
      const cx = Math.max(c.x - c.hw, Math.min(p.x, c.x + c.hw));
      const cz = Math.max(c.z - c.hd, Math.min(p.z, c.z + c.hd));
      const dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * r;
          p.z = cz + (dz / d) * r;
        } else {
          const px = c.hw - Math.abs(p.x - c.x) + r;
          const pz = c.hd - Math.abs(p.z - c.z) + r;
          if (px < pz) p.x += Math.sign(p.x - c.x || 1) * px;
          else p.z += Math.sign(p.z - c.z || 1) * pz;
        }
      }
    } else {
      const dx = p.x - c.x, dz = p.z - c.z;
      const d2 = dx * dx + dz * dz;
      const rr = c.r + r;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 0.001;
        p.x = c.x + (dx / d) * rr;
        p.z = c.z + (dz / d) * rr;
      }
    }
  }
  p.x = Math.max(BOUNDS.minX + r, Math.min(BOUNDS.maxX - r, p.x));
  p.z = Math.max(BOUNDS.minZ + r, Math.min(BOUNDS.maxZ - r, p.z));
}

export function lineOfSight(colliders: Collider[], ax: number, az: number, bx: number, bz: number, y = 1.15): boolean {
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  const steps = Math.ceil(len / 0.5);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointBlocked(colliders, ax + dx * t, az + dz * t, 0.05, y)) return false;
  }
  return true;
}
