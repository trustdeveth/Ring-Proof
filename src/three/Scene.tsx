import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import AnonWhale, { makeCtl } from './AnonWhale'
import Hoop from './Hoop'
import Studio from './Studio'
import { HOOP, measure, poseAt, scroll } from './scroll'
import { getVelocity } from '../lib/smooth'

/* exposed-balance stickers pinned to points on the whale (whale frame: nose +X, up +Y) */
const TAGS = [
  { k: 'SOL', v: '1,284.22', pos: [1.35, 1.25, 0.6], tone: 'yellow' },
  { k: '$PRHL', v: '14,250,000', pos: [-0.35, 1.55, -0.2], tone: 'pink' },
  { k: 'Linked wallets', v: '7 found', pos: [0.6, -1.15, 0.7], tone: 'aqua' },
  { k: 'Last buy', v: '2 min ago', pos: [-2.0, 0.35, 0.3], tone: 'white' },
] as const

const mouse = { x: 0, y: 0 }
const tagEls: (HTMLDivElement | null)[] = []

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

function TagLayer() {
  return (
    <div className="tags-layer">
      {TAGS.map((t, i) => (
        <div key={t.k} className={`tag3d tag3d--${t.tone}`} ref={(el) => void (tagEls[i] = el)} data-redacted="0" style={{ opacity: 0 }}>
          <span className="tag3d__k">{t.k}</span>
          <span className="tag3d__v">
            <span>{t.v}</span>
            <span className="tag3d__bar" />
          </span>
        </div>
      ))}
    </div>
  )
}

/* glossy bubbles rising from the blowhole */
const BUBBLES = 22
function Bubbles({ source, enabled }: { source: RefObject<THREE.Object3D | null>; enabled: RefObject<boolean> }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const state = useMemo(
    () => ({ p: Array.from({ length: BUBBLES }, () => ({ pos: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, size: 0 })), next: 0, timer: 0 }),
    [],
  )
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), head: new THREE.Vector3() }), [])
  const mat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.55, envMapIntensity: 1.5 }),
    [],
  )
  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const m = mesh.current
    if (!m || !source.current) return
    state.timer -= dt
    if (enabled.current && state.timer <= 0) {
      state.timer = 0.25 + Math.random() * 0.4
      source.current.getWorldPosition(tmp.head)
      if (Math.abs(tmp.head.x) < 7) {
        const b = state.p[state.next++ % BUBBLES]
        b.pos.copy(tmp.head)
        b.v.set((Math.random() - 0.5) * 0.25, 0.7 + Math.random() * 0.5, (Math.random() - 0.5) * 0.2)
        b.life = 1
        b.size = 0.05 + Math.random() * 0.09
      }
    }
    const t = st.clock.elapsedTime
    state.p.forEach((b, i) => {
      if (b.life > 0) {
        b.life -= dt * 0.45
        b.pos.addScaledVector(b.v, dt)
        b.pos.x += Math.sin(t * 3 + i) * 0.003
      }
      const k = b.life > 0 ? Math.min(1, b.life * 4) * b.size : 0
      tmp.s.setScalar(k)
      m.setMatrixAt(i, tmp.m.compose(b.pos, tmp.q, tmp.s))
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, BUBBLES]} material={mat} frustumCulled={false}>
      <sphereGeometry args={[1, 24, 16]} />
    </instancedMesh>
  )
}

