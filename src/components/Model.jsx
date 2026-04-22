import { useGLTF, useEnvironment } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { MeshPhysicalNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu";
import { color, reflectVector, pmremTexture, float, vec3, dot, pow, transformedNormalView, positionViewDirection } from "three/tsl";
import { MeshPhysicalMaterial } from "three";

export default function Model({ url }) {
  const { scene } = useGLTF(url);
  const envMap = useEnvironment({ files: "/env_metal_001_d01c4504e0.hdr" });





  const customGoldMaterial = useMemo(() => {
    return new MeshPhysicalMaterial({
      color: "#f5d095",
      // 1. Pick one: High Metalness (Opaque Gold) OR High Transmission (Gold Glass)
      metalness: 1.0,         // Keep this low if using transmission
      roughness: 0.05,
      // The "Glass" effect
      // ior: 2.5,               // Index of Refraction (Standard glass is 1.5, Diamond is 2.4)
      // thickness: 2.0,         // Required for transmission to have "depth"

      // 2. Transparency settings
      opacity: 1.0,
      transparent: true,      // CRITICAL: opacity won't work without this

      // 3. Environment Map
      // envMap: envMap,         // Pass the envMap you loaded
      // envMapIntensity: 1.0,
      // envMapRotation: [0, 4.84, 0],

      // 4. Extra shine
      // clearcoat: 1.0,
      // clearcoatRoughness: 0.1,
    });
  }, [envMap]);
  const currentBlackMat = useMemo(() => new MeshPhysicalMaterial({ color: "#c2a475", metalness: 1, roughness: 0.4 }), []);

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        if (child.name === "Metal_Polish1") {
          child.material = customGoldMaterial;
        } else if (child.name === "Metal_Brush") {
          child.material = currentBlackMat;
        }
      }
    });
  }, [scene, customGoldMaterial, currentBlackMat]);

  return <primitive object={scene} scale={1} />;
}