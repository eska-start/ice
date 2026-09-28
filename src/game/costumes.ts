import * as THREE from 'three';
import { std, type TexName } from './textures';
import type { Animal, CostumeSlot, Outfit } from './types';

// =========================================================================== catalog (10 tops · 10 bottoms · 10 hats · 10 glasses)
export interface CostumeDef {
  id: string;
  slot: CostumeSlot;
  name: string;
  emoji: string;
  price: number;
  desc: string;
}

export const SLOT_INFO: Record<CostumeSlot, { name: string; emoji: string }> = {
  top: { name: '상의', emoji: '👕' },
  bottom: { name: '하의', emoji: '👖' },
  hat: { name: '모자', emoji: '🎩' },
  glasses: { name: '안경', emoji: '👓' },
};
export const SLOTS: CostumeSlot[] = ['top', 'bottom', 'hat', 'glasses'];

export const COSTUMES: CostumeDef[] = [
  // ---- tops
  { id: 'top_hoodie', slot: 'top', name: '포근 후드티', emoji: '🧥', price: 150, desc: '모자 달린 라벤더 후드티' },
  { id: 'top_overalls', slot: 'top', name: '멜빵 작업복', emoji: '👖', price: 160, desc: '청 멜빵이 귀여운 작업복' },
  { id: 'top_sweater', slot: 'top', name: '줄무늬 스웨터', emoji: '👕', price: 120, desc: '따뜻한 머스터드 니트' },
  { id: 'top_aloha', slot: 'top', name: '알로하 셔츠', emoji: '🌺', price: 180, desc: '히비스커스 무늬 여름 셔츠' },
  { id: 'top_tuxedo', slot: 'top', name: '턱시도', emoji: '🤵', price: 320, desc: '나비넥타이까지 완벽한 정장' },
  { id: 'top_hero', slot: 'top', name: '히어로 슈트', emoji: '🦸', price: 380, desc: '펄럭이는 빨간 망토' },
  { id: 'top_sailor', slot: 'top', name: '세일러복', emoji: '⚓', price: 200, desc: '네이비 칼라와 빨간 스카프' },
  { id: 'top_raincoat', slot: 'top', name: '노란 우비', emoji: '☔', price: 170, desc: '비 오는 날의 필수템' },
  { id: 'top_hanbok', slot: 'top', name: '색동 한복', emoji: '🎎', price: 300, desc: '색동 소매와 고름 저고리' },
  { id: 'top_dino', slot: 'top', name: '공룡 옷', emoji: '🦖', price: 350, desc: '등 가시와 꼬리가 달린 공룡 옷' },
  // ---- bottoms
  { id: 'bot_sweats', slot: 'bottom', name: '포근 츄리닝', emoji: '🩳', price: 120, desc: '줄무늬 옆선이 귀여운 츄리닝' },
  { id: 'bot_jeans', slot: 'bottom', name: '롤업 청바지', emoji: '👖', price: 150, desc: '밑단을 말아 올린 데님 팬츠' },
  { id: 'bot_cargo', slot: 'bottom', name: '카고 반바지', emoji: '🎒', price: 140, desc: '주머니 많은 모험가 반바지' },
  { id: 'bot_skirt', slot: 'bottom', name: '플리츠 스커트', emoji: '🩰', price: 170, desc: '주름 치마와 니삭스 세트' },
  { id: 'bot_tuxedo', slot: 'bottom', name: '턱시도 바지', emoji: '🤵', price: 300, desc: '금줄 장식 정장 바지' },
  { id: 'bot_hero', slot: 'bottom', name: '히어로 타이츠', emoji: '🦸', price: 360, desc: '빨간 부츠의 히어로 타이츠' },
  { id: 'bot_sailor', slot: 'bottom', name: '세일러 스커트', emoji: '⚓', price: 190, desc: '네이비 세일러 치마' },
  { id: 'bot_rain', slot: 'bottom', name: '노란 장화바지', emoji: '☔', price: 160, desc: '비 오는 날 노란 장화 세트' },
  { id: 'bot_hanbok', slot: 'bottom', name: '한복 바지', emoji: '🎎', price: 280, desc: '넉넉한 색동 고름 바지' },
  { id: 'bot_dino', slot: 'bottom', name: '공룡 하의', emoji: '🦖', price: 350, desc: '공룡 옷과 딱 맞는 하의 · 발톱 포함' },
  // ---- hats
  { id: 'hat_cap', slot: 'hat', name: '야구모자', emoji: '🧢', price: 100, desc: '챙이 멋진 스포츠 캡' },
  { id: 'hat_beanie', slot: 'hat', name: '방울 비니', emoji: '🧶', price: 110, desc: '폭신한 방울이 달린 비니' },
  { id: 'hat_straw', slot: 'hat', name: '밀짚모자', emoji: '👒', price: 140, desc: '빨간 리본 여름 모자' },
  { id: 'hat_crown', slot: 'hat', name: '황금 왕관', emoji: '👑', price: 500, desc: '보석이 박힌 왕관' },
  { id: 'hat_wizard', slot: 'hat', name: '마법사 모자', emoji: '🧙', price: 260, desc: '별이 반짝이는 고깔모자' },
  { id: 'hat_tophat', slot: 'hat', name: '실크햇', emoji: '🎩', price: 220, desc: '신사의 높은 모자' },
  { id: 'hat_flower', slot: 'hat', name: '꽃 화관', emoji: '🌸', price: 160, desc: '들꽃으로 엮은 화관' },
  { id: 'hat_santa', slot: 'hat', name: '산타 모자', emoji: '🎅', price: 150, desc: '방울이 달랑달랑' },
  { id: 'hat_pirate', slot: 'hat', name: '해적 모자', emoji: '🏴‍☠️', price: 280, desc: '해골 마크 삼각 모자' },
  { id: 'hat_dino', slot: 'hat', name: '공룡 모자', emoji: '🦕', price: 350, desc: '공룡 옷과 딱 맞는 뿔 달린 후드' },
  // ---- glasses
  { id: 'gl_round', slot: 'glasses', name: '동그란 안경', emoji: '👓', price: 80, desc: '금테 동그란 안경' },
  { id: 'gl_sun', slot: 'glasses', name: '선글라스', emoji: '🕶️', price: 140, desc: '반짝이는 보잉 선글라스' },
  { id: 'gl_heart', slot: 'glasses', name: '하트 안경', emoji: '💖', price: 150, desc: '사랑스러운 하트 프레임' },
  { id: 'gl_star', slot: 'glasses', name: '별 안경', emoji: '⭐', price: 150, desc: '파티용 별 모양 안경' },
  { id: 'gl_3d', slot: 'glasses', name: '3D 안경', emoji: '🎬', price: 120, desc: '빨강·파랑 입체 안경' },
  { id: 'gl_goggles', slot: 'glasses', name: '스키 고글', emoji: '🥽', price: 200, desc: '미러 렌즈 스노우 고글' },
  { id: 'gl_monocle', slot: 'glasses', name: '모노클', emoji: '🧐', price: 180, desc: '금줄 달린 외알 안경' },
  { id: 'gl_party', slot: 'glasses', name: '변장 안경', emoji: '🥸', price: 160, desc: '코와 콧수염이 달린 안경' },
  { id: 'gl_nerd', slot: 'glasses', name: '뿔테 안경', emoji: '🤓', price: 100, desc: '두꺼운 사각 뿔테' },
  { id: 'gl_shutter', slot: 'glasses', name: '셔터 선글라스', emoji: '🌈', price: 170, desc: '네온 핑크 셔터 쉐이드' },
];

export const COSTUME_MAP: Record<string, CostumeDef> = Object.fromEntries(COSTUMES.map((c) => [c.id, c]));

export function costumesOf(slot: CostumeSlot) {
  return COSTUMES.filter((c) => c.slot === slot);
}

/** keeps only known ids in the right slots (guards save data / network input) */
export function sanitizeOutfit(o: unknown): Outfit {
  const out: Outfit = {};
  if (!o || typeof o !== 'object') return out;
  const src = o as Record<string, unknown>;
  for (const slot of SLOTS) {
    const id = src[slot];
    if (typeof id === 'string' && COSTUME_MAP[id]?.slot === slot) out[slot] = id;
  }
  return out;
}

export function randomOutfit(chance = 0.5): Outfit {
  const o: Outfit = {};
  for (const slot of SLOTS) {
    if (Math.random() >= chance) continue;
    const list = costumesOf(slot);
    o[slot] = list[Math.floor(Math.random() * list.length)].id;
  }
  return o;
}

export function outfitKey(o?: Outfit | null) {
  return o ? `${o.top ?? ''}|${o.bottom ?? ''}|${o.hat ?? ''}|${o.glasses ?? ''}` : '|||';
}

