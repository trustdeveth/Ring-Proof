import { Environment, Lightformer } from '@react-three/drei'

/** Toy-photography lighting: soft boxes for glossy vinyl reflections. No external HDR files. */
export default function Studio() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 6, 5]} intensity={1.7} />
      <directionalLight position={[-4, -2, 3]} intensity={0.35} color="#ffd9f0" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.4} position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[12, 6, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#ffe27a" position={[-6, 1, 2]} rotation-y={Math.PI / 2} scale={[4, 8, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#ff9ad5" position={[6, 0, 2]} rotation-y={-Math.PI / 2} scale={[4, 8, 1]} />
        <Lightformer form="ring" intensity={2} position={[1, 2, 8]} scale={2.5} />
        <Lightformer form="rect" intensity={0.6} position={[0, -5, 0]} rotation-x={-Math.PI / 2} scale={[12, 6, 1]} />
      </Environment>
    </>
  )
}
