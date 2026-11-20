/*
 * Python з нуля — «Острів-гра»: воксельний острівець (12 кубиків) у фіолетових відтінках, на ньому крутиться
 * жовта монетка, книжка стоїть поруч. Idle: острів повільно ширяє. Tap: книжка стрибає на монетку, та
 * розсипається іскрами, вилітає «+1», а за секунду монетка зʼявляється знову.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import BookMascot from '../BookMascot.jsx';
import { Shadow } from '../SceneRig.jsx';
import { clamp01, easeOut, shade, textTexture } from '../kit.js';

const U = 0.5;
// [x, y, z] у кубиках; верх острова — y = 0
const VOX = [
  [-1, 0, 0], [0, 0, 0], [1, 0, 0], [0, 0, -1], [1, 0, -1], [-1, 0, 1], [0, 0, 1],
  [0, -1, 0], [-1, -1, 0], [0, -1, -1], [1, -1, 0],
  [0, -2, 0],
];
const TOP = U / 2;
const COIN = new THREE.Vector3(0.5, TOP + 0.45, 0);
const BOOK = new THREE.Vector3(-0.5, TOP, 0.1);
const SPARKS = 14;

export default function IslandScene({ look, face, tap }) {
  const island = useRef();
  const coin = useRef();
  const book = useRef();
  const plus = useRef();
  const sparks = useRef([]);
  const st = useRef({ tap, at: -9 });
  const tones = useMemo(() => { const v = look.bg2 ?? look.bg; return [shade(v, 0.32), shade(v, 0.22), shade(v, 0.08)]; }, [look.bg, look.bg2]);
  const dirs = useMemo(() => Array.from({ length: SPARKS }, (_, i) => {
    const a = (i / SPARKS) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a), 0.6 + Math.random() * 0.8, Math.sin(a)).multiplyScalar(0.9);
  }), []);
  const plusTex = useMemo(() => textTexture('+1', { size: 110, color: look.accent }), [look.accent]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const s = st.current;
    if (tap !== s.tap) { s.tap = tap; if (t - s.at > 2.2) s.at = t; }
    const a = t - s.at;
    if (island.current) island.current.position.y = 0.55 + Math.sin(t * 1.1) * 0.08;
    // книжка: туди (0–0.45 с) і назад (0.7–1.15 с)
    const go = clamp01(a / 0.45); const ret = clamp01((a - 0.7) / 0.45);
    const k = easeOut(go) * (1 - easeOut(ret));
    if (book.current) {
      book.current.position.x = BOOK.x + (COIN.x - 0.15 - BOOK.x) * k;
      const hop = (a >= 0 && a <= 0.45 ? Math.sin(Math.PI * go) : 0) + (a >= 0.7 && a <= 1.15 ? Math.sin(Math.PI * ret) : 0);
      book.current.position.y = BOOK.y + hop * 0.7;
    }
    // монетка: зникає на 0.4 с, вертається на 1.4 с з пружинкою
    const gone = a >= 0.4 && a < 1.4;
    if (coin.current) {
      coin.current.rotation.y = t * 2.4;
      coin.current.position.y = COIN.y + Math.sin(t * 2) * 0.05;
      const back = clamp01((a - 1.4) / 0.35);
      coin.current.scale.setScalar(gone ? 0.001 : a >= 1.4 && a < 1.75 ? 0.4 + 0.6 * easeOut(back) * (1 + Math.sin(back * Math.PI) * 0.25) : 1);
    }
    const sp = clamp01((a - 0.4) / 0.7);
    sparks.current.forEach((m, i) => {
      if (!m) return;
      m.visible = a >= 0.4 && sp < 1;
      if (m.visible) {
        m.position.set(COIN.x + dirs[i].x * sp, COIN.y + dirs[i].y * sp - sp * sp * 0.6, COIN.z + dirs[i].z * sp);
        m.scale.setScalar(1 - sp);
      }
    });
    if (plus.current) {
      const p = clamp01((a - 0.4) / 1.0);
      plus.current.visible = a >= 0.4 && p < 1;
      plus.current.position.y = COIN.y + 0.4 + easeOut(p) * 0.7;
      plus.current.material.opacity = 1 - p;
    }
  });

  return (
    <group>
      <group ref={island} position={[0, 0.55, 0]}>
        {VOX.map(([x, y, z], i) => (
          <RoundedBox key={i} args={[U * 0.98, U * 0.98, U * 0.98]} radius={0.06} smoothness={2} position={[x * U, y * U, z * U]}>
            <meshStandardMaterial color={tones[y === 0 ? (i % 2) : 2]} roughness={0.6} />
          </RoundedBox>
        ))}
        <group ref={coin} position={COIN}>
          <mesh rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.22, 0.22, 0.07, 28]} />
            <meshStandardMaterial color={look.accent} roughness={0.35} emissive={look.accent} emissiveIntensity={0.15} />
          </mesh>
        </group>
        {dirs.map((_, i) => (
          <mesh key={i} ref={(el) => { sparks.current[i] = el; }} visible={false}>
            <boxGeometry args={[0.06, 0.06, 0.06]} />
            <meshBasicMaterial color={look.accent} toneMapped={false} />
          </mesh>
        ))}
        <sprite ref={plus} visible={false} scale={[0.6 * plusTex.userData.aspect * 0.5, 0.3, 1]} position={COIN}>
          <spriteMaterial map={plusTex} transparent depthWrite={false} toneMapped={false} />
        </sprite>
        <group ref={book} position={BOOK}><BookMascot face={face} look={0.45} /></group>
      </group>
      <Shadow scale={2.8} opacity={0.7} />
    </group>
  );
}
