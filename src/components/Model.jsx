import { useGLTF, useEnvironment } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { NodeMaterial, MeshPhysicalNodeMaterial } from "three/webgpu";
import { color, reflectVector, pmremTexture, float, vec3, dot, pow, normalView, positionViewDirection } from "three/tsl";

export default function Model({ url }) {
  const { scene } = useGLTF(url);
  const envMap = useEnvironment({ files: "/env_metal_001_d01c4504e0.hdr" });

  const customGoldMaterial = useMemo(() => {
    const mat = new NodeMaterial();

    // The user strictly requested #f5d095 for the primary gold tint.
    const goldTint = color("#f5d095"); 
    
    // To make it look "Rose Gold", we inject a reddish/copper tone into the crevices and grazing angles
    const deepGold = color("#a84a44"); 

    // Dynamic color depth based on viewing angle (Fresnel effect)
    const viewDotNormal = dot(normalView, positionViewDirection.negate()).clamp(0, 1);
    const goldBase = deepGold.mix(goldTint, viewDotNormal);

    // Sample the environment map (highly polished, so very low roughness 0.01)
    const envRes = pmremTexture(envMap, reflectVector, float(0.01));
    
    // Tint the environment purely with our deep rose gold
    // We removed the extreme 1.8 multiplier to stop the HDR from bleaching the pinks/yellows out!
    const finalColor = envRes.mul(goldBase);

    // Apply color natively to let ACESFilmic map the colors properly
    mat.colorNode = finalColor;

    return mat;
  }, [envMap]);

  const currentBlackMat = useMemo(() => new MeshPhysicalNodeMaterial({ color: "black", metalness: 1, roughness: 0.4 }), []);

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