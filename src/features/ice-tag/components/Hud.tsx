import type { HudState, Toast, PlayerStat } from '../game/types';
import { ANIMAL_INFO, STAGES, TEAM_SIZE_INFO } from '../game/types';
import { Portrait } from './Portrait';

function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtTime(t: number) { const s = Math.max(0, Math.ceil(t)); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; }

function Avatar({ p, tagger, police = false }: { p: PlayerStat; tagger: boolean; police?: boolean }) {
  const bg = tagger ? 'bg-red-500/90' : p.team === 'red' ? 'bg-red-400/90' : 'bg-blue-400/90';
  return (
    <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center text-xl border-2 ${p.isPlayer ? 'border-yellow-300' : 'border-white/80'} ${bg} ${p.status === 'out' ? 'grayscale opacity-40' : ''}`} title={p.name}>
      <Portrait animal={p.animal} className="absolute inset-0 w-full h-full rounded-[10px]" />
      {p.safe && <span className="absolute -top-2 -right-1 text-xs">🚩</span>}
      {!p.safe && p.status === 'frozen' && <span className="absolute -top-2 -right-1 text-xs">{police ? '🫥' : '❄️'}</span>}
      {!p.safe && p.status === 'out' && <span className="absolute -top-2 -right-1 text-xs">✖️</span>}
      {p.stunned && p.status === 'alive' && <span className="absolute -top-2 -right-1 text-xs">💫</span>}
      {tagger && <span className="absolute -bottom-2 text-[9px] font-black bg-red-600 text-white px-1 rounded">술래</span>}
      {police && p.role === 'tagger' && <span className="absolute -bottom-2 text-[9px] font-black bg-blue-600 text-white px-1 rounded">술래</span>}
    </div>
  );
}

export function TopBar({ hud, onPause }: { hud: HudState; onPause: () => void }) {
  const low = hud.phase === 'playing' && hud.time <= 10;
  const ice = hud.mode === 'icetag';
  const police = hud.mode === 'police';
  return (
    <div
      className="absolute top-0 left-0 right-0 z-30 pointer-events-none short:scale-[0.86] origin-top"
      style={{ paddingTop: 'max(8px, env(safe-area-inset-top))', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
    >
      {ice || police ? (
        <div className="flex items-start justify-center gap-2 px-2">
          <div className={`flex items-center gap-2 rounded-2xl px-3 py-1.5 shadow-xl border-[3px] border-white/90 ${low ? 'bg-red-500 animate-pulse' : 'bg-slate-900/75'}`}>
            <span className="text-yellow-300 font-black text-xs">{police ? '🫥 숨바꼭질' : `ROUND ${hud.round}/${hud.totalRounds}`}</span>
            <span className="text-white font-black text-2xl tabular-nums">⏱ {fmtTime(hud.time)}</span>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-center px-2 gap-2">
            <div className="flex items-stretch rounded-2xl overflow-hidden shadow-xl border-[3px] border-white/90">
              <div className="bg-gradient-to-b from-red-400 to-red-600 px-3 py-1 flex items-center gap-2">
                <span className="text-white font-black text-sm txt-outline-sm">RED</span>
                <span className="text-white font-black text-3xl txt-outline-sm tabular-nums">{pad(hud.red)}</span>
              </div>
              <div className="bg-slate-800/90 text-white font-black flex items-center px-1.5 text-xl">:</div>
              <div className="bg-gradient-to-b from-blue-400 to-blue-600 px-3 py-1 flex items-center gap-2">
                <span className="text-white font-black text-3xl txt-outline-sm tabular-nums">{pad(hud.blue)}</span>
                <span className="text-white font-black text-sm txt-outline-sm">BLUE</span>
              </div>
            </div>
          </div>
          <div className="flex justify-center mt-1.5">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1 shadow-lg border-2 border-white/80 ${low ? 'bg-red-500 animate-pulse' : hud.overtime ? 'bg-amber-500' : 'bg-slate-900/70'}`}>
              <span className="text-orange-200 font-black text-xs tabular-nums">{TEAM_SIZE_INFO[hud.teamSize]?.label ?? ''}</span>
              {hud.overtime && <span className="text-white font-black text-xs">연장전</span>}
              <span className="text-white font-black text-lg tabular-nums">⏱ {fmtTime(hud.time)}</span>
            </div>
          </div>
        </>
      )}
      {ice && (
        <div className="flex justify-center mt-1.5">
          <div className={`flex items-center gap-3 rounded-full px-3 py-1 border-2 border-white/80 shadow ${hud.role === 'tagger' ? 'bg-red-600/85' : 'bg-blue-600/85'}`}>
            <span className="text-white font-black text-xs">{hud.role === 'tagger' ? '👹 나는 술래' : `👹 술래: ${hud.taggerName}`}</span>
            <span className="text-white/90 font-bold text-xs">🏃 {hud.aliveCount} · ❄️ {hud.frozenCount} · ✖️ {hud.outCount}</span>
          </div>
        </div>
      )}
      {police && hud.hide && (
        <div className="flex flex-col items-center justify-center mt-1.5 gap-1">
          {hud.hide.prep > 0 ? (
            <div className="flex items-center gap-2 rounded-full px-4 py-1 border-2 border-white/90 shadow bg-gradient-to-r from-amber-500 to-orange-600 animate-pulse">
              <span className="text-white font-black text-xs">🙈 술래 눈 감는 중:</span>
              <span className="text-yellow-200 font-black text-sm tabular-nums">{hud.hide.prep}초 (사물로 변신해 숨으세요!)</span>
            </div>
          ) : (
            <div className={`flex items-center gap-3 rounded-full px-3 py-1 border-2 border-white/80 shadow ${hud.role === 'tagger' ? 'bg-blue-700/85' : 'bg-purple-700/85'}`}>
              <span className="text-white font-black text-xs">
                {hud.role === 'tagger' ? '👹 나는 술래' : hud.hide.meSafe ? '🚩 세이프 완료!' : hud.hide.meHidden ? '🫥 변신 숨김 중' : '🏃 들킴! 기지로 뛰어!'}
              </span>
              <span className="text-white/90 font-bold text-xs">
                🫥 {hud.hide.hidden} · 👀 {hud.hide.found} · 🚩 {hud.hide.safe} · ✖️ {hud.hide.caught}
              </span>
            </div>
          )}
        </div>
      )}
      {hud.stageGoal && (
        <div className="flex justify-center mt-1">
          <div className="bg-amber-400/90 text-slate-900 font-black text-[11px] rounded-full px-3 py-0.5 border-2 border-white/80">🎯 {hud.stageGoal} · {hud.stageProgress}</div>
        </div>
      )}
      {/* portrait: roster row under the score · landscape: roster sits in the top corners */}
      <div className="flex justify-between px-2 mt-1.5 landscape:absolute landscape:inset-x-0 landscape:mt-0 landscape:pl-3 landscape:pr-16" style={{ top: 'max(8px, env(safe-area-inset-top))' }}>
        {ice ? (
          <div className="flex gap-1 flex-wrap max-w-[75%] landscape:max-w-[28%]">
            {hud.players.map((p, i) => <Avatar key={i} p={p} tagger={p.role === 'tagger'} />)}
          </div>
        ) : (
          <>
            <div className="flex gap-1">{hud.players.filter((p) => p.team === 'red').map((p, i) => <Avatar key={i} p={p} tagger={false} police={police} />)}</div>
            <div className="flex gap-1 flex-row-reverse">{hud.players.filter((p) => p.team === 'blue').map((p, i) => <Avatar key={i} p={p} tagger={false} police={police} />)}</div>
          </>
        )}
      </div>
      <button className="pointer-events-auto absolute w-10 h-10 rounded-full bg-slate-900/60 border-2 border-white/80 text-white font-black text-lg flex items-center justify-center" style={{ top: 'max(8px, env(safe-area-inset-top))', right: 'calc(8px + env(safe-area-inset-right))' }} onPointerDown={(e) => { e.stopPropagation(); onPause(); }}>
        ❚❚
      </button>
    </div>
  );
}

