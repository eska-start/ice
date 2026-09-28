import { useEffect, useState } from 'react';

export type DeviceClass = 'phone' | 'tablet' | 'desktop';

export interface Viewport {
  w: number;
  h: number;
  landscape: boolean;
  /** very short screen (phone held sideways) */
  short: boolean;
  device: DeviceClass;
  /** primary input is touch */
  touch: boolean;
  /** UI scale factor for in-game controls (≈0.72 small phone landscape … 1.2 big tablet) */
  ui: number;
}

function read(): Viewport {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const minSide = Math.min(w, h);
  // "touch" = the PRIMARY pointer is a finger. Touch-screen laptops / PCs with a mouse (primary pointer: fine)
  // are treated as PC → keyboard hints, no virtual joystick.
  const mq = (q: string) => window.matchMedia?.(q).matches ?? false;
  const coarse = mq('(pointer: coarse)');
  const fine = mq('(pointer: fine)');
  const touch = coarse || (!fine && navigator.maxTouchPoints > 0);
  const device: DeviceClass = !touch && minSide >= 600 ? 'desktop' : minSide < 600 ? 'phone' : 'tablet';
  const landscape = w > h;
  const short = h < 520;
  // control size follows the shorter side, so landscape phones get compact buttons
  const ui = Math.max(0.7, Math.min(1.22, minSide / (device === 'desktop' ? 820 : 430)));
  return { w, h, landscape, short, device, touch, ui: device === 'desktop' ? Math.min(ui, 1) : ui };
}

export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(read);
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setVp(read()));
    };
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    window.visualViewport?.addEventListener('resize', on);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
      window.visualViewport?.removeEventListener('resize', on);
    };
  }, []);
  return vp;
}
