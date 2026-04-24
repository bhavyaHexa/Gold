// FrontRayMask.jsx
import { Fn, dot, normalize, positionView, smoothstep, negate } from "three/tsl";

export const applyFrontRayMask = Fn(([ssrColor, normalNode, minThreshold, maxThreshold]) => {
    // 1. Get view direction (Camera to surface)
    const viewDir = normalize(positionView);

    // 2. Dot Product: 1.0 = looking straight at surface, 0.0 = grazing angle
    const vDotN = dot(viewDir.negate(), normalNode);

    // 3. Create the mask
    // We use oneMinus so that front-facing (high dot) becomes 0 (hidden)
    // Adding a power factor makes the transition smoother/more organic
    const mask = smoothstep(minThreshold, maxThreshold, vDotN).oneMinus().pow(2.0);

    // 4. Return the masked SSR color
    return ssrColor.mul(mask);
});