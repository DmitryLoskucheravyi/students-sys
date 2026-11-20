/*
 * Frontend PRO — «Компоненти»: ізометрична сітка 3×2 зі скруглених плиток різного розміру (картка, кнопка, аватар),
 * бузкові різної яскравості, одна — яскравий акцент. Книжка у візорі стоїть на найбільшій плитці.
 * Idle: кожні ~3 с макет перебудовується (плитки міняються місцями на пружинах). Hover: плитка піднімається й
 * світиться. Tap: перестановка одразу.
 */
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { easing } from 'maath';
import BookMascot from '../BookMascot.jsx';
import { Shadow } from '../SceneRig.jsx';
import { shade } from '../kit.js';

const SLOTS = [[-1.15, -0.5], [0, -0.5], [1.15, -0.5], [-1.15, 0.5], [0, 0.5], [1.15, 0.5]];
// [ширина, глибина, висота, деталь]; 0 — найбільша (на ній книжка)
const TILES = [[1.05, 0.9, 0.22, 'card'], [0.9, 0.55, 0.16, 'button'], [0.6, 0.6, 0.14, 'avatar'], [0.95, 0.7, 0.12, null], [0.7, 0.85, 0.18, 'button'], [0.85, 0.5, 0.12, null]];

const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

export default function TilesScene({ look, face, tap }) {
  const tiles = useRef([]);
  const book = useRef();
  const [hovered, setHovered] = useState(-1);
  const st = useRef({ tap, order: [0, 1, 2, 3, 4, 5], next: 3 });
  const colors = useMemo(() => [look.accent, shade(look.accent, -0.35), shade(look.accent, -0.55), shade(look.accent, -0.2), shade(look.accent, -0.45), shade(look.accent, -0.6)], [look.accent]);
  const mats = useRef([]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const s = st.current;
    const d = Math.min(dt, 0.05);
    if (tap !== s.tap || t > s.next) { s.tap = tap; s.order = shuffle(s.order); s.next = t + 3; }
    tiles.current.forEach((g, i) => {
      if (!g) return;
      const [x, z] = SLOTS[s.order[i]];
      const lift = hovered === i ? 0.18 : 0;
      easing.damp3(g.position, [x, lift, z], 0.28, d);
      const m = mats.current[i];
      if (m) easing.damp(m, 'emissiveIntensity', hovered === i || i === 0 ? 0.35 : 0.05, 0.2, d);
    });
    const big = tiles.current[0];
    if (book.current && big) {
      book.current.position.set(big.position.x - 0.05, big.position.y + TILES[0][2], big.position.z + 0.05);
    }
  });

  return (
    <group>
      {TILES.map(([w, dpt, h, detail], i) => (
        <group key={i} ref={(el) => { tiles.current[i] = el; }} position={[SLOTS[i][0], 0, SLOTS[i][1]]}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(i); }} onPointerOut={() => setHovered(-1)}>
          <RoundedBox args={[w, h, dpt]} radius={0.06} smoothness={2} position={[0, h / 2, 0]}>
            <meshStandardMaterial ref={(m) => { mats.current[i] = m; }} color={colors[i]} emissive={colors[i]} emissiveIntensity={0.05} roughness={0.55} />
          </RoundedBox>
          {detail === 'button' && (
            <RoundedBox args={[w * 0.6, 0.06, 0.16]} radius={0.03} smoothness={2} position={[0, h + 0.03, 0]}>
              <meshStandardMaterial color={shade(look.accent, 0.4)} roughness={0.5} />
            </RoundedBox>
          )}
          {detail === 'avatar' && (
            <mesh position={[0, h + 0.03, 0]}>
              <cylinderGeometry args={[0.17, 0.17, 0.06, 24]} />
              <meshStandardMaterial color={shade(look.accent, 0.4)} roughness={0.5} />
            </mesh>
          )}
        </group>
      ))}
      <group ref={book}><BookMascot face={face} look={0.3} /></group>
      <Shadow scale={4.4} opacity={0.6} />
    </group>
  );
}
