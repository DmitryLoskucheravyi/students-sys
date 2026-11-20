/*
 * Маскот — помаранчева книжка: обкладинка, кремовий блок сторінок, темніший корінець.
 * Обличчя — текстура на площині поверх обкладинки: kid (6–11), smile (9–16), visor (Frontend PRO), calm (Backend).
 * Сам «дихає» (scaleY 1 → 1.02), погойдується ±3° і моргає раз на 3–5 с. Початок координат — між «ногами»,
 * тож сцена ставить книжку на предмет просто за висотою його верху. Висота книжки ≈ 1.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { MASCOT, canvasTexture } from './kit.js';

function drawFace(ctx, w, h, face, closed) {
  const ink = '#1d1733';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const eyes = (fn) => { fn(w * 0.32); fn(w * 0.68); };
  const ey = h * 0.4;
  if (face === 'visor') {
    ctx.fillStyle = ink; ctx.beginPath(); ctx.roundRect(w * 0.1, ey - h * 0.09, w * 0.8, h * 0.17, h * 0.085); ctx.fill();
    ctx.fillStyle = '#B9A6FF';
    ctx.beginPath(); ctx.roundRect(w * 0.17, ey - h * 0.02, w * 0.26, h * 0.035, 6); ctx.fill();
    ctx.beginPath(); ctx.roundRect(w * 0.57, ey - h * 0.02, w * 0.26, h * 0.035, 6); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = w * 0.045;
    ctx.beginPath(); ctx.moveTo(w * 0.4, h * 0.66); ctx.quadraticCurveTo(w * 0.53, h * 0.72, w * 0.63, h * 0.64); ctx.stroke();
    return;
  }
  if (face === 'kid') {
    ctx.fillStyle = 'rgba(255,143,163,0.8)';
    eyes((x) => { ctx.beginPath(); ctx.arc(x + (x < w / 2 ? -w * 0.08 : w * 0.08), h * 0.56, w * 0.07, 0, Math.PI * 2); ctx.fill(); });
  }
  if (closed) {
    ctx.strokeStyle = ink; ctx.lineWidth = w * 0.045;
    eyes((x) => { ctx.beginPath(); ctx.moveTo(x - w * 0.08, ey); ctx.quadraticCurveTo(x, ey + h * 0.03, x + w * 0.08, ey); ctx.stroke(); });
  } else if (face === 'kid') {
    eyes((x) => {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, ey, w * 0.11, h * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x + w * 0.015, ey + h * 0.015, w * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + w * 0.04, ey - h * 0.015, w * 0.022, 0, Math.PI * 2); ctx.fill();
    });
  } else if (face === 'smile') {
    ctx.strokeStyle = ink; ctx.lineWidth = w * 0.05;
    eyes((x) => { ctx.beginPath(); ctx.moveTo(x - w * 0.08, ey + h * 0.03); ctx.quadraticCurveTo(x, ey - h * 0.07, x + w * 0.08, ey + h * 0.03); ctx.stroke(); });
  } else {
    ctx.fillStyle = ink;
    eyes((x) => { ctx.beginPath(); ctx.ellipse(x, ey, w * 0.045, h * 0.05, 0, 0, Math.PI * 2); ctx.fill(); });
  }
  if (face === 'kid') {
    ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(w * 0.38, h * 0.62); ctx.quadraticCurveTo(w * 0.5, h * 0.82, w * 0.62, h * 0.62); ctx.closePath(); ctx.fill();
  } else {
    ctx.strokeStyle = ink; ctx.lineWidth = w * 0.045;
    ctx.beginPath(); ctx.moveTo(w * 0.38, h * 0.64);
    if (face === 'calm') ctx.quadraticCurveTo(w * 0.5, h * 0.7, w * 0.62, h * 0.63);
    else ctx.quadraticCurveTo(w * 0.5, h * 0.76, w * 0.62, h * 0.64);
    ctx.stroke();
  }
}

const faceTex = (face, closed) => canvasTexture(`face:${face}:${closed}`, 256, 320, (ctx, w, h) => drawFace(ctx, w, h, face, closed));

/**
 * look — куди повернути книжку (радіани навколо Y), щоб вона «дивилась» на предмет.
 * Зовнішні рухи (стрибок, переміщення) робить сцена через позицію групи.
 */
export default function BookMascot({ face = 'kid', look = 0, ...props }) {
  const body = useRef();
  const faceMat = useRef();
  const tex = useMemo(() => ({ open: faceTex(face, false), closed: faceTex(face, true) }), [face]);
  const blink = useRef({ next: 1.5 + Math.random() * 2, until: 0 });
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const b = body.current;
    if (!b) return;
    b.scale.y = 1 + 0.01 + 0.01 * Math.sin(t * 2.1);
    b.rotation.z = Math.sin(t * 0.9) * 0.05;
    b.rotation.y += (look - b.rotation.y) * 0.08;
    const k = blink.current;
    if (face !== 'visor' && t > k.next) { k.until = t + 0.13; k.next = t + 3 + Math.random() * 2; }
    if (faceMat.current) faceMat.current.map = t < k.until ? tex.closed : tex.open;
  });
  return (
    <group {...props}>
      <group ref={body}>
        <group position={[0, 0.5, 0]}>
          <RoundedBox args={[0.6, 0.9, 0.24]} radius={0.05} smoothness={2} position={[0.03, 0, 0]}>
            <meshStandardMaterial color={MASCOT.pages} roughness={0.85} />
          </RoundedBox>
          <RoundedBox args={[0.68, 0.96, 0.06]} radius={0.04} smoothness={2} position={[0, 0, 0.14]}>
            <meshStandardMaterial color={MASCOT.cover} roughness={0.6} />
          </RoundedBox>
          <RoundedBox args={[0.68, 0.96, 0.06]} radius={0.04} smoothness={2} position={[0, 0, -0.14]}>
            <meshStandardMaterial color={MASCOT.cover} roughness={0.6} />
          </RoundedBox>
          <RoundedBox args={[0.1, 0.96, 0.34]} radius={0.04} smoothness={2} position={[-0.32, 0, 0]}>
            <meshStandardMaterial color={MASCOT.spine} roughness={0.6} />
          </RoundedBox>
          <mesh position={[0.02, 0.02, 0.175]}>
            <planeGeometry args={[0.52, 0.65]} />
            <meshBasicMaterial ref={faceMat} map={tex.open} transparent toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
