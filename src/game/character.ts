import * as THREE from 'three';
import type { Animal, Team } from './types';
import { blobShadowTex, std, type TexName } from './textures';
import { addCharOutlines } from './toon';
import { bottomStyle, buildGlasses, buildHat, topStyle } from './costumes';
import type { Outfit } from './types';

export interface CharModel {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  eyes: THREE.Mesh[];
  handBag: THREE.Group;
  stars: THREE.Group;
  moto: THREE.Group;
  jellyBlob: THREE.Mesh;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  ufoBeam: THREE.Group;
  ice: THREE.Group;
  taggerMark: THREE.Group;
  setTeam: (team: Team) => void;
}

// ---------------------------------------------------------------- caches
const geoCache: Record<string, THREE.BufferGeometry> = {};
function sphere(r: number, w = 28, h = 20) {
  const k = `s${r}_${w}_${h}`;
  return (geoCache[k] ??= new THREE.SphereGeometry(r, w, h));
}
function capsule(r: number, len: number) {
  const k = `cap${r}_${len}`;
  return (geoCache[k] ??= new THREE.CapsuleGeometry(r, len, 6, 14));
}
function cyl(rt: number, rb: number, h: number, s = 16) {
  const k = `c${rt}_${rb}_${h}_${s}`;
  return (geoCache[k] ??= new THREE.CylinderGeometry(rt, rb, h, s));
}
function cone(r: number, h: number, s = 16) {
  const k = `k${r}_${h}_${s}`;
  return (geoCache[k] ??= new THREE.ConeGeometry(r, h, s));
}
function half(r: number) {
  const k = `h${r}`;
  return (geoCache[k] ??= new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2));
}

/** Backwards compatible helper — now a soft textured PBR material. */
export function lam(color: number, opts: { emissive?: number; transparent?: boolean; opacity?: number } = {}) {
  return std(color, { tex: 'soft', ...opts });
}

export const TEAM_COLORS: Record<Team, { main: number; dark: number }> = {
  red: { main: 0xef5a4f, dark: 0xb33a34 },
  blue: { main: 0x4a8ff0, dark: 0x2c5fb3 },
};

interface Palette { fur: number; face: number; accent: number; inner: number; shoe: number; pattern: TexName }
const PAL: Record<Animal, Palette> = {
  dog: { fur: 0xf0cf9a, face: 0xfff6e6, accent: 0xa8733f, inner: 0xe8b98a, shoe: 0x6b4a33, pattern: 'stripe' },
  cat: { fur: 0xf6ae63, face: 0xfff1de, accent: 0xd97d33, inner: 0xffb9c4, shoe: 0x7a4d8f, pattern: 'dots' },
  rabbit: { fur: 0xfbf8f5, face: 0xffffff, accent: 0xf2d7d0, inner: 0xffb6c8, shoe: 0xe0708e, pattern: 'dots' },
  bear: { fur: 0xa8763f, face: 0xefd2a6, accent: 0x6b4522, inner: 0x7a5230, shoe: 0x4a3a2c, pattern: 'fabric' },
  fox: { fur: 0xf0873a, face: 0xfff8ee, accent: 0x3b2a22, inner: 0xffd9c0, shoe: 0x3b2a22, pattern: 'stripe' },
  penguin: { fur: 0x34466b, face: 0xffffff, accent: 0xffb13b, inner: 0xffffff, shoe: 0xffa41f, pattern: 'fabric' },
  deer: { fur: 0xcc955a, face: 0xf8e8d2, accent: 0x7a5230, inner: 0xf6c8a8, shoe: 0x5a3f2a, pattern: 'fabric' },
  hamster: { fur: 0xf6c56e, face: 0xfff4de, accent: 0xd8913a, inner: 0xffc2cf, shoe: 0xd35b6b, pattern: 'dots' },
  tanuki: { fur: 0x9c8872, face: 0xf5e8d4, accent: 0x3e3129, inner: 0x5a4a3c, shoe: 0x3e3129, pattern: 'fabric' },
  panda: { fur: 0xfbfbfb, face: 0xffffff, accent: 0x26262b, inner: 0x26262b, shoe: 0x26262b, pattern: 'stripe' },
};

