import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import AnonWhale, { makeCtl } from './AnonWhale'
import Studio from './Studio'

function Spin({ shades }: { shades: boolean }) {
  const ctl = useMemo(() => makeCtl(), [])
  const g = useRef<THREE.Group>(null)
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime
    ctl.shades += ((shades ? 1 : 0) - ctl.shades) * Math.min(1, dt * 2.5)
    ctl.coins += ((shades ? 0 : 1) - ctl.coins) * Math.min(1, dt * 2.5)
    if (g.current) {
      g.current.position.y = Math.sin(t * 1.1) * 0.12
      g.current.rotation.set(0.28, -2.2 + Math.sin(t * 0.5) * 0.25, Math.sin(t * 1.1 + 1) * 0.04)
    }
  })
  return (
    <group ref={g}>
      <AnonWhale ctl={ctl} />
    </group>
  )
}

/** Small standalone mascot for the app (connect screen). Shades on = connected. */
export default function MiniWhale({ shades = false }: { shades?: boolean }) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 10.5], fov: 30 }} gl={{ antialias: true, alpha: true }}>
      <Studio />
      <Spin shades={shades} />
    </Canvas>
  )
}
