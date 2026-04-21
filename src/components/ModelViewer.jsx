import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Suspense, useEffect, useState } from "react";
import { useControls } from "leva";
import * as THREE from "three"; // Import THREE for constants
import Model from "./Model";
import { RotateModelWrapper } from "./RotateModelWrapper";

import { Effects } from "@react-three/drei";

import { SSRPass } from 'three/addons/postprocessing/SSRPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { HueSaturation } from '@react-three/postprocessing'

// import { RenderPass } from "three-stdlib";
import { extend } from "@react-three/fiber";

extend({ SsrPass: SSRPass, RenderPass: RenderPass });

function PostProcessing() {
  const { gl, scene, camera, size } = useThree();
  const [ssrSelection, setSsrSelection] = useState(null);

  const { enabled, intensity, distance, selective, ...ssrProps } = useControls("SSR Settings", {
    enabled: true,
    selective: true,
    intensity: { value: 0.2, min: 0, max: 3 },
    exponent: { value: 0.2, min: 0, max: 1 },
    distance: { value: 5, min: 0, max: 200 },
    fade: { value: 10, min: 0, max: 20 },
    roughnessFade: { value: 1, min: 0, max: 1 },
    thickness: { value: 0.1, min: 0, max: 20 },
    maxRoughness: { value: 1, min: 0, max: 1 },
    maxSteps: { value: 20, min: 0, max: 100 },
    ior: { value: 1.45, min: 1, max: 2 },
  });

  // useEffect(() => {
  //   if (selective) {
  //     const selected = [];
  //     scene.traverse((child) => {
  //       if (child.isMesh && child.name === "Metal_Polish1") {
  //         selected.push(child);
  //       }
  //     });
  //     setSsrSelection(selected.length > 0 ? selected : null);
  //   } else {
  //     setSsrSelection(null);
  //   }
  // }, [scene, selective]);

  return (
    <Effects>
      <renderPass args={[scene, camera]} />
      {/* Map Leva props to SSRPass instance properties */}
      <ssrPass
        key={selective ? "selective" : "all"}
        args={[{
          renderer: gl,
          scene,
          camera,
          width: size.width,
          height: size.height,
          selects: ssrSelection
        }]}
        opacity={intensity}
        maxDistance={distance}
        ior={ssrProps.ior}
        thickness={ssrProps.thickness}
        {...ssrProps}
        enabled={enabled}
      />
    </Effects>
  );
}

function ToneMappingDebugger() {
  const { gl } = useThree();

  // 1. Setup Leva Controls
  const { toneMapping, exposure } = useControls("Renderer Settings", {
    toneMapping: {
      value: THREE.ACESFilmicToneMapping,
      options: {
        None: THREE.NoToneMapping,
        Linear: THREE.LinearToneMapping,
        Reinhard: THREE.ReinhardToneMapping,
        Cineon: THREE.CineonToneMapping,
        ACESFilmic: THREE.ACESFilmicToneMapping,
        AgX: THREE.AgXToneMapping,
      },
    },
    exposure: { value: 1.0, min: 0, max: 2, step: 0.01 },
  });

  // 2. Update the renderer whenever the UI changes
  useEffect(() => {
    gl.toneMapping = Number(toneMapping);
    gl.toneMappingExposure = exposure;
    gl.needsUpdate = true;

    console.log("Renderer Tone Mapping:", gl.toneMapping);
    console.log("THREE.NoToneMapping is:", THREE.NoToneMapping);
  }, [gl, toneMapping, exposure]);

  return null;
}

export default function ModelViewer({ modelUrl, envUrl }) {
  return (
    <div style={{ background: "#ffffff", width: "100vw", height: "100vh" }}>
      <Canvas
        flat
        camera={{ position: [0, 2, 10], fov: 12, near: 0.1, far: 1000 }}
        gl={{
          toneMapping: THREE.NoToneMapping,
        }}
      // gl={async (props) => {
      //   const { WebGPURenderer } = await import("three/webgpu");
      //   const renderer = new WebGPURenderer({ ...props, antialias: true });

      //   // 3. Set LinearToneMapping as the default during initialization
      //   renderer.toneMapping = THREE.LinearToneMapping;
      //   renderer.toneMappingExposure = 1.0;

      //   await renderer.init();
      //   return renderer;
      // }}
      >
        {/* 4. Add the debugger inside the Canvas */}
        <ToneMappingDebugger />

        <Suspense fallback={null}>
          <Environment
            frames={Infinity}
            files={"/env_metal_001_d01c4504e0.hdr"}
            // preset='studio'
            resolution={256}
            environmentIntensity={1}
            environmentRotation={[0, 4.38, 0]}
          >
            {/* <Lightformer intensity={1.0} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={[10, 10, 1]} /> */}
            {/* <Lightformer intensity={1.0} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={[10, 10, 1]} /> */}
            {/* <group rotation={[Math.PI / 2, 1, 0]}>
              {[2, -2, 2, -4, 2, -5, 2, -9].map((x, i) => (
                <Lightformer key={i} intensity={1} rotation={[Math.PI / 4, 0, 0]} position={[x, 4, i * 4]} scale={[4, 1, 1]} />
              ))} */}
            {/* <Lightformer intensity={1} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={[50, 2, 1]} /> */}
            {/* <Lightformer intensity={1} rotation-y={Math.PI / 2} position={[-5, -1, -1]} scale={[50, 2, 1]} /> */}
            {/* <Lightformer intensity={0.1} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={[50, 2, 1]} />
            </group>
            <group> */}
            {/* <Lightformer intensity={0.8} form="ring" color="#ffffff" rotation-y={Math.PI / 2} position={[-5, 2, -1]} scale={[10, 10, 1]} /> */}
            {/* </group> */}
          </Environment>

          <RotateModelWrapper minPitch={-0.2} maxPitch={1.5}>
            <Model url={modelUrl} />

            {/* <mesh position={[0, 0, -2]}>
              <sphereGeometry args={[0.5, 32, 32]} />
              <meshPhysicalMaterial color="red" />
            </mesh> */}
          </RotateModelWrapper>

          <PostProcessing />

        </Suspense>
      </Canvas>
    </div>
  );
}