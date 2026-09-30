import { useEffect, useReducer, useRef, useState } from 'react';
import { Game } from '../game/Game';
import type { Sfx } from '../game/sfx';
import type { FinalSummary, GameConfig, HudState, PcControl, Toast } from '../game/types';
import { MAP_INFO, MODE_INFO } from '../game/types';
import type { NetRoom } from '../net/net';
import { ActionButtons, Joystick, KeyLegend } from './Controls';
import { pcRowsFor } from '../game/keys';
import { useViewport } from '../hooks/useViewport';
import { BagIndicator, Countdown, EdgeMarkers, FinalResult, RoundEnd, StatusBanner, Toasts, TopBar } from './Hud';

export function GameScreen({ cfg, sfx, room, onMenu, onRestart, onFinal, onNextStage, pcControl = 'keyboard', onControlChange }: {
  cfg: GameConfig; sfx: Sfx; room?: NetRoom | null; onMenu: () => void; onRestart: () => void; onFinal: (f: FinalSummary) => void; onNextStage?: () => void;
  pcControl?: PcControl; onControlChange?: (m: PcControl) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(sfx.muted);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const toastId = useRef(0);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;
  const online = !!cfg.net && !!room;
  const vp = useViewport();

  useEffect(() => (room ? room.subscribe(force) : undefined), [room]);

  useEffect(() => {
    if (!mountRef.current) return;
    const net = online ? room! : null;
    const g = new Game(mountRef.current, cfg, {
      onHud: (h) => setHud(h),
      onToast: (text, color) => {
        const id = ++toastId.current;
        setToasts((t) => [...t.slice(-3), { id, text, color }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1400);
      },
      onFinal: (f) => finalRef.current(f),
      onPauseKey: () => {
        const g = gameRef.current;
        if (!g || g.phase === 'final') return;
        setPaused((p) => !p);
      },
      onNet: net
        ? (msg) => {
            if (!net.isHost) {
              // movement goes over the unordered fast channel; discrete actions stay reliable & ordered
              if (msg.t === 'in') net.sendFast(msg);
              else net.sendHost(msg);
            } else if (msg.t === 'toast') net.sendToSeat(msg.to, msg);
            else if (msg.t === 'snap') net.broadcastFast(msg);
            else net.broadcast(msg);
          }
        : undefined,
    }, sfx);
    gameRef.current = g;
    if (net) {
      net.onGameMsg = (from, msg) => {
        if (!net.isHost) { g.applyNet(msg); return; }
        const seat = msg.t === 'leave' ? msg.seat : net.seatOf(from);
        if (seat < 0) return;
        if (msg.t === 'in') g.remoteInput(seat, msg.x, msg.z, msg.px, msg.pz, msg.f, msg.ep);
        else if (msg.t === 'act') g.remoteAction(seat, msg.a, msg.x, msg.z);
        else if (msg.t === 'leave') g.dropRemote(seat);
      };
    }
    return () => {
      if (net) net.onGameMsg = null;
      g.dispose();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, sfx]);

  // online matches keep running while the menu is open
  useEffect(() => { if (gameRef.current) gameRef.current.paused = paused && !online; }, [paused, online]);
  // PC 조작 방식 변경을 게임에 즉시 반영 (게임 재생성 없음)
  useEffect(() => { gameRef.current?.setControlMode(pcControl); }, [pcControl]);
  const g = () => gameRef.current;
  const lost = online && room && room.status !== 'open' && hud?.phase !== 'final';

  return (
    <div className="absolute inset-0 overflow-hidden bg-sky-200">
      <div ref={mountRef} className="absolute inset-0" />
      {!hud && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-sky-900/60 text-white">
          <div className="text-4xl float-y">{MAP_INFO[cfg.map].emoji}</div>
          <div className="font-bold mt-2">{MODE_INFO[cfg.mode].name} · {MAP_INFO[cfg.map].name}</div>
          <div className="text-xs opacity-80 mt-1">{cfg.net === 'client' ? '방장과 동기화 중...' : '3D 마을 준비 중...'}</div>
        </div>
      )}
      {hud && (
        <>
          <EdgeMarkers hud={hud} />
          {hud.phase !== 'final' && <TopBar hud={hud} onPause={() => setPaused(true)} />}
          {online && hud.phase !== 'final' && (
            <div className="absolute left-2 z-30 pointer-events-none" style={{ top: 'calc(max(8px, env(safe-area-inset-top)) + 4px)' }}>
              <span className="glass-dark rounded-full px-2 py-0.5 text-[10px] font-bold text-white flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />ONLINE {room!.state.code}</span>
            </div>
          )}
          <StatusBanner hud={hud} />
          <Toasts toasts={toasts} />
          <Countdown hud={hud} />
          <RoundEnd hud={hud} />
          {hud.phase !== 'final' && (
            <>
              {vp.touch ? <Joystick onMove={(x, y) => g()?.setJoystick(x, y)} disabled={hud.status !== 'alive'} ui={vp.ui} /> : <KeyLegend hud={hud} control={pcControl} />}
              <BagIndicator hud={hud} />
              <ActionButtons hud={hud} ui={vp.touch ? vp.ui : 0.82} keys={!vp.touch} control={pcControl} onPrimary={() => g()?.pressPrimary()} onDash={() => g()?.pressDash()} onItem={() => g()?.pressItem()} onSpectate={() => g()?.pressSpectateNext()} />
            </>
          )}
          <FinalResult
            hud={hud}
            onRestart={onRestart}
            restartLabel={online ? '대기방으로' : undefined}
            onMenu={onMenu}
            onNextStage={hud.final && hud.final.stage && hud.final.stars > 0 && hud.final.stage < 4 ? onNextStage : undefined}
          />
        </>
      )}
      {paused && (
        <div className="absolute inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-6 short:p-3">
          <div className="pop-in w-full max-w-xs short:max-w-md bg-white rounded-3xl p-5 short:p-4 text-center shadow-2xl">
            <div className="text-slate-900 font-bold text-2xl short:text-xl mb-1">{online ? '메뉴' : '일시정지'}</div>
            {online && <div className="text-xs text-slate-400 mb-3 short:mb-1">온라인 게임은 멈추지 않아요</div>}
            {!vp.touch && onControlChange && (
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-2xl mb-2">
                {(['keyboard', 'mouse'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => onControlChange(m)}
                    className={`h-10 rounded-xl text-[13px] font-bold transition ${pcControl === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    {m === 'keyboard' ? '⌨️ 키보드' : '🖱️ 마우스'}
                  </button>
                ))}
              </div>
            )}
            {/* landscape phones: 2-column buttons so the panel fits the short screen */}
            <div className="flex flex-col gap-2 mt-3 short:mt-2 short:grid short:grid-cols-2">
              <button className="h-12 rounded-2xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500" onClick={() => setPaused(false)}>계속하기</button>
              {!online && <button className="h-12 rounded-2xl font-bold text-white bg-gradient-to-r from-sky-500 to-blue-500" onClick={onRestart}>처음부터</button>}
              <button className="h-12 rounded-2xl font-bold text-slate-700 bg-slate-100" onClick={() => { sfx.setMuted(!muted); setMuted(!muted); }}>{muted ? '🔇 소리 켜기' : '🔊 소리 끄기'}</button>
              <button className="h-12 rounded-2xl font-bold text-rose-500 bg-rose-50" onClick={onMenu}>{online ? '방 나가기' : '메인 메뉴'}</button>
            </div>
            {!vp.touch && hud && (
              <div className="mt-3 pt-3 border-t border-slate-100 text-left">
                <div className="text-[11px] font-bold text-slate-400 mb-1.5 px-1">{pcControl === 'mouse' ? '🖱️ 마우스 조작법' : '⌨️ 키보드 조작법'} {online ? '' : '(Esc로 닫기)'}</div>
                <div className="grid grid-cols-2 gap-x-3">
                  {pcRowsFor(hud.mode, hud.role, hud.status, pcControl).map(({ keys, action }) => (
                    <div key={action} className="flex items-center gap-1.5 text-[11px] leading-6">
                      <span className="font-bold bg-slate-100 rounded px-1.5 border border-slate-200 whitespace-nowrap">{keys}</span>
                      <span className="text-slate-500 whitespace-nowrap">{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {lost && (
        <div className="absolute inset-0 z-[70] bg-slate-900/70 flex items-center justify-center p-6">
          <div className="pop-in w-full max-w-xs bg-white rounded-3xl p-6 text-center shadow-2xl">
            <div className="text-4xl">📡</div>
            <div className="text-slate-900 font-bold text-lg mt-2">연결이 끊겼어요</div>
            <div className="text-slate-500 text-sm mt-1">{room!.error || '방장과의 연결이 종료되었어요.'}</div>
            <button className="mt-4 w-full h-12 rounded-2xl bg-slate-900 text-white font-bold" onClick={onMenu}>메인 메뉴로</button>
          </div>
        </div>
      )}
    </div>
  );
}
