import * as THREE from 'three';
import { makeStarGeo } from './character';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  max: number;
  grav: number;
  spin: number;
  s0: number;
  active: boolean;
}

interface FloatText {
  sprite: THREE.Sprite;
  life: number;
  vy: number;
  scale: number;
}

export type FxKind = 'snow' | 'spark' | 'star' | 'jelly' | 'fire' | 'blue' | 'ice';

export class Effects {
  scene: THREE.Scene;
  pool: Particle[] = [];
  texts: FloatText[] = [];
  geoSnow = new THREE.IcosahedronGeometry(0.08, 0);
  geoSpark = new THREE.OctahedronGeometry(0.09, 0);
  geoStar = makeStarGeo(0.11);
  geoShard = new THREE.TetrahedronGeometry(0.12, 0);
  geoRing = new THREE.RingGeometry(0.3, 0.45, 20);
  matSnow = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
  matSpark = new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true });
  matStar = new THREE.MeshBasicMaterial({ color: 0xffd93b, transparent: true });
  matJelly = new THREE.MeshBasicMaterial({ color: 0x6af08a, transparent: true });
  matFire = new THREE.MeshBasicMaterial({ color: 0xff8a3b, transparent: true });
  matBlue = new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true });
  matIce = new THREE.MeshBasicMaterial({ color: 0xd8f3ff, transparent: true, opacity: 0.9 });
  texCache: Record<string, THREE.Texture> = {};
  rings: { mesh: THREE.Mesh; life: number; max: number; grow: number }[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  private get(): Particle {
    for (const p of this.pool) if (!p.active) return p;
    if (this.pool.length > 420) return this.pool[Math.floor(Math.random() * this.pool.length)];
    const mesh = new THREE.Mesh(this.geoSnow, this.matSnow);
    this.scene.add(mesh);
    const p: Particle = { mesh, vel: new THREE.Vector3(), life: 0, max: 1, grav: 0, spin: 0, s0: 1, active: false };
    this.pool.push(p);
    return p;
  }

  emit(kind: FxKind, pos: THREE.Vector3, count: number, speed: number, life = 0.6, grav = 9, size = 1) {
    for (let i = 0; i < count; i++) {
      const p = this.get();
      p.active = true;
      const m = p.mesh;
      m.visible = true;
      switch (kind) {
        case 'snow': m.geometry = this.geoSnow; m.material = this.matSnow; break;
        case 'spark': m.geometry = this.geoSpark; m.material = this.matSpark; break;
        case 'star': m.geometry = this.geoStar; m.material = this.matStar; break;
        case 'jelly': m.geometry = this.geoSnow; m.material = this.matJelly; break;
        case 'fire': m.geometry = this.geoSnow; m.material = this.matFire; break;
        case 'blue': m.geometry = this.geoSpark; m.material = this.matBlue; break;
        case 'ice': m.geometry = this.geoShard; m.material = this.matIce; break;
      }
      m.position.copy(pos);
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * Math.PI;
      const sp = speed * (0.4 + Math.random() * 0.8);
      p.vel.set(Math.cos(th) * Math.sin(ph) * sp, Math.abs(Math.cos(ph)) * sp * 0.9 + speed * 0.25, Math.sin(th) * Math.sin(ph) * sp);
      p.life = 0;
      p.max = life * (0.6 + Math.random() * 0.6);
      p.grav = grav;
      p.spin = (Math.random() - 0.5) * 12;
      p.s0 = size * (0.6 + Math.random() * 0.8);
      m.scale.setScalar(p.s0);
    }
  }

  ring(pos: THREE.Vector3, color: number, grow = 5, life = 0.4) {
    const m = new THREE.Mesh(this.geoRing, new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    m.position.copy(pos);
    m.rotation.x = -Math.PI / 2;
    this.scene.add(m);
    this.rings.push({ mesh: m, life: 0, max: life, grow });
  }

  textTexture(text: string, color: string): THREE.Texture {
    const key = text + color;
    if (this.texCache[key]) return this.texCache[key];
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const ctx = c.getContext('2d')!;
    ctx.font = '900 60px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineJoin = 'round';
    ctx.strokeText(text, 128, 50);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 50);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    this.texCache[key] = t;
    return t;
  }

  floatText(text: string, color: string, pos: THREE.Vector3, scale = 1.6) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.textTexture(text, color), transparent: true, depthTest: false }));
    s.scale.set(scale * 2.66, scale, 1);
    s.position.copy(pos);
    s.renderOrder = 999;
    this.scene.add(s);
    this.texts.push({ sprite: s, life: 0, vy: 1.6, scale });
  }

  label(text: string, color: string, scale = 1.0): THREE.Sprite {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.textTexture(text, color), transparent: true, depthTest: false }));
    s.scale.set(scale * 2.66, scale, 1);
    s.renderOrder = 998;
    this.scene.add(s);
    return s;
  }

  removeLabel(s: THREE.Sprite) {
    this.scene.remove(s);
    s.material.dispose();
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.max) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= p.grav * dt;
      p.vel.multiplyScalar(1 - 1.5 * dt);
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.05) {
        p.mesh.position.y = 0.05;
        p.vel.y *= -0.3;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
      }
      p.mesh.rotation.x += p.spin * dt;
      p.mesh.rotation.y += p.spin * dt;
      const k = 1 - p.life / p.max;
      p.mesh.scale.setScalar(p.s0 * (0.3 + 0.7 * k));
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life += dt;
      t.sprite.position.y += t.vy * dt;
      t.vy *= 1 - 2 * dt;
      const mat = t.sprite.material as THREE.SpriteMaterial;
      mat.opacity = t.life < 0.9 ? 1 : Math.max(0, 1 - (t.life - 0.9) / 0.4);
      const pop = t.life < 0.15 ? 0.5 + (t.life / 0.15) * 0.6 : 1.1 - Math.min(0.1, t.life - 0.15);
      t.sprite.scale.set(t.scale * pop * 2.66, t.scale * pop, 1);
      if (t.life > 1.3) {
        this.scene.remove(t.sprite);
        mat.dispose();
        this.texts.splice(i, 1);
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      const k = r.life / r.max;
      r.mesh.scale.setScalar(1 + k * r.grow);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      if (k >= 1) {
        this.scene.remove(r.mesh);
        (r.mesh.material as THREE.Material).dispose();
        this.rings.splice(i, 1);
      }
    }
  }

  clearTexts() {
    for (const t of this.texts) this.scene.remove(t.sprite);
    this.texts = [];
  }
}
