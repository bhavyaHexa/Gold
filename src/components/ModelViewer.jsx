import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { Suspense } from "react";
import { useControls } from "leva";
import Model from "./Model";
import { RotateModelWrapper } from "./RotateModelWrapper";



export default function ModelViewer({ modelUrl, envUrl }) {
  return (
    <div style={{ background: "#ffffff", width: "100vw", height: "100vh" }}>
      <Canvas
        camera={{ position:[0,2,10], fov: 12, near: 0.1, far: 1000 }}
        gl={async (props) => {
          const THREE = await import("three");
          const { WebGPURenderer } = await import("three/webgpu");
          const renderer = new WebGPURenderer({ ...props, antialias: true });
          // renderer.toneMapping = THREE.ACESFilmicToneMapping;
          // renderer.outputColorSpace = THREE.SRGBColorSpace;
          await renderer.init();
          return renderer;
        }}
      >
        <Suspense fallback={null}>
          {/* 3. Replace the old <Environment /> with our new controlled one */}
           <Environment
      files={envUrl}
      // 2. Pass the Leva values to the environmentRotation prop
      environmentRotation={[0, -4.84, 0]}
      
      // Optional: Add backgroundRotation={...} if you also want the visible HDRI background to rotate
    />
          
          <RotateModelWrapper minPitch={-0.2} maxPitch={1.5}>
            <Model url={modelUrl} />
          </RotateModelWrapper>
        </Suspense>
      </Canvas>
    </div>
  );
}