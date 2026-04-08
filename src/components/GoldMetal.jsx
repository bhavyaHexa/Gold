import { useEffect, useMemo } from "react";
import { MeshPhysicalNodeMaterial } from "three/webgpu";
import { color, reflectVector, pmremTexture, float, vec3, dot, pow, transformedNormalView, positionViewDirection } from "three/tsl";

export default function GoldMetal({ scene, envMap }) {
  const goldMaterial = useMemo(() => {
    const material = new MeshPhysicalNodeMaterial({
      metalness: 1,
      roughness: 0.02,
      clearcoat: 0.18,
      clearcoatRoughness: 0.03,
    });

    const goldTint = color("#ffc266");
    const envRes = pmremTexture(envMap, reflectVector, float(0.01));
    const envBrightnessMultiplier = float(6.0);
    const brightEnv = envRes.mul(envBrightnessMultiplier);
    const luminance = brightEnv.dot(vec3(0.2126, 0.7152, 0.0722));
    const highlightMask = pow(luminance.clamp(0, 1), float(10.0));
    const viewDotNormal = dot(transformedNormalView, positionViewDirection.negate()).clamp(0, 1);
    const fresnel = pow(float(1.0).sub(viewDotNormal), float(5.0));
    const finalHighlight = highlightMask.add(fresnel.mul(5.0)).clamp(0, 1);

    material.colorNode = goldTint.mul(finalHighlight);

    return material;
  }, [envMap]);

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh && child.name.startsWith("M")) {
        child.material = goldMaterial;
      }
    });
  }, [scene, goldMaterial]);

  return null;
}