function Rig() {
  const { size, camera } = useThree()
  const mobile = size.width < 900
  const ctl = useMemo(() => makeCtl(), [])
  const outer = useRef<THREE.Group>(null)
  const yaw = useRef<THREE.Group>(null)
  const pitch = useRef<THREE.Group>(null)
  const hoop = useRef<THREE.Group>(null)
  const blowhole = useRef<THREE.Object3D>(null)
  const bubblesOn = useRef(true)
  const look = useRef({ x: 0, y: 0 })
  const v = useMemo(() => ({ tag: new THREE.Vector3(), rel: new THREE.Vector3(), dir: new THREE.Vector3() }), [])

  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = st.clock.elapsedTime

    const target = window.scrollY
    scroll.smooth += (target - scroll.smooth) * Math.min(1, dt * 10)
    if (Math.abs(target - scroll.smooth) < 0.5) scroll.smooth = target
    const p = poseAt(scroll.smooth, mobile)
    const H = mobile ? HOOP.mobile : HOOP.desktop

    // --- hoop
    const w = THREE.MathUtils.clamp(p.hoop, 0, 1)
    v.dir.set(Math.cos(H.yaw), 0, -Math.sin(H.yaw))
    if (hoop.current) {
      hoop.current.visible = w > 0.01
      const pop = w < 1 ? 1 - Math.pow(1 - w, 3) * (1 + 2.2 * w) : 1 // overshoot pop
      hoop.current.scale.setScalar(Math.max(0.001, H.s * Math.max(0, pop)))
      hoop.current.position.set(H.x, H.y, H.z)
      hoop.current.rotation.set(0, Math.PI / 2 + H.yaw, t * 0.25)
    }

    // --- whale position: free pose, blended onto the jump arc while the hoop is up
    const j = p.jump
    const pathX = H.x + v.dir.x * j * H.span
    const pathY = H.y - H.arc * j * j
    const pathZ = H.z + v.dir.z * j * H.span
    const pathPitch = Math.atan2(-2 * H.arc * j, H.span)
    const intro = scroll.intro
    const bob = Math.sin(t * 1.1) * 0.12
    if (outer.current) {
      outer.current.position.set(
        THREE.MathUtils.lerp(p.x, pathX, w) + (1 - intro) * 4,
        THREE.MathUtils.lerp(p.y, pathY, w) + bob * (1 - w) - (1 - intro) * 2.5,
        THREE.MathUtils.lerp(p.z, pathZ, w),
      )
      outer.current.scale.setScalar(p.s * (0.4 + 0.6 * intro))
      look.current.x += (mouse.x - look.current.x) * Math.min(1, dt * 3)
      look.current.y += (mouse.y - look.current.y) * Math.min(1, dt * 3)
      outer.current.rotation.set(p.rx + look.current.y * 0.12, 0, 0)
    }
    if (yaw.current) yaw.current.rotation.y = p.ry - look.current.x * 0.25 * (1 - w) + Math.sin(t * 0.7) * 0.05
    // level out as the whale turns to face the camera after the jump
    const level = j > 0.15 ? Math.max(0, 1 - (j - 0.15) / 0.3) : 1
    if (pitch.current) pitch.current.rotation.z = pathPitch * w * level + Math.sin(t * 1.1 + 1) * 0.04

    // --- character state
    const vel = Math.abs(getVelocity())
    ctl.swim = 1 + Math.min(3.5, vel * 0.08)
    ctl.coins = p.coins
    ctl.shades = w > 0.5 ? THREE.MathUtils.clamp(j / 0.35, 0, 1) : p.shades
    bubblesOn.current = intro > 0.6

    // --- tags follow points on the whale; each is censored once it has passed the hoop plane
    if (pitch.current) {
      pitch.current.updateWorldMatrix(true, false)
      TAGS.forEach((tg, i) => {
        const el = tagEls[i]
        if (!el) return
        // after the crossing the (censored) tags fade so the shades get the spotlight
        const after = w > 0.5 ? THREE.MathUtils.clamp((0.58 - j) / 0.18, 0, 1) : 1
        const o = THREE.MathUtils.clamp(p.tags * 1.6 - i * 0.15, 0, 1) * intro * after
        el.style.opacity = o.toFixed(3)
        if (o < 0.01) return
        v.tag.set(tg.pos[0], tg.pos[1], tg.pos[2]).applyMatrix4(pitch.current!.matrixWorld)
        v.rel.set(v.tag.x - H.x, v.tag.y - H.y, v.tag.z - H.z)
        el.dataset.redacted = w > 0.5 && v.rel.dot(v.dir) > 0 ? '1' : '0'
        v.tag.project(camera)
        const x = (v.tag.x * 0.5 + 0.5) * size.width
        const y = (-v.tag.y * 0.5 + 0.5) * size.height + (1 - o) * 16
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${(i % 2 ? 3 : -3)}deg)`
      })
    }
  })

  return (
    <>
      <Studio />
      <group ref={hoop}>
        <Hoop />
      </group>
      <group ref={outer}>
        <group ref={yaw}>
          <group ref={pitch}>
            <AnonWhale ctl={ctl} />
            <object3D ref={blowhole} position={[0.55, 0.95, 0]} />
          </group>
        </group>
      </group>
      <Bubbles source={blowhole} enabled={bubblesOn} />
    </>
  )
}

export default function Scene() {
  useGlobalInputs()
  return (
    <>
      <TagLayer />
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 12], fov: 30 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
        <Rig />
      </Canvas>
    </>
  )
}
