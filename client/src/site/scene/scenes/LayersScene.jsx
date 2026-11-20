/*
 * Frontend з нуля — «Шари сторінки»: три тонкі скруглені площини стопкою, як сторінка сайту:
 * зверху «контент» (біла з кнопкою-пігулкою), посередині «стилі» (лавандова напівпрозора), внизу «каркас»
 * (темно-синій контур). Книжка визирає з-за стопки. Idle: шари трохи розходяться й сходяться.
 * Hover/tap: шари розлітаються з поворотом (видно, що сторінка з шарів); ще раз — збираються.
 */
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { easing } from 'maath';
import BookMascot from '../BookMascot.jsx';
import { Shadow } from '../SceneRig.jsx';
import { shade } from '../kit.js';

const W = 2.1; const D = 1.45; const T = 0.06;

function Wire({ color }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const y = 0; const hw = W / 2; const hd = D / 2;
    const r = (x1, z1, x2, z2) => [x1, y, z1, x2, y, z1, x2, y, z1, x2, y, z2, x2, y, z2, x1, y, z2, x1, y, z2, x1, y, z1];
    // рамка сторінки, шапка, дві колонки — як wireframe макета
    const v = [...r(-hw, -hd, hw, hd), ...r(-hw + 0.12, -hd + 0.12, hw - 0.12, -hd + 0.4), ...r(-hw + 0.12, -hd + 0.52, -0.1, hd - 0.12), ...r(0.05, -hd + 0.52, hw - 0.12, hd - 0.12)];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    return g;
  }, []);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={color} />
    </lineSegments>
  );
}

export default function LayersScene({ look, face, tap }) {
  const layers = useRef([]);
  const [open, setOpen] = useState(false);
  const st = useRef({ tap });
  const navy = look.accent;
  const lav = shade(look.bg, -0.12);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const s = st.current;
    if (tap !== s.tap) { s.tap = tap; setOpen((o) => !o); }
    const gap = open ? 0.62 : 0.3 + Math.sin(t * 1.3) * 0.06;
    layers.current.forEach((g, k) => {
      if (!g) return;
      const d = Math.min(dt, 0.05);
      easing.damp(g.position, 'y', 0.25 + (2 - k) * gap, 0.25, d);
      easing.damp(g.rotation, 'y', open ? (1 - k) * 0.18 : 0, 0.3, d);
      easing.damp(g.position, 'x', open ? (1 - k) * 0.12 : 0, 0.3, d);
    });
  });

  return (
    <group>
      {/* стопка трохи нахилена до камери, щоб шари читалися окремо */}
      <group rotation-x={0.42} position={[0, 0.15, 0]} onPointerEnter={() => setOpen(true)} onPointerLeave={() => setOpen(false)}>
      {/* 0 — контент */}
      <group ref={(el) => { layers.current[0] = el; }}>
        <RoundedBox args={[W, T, D]} radius={0.03} smoothness={2}>
          <meshStandardMaterial color="#ffffff" roughness={0.6} />
        </RoundedBox>
        <RoundedBox args={[0.7, 0.08, 0.24]} radius={0.04} smoothness={2} position={[0.45, T, 0.35]}>
          <meshStandardMaterial color={navy} roughness={0.55} />
        </RoundedBox>
        <RoundedBox args={[1.2, 0.04, 0.12]} radius={0.02} smoothness={1} position={[-0.3, T / 2 + 0.01, -0.35]}>
          <meshStandardMaterial color={lav} roughness={0.7} />
        </RoundedBox>
        <RoundedBox args={[0.8, 0.04, 0.1]} radius={0.02} smoothness={1} position={[-0.5, T / 2 + 0.01, -0.1]}>
          <meshStandardMaterial color={lav} roughness={0.7} />
        </RoundedBox>
      </group>
      {/* 1 — стилі */}
      <group ref={(el) => { layers.current[1] = el; }}>
        <RoundedBox args={[W, T, D]} radius={0.03} smoothness={2}>
          <meshStandardMaterial color={lav} roughness={0.6} transparent opacity={0.65} />
        </RoundedBox>
      </group>
      {/* 2 — каркас */}
      <group ref={(el) => { layers.current[2] = el; }}><Wire color={navy} /></group>
      </group>
      <group position={[1.15, 0, -0.75]}><BookMascot face={face} look={-0.4} /></group>
      <Shadow scale={3.6} />
    </group>
  );
}
