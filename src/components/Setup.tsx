import { useState } from 'react';
import { ChevronLeft, Gamepad2, Lock, Swords, Users } from 'lucide-react';
import { makeMatchCfg } from '../game/config';
import type { SaveData } from '../game/save';
import { totalStars } from '../game/save';
import { ALL_MAPS, ANIMAL_INFO, MAP_INFO, MODE_INFO, TEAM_SIZES, TEAM_SIZE_INFO, matchSize } from '../game/types';
import type { Difficulty, GameConfig, MapId, Mode, TeamSize } from '../game/types';
import { Portrait } from './Portrait';
import type { LobbyInit } from './Lobby';

/** little red/blue pawn row that visualises a team size (●● vs ●●) */
export function VsDots({ n, size = 8 }: { n: TeamSize; size?: number }) {
  const dot = (cls: string, i: number) => <span key={i} className={`rounded-full ${cls}`} style={{ width: size, height: size }} />;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex gap-0.5">{Array.from({ length: n }, (_, i) => dot('bg-rose-500', i))}</span>
      <span className="text-[9px] font-black text-slate-400 mx-0.5">VS</span>
      <span className="inline-flex gap-0.5">{Array.from({ length: n }, (_, i) => dot('bg-sky-500', i))}</span>
    </span>
  );
}

