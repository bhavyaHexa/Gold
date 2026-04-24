import { useGLTF, useEnvironment } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { MeshPhysicalNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu";
import { color, reflectVector, pmremTexture, float, vec3, dot, pow, transformedNormalView, positionViewDirection } from "three/tsl";
import { MeshPhysicalMaterial } from "three";

export default function Model({ url, envUrl }) {
  const { scene } = useGLTF(url);
  const envMap = useEnvironment({ files: envUrl });





  const customGoldMaterial = useMemo(() => {
    return new MeshPhysicalMaterial({
      color: "#f5d095",
      metalness: 1.0,
      roughness: 0.08,
      envMapIntensity: 0.5,
    });
  }, [envMap]);

  const currentBlackMat = useMemo(() => new MeshPhysicalMaterial({ color: "#c2a475", metalness: 1, roughness: 0.4 }), []);

  const currentDiamond = useMemo(() => new MeshPhysicalMaterial({
    color: "#ffffff",
    metalness: 0,
    roughness: 0,
    transmission: 1,
    ior: 2.4,
    thickness: 0.5,
    envMapIntensity: 2.0,
    transparent: true
  }), []);

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        if (child.name === "mesh_0" || child.name === "mesh_1" || child.name === "Metal_Polish1") {
          child.material = customGoldMaterial;
        }
        // else if (child.name === "mesh_1") {
        //   child.material = currentBlackMat;
        // }
        else if (child.name !== "mesh_0" && child.name !== "mesh_1") {
          child.material = currentDiamond;
        }
      }
    });
  }, [scene, customGoldMaterial, currentBlackMat]);

  return <primitive object={scene} scale={1} />;
}