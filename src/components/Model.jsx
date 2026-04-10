import { useGLTF, useEnvironment } from "@react-three/drei";
import GoldMetal from "./GoldMetal";
import Diamond from "./Diamond";

export default function Model({ url }) {
  const { scene } = useGLTF(url);
  const envMap = useEnvironment({ files: "/Untitled.exr" });

  return (
    <>
      <GoldMetal scene={scene} envMap={envMap} />
      {/* <Diamond scene={scene} /> */}
      <primitive object={scene} scale={1} />
    </>
  );
}
