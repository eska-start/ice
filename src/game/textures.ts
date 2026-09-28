import * as THREE from 'three';
import { applyToon, type ToonKind, type ToonParams } from './toon';

export type { ToonKind } from './toon';

/**
 * Hand-painted style procedural textures for the toon renderer.
 *
 * Art direction (Genshin Impact environments / Zelda BotW-TotK):
 *  - albedo stays bright and low-contrast so the cel ramp does the shading
 *  - variation is painted with *hue*: warm (yellowish) lights, cool (blue-violet) darks — never flat grey noise
 *  - shapes are brush dabs & tapered strokes, not photo noise and not black ink (line art comes from the outline shader)
 *  - every texture tiles seamlessly
 * Textures are multiplied by the material color, so they are near-neutral with subtle warm/cool tints.
 */

export type TexName =
  | 'fur' | 'soft' | 'fabric' | 'stripe' | 'dots' | 'grass' | 'sand' | 'snow' | 'cobble'
  | 'wood' | 'bark' | 'shingle' | 'siding' | 'stone' | 'leaf' | 'plaster' | 'water' | 'floral';

type Draw = (ctx: CanvasRenderingContext2D, s: number, r: () => number) => void;

function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
function hash(str: string) {
  let h = 7;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) + 1;
}

const rgba = (r: number, g: number, b: number, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
const WARM = (a: number) => rgba(255, 249, 228, a);
const COOL = (a: number) => rgba(192, 204, 234, a);
const TAU = Math.PI * 2;

/** repeat a draw call across tile edges so the texture wraps seamlessly */
function wrap(s: number, x: number, y: number, m: number, fn: (x: number, y: number) => void) {
  const xs = [0], ys = [0];
  if (x < m) xs.push(s); else if (x > s - m) xs.push(-s);
  if (y < m) ys.push(s); else if (y > s - m) ys.push(-s);
  for (const ox of xs) for (const oy of ys) fn(x + ox, y + oy);
}

function dab(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number, fill: string) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.fillStyle = fill;
  c.beginPath();
  c.ellipse(0, 0, rx, ry, 0, 0, TAU);
  c.fill();
  c.restore();
}

/** tapered brush stroke (leaf / blade / hair shape) */
function stroke(c: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, w: number, fill: string) {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(0, -w / 2);
  c.quadraticCurveTo(len * 0.45, -w * 0.75, len, 0);
  c.quadraticCurveTo(len * 0.45, w * 0.75, 0, w / 2);
  c.closePath();
  c.fill();
  c.restore();
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number) {
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
}

