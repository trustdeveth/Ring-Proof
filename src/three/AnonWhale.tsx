import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

/**
 * "Anon Whale" — a chubby vinyl-toy whale mascot, built procedurally.
 *
 * Built in "lathe space": body axis = +Y (tail at -Y, nose at +Y). The root group rotates it so the
 * nose points along +X. In lathe space: world-up = -X, belly = +X, sides = ±Z.
 *
 * Driven by a mutable `ctl` object (no React re-renders): shades 0..1 drops the pixel glasses,
 * coins 0..1 shows the orbiting $PROOF bag, swim scales the tail-beat speed.
 */

export type WhaleCtl = { shades: number; coins: number; swim: number; lookX: number; lookY: number }
export const makeCtl = (): WhaleCtl => ({ shades: 0, coins: 0, swim: 1, lookX: 0, lookY: 0 })

const COL = {
  top: new THREE.Color('#2f66ff'),
  topDeep: new THREE.Color('#1a3fd9'),
  belly: new THREE.Color('#fff1d6'),
  line: '#101a4d',
  cheek: '#ff8fb8',
  fin: '#2a5cf5',
}

/* ---------------- body profile ---------------- */
const PROFILE: [number, number][] = [
  [0.0, -2.12],
  [0.1, -2.05],
  [0.17, -1.82],
  [0.3, -1.4],
  [0.5, -0.82],
  [0.72, -0.18],
  [0.87, 0.34],
  [0.9, 0.8],
  [0.83, 1.2],
  [0.62, 1.53],
  [0.32, 1.71],
  [0.0, 1.76],
]
const NOSE = 1.76

function buildProfile() {
  const curve = new THREE.CatmullRomCurve3(PROFILE.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, 'centripetal')
  const pts = curve.getSpacedPoints(110).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y))
  pts[0].x = 0
  pts[pts.length - 1].x = 0
  return pts
}

function makeRadiusAt(pts: THREE.Vector2[]) {
  return (a: number) => {
    if (a <= pts[0].y) return 0
    for (let i = 1; i < pts.length; i++) {
      if (a <= pts[i].y) {
        const t = (a - pts[i - 1].y) / (pts[i].y - pts[i - 1].y || 1)
        return pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t
      }
    }
    return 0
  }
}

/** Unit outward direction for "world-up angle" α: 0 = +Z side, π/2 = top, -π/2 = belly. */
const radial = (alpha: number) => new THREE.Vector3(-Math.sin(alpha), 0, Math.cos(alpha))

function vinyl(color: THREE.ColorRepresentation, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    sheen: 0.3,
    sheenColor: new THREE.Color('#ffffff'),
    ...extra,
  })
}

/* ---------------- parts ---------------- */

function useBody() {
  return useMemo(() => {
    const pts = buildProfile()
    const radiusAt = makeRadiusAt(pts)
    const geo = new THREE.LatheGeometry(pts, 128)
    // vertex colours: blue back, cream belly, a deeper blue along the spine
    const pos = geo.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const r = Math.hypot(x, z) || 1
      const down = x / r // +1 belly, -1 spine
      const belly = THREE.MathUtils.smoothstep(down, 0.18, 0.42)
      const spine = THREE.MathUtils.smoothstep(-down, 0.55, 0.95)
      c.copy(COL.top).lerp(COL.topDeep, spine * 0.6).lerp(COL.belly, belly)
      colors.set([c.r, c.g, c.b], i * 3)
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    return { geo, radiusAt }
  }, [])
}

function surface(radiusAt: (a: number) => number, a: number, alpha: number, off = 0) {
  return radial(alpha).multiplyScalar(radiusAt(a) + off).setY(a)
}

function Smile({ radiusAt }: { radiusAt: (a: number) => number }) {
  const geo = useMemo(() => {
    // a short "U" smile on the front of the face, corners curling up
    const side: [number, number][] = [
      [1.5, -0.02],
      [1.56, -0.2],
      [1.64, -0.42],
      [1.7, -0.78],
    ]
    const right = side.map(([a, al]) => surface(radiusAt, a, al, 0.014))
    const left = side.map(([a, al]) => surface(radiusAt, a, Math.PI - al, 0.014)).reverse()
    const bottom = surface(radiusAt, 1.72, -Math.PI / 2, 0.014)
    const curve = new THREE.CatmullRomCurve3([...left, bottom, ...right], false, 'centripetal')
    return new THREE.TubeGeometry(curve, 96, 0.028, 10, false)
  }, [radiusAt])
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={COL.line} roughness={0.5} />
    </mesh>
  )
}

