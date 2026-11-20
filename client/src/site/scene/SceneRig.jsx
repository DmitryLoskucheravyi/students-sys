/*
 * Однакові для всіх 7 сцен: камера (FOV 30°, трохи згори ~20°), світло (ambient + верхнє зліва + небо/підлога),
 * тінь-пляма, паралакс за курсором (±7°) або, на тачі, повільне погойдування.
 */
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { easing } from 'maath';
import { blobShadow } from './kit.js';

const hover = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(hover: hover)').matches);
const ELEV = (20 * Math.PI) / 180;

export function Shadow({ scale = 3.2, opacity = 1, ...props }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]} {...props}>
      <planeGeometry args={[scale, scale * 0.62]} />
      <meshBasicMaterial map={blobShadow()} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** Відстань камери, з якої сцена розміром [w, h] вміщається у слот із пропорціями aspect (з полями ~20%). */
const fitDistance = ([w, h], aspect) => {
  const tan = Math.tan((15 * Math.PI) / 180);
  return Math.max((h * 1.2) / 2 / tan, (w * 1.15) / 2 / (tan * Math.max(aspect, 0.3)));
};

export default function SceneRig({ children, target = [0, 0.75, 0], size = [3.6, 2.6], onReady }) {
  const rig = useRef();
  const ready = useRef(false);
  useEffect(() => () => { ready.current = false; }, []);
  useFrame((state, dt) => {
    const g = rig.current;
    if (!g) return;
    const cam = state.camera;
    const dist = fitDistance(size, state.size.width / Math.max(1, state.size.height));
    cam.position.set(target[0], target[1] + dist * Math.sin(ELEV), dist * Math.cos(ELEV));
    cam.lookAt(target[0], target[1], target[2]);
    const t = state.clock.elapsedTime;
    const ry = hover ? state.pointer.x * 0.12 : Math.sin(t * 0.5) * 0.06;
    const rx = hover ? -state.pointer.y * 0.06 : 0;
    easing.dampE(g.rotation, [rx, ry - 0.35, 0], 0.35, Math.min(dt, 0.05));
    if (!ready.current) { ready.current = true; onReady?.(); }
  });
  return (
    <>
      <PerspectiveCamera makeDefault fov={30} near={0.1} far={60} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[-4, 6, 4]} intensity={1.7} />
      {/* мʼякі відблиски: небо зверху світліше за «підлогу» — без HDR-оточення (воно важке й тягнулося б з мережі) */}
      <hemisphereLight args={['#ffffff', '#b8b0c8', 0.55]} />
      <directionalLight position={[4, 2, -3]} intensity={0.35} />
      <group ref={rig} rotation-y={-0.35}>{children}</group>
    </>
  );
}
