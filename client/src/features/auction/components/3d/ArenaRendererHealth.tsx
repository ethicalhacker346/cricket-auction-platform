import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { watchWebGLContext } from '../../utils/rendererHealth';

export function ArenaRendererHealth({ enabled, onReady, onContextLost, onContextRestored, onFrameRate }: {
  enabled: boolean; onReady: () => void; onContextLost: () => void;
  onContextRestored: () => void; onFrameRate: (fps: number) => void;
}) {
  const renderer = useThree((state) => state.gl);
  const sample = useRef({ elapsed: 0, frames: 0, warmup: 2.5 });
  useEffect(() => {
    const unwatch = watchWebGLContext(renderer.domElement, onContextLost, onContextRestored);
    onReady();
    return unwatch;
  }, [renderer, onReady, onContextLost, onContextRestored]);
  useEffect(() => { sample.current = { elapsed: 0, frames: 0, warmup: 2.5 }; }, [enabled]);
  useFrame((_state, delta) => {
    if (!enabled) return;
    const current = sample.current;
    if (delta > 1 || delta <= 0) { current.elapsed = 0; current.frames = 0; current.warmup = 2.5; return; }
    if (current.warmup > 0) { current.warmup -= delta; return; }
    current.elapsed += delta; current.frames += 1;
    if (current.elapsed >= 3) {
      onFrameRate(current.frames / current.elapsed);
      current.elapsed = 0; current.frames = 0;
    }
  });
  return null;
}
