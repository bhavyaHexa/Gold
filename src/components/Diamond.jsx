import { Fragment, useEffect, useMemo } from "react";
import { createPortal } from "@react-three/fiber";
import { useEnvironment } from "@react-three/drei";
import { useControls } from "leva";
import RefractionMaterial from "../materials/RefractionMaterial/RefractionMaterial";

export default function Diamond({ scene }) {
  const { diamondColor, diamondEnvRotation, highlightColor, highlightTolerance } = useControls("Diamond", {
    diamondColor: "#ffffff",
    diamondEnvRotation: { value: 0, min: 0, max: Math.PI * 2, step: 0.01 },
    highlightColor: "#ffffff",
    highlightTolerance: { value: 1.0, min: 0.5, max: 1.0, step: 0.01 },
  });

  const envMap = useEnvironment({ files: "/gemEnv.exr" });

  const diamondMeshes = useMemo(() => {
    const meshes = [];
    scene.updateMatrixWorld(true);

    scene.traverse((child) => {
      if (child.isMesh && child.name.includes("D")) {
        meshes.push(child);
      }
    });

    return meshes;
  }, [scene]);

  useEffect(() => {
    diamondMeshes.forEach((mesh) => {
      mesh.layers.enable(1);
    });
  }, [diamondMeshes]);

  return (
    <>
      {diamondMeshes.map((mesh) => (
        <Fragment key={mesh.uuid}>
          {createPortal(
            <RefractionMaterial
              geometry={mesh.geometry}
              envMap={envMap}
              bounces={8}
              ior={2.42}
              fresnel={0}
              aberrationStrength={0.001}
              reflectivity={0}
              opacity={1.0}
              color={diamondColor}
              envRotation={diamondEnvRotation}
              highlightColor={highlightColor}
              highlightTolerance={highlightTolerance}
            />,
            mesh,
          )}
        </Fragment>
      ))}
    </>
  );
}