// =========================================================================== geometry helpers
const GC = new Map<string, THREE.BufferGeometry>();
function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = GC.get(key) as T | undefined;
  if (!g) {
    g = make();
    GC.set(key, g);
  }
  return g;
}
const SPH = () => geo('sph', () => new THREE.SphereGeometry(1, 26, 18));
const HALF = () => geo('half', () => new THREE.SphereGeometry(1, 30, 14, 0, Math.PI * 2, 0, Math.PI / 2));
const cyl = (rt: number, rb: number, h: number, seg = 24, open = false, ts = 0, tl = Math.PI * 2) =>
  geo(`cyl${rt}_${rb}_${h}_${seg}_${open}_${ts.toFixed(3)}_${tl.toFixed(3)}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, ts, tl));
const cone = (r: number, h: number, seg = 16) => geo(`cone${r}_${h}_${seg}`, () => new THREE.ConeGeometry(r, h, seg));
const torus = (R: number, t: number, rs = 8, ts = 28, arc = Math.PI * 2) => geo(`tor${R}_${t}_${rs}_${ts}_${arc.toFixed(3)}`, () => new THREE.TorusGeometry(R, t, rs, ts, arc));
const capsule = (r: number, len: number) => geo(`cap${r}_${len}`, () => new THREE.CapsuleGeometry(r, len, 5, 12));
const box = (w: number, h: number, d: number) => geo(`box${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d));

type V3 = [number, number, number];
function mesh(g: THREE.BufferGeometry, m: THREE.Material, p?: V3, r?: V3, s?: number | V3, outline?: number) {
  const o = new THREE.Mesh(g, m);
  o.castShadow = true;
  if (p) o.position.set(p[0], p[1], p[2]);
  if (r) o.rotation.set(r[0], r[1], r[2]);
  if (s !== undefined) {
    if (typeof s === 'number') o.scale.setScalar(s);
    else o.scale.set(s[0], s[1], s[2]);
  }
  if (outline !== undefined) o.userData.outlineScale = outline;
  return o;
}

const UP = new THREE.Vector3(0, 1, 0);
function rod(a: V3, b: V3, r: number, m: THREE.Material, outline = 0.3) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const d = vb.clone().sub(va);
  const len = d.length();
  const o = mesh(cyl(r, r, 1, 8), m, undefined, undefined, undefined, outline);
  o.scale.set(1, len, 1);
  o.position.copy(va).addScaledVector(d, 0.5);
  o.quaternion.setFromUnitVectors(UP, d.normalize());
  return o;
}

const c = (hex: number, o: Parameters<typeof std>[1] = {}) => std(hex, { kind: 'char', ...o });
const shade = (hex: number, k: number) => new THREE.Color(hex).multiplyScalar(k).getHex();
const glass = (hex: number, opacity = 0.32) => c(hex, { transparent: true, opacity, depthWrite: false, spec: 1.2 });

// 2D shape helpers (work for both Shape and Path)
type P2 = THREE.Shape | THREE.Path;
function circleP(p: P2, r: number) { p.absarc(0, 0, r, 0, Math.PI * 2, false); }
function ellipseP(p: P2, rx: number, ry: number) { p.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0); }
function rrectP(p: P2, w: number, h: number, r: number) {
  const x = -w / 2, y = -h / 2;
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r);
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r);
  p.quadraticCurveTo(x, y, x + r, y);
}
function heartP(p: P2, s: number) {
  p.moveTo(0, -s * 0.95);
  p.bezierCurveTo(-s * 1.35, -s * 0.05, -s * 0.75, s * 1.05, 0, s * 0.45);
  p.bezierCurveTo(s * 0.75, s * 1.05, s * 1.35, -s * 0.05, 0, -s * 0.95);
}
function starP(p: P2, ro: number, ri: number, n = 5) {
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 === 0 ? ro : ri;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
}
/** extruded frame (optionally with a hole), centered on z = 0, facing +z */
function plate(key: string, outer: (p: P2) => void, inner?: (p: P2) => void, depth = 0.024) {
  return geo(`plate_${key}_${depth}`, () => {
    const s = new THREE.Shape();
    outer(s);
    if (inner) {
      const h = new THREE.Path();
      inner(h);
      s.holes.push(h);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 2, curveSegments: 28 });
    g.translate(0, 0, -depth / 2);
    return g;
  });
}

// torso surface (sphere r .36 scaled 1,1.02,.9 at y .64) → front z at (x, y)
const fz = (x: number, y: number) => 0.324 * Math.sqrt(Math.max(0, 1 - (x / 0.36) ** 2 - ((y - 0.64) / 0.367) ** 2));
// shorts (sphere .345 scaled 1.03,.56,.92 at y .46) and head (r .52 scaled 1.1,.95,1 at y 1.28) back/front depth
const shortsZ = (x: number, y: number) => 0.317 * Math.sqrt(Math.max(0, 1 - (x / 0.355) ** 2 - ((y - 0.46) / 0.193) ** 2));
const headZ = (x: number, y: number) => 0.52 * Math.sqrt(Math.max(0, 1 - (x / 0.572) ** 2 - ((y - 1.28) / 0.494) ** 2));
/** outer body depth at (x, y) in body space (torso ∪ shorts) */
const bodyZ = (x: number, y: number) => Math.max(fz(x, y), shortsZ(x, y));

const _v1 = new THREE.Vector3();
/** place an object on a surface point with its +Z facing along the surface normal (keeps it upright) */
function faceOut<T extends THREE.Object3D>(o: T, pos: THREE.Vector3, n: THREE.Vector3, lift = 0): T {
  o.position.copy(pos).addScaledVector(n, lift);
  o.lookAt(_v1.copy(o.position).add(n));
  return o;
}

// --------------------------------------------------------------------------- bent (curved) cones
// Tapered tube swept along a Bézier curve: seamless droopy hats (santa / wizard) with no joints or gaps.
interface Bent { curve: THREE.Curve<THREE.Vector3>; r: (t: number) => number; len: number }
function makeBent(pts: V3[], r0: number, r1: number, pow = 1): Bent {
  const v = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = v.length === 4 ? new THREE.CubicBezierCurve3(v[0], v[1], v[2], v[3]) : new THREE.QuadraticBezierCurve3(v[0], v[1], v[2]);
  return { curve, r: (t) => r0 + (r1 - r0) * Math.pow(t, pow), len: curve.getLength() };
}
/** slope angle of the cone wall at t (normal tilts toward the tip as the radius shrinks) */
function bentSlope(b: Bent, t: number) {
  const a = Math.max(0, t - 0.01), c2 = Math.min(1, t + 0.01);
  return Math.atan(-(b.r(c2) - b.r(a)) / ((c2 - a) * b.len));
}
function bentGeo(key: string, b: Bent, seg = 44, rad = 30): THREE.BufferGeometry {
  return geo(`bent_${key}`, () => {
    const frames = b.curve.computeFrenetFrames(seg, false);
    const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
    const p = new THREE.Vector3(), n = new THREE.Vector3(), nn = new THREE.Vector3();
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      b.curve.getPointAt(t, p);
      const T = frames.tangents[i], N = frames.normals[i], B = frames.binormals[i];
      const r = b.r(t);
      const phi = bentSlope(b, t);
      for (let j = 0; j <= rad; j++) {
        const a = (j / rad) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        n.set(N.x * ca + B.x * sa, N.y * ca + B.y * sa, N.z * ca + B.z * sa);
        pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
        nn.copy(n).multiplyScalar(Math.cos(phi)).addScaledVector(T, Math.sin(phi)).normalize();
        nor.push(nn.x, nn.y, nn.z);
        uv.push(j / rad, t);
      }
    }
    // winding chosen so faces point outward (T × B = −N)
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j, c3 = a + rad + 1;
      idx.push(a, a + 1, c3, a + 1, c3 + 1, c3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  });
}
/** point + outward normal on a bent cone surface, on the side facing `dir` */
function bentSurface(b: Bent, t: number, dir: V3) {
  const p = b.curve.getPointAt(t), T = b.curve.getTangentAt(t);
  const d = new THREE.Vector3(dir[0], dir[1], dir[2]);
  const radial = d.addScaledVector(T, -d.dot(T)).normalize();
  const phi = bentSlope(b, t);
  const normal = radial.clone().multiplyScalar(Math.cos(phi)).addScaledVector(T, Math.sin(phi)).normalize();
  return { pos: p.addScaledVector(radial, b.r(t)), normal };
}