export function TeamSizePicker({ value, onChange, dark = false, isDisabled }: { value: TeamSize; onChange: (n: TeamSize) => void; dark?: boolean; isDisabled?: (n: TeamSize) => boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {TEAM_SIZES.map((n) => {
        const on = value === n;
        const off = isDisabled?.(n) ?? false;
        return (
          <button
            key={n}
            disabled={off}
            onClick={() => onChange(n)}
            className={`rounded-2xl px-2 py-2.5 flex flex-col items-center gap-1.5 press transition ${on ? (dark ? 'bg-white text-slate-900' : 'bg-slate-900 text-white') : dark ? 'bg-white/10 text-white/80' : 'bg-slate-50 text-slate-700'} ${off ? 'opacity-35' : ''}`}
          >
            <span className="text-[15px] font-extrabold leading-none tabular-nums">{TEAM_SIZE_INFO[n].label}</span>
            <VsDots n={n} size={7} />
            <span className={`text-[10px] font-medium leading-none ${on ? (dark ? 'text-slate-500' : 'text-white/60') : 'text-slate-400'}`}>{TEAM_SIZE_INFO[n].desc}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Setup({ mode, save, onStart, onMulti, onBack }: { mode: Mode; save: SaveData; onStart: (cfg: GameConfig) => void; onMulti: (o: LobbyInit) => void; onBack: () => void }) {
  const [map, setMap] = useState<MapId>('plaza');
  const [play, setPlay] = useState<'single' | 'multi'>('single');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [teamSize, setTeamSize] = useState<TeamSize>(3);
  const stars = totalStars(save);
  const info = MODE_INFO[mode];
  const oj = mode === 'ojaemi';
  const total = matchSize(mode, teamSize);
  const headerSub = oj ? TEAM_SIZE_INFO[teamSize].label : info.sub;
  const singleSub = oj ? (teamSize === 1 ? '나 vs AI 1' : `나 + AI ${teamSize - 1} vs AI ${teamSize}`) : '나 + AI 5';

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg,#bfe4ff 0%,#e8f5ff 45%,#f4fbf2 100%)', paddingTop: 'max(10px, env(safe-area-inset-top))', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
    >
      <div className="shrink-0 flex items-center justify-between px-3 h-12 short:h-10 screen-col">
        <button className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-600 press" onClick={onBack}><ChevronLeft size={20} strokeWidth={2.5} /></button>
        <div className="text-slate-900 font-bold text-[17px]">{info.name} <span className="text-slate-400 text-sm font-semibold">{headerSub}</span></div>
        <div className="w-10" />
      </div>
      {/* portrait: single column · landscape / desktop: two balanced columns */}
      <div className="flex-1 overflow-auto px-4 pb-4 space-y-3 landscape:space-y-0 landscape:columns-2 landscape:gap-3 wide:gap-5 [&>section]:break-inside-avoid landscape:[&>section]:mb-3 screen-col">
        {oj && (
          <section className="bg-white rounded-3xl p-3 shadow-sm">
            <div className="flex items-center gap-2 px-1 mb-2">
              <Swords size={15} className="text-orange-500" />
              <span className="text-[13px] font-bold text-slate-800">대전 방식</span>
              <span className="text-slate-400 font-medium text-[11px]">총 {total}명</span>
            </div>
            <TeamSizePicker value={teamSize} onChange={setTeamSize} />
          </section>
        )}

        <section className="bg-white rounded-3xl p-3 shadow-sm">
          <div className="text-[13px] font-bold text-slate-800 px-1 mb-2">맵 선택 <span className="text-slate-400 font-medium text-[11px] ml-1">스테이지 별로 해금</span></div>
          <div className="grid grid-cols-2 gap-2">
            {ALL_MAPS.map((m) => {
              const mi = MAP_INFO[m];
              const locked = stars < mi.unlockStars;
              return (
                <button key={m} disabled={locked} onClick={() => setMap(m)} className={`relative rounded-2xl overflow-hidden text-left press ${map === m ? 'ring-2 ring-sky-500 ring-offset-2' : ''}`}>
                  <div className="h-20 bg-cover bg-center" style={{ backgroundImage: `url(${mi.thumb})`, backgroundColor: '#9fd3ff' }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 to-transparent" />
                  <div className="absolute left-2.5 bottom-1.5 text-white">
                    <div className="font-bold text-[13px]">{mi.name}</div>
                    <div className="text-[10px] opacity-80">{mi.sub}</div>
                  </div>
                  {locked && <div className="absolute inset-0 flex items-center justify-center gap-1 bg-slate-900/50 text-white font-bold text-xs"><Lock size={12} /> ⭐ {mi.unlockStars}개 필요</div>}
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-white rounded-3xl p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            {([['single', Gamepad2, '싱글플레이', singleSub], ['multi', Users, '멀티플레이', `코드로 최대 ${total}명`]] as const).map(([k, Icon, t, sub]) => (
              <button key={k} onClick={() => setPlay(k)} className={`rounded-2xl p-3 text-left press transition ${play === k ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-700'}`}>
                <Icon size={18} className={play === k ? 'text-sky-300' : 'text-slate-400'} />
                <div className="font-bold mt-1">{t}</div>
                <div className={`text-[11px] ${play === k ? 'text-white/60' : 'text-slate-400'}`}>{sub}</div>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <span className="text-[11px] font-semibold text-slate-400 w-14 pl-1">AI 난이도</span>
            {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
              <button key={d} onClick={() => setDifficulty(d)} className={`flex-1 h-9 rounded-full text-[13px] font-semibold ${difficulty === d ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{d === 'easy' ? '쉬움' : d === 'normal' ? '보통' : '어려움'}</button>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3 bg-slate-50 rounded-2xl p-2">
            <div className="w-10 h-10 rounded-full overflow-hidden" style={{ background: 'linear-gradient(160deg,#cfeaff,#7cc0f5)' }}><Portrait animal={save.animal} outfit={save.outfit} className="w-full h-full" /></div>
            <div className="text-xs"><div className="font-bold text-slate-800 text-sm">{save.name}</div><div className="text-slate-400">{ANIMAL_INFO[save.animal].name} · 메인에서 캐릭터 변경</div></div>
          </div>
        </section>
      </div>
      <div className="shrink-0 px-4 pt-2 screen-col wide:max-w-[520px]" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
        {play === 'single' ? (
          <button className="cta w-full h-14 short:h-12 rounded-2xl text-white font-extrabold text-[17px]" onClick={() => onStart(makeMatchCfg(mode, map, save.animal, save.name, difficulty, save.quality, 0, false, save.outfit, teamSize))}>
            {info.name} {oj ? TEAM_SIZE_INFO[teamSize].label : ''} 시작
          </button>
        ) : (
          <button className="w-full h-14 short:h-12 rounded-2xl text-white font-extrabold text-[17px] press bg-gradient-to-r from-sky-500 to-blue-600 shadow-lg shadow-sky-500/30" onClick={() => onMulti({ mode, map, difficulty, teamSize })}>
            대기방으로 · 방 만들기 / 코드 참가
          </button>
        )}
      </div>
    </div>
  );
}
