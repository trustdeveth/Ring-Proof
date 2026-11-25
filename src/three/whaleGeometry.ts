import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'

/**
 * Procedural low-poly whale. Built along the X axis: head at +X, tail at -X.
 * All parts are baked into one geometry so a single vertex shader can bend
 * the whole body consistently (tail stroke undulation).
 */
export function buildWhaleGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []

  // ---- Body (lathe around Y, then rotated so Y -> X) -------------------
  const profile: [number, number][] = [
    [0.0, -2.05],
    [0.1, -1.85],
    [0.18, -1.55],
    [0.3, -1.1],
    [0.45, -0.55],
    [0.58, 0.0],
    [0.66, 0.5],
    [0.68, 0.95],
    [0.63, 1.35],
    [0.52, 1.7],
    [0.34, 1.98],
    [0.14, 2.14],
    [0.0, 2.18],
  ]
  const body = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    28,
  )
  body.rotateZ(-Math.PI / 2) // Y axis -> X axis
  body.scale(1, 0.95, 1.1) // chunky, slightly wider than tall
  // Flatten the belly a bit and push the jaw line down
  {
    const pos = body.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      let y = pos.getY(i)
      if (y < 0) y *= 0.86
      if (x > 1.2 && y < 0) y -= 0.05 * (x - 1.2)
      pos.setY(i, y)
    }
    body.computeVertexNormals()
  }
  parts.push(body)

  const extrude = (shape: THREE.Shape, depth: number) =>
    new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 1,
      curveSegments: 14,
    })

  // ---- Tail flukes (horizontal) ---------------------------------------
  const fluke = new THREE.Shape()
  fluke.moveTo(0.12, 0)
  fluke.bezierCurveTo(-0.08, 0.28, -0.35, 0.72, -0.78, 0.98)
  fluke.bezierCurveTo(-0.62, 0.62, -0.56, 0.3, -0.44, 0.0)
  fluke.bezierCurveTo(-0.56, -0.3, -0.62, -0.62, -0.78, -0.98)
  fluke.bezierCurveTo(-0.35, -0.72, -0.08, -0.28, 0.12, 0)
  const flukeGeo = extrude(fluke, 0.03)
  flukeGeo.translate(0, 0, -0.015)
  flukeGeo.rotateX(Math.PI / 2) // shape Y -> world Z (horizontal)
  flukeGeo.translate(-1.95, 0, 0)
  parts.push(flukeGeo)

  // ---- Pectoral fins (long, humpback-ish) -------------------------------
  const fin = new THREE.Shape()
  fin.moveTo(0, 0)
  fin.bezierCurveTo(-0.12, 0.22, -0.7, 0.2, -1.05, 0.04)
  fin.bezierCurveTo(-0.75, -0.1, -0.3, -0.18, 0, 0)
  const finR = extrude(fin, 0.025)
  finR.rotateX(Math.PI / 2)
  finR.rotateY(1.0)
  finR.rotateX(0.45)
  finR.translate(0.85, -0.32, 0.6)
  const finL = finR.clone()
  finL.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, -1))
  parts.push(finR, finL)

  // ---- Dorsal fin -----------------------------------------------------
  const dorsal = new THREE.Shape()
  dorsal.moveTo(0.25, 0)
  dorsal.bezierCurveTo(0.05, 0.08, -0.12, 0.2, -0.22, 0.26)
  dorsal.bezierCurveTo(-0.2, 0.14, -0.22, 0.05, -0.28, 0)
  dorsal.lineTo(0.25, 0)
  const dorsalGeo = extrude(dorsal, 0.03)
  dorsalGeo.translate(-0.95, 0.35, -0.015)
  parts.push(dorsalGeo)

  // Normalise attributes so merge works (lathe has uv, extrude has uv; drop all but position+normal)
  const cleaned = parts.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g
    const out = new THREE.BufferGeometry()
    out.setAttribute('position', ng.attributes.position)
    out.setAttribute('normal', ng.attributes.normal)
    return out
  })
  const merged = mergeGeometries(cleaned, false)!
  merged.computeBoundingSphere()
  return merged
}

/** Sample points on the whale surface for the "encrypted" particle version. */
export function sampleWhalePoints(geo: THREE.BufferGeometry, count: number) {
  const mesh = new THREE.Mesh(geo)
  const sampler = new MeshSurfaceSampler(mesh).build()
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  const p = new THREE.Vector3()
  for (let i = 0; i < count; i++) {
    sampler.sample(p)
    positions.set([p.x, p.y, p.z], i * 3)
    seeds[i] = Math.random()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  return g
}