// --------------------------------------------------------------------------- hero cape (curved cloth sheet)
/** u ∈ [-1,1] across, v ∈ [0,1] down. Wraps around the back and never cuts into torso / shorts. */
function capePoint(u: number, v: number, out: THREE.Vector3) {
  const hw = 0.19 + 0.31 * Math.pow(v, 0.85);
  const back = 0.34 + 0.13 * v + 0.14 * v * v; // flares out toward the hem
  const wrap = 0.26 - 0.06 * v;
  const wave = Math.sin(u * Math.PI * 2.5 + 0.6) * 0.035 * Math.pow(v, 1.4);
  const x = u * hw, y = 0.97 - v * 0.84 + Math.abs(u) * 0.02 * v;
  let z = -back + u * u * wrap + wave;
  z = Math.min(z, -(bodyZ(x, y) + 0.04)); // always stay outside the body
  return out.set(x, y, z);
}
function capeGeometry() {
  return geo('cape_sheet', () => {
    const NU = 18, NV = 16;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const p = new THREE.Vector3();
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      capePoint(-1 + (2 * i) / NU, j / NV, p);
      pos.push(p.x, p.y, p.z);
      uv.push(i / NU, 1 - j / NV);
    }
    // (right, down) winding → front faces point outward (away from the body)
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const a = j * (NU + 1) + i, b = a + 1, c3 = a + NU + 1, d = c3 + 1;
      idx.push(a, b, c3, b, d, c3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });
}
function capeHem() {
  return geo('cape_hem', () => {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) pts.push(capePoint(-1, k / 8, new THREE.Vector3()));
    for (let k = 1; k <= 12; k++) pts.push(capePoint(-1 + (2 * k) / 12, 1, new THREE.Vector3()));
    for (let k = 7; k >= 0; k--) pts.push(capePoint(1, k / 8, new THREE.Vector3()));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 90, 0.014, 6, false);
  });
}

// =========================================================================== tops
export interface TopCtx {
  body: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  shirt: THREE.Material;
  penguin: boolean;
}
interface TopStyle {
  color: number;
  tex: TexName;
  hideButtons?: boolean;
  hideEmblem?: boolean;
  /** hide the animal's own tail (it would poke through a cape / costume tail) */
  hideTail?: boolean;
  build?: (x: TopCtx) => void;
}

function hood(x: TopCtx, mat: THREE.Material) {
  x.body.add(mesh(SPH(), mat, [0, 0.94, -0.37], [0.5, 0, 0], [0.29, 0.16, 0.17]));
  x.body.add(mesh(torus(0.2, 0.04, 8, 24), mat, [0, 0.99, -0.3], [1.1, 0, 0], [1.2, 1, 1], 0.6));
}

const TOPS: Record<string, TopStyle> = {
  top_hoodie: {
    color: 0xaab8dc, tex: 'fabric', hideButtons: true, hideEmblem: true,
    build: (x) => {
      hood(x, x.shirt);
      const white = c(0xffffff);
      for (const s of [-1, 1]) {
        x.body.add(mesh(capsule(0.011, 0.11), white, [s * 0.06, 0.8, fz(s * 0.06, 0.8) + 0.02], [-0.25, 0, 0], undefined, 0.35));
        x.body.add(mesh(SPH(), white, [s * 0.06, 0.72, fz(s * 0.06, 0.72) + 0.03], undefined, 0.02, 0.4));
      }
      x.body.add(mesh(capsule(0.055, 0.2), c(shade(0xaab8dc, 0.84), { tex: 'fabric', rx: 2 }), [0, 0.55, fz(0, 0.55) + 0.002], [0.12, 0, Math.PI / 2], [1, 1, 0.32], 0.6));
    },
  },
  top_overalls: {
    color: 0xfff3e2, tex: 'fabric', hideButtons: true, hideEmblem: true,
    build: (x) => {
      const denim = c(0x4f7fd1, { tex: 'fabric', rx: 2 });
      x.body.add(mesh(box(0.3, 0.22, 0.05), denim, [0, 0.69, fz(0, 0.69) + 0.012], [-0.15, 0, 0]));
      x.body.add(mesh(box(0.12, 0.07, 0.02), c(shade(0x4f7fd1, 0.8), { tex: 'fabric' }), [0, 0.67, fz(0, 0.67) + 0.045], [-0.15, 0, 0], undefined, 0.5));
      const gold = c(0xffcf3f, { spec: 1 });
      for (const s of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(s * 0.11, 0.64, 0);
        g.rotation.y = Math.PI / 2;
        // arc from inside the shorts at the back, over the shoulder, down to the bib button
        g.add(mesh(torus(1, 0.07, 6, 34, 2.9), denim, undefined, [0, 0, -0.3], [0.33, 0.37, 0.85], 0.6));
        x.body.add(g);
        x.body.add(mesh(SPH(), gold, [s * 0.11, 0.8, fz(0.11, 0.8) + 0.035], undefined, 0.027, 0.5));
      }
    },
  },
  top_sweater: {
    color: 0xf2a23a, tex: 'stripe', hideButtons: true,
    build: (x) => {
      x.body.add(mesh(torus(0.355, 0.035, 8, 36), c(shade(0xf2a23a, 0.8), { tex: 'fabric', rx: 3 }), [0, 0.56, 0], [Math.PI / 2, 0, 0], [1, 0.9, 1], 0.6));
    },
  },
  top_aloha: {
    color: 0xffffff, tex: 'floral', hideEmblem: true,
    build: (x) => {
      for (const s of [-1, 1]) {
        x.body.add(mesh(cone(0.085, 0.17, 3), x.shirt, [s * 0.085, 0.86, fz(0.085, 0.86) + 0.012], [-0.35, 0, s * 2.55], [1, 1, 0.25], 0.5));
      }
    },
  },
  top_tuxedo: {
    color: 0x2b2e3d, tex: 'fabric', hideButtons: true, hideEmblem: true,
    build: (x) => {
      x.body.add(mesh(SPH(), c(0xffffff, { tex: 'soft' }), [0, 0.71, 0.175], undefined, [0.13, 0.25, 0.17]));
      const red = c(0xd8344a, { spec: 0.6 });
      for (const s of [-1, 1]) {
        x.body.add(mesh(cone(0.055, 0.1, 12), red, [s * 0.055, 0.9, 0.3], [0, 0, s * Math.PI / 2], [1, 1, 0.55], 0.6));
        x.body.add(mesh(capsule(0.02, 0.2), c(shade(0x2b2e3d, 0.7)), [s * 0.14, 0.74, fz(0.14, 0.74) + 0.012], [-0.2, 0, s * 0.28], undefined, 0.5));
      }
      x.body.add(mesh(SPH(), red, [0, 0.9, 0.31], undefined, 0.03, 0.5));
      const black = c(0x1b1b22, { spec: 1 });
      x.body.add(mesh(SPH(), black, [0, 0.78, 0.342], undefined, 0.018, 0.4));
      x.body.add(mesh(SPH(), black, [0, 0.66, 0.346], undefined, 0.018, 0.4));
      x.body.add(mesh(box(0.07, 0.035, 0.02), c(0xffffff), [-0.17, 0.79, fz(0.17, 0.79) + 0.015], [-0.2, -0.5, 0], undefined, 0.5));
    },
  },
  top_hero: {
    color: 0x3a63e8, tex: 'soft', hideButtons: true, hideEmblem: true, hideTail: true,
    build: (x) => {
      // two-sided cloth: bright red outside, deeper red lining inside, gold hem piping for a crisp silhouette
      const sheet = capeGeometry();
      x.body.add(mesh(sheet, c(0xe8414f, { tex: 'fabric', rx: 2 })));
      const lining = mesh(sheet, c(0xa3263a, { tex: 'fabric', rx: 2, side: THREE.BackSide }));
      lining.userData.noOutline = true;
      x.body.add(lining);
      const gold = c(0xffcf3f, { spec: 1.1 });
      x.body.add(mesh(capeHem(), gold, undefined, undefined, undefined, 0.3));
      // shoulder clasps sit exactly on the cape's top corners
      const tl = capePoint(-1, 0, new THREE.Vector3()), tr = capePoint(1, 0, new THREE.Vector3());
      for (const p of [tl, tr]) x.body.add(mesh(SPH(), gold, [p.x, p.y - 0.01, p.z + 0.01], undefined, 0.045, 0.5));
      x.body.add(mesh(plate('herostar', (p) => starP(p, 0.1, 0.045), undefined, 0.03), gold, [0, 0.73, fz(0, 0.73) + 0.012], [-0.1, 0, 0], undefined, 0.5));
      x.body.add(mesh(torus(0.355, 0.035, 8, 36), gold, [0, 0.56, 0], [Math.PI / 2, 0, 0], [1, 0.9, 1], 0.6));
    },
  },
  top_sailor: {
    color: 0xfafbff, tex: 'fabric', hideButtons: true, hideEmblem: true,
    build: (x) => {
      const navy = c(0x2d4a8a, { tex: 'soft' });
      const white = c(0xffffff);
      const flap = mesh(box(0.46, 0.3, 0.025), navy, [0, 0.86, -0.29], [0.55, 0, 0]);
      flap.add(mesh(box(0.4, 0.016, 0.004), white, [0, -0.1, -0.015], undefined, undefined, 0.3));
      flap.add(mesh(box(0.4, 0.016, 0.004), white, [0, -0.07, -0.015], undefined, undefined, 0.3));
      x.body.add(flap);
      for (const s of [-1, 1]) x.body.add(mesh(box(0.05, 0.2, 0.02), navy, [s * 0.1, 0.85, fz(0.1, 0.85) + 0.006], [-0.5, 0, s * 0.5], undefined, 0.6));
      const red = c(0xe03a4a);
      x.body.add(mesh(cone(0.075, 0.16, 3), red, [0, 0.76, fz(0, 0.76) + 0.022], [Math.PI, 0, 0], [1, 1, 0.35], 0.6));
      x.body.add(mesh(SPH(), red, [0, 0.85, fz(0, 0.85) + 0.02], undefined, 0.035, 0.5));
    },
  },
  top_raincoat: {
    color: 0xffcf2e, tex: 'soft', hideButtons: true, hideEmblem: true,
    build: (x) => {
      hood(x, x.shirt);
      const brown = c(0x8a5a33, { spec: 0.5 });
      for (const y of [0.84, 0.72, 0.6]) x.body.add(mesh(capsule(0.017, 0.06), brown, [0, y, fz(0, y) + 0.016], [0, 0, Math.PI / 2], undefined, 0.4));
      const flapMat = c(shade(0xffcf2e, 0.86));
      for (const s of [-1, 1]) x.body.add(mesh(box(0.13, 0.035, 0.03), flapMat, [s * 0.17, 0.57, fz(0.17, 0.57) + 0.01], [0, s * 0.45, 0], undefined, 0.5));
      const skirt = mesh(cyl(0.345, 0.4, 0.2, 28, true), c(0xffcf2e, { side: THREE.DoubleSide }), [0, 0.47, 0], undefined, [1.04, 1, 1]);
      skirt.userData.noOutline = true;
      x.body.add(skirt);
    },
  },
  top_hanbok: {
    color: 0xf7b8d0, tex: 'soft', hideButtons: true, hideEmblem: true,
    build: (x) => {
      const white = c(0xffffff);
      x.body.add(mesh(capsule(0.026, 0.3), white, [0.03, 0.8, fz(0.03, 0.8) + 0.02], [-0.25, 0, -0.75], undefined, 0.5));
      x.body.add(mesh(capsule(0.026, 0.16), white, [-0.1, 0.87, fz(0.1, 0.87) + 0.015], [-0.4, 0, 0.8], undefined, 0.5));
      const red = c(0xd93a4f, { spec: 0.4 });
      x.body.add(mesh(SPH(), red, [-0.06, 0.74, fz(0.06, 0.74) + 0.03], undefined, 0.04, 0.5));
      x.body.add(mesh(capsule(0.024, 0.2), red, [-0.08, 0.6, fz(0.08, 0.6) + 0.03], [0, 0, 0.12], undefined, 0.5));
      x.body.add(mesh(capsule(0.024, 0.17), red, [-0.03, 0.62, fz(0.03, 0.62) + 0.035], [0, 0, -0.15], undefined, 0.5));
      if (!x.penguin) {
        const cols = [0xff6b6b, 0xffd23f, 0x55c49a, 0x5a8dee];
        for (const arm of [x.armL, x.armR]) {
          arm.add(mesh(capsule(0.086, 0.12), x.shirt, [0, -0.15, 0]));
          cols.forEach((col, i) => arm.add(mesh(torus(0.088, 0.016, 6, 20), c(col), [0, -0.1 - i * 0.04, 0], [Math.PI / 2, 0, 0], undefined, 0.4)));
        }
      }
    },
  },
  top_dino: {
    color: 0x78c864, tex: 'dots', hideButtons: true, hideEmblem: true, hideTail: true,
    build: (x) => {
      x.body.add(mesh(SPH(), c(0xfff0b8, { tex: 'soft' }), [0, 0.63, 0.2], undefined, [0.24, 0.29, 0.14]));
      const orange = c(0xff9f43);
      // fin-shaped spikes rooted on the actual back surface (torso / shorts / neck), pointing along its normal
      const ys = [0.86, 0.76, 0.66, 0.56, 0.47];
      const sizes = [0.8, 1, 1.12, 1, 0.82];
      ys.forEach((y, i) => {
        const tz = fz(0, y), sz = shortsZ(0, y), hz = headZ(0, y);
        const z = Math.max(tz, sz, hz);
        // outward normal of whichever surface is outermost here
        const n = z === hz ? new THREE.Vector3(0, (y - 1.28) / 0.244, -z / 0.27)
          : z === sz ? new THREE.Vector3(0, (y - 0.46) / 0.0372, -z / 0.1005)
          : new THREE.Vector3(0, (y - 0.64) / 0.1347, -z / 0.105);
        n.normalize();
        const spike = mesh(cone(0.06, 0.14, 8), orange, undefined, undefined, [0.5 * sizes[i], sizes[i], sizes[i]], 0.6);
        spike.position.set(0, y, -z).addScaledVector(n, 0.05 * sizes[i]);
        spike.quaternion.setFromUnitVectors(UP, n);
        x.body.add(spike);
      });
      // costume tail: base buried in the shorts, tip trailing back and down
      x.body.add(mesh(cone(0.12, 0.5, 14), x.shirt, [0, 0.38, -0.5], [-1.92, 0, 0]));
      x.body.add(mesh(cone(0.05, 0.1, 8), orange, [0, 0.36, -0.62], [-1.2, 0, 0], [0.5, 1, 1], 0.6));
    },
  },
};