const EYE_A = 1.42
const EYE_ALPHA = 0.5

function Eyes({ radiusAt, blinkRef }: { radiusAt: (a: number) => number; blinkRef: React.RefObject<THREE.Group[]> }) {
  const parts = useMemo(() => {
    return [EYE_ALPHA, Math.PI - EYE_ALPHA].map((alpha) => {
      // eyes look forward: blend the surface normal with the nose direction
      const n = radial(alpha).multiplyScalar(0.55).add(new THREE.Vector3(0, 0.85, 0)).normalize()
      const base = surface(radiusAt, EYE_A, alpha, -0.1)
      const pupil = base.clone().addScaledVector(n, 0.135)
      const glint = pupil.clone().addScaledVector(n, 0.07).add(new THREE.Vector3(-0.045, 0, 0))
      return { base, pupil, glint, n }
    })
  }, [radiusAt])
  const white = useMemo(() => vinyl('#ffffff', { roughness: 0.15 }), [])
  const black = useMemo(() => vinyl('#0b0b14', { roughness: 0.1 }), [])
  return (
    <>
      {parts.map((p, i) => (
        <group
          key={i}
          position={p.base}
          ref={(g) => {
            if (g && blinkRef.current) blinkRef.current[i] = g
          }}
        >
          <mesh material={white}>
            <sphereGeometry args={[0.19, 48, 32]} />
          </mesh>
          <mesh material={black} position={p.pupil.clone().sub(p.base)}>
            <sphereGeometry args={[0.105, 32, 24]} />
          </mesh>
          <mesh position={p.glint.clone().sub(p.base)}>
            <sphereGeometry args={[0.036, 16, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
    </>
  )
}

function Cheeks({ radiusAt }: { radiusAt: (a: number) => number }) {
  const items = useMemo(
    () =>
      [0.08, Math.PI - 0.08].map((alpha) => {
        const p = surface(radiusAt, 1.4, alpha, 0.008)
        const n = radial(alpha).multiplyScalar(0.8).add(new THREE.Vector3(0, 0.6, 0)).normalize()
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
        return { p, q }
      }),
    [radiusAt],
  )
  return (
    <>
      {items.map((c, i) => (
        <mesh key={i} position={c.p} quaternion={c.q} scale={[1.25, 0.8, 1]}>
          <circleGeometry args={[0.12, 32]} />
          <meshStandardMaterial color={COL.cheek} transparent opacity={0.85} roughness={0.6} polygonOffset polygonOffsetFactor={-4} />
        </mesh>
      ))}
    </>
  )
}

function roundedExtrude(shape: THREE.Shape, depth: number, bevel: number) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 6,
    curveSegments: 40,
  })
  g.translate(0, 0, -depth / 2)
  g.computeVertexNormals()
  return g
}

function useFinGeometry() {
  return useMemo(() => {
    // paddle, root at origin, extends along +x
    const s = new THREE.Shape()
    s.moveTo(0, -0.12)
    s.bezierCurveTo(0.25, -0.2, 0.62, -0.16, 0.78, -0.02)
    s.bezierCurveTo(0.86, 0.06, 0.8, 0.18, 0.64, 0.18)
    s.bezierCurveTo(0.42, 0.18, 0.18, 0.16, 0, 0.12)
    s.closePath()
    return roundedExtrude(s, 0.03, 0.045)
  }, [])
}

function useFlukeGeometry() {
  return useMemo(() => {
    // x = span (side to side), y = backwards from the tail stock
    const s = new THREE.Shape()
    s.moveTo(0, -0.08)
    s.bezierCurveTo(0.25, -0.02, 0.62, 0.16, 0.96, 0.5)
    s.bezierCurveTo(1.08, 0.64, 1.0, 0.8, 0.82, 0.74)
    s.bezierCurveTo(0.55, 0.66, 0.26, 0.6, 0.08, 0.68)
    s.quadraticCurveTo(0, 0.56, -0.08, 0.68)
    s.bezierCurveTo(-0.26, 0.6, -0.55, 0.66, -0.82, 0.74)
    s.bezierCurveTo(-1.0, 0.8, -1.08, 0.64, -0.96, 0.5)
    s.bezierCurveTo(-0.62, 0.16, -0.25, -0.02, 0, -0.08)
    return roundedExtrude(s, 0.035, 0.06)
  }, [])
}

/**
 * Pixel "deal with it" shades — flat on purpose, that's the meme.
 * Rows top→bottom; '1' black pixel, 'w' white glint, '.' empty. Plane faces the nose (+Y).
 */
const GLASSES = [
  '111111111111111111',
  '111ww11111111ww111',
  '11ww11111..1ww1111',
  '.111111....111111.',
]
function useShades(radiusAt: (a: number) => number) {
  return useMemo(() => {
    const cube = 0.1
    const black: THREE.Matrix4[] = []
    const white: THREE.Matrix4[] = []
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3(cube, cube * 0.9, cube)
    const add = (list: THREE.Matrix4[], p: THREE.Vector3) => list.push(m.clone().compose(p, q, s))

    const eyeUp = radiusAt(EYE_A) * Math.sin(EYE_ALPHA) // height of the eyes above the axis
    const plane = NOSE - 0.05 // just in front of the face
    const cols = GLASSES[0].length
    GLASSES.forEach((row, r) => {
      ;[...row].forEach((ch, c) => {
        if (ch === '.') return
        // lathe -X is "up"; Z spans side to side
        const p = new THREE.Vector3(-(eyeUp + (1.4 - r) * cube * 0.9), plane, (c - (cols - 1) / 2) * cube)
        add(ch === 'w' ? white : black, p)
      })
    })
    // temple arms hugging the head back toward the ears
    for (const side of [1, -1]) {
      for (let k = 0; k < 7; k++) {
        const a = plane - 0.12 - k * 0.11
        const alpha = side === 1 ? 0.62 : Math.PI - 0.62
        const p = surface(radiusAt, a, alpha, 0.07)
        p.z = Math.sign(p.z) * Math.max(Math.abs(p.z), ((cols - 1) / 2) * cube * (1 - k * 0.04))
        add(black, p)
      }
    }
    return { black, white }
  }, [radiusAt])
}

function Shades({ radiusAt, groupRef }: { radiusAt: (a: number) => number; groupRef: React.RefObject<THREE.Group | null> }) {
  const { black, white } = useShades(radiusAt)
  // plain black lacquer: no sheen, low env so the soft boxes don't tint it
  const blackMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#000000', roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.35 }),
    [],
  )
  const set = (mesh: THREE.InstancedMesh | null, list: THREE.Matrix4[]) => {
    if (!mesh) return
    list.forEach((mm, i) => mesh.setMatrixAt(i, mm))
    mesh.instanceMatrix.needsUpdate = true
  }
  return (
    <group ref={groupRef}>
      <instancedMesh args={[undefined, undefined, black.length]} material={blackMat} ref={(m) => set(m, black)}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, white.length]} ref={(m) => set(m, white)}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
    </group>
  )
}

