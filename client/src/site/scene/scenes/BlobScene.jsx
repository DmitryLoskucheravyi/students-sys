/*
 * ШІ з нуля — «Чарівна куля»: глянцевий малиновий блоб, що повільно «дихає» формою, книжка поруч торкається його.
 * Курсор: блоб тягнеться в його бік. Tap: блоб стискається, з нього вилітають ~40 частинок і на мить
 * складаються в полароїд із картинкою «нічні гори», а потім розсипаються назад.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import BookMascot from '../BookMascot.jsx';
import { Shadow } from '../SceneRig.jsx';
import { bump, canvasTexture, clamp01, easeOut, shade } from '../kit.js';

const N = 40;
const CENTER = new THREE.Vector3(0.35, 0.85, 0);
const PHOTO = new THREE.Vector3(0.35, 2.05, 0.45);
const PW = 1.3; const PH = 1.05;

const night = () => canvasTexture('ai-night', 260, 220, (ctx, w, h) => {
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  const x = 12; const y = 12; const iw = w - 24; const ih = h - 52;
  const g = ctx.createLinearGradient(0, y, 0, y + ih); g.addColorStop(0, '#2a1f73'); g.addColorStop(1, '#7a5ae0');
  ctx.fillStyle = g; ctx.fillRect(x, y, iw, ih);
  ctx.fillStyle = '#fff';
  [[40, 30], [90, 55], [200, 40], [150, 25], [60, 80]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 1.8, 0, 7); ctx.fill(); });
  ctx.fillStyle = '#f8eed6'; ctx.beginPath(); ctx.arc(185, 60, 20, 0, 7); ctx.fill();
  ctx.fillStyle = '#3b2a9c'; ctx.beginPath(); ctx.moveTo(x, y + ih * 0.75); ctx.lineTo(80, y + ih * 0.38); ctx.lineTo(130, y + ih * 0.68); ctx.lineTo(175, y + ih * 0.42); ctx.lineTo(x + iw, y + ih * 0.78); ctx.lineTo(x + iw, y + ih); ctx.lineTo(x, y + ih); ctx.fill();
  ctx.fillStyle = '#1d1733'; ctx.beginPath(); ctx.moveTo(x, y + ih * 0.9); ctx.lineTo(60, y + ih * 0.72); ctx.lineTo(120, y + ih * 0.95); ctx.lineTo(190, y + ih * 0.7); ctx.lineTo(x + iw, y + ih * 0.85); ctx.lineTo(x + iw, y + ih); ctx.lineTo(x, y + ih); ctx.fill();
});

/** Точки по периметру полароїда — туди злітаються частинки. */
function framePoints() {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const p = (i / N) * 2 * (PW + PH);
    let x; let y;
    if (p < PW) { x = p - PW / 2; y = PH / 2; } else if (p < PW + PH) { x = PW / 2; y = PH / 2 - (p - PW); } else if (p < 2 * PW + PH) { x = PW / 2 - (p - PW - PH); y = -PH / 2; } else { x = -PW / 2; y = -PH / 2 + (p - 2 * PW - PH); }
    pts.push(new THREE.Vector3(PHOTO.x + x, PHOTO.y + y, PHOTO.z));
  }
  return pts;
}

export default function BlobScene({ look, face, tap }) {
  const blob = useRef();
  const pts = useRef();
  const photo = useRef();
  const st = useRef({ tap, at: -9 });
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.78, 10);
    g.userData.base = g.attributes.position.array.slice();
    return g;
  }, []);
  const targets = useMemo(framePoints, []);
  const seeds = useMemo(() => Array.from({ length: N }, () => new THREE.Vector3().randomDirection().multiplyScalar(0.7)), []);
  const pGeo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); return g; }, []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock, pointer }) => {
    const t = clock.elapsedTime;
    const s = st.current;
    if (tap !== s.tap) { s.tap = tap; if (t - s.at > 2.6) s.at = t; }
    // форма: сума синусів по напрямку вершини — повільна органічна деформація
    const base = geo.userData.base; const pos = geo.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      const x = base[i]; const y = base[i + 1]; const z = base[i + 2];
      const n = Math.sin(x * 3.1 + t * 0.9) + Math.sin(y * 3.7 + t * 1.2) + Math.sin(z * 2.9 + t * 0.7);
      const k = 1 + n * 0.028;
      pos[i] = x * k; pos[i + 1] = y * k; pos[i + 2] = z * k;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    const b = blob.current;
    if (b) {
      const squash = bump(t, s.at, 0.45) * 0.22;
      b.position.set(CENTER.x + pointer.x * 0.14, CENTER.y + pointer.y * 0.08, CENTER.z);
      b.scale.set(1 + squash * 0.5 + Math.abs(pointer.x) * 0.06, 1 - squash, 1 + squash * 0.5);
    }
    // частинки: блоб → рамка (0.5 с) → тримаються 1.5 с → назад (0.5 с)
    const a = t - s.at;
    const out = clamp01(a / 0.5); const back = clamp01((a - 2.0) / 0.5);
    const live = a >= 0 && a < 2.5;
    const arr = pGeo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      tmp.copy(CENTER).add(seeds[i]).lerp(targets[i], easeOut(out) * (1 - easeOut(back)));
      arr[i * 3] = tmp.x; arr[i * 3 + 1] = tmp.y; arr[i * 3 + 2] = tmp.z;
    }
    pGeo.attributes.position.needsUpdate = true;
    if (pts.current) pts.current.visible = live;
    if (photo.current) {
      const o = clamp01((a - 0.45) / 0.2) * (1 - clamp01((a - 1.95) / 0.2));
      photo.current.visible = o > 0;
      photo.current.material.opacity = o;
      photo.current.scale.setScalar(0.9 + o * 0.1);
    }
  });

  return (
    <group>
      <mesh ref={blob} geometry={geo} position={CENTER}>
        <meshPhysicalMaterial color={look.accent} roughness={0.25} metalness={0} clearcoat={1} clearcoatRoughness={0.15}
          emissive={shade(look.accent, 0.2)} emissiveIntensity={0.25} />
      </mesh>
      <points ref={pts} geometry={pGeo} visible={false}>
        <pointsMaterial size={0.07} color={shade(look.accent, 0.6)} transparent depthWrite={false} />
      </points>
      <mesh ref={photo} position={PHOTO} visible={false}>
        <planeGeometry args={[PW, PH]} />
        <meshBasicMaterial map={night()} transparent toneMapped={false} />
      </mesh>
      <group position={[-0.95, 0, 0.15]} rotation-z={-0.08}><BookMascot face={face} look={0.6} /></group>
      <Shadow scale={3.6} />
    </group>
  );
}