export function topStyle(id?: string | null): TopStyle | undefined {
  return id ? TOPS[id] : undefined;
}

// =========================================================================== bottoms
// Leg groups pivot at the hip (±0.15, 0.34, 0); children ride the walk swing automatically.
// Leg capsule r .095 @ y -.13 · shoe sphere .13 scaled [1,.62,1.38] @ [0,-.27,.05] · shorts y .27….65.
export interface BottomCtx {
  body: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  pants: THREE.Material;
  penguin: boolean;
}
interface BottomStyle {
  color: number;
  tex: TexName;
  build?: (x: BottomCtx) => void;
}

/** full-length leg tube over each leg (r slightly larger than the bare leg .095) */
function legTubes(x: BottomCtx, mat: THREE.Material, r = 0.115, len = 0.14, y = -0.13) {
  for (const leg of [x.legL, x.legR]) leg.add(mesh(capsule(r, len), mat, [0, y, 0]));
}
/** ribbed cuff ring around each ankle/calf */
function cuffs(x: BottomCtx, mat: THREE.Material, y = -0.24, r = 0.118) {
  for (const leg of [x.legL, x.legR]) leg.add(mesh(torus(r, 0.024, 8, 22), mat, [0, y, 0], [Math.PI / 2, 0, 0], undefined, 0.4));
}
/** shoe cap that fully encloses the original shoe */
function shoeCaps(x: BottomCtx, mat: THREE.Material, s: V3 = [1.06, 0.72, 1.46]) {
  for (const leg of [x.legL, x.legR]) leg.add(mesh(SPH(), mat, [0, -0.27, 0.05], undefined, [0.135 * s[0], 0.135 * s[1], 0.135 * s[2]], 0.5));
}
/** waist belt ring (follows the torso/shorts ellipse) */
function belt(x: BottomCtx, mat: THREE.Material, y = 0.6, R = 0.352, t = 0.028) {
  x.body.add(mesh(torus(R, t, 8, 40), mat, [0, y, 0], [Math.PI / 2, 0, 0], [1, 0.92, 1], 0.5));
}
/** flared open skirt around the waist; legs swing freely underneath */
function skirt(x: BottomCtx, topR: number, botR: number, h: number, y: number, mat: THREE.Material) {
  const s = mesh(cyl(topR, botR, h, 36, true), mat, [0, y, 0]);
  x.body.add(s);
  return s;
}

