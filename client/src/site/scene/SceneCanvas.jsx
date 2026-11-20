/*
 * Один WebGL-контекст на секцію: Canvas поверх слайдера/списку (pointer-events: none),
 * а кожна картка малює свою сцену через drei <View> у власному прямокутнику.
 * Поза екраном — frameloop 'never' (нічого не рахується); під час свайпу dpr падає до 1.
 */
import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { View } from '@react-three/drei';

function DprGovernor({ scrollEl }) {
  const setDpr = useThree((s) => s.setDpr);
  useEffect(() => {
    const el = scrollEl?.current;
    if (!el) return undefined;
    const full = Math.min(1.75, window.devicePixelRatio || 1);
    let t = 0;
    const on = () => {
      setDpr(1);
      clearTimeout(t);
      t = setTimeout(() => setDpr(full), 180);
    };
    el.addEventListener('scroll', on, { passive: true });
    return () => { el.removeEventListener('scroll', on); clearTimeout(t); };
  }, [scrollEl, setDpr]);
  return null;
}

export default function SceneCanvas({ eventSource, active, fixed, scrollEl }) {
  return (
    <Canvas
      className="cc-canvas"
      style={{ position: fixed ? 'fixed' : 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}
      eventSource={eventSource}
      eventPrefix="client"
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'low-power', alpha: true }}
    >
      <View.Port />
      <DprGovernor scrollEl={scrollEl} />
    </Canvas>
  );
}
