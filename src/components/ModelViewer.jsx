import { Canvas, useThree, extend } from "@react-three/fiber";
import { Environment, Effects } from "@react-three/drei";
import { Suspense, useEffect } from "react";
import { useControls } from "leva";
import * as THREE from "three";
import Model from "./Model";
import { RotateModelWrapper } from "./RotateModelWrapper";
import PostProcessing from "./PostProcessing";



function ToneMappingDebugger() {
  const { gl } = useThree();

  const { toneMapping, exposure } = useControls("Renderer Settings", {
    toneMapping: {
      value: THREE.NoToneMapping,
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

  useEffect(() => {
    gl.toneMapping = Number(toneMapping);
    gl.toneMappingExposure = exposure;
    gl.needsUpdate = true;
  }, [gl, toneMapping, exposure]);

  return null;
}

export default function ModelViewer({ modelUrl, envUrl }) {
  return (
    <div style={{ background: "#ffffff", width: "100vw", height: "100vh" }}>
      <Canvas



        camera={{ position: [0, 2, 10], fov: 12, near: 0.1, far: 100 }}

        // gl={{

        //   toneMapping: THREE.NoToneMapping,

        //   antialias: false

        // }}

        gl={async (props) => {
          const { WebGPURenderer } = await import("three/webgpu");
          const renderer = new WebGPURenderer({
            ...props,
            antialias: false,
            requiredLimits: { maxColorAttachmentBytesPerSample: 128 }
          });

          // 3. Set NoToneMapping as the default during initialization
          renderer.toneMapping = THREE.NoToneMapping;
          renderer.toneMappingExposure = 1.0;

          await renderer.init();
          return renderer;
        }}
      >
        <Suspense fallback={null}>
          <ToneMappingDebugger />
          <color attach="background" args={["#ffffff"]} />
          <Environment
            frames={Infinity}
            files={"/env_metal_001_d01c4504e0.hdr"}
            resolution={256}
            environmentIntensity={1}
            environmentRotation={[0, -4.38, 0]}
          />

          <RotateModelWrapper minPitch={-0.2} maxPitch={1.5}>
            <Model url={modelUrl} />

            {/* <mesh position={[-1, 0, -2]}>
              <sphereGeometry args={[0.5, 64, 64]} />
              <meshPhysicalMaterial color="red" />
            </mesh> */}

          </RotateModelWrapper>

          <PostProcessing />

        </Suspense>
      </Canvas>
    </div>
  );
}