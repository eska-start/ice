import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Stylized post stack (the "finish" that makes modern toon games pop):
 *  - soft HDR bloom on emissive windows, lamps, sparkles and specular glints
 *  - color grade: gentle saturation lift, warm highlights / cool shadows split-tone, light vignette
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uSat: { value: 1.1 },
    uSplit: { value: 0.035 },
    uVignette: { value: 0.28 },
    uNight: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSat, uSplit, uVignette, uNight;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D( tDiffuse, vUv );
      float l = dot( c.rgb, vec3( 0.299, 0.587, 0.114 ) );
      c.rgb = mix( vec3( l ), c.rgb, uSat );
      // split tone: warm sun in highlights, cool violet in shadows
      float hi = smoothstep( 0.55, 1.0, l );
      float lo = 1.0 - smoothstep( 0.0, 0.45, l );
      c.rgb += vec3( 1.0, 0.45, -0.6 ) * uSplit * hi * ( 1.0 - uNight );
      c.rgb += vec3( -0.35, -0.1, 0.8 ) * uSplit * lo;
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - dot( d, d ) * uVignette * 2.0;
      gl_FragColor = vec4( clamp( c.rgb, 0.0, 1.0 ), c.a );
    }
  `,
};

/** composer wrapper used by Game when quality = high */
export class ToonPost {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  grade: ShaderPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, night: boolean) {
    const size = renderer.getSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.setPixelRatio(renderer.getPixelRatio());
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), night ? 0.55 : 0.28, 0.55, night ? 0.85 : 1.15);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.grade.uniforms.uNight.value = night ? 1 : 0;
    if (night) this.grade.uniforms.uSat.value = 1.05;
    this.composer.addPass(this.grade);
  }

  setSize(w: number, h: number, pixelRatio: number) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
    this.bloom.setSize(w * pixelRatio, h * pixelRatio);
  }

  render() {
    this.composer.render();
  }

  dispose() {
    this.composer.dispose();
    this.bloom.dispose();
  }
}