function sparkle(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(x - r, y);
  c.quadraticCurveTo(x, y, x, y - r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.quadraticCurveTo(x, y, x, y + r);
  c.quadraticCurveTo(x, y, x - r, y);
  c.fill();
}

/** subtle twill weave (low contrast so the cel ramp stays clean) */
function twill(c: CanvasRenderingContext2D, s: number) {
  c.fillStyle = rgba(247, 246, 244);
  c.fillRect(0, 0, s, s);
  c.lineCap = 'round';
  for (let i = -s; i < s * 2; i += 7) {
    c.strokeStyle = rgba(232, 232, 240, 0.9);
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(i, 0);
    c.lineTo(i + s, s);
    c.stroke();
    c.strokeStyle = rgba(255, 254, 250, 0.7);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(i + 3, 0);
    c.lineTo(i + 3 + s, s);
    c.stroke();
  }
}

const DRAW: Record<TexName, [number, Draw]> = {
  // --------------------------------------------------------------- character surfaces (almost flat)
  fur: [256, (c, s, r) => {
    c.fillStyle = rgba(253, 251, 247);
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      const x = r() * s, y = r() * s, rx = 18 + r() * 30, ry = 12 + r() * 18, rot = r() * TAU;
      const f = i % 3 === 0 ? COOL(0.16) : WARM(0.35);
      wrap(s, x, y, rx + 4, (px, py) => dab(c, px, py, rx, ry, rot, f));
    }
    for (let i = 0; i < 360; i++) {
      const x = r() * s, y = r() * s;
      const f = r() < 0.5 ? rgba(236, 232, 238, 0.4) : rgba(255, 255, 255, 0.6);
      wrap(s, x, y, 10, (px, py) => stroke(c, px, py, 6 + r() * 5, -Math.PI / 2 + (r() - 0.5) * 0.8, 1.8, f));
    }
  }],
  soft: [128, (c, s, r) => {
    c.fillStyle = rgba(252, 251, 249);
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 12; i++) {
      const x = r() * s, y = r() * s, rx = 14 + r() * 20, ry = 10 + r() * 14, rot = r() * TAU;
      const f = i % 2 ? WARM(0.3) : COOL(0.12);
      wrap(s, x, y, rx + 2, (px, py) => dab(c, px, py, rx, ry, rot, f));
    }
  }],
  fabric: [256, (c, s) => twill(c, s)],
  stripe: [256, (c, s) => {
    twill(c, s);
    for (let y = 0; y < s; y += 64) {
      c.fillStyle = rgba(255, 255, 255);
      c.fillRect(0, y + 8, s, 22);
      c.fillStyle = rgba(222, 224, 236, 0.9);
      c.fillRect(0, y + 30, s, 3);
    }
  }],
  dots: [256, (c, s) => {
    twill(c, s);
    const n = 6, cell = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const cx = x * cell + (y % 2 ? cell : cell / 2), cy = y * cell + cell / 2;
      for (const ox of [-s, 0, s]) {
        c.fillStyle = rgba(255, 255, 255);
        c.beginPath();
        c.arc(cx + ox, cy, 9.5, 0, TAU);
        c.fill();
        c.fillStyle = rgba(224, 226, 238, 0.9);
        c.beginPath();
        c.arc(cx + ox, cy + 1.5, 9.5, 0.12 * Math.PI, 0.88 * Math.PI);
        c.arc(cx + ox, cy - 2, 9, 0.9 * Math.PI, 0.1 * Math.PI, true);
        c.fill();
      }
    }
  }],

  // full-color hibiscus print (used with a white material color so the colors survive)
  floral: [256, (c, s, r) => {
    c.fillStyle = rgba(52, 182, 170);
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      const x = r() * s, y = r() * s, len = 18 + r() * 16, ang = r() * TAU;
      const f = i % 2 ? rgba(32, 132, 104, 0.95) : rgba(96, 200, 140, 0.9);
      wrap(s, x, y, len + 4, (px, py) => stroke(c, px, py, len, ang, 9, f));
    }
    const cols: [number, number, number][] = [[255, 104, 118], [255, 212, 92], [255, 250, 244], [255, 150, 196], [255, 140, 70]];
    for (let i = 0; i < 11; i++) {
      const x = r() * s, y = r() * s, R = 13 + r() * 9, rot = r() * TAU;
      const [cr, cg, cb] = cols[i % cols.length];
      wrap(s, x, y, R * 1.3, (px, py) => {
        for (let k = 0; k < 5; k++) {
          const a = rot + (k / 5) * TAU;
          dab(c, px + Math.cos(a) * R * 0.55, py + Math.sin(a) * R * 0.55, R * 0.58, R * 0.4, a, rgba(cr, cg, cb));
          dab(c, px + Math.cos(a) * R * 0.62, py + Math.sin(a) * R * 0.62, R * 0.3, R * 0.18, a, rgba(255, 255, 255, 0.35));
        }
        dab(c, px, py, R * 0.24, R * 0.24, 0, rgba(Math.max(0, cr - 60), Math.max(0, cg - 70), Math.max(0, cb - 40)));
        dab(c, px, py, R * 0.1, R * 0.1, 0, rgba(255, 236, 120));
      });
    }
  }],

  // --------------------------------------------------------------- ground
  grass: [512, (c, s, r) => {
    c.fillStyle = rgba(236, 239, 232);
    c.fillRect(0, 0, s, s);
    // big painted light / shade patches (BotW meadow)
    for (let i = 0; i < 38; i++) {
      const x = r() * s, y = r() * s, rx = 34 + r() * 70, ry = 22 + r() * 44, rot = r() * TAU;
      const f = i % 2 ? WARM(0.42) : COOL(0.3);
      wrap(s, x, y, rx + 4, (px, py) => dab(c, px, py, rx, ry, rot, f));
    }
    // directional blade strokes in three hue-shifted tones
    for (let i = 0; i < 2300; i++) {
      const x = r() * s, y = r() * s, k = r();
      const f = k < 0.42 ? rgba(255, 255, 234, 0.55) : k < 0.8 ? rgba(216, 228, 214, 0.5) : rgba(184, 200, 214, 0.55);
      const len = 7 + r() * 8, ang = -Math.PI / 2 + (r() - 0.5) * 0.9, w = 2.4 + r() * 1.6;
      wrap(s, x, y, 18, (px, py) => stroke(c, px, py, len, ang, w, f));
    }
    // sun specks
    for (let i = 0; i < 70; i++) {
      const x = r() * s, y = r() * s;
      wrap(s, x, y, 3, (px, py) => dab(c, px, py, 1.6, 1.3, 0, rgba(255, 253, 220, 0.85)));
    }
  }],
  sand: [256, (c, s, r) => {
    c.fillStyle = rgba(247, 243, 233);
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 16; i++) {
      const x = r() * s, y = r() * s, rx = 26 + r() * 40, ry = 14 + r() * 24, rot = r() * 0.6;
      const f = i % 2 ? WARM(0.45) : COOL(0.22);
      wrap(s, x, y, rx + 4, (px, py) => dab(c, px, py, rx, ry, rot, f));
    }
    c.lineCap = 'round';
    for (let y = 10; y < s; y += 30) {
      const ph = r() * 6;
      const line = (dy: number, col: string, w: number) => {
        c.strokeStyle = col;
        c.lineWidth = w;
        c.beginPath();
        for (let x = -8; x <= s + 8; x += 10) {
          const yy = y + dy + Math.sin(x * (TAU / s) * 2 + ph) * 4;
          if (x === -8) c.moveTo(x, yy); else c.lineTo(x, yy);
        }
        c.stroke();
      };
      line(0, COOL(0.32), 3.5);
      line(3.5, WARM(0.7), 2);
    }
    for (let i = 0; i < 420; i++) {
      c.fillStyle = r() < 0.5 ? rgba(208, 204, 218, 0.55) : rgba(255, 255, 255, 0.8);
      c.fillRect(r() * s, r() * s, 2, 2);
    }
  }],
  snow: [256, (c, s, r) => {
    c.fillStyle = rgba(250, 251, 255);
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 14; i++) {
      const x = r() * s, y = r() * s, rx = 24 + r() * 44, ry = 14 + r() * 22, rot = r() * 0.5;
      wrap(s, x, y, rx + 4, (px, py) => {
        dab(c, px, py, rx, ry, rot, rgba(204, 219, 247, 0.5));
        dab(c, px - rx * 0.1, py - ry * 0.3, rx * 0.72, ry * 0.6, rot, rgba(255, 255, 255, 0.85));
      });
    }
    for (let i = 0; i < 45; i++) sparkle(c, r() * s, r() * s, 2.2 + r() * 3, rgba(255, 255, 255, 0.95));
    for (let i = 0; i < 160; i++) {
      c.fillStyle = rgba(214, 226, 248, 0.7);
      c.fillRect(r() * s, r() * s, 1.6, 1.6);
    }
  }],
  cobble: [512, (c, s, r) => {
    c.fillStyle = rgba(160, 162, 180);
    c.fillRect(0, 0, s, s);
    const n = 6, cell = s / n;
    for (let y = 0; y < n; y++) for (let x = -1; x <= n; x++) {
      const cx = (x + 0.5 + (y % 2) * 0.5) * cell + (r() - 0.5) * 10, cy = (y + 0.5) * cell + (r() - 0.5) * 10;
      const w = cell * 0.43, h = cell * 0.41;
      const tone = 240 + r() * 12;
      for (const ox of [-s, 0, s]) {
        const px = cx + ox;
        if (px < -cell || px > s + cell) continue;
        roundRect(c, px - w, cy - h, w * 2, h * 2, h * 0.62);
        c.fillStyle = rgba(tone, tone - 3, tone - 12);
        c.fill();
        c.save();
        roundRect(c, px - w, cy - h, w * 2, h * 2, h * 0.62);
        c.clip();
        dab(c, px + w * 0.25, cy + h * 0.95, w * 1.25, h * 0.85, 0, rgba(190, 198, 226, 0.85)); // cool underside
        dab(c, px - w * 0.3, cy - h * 0.45, w * 0.55, h * 0.24, -0.15, WARM(0.9)); // warm top light
        if (r() < 0.35) dab(c, px + (r() - 0.5) * w, cy + (r() - 0.5) * h, w * 0.3, h * 0.2, r() * TAU, rgba(170, 200, 150, 0.35)); // moss
        c.restore();
      }
    }
  }],

  // --------------------------------------------------------------- building materials
  wood: [256, (c, s, r) => {
    const planks = 4, ph = s / planks;
    for (let p = 0; p < planks; p++) {
      const t = 238 + r() * 12;
      c.fillStyle = rgba(t, t - 4, t - 12);
      c.fillRect(0, p * ph, s, ph);
      c.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const y0 = p * ph + 6 + r() * (ph - 12), phs = r() * 6;
        c.strokeStyle = i % 3 === 0 ? WARM(0.55) : rgba(200, 182, 170, 0.32);
        c.lineWidth = 1.4 + r() * 1.6;
        c.beginPath();
        for (let x = 0; x <= s; x += 16) {
          const yy = y0 + Math.sin(x * (TAU / s) * 2 + phs) * 2.5;
          if (x === 0) c.moveTo(x, yy); else c.lineTo(x, yy);
        }
        c.stroke();
      }
      if (r() < 0.7) {
        const kx = r() * s, ky = p * ph + ph * (0.3 + r() * 0.4);
        dab(c, kx, ky, 8, 5, 0, rgba(204, 184, 170, 0.75));
        dab(c, kx, ky, 3.5, 2.2, 0, rgba(176, 156, 150, 0.8));
      }
      c.fillStyle = rgba(150, 138, 142, 0.85);
      c.fillRect(0, p * ph, s, 3);
      c.fillStyle = WARM(0.95);
      c.fillRect(0, p * ph + 3, s, 2);
    }
  }],
  bark: [256, (c, s, r) => {
    c.fillStyle = rgba(216, 210, 210);
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 240; i++) {
      const x = r() * s, y = r() * s, k = r();
      const f = k < 0.35 ? WARM(0.5) : k < 0.75 ? rgba(180, 170, 178, 0.45) : rgba(150, 142, 156, 0.5);
      const len = 22 + r() * 40, w = 3 + r() * 4;
      wrap(s, x, y, len + 4, (px, py) => stroke(c, px, py, len, Math.PI / 2 + (r() - 0.5) * 0.15, w, f));
    }
    c.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      let x = r() * s;
      c.strokeStyle = rgba(138, 128, 142, 0.7);
      c.lineWidth = 2.5;
      c.beginPath();
      for (let y = -10; y <= s + 10; y += 24) {
        x += (r() - 0.5) * 8;
        if (y === -10) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
  }],
  shingle: [256, (c, s, r) => {
    c.fillStyle = rgba(168, 164, 180);
    c.fillRect(0, 0, s, s);
    const rows = 6, rh = s / rows, cols = 6, cw = s / cols;
    const shape = (cx: number, top: number) => {
      c.beginPath();
      c.moveTo(cx - cw / 2 + 1.5, top);
      c.lineTo(cx - cw / 2 + 1.5, top + rh * 0.55);
      c.quadraticCurveTo(cx - cw / 2 + 1.5, top + rh * 1.04, cx, top + rh * 1.04);
      c.quadraticCurveTo(cx + cw / 2 - 1.5, top + rh * 1.04, cx + cw / 2 - 1.5, top + rh * 0.55);
      c.lineTo(cx + cw / 2 - 1.5, top);
      c.closePath();
    };
    for (let y = 0; y < rows; y++) for (let x = -1; x <= cols; x++) {
      const cx = x * cw + (y % 2 ? cw / 2 : 0) + cw / 2, top = y * rh;
      const t = 242 + r() * 12;
      shape(cx, top);
      c.fillStyle = rgba(t, t - 2, t - 8);
      c.fill();
      c.save();
      shape(cx, top);
      c.clip();
      c.fillStyle = rgba(196, 202, 228, 0.8); // cool band where the row above overlaps
      c.fillRect(cx - cw, top, cw * 2, rh * 0.26);
      dab(c, cx - cw * 0.12, top + rh * 0.62, cw * 0.28, rh * 0.14, 0, WARM(0.85)); // warm sheen
      c.restore();
      c.strokeStyle = rgba(150, 142, 156, 0.75);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx - cw / 2 + 3, top + rh * 0.66);
      c.quadraticCurveTo(cx - cw / 2 + 3, top + rh * 1.02, cx, top + rh * 1.02);
      c.quadraticCurveTo(cx + cw / 2 - 3, top + rh * 1.02, cx + cw / 2 - 3, top + rh * 0.66);
      c.stroke();
    }
  }],
  siding: [256, (c, s, r) => {
    const boards = 6, bh = s / boards;
    for (let i = 0; i < boards; i++) {
      c.fillStyle = rgba(250, 248, 243);
      c.fillRect(0, i * bh, s, bh);
      for (let k = 0; k < 8; k++) {
        roundRect(c, r() * s, i * bh + 8 + r() * (bh - 18), 10 + r() * 16, 2, 1);
        c.fillStyle = rgba(232, 228, 226, 0.8);
        c.fill();
      }
      c.fillStyle = WARM(1);
      c.fillRect(0, i * bh, s, 2.5);
      c.fillStyle = rgba(204, 210, 232);
      c.fillRect(0, (i + 1) * bh - 8, s, 6);
      c.fillStyle = rgba(164, 162, 180);
      c.fillRect(0, (i + 1) * bh - 2, s, 2);
    }
  }],
  plaster: [256, (c, s, r) => {
    c.fillStyle = rgba(250, 249, 246);
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 36; i++) {
      const x = r() * s, y = r() * s, rx = 16 + r() * 34, ry = 9 + r() * 16, rot = r() * TAU;
      const f = i % 3 === 0 ? COOL(0.16) : WARM(0.4);
      wrap(s, x, y, rx + 4, (px, py) => dab(c, px, py, rx, ry, rot, f));
    }
    for (let i = 0; i < 240; i++) {
      c.fillStyle = rgba(230, 230, 238, 0.6);
      c.fillRect(r() * s, r() * s, 1.8, 1.8);
    }
  }],
  stone: [256, (c, s, r) => {
    c.fillStyle = rgba(230, 230, 234);
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      const x = r() * s, y = r() * s, rad = 18 + r() * 28, a0 = r() * TAU;
      const f = i % 2 ? WARM(0.5) : COOL(0.36);
      wrap(s, x, y, rad * 1.3, (px, py) => {
        c.fillStyle = f;
        c.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = a0 + (k / 4) * TAU + (r() - 0.5) * 0.4, rr = rad * (0.7 + r() * 0.45);
          const vx = px + Math.cos(a) * rr, vy = py + Math.sin(a) * rr;
          if (k === 0) c.moveTo(vx, vy); else c.lineTo(vx, vy);
        }
        c.closePath();
        c.fill();
      });
    }
    c.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      let x = r() * s, y = r() * s;
      c.strokeStyle = rgba(172, 174, 192, 0.65);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (r() - 0.5) * 40;
        y += (r() - 0.5) * 40;
        c.lineTo(x, y);
      }
      c.stroke();
    }
  }],

  // --------------------------------------------------------------- foliage (Genshin canopy clusters)
  leaf: [256, (c, s, r) => {
    c.fillStyle = rgba(204, 214, 214);
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 130; i++) {
      const x = r() * s, y = r() * s, R = 10 + r() * 10;
      wrap(s, x, y, R * 2.2, (px, py) => {
        dab(c, px, py + R * 0.45, R * 1.15, R * 0.85, 0, rgba(176, 196, 210, 0.7)); // cool cluster shadow
        const n = 6;
        for (let k = 0; k < n; k++) {
          const a = -Math.PI / 2 + (k / (n - 1) - 0.5) * 2.6 + Math.PI;
          const top = Math.sin(a) < -0.2;
          const f = top ? rgba(255, 255, 232, 0.95) : k % 2 ? rgba(232, 240, 230, 0.95) : rgba(214, 228, 222, 0.95);
          stroke(c, px, py, R * (0.95 + r() * 0.3), a + Math.PI, R * 0.62, f);
        }
        dab(c, px - R * 0.2, py - R * 0.35, R * 0.28, R * 0.18, -0.4, rgba(255, 253, 214, 0.9)); // sun glint
      });
    }
  }],

  // --------------------------------------------------------------- water (Wind Waker style foam)
  water: [256, (c, s, r) => {
    c.fillStyle = rgba(222, 226, 232);
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 14; i++) {
      const x = r() * s, y = r() * s, rx = 26 + r() * 36, ry = 12 + r() * 16;
      wrap(s, x, y, rx + 4, (px, py) => dab(c, px, py, rx, ry, 0, rgba(236, 244, 250, 0.45)));
    }
    c.lineCap = 'round';
    for (let i = 0; i < 30; i++) {
      const x = r() * s, y = r() * s, w = 16 + r() * 26;
      wrap(s, x, y, w + 6, (px, py) => {
        const wave = (dy: number) => {
          c.beginPath();
          c.moveTo(px, py + dy);
          c.bezierCurveTo(px + w * 0.25, py + dy - 5, px + w * 0.5, py + dy + 5, px + w * 0.75, py + dy);
          c.quadraticCurveTo(px + w * 0.88, py + dy - 3, px + w, py + dy - 1);
        };
        wave(1.5);
        c.strokeStyle = rgba(236, 246, 255, 0.6);
        c.lineWidth = 6;
        c.stroke();
        wave(0);
        c.strokeStyle = rgba(255, 255, 255, 0.95);
        c.lineWidth = 2.6;
        c.stroke();
      });
    }
    for (let i = 0; i < 24; i++) sparkle(c, r() * s, r() * s, 2 + r() * 2.5, rgba(255, 255, 255, 0.95));
  }],
};

