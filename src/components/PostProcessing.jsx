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
    sample,
    screenUV,
    builtinAOContext,
    uniform,
    mix,
    float
} from "three/tsl";
import { ssr } from "three/addons/tsl/display/SSRNode.js";
import { traa } from "three/addons/tsl/display/TRAANode.js";
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { useControls } from "leva";

// --- CUSTOM LOGIC IMPORT ---
import { applyFrontRayMask } from "./FrontRayMask";

export default function PostProcessing() {
    const { gl, scene, camera } = useThree();

    const aoParams = useControls("GTAO Settings", {
        enabled: true,
        radius: { value: 1.25, min: 0.1, max: 2 },
        thickness: { value: 1.5, min: 0.01, max: 2 },
        scale: { value: 1.0, min: 0.01, max: 2 },
        samples: { value: 20, min: 4, max: 32, step: 1 },
        distanceFallOff: { value: 1.0, min: 0.01, max: 1 },
    });

    const ssgiParams = useControls("SSGI Settings", {
        enabled: true,
        giIntensity: { value: 2.0, min: 0, max: 10 },
        aoIntensity: { value: 0.1, min: 0, max: 4 },
        radius: { value: 1.0, min: 1, max: 25 },
        sliceCount: { value: 4, min: 1, max: 4, step: 1 },
        stepCount: { value: 32, min: 1, max: 32, step: 1 },
        thickness: { value: 8, min: 0, max: 10 },
        useScreenSpaceSampling: true,
        useTemporalFiltering: true,
        backfaceLighting: { value: 0.1, min: 0, max: 1 },
        expFactor: { value: 3, min: 1, max: 3 },
    });

    const ssrParams = useControls("SSR Settings", {
        enabled: true,
        intensity: { value: 1.0, min: 0, max: 2, step: 0.01 },
        boost: { value: [1.00, 1.00, 1.00] },
        radius: { value: 1.00, min: 0.01, max: 10, step: 0.01, label: "object radius" },
        autoRadius: { value: true, label: "auto radius" },
        power: { value: 1.10, min: 0.1, max: 5, step: 0.01 },
        tolerance: { value: 0.5, min: 0.01, max: 2, step: 0.01 },
        stepCount: { value: 32, min: 1, max: 128, step: 1, label: "step count" },
        // --- Custom Mask Controls ---
        maskMin: { value: 0.00, min: 0, max: 1, label: "Mask Start (Grazing)" },
        maskMax: { value: 1.00, min: 0, max: 1, label: "Mask End (Front)" },
    });

    const traaParams = useControls("TRAA Settings", { enabled: true });

    const debugParams = useControls("Debug View", {
        outputNode: {
            value: 'Final',
            options: ['Final', 'Normal', 'Depth', 'Velocity', 'AO', 'SSGI', 'SSR', 'SSR Mask Only']
        }
    });

    const pipelineData = useMemo(() => {
        const renderPipeline = new THREE.RenderPipeline(gl);

        // PHASE 0: PRE-PASS
        const prePass = pass(scene, camera);
        prePass.setMRT(mrt({
            output: directionToColor(normalView),
            velocity: velocity
        }));

        const prePassDepth = prePass.getTextureNode('depth');
        const prePassNormal = sample((uv) => colorToDirection(prePass.getTextureNode('output').sample(uv)));
        const prePassVelocity = prePass.getTextureNode('velocity');

        // PHASE 1: GTAO
        const aoPass = ao(prePassDepth, prePassNormal, camera);
        aoPass.resolutionScale = 0.5;
        aoPass.useTemporalFiltering = true;
        const aoPassOutput = aoPass.getTextureNode();

        // PHASE 2: SCENE PASS
        const scenePass = pass(scene, camera);
        const gtaoIntensityNode = uniform(1);
        scenePass.contextNode = builtinAOContext(mix(float(1), aoPassOutput.sample(screenUV).r, gtaoIntensityNode));

        scenePass.setMRT(mrt({
            output,
            diffuseColor,
            metalrough: vec2(metalness, roughness),
        }));

        const scenePassColor = scenePass.getTextureNode('output');
        const scenePassDiffuse = scenePass.getTextureNode('diffuseColor');
        const scenePassMetalRough = scenePass.getTextureNode('metalrough');

        // PHASE 3: SSGI
        const ssgiNode = ssgi(scenePassColor, prePassDepth, prePassNormal, camera);
        const ssgiComposited = vec4(
            add(scenePassColor.rgb.mul(ssgiNode.a), scenePassDiffuse.rgb.mul(ssgiNode.rgb)),
            scenePassColor.a
        );

        // --- PHASE 4: SSR WITH CUSTOM FRONT RAY MASK ---
        const ssgiCompositedSamplable = sample((uv) => ssgiComposited.context({ uv }));

        const baseSSRNode = ssr(
            ssgiCompositedSamplable,
            prePassDepth,
            prePassNormal,
            scenePassMetalRough.r,
            scenePassMetalRough.g,
            camera
        );

        // Uniforms for the front ray logic
        const maskMinNode = uniform(0.00);
        const maskMaxNode = uniform(1.00);

        // Apply our imported TSL logic
        const maskedSSR = applyFrontRayMask(baseSSRNode.rgb, prePassNormal, maskMinNode, maskMaxNode);

        // Composite using the masked version
        const sceneWithSSGIandSSR = vec4(maskedSSR.add(ssgiComposited.rgb), scenePassColor.a);

        // PHASE 5: TRAA
        const traaNode = traa(sceneWithSSGIandSSR, prePassDepth, prePassVelocity, camera);

        return {
            renderPipeline,
            aoPass,
            ssgiNode,
            ssrNode: baseSSRNode,
            maskedSSR, // For debug view
            maskMinNode,
            maskMaxNode,
            traaNode,
            sceneWithSSGIandSSR,
            gtaoIntensityNode,
            prePassNormal,
            prePassDepth,
            prePassVelocity,
            aoPassOutput
        };
    }, [gl, scene, camera]);

    useEffect(() => {
        if (!pipelineData) return;
        const { aoPass, ssgiNode, ssrNode, maskMinNode, maskMaxNode, traaNode, sceneWithSSGIandSSR, renderPipeline, gtaoIntensityNode } = pipelineData;

        // Sync GTAO
        if (aoPass) {
            aoPass.radius.value = aoParams.radius;
            aoPass.thickness.value = aoParams.thickness;
            aoPass.scale.value = aoParams.scale;
            aoPass.samples.value = aoParams.samples;
            aoPass.distanceFallOff.value = aoParams.distanceFallOff;
            gtaoIntensityNode.value = aoParams.enabled ? 1 : 0;
        }

        // Sync SSGI
        if (ssgiNode) {
            ssgiNode.giIntensity.value = ssgiParams.enabled ? ssgiParams.giIntensity : 0;
            ssgiNode.aoIntensity.value = ssgiParams.enabled ? ssgiParams.aoIntensity : 0;
            ssgiNode.radius.value = ssgiParams.radius;
            ssgiNode.stepCount.value = ssgiParams.stepCount;
            ssgiNode.thickness.value = ssgiParams.thickness;
        }

        // Sync SSR & Custom Mask
        if (ssrNode) {
            ssrNode.opacity.value = ssrParams.enabled ? ssrParams.intensity : 0;
            ssrNode.maxDistance.value = ssrParams.radius;
            ssrNode.thickness.value = ssrParams.tolerance;
            ssrNode.quality.value = ssrParams.stepCount / 128.0; // Map stepCount to quality range [0, 1]

            // Sync custom mask uniforms
            maskMinNode.value = ssrParams.maskMin;
            maskMaxNode.value = ssrParams.maskMax;
        }

        // Final Output Logic
        let finalOutput = traaParams.enabled ? traaNode : sceneWithSSGIandSSR;

        if (debugParams.outputNode === 'Normal') finalOutput = pipelineData.prePassNormal;
        if (debugParams.outputNode === 'Depth') finalOutput = pipelineData.prePassDepth;
        if (debugParams.outputNode === 'AO') finalOutput = pipelineData.aoPassOutput;
        if (debugParams.outputNode === 'SSGI') finalOutput = ssgiNode;
        if (debugParams.outputNode === 'SSR') finalOutput = pipelineData.maskedSSR;
        if (debugParams.outputNode === 'SSR Mask Only') finalOutput = pipelineData.maskedSSR.div(ssrNode.rgb);

        renderPipeline.outputNode = finalOutput;
        renderPipeline.needsUpdate = true;

    }, [aoParams, ssgiParams, ssrParams, traaParams, debugParams, pipelineData]);

    useFrame(() => {
        if (!pipelineData.renderPipeline.outputNode) return;
        camera.updateMatrixWorld();
        pipelineData.renderPipeline.render();
    }, 1);

    return null;
}