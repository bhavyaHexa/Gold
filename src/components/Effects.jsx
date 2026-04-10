import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { PostProcessing } from "three/webgpu";
// 1. Import MRT utilities from TSL
import { pass, mrt, output, normalView } from "three/tsl";
// 2. Import the SSGI node from Three.js addons
import { ssgi } from "three/addons/tsl/display/SSGINode.js";

export default function Effects() {
  const { gl, scene, camera } = useThree();
  const [postProcessing, setPostProcessing] = useState(null);

  useEffect(() => {
    // Only apply if the WebGPURenderer is active
    if (!gl.isWebGPURenderer) return;

    // Create the native WebGPU PostProcessing pipeline
    const pp = new PostProcessing(gl);

    // Create a pass for the scene
    const scenePass = pass(scene, camera);

    // 3. Configure Multiple Render Targets (MRT)
    // SSGI needs access to the scene's normals alongside the standard output
    scenePass.setMRT(
      mrt({
        output: output,
        normal: normalView,
      })
    );

    // Super Sample Anti-Aliasing (SSAA)
    scenePass.setResolutionScale(2);

    // 4. Extract the required texture nodes from the MRT scene pass
    const beautyNode = scenePass.getTextureNode("output");
    const normalNode = scenePass.getTextureNode("normal");
    const depthNode = scenePass.getTextureNode("depth"); // Depth is generated automatically

    // 5. Create the SSGI effect node
    const ssgiEffect = ssgi(beautyNode, depthNode, normalNode, camera);

    // Tweak SSGI uniform values to realistic levels
    ssgiEffect.giIntensity.value = 1.5; // Lowered from 10
    ssgiEffect.aoIntensity.value = 1;
    ssgiEffect.radius.value = 8;

    // 6. Set the SSGI effect as the final pipeline output
    pp.outputNode = ssgiEffect;

    setPostProcessing(pp);

    return () => {
      // Cleanup
      if (pp.dispose) pp.dispose();
    };
  }, [gl, scene, camera]);

  // Hook into the render loop with priority 1 (overrides default R3F render)
  useFrame(() => {
    if (postProcessing) {
      postProcessing.render();
    }
  }, 1);

  return null;
}