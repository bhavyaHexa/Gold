import { useThree, useFrame } from "@react-three/fiber"
import * as THREE from "three/webgpu"
import { useRef } from "react"

export function EnvRotation({ speed = 0.2 }) {
  const { scene } = useThree()
  const rot = useRef(0)

  useFrame((_, delta) => {
    rot.current += delta * speed
    
    // THIS is the magic line
    scene.environmentRotation = new THREE.Euler(0, 10, 0)
  })

  return null
}