const BOTTOMS: Record<string, BottomStyle> = {
  bot_sweats: {
    color: 0xb9c2d6, tex: 'fabric',
    build: (x) => {
      legTubes(x, x.pants);
      const white = c(0xffffff);
      for (const [leg, s] of [[x.legL, 1], [x.legR, -1]] as const) {
        leg.add(mesh(box(0.022, 0.2, 0.05), white, [s * 0.108, -0.13, 0], undefined, undefined, 0.3));
      }
      cuffs(x, c(shade(0xb9c2d6, 0.82), { tex: 'fabric', rx: 2 }));
      belt(x, c(shade(0xb9c2d6, 0.82), { tex: 'fabric', rx: 3 }));
      for (const s of [-1, 1]) {
        const z = fz(s * 0.05, 0.6);
        x.body.add(mesh(capsule(0.011, 0.09), white, [s * 0.05, 0.52, z + 0.03], [0.15, 0, 0], undefined, 0.35));
      }
    },
  },
  bot_jeans: {
    color: 0x4a6ea8, tex: 'fabric',
    build: (x) => {
      legTubes(x, x.pants);
      const cuff = c(0x8fb3e8, { tex: 'fabric', rx: 2 });
      for (const leg of [x.legL, x.legR]) leg.add(mesh(cyl(0.122, 0.122, 0.07, 20), cuff, [0, -0.25, 0], undefined, undefined, 0.4));
      belt(x, c(0x8a5a33, { spec: 0.4 }));
      const z = fz(0, 0.6);
      x.body.add(mesh(box(0.07, 0.05, 0.02), c(0xffcf3f, { spec: 1 }), [0, 0.6, z + 0.035], undefined, undefined, 0.4));
      for (const s of [-1, 1]) {
        const px = s * 0.2, py = 0.5, pz = shortsZ(px, py);
        if (pz > 0.05) x.body.add(mesh(box(0.09, 0.08, 0.02), c(shade(0x4a6ea8, 0.8)), [px, py, pz + 0.008], [0, s * 0.5, 0], undefined, 0.4));
      }
    },
  },
  bot_cargo: {
    color: 0xa89a62, tex: 'fabric',
    build: (x) => {
      // knee-length: cover thighs only, calves stay bare
      for (const leg of [x.legL, x.legR]) leg.add(mesh(capsule(0.118, 0.05), x.pants, [0, -0.05, 0]));
      const dark = c(shade(0xa89a62, 0.78));
      for (const [leg, s] of [[x.legL, 1], [x.legR, -1]] as const) {
        leg.add(mesh(box(0.03, 0.09, 0.09), dark, [s * 0.115, -0.06, 0], undefined, undefined, 0.4));
        leg.add(mesh(box(0.032, 0.025, 0.09), dark, [s * 0.115, -0.005, 0], undefined, undefined, 0.4));
      }
      belt(x, c(0x5a4a33));
    },
  },
  bot_skirt: {
    color: 0x3a4a7a, tex: 'fabric',
    build: (x) => {
      const navy = x.pants;
      skirt(x, 0.36, 0.52, 0.26, 0.42, navy);
      x.body.add(mesh(torus(0.515, 0.02, 8, 44), c(0xffffff), [0, 0.295, 0], [Math.PI / 2, 0, 0], [1, 0.92, 1], 0.4));
      // pleat ridges around the skirt
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const mx = Math.cos(a) * 0.45, mz = Math.sin(a) * 0.41;
        x.body.add(mesh(box(0.025, 0.22, 0.02), c(shade(0x3a4a7a, 0.82)), [mx, 0.42, mz], [0, -a, 0.06], undefined, 0.25));
      }
      belt(x, c(0x2b3858), 0.56, 0.35, 0.024);
      // white knee socks
      const white = c(0xffffff, { tex: 'fabric', rx: 2 });
      for (const leg of [x.legL, x.legR]) {
        leg.add(mesh(capsule(0.104, 0.1), white, [0, -0.2, 0]));
        leg.add(mesh(torus(0.105, 0.018, 6, 20), c(0xe0434f), [0, -0.13, 0], [Math.PI / 2, 0, 0], undefined, 0.35));
      }
    },
  },
  bot_tuxedo: {
    color: 0x2b2e3d, tex: 'fabric',
    build: (x) => {
      legTubes(x, x.pants);
      const gold = c(0xd8b25a, { spec: 0.8 });
      for (const [leg, s] of [[x.legL, 1], [x.legR, -1]] as const) {
        leg.add(mesh(box(0.018, 0.24, 0.03), gold, [s * 0.112, -0.13, 0.01], undefined, undefined, 0.3));
      }
      shoeCaps(x, c(0x1b1b22, { spec: 1.2 }));
      belt(x, c(0x1b1b22), 0.6, 0.35, 0.024);
    },
  },
  bot_hero: {
    color: 0x3a63e8, tex: 'soft',
    build: (x) => {
      legTubes(x, x.pants);
      const red = c(0xe8414f, { tex: 'soft' });
      const gold = c(0xffcf3f, { spec: 1.1 });
      for (const leg of [x.legL, x.legR]) {
        leg.add(mesh(cyl(0.122, 0.132, 0.2, 20), red, [0, -0.21, 0.005], undefined, undefined, 0.4));
        leg.add(mesh(torus(0.122, 0.02, 6, 22), gold, [0, -0.11, 0.005], [Math.PI / 2, 0, 0], undefined, 0.35));
      }
      shoeCaps(x, red);
      belt(x, gold, 0.6, 0.352, 0.032);
      const z = fz(0, 0.6);
      x.body.add(mesh(plate('herobuckle', (p) => starP(p, 0.045, 0.02)), gold, [0, 0.6, z + 0.03], undefined, undefined, 0.4));
    },
  },
  bot_sailor: {
    color: 0x2d4a8a, tex: 'soft',
    build: (x) => {
      skirt(x, 0.36, 0.5, 0.22, 0.44, x.pants);
      const white = c(0xffffff);
      x.body.add(mesh(torus(0.49, 0.014, 6, 44), white, [0, 0.335, 0], [Math.PI / 2, 0, 0], [1, 0.92, 1], 0.35));
      x.body.add(mesh(torus(0.475, 0.014, 6, 44), white, [0, 0.365, 0], [Math.PI / 2, 0, 0], [1, 0.92, 1], 0.35));
      // sailor bow at the waist
      const red = c(0xe03a4a);
      const z = fz(0, 0.58);
      for (const s of [-1, 1]) x.body.add(mesh(cone(0.045, 0.08, 10), red, [s * 0.045, 0.58, z + 0.03], [0.3, 0, s * Math.PI / 2], [1, 1, 0.5], 0.5));
      x.body.add(mesh(SPH(), red, [0, 0.58, z + 0.04], undefined, 0.026, 0.4));
      for (const leg of [x.legL, x.legR]) leg.add(mesh(capsule(0.104, 0.1), white, [0, -0.2, 0]));
    },
  },
  bot_rain: {
    color: 0xffcf2e, tex: 'soft',
    build: (x) => {
      for (const leg of [x.legL, x.legR]) leg.add(mesh(capsule(0.118, 0.05), x.pants, [0, -0.05, 0]));
      const yellow = c(0xffcf2e, { spec: 0.5 });
      const silver = c(0xe8eef4, { spec: 1 });
      for (const leg of [x.legL, x.legR]) {
        leg.add(mesh(cyl(0.118, 0.13, 0.2, 20), yellow, [0, -0.2, 0.005], undefined, undefined, 0.4));
        leg.add(mesh(torus(0.121, 0.016, 6, 22), silver, [0, -0.13, 0.005], [Math.PI / 2, 0, 0], undefined, 0.35));
      }
      shoeCaps(x, yellow);
    },
  },
  bot_hanbok: {
    color: 0xe8e4da, tex: 'soft',
    build: (x) => {
      // baggy baji + ankle ties
      for (const leg of [x.legL, x.legR]) leg.add(mesh(capsule(0.128, 0.1), x.pants, [0, -0.12, 0]));
      const cols = [0xff6b6b, 0x5a8dee];
      [x.legL, x.legR].forEach((leg, i) => {
        leg.add(mesh(torus(0.126, 0.02, 6, 22), c(cols[i], { spec: 0.4 }), [0, -0.22, 0], [Math.PI / 2, 0, 0], undefined, 0.4));
      });
      const black = c(0x2a2a30, { spec: 0.6 });
      shoeCaps(x, black, [1.06, 0.66, 1.5]);
      // waist tie
      const red = c(0xd93a4f, { spec: 0.4 });
      belt(x, red, 0.6, 0.35, 0.026);
      const z = fz(0, 0.6);
      x.body.add(mesh(SPH(), red, [0.06, 0.58, z + 0.035], undefined, 0.032, 0.4));
      x.body.add(mesh(capsule(0.018, 0.12), red, [0.08, 0.48, z + 0.03], [0.1, 0, 0.2], undefined, 0.35));
    },
  },
  bot_dino: {
    color: 0x78c864, tex: 'dots',
    build: (x) => {
      // matches top_dino (same green + dots): stubby dino legs with a cream belly patch and claw feet
      legTubes(x, x.pants, 0.122, 0.12, -0.13);
      const cream = c(0xfff0b8, { tex: 'soft' });
      const orange = c(0xff9f43);
      for (const leg of [x.legL, x.legR]) {
        leg.add(mesh(SPH(), cream, [0, -0.1, 0.09], undefined, [0.075, 0.11, 0.05], 0.4));
      }
      shoeCaps(x, x.pants);
      // three claws fanning off each foot
      for (const leg of [x.legL, x.legR]) {
        for (let k = -1; k <= 1; k++) {
          leg.add(mesh(cone(0.028, 0.09, 8), orange, [k * 0.07, -0.3, 0.235], [Math.PI / 2 - 0.25, 0, -k * 0.35], undefined, 0.4));
        }
      }
      // cream belly patch continuing down the shorts
      x.body.add(mesh(SPH(), cream, [0, 0.4, shortsZ(0, 0.4) - 0.06], undefined, [0.2, 0.14, 0.12]));
    },
  },
};

