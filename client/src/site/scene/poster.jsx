/*
 * Лише для розробки (client/poster.html): одна сцена ?scene=keys у полотні 400×300 при dpr 2 (= 800×600),
 * прозоре тло. Через 2.5 с, коли вступні анімації вляглися, ставить window.__posterReady.
 * Постери знімає scripts/posters.py у client/public/posters/<scene>.webp.
 */
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import SceneRig from './SceneRig.jsx';
import { SCENES } from './index.jsx';
import { SITE_DIRECTIONS } from '../directions.js';
import '@fontsource-variable/onest';

const id = new URLSearchParams(location.search).get('scene');
const d = SITE_DIRECTIONS.find((x) => x.scene === id);
const s = SCENES[id];

function Ready() {
  useFrame(({ clock }) => { if (clock.elapsedTime > 2.5) window.__posterReady = true; });
  return null;
}

createRoot(document.getElementById('root')).render(
  <Canvas dpr={2} gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}>
    <SceneRig target={s.target} size={s.size}>
      <s.C look={d.look} face={d.mascotFace} tap={0} />
    </SceneRig>
    <Ready />
  </Canvas>
);
