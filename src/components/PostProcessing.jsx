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
        quality: { value: 0.5, min: 0, max: 1 },
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

        // 3. TAA (TRAA) Pass
        // Apply TAA to the scene color. Doing this BEFORE SSR is more stable 
        // because the scene color has perfectly matching depth and velocity data.
        const traaNode = traa(scenePassColor, scenePassDepth, scenePassVelocity, camera);

        // 4. Composition Options
        // If TAA is enabled, we use the anti-aliased scene + SSR
        const out_TAA_SSR = vec4(traaNode.rgb.add(ssrNode.rgb), traaNode.a);
        // If TAA is enabled but SSR is off, just the anti-aliased scene
        const out_TAA_Only = traaNode;
        // If TAA is off, we use the raw scene + SSR (or just raw scene)
        const out_SSR_Only = vec4(scenePassColor.rgb.add(ssrNode.rgb), scenePassColor.a);
        const out_None = scenePass;

        const renderPipeline = new THREE.RenderPipeline(gl);

        return {
            renderPipeline,
            ssrNode,
            scenePass,
            traaNode,
            outputs: {
                taaSSR: out_TAA_SSR,
                taaOnly: out_TAA_Only,
                ssrOnly: out_SSR_Only,
                none: out_None
            }
        };
    }, [gl, scene, camera]);

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

        // Toggle logic
        if (taaParams.enabled && params.enabled) {
            renderPipeline.outputNode = outputs.taaSSR;
        } else if (taaParams.enabled) {
            renderPipeline.outputNode = outputs.taaOnly;
        } else if (params.enabled) {
            renderPipeline.outputNode = outputs.ssrOnly;
        } else {
            renderPipeline.outputNode = outputs.none;
        }

        renderPipeline.needsUpdate = true;

    }, [params, taaParams, pipelineData]);

    useFrame(() => {
        // Manual render call for the WebGPU pipeline
        camera.updateMatrixWorld();
        pipelineData.renderPipeline.render();
    }, 1);

    return null;
}