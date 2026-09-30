import { useMemo } from 'react';
import { Preview3D } from './Preview3D';
import { makeDemoCfg } from '../game/config';
import { MODE_INFO } from '../game/types';
import type { Mode } from '../game/types';

export function ModeSelect({ onSelect, onBack }: { onSelect: (m: Mode) => void; onBack: () => void }) {
  const iceCfg = useMemo(() => makeDemoCfg('icetag', 'snow'), []);
  const ojCfg = useMemo(() => makeDemoCfg('ojaemi', 'beach'), []);
  const policeCfg = useMemo(() => makeDemoCfg('police', 'plaza'), []);
  return (
    <div
      className="absolute inset-0 bg-gradient-to-b from-sky-400 via-sky-300 to-sky-500 flex flex-col short:!pt-1 short:!pb-2"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
    >
      <div className="flex items-center justify-between px-3 py-2 short:py-1">
        <button className="w-10 h-10 rounded-full bg-white/90 font-black text-sky-700 shadow" onClick={onBack}>◀</button>
        <div className="wood rounded-2xl px-5 py-1.5 short:py-1 text-white font-black text-xl short:text-lg txt-outline-sm tracking-widest">MODE SELECT</div>
        <div className="w-10" />
      </div>
      {/* portrait: stacked cards · landscape / desktop: side by side */}
      <div className="flex-1 flex flex-col landscape:flex-row gap-3 wide:gap-6 px-4 wide:px-10 py-2 min-h-0 w-full max-w-[1400px] mx-auto">
        {(['icetag', 'ojaemi', 'police'] as Mode[]).map((m) => (
          <button key={m} className="relative flex-1 min-h-0 min-w-0 rounded-3xl overflow-hidden border-4 border-white shadow-2xl active:scale-[0.98] transition text-left" onClick={() => onSelect(m)}>
            <Preview3D cfg={m === 'icetag' ? iceCfg : m === 'ojaemi' ? ojCfg : policeCfg} className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-3 left-3 bg-white/90 rounded-full px-3 py-1 text-xs font-black" style={{ color: MODE_INFO[m].color }}>LIVE 3D PREVIEW</div>
            <div className="absolute left-4 right-4 bottom-4 short:bottom-3 text-white">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="font-black text-4xl short:text-3xl wide:text-5xl txt-outline">{MODE_INFO[m].name}</div>
                <div className="font-black text-xl txt-outline-sm mb-1" style={{ color: m === 'icetag' ? '#bfe9ff' : m === 'ojaemi' ? '#ffd27a' : '#b9ccff' }}>{MODE_INFO[m].sub}</div>
              </div>
              <div className="text-sm font-bold txt-outline-sm mt-1 tiny:hidden">{MODE_INFO[m].desc}</div>
              <div className="mt-2 inline-block rounded-xl px-4 py-1.5 font-black text-sm border-b-4" style={{ background: MODE_INFO[m].color, borderColor: 'rgba(0,0,0,0.35)' }}>선택 ▶</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
