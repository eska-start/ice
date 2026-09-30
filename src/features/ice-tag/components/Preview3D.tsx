import { useEffect, useRef } from 'react';
import { Game } from '../game/Game';
import { Sfx } from '../game/sfx';
import type { GameConfig } from '../game/types';

const silent = new Sfx();

/** Mounts a live, all-AI demo match (no HUD) — used for the main menu background and mode previews. */
export function Preview3D({ cfg, className }: { cfg: GameConfig; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const g = new Game(ref.current, cfg, {}, silent);
    return () => g.dispose();
  }, [cfg]);
  return <div ref={ref} className={className} />;
}
