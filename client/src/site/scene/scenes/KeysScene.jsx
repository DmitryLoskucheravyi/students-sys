/*
 * Комп'ютерна грамотність — «Великі клавіші»: три желейні клавіші Я Т И, книжка стоїть на середній.
 * Idle: клавіші по черзі злегка натискаються хвилею. Tap/hover клавіші: натиск із пружинкою, над нею
 * вилітає й тане літера, книжка підстрибує.
 */
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import BookMascot from '../BookMascot.jsx';
import { Shadow } from '../SceneRig.jsx';
import { bump, easeOut, shade, textTexture } from '../kit.js';

const LETTERS = ['Я', 'Т', 'И'];
const X = [-1.08, 0, 1.08];
const H = 0.5;

export default function KeysScene({ look, face, tap }) {
  const keys = useRef([]);
  const book = useRef();
  const pops = useRef([]);
  const state = useRef({ tap: tap, presses: [-9, -9, -9], next: 0, jump: -9 });
  const [hovered, setHovered] = useState(-1);
  const tex = useMemo(() => LETTERS.map((l) => textTexture(l, { size: 170, color: '#ffffff', pad: 8, weight: 900 })), []);
  const top = shade(look.accent, 0.12);

  const press = (k, t) => {
    const s = state.current;
    s.presses[k] = t;
    if (k === 1 || Math.random() < 0.6) s.jump = t;
  };

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const s = state.current;
    if (tap !== s.tap) { s.tap = tap; press(s.next, t); s.next = (s.next + 1) % 3; }
    if (s.queued != null) { press(s.queued, t); s.queued = null; }
    keys.current.forEach((g, k) => {
      if (!g) return;
      const wave = Math.max(0, Math.sin(t * 2.2 - k * 0.9)) ** 6 * 0.05;
      const hit = bump(t, s.presses[k], 0.32) * 0.16;
      const hov = hovered === k ? 0.05 : 0;
      g.position.y = -(wave + hit + hov);
      g.scale.y = 1 - hit * 0.6;
      const p = pops.current[k];
      if (p) {
        const a = (t - s.presses[k]) / 0.9;
        p.visible = a >= 0 && a <= 1;
        if (p.visible) { p.position.y = H + 0.35 + easeOut(a) * 1.1; p.material.opacity = 1 - a; }
      }
    });
    if (book.current) {
      const mid = keys.current[1]?.position.y ?? 0;
      book.current.position.y = H + mid + bump(t, s.jump, 0.5) * 0.5;
    }
  });

  return (
    <group>
      {X.map((x, k) => (
        <group key={x} position={[x, 0, 0]}>
          <group ref={(el) => { keys.current[k] = el; }}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(k); state.current.queued = k; }}
            onPointerOut={() => setHovered(-1)}>
            <RoundedBox args={[0.95, H, 0.95]} radius={0.16} smoothness={3} position={[0, H / 2, 0]}>
              <meshStandardMaterial color={look.accent} roughness={0.55} />
            </RoundedBox>
            <RoundedBox args={[0.8, 0.06, 0.8]} radius={0.03} smoothness={2} position={[0, H - 0.01, 0]}>
              <meshStandardMaterial color={top} roughness={0.55} />
            </RoundedBox>
            {k !== 1 && (
              <mesh rotation-x={-Math.PI / 2} position={[0, H + 0.045, 0.02]}>
                <planeGeometry args={[0.62, 0.62]} />
                <meshBasicMaterial map={tex[k]} transparent toneMapped={false} />
              </mesh>
            )}
          </group>
          <sprite ref={(el) => { pops.current[k] = el; }} visible={false} scale={[0.5, 0.5, 1]}>
            <spriteMaterial map={tex[k]} transparent depthWrite={false} toneMapped={false} />
          </sprite>
        </group>
      ))}
      <group ref={book} position={[0, H, 0.05]}><BookMascot face={face} look={0.35} /></group>
      <Shadow scale={4.2} />
    </group>
  );
}
