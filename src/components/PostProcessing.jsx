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

export default function PostProcessing() {
    const { gl, scene, camera } = useThree();

    // GTAO Controls
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
        giIntensity: { value: 5, min: 0, max: 10 },
        aoIntensity: { value: 0.3, min: 0, max: 4 },
        radius: { value: 18, min: 1, max: 25 },
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
        opacity: { value: 1, min: 0, max: 1 },
        thickness: { value: 0.3, min: 0, max: 1.0 },
    });

    const traaParams = useControls("TRAA Settings", {
        enabled: true,
    });

    const pipelineData = useMemo(() => {
        const renderPipeline = new THREE.RenderPipeline(gl);

        // --- PHASE 0: PRE-PASS (For AO & Geometry) ---
        const prePass = pass(scene, camera);
        prePass.name = 'Pre-Pass';
        prePass.setMRT(mrt({
            output: directionToColor(normalView),
            velocity: velocity
        }));

        // Bandwidth optimization for normals
        const normalTexture = prePass.getTexture('output');
        normalTexture.type = THREE.UnsignedByteType;

        const prePassDepth = prePass.getTextureNode('depth');
        const prePassNormal = sample((uv) => colorToDirection(prePass.getTextureNode('output').sample(uv)));
        const prePassVelocity = prePass.getTextureNode('velocity');

        // --- PHASE 1: GTAO ---
        const aoPass = ao(prePassDepth, prePassNormal, camera);
        aoPass.resolutionScale = 0.5; // Performance boost
        aoPass.useTemporalFiltering = true;
        const aoPassOutput = aoPass.getTextureNode();

        // --- PHASE 2: SCENE PASS (With AO Context) ---
        const scenePass = pass(scene, camera);
        const gtaoIntensityNode = uniform(1);
        // This is key: Injecting AO into the scene's lighting calculation
        scenePass.contextNode = builtinAOContext(mix(float(1), aoPassOutput.sample(screenUV).r, gtaoIntensityNode));

        scenePass.setMRT(mrt({
            output,
            diffuseColor,
            metalrough: vec2(metalness, roughness),
        }));

        const scenePassColor = scenePass.getTextureNode('output');
        const scenePassDiffuse = scenePass.getTextureNode('diffuseColor');
        const scenePassMetalRough = scenePass.getTextureNode('metalrough');

        // --- PHASE 3: SSGI ---
        // We use prePassNormal/Depth to avoid re-rendering scene for SSGI math
        const ssgiNode = ssgi(scenePassColor, prePassDepth, prePassNormal, camera);

        const ssgiComposited = vec4(
            add(scenePassColor.rgb.mul(ssgiNode.a), scenePassDiffuse.rgb.mul(ssgiNode.rgb)),
            scenePassColor.a
        );

        // --- PHASE 4: SSR ---
        const ssgiCompositedSamplable = sample((uv) => ssgiComposited.context({ uv }));
        const ssrNode = ssr(
            ssgiCompositedSamplable,
            prePassDepth,
            prePassNormal,
            scenePassMetalRough.r,
            scenePassMetalRough.g,
            camera
        );

        const sceneWithSSGIandSSR = vec4(ssrNode.rgb.add(ssgiComposited.rgb), scenePassColor.a);

        // --- PHASE 5: TRAA ---
        const traaNode = traa(sceneWithSSGIandSSR, prePassDepth, prePassVelocity, camera);

        return {
            renderPipeline,
            aoPass,
            ssgiNode,
            ssrNode,
            traaNode,
            sceneWithSSGIandSSR,
            gtaoIntensityNode
        };
    }, [gl, scene, camera]);

    useEffect(() => {
        if (!pipelineData) return;
        const { aoPass, ssgiNode, ssrNode, traaNode, sceneWithSSGIandSSR, renderPipeline, gtaoIntensityNode } = pipelineData;

        // Update GTAO
        if (aoPass && gtaoIntensityNode) {
            aoPass.radius.value = aoParams.radius;
            aoPass.thickness.value = aoParams.thickness;
            aoPass.scale.value = aoParams.scale;
            aoPass.samples.value = aoParams.samples;
            aoPass.distanceFallOff.value = aoParams.distanceFallOff;
            gtaoIntensityNode.value = aoParams.enabled ? 1 : 0;
        }

        // Update SSGI
        if (ssgiNode) {
            ssgiNode.giIntensity.value = ssgiParams.enabled ? ssgiParams.giIntensity : 0;
            ssgiNode.aoIntensity.value = ssgiParams.enabled ? ssgiParams.aoIntensity : 0;
            ssgiNode.radius.value = ssgiParams.radius;
            ssgiNode.sliceCount.value = ssgiParams.sliceCount;
            ssgiNode.stepCount.value = ssgiParams.stepCount;
            ssgiNode.thickness.value = ssgiParams.thickness;
            ssgiNode.useScreenSpaceSampling.value = ssgiParams.useScreenSpaceSampling;
            ssgiNode.useTemporalFiltering = ssgiParams.useTemporalFiltering;
            ssgiNode.backfaceLighting.value = ssgiParams.backfaceLighting;
            ssgiNode.expFactor.value = ssgiParams.expFactor;
        }

        // Update SSR
        if (ssrNode) {
            ssrNode.opacity.value = ssrParams.enabled ? ssrParams.opacity : 0;
            ssrNode.thickness.value = ssrParams.thickness;
        }

        // Final Output
        renderPipeline.outputNode = traaParams.enabled ? traaNode : sceneWithSSGIandSSR;
        renderPipeline.needsUpdate = true;

    }, [aoParams, ssgiParams, ssrParams, traaParams, pipelineData]);

    useFrame(() => {
        if (!pipelineData.renderPipeline.outputNode) return;
        camera.updateMatrixWorld();
        pipelineData.renderPipeline.render();
    }, 1);

    return null;
}