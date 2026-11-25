import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import AnonWhale, { makeCtl } from './AnonWhale'
import Hoop from './Hoop'
import Studio from './Studio'

/** Dev-only preview: /__lab?shades=1&coins=1&ry=-2.2&hoop=1&bg=%23ffd23f */
export default function Lab() {
  const q = new URLSearchParams(window.location.search)
  const ctl = useMemo(() => {
    const c = makeCtl()
    c.shades = Number(q.get('shades') ?? 0)
    c.coins = Number(q.get('coins') ?? 0)
    return c
  }, [q])
  const ry = Number(q.get('ry') ?? -2.2)
  const rx = Number(q.get('rx') ?? 0.15)
  return (
    <div style={{ position: 'fixed', inset: 0, background: q.get('bg') ?? '#ffd23f' }}>
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 9], fov: 30 }} gl={{ antialias: true, alpha: true }}>
        <Studio />
        <group rotation={[rx, ry, 0]}>
          <AnonWhale ctl={ctl} />
        </group>
        {q.get('hoop') && (
          <group position={[0, 0, -1]} rotation={[0, -0.6, 0]}>
            <Hoop />
          </group>
        )}
      </Canvas>
    </div>
  )
}
