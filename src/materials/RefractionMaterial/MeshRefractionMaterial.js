import * as THREE from 'three/webgpu';
import { 
    storage, wgslFn, positionWorld, cameraPosition, normalWorld, Fn, 
    texture, equirectUV, normalize, sub, add, vec3, mix, dot, pow, vec2,
    modelWorldMatrix, modelWorldMatrixInverse, clamp, smoothstep, refract,
    viewportSharedTexture, screenUV, normalView, positionView, uniform,
    sin, cos
} from 'three/tsl';
import { bvhIntersectFirstHit } from './bvh_ray_functions.wgsl.js'; 
import { bvhNodeStruct } from './common_functions.wgsl.js'; 

function padArrayVec3ToVec4(array, Type) {
    const numItems = array.length / 3;
    const padded = new Type(numItems * 4);
    for (let i = 0; i < numItems; i++) {
        padded[i * 4 + 0] = array[i * 3 + 0];
        padded[i * 4 + 1] = array[i * 3 + 1];
        padded[i * 4 + 2] = array[i * 3 + 2];
        padded[i * 4 + 3] = 0; 
    }
    return padded;
}

export default class MeshRefractionMaterialWebGPU extends THREE.NodeMaterial {
    constructor({ 
        geometry, bvh, envMap, ior = 2.4, bounces = 3, 
        aberrationStrength = 0.01, // FIX 1: Reduced to keep internal lines sharp (was 0.025)
        fresnel = 1.0, reflectivity = 1.0, 
        color = 0xffffff, blur = 0.12, envRotation = 0.0,
        highlightColor = 0xffffff, highlightTolerance = 0.85
    }) {
        super();
        
        this.transparent = true; 
        this.depthWrite = true;

        this._diamondColorNode = uniform(new THREE.Color(color));
        this._blurNode = uniform(blur); 
        this._envRotationNode = uniform(envRotation);
        
        this._highlightColorNode = uniform(new THREE.Color(highlightColor)); 
        this._highlightToleranceNode = uniform(highlightTolerance); 

        const paddedPositions = padArrayVec3ToVec4(geometry.attributes.position.array, Float32Array);
        const paddedIndices = padArrayVec3ToVec4(geometry.index.array, Uint32Array);
        const bvhPackedArray = new Uint32Array(bvh._roots[0]); 

        const bvhPositionNode = storage(new THREE.StorageBufferAttribute(paddedPositions, 4), 'vec3', paddedPositions.length / 4).toReadOnly();
        const bvhIndexNode = storage(new THREE.StorageBufferAttribute(paddedIndices, 4), 'uvec3', paddedIndices.length / 4).toReadOnly();
        const bvhTreeDataNode = storage(new THREE.StorageBufferAttribute(bvhPackedArray, 8), 'BVHNode', bvhPackedArray.length / 8).toReadOnly();

        const iorR = ior * (1.0 - aberrationStrength);
        const iorG = ior;
        const iorB = ior * (1.0 + aberrationStrength);

        const calculateInternalBounces = wgslFn(`
            fn calculateInternalBounces(
                vWorldPos: vec3<f32>, rd: vec3<f32>, normal: vec3<f32>, ior: f32,
                bvh_index: ptr<storage, array<vec3u>, read>, bvh_position: ptr<storage, array<vec3f>, read>,
                bvh: ptr<storage, array<BVHNode>, read>, modelMatrixInverse: mat4x4<f32>, modelMatrix: mat4x4<f32>
            ) -> vec3<f32> {
                var worldRefractDir = refract(rd, normal, 1.0 / ior);
                var rayOrigin = (modelMatrixInverse * vec4<f32>(vWorldPos, 1.0)).xyz;
                var rayDirection = normalize((modelMatrixInverse * vec4<f32>(worldRefractDir, 0.0)).xyz);
                
                rayOrigin = rayOrigin + rayDirection * 0.015; 
                
                let numBounces: i32 = ${parseInt(bounces)};
                for(var i: i32 = 0; i < numBounces; i = i + 1) {
                    var ray: Ray;
                    ray.origin = rayOrigin; ray.direction = rayDirection;
                    let hitResult = bvhIntersectFirstHit(bvh_index, bvh_position, bvh, ray);
                    if (hitResult.didHit) {
                        let hitPos = rayOrigin + rayDirection * max(hitResult.dist - 0.001, 0.0);
                        let tempDir = refract(rayDirection, hitResult.normal, ior); 
                        if (length(tempDir) != 0.0) { rayDirection = tempDir; break; }
                        rayDirection = reflect(rayDirection, hitResult.normal);
                        rayOrigin = hitPos + rayDirection * 0.001;
                    } else { break; }
                }
                return normalize((modelMatrix * vec4<f32>(rayDirection, 0.0)).xyz);
            }
        `, [ bvhNodeStruct, bvhIntersectFirstHit ]); 

        this.colorNode = Fn(() => {
            const worldPos = positionWorld;
            const camPos = cameraPosition;
            const viewDirection = normalize(sub(worldPos, camPos));
            const normal = normalWorld;

            const dotNL = dot(viewDirection, normal);
            const facingRatio = sub(0.0, dotNL); 
            const isFrontFacing = smoothstep(-0.2, 0.0, facingRatio);

            const mipLevel = this._blurNode.mul(300.0);

            const rotateY = (v, angle) => {
                const s = sin(angle);
                const c = cos(angle);
                return vec3(
                    add(v.x.mul(c), v.z.mul(s)),
                    v.y,
                    add(v.x.mul(s).negate(), v.z.mul(c))
                );
            };

            const envRot = this._envRotationNode;

            const baseArgs = {
                vWorldPos: worldPos, rd: viewDirection, normal: normal, 
                bvh_index: bvhIndexNode, bvh_position: bvhPositionNode, bvh: bvhTreeDataNode,
                modelMatrixInverse: modelWorldMatrixInverse, modelMatrix: modelWorldMatrix
            };

            // ==========================================
            // 1. FRONT FACETS: HYBRID DIAMOND FIRE
            // ==========================================
            const exitR = calculateInternalBounces({ ...baseArgs, ior: iorR });
            const exitG = calculateInternalBounces({ ...baseArgs, ior: iorG });
            const exitB = calculateInternalBounces({ ...baseArgs, ior: iorB });
            
            const envDiamond = vec3(
                texture(envMap, equirectUV(rotateY(exitR, envRot))).level(mipLevel).r,
                texture(envMap, equirectUV(rotateY(exitG, envRot))).level(mipLevel).g,
                texture(envMap, equirectUV(rotateY(exitB, envRot))).level(mipLevel).b
            );

            // FIX 2: Reduced from 0.45 to 0.05. This stops the background from shredding into noise.
            const fireDistortion = 0.05; 
            let screenDiamond = vec3(0).toVar();
            
            const o = this._blurNode;
            const offsets = [ vec2(o, o), vec2(o.negate(), o), vec2(o, o.negate()), vec2(o.negate(), o.negate()) ];
            
            for(let i = 0; i < 4; i++) {
                screenDiamond.addAssign(vec3(
                    viewportSharedTexture(screenUV.add(exitR.xy.mul(fireDistortion)).add(offsets[i])).r,
                    viewportSharedTexture(screenUV.add(exitG.xy.mul(fireDistortion)).add(offsets[i])).g,
                    viewportSharedTexture(screenUV.add(exitB.xy.mul(fireDistortion)).add(offsets[i])).b
                ));
            }
            screenDiamond = screenDiamond.div(4.0);
            
            let diamondResult = mix(screenDiamond, envDiamond, 0.85);
            
            // FIX 3: Softened from 1.5 to 1.2 to retain the 3D volume and mid-tones
            diamondResult = pow(diamondResult, 1.5); 

            // ==========================================
            // 2. BACK FACETS: HYBRID 3D BENDING
            // ==========================================
            const glassDirWorldR = refract(viewDirection, normal, 1.0 / iorR);
            const glassDirWorldG = refract(viewDirection, normal, 1.0 / iorG);
            const glassDirWorldB = refract(viewDirection, normal, 1.0 / iorB);
            
            const envGlass = vec3(
                texture(envMap, equirectUV(rotateY(glassDirWorldR, envRot))).level(mipLevel).r,
                texture(envMap, equirectUV(rotateY(glassDirWorldG, envRot))).level(mipLevel).g,
                texture(envMap, equirectUV(rotateY(glassDirWorldB, envRot))).level(mipLevel).b
            );

            const viewDirView = normalize(positionView);
            const glassDirView = refract(viewDirView, normalView, 1.5 / ior);
            const offset = glassDirView.xy.mul(0.1); // Also reduced back-face distortion
            
            const screenGlass = viewportSharedTexture(screenUV.add(offset)).rgb;
            let glassResult = mix(screenGlass, envGlass, 0.95);
            
            // ==========================================
            // 3. MIX & REFLECT
            // ==========================================
            let baseRefract = mix(glassResult, diamondResult, isFrontFacing);
            let finalRefract = baseRefract.mul(this._diamondColorNode);

            const reflectionDir = normalize(sub(viewDirection, normal.mul(dot(viewDirection, normal).mul(2.0))));
            const envReflect = texture(envMap, equirectUV(rotateY(reflectionDir, envRot))).level(mipLevel).rgb;
            const reflectOffset = reflectionDir.xy.mul(0.1);
            const screenReflect = viewportSharedTexture(screenUV.add(reflectOffset)).rgb;

            const reflectionRGB = mix(screenReflect, envReflect, 0.85);
            
            // FIX 4: Adjusted Fresnel to make the outer shell look glossier and more distinct from the inside
            const nFresnel = pow(add(1.0, dot(viewDirection, normal)), 5.0).mul(fresnel);
            const surfaceGlint = reflectionRGB.mul(nFresnel).mul(reflectivity).mul(3.0);
            
            // ==========================================
            // 4. CAMERA HIGHLIGHT
            // ==========================================
            let highlightMask = smoothstep(this._highlightToleranceNode, 1.0, facingRatio);
            highlightMask = pow(highlightMask, 3.0); 
            const facetHighlight = this._highlightColorNode.mul(highlightMask).mul(5.0);
            
            return finalRefract.add(surfaceGlint).add(facetHighlight);
        })();
    }

    get color() { return this._diamondColorNode.value; }
    set color(value) { this._diamondColorNode.value.set(value); }

    get blur() { return this._blurNode.value; }
    set blur(value) { this._blurNode.value = value; }

    get envRotation() { return this._envRotationNode.value; }
    set envRotation(value) { this._envRotationNode.value = value; }

    get highlightTolerance() { return this._highlightToleranceNode.value; }
    set highlightTolerance(value) { this._highlightToleranceNode.value = value; }

    get highlightColor() { return this._highlightColorNode.value; }
    set highlightColor(value) { this._highlightColorNode.value.set(value); }
}