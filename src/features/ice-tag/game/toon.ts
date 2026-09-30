import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Modern stylized toon rendering, modelled on techniques used by acclaimed cel-shaded games:
 *
 *  - Genshin Impact / Honkai: Star Rail — 2-tone cel ramp with *hue-shifted, saturated* shadows
 *    (shadows are never grey), crisp anti-aliased terminator, colored line art (outline = darkened base color),
 *    stylized hard specular on glossy bits (eyes, nose).
 *  - Zelda: Breath of the Wild / Tears of the Kingdom — view-based "sun-kissed" rim light on silhouettes,
 *    wind-animated grass & foliage, painterly environment textures, atmospheric color fog.
 *  - Shared post: soft bloom + warm-highlight / cool-shadow color grade + light vignette (see Game.ts).
 */

/** shared clock (seconds) for vertex wind — updated by Game / viewers each frame */
export const TOON_TIME = { value: 0 };

export type ToonKind = 'char' | 'world' | 'leaf';

export interface ToonParams {
  /** multiplied into the albedo on the shadow side (Genshin-style tinted shadow) */
  shadowTint: number;
  /** saturation boost for the shadow color (>1 = richer shadows) */
  shadowSat: number;
  /** how much direct light remains on the shadow side */
  shadowLevel: number;
  /** terminator position in half-lambert space (lower = more lit area) */
  step: number;
  rim: number;
  rimColor: number;
  spec: number;
  wind: number;
  windBase: number;
}

export const TOON_DEFAULTS: Record<ToonKind, ToonParams> = {
  // warm rose-violet shadows keep fur & skin cute and clean (anime faces are mostly lit)
  char: { shadowTint: 0xd6b0cc, shadowSat: 1.32, shadowLevel: 0.46, step: 0.36, rim: 0.34, rimColor: 0xfff3e2, spec: 0, wind: 0, windBase: 0 },
  // cool blue-violet ambient-occlusion look for buildings and props
  world: { shadowTint: 0xa9b3e2, shadowSat: 1.16, shadowLevel: 0.42, step: 0.47, rim: 0.1, rimColor: 0xfff0d6, spec: 0, wind: 0, windBase: 0 },
  // teal-shifted foliage shadows + yellow sun-kissed rims
  leaf: { shadowTint: 0x8fbac8, shadowSat: 1.22, shadowLevel: 0.5, step: 0.43, rim: 0.22, rimColor: 0xfff8c8, spec: 0, wind: 0, windBase: 0 },
};

// --------------------------------------------------------------------------- cel lighting chunk
const TOON_LIGHTS = /* glsl */ `
varying vec3 vViewPosition;
uniform vec3 uShadowTint;
uniform float uShadowSat;
uniform float uShadowLevel;
uniform float uStep;
uniform float uRim;
uniform vec3 uRimColor;
uniform float uSpec;

struct ToonMaterial {
  vec3 diffuseColor;
};

vec3 toonShadowColor( const in vec3 c ) {
  vec3 s = c * uShadowTint;
  float l = dot( s, vec3( 0.299, 0.587, 0.114 ) );
  return max( mix( vec3( l ), s, uShadowSat ), 0.0 );
}

void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
  float x = dot( geometryNormal, directLight.direction ) * 0.5 + 0.5;
  float aa = max( fwidth( x ), 0.0015 ) * 1.25;
  float lit = smoothstep( uStep - aa, uStep + aa, x );
  vec3 base = mix( toonShadowColor( material.diffuseColor ) * uShadowLevel, material.diffuseColor, lit );
  reflectedLight.directDiffuse += directLight.color * BRDF_Lambert( base );
  if ( uSpec > 0.0 ) {
    vec3 H = normalize( directLight.direction + geometryViewDir );
    float nh = max( dot( geometryNormal, H ), 0.0 );
    float saa = max( fwidth( nh ), 0.001 );
    float s = smoothstep( 0.968 - saa, 0.968 + saa, nh ) * lit;
    reflectedLight.directDiffuse += directLight.color * s * uSpec * 0.32;
  }
}

void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
  reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( toonShadowColor( material.diffuseColor ) );
  // BotW / Genshin style rim: crisp fresnel band, biased toward the sky-facing edge
  float fr = 1.0 - clamp( dot( geometryNormal, geometryViewDir ), 0.0, 1.0 );
  float faa = max( fwidth( fr ), 0.002 );
  float rim = smoothstep( 0.64 - faa, 0.64 + faa, fr ) * smoothstep( -0.3, 0.5, geometryNormal.y );
  reflectedLight.indirectDiffuse += material.diffuseColor * uRimColor * rim * uRim;
}

#define RE_Direct RE_Direct_Toon
#define RE_IndirectDiffuse RE_IndirectDiffuse_Toon
`;

const WIND_VERTEX = /* glsl */ `
#include <begin_vertex>
{
  vec4 wpW = modelMatrix * vec4( transformed, 1.0 );
  float hW = max( transformed.y - uWindBase, 0.0 );
  float ph = uTime * 1.6 + wpW.x * 0.33 + wpW.z * 0.27;
  float gust = 0.65 + 0.35 * sin( uTime * 0.45 + wpW.x * 0.05 );
  transformed.x += sin( ph ) * hW * uWind * gust;
  transformed.z += cos( ph * 0.83 + 1.3 ) * hW * uWind * 0.55 * gust;
}
`;

