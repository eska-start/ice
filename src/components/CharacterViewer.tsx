import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildCharacter, type CharModel } from '../game/character';
import { setupRenderer } from '../game/env';
import { std } from '../game/textures';
import { TOON_TIME } from '../game/toon';
import type { Animal, Outfit, Team } from '../game/types';
import { outfitKey } from '../game/costumes';

interface Props {
  animal: Animal;
  team?: Team;
  className?: string;
  /** 'modal' = full-body turntable, 'menu' = elevated hero shot on a big grassy pedestal */
  view?: 'modal' | 'menu';
  locked?: boolean;
  outfit?: Outfit | null;
}

function buildPedestal(big: boolean): THREE.Group {
  const g = new THREE.Group();
  const R = big ? 1.45 : 1.15;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.04, 0.2, 56), std(0x86cc62, { tex: 'grass', rx: 2 }));
  top.position.y = -0.1;
  top.receiveShadow = true;
  g.add(top);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.04, R - 0.12, 0.42, 56), std(0xa87448, { tex: 'stone', bump: 0.6 }));
  soil.position.y = -0.41;
  g.add(soil);
  // rounded grass lip (merged bumps instead of a flat ring)
  const lipMat = std(0x7cc257, { tex: 'leaf', rx: 1 });
  const bump = new THREE.SphereGeometry(1, 10, 8);
  const n = big ? 34 : 28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const b = new THREE.Mesh(bump, lipMat);
    const s = 0.1 + (i % 3) * 0.02;
    b.scale.set(s * 1.4, s, s * 1.1);
    b.position.set(Math.cos(a) * (R - 0.02), -0.02, Math.sin(a) * (R - 0.02));
    b.rotation.y = -a;
    g.add(b);
  }
  // grass tufts
  const tuftMat = std(0x6fbf4f, { tex: 'soft' });
  const blade = new THREE.ConeGeometry(0.03, 0.2, 4);
  for (let i = 0; i < (big ? 40 : 26); i++) {
    const a = Math.random() * Math.PI * 2, r = R * (0.55 + Math.random() * 0.4);
    for (let k = 0; k < 3; k++) {
      const t = new THREE.Mesh(blade, tuftMat);
      t.position.set(Math.cos(a) * r + (Math.random() - 0.5) * 0.06, 0.08, Math.sin(a) * r + (Math.random() - 0.5) * 0.06);
      t.rotation.set((Math.random() - 0.5) * 0.6, Math.random() * 6, (Math.random() - 0.5) * 0.6);
      g.add(t);
    }
  }
  // flowers
  const fc = [0xff7eb3, 0xffe05c, 0xffffff, 0xb48cff, 0xff9f5a, 0xff5d6c];
  const petal = new THREE.SphereGeometry(0.045, 8, 6);
  const nf = big ? 7 : 8;
  for (let i = 0; i < nf; i++) {
    const a = (i / nf) * Math.PI * 2 + 0.3;
    const r = R * (0.72 + (i % 2) * 0.16);
    const f = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 5), std(0x4f9a3f));
    stem.position.y = 0.11;
    f.add(stem);
    const leaf = new THREE.Mesh(petal, std(0x5fae48));
    leaf.scale.set(1.3, 0.35, 0.7);
    leaf.position.set(0.05, 0.07, 0);
    f.add(leaf);
    for (let k = 0; k < 5; k++) {
      const p = new THREE.Mesh(petal, std(fc[i % fc.length], { tex: 'soft' }));
      const pa = (k / 5) * Math.PI * 2;
      p.position.set(Math.cos(pa) * 0.05, 0.23, Math.sin(pa) * 0.05);
      p.scale.y = 0.5;
      f.add(p);
    }
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std(0xffe066));
    c.position.y = 0.24;
    f.add(c);
    f.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    f.scale.setScalar(big ? 1.25 : 1);
    g.add(f);
  }
  // a couple of pebbles
  const peb = std(0xcfc8c0, { tex: 'stone' });
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * Math.PI * 2, r = R * (0.5 + Math.random() * 0.4);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), peb);
    p.scale.set(1.3, 0.55, 1);
    p.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
    g.add(p);
  }
  return g;
}