const baseCache: Partial<Record<TexName, THREE.CanvasTexture>> = {};
const texCache: Record<string, THREE.Texture> = {};

function base(name: TexName): THREE.CanvasTexture {
  const hit = baseCache[name];
  if (hit) return hit;
  const [size, draw] = DRAW[name];
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d')!, size, rng(hash(name)));
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  baseCache[name] = t;
  return t;
}

export function tex(name: TexName, rx = 1, ry = rx): THREE.Texture {
  const key = `${name}_${rx}_${ry}`;
  if (texCache[key]) return texCache[key];
  const b = base(name);
  const t = rx === 1 && ry === 1 ? b : b.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  texCache[key] = t;
  return t;
}

export interface MatOpts {
  tex?: TexName;
  rx?: number;
  ry?: number;
  /** legacy PBR params — ignored by the toon shader, kept for API compatibility */
  rough?: number;
  bump?: number;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  vertexColors?: boolean;
  depthWrite?: boolean;
  kind?: ToonKind;
  /** stylized hard specular (eyes, nose, glossy props) */
  spec?: number;
  /** override shadow tint (hex) */
  shadow?: number;
  /** override terminator position (0..1, lower = more lit) */
  step?: number;
  rim?: number;
  /** vertex wind sway amplitude (grass / leaves) */
  wind?: number;
  windBase?: number;
  /** create a private (non-shared) instance — required when the color is mutated later */
  unique?: boolean;
}

