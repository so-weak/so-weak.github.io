/**
 * FullscreenPass — a single oversized triangle + ShaderMaterial, the
 * workhorse for every pure-fragment experiment and FBO pass in the lab.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
} from 'three'
import type { IUniform, WebGLRenderer, WebGLRenderTarget } from 'three'

const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export class FullscreenPass {
  readonly scene = new Scene()
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  readonly material: ShaderMaterial

  private readonly geometry: BufferGeometry

  constructor(fragmentShader: string, uniforms: Record<string, IUniform>) {
    this.geometry = new BufferGeometry()
    // One triangle that covers the screen: (-1,-1) (3,-1) (-1,3).
    this.geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2),
    )
    this.material = new ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
    })
    const mesh = new Mesh(this.geometry, this.material)
    mesh.frustumCulled = false
    this.scene.add(mesh)
  }

  render(renderer: WebGLRenderer, target: WebGLRenderTarget | null): void {
    renderer.setRenderTarget(target)
    renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
