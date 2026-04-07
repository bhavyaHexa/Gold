import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export function RotateModelWrapper({
  sensitivity = 0.01,
  damping = 0.1,
  // Limits in Radians: 0 is level, -1.5 is looking at top, etc.
  minPitch = -Math.PI / 2,
  maxPitch = 0.1, // Small positive value allows a tiny bit of "under-tilt"
  minZoom = 0.5,
  maxZoom = 5,
  zoomSpeed = 0.002,
  children,
}) {
  const groupRef = useRef();
  const { gl } = useThree();

  const s = useRef({
    dragging: false,
    lastX: 0,
    lastY: 0,
    velX: 0,
    velY: 0,
    rotX: 0, // Pitch
    rotY: 0, // Yaw
    zoom: 1,
    targetZoom: 1,
  }).current;

  useEffect(() => {
    const canvas = gl.domElement;

    const onDown = (e) => {
      if (e.button !== 0) return;

      s.dragging = true;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);

    };
    const onMove = (e) => {
      if (!s.dragging) return;

      // Reversing the sign here flips the interaction logic
      const dx = e.clientX - s.lastX;
      const dy = e.clientY - s.lastY;

      s.velX = dx * sensitivity;
      s.velY = dy * sensitivity; // Added minus sign to reverse vertical drag

      s.lastX = e.clientX;
      s.lastY = e.clientY;

    };
    const onUp = (e) => {
      s.dragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) { }
    };

    const onWheel = (e) => {
      e.preventDefault();
      // Adjust target zoom based on wheel delta
      s.targetZoom -= e.deltaY * zoomSpeed;
      // Clamp zoom
      s.targetZoom = Math.max(minZoom, Math.min(maxZoom, s.targetZoom));
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [gl, sensitivity]);

  useFrame(() => {
    if (!groupRef.current) return;

    // Apply velocity
    s.rotY += s.velX;
    s.rotX += s.velY;

    // CLAMPING: This prevents looking below the plane
    s.rotX = Math.max(minPitch, Math.min(maxPitch, s.rotX));

    // Apply rotation to group
    groupRef.current.rotation.set(s.rotX, s.rotY, 0);

    // Apply damping
    s.velX *= (1 - damping);
    s.velY *= (1 - damping);

    // Apply smooth zooming
    s.zoom += (s.targetZoom - s.zoom) * (damping * 1.5);
    groupRef.current.scale.set(s.zoom, s.zoom, s.zoom);
  });

  return <group ref={groupRef}>{children}</group>;
}