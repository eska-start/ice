import * as THREE from 'three';
import { BOUNDS, pointBlocked, type Collider } from './world';

/**
 * Walkability grid + A* path finding for the AI.
 *
 * - 0.5 m cells over the play area, obstacles inflated by the character radius (+ margin)
 * - clearance map (distance to nearest wall, in cells) so paths prefer open lanes and
 *   fleeing runners avoid dead-end corners
 * - A* with octile heuristic, no corner cutting, clearance-weighted cost
 * - string-pulled (smoothed) output so the AI walks straight lines between corners
 */
export class NavGrid {
  readonly cs = 0.5;
  readonly w: number;
  readonly h: number;
  readonly ox = BOUNDS.minX;
  readonly oz = BOUNDS.minZ;
  readonly blocked: Uint8Array;
  /** chebyshev distance (cells) to the nearest blocked cell, capped at 12 */
  readonly clear: Uint8Array;
  readonly freeCount: number;

  // A* scratch (allocated once)
  private g: Float32Array;
  private came: Int32Array;
  private stamp: Uint32Array;
  private closed: Uint32Array;
  private searchId = 0;
  private heap: Int32Array;
  private heapF: Float32Array;
  private heapN = 0;

  constructor(colliders: Collider[], radius: number) {
    this.w = Math.round((BOUNDS.maxX - BOUNDS.minX) / this.cs);
    this.h = Math.round((BOUNDS.maxZ - BOUNDS.minZ) / this.cs);
    const n = this.w * this.h;
    this.blocked = new Uint8Array(n);
    this.clear = new Uint8Array(n);
    let free = 0;
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const b = pointBlocked(colliders, this.ox + (i + 0.5) * this.cs, this.oz + (j + 0.5) * this.cs, radius) ? 1 : 0;
        this.blocked[j * this.w + i] = b;
        if (!b) free++;
      }
    }
    // keep only the largest connected walkable region: sealed pockets become "walls",
    // so the AI never plans into (or wanders toward) a spot it can't leave
    const comp = new Int32Array(n).fill(-1);
    const stack = new Int32Array(n);
    let bestComp = -1, bestSize = 0, compId = 0;
    for (let k0 = 0; k0 < n; k0++) {
      if (this.blocked[k0] || comp[k0] >= 0) continue;
      let sp = 0, size = 0;
      stack[sp++] = k0;
      comp[k0] = compId;
      while (sp > 0) {
        const k = stack[--sp];
        size++;
        const i = k % this.w, j = (k - i) / this.w;
        const nb = [i > 0 ? k - 1 : -1, i < this.w - 1 ? k + 1 : -1, j > 0 ? k - this.w : -1, j < this.h - 1 ? k + this.w : -1];
        for (const nk of nb) {
          if (nk < 0 || this.blocked[nk] || comp[nk] >= 0) continue;
          comp[nk] = compId;
          stack[sp++] = nk;
        }
      }
      if (size > bestSize) { bestSize = size; bestComp = compId; }
      compId++;
    }
    for (let k = 0; k < n; k++) {
      if (!this.blocked[k] && comp[k] !== bestComp) { this.blocked[k] = 1; free--; }
    }
    this.freeCount = free;
    // multi-source BFS distance transform (8-neighbour)
    const q = new Int32Array(n);
    let qh = 0, qt = 0;
    this.clear.fill(255);
    for (let k = 0; k < n; k++) if (this.blocked[k]) { this.clear[k] = 0; q[qt++] = k; }
    while (qh < qt) {
      const k = q[qh++];
      const i = k % this.w, j = (k - i) / this.w;
      const d = this.clear[k] + 1;
      if (d > 12) continue;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= this.w || nj >= this.h) continue;
        const nk = nj * this.w + ni;
        if (this.clear[nk] > d) { this.clear[nk] = d; q[qt++] = nk; }
      }
    }
    for (let k = 0; k < n; k++) if (this.clear[k] === 255) this.clear[k] = 12;

    this.g = new Float32Array(n);
    this.came = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.heap = new Int32Array(n + 8);
    this.heapF = new Float32Array(n + 8);
  }

  // ------------------------------------------------------------ queries
  ci(x: number) { return Math.min(this.w - 1, Math.max(0, Math.floor((x - this.ox) / this.cs))); }
  cj(z: number) { return Math.min(this.h - 1, Math.max(0, Math.floor((z - this.oz) / this.cs))); }
  cx(i: number) { return this.ox + (i + 0.5) * this.cs; }
  cz(j: number) { return this.oz + (j + 0.5) * this.cs; }

  isFree(x: number, z: number) {
    if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return false;
    return this.blocked[this.cj(z) * this.w + this.ci(x)] === 0;
  }

  /** open space around a point, in meters (0 = inside an obstacle) */
  clearance(x: number, z: number) {
    return this.clear[this.cj(z) * this.w + this.ci(x)] * this.cs;
  }

  /** nearest walkable cell index (spiral search) */
  nearestFree(i: number, j: number, maxR = 12): number {
    const k0 = j * this.w + i;
    if (!this.blocked[k0]) return k0;
    for (let r = 1; r <= maxR; r++) {
      let best = -1, bd = Infinity;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= this.w || nj >= this.h) continue;
        const nk = nj * this.w + ni;
        if (this.blocked[nk]) continue;
        const d = di * di + dj * dj;
        if (d < bd) { bd = d; best = nk; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /** snap a world point to the nearest walkable cell center (or null) */
  snap(x: number, z: number): THREE.Vector2 | null {
    const k = this.nearestFree(this.ci(x), this.cj(z));
    if (k < 0) return null;
    const i = k % this.w;
    return new THREE.Vector2(this.cx(i), this.cz((k - i) / this.w));
  }

  /** straight walk possible from a to b (grid-sampled, obstacles already inflated) */
  segmentClear(ax: number, az: number, bx: number, bz: number) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / (this.cs * 0.5)));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      if (!this.isFree(ax + dx * t, az + dz * t)) return false;
    }
    return true;
  }

  // ------------------------------------------------------------ A*
  private push(k: number, f: number) {
    let i = this.heapN++;
    this.heap[i] = k;
    this.heapF[i] = f;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heapF[p] <= this.heapF[i]) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      [this.heapF[p], this.heapF[i]] = [this.heapF[i], this.heapF[p]];
      i = p;
    }
  }
  private pop(): number {
    const top = this.heap[0];
    const n = --this.heapN;
    if (n > 0) {
      this.heap[0] = this.heap[n];
      this.heapF[0] = this.heapF[n];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < n && this.heapF[l] < this.heapF[m]) m = l;
        if (r < n && this.heapF[r] < this.heapF[m]) m = r;
        if (m === i) break;
        [this.heap[m], this.heap[i]] = [this.heap[i], this.heap[m]];
        [this.heapF[m], this.heapF[i]] = [this.heapF[i], this.heapF[m]];
        i = m;
      }
    }
    return top;
  }

  /**
   * Smoothed path from (sx,sz) to (tx,tz): list of waypoints (excluding the start).
   * Returns null if unreachable.
   */
  findPath(sx: number, sz: number, tx: number, tz: number, maxExpand = 4000): THREE.Vector2[] | null {
    const s = this.nearestFree(this.ci(sx), this.cj(sz));
    const t = this.nearestFree(this.ci(tx), this.cj(tz));
    if (s < 0 || t < 0) return null;
    if (s === t) return [new THREE.Vector2(tx, tz)];
    const W = this.w;
    const ti = t % W, tj = (t - ti) / W;
    const id = ++this.searchId;
    this.heapN = 0;
    this.stamp[s] = id;
    this.g[s] = 0;
    this.came[s] = -1;
    const hfn = (k: number) => {
      const i = k % W, j = (k - i) / W;
      const dx = Math.abs(i - ti), dz = Math.abs(j - tj);
      return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz);
    };
    this.push(s, hfn(s));
    let expanded = 0, found = false;
    while (this.heapN > 0) {
      const k = this.pop();
      if (this.closed[k] === id) continue;
      this.closed[k] = id;
      if (k === t) { found = true; break; }
      if (++expanded > maxExpand) break;
      const i = k % W, j = (k - i) / W;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= this.h) continue;
        const nk = nj * W + ni;
        if (this.blocked[nk] || this.closed[nk] === id) continue;
        // no corner cutting through obstacles
        if (di && dj && (this.blocked[j * W + ni] || this.blocked[nj * W + i])) continue;
        const c = this.clear[nk];
        // prefer lanes away from walls (fewer snags on corners)
        const pen = c <= 1 ? 1.8 : c === 2 ? 0.5 : c === 3 ? 0.15 : 0;
        const ng = this.g[k] + (di && dj ? 1.4142 : 1) * (1 + pen);
        if (this.stamp[nk] !== id || ng < this.g[nk]) {
          this.stamp[nk] = id;
          this.g[nk] = ng;
          this.came[nk] = k;
          this.push(nk, ng + hfn(nk));
        }
      }
    }
    if (!found) return null;
    // reconstruct
    const cells: number[] = [];
    for (let k = t; k !== -1; k = this.came[k]) cells.push(k);
    cells.reverse();
    const pts = cells.map((k) => {
      const i = k % W;
      return new THREE.Vector2(this.cx(i), this.cz((k - i) / W));
    });
    pts[pts.length - 1] = this.isFree(tx, tz) ? new THREE.Vector2(tx, tz) : pts[pts.length - 1];
    // string pulling
    const out: THREE.Vector2[] = [];
    let ax = sx, az = sz, idx = 0;
    while (idx < pts.length - 1) {
      let far = idx + 1;
      for (let k = pts.length - 1; k > idx + 1; k--) {
        if (this.segmentClear(ax, az, pts[k].x, pts[k].y)) { far = k; break; }
      }
      out.push(pts[far]);
      ax = pts[far].x;
      az = pts[far].y;
      idx = far;
    }
    if (!out.length) out.push(pts[pts.length - 1]);
    return out;
  }

  /** random walkable point with a minimum clearance (meters) inside a ring around (x,z) */
  randomOpenPoint(x: number, z: number, rMin: number, rMax: number, minClear = 1.5, tries = 16): THREE.Vector2 | null {
    for (let n = 0; n < tries; n++) {
      const a = Math.random() * Math.PI * 2, r = rMin + Math.random() * (rMax - rMin);
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (px < BOUNDS.minX + 1 || px > BOUNDS.maxX - 1 || pz < BOUNDS.minZ + 1 || pz > BOUNDS.maxZ - 1) continue;
      if (this.isFree(px, pz) && this.clearance(px, pz) >= minClear) return new THREE.Vector2(px, pz);
    }
    return null;
  }
}
