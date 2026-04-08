import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import MeshRefractionMaterialWebGPU from './MeshRefractionMaterial.js';

export type MeshRefractionMaterialProps = {
  /** The geometry of the parent mesh. Required for WebGPU BVH raytracing. */
  geometry: THREE.BufferGeometry;
  /** The HDR environment map used for refraction and reflection. */
  envMap?: THREE.Texture;
  /** Index of Refraction (IOR). Default is 2.4 (diamond). */
  ior?: number;
  /** Number of internal ray bounces. Default is 3. */
  bounces?: number;
  /** Chromatic aberration strength. Default is 0.013. */
  aberrationStrength?: number;
  /** Fresnel reflectance strength. Default is 1.0. */
  fresnel?: number;
  /** Reflectivity of the outer glassy shell. Default is 2.5. */
  reflectivity?: number;
  /** Opacity of the material. Default is 1.0. */
  opacity?: number;
  /** Base color tint of the diamond. Default is white. */
  color?: string | number | THREE.Color;
  /** Environment map rotation. */
  envRotation?: number;
  /** Color of the camera-aligned highlight. */
  highlightColor?: string | number | THREE.Color;
  /** Sensitivity of the camera-aligned highlight. */
  highlightTolerance?: number;
};

/**
 * Acts as a standard R3F declarative material component.
 * Automatically handles generating the BVH structure for WebGPU raytracing!
 */
export default function RefractionMaterial({
  geometry,
  envMap,
  ior = 2.4,
  bounces = 3,
  aberrationStrength = 0.013,
  fresnel = 1.0,
  reflectivity = 2.5,
  opacity = 1.0,
  color = '#ffffff',
  envRotation = 0,
  highlightColor = '#ff00ff',
  highlightTolerance = 0.85,
}: MeshRefractionMaterialProps) {
  
  const material = useMemo(() => {
    if (!geometry) return null;

    // Compute BVH automatically behind the scenes
    const bvh = new MeshBVH(geometry, { strategy: 1 });

    return new MeshRefractionMaterialWebGPU({
      geometry,
      bvh,
      envMap: envMap as unknown as THREE.Texture,
      ior,
      bounces,
      aberrationStrength,
      fresnel,
      reflectivity,
      opacity,
      color, // Passed once on creation
      envRotation,
      highlightColor,
      highlightTolerance
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, envMap, ior, bounces, aberrationStrength, fresnel, reflectivity, opacity, envRotation, highlightColor, highlightTolerance]);

  // Update color dynamically without rebuilding material/BVH array
  useEffect(() => {
    if (material) {
      material.color = color;
    }
  }, [color, material]);

  useEffect(() => {
    if (material) {
      material.envRotation = envRotation;
    }
  }, [envRotation, material]);

  useEffect(() => {
    if (material) {
      material.highlightColor = highlightColor;
    }
  }, [highlightColor, material]);

  useEffect(() => {
    if (material) {
      material.highlightTolerance = highlightTolerance;
    }
  }, [highlightTolerance, material]);

  if (!material) return null;

  return <primitive object={material} attach="material" />;
}