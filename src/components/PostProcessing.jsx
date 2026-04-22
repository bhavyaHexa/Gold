import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three/webgpu";
import {
    pass,
    mrt,
    output,
    normalView,
    metalness,
    roughness,
    velocity,
    directionToColor,
    vec2,
    vec4,
    add,
    diffuseColor,
    colorToDirection,
    sample
} from "three/tsl";
import { ssr } from "three/addons/tsl/display/SSRNode.js";
import { traa } from "three/addons/tsl/display/TRAANode.js";
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { useControls } from "leva";

export default function PostProcessing() {
    const { gl, scene, camera } = useThree();

    const ssgiParams = useControls("SSGI Settings", {
        enabled: true,
        giIntensity: { value: 2.0, min: 0, max: 10 },
        aoIntensity: { value: 1.0, min: 0, max: 4 },
        radius: { value: 5, min: 1, max: 25 },
        sliceCount: { value: 2, min: 1, max: 4, step: 1 },
        stepCount: { value: 8, min: 1, max: 32, step: 1 },
    });

    const ssrParams = useControls("SSR Settings", {
        enabled: true,
        opacity: { value: 1, min: 0, max: 1 },
        thickness: { value: 0.03, min: 0, max: 0.1 },
    });

    const traaParams = useControls("TRAA Settings", {
        enabled: true,
    });

    // 1. Setup Pipeline Logic
    const pipelineData = useMemo(() => {
        const renderPipeline = new THREE.RenderPipeline(gl);
        const scenePass = pass(scene, camera);

        // Define MRT Layout
        scenePass.setMRT(mrt({
            output,
            diffuseColor,
            normal: directionToColor(normalView),
            metalrough: vec2(metalness, roughness),
            velocity
        }));

        // --- BANDWIDTH OPTIMIZATION ---
        // Force 8-bit textures for diffuse and normal to stay under the 32-byte WebGPU limit
        scenePass.getTexture('diffuseColor').type = THREE.UnsignedByteType;
        scenePass.getTexture('normal').type = THREE.UnsignedByteType;

        // Texture Nodes
        const scenePassColor = scenePass.getTextureNode('output');
        const scenePassDiffuse = scenePass.getTextureNode('diffuseColor');
        const scenePassDepth = scenePass.getTextureNode('depth');
        const scenePassNormal = scenePass.getTextureNode('normal');
        const scenePassMetalRough = scenePass.getTextureNode('metalrough');
        const scenePassVelocity = scenePass.getTextureNode('velocity');

        // Convert packed normals back to directions for SSGI math
        const sceneNormal = sample((uv) => colorToDirection(scenePassNormal.sample(uv)));

        // --- PHASE 1: SSGI ---
        const ssgiNode = ssgi(scenePassColor, scenePassDepth, sceneNormal, camera);

        // Composite SSGI: (DirectLight * AO) + (Diffuse * IndirectGI)
        // scenePassColor.a ensures the background remains unaffected
        const ssgiComposited = vec4(
            add(scenePassColor.rgb.mul(ssgiNode.a), scenePassDiffuse.rgb.mul(ssgiNode.rgb)),
            scenePassColor.a
        );

        // --- PHASE 2: SSR ---
        // Create a samplable version of the SSGI-lit scene for SSR to use.
        // We use sample() with context({ uv }) to make the composited expression samplable without a new pass.
        const ssgiCompositedSamplable = sample((uv) => ssgiComposited.context({ uv }));

        // Apply SSR on top of the SSGI-lit result
        const ssrNode = ssr(
            ssgiCompositedSamplable,
            scenePassDepth,
            sceneNormal,
            scenePassMetalRough.r,
            scenePassMetalRough.g,
            camera // Required for TSL SSR
        );

        // Merge SSR reflections with the SSGI scene
        const sceneWithSSGIandSSR = vec4(ssrNode.rgb.add(ssgiComposited.rgb), scenePassColor.a);

        // --- PHASE 3: TRAA ---
        // Temporal Anti-Aliasing stabilizes the noise from both SSGI and SSR
        const traaNode = traa(sceneWithSSGIandSSR, scenePassDepth, scenePassVelocity, camera);

        return {
            renderPipeline,
            ssgiNode,
            ssrNode,
            traaNode,
            sceneWithSSGIandSSR
        };
    }, [gl, scene, camera]);

    // 2. Dynamic Uniform Updates
    useEffect(() => {
        const { ssgiNode, ssrNode, traaNode, sceneWithSSGIandSSR, renderPipeline } = pipelineData;

        // Update SSGI settings from Leva
        ssgiNode.giIntensity.value = ssgiParams.enabled ? ssgiParams.giIntensity : 0;
        ssgiNode.aoIntensity.value = ssgiParams.enabled ? ssgiParams.aoIntensity : 0;
        ssgiNode.radius.value = ssgiParams.radius;
        ssgiNode.sliceCount.value = ssgiParams.sliceCount;
        ssgiNode.stepCount.value = ssgiParams.stepCount;

        // Update SSR settings from Leva
        ssrNode.opacity.value = ssrParams.enabled ? ssrParams.opacity : 0;
        ssrNode.thickness.value = ssrParams.thickness;

        // Set final output
        renderPipeline.outputNode = traaParams.enabled ? traaNode : sceneWithSSGIandSSR;
        renderPipeline.needsUpdate = true;

    }, [ssgiParams, ssrParams, traaParams, pipelineData]);

    useFrame(() => {
        // Essential: Update camera world matrix before rendering the pipeline
        camera.updateMatrixWorld();
        pipelineData.renderPipeline.render();
    }, 1);

    return null;
}