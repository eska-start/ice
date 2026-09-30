import { makeStageCfg } from '../game/config';
import type { SaveData } from '../game/save';
import { totalStars } from '../game/save';
import { MAP_INFO, STAGES } from '../game/types';
import type { GameConfig } from '../game/types';

export function Stages({ save, onStart, onBack }: { save: SaveData; onStart: (cfg: GameConfig) => void; onBack: () => void }) {
  const stars = totalStars(save);
  return (
    <div
      className="absolute inset-0 bg-gradient-to-b from-sky-400 via-sky-300 to-emerald-300 flex flex-col overflow-hidden"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
    >
      <div className="flex items-center justify-between px-3 py-2 short:py-1 screen-col">
        <button className="w-10 h-10 rounded-full bg-white/90 font-black text-sky-700 shadow" onClick={onBack}>◀</button>
        <div className="wood rounded-2xl px-5 py-1.5 text-white font-black text-lg txt-outline-sm">스테이지 모드 <span className="text-yellow-200 text-sm">⭐ {stars}/12</span></div>
        <div className="w-10" />
      </div>
      <div className="text-center text-white font-black txt-outline-sm text-sm short:hidden">다양한 맵에서 즐기는 얼음땡! 별을 모아 맵을 해금해요</div>
      {/* 1 column portrait phone · 2 columns landscape / tablet · 4 columns wide desktop */}
      <div className="flex-1 overflow-auto px-4 py-3 short:py-2 grid grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 min-[1200px]:landscape:grid-cols-4 gap-3 content-start screen-col min-[1200px]:!max-w-[1400px]" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        {STAGES.map((s, i) => {
          const got = save.stars[s.id] ?? 0;
          const locked = i > 0 && (save.stars[STAGES[i - 1].id] ?? 0) === 0;
          const mi = MAP_INFO[s.map];
          return (
            <button
              key={s.id}
              disabled={locked}
              onClick={() => onStart(makeStageCfg(s.id, save.animal, save.name, save.quality, save.outfit))}
              className={`relative rounded-3xl overflow-hidden border-4 border-white shadow-xl text-left active:scale-[0.99] ${locked ? 'opacity-75' : ''}`}
            >
              <div className="flex items-center gap-2 px-3 py-2 bg-white/95">
                <div className="w-8 h-8 rounded-full bg-sky-500 text-white font-black flex items-center justify-center">{s.id}</div>
                <div className="flex-1">
                  <div className="font-black text-slate-800">{mi.emoji} {s.title}</div>
                  <div className="text-[11px] font-bold text-sky-700">🎯 {s.goal}</div>
                </div>
                <div className="text-yellow-400 font-black text-lg">{'★'.repeat(got)}<span className="text-slate-300">{'★'.repeat(3 - got)}</span></div>
              </div>
              <div className="relative h-28 bg-cover bg-center" style={{ backgroundImage: `url(${mi.thumb})`, backgroundColor: '#a5d8ff' }}>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent" />
                <div className="absolute left-3 right-3 bottom-2 text-white text-[11px] font-bold txt-outline-sm">{s.desc}</div>
                {locked && <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center text-white font-black">🔒 이전 스테이지 클리어 시 오픈</div>}
                {!locked && got === 3 && <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-black rounded-full px-2 py-0.5">✓ 완료</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
