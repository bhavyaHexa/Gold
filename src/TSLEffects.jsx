import { useRef, useState, useEffect, useMemo } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import {
  pass, mrt, output, normalView, velocity,
  directionToColor, uniform, acesFilmicToneMapping,
  vec3, vec4
} from "three/tsl";
import { useControls } from "leva";

// Only import TRAA for Anti-Aliasing
import { traa } from "three/addons/tsl/display/TRAANode.js";

export default function TSLEffects() {
  const { gl, scene, camera } = useThree();
  const postRef = useRef(null);
  const scenePassRef = useRef(null);
  const [ready, setReady] = useState(false);
  
  const lastCameraMatrix = useRef(new THREE.Matrix4());
  const frameCount = useRef(0);
  const maxFrames = 100;

  /* ---------------- UI ---------------- */
  const config = useControls("Post Processing", {
    exposure: { value: 1.0, min: 0.1, max: 3.0 },
  });

  /* ---------------- UNIFORMS ---------------- */
  const u = useMemo(() => ({
    exposure: uniform(1.0),
  }), []);

  /* ---------------- PIPELINE SETUP ---------------- */
  useEffect(() => {
    if (!(gl instanceof THREE.WebGPURenderer)) return;

    gl.autoRender = false;
    const post = new THREE.PostProcessing(gl);
    
    // 1. Scene Pass Setup
    const scenePass = pass(scene, camera);
    scenePassRef.current = scenePass;

    // We need velocity for TRAA to handle motion re-projection
    scenePass.setMRT(mrt({
      output,
      normal: directionToColor(normalView),
      velocity
    }));

    // 2. Extract Texture Nodes
    const colorNode = scenePass.getTextureNode("output");
    const depthNode = scenePass.getTextureNode("depth");
    const velocityNode = scenePass.getTextureNode("velocity");

    // 3. Tone Mapping & Exposure
    // Applying tone mapping directly to the scene output
    const tonedColor = acesFilmicToneMapping(colorNode.rgb.mul(u.exposure));

    // 4. Background Masking (Ensuring sharp white background)
    const isForeground = depthNode.lessThan(1.0);
    const whiteBackground = vec3(1.0, 1.0, 1.0);
    const finalComposite = isForeground.select(tonedColor, whiteBackground);

    // 5. Temporal Anti-Aliasing (TRAA)
    // Note: TRAA works by jittering the camera sub-pixel and blending frames
    const traaPass = traa(vec4(finalComposite, 1.0), depthNode, velocityNode, camera);
    
    post.outputNode = traaPass;
    postRef.current = post;
    setReady(true);

    return () => {
      post.dispose();
      gl.autoRender = true;
    };
  }, [gl, scene, camera, u]);

  /* ---------------- RENDER LOOP ---------------- */
  useFrame(() => {
    if (ready && postRef.current && scenePassRef.current) {
      // Sync Uniforms
      u.exposure.value = config.exposure;

      // Reset jitter/accumulation if camera moves
      const cameraMoved = !lastCameraMatrix.current.equals(camera.matrixWorld);
      if (cameraMoved) { 
        frameCount.current = 0; 
        lastCameraMatrix.current.copy(camera.matrixWorld); 
      }

      // Handle Jitter for TRAA
      // TRAA requires 'jitter' to be true to sample different sub-pixel positions
      if (frameCount.current < maxFrames) {
        scenePassRef.current.jitter = true; 
        frameCount.current++;
      } else {
        scenePassRef.current.jitter = false;
      }

      postRef.current.render();
    }
  }, 1);

  return null;
}