export function bottomStyle(id?: string | null): BottomStyle | undefined {
  return id ? BOTTOMS[id] : undefined;
}

// =========================================================================== hats (relative to head center)
const HAT_LIFT: Partial<Record<Animal, number>> = { rabbit: 0.03, cat: 0.02, fox: 0.03, deer: 0.04, bear: 0.015, panda: 0.015 };

/*
 * Head ellipsoid (in head space): semi-axes X .572 · Y .494 · Z .52, eyes span y −.05….13, brows ≈ .17.
 * Every hat below rests its rim on the head cross-section at its base height and keeps the front
 * edge above y ≈ .15 so it never covers the eyes.
 */
/** flower; `up` = direction the blossom faces (defaults to straight up) */
function flower(g: THREE.Object3D, p: V3, col: number, s = 1, up?: V3) {
  const f = new THREE.Group();
  f.position.set(p[0], p[1], p[2]);
  f.scale.setScalar(s);
  if (up) f.quaternion.setFromUnitVectors(UP, new THREE.Vector3(up[0], up[1], up[2]).normalize());
  const pm = c(col, { tex: 'soft' });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    f.add(mesh(SPH(), pm, [Math.cos(a) * 0.045, 0.01, Math.sin(a) * 0.045], undefined, [0.042, 0.02, 0.042], 0.5));
  }
  f.add(mesh(SPH(), c(0xffd84a), [0, 0.02, 0], undefined, 0.024, 0.4));
  g.add(f);
}

const HATS: Record<string, () => THREE.Group> = {
  hat_cap: () => {
    const g = new THREE.Group();
    const m = c(0xe8414f, { tex: 'fabric', rx: 2 });
    // crown hugs the head from y .17 (above the eyes) up to .57
    g.add(mesh(HALF(), m, [0, 0.17, 0], undefined, [0.6, 0.4, 0.57]));
    // visor: front half-disc whose flat edge is buried inside the crown
    g.add(mesh(cyl(0.34, 0.34, 0.035, 28, false, -Math.PI / 2, Math.PI), c(shade(0xe8414f, 0.85)), [0, 0.2, 0.42], [0.12, 0, 0], [1.15, 1, 1.05]));
    g.add(mesh(SPH(), m, [0, 0.57, 0], undefined, 0.045, 0.6));
    // logo glued to the crown surface along the ellipsoid normal
    const h = 0.17, z = 0.57 * Math.sqrt(1 - (h / 0.4) ** 2);
    g.add(faceOut(mesh(plate('capstar', (p) => starP(p, 0.07, 0.032)), c(0xffffff), undefined, undefined, undefined, 0.5), new THREE.Vector3(0, 0.17 + h, z), new THREE.Vector3(0, h / 0.16, z / 0.325).normalize(), 0.013));
    g.rotation.x = -0.12; // worn slightly back → brim clears the eyes
    return g;
  },
  hat_beanie: () => {
    const g = new THREE.Group();
    const m = c(0x5fb4f0, { tex: 'stripe', rx: 3, ry: 2 });
    g.add(mesh(HALF(), m, [0, 0.16, 0], undefined, [0.6, 0.5, 0.57]));
    g.add(mesh(torus(0.585, 0.065, 10, 40), c(0xffffff, { tex: 'fabric', rx: 4 }), [0, 0.2, 0], [Math.PI / 2, 0, 0], [1, 0.96, 1]));
    g.add(mesh(SPH(), c(0xffffff, { tex: 'fur' }), [0, 0.7, 0], undefined, 0.13));
    g.rotation.x = -0.12;
    return g;
  },
  hat_straw: () => {
    const g = new THREE.Group();
    const straw = c(0xf2d58a, { tex: 'fabric', rx: 4 });
    const red = c(0xe0434f);
    // crown base (r .46 @ y .28) matches the head cross-section, so the hat sits down instead of perching
    g.add(mesh(cyl(0.36, 0.46, 0.28, 32), straw, [0, 0.42, 0]));
    g.add(mesh(HALF(), straw, [0, 0.56, 0], undefined, [0.36, 0.07, 0.36]));
    g.add(mesh(cyl(0.86, 0.86, 0.03, 48), straw, [0, 0.3, 0]));
    g.add(mesh(cyl(0.452, 0.462, 0.07, 32), red, [0, 0.335, 0]));
    // ribbon bow on the band, facing outward
    const a = 1.0;
    const bow = new THREE.Group();
    bow.add(mesh(SPH(), red, [0, 0, 0], undefined, 0.035, 0.5));
    for (const s of [-1, 1]) {
      bow.add(mesh(SPH(), red, [s * 0.065, 0.01, -0.01], [0, 0, s * 0.35], [0.06, 0.036, 0.02], 0.5));
      bow.add(mesh(capsule(0.014, 0.08), red, [s * 0.03, -0.07, -0.01], [0, 0, s * 0.35], undefined, 0.4));
    }
    g.add(faceOut(bow, new THREE.Vector3(Math.sin(a) * 0.458, 0.335, Math.cos(a) * 0.458), new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), 0.02));
    g.rotation.set(-0.08, 0, 0.08);
    return g;
  },
  hat_crown: () => {
    const g = new THREE.Group();
    const gold = c(0xf5c542, { spec: 1.4 });
    // band bottom (r .28 @ y .44) rests right on the head
    g.add(mesh(cyl(0.3, 0.28, 0.14, 28), gold, [0, 0.51, 0]));
    const gems = [0xe0314a, 0x3a7af0, 0x3fd07a, 0xa55af0, 0xe0314a];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const x = Math.sin(a) * 0.28, z = Math.cos(a) * 0.28;
      g.add(mesh(cone(0.06, 0.17, 8), gold, [x, 0.665, z], undefined, undefined, 0.6));
      g.add(mesh(SPH(), gold, [x, 0.76, z], undefined, 0.03, 0.5));
      const n = new THREE.Vector3(Math.sin(a), 0.07, Math.cos(a)).normalize();
      g.add(faceOut(mesh(SPH(), c(gems[i], { spec: 1.6 }), undefined, undefined, [0.035, 0.035, 0.018], 0.4), new THREE.Vector3(Math.sin(a) * 0.29, 0.51, Math.cos(a) * 0.29), n, 0.006));
    }
    g.position.x = 0.03;
    g.rotation.z = -0.12;
    return g;
  },
  hat_wizard: () => {
    const g = new THREE.Group();
    const m = c(0x5b3fa8, { tex: 'soft' });
    const gold = c(0xf5c542, { spec: 1 });
    g.add(mesh(cyl(0.74, 0.74, 0.028, 44), m, [0, 0.32, 0]));
    // one seamless curved cone: straight up, then the tip droops back-left (no joints, base centred on the band)
    const cone2 = makeBent([[0, 0.31, 0], [0, 0.95, 0], [0.03, 1.2, -0.06], [-0.24, 1.37, -0.17]], 0.44, 0.022, 1);
    g.add(mesh(bentGeo('wizard', cone2), m));
    g.add(mesh(cyl(0.442, 0.452, 0.09, 36), gold, [0, 0.365, 0]));
    g.add(faceOut(mesh(box(0.11, 0.085, 0.024), c(0x3b2a6b), undefined, undefined, undefined, 0.4), new THREE.Vector3(0, 0.365, 0.452), new THREE.Vector3(0, 0, 1), 0.012));
    // stars sit ON the curved surface, facing outward & upright
    const star = plate('wizstar', (p) => starP(p, 0.07, 0.03), undefined, 0.02);
    const yellow = c(0xffe066, { emissive: 0x806010, emissiveIntensity: 0.4 });
    const spots: [number, V3, number][] = [[0.26, [0.35, 0, 1], 1], [0.43, [-0.75, 0, 0.75], 0.78], [0.58, [0.85, 0, 0.45], 0.62]];
    for (const [t, dir, s] of spots) {
      const { pos, normal } = bentSurface(cone2, t, dir);
      g.add(faceOut(mesh(star, yellow, undefined, undefined, s, 0.4), pos, normal, 0.012 * s));
    }
    g.rotation.z = 0.04;
    return g;
  },
  hat_tophat: () => {
    const g = new THREE.Group();
    const m = c(0x2a2a33, { spec: 0.5 });
    g.add(mesh(cyl(0.55, 0.55, 0.035, 36), m, [0, 0.43, 0], undefined, [1, 1, 0.92]));
    g.add(mesh(cyl(0.33, 0.31, 0.5, 30), m, [0, 0.7, 0]));
    g.add(mesh(cyl(0.335, 0.335, 0.08, 30), c(0xc8323f), [0, 0.5, 0]));
    // corsage pinned to the band, blossom facing outward
    const a = 0.75;
    flower(g, [Math.sin(a) * 0.35, 0.5, Math.cos(a) * 0.35], 0xffffff, 1.1, [Math.sin(a), 0.3, Math.cos(a)]);
    g.rotation.z = -0.1;
    return g;
  },
  hat_flower: () => {
    const g = new THREE.Group();
    g.add(mesh(torus(0.42, 0.045, 8, 40), c(0x5fae48, { tex: 'leaf' }), [0, 0.36, 0], [Math.PI / 2, 0, 0], [1.02, 0.9, 1]));
    const cols = [0xff7eb3, 0xffe05c, 0xffffff, 0xb48cff, 0xff9f5a, 0xff5d6c, 0xffffff, 0xffe05c];
    cols.forEach((col, i) => {
      const a = (i / cols.length) * Math.PI * 2;
      // blossoms tilt outward so they read from the side, not as flat discs
      flower(g, [Math.sin(a) * 0.43, 0.39, Math.cos(a) * 0.39], col, 1.25, [Math.sin(a) * 0.8, 1, Math.cos(a) * 0.8]);
    });
    g.rotation.x = -0.14;
    return g;
  },
  hat_santa: () => {
    const g = new THREE.Group();
    const red = c(0xd83040, { tex: 'fabric', rx: 2 });
    const white = c(0xffffff, { tex: 'fur' });
    // single curved tube: rises over the head then flops to the side — replaces the old broken 2-part hat
    const hat = makeBent([[0, 0.19, 0], [0, 0.74, 0], [-0.1, 0.99, -0.08], [-0.47, 0.76, -0.2]], 0.53, 0.045, 0.72);
    const body = mesh(bentGeo('santa', hat), red);
    body.scale.set(1, 1, 0.92); // match the head's elliptical cross-section
    g.add(body);
    g.add(mesh(torus(0.52, 0.09, 12, 44), white, [0, 0.23, 0], [Math.PI / 2, 0, 0], [1, 0.9, 1]));
    const tip = hat.curve.getPointAt(1);
    g.add(mesh(SPH(), white, [tip.x, tip.y, tip.z * 0.92], undefined, 0.12));
    g.rotation.x = -0.1;
    return g;
  },
  hat_pirate: () => {
    const g = new THREE.Group();
    const black = c(0x24242c);
    const gold = c(0xf5c542, { spec: 1 });
    g.add(mesh(HALF(), black, [0, 0.3, 0], undefined, [0.46, 0.36, 0.44]));
    // triangular brim (corner at the front) + three upturned walls that meet at the corners
    const tri = plate('tricorn', (p) => {
      [270, 30, 150].forEach((deg, i) => {
        const r = (deg * Math.PI) / 180;
        const x = Math.cos(r) * 0.8, y = Math.sin(r) * 0.8;
        if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
      });
      p.closePath();
    }, undefined, 0.03);
    g.add(mesh(tri, black, [0, 0.31, 0], [-Math.PI / 2, 0, 0]));
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Group();
      p.rotation.y = (i / 3) * Math.PI * 2;
      const piv = new THREE.Group();
      piv.position.set(0, 0.31, -0.4);
      piv.rotation.x = -0.32; // lean outward
      piv.add(mesh(box(1.42, 0.2, 0.035), black, [0, 0.1, 0]));
      piv.add(mesh(box(1.42, 0.024, 0.045), gold, [0, 0.2, 0], undefined, undefined, 0.4));
      p.add(piv);
      g.add(p);
    }
    // skull & crossbones on the crown, above the front corner
    const bone = c(0xffffff);
    const skull = new THREE.Group();
    skull.add(mesh(SPH(), bone, [0, 0.01, 0], undefined, [0.065, 0.06, 0.03], 0.4));
    skull.add(mesh(capsule(0.012, 0.13), bone, [0, -0.07, -0.005], [0, 0, 0.8], undefined, 0.3));
    skull.add(mesh(capsule(0.012, 0.13), bone, [0, -0.07, -0.005], [0, 0, -0.8], undefined, 0.3));
    const h = 0.25, z = 0.44 * Math.sqrt(1 - (h / 0.36) ** 2);
    g.add(faceOut(skull, new THREE.Vector3(0, 0.3 + h, z), new THREE.Vector3(0, h / 0.1296, z / 0.1936).normalize(), 0.02));
    return g;
  },
  hat_dino: () => {
    // dino hood matching top_dino / bot_dino: green + dots, stalk eyes, snout, teeth, back spikes
    const g = new THREE.Group();
    const green = c(0x78c864, { tex: 'dots' });
    const orange = c(0xff9f43);
    g.add(mesh(HALF(), green, [0, 0.15, 0], undefined, [0.64, 0.5, 0.6]));
    // scalloped hood rim
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      g.add(mesh(SPH(), green, [Math.sin(a) * 0.6, 0.17, Math.cos(a) * 0.56], undefined, 0.055, 0.4));
    }
    // stalk eyes on top
    const white = c(0xffffff, { spec: 0.4 });
    const black = c(0x1d1614, { spec: 1.3 });
    for (const s of [-1, 1]) {
      g.add(mesh(SPH(), green, [s * 0.2, 0.58, 0.14], undefined, 0.13));
      g.add(mesh(SPH(), white, [s * 0.2, 0.6, 0.21], undefined, 0.095, 0.6));
      g.add(mesh(SPH(), black, [s * 0.2, 0.61, 0.29], undefined, 0.042, 0.3));
    }
    // snout jutting over the forehead (stays above the character's eyes at y ≤ .13)
    g.add(mesh(SPH(), green, [0, 0.34, 0.52], undefined, [0.17, 0.11, 0.14]));
    const cream = c(0xfff0b8, { tex: 'soft' });
    g.add(mesh(SPH(), cream, [0, 0.29, 0.55], undefined, [0.13, 0.06, 0.09], 0.4));
    for (const s of [-1, 1]) {
      g.add(mesh(SPH(), black, [s * 0.07, 0.37, 0.63], undefined, 0.018, 0.3));
      g.add(mesh(cone(0.02, 0.045, 6), c(0xffffff), [s * 0.07, 0.26, 0.6], [Math.PI, 0, 0], undefined, 0.3));
    }
    // orange back spikes down the hood
    const spikeAt = (y: number, z: number, s: number) => {
      const sp = mesh(cone(0.06, 0.14, 8), orange, [0, y, z], undefined, [0.55 * s, s, s], 0.6);
      sp.quaternion.setFromUnitVectors(UP, new THREE.Vector3(0, 0.55, -0.85).normalize());
      g.add(sp);
    };
    spikeAt(0.62, -0.28, 1);
    spikeAt(0.5, -0.44, 0.9);
    spikeAt(0.36, -0.53, 0.75);
    g.rotation.x = -0.08;
    return g;
  },
};

