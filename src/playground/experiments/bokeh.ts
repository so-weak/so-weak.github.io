/**
 * 006 BOKEH — GPU particle field with shader-side depth of field.
 *
 * 10k points (3.5k mobile) with size attenuation; each vertex computes its
 * own circle of confusion against a focal plane driven by cursor Y, so the
 * focus pull is a single uniform write — no post pass, no readbacks.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
} from 'three'
import type { WebGLRenderer } from 'three'
import { damp, mapRange } from '../../utils/math'
import type { Viewport } from '../../app/Viewport'
import type { CursorNdc, Experiment, ExperimentFactory } from '../types'
import bokehVert from '../shaders/bokeh.vert'
import bokehFrag from '../shaders/bokeh.frag'

class Bokeh implements Experiment {
  private renderer!: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(55, 1, 0.1, 60)

  private geometry: BufferGeometry | null = null
  private material: ShaderMaterial | null = null
  private points: Points | null = null

  private readonly uTime = { value: 0 }
  private readonly uFocus = { value: 9 }
  private readonly uSize = { value: 14 }
  private readonly uDpr = { value: 1 }
  private readonly uBokeh = { value: 5.5 }

  init(renderer: WebGLRenderer, viewport: Viewport): void {
    this.renderer = renderer
    this.scene.background = new Color(0x0b0b0e)

    const count = viewport.isMobile ? 3500 : 10000
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      // A loose volume stretching away from the camera.
      positions[i * 3] = (Math.random() - 0.5) * 14
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8
      positions[i * 3 + 2] = -Math.random() * 18 + 3
      seeds[i] = Math.random()
    }
    this.geometry = new BufferGeometry()
    this.geometry.setAttribute('position', new BufferAttribute(positions, 3))
    this.geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))

    this.material = new ShaderMaterial({
      vertexShader: bokehVert,
      fragmentShader: bokehFrag,
      uniforms: {
        uTime: this.uTime,
        uFocus: this.uFocus,
        uSize: this.uSize,
        uDpr: this.uDpr,
        uBokeh: this.uBokeh,
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })

    this.points = new Points(this.geometry, this.material)
    this.points.frustumCulled = false
    this.scene.add(this.points)

    this.camera.position.set(0, 0, 7)
  }

  update(dt: number, elapsed: number, cursor: CursorNdc): void {
    const safeDt = Math.max(dt, 1e-4)
    this.uTime.value = elapsed

    // The signature move: cursor Y racks focus through the whole field.
    const focusTarget = mapRange(cursor.y, -1, 1, 3.5, 18, true)
    this.uFocus.value = damp(this.uFocus.value, focusTarget, 2.2, safeDt)

    // Cursor X drifts the camera; the field slowly yaws on its own.
    this.camera.position.x = damp(this.camera.position.x, cursor.x * 1.4, 2.5, safeDt)
    this.camera.position.y = damp(this.camera.position.y, cursor.y * 0.5, 2.5, safeDt)
    this.camera.lookAt(0, 0, -6)
    if (this.points) this.points.rotation.y = Math.sin(elapsed * 0.05) * 0.18

    this.renderer.setRenderTarget(null)
    this.renderer.render(this.scene, this.camera)
  }

  resize(width: number, height: number, dpr: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.uDpr.value = dpr
  }

  dispose(): void {
    if (this.points) this.scene.remove(this.points)
    this.points = null
    this.geometry?.dispose()
    this.geometry = null
    this.material?.dispose()
    this.material = null
    this.renderer.setRenderTarget(null)
  }
}

const factory: ExperimentFactory = () => new Bokeh()
export default factory
