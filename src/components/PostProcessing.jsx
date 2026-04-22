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
    uniform,
    directionToColor,
    vec2,
    vec4
} from "three/tsl";
import { ssr } from "three/addons/tsl/display/SSRNode.js";
import { traa } from "three/addons/tsl/display/TRAANode.js";
import { useControls } from "leva";

export default function PostProcessing() {
    const { gl, scene, camera } = useThree();

    const params = useControls("SSR Settings", {
        enabled: true,
        quality: { value: 0.5, min: 0, max: 10 },
        blurQuality: { value: 1, min: 1, max: 3, step: 1 },
        maxDistance: { value: 1, min: 0, max: 10 },
        opacity: { value: 1, min: 0, max: 1 },
        thickness: { value: 0.03, min: 0, max: 0.1 },
    });

    const taaParams = useControls("TAA Settings", {
        enabled: true,
        depthThreshold: { value: 0.0005, min: 0, max: 0.01, step: 0.0001 },
        edgeDepthDiff: { value: 0.001, min: 0, max: 0.01, step: 0.0001 },
    });

    // We use a uniform to toggle SSR input for TAA without re-creating history textures
    const ssrEnabledUniform = useMemo(() => uniform(1), []);

    const pipelineData = useMemo(() => {
        // 1. Base Scene Pass (for SSR data)
        const scenePass = pass(scene, camera);

        // Define MRT for SSR and TAA requirements
        scenePass.setMRT(mrt({
            output,
            normal: directionToColor(normalView),
            metalrough: vec2(metalness, roughness),
            velocity: velocity
        }));

        const scenePassColor = scenePass.getTextureNode('output');
        const scenePassDepth = scenePass.getTextureNode('depth');
        const scenePassNormal = scenePass.getTextureNode('normal');
        const scenePassMetalRough = scenePass.getTextureNode('metalrough');
        const scenePassVelocity = scenePass.getTextureNode('velocity');

        // 2. SSR Node
        const ssrNode = ssr(
            scenePassColor,
            scenePassDepth,
            scenePassNormal,
            scenePassMetalRough.r, // Metalness
            scenePassMetalRough.g  // Roughness
        );

        // 3. Composition: Combine Scene + SSR
        // We combine them into a single vec4 to pass into TAA
        const sceneWithSSR = vec4(scenePassColor.rgb.add(ssrNode.rgb), scenePassColor.a);

        // 4. TAA (TRAA) Pass
        // By passing the combined color into TAA, we stabilize both the geometry edges and the reflections.
        // We use a conditional input based on the uniform for smooth toggling between states.
        const inputForTAA = ssrEnabledUniform.equal(1).select(sceneWithSSR, scenePassColor);
        const traaNode = traa(inputForTAA, scenePassDepth, scenePassVelocity, camera);

        const renderPipeline = new THREE.RenderPipeline(gl);

        return {
            renderPipeline,
            ssrNode,
            scenePass,
            traaNode,
            outputs: {
                taa: traaNode,
                ssrOnly: sceneWithSSR,
                none: scenePass
            }
        };
    }, [gl, scene, camera, ssrEnabledUniform]);

    useEffect(() => {
        const { ssrNode, renderPipeline, traaNode, outputs } = pipelineData;

        // Update SSR Uniforms
        ssrNode.quality.value = params.quality;
        ssrNode.blurQuality.value = params.blurQuality;
        ssrNode.maxDistance.value = params.maxDistance;
        ssrNode.opacity.value = params.opacity;
        ssrNode.thickness.value = params.thickness;

        // Update TAA Settings
        traaNode.depthThreshold = taaParams.depthThreshold;
        traaNode.edgeDepthDiff = taaParams.edgeDepthDiff;

        // Update the internal uniform for the TAA branch
        ssrEnabledUniform.value = params.enabled ? 1 : 0;

        // Toggle logic for the main pipeline output
        if (taaParams.enabled) {
            // TAA output already accounts for SSR via the internal uniform
            renderPipeline.outputNode = outputs.taa;
        } else if (params.enabled) {
            renderPipeline.outputNode = outputs.ssrOnly;
        } else {
            renderPipeline.outputNode = outputs.none;
        }

        renderPipeline.needsUpdate = true;

    }, [params, taaParams, pipelineData, ssrEnabledUniform]);

    useFrame(() => {
        // Manual render call for the WebGPU pipeline
        camera.updateMatrixWorld();
        pipelineData.renderPipeline.render();
    }, 1);

    return null;
}