export function buildHat(id: string | null | undefined, animal: Animal): THREE.Group | null {
  if (!id || !HATS[id]) return null;
  const g = HATS[id]();
  g.position.y += HAT_LIFT[animal] ?? 0;
  g.userData.costume = id;
  return g;
}

// =========================================================================== glasses (relative to head center)
const LZ = 0.56; // lens plane z
const LY = 0.05;

/**
 * Temple arm that hinges back from the frame and then wraps around the head on an ellipse 6% larger
 * than the head cross-section — the old straight rods cut through the cheeks and vanished mid-way.
 */
function templeGeo(side: 1 | -1, fromX: number, y: number) {
  return geo(`temple_${side}_${fromX}_${y.toFixed(3)}`, () => {
    const k = Math.sqrt(Math.max(0, 1 - (y / 0.494) ** 2));
    const A = 0.572 * k * 1.06, B = 0.52 * k * 1.06;
    const phi0 = Math.asin(Math.min(0.95, (fromX + 0.02) / A));
    const pts = [new THREE.Vector3(side * fromX, y, LZ - 0.012)];
    for (let i = 0; i <= 8; i++) {
      const p = phi0 + (1.5 - phi0) * (i / 8);
      pts.push(new THREE.Vector3(side * A * Math.sin(p), y + 0.005 * i, B * Math.cos(p)));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 28, 0.011, 6, false);
  });
}
function temples(g: THREE.Group, mat: THREE.Material, fromX = 0.3, y = LY + 0.02) {
  for (const s of [-1, 1] as const) g.add(mesh(templeGeo(s, fromX, y), mat, undefined, undefined, undefined, 0.3));
}
function lensPair(g: THREE.Group, frame: THREE.BufferGeometry, frameMat: THREE.Material, lens?: THREE.BufferGeometry, lensMat?: THREE.Material, dx = 0.19) {
  for (const s of [-1, 1]) {
    g.add(mesh(frame, frameMat, [s * dx, LY, LZ], undefined, undefined, 0.45));
    if (lens && lensMat) {
      const l = mesh(lens, lensMat, [s * dx, LY, LZ - 0.004]);
      l.castShadow = false;
      g.add(l);
    }
  }
}