const matCache: Record<string, THREE.MeshToonMaterial> = {};

function kindFor(o: MatOpts): ToonKind {
  if (o.kind) return o.kind;
  if (o.tex === 'leaf' || o.tex === 'grass') return 'leaf';
  if (o.tex === 'fur' || o.tex === 'soft' || o.tex === 'fabric' || o.tex === 'stripe' || o.tex === 'dots') return 'char';
  return 'world';
}

/**
 * Cached stylized toon material (MeshToonMaterial + custom cel / rim / spec lighting).
 * Keeps full support for maps, vertex colors, fog, emissive, transparency and shadow maps.
 */
export function std(color: number, o: MatOpts = {}): THREE.MeshToonMaterial {
  const kind = kindFor(o);
  const key = `${kind}_${color}_${JSON.stringify(o)}`;
  if (!o.unique && matCache[key]) return matCache[key];
  const m = new THREE.MeshToonMaterial({
    color,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide,
    vertexColors: o.vertexColors ?? false,
    depthWrite: o.depthWrite ?? true,
    fog: true,
  });
  if (o.tex) m.map = tex(o.tex, o.rx ?? 1, o.ry ?? o.rx ?? 1);
  if (o.emissive !== undefined) {
    m.emissive = new THREE.Color(o.emissive);
    m.emissiveIntensity = o.emissiveIntensity ?? 1;
  }
  const over: Partial<ToonParams> = {};
  if (o.spec !== undefined) over.spec = o.spec;
  if (o.shadow !== undefined) over.shadowTint = o.shadow;
  if (o.step !== undefined) over.step = o.step;
  if (o.rim !== undefined) over.rim = o.rim;
  if (o.wind !== undefined) over.wind = o.wind;
  if (o.windBase !== undefined) over.windBase = o.windBase;
  applyToon(m, kind, over);
  if (!o.unique) matCache[key] = m;
  return m;
}

