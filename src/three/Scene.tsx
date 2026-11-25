import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { buildWhaleGeometry } from './whaleGeometry'
import {
  inkVertex,
  inkFragment,
  outlineVertex,
  outlineFragment,
  bubbleVertex,
  bubbleFragment,
} from './shaders'
import { measure, poseAt, scroll, WHALE_SCALE } from './scroll'
import { getVelocity } from '../lib/smooth'

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

const mouse = { x: 0, y: 0 }

function useGlobalInputs() {
  useEffect(() => {
    const run = () => measure()
    run()
    const ro = new ResizeObserver(run)
    ro.observe(document.body)
    window.addEventListener('resize', run)
    document.fonts?.ready.then(run)
    const onMove = (e: PointerEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', run)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])
}

/* ---------- DOM tags pinned to the whale ---------- */
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
  TAGS.forEach((t, i) => {
    const el = tagEls[i]
    if (!el) return
    // stagger: each tag pops in slightly after the previous one
    const o = Math.max(0, Math.min(1, opacity * 1.6 - i * 0.15))
    el.style.opacity = o.toFixed(3)
    if (o < 0.01) return
    tmp.set(t.pos[0], t.pos[1], t.pos[2]).applyMatrix4(whale.matrixWorld).project(camera)
    const x = (tmp.x * 0.5 + 0.5) * w
    const y = (-tmp.y * 0.5 + 0.5) * h + (1 - o) * 14
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
    el.dataset.redacted = t.pos[0] > split ? '1' : '0'
  })
}

/* ---------- HUD readout (bottom-right, rendered by the page) ---------- */
let lastStatus = ''
function updateHud(split: number) {
  const el = document.getElementById('hud-status')
  if (!el) return
  let s: string
  if (split > 2.2) s = 'Exposed'
  else if (split < -2.0) s = 'Redacted'
  else s = `Encrypting ${Math.round(((2.2 - split) / 4.2) * 100)}%`
  if (s !== lastStatus) {
    lastStatus = s
    el.textContent = s
    el.dataset.state = s.startsWith('Exp') ? 'exposed' : s.startsWith('Red') ? 'redacted' : 'encrypting'
  }
}

/* ---------- bubbles ---------- */
const BUBBLES = 28
function useBubbles() {
  return useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BUBBLES * 3), 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(BUBBLES), 1))
    g.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(BUBBLES), 1))
    const vel = new Float32Array(BUBBLES * 3)
    return { g, vel, next: 0, timer: 0 }
  }, [])
}

function makeInk(shared: Record<string, THREE.IUniform>, split: THREE.IUniform, bend: boolean, dot = 5) {
  return new THREE.ShaderMaterial({
    vertexShader: inkVertex,
    fragmentShader: inkFragment,
    defines: bend ? { BEND: '' } : {},
    uniforms: {
      uTime: shared.uTime,
      uDpr: shared.uDpr,
      uDark: shared.uDark,
      uSplit: split,
      uDot: { value: dot },
      uInkC: { value: INK },
      uPaperC: { value: PAPER },
      uRed: { value: RED },
    },
  })
}

