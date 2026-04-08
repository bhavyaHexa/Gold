import * as THREE from 'three';

export interface MeshRefractionMaterialWebGPUParameters {
  geometry: THREE.BufferGeometry;
  bvh: unknown;
  envMap: THREE.Texture;
  ior?: number;
  bounces?: number;
  aberrationStrength?: number;
  fresnel?: number;
  reflectivity?: number;
  opacity?: number;
  color?: string | number | THREE.Color;
  envRotation?: number;
  highlightColor?: string | number | THREE.Color;
  highlightTolerance?: number;
}

export default class MeshRefractionMaterialWebGPU extends THREE.Material {
  color: unknown;
  envRotation: number;
  highlightColor: unknown;
  highlightTolerance: number;
  constructor(parameters: MeshRefractionMaterialWebGPUParameters);
}