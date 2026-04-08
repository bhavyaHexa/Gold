import { useGLTF, useEnvironment } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { MeshPhysicalNodeMaterial } from "three/webgpu";
import { color, reflectVector, pmremTexture, float, vec3, dot, pow, transformedNormalView, positionViewDirection } from "three/tsl";

export default function Model({ url }) {
  const { scene } = useGLTF(url);
  const envMap = useEnvironment({ files: "/env_metal_001_d01c4504e0.hdr" });




  const customGoldMaterial = useMemo(() => {
    const mat = new MeshPhysicalNodeMaterial({
      metalness: 1,
      roughness: 0.02,
      clearcoat: 0.18,
      clearcoatRoughness: 0.03,
    });

    const goldTint = color("#f0b961");

    // 1. Sample the environment map
    const envRes = pmremTexture(envMap, reflectVector, float(0.01));

    // 2. Boost the environment brightness to isolate the bright lights
    // Increase this multiplier (e.g., to 5.0 or 6.0) if you want even brighter/larger white spots
    const envBrightnessMultiplier = float(6.0);
    const brightEnv = envRes.mul(envBrightnessMultiplier);

    // 3. Extract luminance to find the exact white spots in the HDR
    const luminance = brightEnv.dot(vec3(0.2126, 0.7152, 0.0722));

    // 4. Tighten the highlight mask so it only affects the brightest lights 
    // The pow() function ensures the white doesn't bleed into the rest of the gold ring
    const highlightMask = pow(luminance.clamp(0, 1), float(10.0));

    // 5. Calculate Fresnel for nice edge reflections
    const viewDotNormal = dot(transformedNormalView, positionViewDirection.negate()).clamp(0, 1);
    const fresnel = pow(float(1.0).sub(viewDotNormal), float(5.0));

    // Combine the direct highlight mask and the edge fresnel
    const finalHighlight = highlightMask.add(fresnel.mul(5.0)).clamp(0, 1);

    // 6. IMPORTANT: Mix the gold tint towards pure white in the bright spots.
    // Pure white reflection color + bright environment = sharp, glowing white spots.
    mat.colorNode = goldTint.mul(finalHighlight);

    return mat;
  }, [envMap]);

  const currentBlackMat = useMemo(() => new MeshPhysicalNodeMaterial({ color: "#c2a475", metalness: 1, roughness: 0.4 }), []);

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