/** Live 3D character turntable with idle / wave / hop animations and drag-to-rotate. */
export function CharacterViewer({ animal, team = 'blue', className, view = 'modal', locked = false, outfit = null }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const api = useRef<{ setAnimal: (a: Animal, t: Team, o: Outfit | null) => void } | null>(null);
  const oKey = outfitKey(outfit);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const menu = view === 'menu';
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'pan-y';

    const scene = new THREE.Scene();
    setupRenderer(renderer, scene, 0.65);
    const camera = new THREE.PerspectiveCamera(menu ? 30 : 28, 1, 0.1, 50);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa8d08a, 1.1));
    const key = new THREE.DirectionalLight(0xfff3e0, 2.9);
    key.position.set(2.5, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -2.2; key.shadow.camera.right = 2.2; key.shadow.camera.top = 3; key.shadow.camera.bottom = -1.5;
    key.shadow.bias = -0.0006;
    key.shadow.radius = 4;
    scene.add(key);
    // single key light keeps the 2-tone cel ramp clean; rim comes from the toon shader

    const stage = new THREE.Group();
    scene.add(stage);
    stage.add(buildPedestal(menu));

    let model: CharModel | null = null;
    let hopT = 0;
    const setAnimal = (a: Animal, t: Team, o: Outfit | null) => {
      if (model) stage.remove(model.root);
      model = buildCharacter(a, t, false, o);
      // only the body is shown here — no team ring / blob / effect meshes
      model.ring.visible = false;
      model.jellyBlob.visible = false;
      model.ice.visible = false;
      model.ufoBeam.visible = false;
      model.moto.visible = false;
      model.stars.visible = false;
      model.taggerMark.visible = false;
      model.handBag.visible = false;
      model.body.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
      if (menu) model.root.scale.setScalar(1.08);
      stage.add(model.root);
      hopT = 0.6;
    };
    api.current = { setAnimal };

    let yaw = menu ? 0.3 : 0.35, yawVel = 0, dragging = false, lastX = 0, idleT = 0;
    const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; hopT = hopT > 0 ? hopT : 0; renderer.domElement.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      yaw += dx * 0.012;
      yawVel = dx * 0.012;
      idleT = 0;
    };
    const onUp = () => { dragging = false; };
    const onTap = () => { hopT = 0.6; };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointercancel', onUp);
    renderer.domElement.addEventListener('dblclick', onTap);

    const resize = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      if (menu) {
        // elevated hero angle: pedestal top visible, character centred slightly above middle
        const halfH = 1.45, halfW = 1.6;
        const dist = Math.max(halfH / t, halfW / (t * camera.aspect));
        camera.position.set(0, 0.8 + dist * 0.3, dist);
        camera.lookAt(0, 0.62, 0);
      } else {
        const halfH = 1.35, halfW = 1.3;
        const dist = Math.max(halfH / t, halfW / (t * camera.aspect)) + 0.6;
        camera.position.set(0, 1.25 + dist * 0.12, dist);
        camera.lookAt(0, 0.95, 0);
      }
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let raf = 0, last = performance.now(), t = 0, blinkT = 2, waveT = 1.5;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      TOON_TIME.value = t;
      if (!dragging) {
        yaw += yawVel;
        yawVel *= 0.92;
        idleT += dt;
        if (idleT > 2.5) yaw += (Math.sin(t * 0.4) * 0.45 - yaw) * dt * 0.8;
      }
      stage.rotation.y = yaw;
      if (model) {
        const m = model;
        const b = m.body;
        b.position.set(0, 0, 0); b.rotation.set(0, 0, 0);
        m.head.rotation.set(0, 0, 0);
        m.armL.rotation.set(0, 0, 0.25); m.armR.rotation.set(0, 0, -0.25);
        m.legL.rotation.set(0, 0, 0); m.legR.rotation.set(0, 0, 0);
        const br = Math.sin(t * 2.4);
        b.scale.set(1 + br * 0.012, 1 - br * 0.018, 1);
        m.head.rotation.z = Math.sin(t * 1.2) * 0.06;
        m.head.rotation.y = Math.sin(t * 0.7) * 0.15;
        blinkT -= dt;
        const blink = blinkT < 0;
        if (blinkT < -0.12) blinkT = 2 + Math.random() * 2.5;
        for (const e of m.eyes) e.scale.y = blink ? 0.15 : 1.15;
        waveT -= dt;
        if (waveT < 0) {
          const k = Math.min(1, -waveT / 0.25) * Math.min(1, (1.6 + waveT) / 0.25);
          m.armL.rotation.z = 0.25 + k * 2.3;
          m.armL.rotation.x = -Math.sin(t * 14) * 0.35 * k;
          m.head.rotation.z += 0.12 * k;
          if (waveT < -1.6) waveT = 4 + Math.random() * 3;
        }
        if (hopT > 0) {
          hopT -= dt;
          const k = Math.max(0, hopT / 0.6);
          const s = Math.sin((1 - k) * Math.PI);
          b.position.y = s * 0.35;
          m.armL.rotation.z = 0.25 + s * 2.2;
          m.armR.rotation.z = -0.25 - s * 2.2;
          m.legL.rotation.x = -s * 0.5;
          m.legR.rotation.x = -s * 0.5;
        }
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      api.current = null;
    };
  }, [view]);

  useEffect(() => {
    api.current?.setAnimal(animal, team, outfit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animal, team, view, oKey]);

  return (
    <div className={className}>
      <div ref={mountRef} className="absolute inset-0" />
      {locked && (
        <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-2">
          <span className="bg-slate-900/60 backdrop-blur text-white text-[11px] font-semibold rounded-full px-3 py-1">잠긴 캐릭터 · 미리보기</span>
        </div>
      )}
    </div>
  );
}