// muzzle sizes (0 = no muzzle)
const MUZZLE: Record<Animal, [number, number, number]> = {
  dog: [1.1, 0.95, 1.05], cat: [0.82, 0.72, 0.75], rabbit: [0.72, 0.68, 0.7], bear: [1.05, 0.9, 1.0], fox: [0.9, 0.8, 1.15],
  penguin: [0, 0, 0], deer: [0.95, 0.85, 1.0], hamster: [0.78, 0.7, 0.7], tanuki: [0.95, 0.82, 0.95], panda: [0.92, 0.8, 0.85],
};

function mk(g: THREE.BufferGeometry, m: THREE.Material, cast = true) {
  const o = new THREE.Mesh(g, m);
  o.castShadow = cast;
  o.receiveShadow = false;
  return o;
}

// head ellipsoid
const HR = 0.52, HSX = 1.1, HSY = 0.95, HSZ = 1.0;
function surfZ(x: number, y: number) {
  const sx = HR * HSX, sy = HR * HSY, sz = HR * HSZ;
  return sz * Math.sqrt(Math.max(0, 1 - (x / sx) ** 2 - (y / sy) ** 2));
}
/** place a mesh on the head surface facing outward */
function onFace(m: THREE.Object3D, x: number, y: number, lift = 0) {
  const z = surfZ(x, y) + lift;
  m.position.set(x, y, z);
  const nx = x / (HSX * HSX), ny = y / (HSY * HSY), nz = z / (HSZ * HSZ);
  m.rotation.set(-Math.atan2(ny, Math.hypot(nx, nz)), Math.atan2(nx, nz), 0, 'YXZ');
  return m;
}

const ICE_MAT = std(0xa8e0ff, { kind: 'char', transparent: true, opacity: 0.45, emissive: 0x1a4a70, emissiveIntensity: 0.55, depthWrite: false });
const ICE_MAT2 = std(0xd4f1ff, { kind: 'char', transparent: true, opacity: 0.85, emissive: 0x2a6a90, emissiveIntensity: 0.45 });
const ICE_BASE = std(0xe0f5ff, { kind: 'char', transparent: true, opacity: 0.85, emissive: 0x1a3a50, emissiveIntensity: 0.45 });

/** 오재미 (beanbag) mesh */
export function buildBag(): THREE.Group {
  const g = new THREE.Group();
  const top = mk(half(0.2), std(0xffd23b, { tex: 'fabric', rx: 2 }));
  const bottom = mk(half(0.2), std(0xe8483c, { tex: 'fabric', rx: 2 }));
  bottom.rotation.x = Math.PI;
  const band = mk(cyl(0.205, 0.205, 0.05, 20), std(0x2f7de1, { tex: 'fabric', rx: 2 }));
  const knot = mk(sphere(0.06, 12, 8), std(0xffd23b, { tex: 'fabric' }));
  knot.position.y = 0.22;
  g.add(top, bottom, band, knot);
  g.scale.set(1, 0.85, 1);
  return g;
}

function buildIce(): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(1.25, 2.35, 1.15, 1, 1, 1);
  const block = mk(geo, ICE_MAT, false);
  block.position.y = 1.18;
  g.add(block);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
  edges.position.y = 1.18;
  g.add(edges);
  const base = mk(cyl(0.95, 1.0, 0.08, 20), ICE_BASE, false);
  base.position.y = 0.04;
  g.add(base);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const h = 0.5 + (i % 3) * 0.22;
    const c = mk(new THREE.ConeGeometry(0.13 + (i % 2) * 0.06, h, 5), ICE_MAT2);
    c.position.set(Math.cos(a) * 0.66, h / 2, Math.sin(a) * 0.62);
    c.rotation.z = -Math.cos(a) * 0.45;
    c.rotation.x = Math.sin(a) * 0.45;
    g.add(c);
  }
  g.visible = false;
  return g;
}

