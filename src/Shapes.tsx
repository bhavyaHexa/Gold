// import { useRef } from 'react'
// import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
// import * as THREE from 'three'

export default function Shapes() {
  // const torusRef = useRef<THREE.Mesh>(null)

  // const { torusColor, torusRoughness, torusMetalness, animateTorus } = useControls('Torus', {
  //   torusColor: '#ff4060',
  //   torusRoughness: { value: 0.2, min: 0, max: 1 },
  //   torusMetalness: { value: 0.8, min: 0, max: 1 },
  //   animateTorus: true
  // })

  const { planeColor, planeRoughness, planeMetalness } = useControls('Plane', {
    planeColor: '#ffffff',
    planeRoughness: { value: 1.0, min: 0, max: 1 },
    planeMetalness: { value: 0.0, min: 0, max: 1 }
  })

  // Add a simple animation to the torus knot
  // useFrame((_, delta) => {
  //   if (torusRef.current && animateTorus) {
  //     torusRef.current.rotation.x += delta * 0.5
  //     torusRef.current.rotation.y += delta * 0.5
  //   }
  // })

  return (
    <>
      {/* Floor plane */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]}>
        <planeGeometry args={[10,10]} />
        <meshStandardMaterial color={planeColor} roughness={planeRoughness} metalness={planeMetalness} />
      </mesh>

      {/* Center Torus Knot */}
      {/* <mesh ref={torusRef} castShadow position={[0, 0, 5]}>
        <torusKnotGeometry args={[1, 0.3, 128, 32]} />
        <meshStandardMaterial color={torusColor} roughness={torusRoughness} metalness={torusMetalness} />
      </mesh> */}
    </>
  )
}