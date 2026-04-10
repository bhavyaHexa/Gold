import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { MeshPhysicalNodeMaterial } from "three/webgpu";
import { color, mix, luminance, uniform } from "three/tsl";
import { useControls } from "leva";

export default function GoldMetal({ scene, envMap }) {
  // 1. Leva Controls
  const settings = useControls("Metal Post-Process", {
    exposure: { value: 1.0, min: 0, max: 2, step: 0.01 },
    brightness: { value: 0.0, min: -0.5, max: 0.5, step: 0.01 },
    contrast: { value: 1.0, min: 0.5, max: 1.5, step: 0.01 },
    saturation: { value: 1.0, min: 0, max: 2, step: 0.01 },
    goldBase: "#f5d095",
    blackBase: "#1a1a1a",
  });

  // 2. Setup Uniforms (This is the "Pro" way to handle real-time updates)
  // Uniforms allow the GPU to see the change WITHOUT re-compiling the shader.
  const uniforms = useMemo(() => ({
    exposure: uniform(1.0),
    brightness: uniform(0.0),
    contrast: uniform(1.0),
    saturation: uniform(1.0),
    goldColor: uniform(color("#f5d095")),
    blackColor: uniform(color("#1a1a1a"))
  }), []);

  // 3. Global Environment Setup
  useEffect(() => {
    if (!envMap) return;
    envMap.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = envMap;
  }, [envMap, scene]);

  // 4. Create Materials ONCE
  const { goldMaterial, blackMaterial } = useMemo(() => {
    const applyGrading = (baseNode) => {
      let res = baseNode.mul(uniforms.exposure);
      res = res.add(uniforms.brightness);
      res = res.sub(0.5).mul(uniforms.contrast).add(0.5);
      const gray = luminance(res);
      return mix(gray, res, uniforms.saturation);
    };

    const gold = new MeshPhysicalNodeMaterial({
      metalness: 1.0,
      roughness: 0.03,
      clearcoat: 1.0,
    });
    gold.colorNode = applyGrading(uniforms.goldColor);

    const black = new MeshPhysicalNodeMaterial({
      metalness: 1.0,
      roughness: 0.35,
    });
    black.colorNode = applyGrading(uniforms.blackColor);

    return { goldMaterial: gold, blackMaterial: black };
  }, [uniforms]);

  // 5. UPDATE UNIFORMS (This makes it real-time)
  useEffect(() => {
    uniforms.exposure.value = settings.exposure;
    uniforms.brightness.value = settings.brightness;
    uniforms.contrast.value = settings.contrast;
    uniforms.saturation.value = settings.saturation;
    uniforms.goldColor.value.set(settings.goldBase);
    uniforms.blackColor.value.set(settings.blackBase);

    // Optional: Only needed if the visual doesn't refresh automatically in your loop
    // goldMaterial.needsUpdate = true;
    // blackMaterial.needsUpdate = true;
  }, [settings, uniforms]);

  // 6. Apply to Scene
  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        if (child.name === "Metal_Polish1") child.material = goldMaterial;
        if (child.name === "Metal_Brush") child.material = blackMaterial;
      }
    });
  }, [scene, goldMaterial, blackMaterial]);

  return null;
}