/** Upgrade a MeshToonMaterial with the custom cel/rim/spec lighting (and optional wind). */
export function applyToon(m: THREE.MeshToonMaterial, kind: ToonKind, over: Partial<ToonParams> = {}) {
  const p = { ...TOON_DEFAULTS[kind], ...over };
  const u = {
    uShadowTint: { value: new THREE.Color(p.shadowTint) },
    uShadowSat: { value: p.shadowSat },
    uShadowLevel: { value: p.shadowLevel },
    uStep: { value: p.step },
    uRim: { value: p.rim },
    uRimColor: { value: new THREE.Color(p.rimColor) },
    uSpec: { value: p.spec },
    uWind: { value: p.wind },
    uWindBase: { value: p.windBase },
    uTime: TOON_TIME,
  };
  m.userData.toon = u;
  const wind = p.wind > 0;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_toon_pars_fragment>', TOON_LIGHTS);
    if (wind) {
      shader.vertexShader = 'uniform float uTime;\nuniform float uWind;\nuniform float uWindBase;\n' + shader.vertexShader.replace('#include <begin_vertex>', WIND_VERTEX);
    }
  };
  m.customProgramCacheKey = () => (wind ? 'toon-x-wind' : 'toon-x');
  return m;
}

// --------------------------------------------------------------------------- colored line art (outlines)
const OUTLINE_SKIN = 0.03;
const OUTLINE_WORLD = 0.024;

const OUTLINE_VERT = /* glsl */ `
uniform float thickness;
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  vec3 n = normalize( normalMatrix * normal );
  float dist = max( -mvPosition.z, 0.1 );
  // roughly constant on-screen width, clamped so far props don't get chunky lines
  float w = thickness * clamp( dist / 14.0, 0.45, 1.7 );
  mvPosition.xyz += n * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const OUTLINE_FRAG = /* glsl */ `
uniform vec3 color;
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4( color, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

const outlineShaders = new Map<string, THREE.ShaderMaterial>();
function outlineMaterial(color: THREE.Color, thickness: number) {
  const key = `${color.getHexString()}_${thickness.toFixed(4)}`;
  let m = outlineShaders.get(key);
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { color: { value: color.clone() }, thickness: { value: thickness } }]),
      vertexShader: OUTLINE_VERT,
      fragmentShader: OUTLINE_FRAG,
      side: THREE.BackSide,
      fog: true,
    });
    outlineShaders.set(key, m);
  }
  return m;
}

const _hsl = { h: 0, s: 0, l: 0 };
/** Genshin-style line color: darkened, slightly more saturated version of the surface color. */
function lineColorFor(mesh: THREE.Mesh, fallback: number): THREE.Color {
  const out = new THREE.Color(fallback);
  if (mesh.userData.outlineColor !== undefined) return out.setHex(mesh.userData.outlineColor);
  const mat = mesh.material as THREE.MeshToonMaterial;
  if (!mat || !mat.color || mat.vertexColors) return out;
  const c = mat.color.clone();
  c.getHSL(_hsl);
  if (_hsl.l > 0.93 && _hsl.s < 0.05 && mat.map) return out; // white + texture → use fallback line
  c.setHSL(_hsl.h, Math.min(0.95, _hsl.s * 1.15 + 0.08), Math.min(_hsl.l * 0.3, 0.2));
  return c.lerp(out, 0.3);
}

/** welded, smooth-normal copy so boxes / cylinders get unbroken hull outlines */
const smoothCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function smoothOutlineGeometry(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const hit = smoothCache.get(geo);
  if (hit) return hit;
  let out: THREE.BufferGeometry = geo;
  try {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', geo.attributes.position);
    if (geo.index) g.setIndex(geo.index);
    const welded = mergeVertices(g, 1e-4);
    welded.computeVertexNormals();
    out = welded;
  } catch {
    out = geo;
  }
  smoothCache.set(geo, out);
  return out;
}

/**
 * Attach inverted-hull outline meshes as children of each solid mesh.
 * View-space normal extrusion, distance-compensated width, colored lines, fog-aware.
 */
export function addOutlines(root: THREE.Object3D, opts: { color?: number; thickness?: number } = {}) {
  const fallback = opts.color ?? 0x1a1428;
  const thickness = opts.thickness ?? OUTLINE_SKIN;
  const targets: THREE.Mesh[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.isOutline || mesh.userData.noOutline) return;
    if (Array.isArray(mesh.material)) return;
    const m = mesh.material as THREE.Material & { opacity?: number };
    if (m.transparent && (m.opacity ?? 1) < 0.95) return;
    if (m.side === THREE.BackSide) return;
    const t = mesh.geometry.type;
    if (t === 'RingGeometry' || t === 'PlaneGeometry' || t === 'CircleGeometry') return;
    targets.push(mesh);
  });
  for (const mesh of targets) {
    const th = (mesh.userData.outlineScale ?? 1) * thickness;
    const outline = new THREE.Mesh(smoothOutlineGeometry(mesh.geometry), outlineMaterial(lineColorFor(mesh, fallback), th));
    outline.userData.isOutline = true;
    outline.castShadow = false;
    outline.receiveShadow = false;
    outline.renderOrder = -1;
    outline.frustumCulled = mesh.frustumCulled;
    mesh.add(outline);
  }
}

export function addWorldOutlines(root: THREE.Object3D, color = 0x1c2030) {
  addOutlines(root, { color, thickness: OUTLINE_WORLD });
}

export function addCharOutlines(root: THREE.Object3D) {
  addOutlines(root, { color: 0x2a1a34, thickness: OUTLINE_SKIN });
}

// keep tree-shaking happy for consumers that merge outline hulls themselves
export { mergeGeometries };