export function buildCharacter(animal: Animal, team: Team, isPlayer: boolean, outfit?: Outfit | null): CharModel {
  const P = PAL[animal];
  const tc = TEAM_COLORS[team];
  const top = topStyle(outfit?.top);
  const bottom = bottomStyle(outfit?.bottom);
  const furMat = std(P.fur, { tex: 'fur', rx: 2 });
  // anime-style faces stay mostly lit: the terminator is pushed far back
  const faceMat = std(P.face, { tex: 'fur', rx: 2, step: 0.28 });
  const accMat = std(P.accent, { tex: 'fur', rx: 2 });
  const innerMat = std(P.inner, { tex: 'soft' });
  // private instances: team colors are mutated per character by setTeam()
  const shirtMat = top
    ? std(top.color, { kind: 'char', tex: top.tex, rx: 3, ry: 3, unique: true })
    : std(tc.main, { kind: 'char', tex: P.pattern, rx: 3, ry: 3, unique: true });
  const pantsMat = bottom
    ? std(bottom.color, { kind: 'char', tex: bottom.tex, rx: 3, ry: 3, unique: true })
    : std(tc.dark, { kind: 'char', tex: 'fabric', rx: 3, ry: 3, unique: true });
  // with a costume top the collar carries the team color so teams stay readable
  const teamMat = std(tc.main, { kind: 'char', tex: 'fabric', rx: 2, unique: true });
  const shoeMat = std(P.shoe, { kind: 'char', spec: 0.55 });
  const eyeMat = std(0x1d1614, { kind: 'char', spec: 1.3, rim: 0, step: 0.2 });
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const blushMat = std(0xff8fa3, { transparent: true, opacity: 0.55, depthWrite: false });
  const noseMat = std(animal === 'rabbit' || animal === 'hamster' ? 0xff8fab : 0x2b1f1c, { kind: 'char', spec: 1.1 });
  const isPenguin = animal === 'penguin';
  const isPanda = animal === 'panda';
  const limbMat = isPanda ? accMat : furMat;

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // ---- team ring + soft blob shadow (ring is counter-offset by lift in Game)
  const ringMat = new THREE.MeshBasicMaterial({ color: isPlayer ? 0xffe14a : tc.main, transparent: true, opacity: isPlayer ? 0.95 : 0.5, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.56, 0.7, 36), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  root.add(ring);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: blobShadowTex(), transparent: true, depthWrite: false }));
  blob.position.z = -0.008;
  ring.add(blob);

  // ---- legs (pivot at hip)
  const mkLeg = (x: number) => {
    const g = new THREE.Group();
    g.position.set(x, 0.34, 0);
    const l = mk(capsule(0.095, 0.14), isPenguin ? std(P.accent, { tex: 'soft' }) : limbMat);
    l.position.y = -0.13;
    g.add(l);
    const shoe = mk(sphere(0.13, 20, 14), shoeMat);
    shoe.scale.set(1, 0.62, 1.38);
    shoe.position.set(0, -0.27, 0.05);
    g.add(shoe);
    const sole = mk(cyl(0.12, 0.12, 0.03, 16), std(0xf4efe6));
    sole.scale.set(1, 1, 1.35);
    sole.position.set(0, -0.32, 0.05);
    g.add(sole);
    body.add(g);
    return g;
  };
  const legL = mkLeg(0.15);
  const legR = mkLeg(-0.15);

  // ---- torso: pear shirt + shorts
  const torso = mk(sphere(0.36), shirtMat);
  torso.scale.set(1, 1.02, 0.9);
  torso.position.y = 0.64;
  body.add(torso);
  const shorts = mk(sphere(0.345), pantsMat);
  shorts.scale.set(1.03, 0.56, 0.92);
  shorts.position.y = 0.46;
  body.add(shorts);
  if (isPenguin) {
    const belly = mk(sphere(0.26), faceMat);
    belly.scale.set(1, 1.1, 0.5);
    belly.position.set(0, 0.64, 0.2);
    body.add(belly);
  }
  // collar + buttons
  const collar = mk(new THREE.TorusGeometry(0.19, 0.055, 10, 28), top ? teamMat : std(0xffffff, { tex: 'fabric', rx: 2 }));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.93;
  body.add(collar);
  if (!isPenguin && !top?.hideButtons) {
    for (let i = 0; i < 2; i++) {
      const b = mk(sphere(0.028, 10, 8), std(0xffffff, { rough: 0.3 }), false);
      b.position.set(0, 0.8 - i * 0.13, 0.32 - i * 0.005);
      body.add(b);
    }
  }
  // chest emblem (team star)
  const emblem = mk(new THREE.CircleGeometry(0.07, 20), std(0xffffff, { rough: 0.6 }), false);
  emblem.position.set(-0.15, 0.78, 0.305);
  emblem.rotation.y = -0.45;
  if (!top?.hideEmblem) body.add(emblem);

  // ---- arms (armL at +x, armR at -x → positive/negative z-rotation swings outward)
  const mkArm = (x: number) => {
    const g = new THREE.Group();
    g.position.set(x, 0.86, 0);
    const sleeve = mk(sphere(0.125, 18, 14), isPenguin ? furMat : shirtMat);
    sleeve.scale.set(1, 1.05, 1);
    sleeve.position.y = -0.04;
    g.add(sleeve);
    if (isPenguin) {
      const flip = mk(sphere(0.1, 18, 14), furMat);
      flip.scale.set(0.55, 1.8, 1);
      flip.position.y = -0.2;
      g.add(flip);
    } else {
      const a = mk(capsule(0.072, 0.14), limbMat);
      a.position.y = -0.17;
      g.add(a);
      const h = mk(sphere(0.095, 18, 14), limbMat);
      h.position.y = -0.31;
      g.add(h);
    }
    body.add(g);
    return g;
  };
  const armL = mkArm(0.34);
  const armR = mkArm(-0.34);
  armL.rotation.z = 0.25;
  armR.rotation.z = -0.25;

  const handBag = buildBag();
  handBag.position.set(0, -0.4, 0.08);
  handBag.visible = false;
  armR.add(handBag);

  // costume top accessories (hood, cape, straps, sleeves...)
  top?.build?.({ body, armL, armR, shirt: shirtMat, penguin: isPenguin });

  // costume bottoms (leg tubes ride the walk swing, skirts hang from the body)
  bottom?.build?.({ body, legL, legR, pants: pantsMat, penguin: isPenguin });

  // ---- head
  const head = new THREE.Group();
  head.position.y = 1.28;
  body.add(head);
  const skull = mk(sphere(HR, 36, 28), furMat);
  skull.scale.set(HSX, HSY, HSZ);
  head.add(skull);

  // penguin face mask / panda patches / tanuki mask
  if (isPenguin) {
    // white face mask sits just barely above the skull so the eyes can render on top of it
    for (const s of [-1, 1]) {
      const m = mk(sphere(0.22, 20, 16), faceMat, false);
      m.scale.set(1, 1.15, 0.3);
      onFace(m, s * 0.14, -0.02, -0.058);
      head.add(m);
    }
  }
  const darkEyes = isPanda || animal === 'tanuki';
  if (darkEyes) {
    for (const s of [-1, 1]) {
      const m = mk(sphere(0.12, 18, 14), accMat, false);
      m.scale.set(isPanda ? 0.95 : 1.35, isPanda ? 1.25 : 0.8, 0.3);
      onFace(m, s * 0.19, 0.02, -0.028);
      m.rotateZ(s * (isPanda ? -0.5 : 0.1));
      head.add(m);
    }
  }

  // muzzle
  const [mx, my, mz] = MUZZLE[animal];
  let muzzleFront = surfZ(0, -0.12);
  if (mx > 0) {
    const muz = mk(sphere(0.2, 28, 20), faceMat);
    muz.scale.set(1.25 * mx, 0.85 * my, 0.8 * mz);
    const zc = surfZ(0, -0.12) - 0.06;
    muz.position.set(0, -0.12, zc);
    head.add(muz);
    muzzleFront = zc + 0.16 * mz;
  }

  // eyes (with highlights as children so they blink together)
  // layering (front surface offsets): skull 0 < dark patch/penguin mask ≈ +0.01 < sclera ≈ +0.03 < pupil ≈ +0.045
  const eyes: THREE.Mesh[] = [];
  const eyeLift = darkEyes ? 0.012 : isPenguin ? 0.0 : -0.018;
  for (const s of [-1, 1]) {
    if (darkEyes) {
      const sclera = mk(sphere(0.088, 18, 14), std(0xffffff, { rough: 0.3 }), false);
      sclera.scale.set(0.95, 1.15, 0.3);
      onFace(sclera, s * 0.19, 0.04, 0.004);
      head.add(sclera);
    }
    const e = mk(sphere(0.075, 20, 16), eyeMat, false);
    onFace(e, s * 0.19, 0.04, eyeLift);
    e.scale.set(0.85, 1.15, 0.45);
    const sh1 = new THREE.Mesh(sphere(0.024, 10, 8), shineMat);
    sh1.position.set(0.022, 0.03, 0.072);
    e.add(sh1);
    const sh2 = new THREE.Mesh(sphere(0.011, 8, 6), shineMat);
    sh2.position.set(-0.02, -0.03, 0.074);
    e.add(sh2);
    head.add(e);
    eyes.push(e);
    // brows
    const brow = mk(capsule(0.016, 0.06), std(isPanda ? 0x26262b : P.accent, { tex: 'soft' }), false);
    onFace(brow, s * 0.2, 0.17, 0.004);
    brow.rotateZ(Math.PI / 2 + s * 0.18);
    head.add(brow);
    // blush
    const bl = mk(sphere(0.07, 16, 10), blushMat, false);
    bl.scale.set(1.3, 0.75, 0.25);
    onFace(bl, s * 0.33, -0.1, -0.005);
    head.add(bl);
  }

  // nose / beak + mouth
  if (isPenguin) {
    const beak = mk(cone(0.075, 0.2, 14), std(P.accent, { rough: 0.4 }));
    beak.rotation.x = Math.PI / 2;
    beak.scale.set(1.3, 1, 0.7);
    beak.position.set(0, -0.1, surfZ(0, -0.1) + 0.07);
    head.add(beak);
  } else {
    const nose = mk(sphere(0.052, 16, 12), noseMat, false);
    nose.scale.set(1.35, 1, 0.9);
    nose.position.set(0, mx > 0 ? -0.065 : -0.07, muzzleFront - 0.01);
    head.add(nose);
    const mouth = mk(new THREE.TorusGeometry(0.042, 0.011, 6, 14, Math.PI), std(0x3a2522, { rough: 0.5 }), false);
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, -0.155, muzzleFront - (mx > 0 ? 0.025 : 0.04));
    head.add(mouth);
    if (animal === 'rabbit' || animal === 'hamster') {
      const teeth = mk(new THREE.BoxGeometry(0.05, 0.04, 0.015), std(0xffffff, { rough: 0.3 }), false);
      teeth.position.set(0, -0.19, muzzleFront - 0.03);
      head.add(teeth);
    }
  }
  if (animal === 'cat' || animal === 'fox') {
    const wm = std(0x5a4a44);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const w = mk(cyl(0.004, 0.004, 0.2, 4), wm, false);
      w.rotation.z = Math.PI / 2 + s * (i - 1) * 0.18;
      w.position.set(s * 0.22, -0.11 + (i - 1) * 0.03, muzzleFront - 0.06);
      head.add(w);
    }
  }

  // ears / horns
  if (animal === 'bear' || animal === 'tanuki' || isPanda || animal === 'hamster') {
    const r = animal === 'hamster' ? 0.12 : 0.15;
    for (const s of [-1, 1]) {
      const e = mk(sphere(r, 20, 16), isPanda ? accMat : furMat);
      e.scale.set(1, 1, 0.55);
      e.position.set(s * 0.36, 0.36, -0.04);
      e.rotation.z = -s * 0.3;
      head.add(e);
      const i = mk(sphere(r * 0.6, 16, 12), animal === 'bear' || animal === 'tanuki' ? std(P.inner, { tex: 'fur' }) : isPanda ? accMat : innerMat, false);
      i.scale.set(1, 1, 0.4);
      i.position.set(s * 0.36, 0.36, 0.02);
      i.rotation.z = -s * 0.3;
      head.add(i);
    }
  } else if (animal === 'rabbit') {
    for (const s of [-1, 1]) {
      const e = mk(capsule(0.1, 0.36), furMat);
      e.scale.set(0.95, 1, 0.55);
      e.position.set(s * 0.17, 0.66, -0.05);
      e.rotation.z = -s * 0.14;
      head.add(e);
      const i = mk(capsule(0.055, 0.3), innerMat, false);
      i.scale.set(1, 1, 0.4);
      i.position.set(s * 0.17, 0.66, 0.0);
      i.rotation.z = -s * 0.14;
      head.add(i);
    }
  } else if (animal === 'cat' || animal === 'fox') {
    const h = animal === 'fox' ? 0.34 : 0.27;
    for (const s of [-1, 1]) {
      const e = mk(cone(0.15, h, 18), furMat);
      e.scale.set(1, 1, 0.55);
      e.position.set(s * 0.3, 0.42 + (h - 0.27) / 2, -0.03);
      e.rotation.z = -s * 0.32;
      head.add(e);
      const i = mk(cone(0.09, h * 0.7, 14), innerMat, false);
      i.scale.set(1, 1, 0.4);
      i.position.set(s * 0.3, 0.4 + (h - 0.27) / 2, 0.02);
      i.rotation.z = -s * 0.32;
      head.add(i);
      if (animal === 'fox') {
        const tip = mk(cone(0.07, 0.12, 12), accMat, false);
        tip.scale.set(1, 1, 0.6);
        tip.position.set(s * 0.36, 0.6, -0.03);
        tip.rotation.z = -s * 0.32;
        head.add(tip);
      }
    }
    if (animal === 'cat') {
      for (let k = -1; k <= 1; k++) {
        const st = mk(capsule(0.02, 0.08), accMat, false);
        onFace(st, k * 0.07, 0.36, 0.002);
        head.add(st);
      }
    }
  } else if (animal === 'dog') {
    for (const s of [-1, 1]) {
      const e = mk(sphere(0.17, 20, 16), accMat);
      e.scale.set(0.55, 1.25, 0.5);
      e.position.set(s * 0.52, 0.05, -0.02);
      e.rotation.z = s * 0.32;
      head.add(e);
    }
    const patch = mk(sphere(0.1, 16, 12), accMat, false);
    patch.scale.set(1.2, 1, 0.3);
    onFace(patch, 0.22, 0.1, -0.03);
    head.add(patch);
  } else if (animal === 'deer') {
    const antler = std(0x8a6038, { tex: 'bark' });
    for (const s of [-1, 1]) {
      const e = mk(sphere(0.13, 16, 12), furMat);
      e.scale.set(0.5, 0.95, 0.35);
      e.position.set(s * 0.52, 0.16, -0.02);
      e.rotation.z = s * 0.9;
      head.add(e);
      const main = mk(capsule(0.035, 0.36), antler);
      main.position.set(s * 0.22, 0.64, -0.06);
      main.rotation.z = -s * 0.35;
      head.add(main);
      const br = mk(capsule(0.03, 0.16), antler);
      br.position.set(s * 0.34, 0.74, -0.06);
      br.rotation.z = -s * 1.1;
      head.add(br);
    }
    for (let i = 0; i < 3; i++) {
      const sp = mk(sphere(0.035, 10, 8), std(0xfff5e6, { tex: 'soft' }), false);
      onFace(sp, (i - 1) * 0.14, 0.34, 0.0);
      head.add(sp);
    }
  } else if (isPenguin) {
    for (let i = 0; i < 3; i++) {
      const t = mk(cone(0.04, 0.16, 10), furMat);
      t.position.set((i - 1) * 0.06, 0.52, 0.02);
      t.rotation.z = (i - 1) * -0.4;
      head.add(t);
    }
  }
  if (animal === 'hamster') {
    for (const s of [-1, 1]) {
      const ch = mk(sphere(0.14, 18, 14), faceMat);
      ch.scale.set(1, 0.85, 0.7);
      onFace(ch, s * 0.3, -0.16, -0.07);
      head.add(ch);
    }
  }

  // hat pom for a few (cute beanie touch on non-eared heads isn't needed) — hair tuft for dog/bear
  if (animal === 'dog' || animal === 'bear') {
    const tuft = mk(sphere(0.07, 12, 10), furMat);
    tuft.position.set(0.03, 0.47, 0.12);
    tuft.scale.set(1.3, 0.7, 1);
    head.add(tuft);
  }

  // ---- costume: hat & glasses ride on the head (so they follow every head animation / blink / hit reaction)
  const hat = buildHat(outfit?.hat, animal);
  if (hat) head.add(hat);
  const glasses = buildGlasses(outfit?.glasses, muzzleFront);
  if (glasses) head.add(glasses);

  // ---- tail
  const tailFrom = body.children.length;
  if (animal === 'fox') {
    const tail = mk(sphere(0.16, 20, 16), furMat);
    tail.scale.set(0.85, 0.85, 2.2);
    tail.position.set(0, 0.52, -0.52);
    tail.rotation.x = 0.7;
    body.add(tail);
    const tip = mk(sphere(0.12, 16, 12), faceMat);
    tip.position.set(0, 0.8, -0.82);
    body.add(tip);
  } else if (animal === 'tanuki') {
    const tail = mk(sphere(0.15, 20, 16), furMat);
    tail.scale.set(0.9, 0.9, 1.8);
    tail.position.set(0, 0.45, -0.46);
    tail.rotation.x = 0.5;
    body.add(tail);
    for (let i = 0; i < 2; i++) {
      const band = mk(new THREE.TorusGeometry(0.12 - i * 0.02, 0.03, 8, 18), accMat);
      band.position.set(0, 0.49 + i * 0.1, -0.52 - i * 0.12);
      band.rotation.x = 0.5 - Math.PI / 2;
      body.add(band);
    }
  } else if (animal === 'cat' || animal === 'dog') {
    const tail = mk(capsule(0.06, 0.34), furMat);
    tail.position.set(0, 0.62, -0.42);
    tail.rotation.x = animal === 'cat' ? -0.5 : -0.9;
    body.add(tail);
  } else if (!isPenguin) {
    const tail = mk(sphere(animal === 'hamster' ? 0.06 : 0.1, 14, 10), animal === 'deer' || animal === 'rabbit' ? faceMat : isPanda ? accMat : furMat);
    tail.position.set(0, 0.5, -0.35);
    body.add(tail);
  }
  // capes / costume tails would be pierced by the animal's own tail → tuck it away
  if (top?.hideTail) for (let i = tailFrom; i < body.children.length; i++) body.children[i].visible = false;

  // ---- stun stars
  const stars = new THREE.Group();
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffe14a });
  const starGeo = makeStarGeo(0.11);
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(starGeo, starMat);
    const a = (i / 3) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
    stars.add(s);
  }
  stars.position.y = 2.05;
  stars.visible = false;
  root.add(stars);

  // ---- motorcycle (small scooter)
  const moto = new THREE.Group();
  const paint = std(0xff6b6b, { rough: 0.3 });
  const motoBody = mk(capsule(0.18, 0.7), paint);
  motoBody.rotation.x = Math.PI / 2;
  motoBody.position.y = 0.42;
  moto.add(motoBody);
  const seat = mk(capsule(0.12, 0.3), std(0x3a2a22, { rough: 0.5 }));
  seat.rotation.x = Math.PI / 2;
  seat.position.set(0, 0.6, -0.15);
  moto.add(seat);
  const wheelGeo = new THREE.TorusGeometry(0.2, 0.08, 10, 20);
  for (const z of [-0.5, 0.5]) {
    const w = mk(wheelGeo, std(0x2a2a2a, { rough: 0.7 }));
    w.rotation.y = Math.PI / 2;
    w.position.set(0, 0.22, z);
    w.name = 'wheel';
    moto.add(w);
    const hub = mk(cyl(0.08, 0.08, 0.1, 12), std(0xdddddd, { rough: 0.3 }));
    hub.rotation.z = Math.PI / 2;
    hub.position.set(0, 0.22, z);
    moto.add(hub);
  }
  const stem = mk(cyl(0.04, 0.04, 0.5, 8), std(0xcccccc, { rough: 0.3 }));
  stem.position.set(0, 0.72, 0.45);
  stem.rotation.x = -0.3;
  moto.add(stem);
  const bar = mk(cyl(0.035, 0.035, 0.6, 8), std(0xcccccc, { rough: 0.3 }));
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.95, 0.52);
  moto.add(bar);
  const lamp = new THREE.Mesh(sphere(0.09, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff2a0 }));
  lamp.position.set(0, 0.65, 0.66);
  moto.add(lamp);
  moto.visible = false;
  root.add(moto);

  // ---- jelly overlay
  const jellyBlob = new THREE.Mesh(sphere(0.78, 24, 18), std(0x5ee67a, { kind: 'char', transparent: true, opacity: 0.45, emissive: 0x1a5a22, emissiveIntensity: 0.6 }));
  jellyBlob.position.y = 0.55;
  jellyBlob.scale.set(1, 0.7, 1);
  jellyBlob.visible = false;
  root.add(jellyBlob);

  // ---- UFO
  const ufoBeam = new THREE.Group();
  const ufoDisc = mk(sphere(0.9, 28, 14), std(0xc8d2e2, { rough: 0.25, emissive: 0x223344, emissiveIntensity: 0.4 }));
  ufoDisc.scale.set(1, 0.25, 1);
  ufoBeam.add(ufoDisc);
  const dome = new THREE.Mesh(sphere(0.4, 20, 14), std(0x8fe8ff, { kind: 'char', transparent: true, opacity: 0.8, emissive: 0x2a8aa0, emissiveIntensity: 0.6 }));
  dome.position.y = 0.18;
  ufoBeam.add(dome);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xaaffcc, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = -1.5;
  ufoBeam.add(beam);
  for (let i = 0; i < 8; i++) {
    const l = new THREE.Mesh(sphere(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffe14a : 0xff6ad5 }));
    const a = (i / 8) * Math.PI * 2;
    l.position.set(Math.cos(a) * 0.75, -0.05, Math.sin(a) * 0.75);
    ufoBeam.add(l);
  }
  ufoBeam.visible = false;
  root.add(ufoBeam);

  const ice = buildIce();
  root.add(ice);

  // ---- tagger marker
  const taggerMark = new THREE.Group();
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 16), std(0xff3b3b, { rough: 0.35, emissive: 0x661111, emissiveIntensity: 0.6 }));
  arrow.rotation.x = Math.PI;
  taggerMark.add(arrow);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffdd55 }));
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.35;
  taggerMark.add(halo);
  taggerMark.position.y = 2.75;
  taggerMark.visible = false;
  root.add(taggerMark);

  const setTeam = (t: Team) => {
    if (!top) shirtMat.color.setHex(TEAM_COLORS[t].main); // costume tops keep their own colors
    if (!bottom) pantsMat.color.setHex(TEAM_COLORS[t].dark); // costume bottoms keep their own colors
    teamMat.color.setHex(TEAM_COLORS[t].main);
    if (!isPlayer) ringMat.color.setHex(TEAM_COLORS[t].main);
  };

  // mark FX / UI meshes so outlines skip them
  [ring, jellyBlob, stars, moto, ufoBeam, ice, taggerMark, handBag].forEach((o) => {
    o.traverse((c) => { c.userData.noOutline = true; });
  });
  // eyes / blush / mouth stay crisp without thick black rims
  eyes.forEach((e) => { e.userData.noOutline = true; e.traverse((c) => { c.userData.noOutline = true; }); });

  addCharOutlines(root);

  return { root, body, head, armL, armR, legL, legR, eyes, handBag, stars, moto, jellyBlob, ring, ringMat, ufoBeam, ice, taggerMark, setTeam };
}

let starGeoCache: THREE.BufferGeometry | null = null;
export function makeStarGeo(r: number) {
  if (starGeoCache && r === 0.11) return starGeoCache;
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: r * 0.4, bevelEnabled: true, bevelThickness: r * 0.12, bevelSize: r * 0.1, bevelSegments: 2 });
  g.center();
  if (r === 0.11) starGeoCache = g;
  return g;
}