export function EdgeMarkers({ hud }: { hud: HudState }) {
  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {hud.markers.map((m, i) => (
        <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}>
          <div className={`relative w-9 h-9 rounded-full flex items-center justify-center text-base border-2 border-white shadow ${m.kind === 'base' ? 'bg-emerald-500/95 animate-bounce' : m.kind === 'jail' ? 'bg-amber-500/95 animate-pulse' : m.kind === 'exit' ? 'bg-emerald-500/95 animate-pulse' : m.tagger ? 'bg-red-600/90 animate-pulse' : m.frozen ? 'bg-sky-300/90' : m.team === 'red' ? 'bg-red-500/85' : 'bg-blue-500/85'}`}>
            {m.kind === 'base' ? '🚩' : m.kind === 'jail' ? '🔒' : m.kind === 'exit' ? '🚪' : m.frozen ? '❄️' : m.tagger ? '👹' : ANIMAL_INFO[m.animal].emoji}
            <div className="absolute w-0 h-0" style={{ left: '50%', top: '50%', transform: `rotate(${m.angle}rad) translateX(22px) translateY(-6px)`, transformOrigin: '0 6px', borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: `9px solid ${m.kind === 'base' ? '#10b981' : m.kind === 'jail' ? '#f59e0b' : m.kind === 'exit' ? '#10b981' : m.tagger ? '#ef4444' : m.frozen ? '#7dd3fc' : m.team === 'red' ? '#ef4444' : '#3b82f6'}` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BagIndicator({ hud }: { hud: HudState }) {
  return null;
}

export function StatusBanner({ hud }: { hud: HudState }) {
  if (hud.phase !== 'playing') return null;
  let text = '', cls = '';
  if (hud.mode === 'icetag') {
    if (hud.status === 'out') { text = `👀 관전 중: ${hud.spectating ?? ''}`; cls = 'bg-slate-800/85'; }
    else if (hud.status === 'frozen') { text = '❄️ 얼음! 친구가 닿으면 풀려요'; cls = 'bg-sky-500/90'; }
    else if (hud.stunned) { text = '💫 휘청! 잠시 행동 불능'; cls = 'bg-red-500/85'; }
    else if (hud.role === 'runner' && hud.lastAlive && hud.frozenCount > 0) { text = '🔥 마지막 생존자! 얼음하면 술래 승리'; cls = 'bg-orange-500/90'; }
    else if (hud.role === 'runner' && hud.frozenCount > 0) { text = '✋ 얼음 동료에게 다가가면 자동 구조!'; cls = 'bg-yellow-400/95 text-slate-900'; }
    else if (hud.role === 'runner' && hud.danger) { text = '⚠️ 술래 접근! 도망치거나 얼음!'; cls = 'bg-red-500/90'; }
    else if (hud.role === 'tagger') { text = `🏃 도망팀 ${hud.aliveCount}명 남음 — 잡아라!`; cls = 'bg-red-600/70'; }
  } else if (hud.mode === 'police') {
    const hd = hud.hide;
    if (hud.status === 'out') { text = '✖️ 술래에게 잡혔어요! 탈락...'; cls = 'bg-red-600/85'; }
    else if (hd?.meSafe) { text = '🎉 기지 도착 완료! 세이프!'; cls = 'bg-emerald-500/90'; }
    else if (hd?.hint) { text = '🐤 못 찾겠다 꾀꼬리! 숨은 사물들이 들썩입니다!'; cls = 'bg-yellow-400 text-slate-900 animate-pulse'; }
    else if (hd && hd.prep > 0) {
      if (hud.role === 'tagger') { text = `🙈 눈 감고 12초 기다리는 중... (${hd.prep}초)`; cls = 'bg-blue-700/85'; }
      else { text = `🫥 지금 사물로 변신해 숨으세요! (${hd.prep}초)`; cls = 'bg-purple-600/90 animate-pulse'; }
    } else if (hud.stunned) { text = '💫 헛짚음 경직! 잠시 행동 불능'; cls = 'bg-amber-500/85 text-slate-900'; }
    else if (hud.role === 'tagger') { text = '🔍 사물에 다가가 "찾았다!"로 조사하세요 (헛짚으면 경직)'; cls = 'bg-blue-700/85'; }
    else if (hud.role === 'runner' && hd?.meHidden) { text = '🫥 변신 숨김 중! 가만히 있으면 들키지 않아요'; cls = 'bg-indigo-600/85'; }
    else if (hud.role === 'runner' && hud.danger) { text = '⚠️ 술래 접근! 기지로 전력 질주해 세이프하세요!'; cls = 'bg-red-500/95 animate-pulse'; }
    else { text = '🏃 기지로 달려가 세이프하거나 끝까지 숨으세요!'; cls = 'bg-purple-700/85'; }
  } else {
    if (hud.stunned) { text = '💫 휘청! 잠시 행동 불능'; cls = 'bg-red-500/85'; }

  }
  if (!text) return null;
  return (
    <div className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none top-[36%] landscape:top-[26%] max-w-[92vw]">
      <div className={`px-4 py-1.5 short:py-1 rounded-full font-black text-white text-sm short:text-xs border-2 border-white shadow-lg whitespace-nowrap truncate ${cls}`}>{text}</div>
    </div>
  );
}

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="absolute left-0 right-0 z-30 pointer-events-none flex flex-col items-center gap-1 top-[24%] landscape:top-[42%]">
      {toasts.map((t) => <div key={t.id} className="toast-up font-black text-lg short:text-base txt-outline whitespace-nowrap" style={{ color: t.color }}>{t.text}</div>)}
    </div>
  );
}

export function Countdown({ hud }: { hud: HudState }) {
  if (hud.countdown < 0) return null;
  const txt = hud.countdown === 0 ? (hud.mode === 'icetag' ? '얼음땡!' : '시작!') : String(hud.countdown);
  return (
    <div className="absolute inset-0 z-40 pointer-events-none flex flex-col items-center justify-center">
      {hud.phase === 'countdown' && (
        <div className="mb-3 short:mb-1 wood rounded-2xl px-5 py-2 short:py-1 pop-in text-center max-w-[92vw]">
          <div className="text-white font-black text-xl txt-outline-sm">{hud.mode === 'police' ? `🫥 숨바꼭질 · ${Math.round(hud.time)} SEC` : `ROUND ${hud.round}/${hud.totalRounds} · 90 SEC`}</div>
          {hud.mode === 'icetag' && (
            <div className={`mt-1 font-black text-sm ${hud.role === 'tagger' ? 'text-red-200' : 'text-sky-200'}`}>
              {hud.role === 'tagger' ? '👹 당신은 술래! 도망팀을 잡아라!' : `🏃 술래 ${hud.taggerName}에게서 도망쳐요! 위험하면 얼음!`}
            </div>
          )}
          {hud.mode === 'police' && (
            <div className={`mt-1 font-black text-sm ${hud.role === 'tagger' ? 'text-blue-200' : 'text-red-200'}`}>
              {hud.role === 'tagger' ? '👹 당신은 술래! 숨는 사람을 모두 찾아내세요!' : '🫥 당신은 숨는 사람! 술래를 피해 살아남으세요!'}
            </div>
          )}
          {hud.mode === 'ojaemi' && (
            <div className="mt-1 font-black text-sm text-orange-200">
              {TEAM_SIZE_INFO[hud.teamSize].label} · {hud.teamSize === 1 ? '🟠 1대1 맞대결! 먼저 맞히는 쪽이 이겨요' : '🟠 오재미를 주워 상대에게 던져요!'}
            </div>
          )}
        </div>
      )}
      <div key={txt} className={`pop-in font-black txt-outline leading-none ${hud.countdown === 0 ? 'text-yellow-300 text-6xl short:text-5xl' : 'text-white text-[120px] short:text-[84px] tall:text-[160px]'}`}>{txt}</div>
    </div>
  );
}

export function RoundEnd({ hud }: { hud: HudState }) {
  if (hud.phase !== 'roundEnd') return null;
  const r = hud.roundResults[hud.roundResults.length - 1];
  if (!r) return null;
  let title = '', sub = '', color = '';
  if (hud.mode === 'icetag') {
    if (r.winner === 'tagger') { title = '모두 잡았다!'; sub = r.reason === 'all_frozen' ? '남은 도망팀이 모두 얼음 상태! 술래 승리' : '도망팀 전원 탈락! 술래 승리'; color = 'from-red-400 to-red-600'; }
    else { title = '시간 초과!'; sub = `도망팀 ${r.survivors}명 생존! 도망팀 승리`; color = 'from-sky-400 to-blue-600'; }
  } else if (hud.mode === 'police') {
    if (r.winner === 'tagger') { title = '👹 술래 승리!'; sub = '숨어 있던 도망자들을 모두 찾았어요!'; color = 'from-blue-400 to-blue-700'; }
    else { title = '🎉 도망자 승리!'; sub = r.reason === 'all_safe' ? '도망자들이 기지 세이프에 성공했어요!' : '시간 종료까지 술래를 피해 살아남았어요!'; color = 'from-purple-400 to-indigo-600'; }
  } else {
    title = r.winner === 'red' ? 'RED 승리!' : 'BLUE 승리!';
    sub = r.reason === 'golden' ? '연장전 골든골!' : `${hud.red} : ${hud.blue}`;
    color = r.winner === 'red' ? 'from-red-400 to-red-600' : 'from-sky-400 to-blue-600';
  }
  return (
    <div className="absolute inset-x-0 z-40 flex flex-col items-center pointer-events-none top-[27%] short:top-[16%]">
      <div className={`pop-in rounded-3xl px-7 py-3 short:py-2 text-center bg-gradient-to-b ${color} border-4 border-white shadow-2xl max-w-[92vw]`}>
        <div className="text-white font-black text-4xl short:text-3xl txt-outline">{title}</div>
        <div className="text-white font-bold text-sm mt-1">{sub}</div>
        <div className={`mt-1 font-black text-sm ${r.playerWon ? 'text-yellow-200' : 'text-white/80'}`}>{r.playerWon ? '🎉 이번 라운드 승리!' : '😢 이번 라운드 패배'}</div>
      </div>
      {hud.mode === 'icetag' && (
        <div className="mt-2 flex gap-1.5">
          {Array.from({ length: hud.totalRounds }, (_, i) => {
            const rr = hud.roundResults[i];
            return <div key={i} className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-sm ${!rr ? 'bg-slate-500/60' : rr.playerWon ? 'bg-green-500' : 'bg-red-500'}`}>{rr ? (rr.playerWon ? '✓' : '✗') : i + 1}</div>;
          })}
        </div>
      )}
    </div>
  );
}

export function FinalResult({ hud, onRestart, onMenu, onNextStage, restartLabel }: { hud: HudState; onRestart: () => void; onMenu: () => void; onNextStage?: () => void; restartLabel?: string }) {
  if (hud.phase !== 'final' || !hud.final) return null;
  const f = hud.final;
  const ice = f.mode === 'icetag';
  const police = f.mode === 'police';
  const me = f.players.find((p) => p.isPlayer);
  const title = f.draw ? '무승부!' : f.playerWon ? '🏆 승리!' : '패배...';
  const grad = f.draw ? 'from-slate-400 to-slate-600' : f.playerWon ? 'from-amber-300 to-orange-500' : 'from-slate-500 to-slate-700';
  const stage = f.stage ? STAGES[f.stage - 1] : null;
  const pr = f.roundResults[0];
  const policeLine = pr?.winner === 'tagger' ? '👹 술래 승리 · 도망자 전원 발견' : '🎉 도망자 승리 · 기지 세이프 및 생존';
  return (
    // portrait: bottom sheet · landscape: side panel on the right so the 3D victory pose stays visible on the left
    <div
      className="absolute inset-x-0 bottom-0 z-50 flex justify-center p-3 landscape:inset-y-0 landscape:left-auto landscape:right-0 landscape:w-[min(460px,54vw)] landscape:items-center"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))', paddingRight: 'max(12px, env(safe-area-inset-right))' }}
    >
      <div className="pop-in w-full max-w-md rounded-3xl bg-white/95 border-4 border-sky-300 shadow-2xl overflow-hidden max-h-[78vh] landscape:max-h-[calc(100dvh-24px)] flex flex-col">
        <div className={`py-3 short:py-2 text-center bg-gradient-to-b ${grad} shrink-0`}>
          <div className="text-white font-black text-3xl txt-outline">{title}</div>
          <div className="text-white/95 font-bold text-sm">
            {ice ? `3라운드 중 ${me?.roundsWon ?? 0}승` : police ? policeLine : f.draw ? '막상막하!' : `${f.red > f.blue ? 'RED' : 'BLUE'} TEAM WIN · ${f.red} : ${f.blue}`}
          </div>
          <div className="mt-1 inline-flex items-center gap-2 bg-black/25 rounded-full px-3 py-0.5 text-white font-black text-sm">🪙 +{f.coins}{stage && <span>· {'★'.repeat(f.stars)}{'☆'.repeat(3 - f.stars)}</span>}</div>
        </div>
        <div className="px-3 py-2 overflow-auto">
          {stage && (
            <div className={`rounded-xl px-3 py-1.5 text-xs font-bold mb-2 ${f.stars > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
              🎯 {stage.title} · {stage.goal} — {f.stars > 0 ? '클리어!' : '실패... 다시 도전해요'}
            </div>
          )}
          {ice && (
            <div className="grid grid-cols-3 gap-1 text-center text-xs font-bold mb-2">
              {f.roundResults.map((r, i) => (
                <div key={i} className={`rounded-lg py-1 border ${r.playerWon ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                  <div>R{i + 1} {r.winner === 'tagger' ? '술래승' : '도망승'}</div>
                  <div>{r.playerWon ? '승리' : '패배'}</div>
                </div>
              ))}
            </div>
          )}
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left">선수</th>
                {ice ? (<><th>승</th><th>탈락</th><th>얼음</th><th>땡</th><th>잡음</th><th>생존</th><th>템</th><th>대시</th></>) : police ? (<><th>역할</th><th>발견</th><th>결과</th><th>대시</th><th>템</th></>) : (<><th>명중</th><th>피격</th><th>투척</th><th>회피</th><th>대시</th><th>템</th></>)}
              </tr>
            </thead>
            <tbody>
              {f.players.map((p, i) => (
                <tr key={i} className={`${p.isPlayer ? 'bg-yellow-100' : ''} font-bold`}>
                  <td className={`text-left py-0.5 ${ice ? 'text-slate-700' : p.team === 'red' ? 'text-red-500' : 'text-blue-500'}`}>{ANIMAL_INFO[p.animal].emoji} {p.name}</td>
                  {ice ? (<><td className="text-center">{p.roundsWon}</td><td className="text-center">{p.outs}</td><td className="text-center">{p.freezes}</td><td className="text-center">{p.thaws}</td><td className="text-center">{p.tags}</td><td className="text-center">{Math.round(p.survive)}s</td><td className="text-center">{p.items}</td><td className="text-center">{p.dashes}</td></>)
                    : police ? (<><td className="text-center">{p.role === 'tagger' ? '술래' : '도망자'}</td><td className="text-center">{p.tags}</td><td className="text-center">{p.role === 'tagger' ? '-' : p.safe ? '🚩세이프' : p.status === 'out' ? '✖️탈락' : '생존'}</td><td className="text-center">{p.dashes}</td><td className="text-center">{p.items}</td></>) : (<><td className="text-center">{p.hits}</td><td className="text-center">{p.hitsTaken}</td><td className="text-center">{p.throws}</td><td className="text-center">{p.dodges}</td><td className="text-center">{p.dashes}</td><td className="text-center">{p.items}</td></>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2 p-3 pt-1">
          <button className="flex-1 py-3 rounded-2xl font-black text-white bg-gradient-to-b from-sky-400 to-sky-600 border-b-4 border-sky-800 active:translate-y-0.5" onClick={onRestart}>{restartLabel ?? '다시 하기'}</button>
          {onNextStage && <button className="flex-1 py-3 rounded-2xl font-black text-white bg-gradient-to-b from-green-400 to-green-600 border-b-4 border-green-800 active:translate-y-0.5" onClick={onNextStage}>다음 스테이지 ▶</button>}
          <button className="flex-1 py-3 rounded-2xl font-black text-white bg-gradient-to-b from-amber-400 to-amber-600 border-b-4 border-amber-800 active:translate-y-0.5" onClick={onMenu}>메인 메뉴</button>
        </div>
      </div>
    </div>
  );
}
