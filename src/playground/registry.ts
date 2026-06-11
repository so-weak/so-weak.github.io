/**
 * The Lab index — six experiments, each a distinct rendering technique.
 * Modules are lazy-loaded so the index itself stays featherweight.
 */

import type { ExperimentEntry } from './types'

export const EXPERIMENTS: readonly ExperimentEntry[] = [
  {
    no: '001',
    title: 'MOLTEN',
    year: '2024',
    tags: ['simplex displacement', 'iridescent PBR', 'depth of field'],
    description:
      'Chrome blob displaced by 3D simplex noise in the vertex stage — normals rebuilt from displaced tangent neighbours, lit by a PMREM room environment, resolved through a depth-of-field pass.',
    controls: 'Move the cursor — stir amplitude + parallax',
    load: () => import('./experiments/molten'),
  },
  {
    no: '002',
    title: 'ADVECT',
    year: '2024',
    tags: ['ping-pong FBO', 'dye advection', 'feedback displacement'],
    description:
      'Two half-float buffers in feedback: the pointer splats velocity and dye, each frame self-advects and decays the last, and the settled field warps a line pattern behind it.',
    controls: 'Draw with the cursor or a finger',
    load: () => import('./experiments/advect'),
  },
  {
    no: '003',
    title: 'PHOSPHOR',
    year: '2025',
    tags: ['CRT emulation', 'barrel distortion', 'RGB shift'],
    description:
      'A procedural test card and wireframe knot rendered to texture, replayed through a CRT pass — curvature, triad mask, scanlines, rolling band, flicker.',
    controls: 'Cursor X — curvature · Cursor Y — chroma shift',
    load: () => import('./experiments/phosphor'),
  },
  {
    no: '004',
    title: 'DAWN',
    year: '2025',
    tags: ['domain-warped fbm', 'cosine palette', 'dithered grain'],
    description:
      'fbm fed back into its own domain, twice — the warped field indexes a slowly cycling cosine palette, finished with hash-dithered grain so the gradients never band.',
    controls: 'Cursor — drift the field · Cursor Y — warp depth',
    load: () => import('./experiments/dawn'),
  },
  {
    no: '005',
    title: 'SIGNED',
    year: '2025',
    tags: ['raymarched SDF', 'smooth min', 'soft shadows'],
    description:
      'Sphere-tracing a smooth-min blend of primitives with penumbra shadows, ambient occlusion and a fresnel rim — no geometry, one fragment shader.',
    controls: 'Cursor — orbit the camera',
    load: () => import('./experiments/signed'),
  },
  {
    no: '006',
    title: 'BOKEH',
    year: '2026',
    tags: ['GPU particles', 'size attenuation', 'circle of confusion'],
    description:
      '10,000 points with a per-vertex circle of confusion — sprite size grows and energy falls with distance from the focal plane, so focus pulls happen entirely on the GPU.',
    controls: 'Cursor Y — pull focus · Cursor X — drift',
    load: () => import('./experiments/bokeh'),
  },
]
