import * as THREE from 'three/webgpu';
import { positionWorld, cameraPosition, normalWorld, Fn, texture, equirectUV, normalize, sub, dot, pow, add } from 'three/tsl';

export default class MeshReflectionMaterialWebGPU extends THREE.NodeMaterial {
    constructor({ envMap, reflectivity = 2.5, opacity = 0.1, fresnel = 1.0 }) {
        super();
        
        this.transparent = true;
        this.depthWrite = false; // Important for layering
        this.opacityNode = opacity;
        this.side = THREE.DoubleSide;

        this.colorNode = Fn(() => {
            const viewDirection = normalize(sub(positionWorld, cameraPosition));
            const normal = normalWorld;
            
            // --- MANUAL REFLECTION FORMULA ---
            const dVN = dot(viewDirection, normal).mul(2.0);
            const reflectionDir = normalize(sub(viewDirection, normal.mul(dVN)));
            
            const reflectionSample = texture(envMap, equirectUV(reflectionDir)).level(0);
            const reflectionRGB = reflectionSample.rgb.mul(reflectivity);
            
            // Fresnel weighting for the shell
            const dotProduct = dot(viewDirection, normal); 
            const nFresnel = pow(add(1.0, dotProduct), 5.0).mul(fresnel);
            
            return reflectionRGB.mul(nFresnel);
        })();
    }
}