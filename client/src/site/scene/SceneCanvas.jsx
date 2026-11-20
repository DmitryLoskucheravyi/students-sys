/*
 * Один WebGL-контекст на секцію: Canvas поверх слайдера чи списку (pointer-events: none),
 * а кожна картка малює свою сцену через drei <View> у власному прямокутнику.
 * Canvas — частина сторінки (absolute на всю секцію), а не fixed на екран: інакше під час скролу картка
 * зсувається одразу, а сцена малюється за старими координатами на кадр пізніше — модель «дьоргається».
 * Поза екраном — frameloop 'never' (нічого не рахується); під час свайпу dpr падає до 1.
 */
import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { View } from '@react-three/drei';

/** Найвищий dpr: до 1.75, але так, щоб висота полотна не перевищила ~7500 px (довгий список на телефоні). */
const MAX_PX = 7500;
const fullDpr = (h) => Math.max(1, Math.min(1.75, window.devicePixelRatio || 1, MAX_PX / Math.max(1, h)));

function DprGovernor({ scrollEl }) {
  const setDpr = useThree((s) => s.setDpr);
  const height = useThree((s) => s.size.height);
  useEffect(() => { setDpr(fullDpr(height)); }, [height, setDpr]);
  useEffect(() => {
    const el = scrollEl?.current;
    if (!el) return undefined;
    let t = 0;
    const on = () => {
      setDpr(1);
      clearTimeout(t);
      t = setTimeout(() => setDpr(fullDpr(height)), 180);
    };
    el.addEventListener('scroll', on, { passive: true });
    return () => { el.removeEventListener('scroll', on); clearTimeout(t); };
  }, [scrollEl, setDpr, height]);
  return null;
}

export default function SceneCanvas({ eventSource, active, scrollEl }) {
  return (
    <Canvas
      className="cc-canvas"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}
      eventSource={eventSource}
      eventPrefix="client"
      frameloop={active ? 'always' : 'never'}
      dpr={1}
      gl={{ antialias: true, powerPreference: 'low-power', alpha: true }}
    >
      <View.Port />
      <DprGovernor scrollEl={scrollEl} />
    </Canvas>
  );
}
