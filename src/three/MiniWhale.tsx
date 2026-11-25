import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { buildWhaleGeometry } from './whaleGeometry'
import { inkVertex, inkFragment, outlineVertex, outlineFragment } from './shaders'

const PAPER = new THREE.Vector3(0xec / 255, 0xe9 / 255, 0xe1 / 255)
const INK = new THREE.Vector3(0x14 / 255, 0x13 / 255, 0x12 / 255)
const RED = new THREE.Vector3(0xe2 / 255, 0x3a / 255, 0x1e / 255)

function Whale({ redacted }: { redacted: boolean }) {
  const { gl } = useThree()
  const geo = useMemo(() => buildWhaleGeometry(), [])
  const u = useMemo(
    () => ({
      uTime: { value: 0 },
      uDpr: { value: gl.getPixelRatio() },
      uDark: { value: 0 },
      uSplit: { value: 3 },
      uDot: { value: 4.5 },
      uInkC: { value: INK },
      uPaperC: { value: PAPER },
      uRed: { value: RED },
      uThick: { value: 0.022 },
    }),
    [gl],
  )
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: inkVertex, fragmentShader: inkFragment, defines: { BEND: '' }, uniforms: u }), [u])
  const outline = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: outlineVertex, fragmentShader: outlineFragment, defines: { BEND: '' }, uniforms: u, side: THREE.BackSide }),
    [u],
  )
  const g = useRef<THREE.Group>(null)
  useFrame((s, dt) => {
    const t = s.clock.elapsedTime
    u.uTime.value = t
    const target = redacted ? -2.6 : 2.6
    u.uSplit.value += (target - u.uSplit.value) * Math.min(1, dt * 1.6)
    if (g.current) {
      g.current.position.y = Math.sin(t * 0.8) * 0.12
      g.current.rotation.set(0.25 + Math.sin(t * 0.5) * 0.05, -0.5 + Math.sin(t * 0.35) * 0.08, 0.02)
    }
  })
  return (
    <group ref={g} scale={1.05}>
      <mesh geometry={geo} material={outline} />
      <mesh geometry={geo} material={mat} />
    </group>
  )
}

export default function MiniWhale({ redacted }: { redacted: boolean }) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 7], fov: 35 }} gl={{ antialias: true, alpha: true }}>
      <Whale redacted={redacted} />
    </Canvas>
  )
}
