import * as THREE from 'three';
import { pointBlocked, type WorldData } from './world';
import { std } from './textures';

/**
 * 경찰과 도둑 모드 전용 구조물(감옥 · 탈출구)과 규칙 상수.
 * 기존 맵(buildWorld)은 수정하지 않고, 이 모드일 때만 장면에 덧붙인다.
 */
export const POLICE_TIME = 180;
/** 경기 시작 후 탈출구가 열리기까지의 시간(초) */
export const EXIT_OPEN_AT = 15;
/** 경기 시작 직후 경찰이 기지에서 대기하는 시간(초) — 도둑이 먼저 달려 나간다 */
export const COP_HOLD = 4;
/** 다른 도둑이 감옥 근처에 2초간 머물러야 동료를 구출할 수 있다 */
export const RESCUE_TIME = 2.0;
/**
 * 균형 조정 — 도망자에게 '얼음' 같은 방어 수단이 없어서, 도둑이 조금 더 빠르고 경찰 대시는 더 오래 기다린다.
 * (얼음땡 술래 성능과는 별개이며, 경찰과 도둑 모드에서만 적용)
 */
export const ROBBER_SPEED = 5.6;
export const COP_DASH_CD = 3.0;
/** 감옥 중심에서 이 거리 안에 들어오면 '접근'으로 본다 */
export const RESCUE_R = 3.0;
/** 탈출구 중심에서 이 거리 안에 들어오면 탈출 */
export const EXIT_R = 1.5;

const JAIL_HALF = 1.55;
const WALL = JAIL_HALF + 0.12;

export interface PoliceField {
  jail: { x: number; z: number; slots: THREE.Vector2[] };
  exits: { x: number; z: number }[];
  reset(): void;
  update(t: number, open: boolean, rescue: number, prisoners: number): void;
}

type Colliders = WorldData['colliders'];

function squareFree(colliders: Colliders, x: number, z: number, half: number, pad: number) {
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      if (pointBlocked(colliders, x + (i * half) / 2, z + (j * half) / 2, pad)) return false;
    }
  }
  return true;
}

function ringOpen(colliders: Colliders, x: number, z: number, r: number, pad: number) {
  let blocked = 0;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    if (pointBlocked(colliders, x + Math.sin(a) * r, z + Math.cos(a) * r, pad)) blocked++;
  }
  return blocked <= 3;
}

/** 희망 위치 근처에서 기존 맵 오브젝트와 겹치지 않는 빈 자리를 찾는다 (맵마다 배치가 달라도 안전). */
function findSpot(colliders: Colliders, cx: number, cz: number, half: number, pad: number, ring = 0): THREE.Vector2 {
  const ok = (x: number, z: number) => squareFree(colliders, x, z, half, pad) && (!ring || ringOpen(colliders, x, z, ring, pad));
  if (ok(cx, cz)) return new THREE.Vector2(cx, cz);
  for (let r = 0.75; r <= 10; r += 0.75) {
    const n = Math.max(8, Math.round(r * 6));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (ok(x, z)) return new THREE.Vector2(x, z);
    }
  }
  return new THREE.Vector2(cx, cz);
}

