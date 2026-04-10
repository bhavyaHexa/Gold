import { Canvas } from "@react-three/fiber";
import { Environment, useHelper } from "@react-three/drei";
import { Suspense, useRef, useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import Model from "./Model";
import { RotateModelWrapper } from "./RotateModelWrapper";

// --- NEW DEBUGGER COMPONENT ---
function ToneMappingDebugger() {
  const { gl } = useThree();

  useEffect(() => {
    // Map of Three.js constants to readable strings
    const mappings = {
      [THREE.NoToneMapping]: "NoToneMapping",
      [THREE.LinearToneMapping]: "LinearToneMapping",
      [THREE.ReinhardToneMapping]: "ReinhardToneMapping",
      [THREE.CineonToneMapping]: "CineonToneMapping",
      [THREE.ACESFilmicToneMapping]: "ACESFilmicToneMapping",
      [THREE.AgXToneMapping]: "AgXToneMapping",
    };

    console.log("--- RENDERER DEBUGGER ---");
    console.log("Current Tone Mapping Value:", gl.toneMapping);
    console.log("Tone Mapping Type:", mappings[gl.toneMapping] || "Unknown");
    console.log("Exposure:", gl.toneMappingExposure);
    console.log("-------------------------");
  }, [gl]);

  return null;
}

function SpotlightWithHelper() {
  const lightRef = useRef();
  useHelper(lightRef, THREE.SpotLightHelper, "cyan");
  return <spotLight ref={lightRef} position={[0, -1.5, 5]} intensity={500} />;
}

export default function ModelViewer({ modelUrl, envUrl }) {
  return (
    <div style={{ background: "#ffffff", width: "100vw", height: "100vh" }}>
      <Canvas
        camera={{ position: [0, 2, 10], fov: 12, near: 0.1, far: 1000 }}
        gl={async (props) => {
          const THREE = await import("three");
          const { WebGPURenderer } = await import("three/webgpu");
          const renderer = new WebGPURenderer({ ...props, antialias: false });

          // Applying Linear Tone Mapping (Might be overridden by R3F initially)
          renderer.toneMapping = THREE.AgXToneMapping;

          // DEBUG: Log during initialization
          console.log("Initializing WebGPURenderer with LinearToneMapping (Value: 1)");

          await renderer.init();
          return renderer;
        }}
        onCreated={({ gl }) => {
          // React Three Fiber overrides toneMapping to ACESFilmicToneMapping by default.
          // We enforce LinearToneMapping here after the R3F setup is complete.
          gl.toneMapping = THREE.NoToneMapping;
        }}
      >
        {/* Adds the debugger to the scene loop */}
        <ToneMappingDebugger />

        <Suspense fallback={null}>
          <Environment
            files={envUrl}
            environmentRotation={[0, -4.84, 0]}
            background
          />

          {/* <SpotlightWithHelper /> */}

          <RotateModelWrapper minPitch={-0.2} maxPitch={1.5}>
            <directionalLight position={[0.627, -0.346, 0.698]} intensity={100} />
            <directionalLight position={[0.403, -0.913, 0.064]} intensity={50} />
            <Model url={modelUrl} />
          </RotateModelWrapper>
        </Suspense>
      </Canvas>
    </div>
  );
}