function Rig() {
  const { gl, size, invalidate } = useThree()
  const mobile = size.width < 900
  const shared = useMemo(
    () => ({ uTime: { value: 0 }, uDpr: { value: gl.getPixelRatio() }, uDark: { value: 0 } }),
    [gl],
  )
  const whaleSplit = useMemo(() => ({ value: 3 }), [])
  const noSplit = useMemo(() => ({ value: 100 }), [])
  const geo = useMemo(() => buildWhaleGeometry(), [])
  const whaleMat = useMemo(() => makeInk(shared, whaleSplit, true), [shared, whaleSplit])
  const ringMat = useMemo(() => makeInk(shared, noSplit, false, 4.5), [shared, noSplit])
  const outlineMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: outlineVertex,
        fragmentShader: outlineFragment,
        defines: { BEND: '' },
        uniforms: {
          uTime: shared.uTime,
          uDark: shared.uDark,
          uThick: { value: 0.022 },
          uInkC: { value: INK },
          uPaperC: { value: PAPER },
        },
        side: THREE.BackSide,
      }),
    [shared],
  )
  const bubbles = useBubbles()
  const bubbleMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: bubbleVertex,
        fragmentShader: bubbleFragment,
        uniforms: { uDpr: shared.uDpr, uDark: shared.uDark, uInkC: { value: INK }, uPaperC: { value: PAPER } },
        transparent: true,
        depthWrite: false,
      }),
    [shared],
  )

  const lane = useRef<THREE.Group>(null)
  const whale = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Group>(null)
  const ticks = useRef<THREE.InstancedMesh>(null)
  const anim = useRef({ t: 0, lookX: 0, lookY: 0 })
  const head = useMemo(() => new THREE.Vector3(), [])
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

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const a = anim.current

    // tail beats faster while the page is being scrolled
    const vel = Math.abs(getVelocity())
    a.t += dt * (1 + Math.min(3.5, vel * 0.08))
    shared.uTime.value = a.t
    shared.uDpr.value = gl.getPixelRatio()
    shared.uDark.value += ((scroll.dark > 0.7 ? 1 : 0) - shared.uDark.value) * Math.min(1, dt * 8)

    // Lenis already smooths the page; a light extra damping keeps the 3D silky
    const target = window.scrollY
    scroll.smooth += (target - scroll.smooth) * Math.min(1, dt * 10)
    if (Math.abs(target - scroll.smooth) < 0.5) scroll.smooth = target
    const p = poseAt(scroll.smooth, mobile)

    // the whale glances toward the cursor
    a.lookX += (mouse.x - a.lookX) * Math.min(1, dt * 2.5)
    a.lookY += (mouse.y - a.lookY) * Math.min(1, dt * 2.5)

    const intro = scroll.intro
    const t = state.clock.elapsedTime
    if (lane.current) {
      lane.current.position.set(
        p.x + (1 - intro) * 3,
        p.y + Math.sin(t * 0.7) * 0.08 - (1 - intro) * 0.6,
        p.z,
      )
      lane.current.rotation.set(0.2 + a.lookY * 0.08, p.ry + Math.sin(t * 0.5) * 0.04 - a.lookX * 0.12, 0.03)
      lane.current.scale.setScalar(p.s * (0.85 + intro * 0.15))
    }
    if (whale.current) {
      whale.current.position.set(p.wx, 0, 0)
      whale.current.rotation.x = Math.sin(t * 0.6) * 0.1
      whale.current.visible = intro > 0.01
    }
    if (ring.current) {
      ring.current.scale.setScalar(Math.max(0.0001, p.ring))
      ring.current.visible = p.ring > 0.01
      ring.current.rotation.x = t * 0.15
    }
    whaleSplit.value = p.split

    if (whale.current) {
      whale.current.updateWorldMatrix(true, false)
      updateTags(whale.current, state.camera, size.width, size.height, p.split, p.tags * intro)

      // bubbles from the blowhole
      head.set(1.55, 0.45, 0).applyMatrix4(whale.current.matrixWorld)
      const pos = bubbles.g.attributes.position as THREE.BufferAttribute
      const life = bubbles.g.attributes.aLife as THREE.BufferAttribute
      const sz = bubbles.g.attributes.aSize as THREE.BufferAttribute
      bubbles.timer -= dt
      if (bubbles.timer <= 0 && intro > 0.5 && head.x > -6 && head.x < 6) {
        bubbles.timer = 0.22 + Math.random() * 0.35
        const i = bubbles.next++ % BUBBLES
        pos.setXYZ(i, head.x, head.y, head.z)
        bubbles.vel.set([(Math.random() - 0.5) * 0.2, 0.5 + Math.random() * 0.5, 0], i * 3)
        life.setX(i, 1)
        sz.setX(i, 10 + Math.random() * 18)
      }
      for (let i = 0; i < BUBBLES; i++) {
        const l = life.getX(i)
        if (l <= 0) continue
        life.setX(i, l - dt * 0.4)
        pos.setXYZ(
          i,
          pos.getX(i) + bubbles.vel[i * 3] * dt + Math.sin(t * 3 + i) * 0.003,
          pos.getY(i) + bubbles.vel[i * 3 + 1] * dt,
          pos.getZ(i),
        )
      }
      pos.needsUpdate = true
      life.needsUpdate = true
      sz.needsUpdate = true
    }
    updateHud(p.split)
  })

  return (
    <>
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
      <points geometry={bubbles.g} material={bubbleMat} frustumCulled={false} />
    </>
  )
}

export default function Scene() {
  useGlobalInputs()
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