let blobTex: THREE.Texture | null = null;
/** contact shadow: solid core with a short soft falloff (cel-friendly, cool-tinted) */
export function blobShadowTex(): THREE.Texture {
  if (blobTex) return blobTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d')!;
  const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(40,36,74,0.45)');
  gr.addColorStop(0.52, 'rgba(40,36,74,0.42)');
  gr.addColorStop(0.7, 'rgba(40,36,74,0.16)');
  gr.addColorStop(1, 'rgba(40,36,74,0)');
  c.fillStyle = gr;
  c.fillRect(0, 0, 128, 128);
  blobTex = new THREE.CanvasTexture(cv);
  return blobTex;
}

/** smooth painted sky gradient with a soft horizon glow */
export function skyTexture(top: number, mid: number, bottom: number): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = 4;
  cv.height = 512;
  const c = cv.getContext('2d')!;
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  const gr = c.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, hex(top));
  gr.addColorStop(0.55, hex(mid));
  gr.addColorStop(1, hex(bottom));
  c.fillStyle = gr;
  c.fillRect(0, 0, 4, 512);
  const glow = c.createLinearGradient(0, 300, 0, 512);
  glow.addColorStop(0, 'rgba(255,250,235,0)');
  glow.addColorStop(0.75, 'rgba(255,250,235,0.28)');
  glow.addColorStop(1, 'rgba(255,250,235,0.1)');
  c.fillStyle = glow;
  c.fillRect(0, 300, 4, 212);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
