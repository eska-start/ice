import * as THREE from 'three';

/**
 * Toon / anime look: no IBL environment (cel shading needs hard directional light),
 * ACES filmic curve for punchy contrast, slightly lifted exposure.
 */
export function setupRenderer(renderer: THREE.WebGLRenderer, _scene: THREE.Scene, _envIntensity: number) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  // clear any previous env map so MeshToonMaterials light purely from scene lights
  _scene.environment = null;
  _scene.environmentIntensity = 0;
}
