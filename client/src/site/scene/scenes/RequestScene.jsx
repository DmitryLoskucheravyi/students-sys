/*
 * Backend — «Запит → база»: ліворуч «клієнт» (телефончик), праворуч база зі стопки трьох зелених дисків,
 * між ними пунктирна дуга. Книжка сидить на базі. Idle: раз на ~2.5 с по дузі туди й назад біжить пакет,
 * верхній диск коротко світиться, коли пакет приходить. Tap: одразу 3 пакети й «200 OK» над клієнтом.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import BookMascot from '../BookMascot.jsx';
import { Shadow } from '../SceneRig.jsx';
import { bump, clamp01, easeOut, shade, textTexture } from '../kit.js';

const CLIENT = new THREE.Vector3(-1.3, 0, 0.1);
const DB = new THREE.Vector3(1.15, 0, 0);
const DISC = 0.24;
const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1.3, 1.05, 0.1), new THREE.Vector3(-0.1, 2.0, 0.05), new THREE.Vector3(1.15, 3 * DISC + 0.1, 0));
const PERIOD = 2.6;

/** 0 → 1 → 0 (туди за 0.8 с, назад за 0.8 с) для пакета, що стартував у t0 */
const leg = (a) => (a < 0 || a > 1.8 ? null : a < 0.8 ? easeOut(a / 0.8) : a < 1.0 ? 1 : 1 - easeOut((a - 1.0) / 0.8));

export default function RequestScene({ look, face, tap }) {
  const packets = useRef([]);
  const topDisc = useRef();
  const ok = useRef();
  const st = useRef({ tap, burst: -9 });
  // дуга з крапок: тонка лінія WebGL (1 px) на телефоні майже не видна
  const dots = useMemo(() => curve.getSpacedPoints(22).slice(1, -1), []);
  const okTex = useMemo(() => textTexture('200 OK', { size: 72, color: look.onAccent, bg: look.accent, pad: 36, weight: 700 }), [look.accent, look.onAccent]);
  const greens = [shade(look.accent, -0.15), look.accent, shade(look.accent, 0.18)];
  const p = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const s = st.current;
    if (tap !== s.tap) { s.tap = tap; if (t - s.burst > 2) s.burst = t; }
    let glow = 0;
    packets.current.forEach((m, i) => {
      if (!m) return;
      const a = i === 0 ? (t % PERIOD) : t - s.burst - (i - 1) * 0.15;
      const k = leg(a);
      m.visible = k != null;
      if (k != null) { curve.getPoint(k, p); m.position.copy(p); m.rotation.set(t * 2, t * 3, 0); if (k > 0.95) glow = 1; }
    });
    if (topDisc.current) topDisc.current.emissiveIntensity = 0.1 + glow * 0.9;
    if (ok.current) {
      const o = bump(t, s.burst + 0.6, 1.4);
      ok.current.visible = o > 0;
      ok.current.material.opacity = clamp01(o * 1.6);
      ok.current.position.y = 1.55 + (t - s.burst) * 0.12;
    }
  });

  return (
    <group>
      {/* клієнт */}
      <group position={CLIENT}>
        <RoundedBox args={[0.55, 0.95, 0.14]} radius={0.08} smoothness={3} position={[0, 0.48, 0]}>
          <meshStandardMaterial color="#ffffff" roughness={0.55} />
        </RoundedBox>
        <RoundedBox args={[0.43, 0.7, 0.02]} radius={0.04} smoothness={2} position={[0, 0.5, 0.075]}>
          <meshStandardMaterial color={shade(look.bg, -0.1)} roughness={0.6} />
        </RoundedBox>
      </group>
      {/* база: три диски */}
      <group position={DB}>
        {greens.map((c, k) => (
          <mesh key={c} position={[0, DISC / 2 + k * (DISC + 0.015), 0]}>
            <cylinderGeometry args={[0.45, 0.45, DISC, 36]} />
            <meshStandardMaterial ref={k === 2 ? topDisc : undefined} color={c} roughness={0.5} emissive={c} emissiveIntensity={0.1} />
          </mesh>
        ))}
        <group position={[0.02, 3 * (DISC + 0.015), 0.05]}><BookMascot face={face} look={-0.5} /></group>
      </group>
      {dots.map((d, i) => (
        <mesh key={i} position={d}>
          <sphereGeometry args={[0.035, 8, 6]} />
          <meshBasicMaterial color={look.accent} transparent opacity={0.75} />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(el) => { packets.current[i] = el; }} visible={false}>
          <boxGeometry args={[0.13, 0.13, 0.13]} />
          <meshStandardMaterial color="#ffffff" emissive={look.accent} emissiveIntensity={0.25} roughness={0.4} />
        </mesh>
      ))}
      <sprite ref={ok} visible={false} position={[CLIENT.x, 1.55, CLIENT.z]} scale={[0.32 * okTex.userData.aspect, 0.32, 1]}>
        <spriteMaterial map={okTex} transparent depthWrite={false} toneMapped={false} />
      </sprite>
      <Shadow scale={4.4} />
    </group>
  );
}