export function buildPoliceField(scene: THREE.Scene, world: WorldData): PoliceField {
  const colliders = world.colliders;
  const jp = findSpot(colliders, -11.5, 0.5, 2.4, 0.3, 2.9);
  const exitSpots: { x: number; y: number }[] = [];
  const root = new THREE.Group();
  scene.add(root);

  // ------------------------------------------------------------ 감옥 (창살 우리)
  const jail = new THREE.Group();
  jail.position.set(jp.x, 0, jp.y);
  root.add(jail);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(WALL * 2 + 0.5, 0.14, WALL * 2 + 0.5), std(0xc3c9d6));
  floor.position.y = 0.07;
  floor.receiveShadow = true;
  jail.add(floor);

  const barMat = std(0x47506e, { emissive: 0x0d1226, emissiveIntensity: 0.5 });
  const postMat = std(0xf2b93b);
  const barGeo = new THREE.CylinderGeometry(0.055, 0.055, 2.3, 8);
  const N = 8;
  for (let i = 0; i < N; i++) {
    const t = -WALL + (i / (N - 1)) * WALL * 2;
    for (const [bx, bz] of [[t, -WALL], [t, WALL], [-WALL, t], [WALL, t]] as [number, number][]) {
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(bx, 1.25, bz);
      bar.castShadow = true;
      jail.add(bar);
    }
  }
  const railGeo = new THREE.BoxGeometry(WALL * 2 + 0.2, 0.1, 0.1);
  for (const y of [0.3, 1.3, 2.35]) {
    for (const [rx, rz, ry] of [[0, -WALL, 0], [0, WALL, 0], [-WALL, 0, Math.PI / 2], [WALL, 0, Math.PI / 2]] as [number, number, number][]) {
      const rail = new THREE.Mesh(railGeo, barMat);
      rail.position.set(rx, y, rz);
      rail.rotation.y = ry;
      jail.add(rail);
    }
  }
  const cornerGeo = new THREE.BoxGeometry(0.2, 2.6, 0.2);
  for (const [px, pz] of [[-WALL, -WALL], [WALL, -WALL], [-WALL, WALL], [WALL, WALL]] as [number, number][]) {
    const post = new THREE.Mesh(cornerGeo, postMat);
    post.position.set(px, 1.3, pz);
    post.castShadow = true;
    jail.add(post);
  }
  const sirenR = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff3b3b }));
  sirenR.position.set(-WALL, 2.78, -WALL);
  const sirenB = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), new THREE.MeshBasicMaterial({ color: 0x3b7bff }));
  sirenB.position.set(WALL, 2.78, WALL);
  jail.add(sirenR, sirenB);

  // 창살 벽은 실제 충돌체 — 캐릭터는 드나들 수 없고, 갇힌 도둑은 안에서 움직이지 못한다.
  // (AI 길찾기 격자는 이 뒤에 만들어지므로 자동으로 우회한다)
  const addWall = (x: number, z: number, hw: number, hd: number) => colliders.push({ type: 'box', x, z, hw, hd, r: 0, h: 10 });
  addWall(jp.x, jp.y - WALL, WALL + 0.15, 0.15);
  addWall(jp.x, jp.y + WALL, WALL + 0.15, 0.15);
  addWall(jp.x - WALL, jp.y, 0.15, WALL + 0.15);
  addWall(jp.x + WALL, jp.y, 0.15, WALL + 0.15);

  // 구출 범위 표시(바닥 링) + 구출 진행도(초록 원판)
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc94a, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(RESCUE_R - 0.14, RESCUE_R, 64), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(jp.x, 0.05, jp.y);
  root.add(ring);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({ color: 0x5dff8a, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(jp.x, 0.045, jp.y);
  disc.visible = false;
  root.add(disc);

  // ------------------------------------------------------------ 탈출구 (문 + 바닥 패드 + 빛기둥)
  const gateMat = std(0xd94b4b, { emissive: 0xd94b4b, emissiveIntensity: 0.7, unique: true });
  const padMat = new THREE.MeshBasicMaterial({ color: 0xff6b6b, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xff6b6b, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0x5dff8a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const postGeo = new THREE.CylinderGeometry(0.14, 0.17, 2.9, 10);
  const beamGeo = new THREE.BoxGeometry(2.8, 0.3, 0.3);
  const padGeo = new THREE.CircleGeometry(EXIT_R, 40);
  const edgeGeo = new THREE.RingGeometry(EXIT_R - 0.16, EXIT_R, 48);
  const lightGeo = new THREE.CylinderGeometry(EXIT_R * 0.8, EXIT_R * 0.8, 6, 24, 1, true);
  for (const p of exitSpots) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.y);
    g.rotation.y = Math.atan2(-p.x, -p.y); // 문이 맵 중앙을 향하도록
    root.add(g);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, gateMat);
      post.position.set(s * 1.15, 1.45, 0);
      post.castShadow = true;
      g.add(post);
    }
    const beam = new THREE.Mesh(beamGeo, gateMat);
    beam.position.set(0, 2.95, 0);
    g.add(beam);
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.04;
    g.add(pad);
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.y = 0.06;
    g.add(edge);
    const light = new THREE.Mesh(lightGeo, lightMat);
    light.position.y = 3;
    g.add(light);
  }

  let lastOpen: boolean | null = null;
  const applyOpen = (open: boolean) => {
    const col = open ? 0x39d96c : 0xd94b4b;
    gateMat.color.setHex(col);
    gateMat.emissive.setHex(col);
    const glow = open ? 0x5dff8a : 0xff6b6b;
    padMat.color.setHex(glow);
    edgeMat.color.setHex(glow);
    lastOpen = open;
  };
  applyOpen(false);

  world.jail = { x: jp.x, z: jp.y, r: JAIL_HALF, rx: jp.x, rz: jp.y, exitX: jp.x, exitZ: jp.y + RESCUE_R + 0.3, sign: 1 };

  return {
    jail: {
      x: jp.x,
      z: jp.y,
      // 감옥 안에서 체포된 도둑이 서는 자리 (중심 기준 오프셋)
      slots: [new THREE.Vector2(-0.75, -0.5), new THREE.Vector2(0.75, -0.5), new THREE.Vector2(0, 0.72)],
    },
    exits: exitSpots.map((p) => ({ x: p.x, z: p.y })),
    reset() {
      applyOpen(false);
      disc.visible = false;
    },
    update(t, open, rescue, prisoners) {
      if (open !== lastOpen) applyOpen(open);
      const pulse = 0.5 + 0.5 * Math.sin(t * 4);
      lightMat.opacity = open ? 0.14 + 0.1 * pulse : 0;
      edgeMat.opacity = open ? 0.7 + 0.3 * pulse : 0.45;
      padMat.opacity = open ? 0.26 + 0.12 * pulse : 0.14;
      ringMat.opacity = prisoners > 0 ? 0.35 + 0.35 * pulse : 0.16;
      disc.visible = rescue > 0.01;
      disc.scale.setScalar(Math.max(0.01, RESCUE_R * rescue));
      const flip = Math.sin(t * 9) > 0;
      (sirenR.material as THREE.MeshBasicMaterial).color.setHex(flip ? 0xff3b3b : 0x4a1515);
      (sirenB.material as THREE.MeshBasicMaterial).color.setHex(flip ? 0x152a4a : 0x3b7bff);
    },
  };
}