/** Gold $PROOF coins orbiting the whale — the "exposed bag". */
function useCoinMaterials() {
  return useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 256
    const g = cv.getContext('2d')!
    const grd = g.createRadialGradient(110, 100, 20, 128, 128, 128)
    grd.addColorStop(0, '#fff1a8')
    grd.addColorStop(1, '#ffc531')
    g.fillStyle = grd
    g.fillRect(0, 0, 256, 256)
    g.strokeStyle = '#e09a00'
    g.lineWidth = 12
    g.beginPath()
    g.arc(128, 128, 102, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = '#d48a00'
    g.font = '900 150px "Bricolage Grotesque", system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('$', 128, 140)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    const face = new THREE.MeshPhysicalMaterial({ map: tex, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 })
    const edge = new THREE.MeshPhysicalMaterial({ color: '#ffc531', metalness: 0.6, roughness: 0.3 })
    return [edge, face, face]
  }, [])
}

const COINS = 7
function Coins({ ctl }: { ctl: WhaleCtl }) {
  const mats = useCoinMaterials()
  const refs = useRef<THREE.Mesh[]>([])
  const seeds = useMemo(() => Array.from({ length: COINS }, (_, i) => ({ ph: (i / COINS) * Math.PI * 2, r: 2.55 + (i % 3) * 0.25, y: ((i * 37) % 7) / 7 - 0.5 })), [])
  useFrame((st) => {
    const t = st.clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      const s = seeds[i]
      const k = THREE.MathUtils.clamp(ctl.coins * 1.4 - i * 0.06, 0, 1)
      m.visible = k > 0.01
      const ang = s.ph + t * 0.5
      m.position.set(Math.cos(ang) * s.r, s.y * 1.4 + Math.sin(t * 1.3 + i) * 0.15, Math.sin(ang) * s.r * 0.75)
      m.rotation.set(Math.PI / 2 + Math.sin(t + i) * 0.4, t * 2 + i, 0)
      m.scale.setScalar(k)
    })
  })
  return (
    <group>
      {seeds.map((_, i) => (
        <mesh key={i} material={mats} ref={(m) => void (m && (refs.current[i] = m))}>
          <cylinderGeometry args={[0.26, 0.26, 0.06, 48]} />
        </mesh>
      ))}
    </group>
  )
}

