/*
 * Scratch — «Блоки-конструктор»: три пазл-блоки (виступ зверху, виїмка знизу) один на одному, книжка на верхньому.
 * Перша поява: блоки прилітають і «клацають» один в одного, далі книжка стрибає.
 * Tap: книжка стрибає по дузі з поворотом і приземляється назад, блоки ледь пружинять.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import BookMascot from '../BookMascot.jsx';
import { Shadow } from '../SceneRig.jsx';
import { bump, easeOut, shade, spring } from '../kit.js';

const BH = 0.42;
const YELLOW = '#FFD43B'; // жовтий токен системи (акцент Python)

function Block({ color }) {
  const notch = shade(color, -0.25);
  return (
    <group>
      <RoundedBox args={[1.6, BH, 0.95]} radius={0.1} smoothness={3} position={[0, BH / 2, 0]}>
        <meshStandardMaterial color={color} roughness={0.55} />
      </RoundedBox>
      {/* виступ зверху */}
      <RoundedBox args={[0.42, 0.12, 0.5]} radius={0.05} smoothness={2} position={[-0.38, BH + 0.03, 0]}>
        <meshStandardMaterial color={color} roughness={0.55} />
      </RoundedBox>
      {/* виїмка знизу (темніша смужка спереду) */}
      <RoundedBox args={[0.44, 0.1, 0.02]} radius={0.01} smoothness={1} position={[-0.38, 0.05, 0.48]}>
        <meshStandardMaterial color={notch} roughness={0.6} />
      </RoundedBox>
    </group>
  );
}

export default function BlocksScene({ look, face, tap }) {
  const colors = [shade(look.accent, 0.45), YELLOW, look.accent];
  const blocks = useRef([]);
  const book = useRef();
  const s = useRef({ born: null, ys: [3, 3.6, 4.2], vs: [0, 0, 0], tap, jump: null, squash: -9 });

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const st = s.current;
    if (st.born == null) st.born = t;
    const age = t - st.born;
    if (st.jump == null) st.jump = st.born + 1.1; // стрибок після «клацання»
    if (tap !== st.tap) { st.tap = tap; if (t - st.jump > 0.75) { st.jump = t; st.squash = t; } }
    const d = Math.min(dt, 1 / 30);
    blocks.current.forEach((g, k) => {
      if (!g) return;
      const target = age > k * 0.15 ? 0 : st.ys[k];
      [st.ys[k], st.vs[k]] = spring(st.ys[k], st.vs[k], target, d, 260, 16);
      const sq = 1 - bump(t, st.squash + k * 0.05, 0.3) * 0.08;
      g.position.y = k * (BH + 0.02) + st.ys[k];
      g.scale.set(1 + (1 - sq) * 0.5, sq, 1 + (1 - sq) * 0.5);
    });
    const b = book.current;
    if (b) {
      const a = (t - st.jump) / 0.7;
      const inJump = a >= 0 && a <= 1;
      b.position.y = 3 * (BH + 0.02) + 0.07 + st.ys[2] + (inJump ? Math.sin(Math.PI * a) * 0.9 : 0);
      b.position.x = 0.1 + (inJump ? Math.sin(Math.PI * a) * 0.25 : 0);
      b.rotation.y = inJump ? easeOut(a) * Math.PI * 2 : 0;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {colors.map((c, k) => (
        <group key={c} ref={(el) => { blocks.current[k] = el; }} position={[k === 1 ? 0.08 : 0, 3, 0]}><Block color={c} /></group>
      ))}
      <group ref={book} position={[0.1, 1.4, 0.05]}><BookMascot face={face} look={0.3} /></group>
      <Shadow scale={3.6} />
    </group>
  );
}
