import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { buildWhaleGeometry } from './whaleGeometry'
import { inkVertex, inkFragment, outlineVertex, outlineFragment } from './shaders'
import { measure, poseAt, scroll, WHALE_SCALE, type Pose } from './scroll'

// raw sRGB, must match CSS --paper / --ink / --red
const PAPER = new THREE.Vector3(0xec / 255, 0xe9 / 255, 0xe1 / 255)
const INK = new THREE.Vector3(0x14 / 255, 0x13 / 255, 0x12 / 255)
const RED = new THREE.Vector3(0xe2 / 255, 0x3a / 255, 0x1e / 255)

const TAGS = [
  { k: 'SOL', v: '1,284.22', pos: [1.25, 0.72, 0.2] },
  { k: '$PROOF', v: '14,250,000', pos: [-0.25, 0.78, 0.15] },
  { k: 'Linked wallets', v: '7 found', pos: [0.55, -0.7, 0.3] },
  { k: 'Last buy', v: '2 min ago', pos: [-1.55, 0.3, 0.1] },
] as const

function useScrollMeasure() {
  useEffect(() => {
    const run = () => measure()
    run()
    const ro = new ResizeObserver(run)
    ro.observe(document.body)
    window.addEventListener('resize', run)
    document.fonts?.ready.then(run)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', run)
    }
  }, [])
}

function makeInk(uniforms: Record<string, THREE.IUniform>, split: THREE.IUniform, bend: boolean, dot = 5) {
  return new THREE.ShaderMaterial({
    vertexShader: inkVertex,
    fragmentShader: inkFragment,
    defines: bend ? { BEND: '' } : {},
    uniforms: {
      uTime: uniforms.uTime,
      uDpr: uniforms.uDpr,
      uSplit: split,
      uDot: { value: dot },
      uInk: { value: INK },
      uPaper: { value: PAPER },
      uRed: { value: RED },
    },
  })
}

/** DOM tags pinned to points on the whale; Rig projects them every frame. */
const tagEls: (HTMLDivElement | null)[] = []

function TagLayer() {
  return (
    <div className="tags-layer">
      {TAGS.map((t, i) => (
        <div
          key={t.k}
          className="tag3d"
          ref={(el) => {
            tagEls[i] = el
          }}
          data-redacted="0"
          style={{ opacity: 0 }}
        >
          <span className="tag3d__pin" />
          <span className="tag3d__k">{t.k}</span>
          <span className="tag3d__v">
            <span className="tag3d__val">{t.v}</span>
            <span className="tag3d__bar" />
          </span>
        </div>
      ))}
    </div>
  )
}

const tmp = new THREE.Vector3()
function updateTags(whale: THREE.Object3D, camera: THREE.Camera, w: number, h: number, split: number, opacity: number) {
  whale.updateWorldMatrix(true, false)
  TAGS.forEach((t, i) => {
    const el = tagEls[i]
    if (!el) return
    el.style.opacity = opacity.toFixed(3)
    if (opacity < 0.01) return
    tmp.set(t.pos[0], t.pos[1], t.pos[2]).applyMatrix4(whale.matrixWorld).project(camera)
    const x = (tmp.x * 0.5 + 0.5) * w
    const y = (-tmp.y * 0.5 + 0.5) * h
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
    el.dataset.redacted = t.pos[0] > split ? '1' : '0'
  })
}

function Rig() {
  const { gl, size, invalidate } = useThree()
  const mobile = size.width < 900
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uDpr: { value: gl.getPixelRatio() } }),
    [gl],
  )
  const whaleSplit = useMemo(() => ({ value: 3 }), [])
  const noSplit = useMemo(() => ({ value: 100 }), [])
  const geo = useMemo(() => buildWhaleGeometry(), [])
  const whaleMat = useMemo(() => makeInk(uniforms, whaleSplit, true), [uniforms, whaleSplit])
  const ringMat = useMemo(() => makeInk(uniforms, noSplit, false, 4.5), [uniforms, noSplit])
  const outlineMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: outlineVertex,
        fragmentShader: outlineFragment,
        defines: { BEND: '' },
        uniforms: { uTime: uniforms.uTime, uThick: { value: 0.022 }, uInk: { value: INK } },
        side: THREE.BackSide,
      }),
    [uniforms],
  )

  const lane = useRef<THREE.Group>(null)
  const whale = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Group>(null)
  const ticks = useRef<THREE.InstancedMesh>(null)
  const pose = useRef<Pose | null>(null)
  const TICKS = 60

  useEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const z = new THREE.Vector3(0, 0, 1)
    for (let i = 0; i < TICKS; i++) {
      const a = (i / TICKS) * Math.PI * 2
      const long = i % 5 === 0
      q.setFromAxisAngle(z, a)
      m.compose(
        new THREE.Vector3(Math.cos(a) * 2.68, Math.sin(a) * 2.68, 0),
        q,
        new THREE.Vector3(long ? 0.26 : 0.11, 0.022, 0.022),
      )
      ticks.current!.setMatrixAt(i, m)
    }
    ticks.current!.instanceMatrix.needsUpdate = true
    invalidate()
  }, [invalidate])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    uniforms.uTime.value = t
    uniforms.uDpr.value = gl.getPixelRatio()

    // smooth the scroll, then sample the choreography
    const target = window.scrollY
    scroll.smooth += (target - scroll.smooth) * Math.min(1, dt * 6)
    if (Math.abs(target - scroll.smooth) < 0.5) scroll.smooth = target
    const p = poseAt(scroll.smooth, mobile)
    pose.current = p

    if (lane.current) {
      lane.current.position.set(p.x, p.y + Math.sin(t * 0.7) * 0.08, p.z)
      lane.current.rotation.set(0.2, p.ry + Math.sin(t * 0.5) * 0.04, 0.03)
      lane.current.scale.setScalar(p.s)
    }
    if (whale.current) {
      whale.current.position.set(p.wx, 0, 0)
      whale.current.rotation.x = Math.sin(t * 0.6) * 0.1
    }
    if (ring.current) {
      ring.current.scale.setScalar(Math.max(0.0001, p.ring))
      ring.current.visible = p.ring > 0.01
      ring.current.rotation.x = t * 0.15
    }
    whaleSplit.value = p.split
    if (whale.current) updateTags(whale.current, state.camera, size.width, size.height, p.split, p.tags)
  })

  return (
    <group ref={lane}>
      <group ref={ring}>
        <group rotation={[0, Math.PI / 2, 0]}>
          <mesh material={ringMat}>
            <torusGeometry args={[2.3, 0.16, 32, 160]} />
          </mesh>
          <mesh>
            <torusGeometry args={[2.52, 0.018, 8, 160]} />
            <meshBasicMaterial color="#e23a1e" />
          </mesh>
          <instancedMesh ref={ticks} args={[undefined, undefined, TICKS]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#141312" />
          </instancedMesh>
        </group>
      </group>
      <group ref={whale} scale={WHALE_SCALE}>
        <mesh geometry={geo} material={outlineMat} />
        <mesh geometry={geo} material={whaleMat} />
      </group>
    </group>
  )
}

export default function Scene() {
  useScrollMeasure()
  return (
    <>
    <TagLayer />
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 10], fov: 35 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <Rig />
    </Canvas>
    </>
  )
}