/* ---------------- the whale ---------------- */

export default function AnonWhale({ ctl }: { ctl: WhaleCtl }) {
  const { geo, radiusAt } = useBody()
  const finGeo = useFinGeometry()
  const flukeGeo = useFlukeGeometry()
  const bodyMat = useMemo(() => vinyl('#ffffff', { vertexColors: true }), [])
  const finMat = useMemo(() => vinyl(COL.fin), [])

  const blink = useRef<THREE.Group[]>([])
  const shades = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const flukes = useRef<THREE.Group>(null)
  const finL = useRef<THREE.Group>(null)
  const finR = useRef<THREE.Group>(null)
  const anim = useRef({ t: 0, nextBlink: 2, blinkT: -1 })

  // fin pivots: root on the lower flank, blade sweeping back / out / down
  const fins = useMemo(
    () =>
      [1, -1].map((side) => {
        const alpha = side === 1 ? -0.55 : Math.PI + 0.55
        const root = surface(radiusAt, 0.25, alpha, -0.04)
        const out = radial(alpha)
        const L = new THREE.Vector3(0, -0.75, 0).addScaledVector(out, 0.75).add(new THREE.Vector3(0.35, 0, 0)).normalize()
        const W = new THREE.Vector3(0, 1, 0).sub(L.clone().multiplyScalar(L.y)).normalize()
        const N = L.clone().cross(W).normalize()
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(L, W, N))
        return { root, q, side }
      }),
    [radiusAt],
  )
  const flukeBase = useMemo(() => {
    const q = new THREE.Quaternion()
      .setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0)),
      )
      // tilt the flukes up a little (like a real whale tail) so they read from any angle
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.38))
    return { pos: new THREE.Vector3(0, -1.9, 0), q }
  }, [])

  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const a = anim.current
    a.t += dt * ctl.swim
    const t = a.t

    if (flukes.current) flukes.current.rotation.x = Math.sin(t * 3.2) * 0.42
    if (finL.current) finL.current.rotation.y = Math.sin(t * 3.2 + 0.6) * 0.28
    if (finR.current) finR.current.rotation.y = -Math.sin(t * 3.2 + 0.6) * 0.28
    if (body.current) {
      // gentle swim: body pitches with the tail, plus a breathing squash
      body.current.rotation.x = Math.sin(t * 3.2 - 1.2) * 0.04
      const breathe = 1 + Math.sin(st.clock.elapsedTime * 2.1) * 0.012
      body.current.scale.set(breathe, 1 / breathe, breathe)
    }

    // blink every few seconds
    const now = st.clock.elapsedTime
    if (now > a.nextBlink) {
      a.blinkT = now
      a.nextBlink = now + 2.5 + Math.random() * 3
    }
    const bt = a.blinkT < 0 ? 1 : THREE.MathUtils.clamp(Math.abs(now - a.blinkT - 0.08) / 0.08, 0, 1)
    blink.current.forEach((g) => g && g.scale.set(1, 1, 1).setComponent(0, 0.12 + 0.88 * bt))

    // shades drop in from above with a little bounce
    if (shades.current) {
      const k = ctl.shades
      shades.current.visible = k > 0.001
      const e = k >= 1 ? 1 : 1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.08
      shades.current.position.set(-(1 - e) * 2.4, 0, 0) // lathe -X = world up
    }
  })

  return (
    // lathe +Y → world +X (nose points right)
    <group rotation={[0, 0, -Math.PI / 2]}>
      <group ref={body}>
        <mesh geometry={geo} material={bodyMat} />
        <Smile radiusAt={radiusAt} />
        <Eyes radiusAt={radiusAt} blinkRef={blink} />
        <Cheeks radiusAt={radiusAt} />
        {fins.map((f) => (
          <group key={f.side} position={f.root} quaternion={f.q}>
            <group ref={f.side === 1 ? finR : finL}>
              <mesh geometry={finGeo} material={finMat} />
            </group>
          </group>
        ))}
        <group position={flukeBase.pos} quaternion={flukeBase.q}>
          <group ref={flukes}>
            <mesh geometry={flukeGeo} material={finMat} />
          </group>
        </group>
        <Shades radiusAt={radiusAt} groupRef={shades} />
      </group>
      <group rotation={[0, 0, Math.PI / 2]}>
        <Coins ctl={ctl} />
      </group>
    </group>
  )
}
