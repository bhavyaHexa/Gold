import { useMemo } from 'react';
import * as THREE from 'three';

import MeshReflectionMaterialWebGPU from './MeshReflectionMaterial.js';

export type MeshReflectionMaterialProps = {
  /** The HDR environment map used for reflection. */
  envMap?: THREE.Texture;
  /** Reflectivity strength. Default is 2.5. */
  reflectivity?: number;
  /** Opacity of the shell. Default is 0.1. */
  opacity?: number;
  /** Fresnel strength. Default is 1.0. */
  fresnel?: number;
};

export default function ReflectionMaterial({
  envMap,
  reflectivity = 2.5,
  opacity = 0.1,
  fresnel = 1.0,
}: MeshReflectionMaterialProps) {
  
  const material = useMemo(() => {
    return new MeshReflectionMaterialWebGPU({
      envMap: envMap || null,
      reflectivity,
      opacity,
      fresnel
    });
  }, [envMap, reflectivity, opacity, fresnel]);

  return <primitive object={material} attach="material" />;
}