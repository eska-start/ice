import * as THREE from 'three';
import { buildCharacter, type CharModel } from './character';
import { setupRenderer } from './env';
import { COSTUME_MAP, outfitKey } from './costumes';
import { ALL_ANIMALS, type Animal, type Outfit } from './types';

// =========================================================================== shared offscreen renderer
interface Rig { r: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera }

function makeRig(size: number): Rig {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(size, size, false);
  r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  setupRenderer(r, scene, 0.75);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c8e0, 1.15));
  const key = new THREE.DirectionalLight(0xfff3e0, 2.8);
  key.position.set(2.2, 3.5, 3.5);
  scene.add(key);
  return { r, scene, cam: new THREE.PerspectiveCamera(30, 1, 0.1, 20) };
}
function freeRig(rig: Rig) {
  rig.r.dispose();
  rig.r.forceContextLoss();
}

type Frame = 'bust' | 'top' | 'bottom' | 'hat' | 'glasses';
const _box = new THREE.Box3();
const _v = new THREE.Vector3();

function shoot(rig: Rig, m: CharModel, animal: Animal, frame: Frame): string {
  m.ring.visible = false;
  const tall = animal === 'rabbit' || animal === 'deer';
  m.root.rotation.y = frame === 'top' || frame === 'bottom' ? 0.55 : frame === 'hat' ? 0.3 : 0.26;
  rig.scene.add(m.root);
  m.root.updateMatrixWorld(true);
  const { cam } = rig;
  if (frame === 'bust') {
    const cy = tall ? 1.55 : 1.36;
    const dist = tall ? 2.75 : 2.3;
    cam.position.set(0.25, cy + 0.12, dist);
    cam.lookAt(0, cy, 0);
  } else if (frame === 'top') {
    cam.position.set(0.1, 1.0, 3.35);
    cam.lookAt(0, 0.78, 0);
  } else if (frame === 'bottom') {
    // waist → shoes, slight 3/4 angle so leg tubes, skirts and boots all read
    cam.position.set(0.35, 0.62, 2.55);
    cam.lookAt(0, 0.32, 0);
  } else {
    // fit the head + accessory
    _box.setFromObject(m.head);
    const c = _box.getCenter(_v);
    const size = _box.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.y) * (frame === 'glasses' ? 0.5 : 0.56);
    const dist = r / Math.tan(THREE.MathUtils.degToRad(15)) + 0.3;
    cam.position.set(c.x + 0.05, c.y + dist * 0.06, c.z + dist);
    cam.lookAt(c.x, c.y, c.z);
  }
  cam.updateProjectionMatrix();
  rig.r.render(rig.scene, cam);
  const url = rig.r.domElement.toDataURL('image/png');
  rig.scene.remove(m.root);
  return url;
}

// =========================================================================== plain animal portraits (sync, once)
let cache: Partial<Record<Animal, string>> | null = null;

/** real 3D head-and-shoulders portraits of every animal (transparent PNG data URLs) */
export function getPortraits(): Partial<Record<Animal, string>> {
  if (cache) return cache;
  cache = {};
  try {
    const rig = makeRig(200);
    for (const a of ALL_ANIMALS) cache[a] = shoot(rig, buildCharacter(a, 'blue', false), a, 'bust');
    freeRig(rig);
  } catch {
    /* fall back to emoji */
  }
  return cache;
}

// =========================================================================== async queue (outfit portraits + costume icons)
interface Job { key: string; animal: Animal; outfit: Outfit; frame: Frame }
const urls = new Map<string, string>();
const queued = new Set<string>();
const listeners = new Set<() => void>();
let queue: Job[] = [];
let rig: Rig | null = null;
let running = false;

function pump() {
  const job = queue.shift();
  if (!job) {
    if (rig) freeRig(rig);
    rig = null;
    running = false;
    return;
  }
  try {
    rig ??= makeRig(180);
    urls.set(job.key, shoot(rig, buildCharacter(job.animal, 'blue', false, job.outfit), job.animal, job.frame));
  } catch {
    urls.set(job.key, '');
  }
  listeners.forEach((f) => f());
  // one render per frame keeps menus responsive
  requestAnimationFrame(pump);
}

function request(job: Job) {
  if (urls.has(job.key) || queued.has(job.key)) return;
  queued.add(job.key);
  // newest requests first (what the user is looking at right now)
  queue.unshift(job);
  if (!running) {
    running = true;
    requestAnimationFrame(pump);
  }
}

export function subscribePortraits(f: () => void) {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** portrait of an animal wearing an outfit; returns undefined until rendered */
export function outfitPortrait(animal: Animal, outfit: Outfit): string | undefined {
  const key = `bust|${animal}|${outfitKey(outfit)}`;
  request({ key, animal, outfit, frame: 'bust' });
  return urls.get(key) || undefined;
}

/** icon of a single costume item worn by the given animal */
export function costumeIcon(animal: Animal, id: string): string | undefined {
  const def = COSTUME_MAP[id];
  if (!def) return undefined;
  const key = `icon|${animal}|${id}`;
  request({ key, animal, outfit: { [def.slot]: id }, frame: def.slot });
  return urls.get(key) || undefined;
}
