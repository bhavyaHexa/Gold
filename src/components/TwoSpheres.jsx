import { useMemo, useRef, useState } from "react"
import { useEnvironment } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three";

// Use standard NodeMaterial which is confirmed to work in Model.jsx
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { 
    color, 
    float, 
    vec3,
    cubeTexture, 
    reflectVector,
    pmremTexture,
    dot,
    pow,
    transformedNormalView,
    positionViewDirection
} from 'three/tsl'

/**
 * A sphere that captures its surroundings into a cube map 
 * and uses it for its own material reflections.
 */
function ReflectiveSphere({ position }) {
    const meshRef = useRef();
    const { gl, scene } = useThree();

    // 1. Create a CubeRenderTarget and CubeCamera manually for full control
    const [renderTarget] = useState(() => new THREE.WebGLCubeRenderTarget(512, {
        format: THREE.RGBAFormat,
        generateMipmaps: true,
        magFilter: THREE.LinearFilter,
        minFilter: THREE.LinearMipmapLinearFilter,
        type: THREE.HalfFloatType // Higher precision for metallic reflections
    }));

    const cubeCamera = useMemo(() => new THREE.CubeCamera(0.1, 1000, renderTarget), [renderTarget]);

    // 2. Create the TSL-based material
    const material = useMemo(() => {
        const mat = new MeshStandardNodeMaterial();
        
        const goldTint = color('#f6bb5c');
        const deepGold = color('#7a4d1d');
        const customRoughness = float(0.01);
        
        // Fresnel for depth
        const viewDotNormal = dot(transformedNormalView, positionViewDirection.negate()).clamp(0, 1);
        const fresnelValue = float(1.0).sub(viewDotNormal).pow(float(3.0));
        const metallicBase = deepGold.mix(goldTint, fresnelValue);

        // Core reflections: HDRI (Static) + Scene (Dynamic)
        const hdriRes = pmremTexture(hdriMap, reflectVector, customRoughness);
        const dynamicRes = cubeTexture(renderTarget.texture, reflectVector);
        
        // Combine them
        const combinedReflections = hdriRes.add(dynamicRes);
        
        // Final color logic
        const luminance = combinedReflections.dot(vec3(0.2126, 0.7152, 0.0722));
        const highlightMask = pow(luminance, float(2.5));
        const tintedEnv = combinedReflections.mul(metallicBase);
        
        mat.colorNode = tintedEnv.mix(combinedReflections, highlightMask).mul(float(1.1));
        
        return mat;
    }, [hdriMap, renderTarget.texture]);

    // 3. Update the CubeCamera each frame
    useFrame(() => {
        if (meshRef.current && gl) {
            // Hide the sphere so it doesn't reflect itself
            meshRef.current.visible = false;
            
            // Sync camera position to sphere position
            cubeCamera.position.set(position[0], position[1], position[2]);
            
            // Render the surroundings into the cube map
            cubeCamera.update(gl, scene);
            
            // Show the sphere again
            meshRef.current.visible = true;
        }
    });

    return (
        <mesh ref={meshRef} position={position} castShadow receiveShadow material={material}>
            <sphereGeometry args={[1, 64, 64]} />
        </mesh>
    )
}

export default function TwoSpheres() {
    // Load the HDRI to provide a base environment for the whole scene
    const envMap = useEnvironment({ files: '/env_metal_001_d01c4504e0.hdr' })

    return (
        <group>
            {/* Left sphere */}
            <ReflectiveSphere position={[-1.01, 0, 0]} hdriMap={envMap} />
            
            {/* Right sphere */}
            <ReflectiveSphere position={[1.01, 0, 0]} hdriMap={envMap} />
        </group>
    )
}