const GLASSES: Record<string, (muzzleFront: number) => THREE.Group> = {
  gl_round: () => {
    const g = new THREE.Group();
    const gold = c(0xc8a060, { spec: 1.2 });
    lensPair(g, plate('round_f', (p) => circleP(p, 0.105), (p) => circleP(p, 0.087)), gold, plate('round_l', (p) => circleP(p, 0.088), undefined, 0.008), glass(0xdff4ff));
    g.add(mesh(torus(0.075, 0.011, 6, 14, Math.PI), gold, [0, LY + 0.02, LZ], undefined, undefined, 0.35));
    temples(g, gold);
    return g;
  },
  gl_sun: () => {
    const g = new THREE.Group();
    const gold = c(0xe8c060, { spec: 1.3 });
    lensPair(g, plate('sun_f', (p) => ellipseP(p, 0.128, 0.098), (p) => ellipseP(p, 0.116, 0.086), 0.018), gold, plate('sun_l', (p) => ellipseP(p, 0.12, 0.09), undefined, 0.02), c(0x1d2230, { spec: 1.8 }));
    g.add(rod([-0.07, LY + 0.06, LZ], [0.07, LY + 0.06, LZ], 0.011, gold));
    temples(g, gold, 0.31);
    return g;
  },
  gl_heart: () => {
    const g = new THREE.Group();
    const pink = c(0xff5fa2, { spec: 0.9 });
    lensPair(g, plate('heart_f', (p) => heartP(p, 0.12), (p) => heartP(p, 0.085), 0.03), pink, plate('heart_l', (p) => heartP(p, 0.088), undefined, 0.008), glass(0xff9ccd, 0.45), 0.2);
    g.add(rod([-0.08, LY + 0.02, LZ], [0.08, LY + 0.02, LZ], 0.013, pink, 0.4));
    temples(g, pink, 0.32);
    return g;
  },
  gl_star: () => {
    const g = new THREE.Group();
    const yellow = c(0xffd23f, { spec: 1 });
    const frame = plate('star_f', (p) => starP(p, 0.14, 0.066), (p) => starP(p, 0.095, 0.045), 0.03);
    const lens = plate('star_l', (p) => starP(p, 0.097, 0.046), undefined, 0.008);
    for (const s of [-1, 1]) {
      g.add(mesh(frame, yellow, [s * 0.2, LY, LZ], [0, 0, s * 0.15], undefined, 0.45));
      g.add(mesh(lens, glass(0xffa94d, 0.45), [s * 0.2, LY, LZ - 0.004], [0, 0, s * 0.15]));
    }
    g.add(rod([-0.08, LY + 0.02, LZ], [0.08, LY + 0.02, LZ], 0.013, yellow, 0.4));
    temples(g, yellow, 0.32);
    return g;
  },
  gl_3d: () => {
    const g = new THREE.Group();
    const white = c(0xffffff);
    const frame = plate('3d_f', (p) => rrectP(p, 0.56, 0.18, 0.05), undefined, 0.03);
    g.add(mesh(frame, white, [0, LY, LZ], undefined, undefined, 0.45));
    const lens = plate('3d_l', (p) => rrectP(p, 0.19, 0.12, 0.03), undefined, 0.01);
    g.add(mesh(lens, c(0xff3355, { spec: 1.2 }), [-0.13, LY, LZ + 0.02], undefined, undefined, 0.3));
    g.add(mesh(lens, c(0x33d6ff, { spec: 1.2 }), [0.13, LY, LZ + 0.02], undefined, undefined, 0.3));
    temples(g, white, 0.28);
    return g;
  },
  gl_goggles: () => {
    const g = new THREE.Group();
    const band = c(0x2d3748, { tex: 'fabric', rx: 4 });
    // raised to eye level (y .1) and centred on the head so big muzzles (dog / bear) no longer poke through
    g.add(mesh(torus(0.6, 0.035, 8, 48), band, [0, 0.1, 0], [Math.PI / 2, 0, 0], [1, 0.92, 1], 0.6));
    const frameG = geo('gog_f2', () => new THREE.SphereGeometry(0.615, 40, 8, Math.PI / 2 - 0.95, 1.9, Math.PI / 2 - 0.22, 0.44));
    const lensG = geo('gog_l2', () => new THREE.SphereGeometry(0.625, 36, 8, Math.PI / 2 - 0.75, 1.5, Math.PI / 2 - 0.16, 0.32));
    g.add(mesh(frameG, c(0x39424f, { side: THREE.DoubleSide }), [0, 0.1, 0], undefined, undefined, 0.4));
    g.add(mesh(lensG, c(0xff9a3c, { spec: 1.8, emissive: 0x5a1a40, emissiveIntensity: 0.35 }), [0, 0.1, 0], undefined, undefined, 0.3));
    return g;
  },
  gl_monocle: () => {
    const g = new THREE.Group();
    const gold = c(0xf0c050, { spec: 1.4 });
    g.add(mesh(plate('mono_f', (p) => circleP(p, 0.11), (p) => circleP(p, 0.09), 0.03), gold, [0.19, LY, LZ], undefined, undefined, 0.45));
    g.add(mesh(plate('mono_l', (p) => circleP(p, 0.092), undefined, 0.008), glass(0xe8f6ff, 0.35), [0.19, LY, LZ - 0.004]));
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const x = 0.28 + t * 0.2, y = LY - 0.06 - Math.sin(t * Math.PI) * 0.12 - t * 0.2, z = LZ - 0.02 - t * 0.25;
      g.add(mesh(SPH(), gold, [x, y, z], undefined, 0.014, 0.2));
    }
    return g;
  },
  gl_party: (mf) => {
    const g = new THREE.Group();
    const black = c(0x1a1a1f, { spec: 0.8 });
    lensPair(g, plate('party_f', (p) => circleP(p, 0.11), (p) => circleP(p, 0.08), 0.03), black, plate('party_l', (p) => circleP(p, 0.082), undefined, 0.008), glass(0xe8f6ff, 0.25));
    g.add(rod([-0.08, LY + 0.01, LZ], [0.08, LY + 0.01, LZ], 0.016, black, 0.4));
    const nz = Math.max(mf + 0.03, 0.6);
    g.add(mesh(SPH(), c(0xffb3a0, { spec: 0.8 }), [0, LY - 0.1, nz], undefined, [0.075, 0.09, 0.08]));
    const brown = c(0x3a2a22, { tex: 'fur' });
    for (const s of [-1, 1]) {
      g.add(mesh(SPH(), brown, [s * 0.075, LY - 0.2, nz - 0.02], [0, 0, s * 0.35], [0.09, 0.035, 0.04], 0.5));
      g.add(mesh(capsule(0.028, 0.12), brown, [s * 0.19, LY + 0.14, LZ - 0.02], [0, 0, Math.PI / 2 + s * 0.15], undefined, 0.5));
    }
    temples(g, black, 0.3);
    return g;
  },
  gl_nerd: () => {
    const g = new THREE.Group();
    const black = c(0x1a1a1f, { spec: 0.9 });
    lensPair(g, plate('nerd_f', (p) => rrectP(p, 0.21, 0.16, 0.035), (p) => rrectP(p, 0.16, 0.11, 0.02), 0.036), black, plate('nerd_l', (p) => rrectP(p, 0.162, 0.112, 0.02), undefined, 0.008), glass(0xe8f6ff, 0.28), 0.19);
    g.add(rod([-0.085, LY + 0.02, LZ], [0.085, LY + 0.02, LZ], 0.017, black, 0.4));
    g.add(mesh(box(0.045, 0.05, 0.05), c(0xffffff, { tex: 'fabric' }), [0, LY + 0.02, LZ], undefined, undefined, 0.4));
    temples(g, black, 0.3);
    return g;
  },
  gl_shutter: () => {
    const g = new THREE.Group();
    const neon = c(0xff4fd8, { spec: 0.8, emissive: 0x801060, emissiveIntensity: 0.25 });
    lensPair(g, plate('shut_f', (p) => rrectP(p, 0.23, 0.14, 0.05), (p) => rrectP(p, 0.195, 0.108, 0.035), 0.03), neon);
    for (let i = 0; i < 5; i++) {
      const y = LY - 0.042 + i * 0.021;
      g.add(mesh(box(0.6, 0.011, 0.012), neon, [0, y, LZ], undefined, undefined, 0.25));
    }
    temples(g, neon, 0.31);
    return g;
  },
};

export function buildGlasses(id: string | null | undefined, muzzleFront: number): THREE.Group | null {
  if (!id || !GLASSES[id]) return null;
  const g = GLASSES[id](muzzleFront);
  g.userData.costume = id;
  return g;
}
