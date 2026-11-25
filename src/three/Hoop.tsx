import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

/** The "privacy ring": a candy-striped circus hoop with chasing bulbs. Axis = +Z. */
const STRIPES = 18
const BULBS = 28
const R = 2.25

export default function Hoop() {
  const geo = useMemo(() => {
    const g = new THREE.TorusGeometry(R, 0.26, 40, 220)
    const pos = g.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const pink = new THREE.Color('#ff4fa3')
    const white = new THREE.Color('#ffffff')
    for (let i = 0; i < pos.count; i++) {
      const ang = Math.atan2(pos.getY(i), pos.getX(i)) + Math.PI
      const band = Math.floor((ang / (Math.PI * 2)) * STRIPES * 2) % 2
      const c = band ? pink : white
      colors.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [])
  const mat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
    [],
  )
  const bulbs = useRef<THREE.InstancedMesh>(null)
  const bulbMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff3b0', emissive: '#ffcc00', emissiveIntensity: 1.2, roughness: 0.3 }), [])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), c: new THREE.Color() }), [])

  useFrame((st) => {
    const b = bulbs.current
    if (!b) return
    const t = st.clock.elapsedTime
    for (let i = 0; i < BULBS; i++) {
      const a = (i / BULBS) * Math.PI * 2
      tmp.m.makeTranslation(Math.cos(a) * (R + 0.3), Math.sin(a) * (R + 0.3), 0)
      b.setMatrixAt(i, tmp.m)
      const on = (Math.floor(t * 8) + i) % 4 === 0
      b.setColorAt(i, tmp.c.set(on ? '#fff7c2' : '#b38a00'))
    }
    b.instanceMatrix.needsUpdate = true
    if (b.instanceColor) b.instanceColor.needsUpdate = true
  })

  return (
    <group>
      <mesh geometry={geo} material={mat} />
      <instancedMesh ref={bulbs} args={[undefined, undefined, BULBS]} material={bulbMat}>
        <sphereGeometry args={[0.075, 16, 12]} />
      </instancedMesh>
    </group>
  )
}
