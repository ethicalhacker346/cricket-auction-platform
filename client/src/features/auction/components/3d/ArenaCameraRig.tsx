import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MathUtils, PerspectiveCamera, Spherical, TOUCH, Vector3, type Vector3Tuple } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Auction3DCameraMode } from '../../hooks/useAuction3DPreferences';

export type ArenaCameraAction = 'left' | 'right' | 'up' | 'down' | 'closer' | 'farther' | 'reset';
export interface ArenaCameraCommand { sequence: number; action: ArenaCameraAction }
export interface BidCameraFocus { key: string; position: Vector3Tuple }
const PRESETS: Record<Exclude<Auction3DCameraMode, 'orbit'>, Vector3Tuple> = {
  broadcast: [0, 5.65, 14.6], stage: [0, 3.65, 10.2], top: [0, 13.4, 4.8], floor: [0, 1.2, 12.8],
};
const MIN_POLAR = Math.PI * 0.1;
const MAX_POLAR = Math.PI * 0.64;

/** No per-frame allocations; an explicit camera choice always beats a broadcast cut. */
export function ArenaCameraRig({ mode, animate, followBids, bidFocus, command }: {
  mode: Auction3DCameraMode; animate: boolean; followBids: boolean;
  bidFocus: BidCameraFocus | null; command?: ArenaCameraCommand | null;
}) {
  const { camera, gl, size, invalidate } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const destination = useRef(new Vector3());
  const target = useRef(new Vector3(0, 1.55, -0.35));
  const offset = useRef(new Vector3());
  const spherical = useRef(new Spherical());
  const savedPosition = useRef(new Vector3());
  const transitionStart = useRef(new Vector3());
  const focusCamera = useRef(new Vector3());
  const focusTarget = useRef(new Vector3());
  const transitionTarget = useRef(new Vector3());
  const animatedTarget = useRef(new Vector3());
  const focusStartedAt = useRef<number | null>(null);
  const focusTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastInteraction = useRef(-Infinity);
  const focusKey = bidFocus?.key ?? null;
  const focusX = bidFocus?.position[0] ?? 0;
  const focusY = bidFocus?.position[1] ?? 0;
  const focusZ = bidFocus?.position[2] ?? 0;
  const lastBidKey = useRef(focusKey);
  const [focusing, setFocusing] = useState(false);

  const cancelFocus = useCallback(() => {
    clearTimeout(focusTimeout.current);
    focusStartedAt.current = null;
    setFocusing(false);
  }, []);
  const interact = useCallback(() => {
    lastInteraction.current = performance.now();
    cancelFocus();
  }, [cancelFocus]);

  useLayoutEffect(() => {
    if (camera instanceof PerspectiveCamera) {
      const aspect = size.width / Math.max(1, size.height);
      camera.fov = aspect < 0.85 ? 53 : aspect < 1.2 ? 46 : 40;
      camera.updateProjectionMatrix();
      invalidate();
    }
  }, [camera, size.width, size.height, invalidate]);

  useLayoutEffect(() => {
    cancelFocus();
    if (mode !== 'orbit' && !animate) {
      camera.position.set(...PRESETS[mode]);
      camera.lookAt(target.current);
      controls.current?.target.copy(target.current);
      invalidate();
    }
  }, [mode, animate, camera, cancelFocus, invalidate]);

  useEffect(() => {
    if (lastBidKey.current === focusKey) return;
    lastBidKey.current = focusKey;
    if (!focusKey || !animate || !followBids || performance.now() - lastInteraction.current < 5000) {
      cancelFocus();
      return;
    }
    // Repeated bids during a cut still return to the viewer's original orbit.
    if (focusStartedAt.current == null) savedPosition.current.copy(camera.position);
    clearTimeout(focusTimeout.current);
    transitionStart.current.copy(camera.position);
    transitionTarget.current.copy(controls.current?.target ?? target.current);
    focusTarget.current.set(focusX, focusY + 0.68, focusZ);
    focusCamera.current.set(focusX * 0.54, 2.65, focusZ + 6.1);
    focusStartedAt.current = performance.now();
    setFocusing(true);
    focusTimeout.current = setTimeout(cancelFocus, 2050);
  }, [focusKey, focusX, focusY, focusZ, animate, followBids, camera, cancelFocus]);

  useEffect(() => {
    if (!animate || !followBids) cancelFocus();
    return () => clearTimeout(focusTimeout.current);
  }, [animate, followBids, cancelFocus]);

  useLayoutEffect(() => {
    if (!command) return;
    interact();
    const center = target.current;
    controls.current?.target.copy(center);
    offset.current.copy(camera.position).sub(center);
    spherical.current.setFromVector3(offset.current);
    const action = command.action;
    if (action === 'left' || action === 'right') spherical.current.theta += action === 'left' ? 0.2 : -0.2;
    if (action === 'up' || action === 'down') spherical.current.phi = MathUtils.clamp(spherical.current.phi + (action === 'up' ? -0.13 : 0.13), MIN_POLAR, MAX_POLAR);
    if (action === 'closer' || action === 'farther') spherical.current.radius = MathUtils.clamp(spherical.current.radius + (action === 'closer' ? -1 : 1), 7.5, 19);
    if (action === 'reset') camera.position.set(...PRESETS.broadcast);
    else camera.position.copy(center).add(offset.current.setFromSpherical(spherical.current));
    camera.lookAt(center);
    controls.current?.update();
    invalidate();
  }, [command, camera, interact, invalidate]);

  useEffect(() => {
    const element = gl.domElement;
    const onTrackpad = (event: WheelEvent) => {
      if (mode !== 'orbit' || event.ctrlKey || !controls.current) return;
      event.preventDefault(); event.stopImmediatePropagation(); interact();
      const center = controls.current.target;
      offset.current.copy(camera.position).sub(center);
      spherical.current.setFromVector3(offset.current);
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      spherical.current.theta -= MathUtils.clamp(event.deltaX * scale, -200, 200) * 0.0032;
      spherical.current.phi = MathUtils.clamp(spherical.current.phi + MathUtils.clamp(event.deltaY * scale, -200, 200) * 0.0026, MIN_POLAR, MAX_POLAR);
      camera.position.copy(center).add(offset.current.setFromSpherical(spherical.current));
      camera.lookAt(center); controls.current.update(); invalidate();
    };
    element.addEventListener('wheel', onTrackpad, { passive: false, capture: true });
    return () => element.removeEventListener('wheel', onTrackpad, { capture: true });
  }, [camera, gl, mode, interact, invalidate]);

  useFrame(({ clock }, frameDelta) => {
    if (!animate) return;
    const delta = Math.min(frameDelta, 0.1);
    if (focusStartedAt.current != null) {
      const elapsed = (performance.now() - focusStartedAt.current) / 1000;
      const returnPosition = mode === 'orbit' ? savedPosition.current : destination.current.set(...PRESETS[mode]);
      if (elapsed <= 0.38) {
        const progress = MathUtils.smootherstep(elapsed, 0, 0.38);
        camera.position.lerpVectors(transitionStart.current, focusCamera.current, progress);
        animatedTarget.current.lerpVectors(transitionTarget.current, focusTarget.current, progress);
      } else if (elapsed <= 1.3) {
        camera.position.copy(focusCamera.current); animatedTarget.current.copy(focusTarget.current);
      } else {
        const progress = MathUtils.smootherstep(elapsed, 1.3, 2.05);
        camera.position.lerpVectors(focusCamera.current, returnPosition, progress);
        animatedTarget.current.lerpVectors(focusTarget.current, target.current, progress);
      }
      camera.lookAt(animatedTarget.current);
      controls.current?.target.copy(animatedTarget.current);
      return;
    }
    if (mode === 'orbit') return;
    controls.current?.target.copy(target.current);
    const base = PRESETS[mode];
    const sway = mode === 'broadcast' ? Math.sin(clock.elapsedTime * 0.18) * 0.24 : 0;
    destination.current.set(base[0] + sway, base[1], base[2]);
    camera.position.lerp(destination.current, 1 - Math.exp(-delta * 2.8));
    camera.lookAt(target.current);
  });

  return <OrbitControls ref={controls} enabled={mode === 'orbit'} makeDefault target={[0, 1.55, -0.35]}
    minDistance={7.5} maxDistance={19} minPolarAngle={MIN_POLAR} maxPolarAngle={MAX_POLAR}
    enablePan={false} enableDamping={animate && !focusing} dampingFactor={0.06}
    touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_ROTATE }} onStart={interact} autoRotate={false} />;
}
