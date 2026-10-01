import { useRef, useState } from 'react';
import type { HudState } from '../game/types';
import { ITEM_INFO } from '../game/types';
import { KEY_HINT, MOUSE_HINT, pcRowsFor } from '../game/keys';
import type { PcControl } from '../game/types';

/** floating 360° joystick; `ui` scales it for landscape phones / tablets */
export function Joystick({ onMove, disabled, ui = 1 }: { onMove: (x: number, y: number) => void; disabled?: boolean; ui?: number }) {
  const [base, setBase] = useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pid = useRef<number | null>(null);
  const R = 52 * ui;
  const ring = 140 * ui, idle = 130 * ui, nub = 64 * ui;

  const update = (cx: number, cy: number, b: { x: number; y: number }) => {
    let dx = cx - b.x, dy = cy - b.y;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    setKnob({ x: dx, y: dy });
    const nx = dx / R, ny = -dy / R;
    if (Math.hypot(nx, ny) < 0.12) onMove(0, 0);
    else onMove(nx, ny);
  };

  return (
    <div
      // left 45% of the screen, lower 55% (landscape) / 46% (portrait); never overlaps right action cluster
      className="absolute left-0 bottom-0 w-[45%] h-[46%] landscape:h-[62%] z-20"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        // virtual pad is touch/pen only — a mouse must never drive it (PC uses the keyboard)
        if (e.pointerType === 'mouse') return;
        if (pid.current !== null || disabled) return;
        pid.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        setBase({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setKnob({ x: 0, y: 0 });
      }}
      onPointerMove={(e) => {
        if (pid.current !== e.pointerId || !base) return;
        const rect = e.currentTarget.getBoundingClientRect();
        update(e.clientX - rect.left, e.clientY - rect.top, base);
      }}
      onPointerUp={(e) => {
        if (pid.current !== e.pointerId) return;
        pid.current = null;
        setBase(null);
        setKnob({ x: 0, y: 0 });
        onMove(0, 0);
      }}
      onPointerCancel={() => { pid.current = null; setBase(null); onMove(0, 0); }}
    >
      {base ? (
        <div className="absolute pointer-events-none" style={{ left: base.x - ring / 2, top: base.y - ring / 2 }}>
          <div className="rounded-full bg-white/25 border-4 border-white/70 shadow-lg backdrop-blur-sm" style={{ width: ring, height: ring }} />
          <div className="absolute rounded-full bg-gradient-to-b from-white to-sky-200 border-4 border-sky-500 shadow-xl" style={{ width: nub, height: nub, left: ring / 2 - nub / 2 + knob.x, top: ring / 2 - nub / 2 + knob.y }} />
        </div>
      ) : (
        <div
          className={`absolute pointer-events-none ${disabled ? 'opacity-30' : 'opacity-80'}`}
          style={{ left: `calc(${24 * ui}px + env(safe-area-inset-left))`, bottom: `calc(${28 * ui}px + env(safe-area-inset-bottom))` }}
        >
          <div className="rounded-full bg-white/20 border-4 border-white/60 flex items-center justify-center" style={{ width: idle, height: idle }}>
            <div className="rounded-full bg-white/80 border-4 border-sky-400 flex items-center justify-center text-sky-600" style={{ width: 56 * ui, height: 56 * ui, fontSize: 20 * ui }}>✥</div>
          </div>
        </div>
      )}
    </div>
  );
}

interface BtnProps {
  label: string; icon: string; onPress: () => void; disabled?: boolean; size: number; color: string; style: React.CSSProperties; glow?: boolean; cooldown?: number; badge?: string; keyHint?: string;
}

/** small key label shown UNDER a control on PC (e.g. "Shift / L") */
function KeyTag({ text }: { text: string }) {
  return (
    <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap pointer-events-none bg-slate-900/80 text-white text-[10px] font-bold rounded-md px-1.5 leading-[16px] border border-white/40 shadow z-10">
      {text}
    </span>
  );
}

function ActionBtn({ label, icon, onPress, disabled, size, color, style, glow, cooldown = 0, badge, keyHint }: BtnProps) {
  const [down, setDown] = useState(false);
  return (
    <button
      tabIndex={-1}
      className={`absolute rounded-full flex flex-col items-center justify-center select-none transition-transform ${glow ? 'pulse-ring' : ''} ${keyHint ? 'cursor-default' : ''}`}
      style={{
        ...style,
        width: size, height: size,
        background: disabled ? 'linear-gradient(180deg,#9aa7b5,#6f7c8a)' : color,
        border: `${Math.max(3, size * 0.04)}px solid rgba(255,255,255,0.9)`,
        boxShadow: down ? '0 1px 0 rgba(0,0,0,0.35)' : `0 ${Math.round(size * 0.05)}px 0 rgba(0,0,0,0.3)`,
        transform: `translateY(${down ? 4 : 0}px) scale(${glow ? 1.06 : 1})`,
        opacity: disabled ? 0.7 : 1, touchAction: 'none',
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // touch/pen only — mouse clicks on the virtual pad do nothing (PC plays with the keyboard)
        if (e.pointerType === 'mouse') return;
        setDown(true);
        if (!disabled) onPress();
      }}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {cooldown > 0 && <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: `conic-gradient(rgba(20,30,50,0.6) ${cooldown * 360}deg, transparent 0deg)` }} />}
      <span className="relative leading-none" style={{ fontSize: size * 0.36 }}>{icon}</span>
      <span className="relative font-black text-white txt-outline-sm leading-none mt-0.5" style={{ fontSize: Math.max(10, size * 0.15) }}>{label}</span>
      {badge && <span className="absolute -top-1 -right-1 bg-yellow-300 text-slate-800 text-[11px] font-black rounded-full px-1.5 border-2 border-white">{badge}</span>}
      {keyHint && <KeyTag text={keyHint} />}
    </button>
  );
}

/*
 * 버튼 슬롯 정의
 * 1) 모바일 터치 환경 (keys = false):
 *    - 엄지손가락 아크 궤적에 최적화된 콤팩트 아케이드 클러스터.
 *    - 우측 가장자리에 쏙 들어가 너비가 170px을 넘지 않으므로
 *      화면 정중앙(오재미 인디케이터)이나 좌측 조이스틱(45%)과 절대 겹치지 않음!
 * 2) PC 환경 (keys = true):
 *    - 버튼 아래 키 라벨(KeyTag)이 잘리지 않고 여유 있게 표시되는 레이아웃.
 */
const SLOT_TOUCH = {
  main: { r: 16, b: 20, size: 88 },
  dash: { r: 98, b: 96, size: 66 },
  item: { r: 20, b: 122, size: 66 },
} as const;

const SLOT_PC = {
  main: { r: 24, b: 36, size: 88 },
  dash: { r: 128, b: 126, size: 66 },
  item: { r: 128, b: 26, size: 66 },
} as const;

/**
 * Right-hand action cluster. Layout is computed in "design units" and multiplied by `ui`,
 * so it fits a landscape phone (short height) as well as a big tablet.
 */
export function ActionButtons({ hud, onPrimary, onDash, onItem, onSpectate, ui = 1, keys = false, control = 'keyboard' }: {
  hud: HudState; onPrimary: () => void; onDash: () => void; onItem: () => void; onSpectate: () => void; ui?: number; keys?: boolean; control?: PcControl;
}) {
  const playing = hud.phase === 'playing';
  if (hud.mode === 'icetag' && hud.status === 'out') {
    return (
      <div className="absolute z-30" style={{ right: `calc(${keys ? 24 : 16}px + env(safe-area-inset-right))`, bottom: `calc(${keys ? 40 : 24}px + env(safe-area-inset-bottom))` }}>
        <button
          tabIndex={-1}
          className={`relative px-4 py-3 rounded-2xl bg-slate-900/70 border-2 border-white/80 text-white font-black text-sm ${keys ? 'cursor-default' : ''}`}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (e.pointerType === 'mouse') return; // PC: use the key shown below
            onSpectate();
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          👀 다음 관전 ▶
          {keys && <KeyTag text={KEY_HINT.spectate} />}
        </button>
      </div>
    );
  }
  if (hud.status === 'frozen') return null;
  const st = hud.stunned || !playing;
  const isTagger = hud.mode === 'icetag' && hud.role === 'tagger';
  const isRunner = hud.mode === 'icetag' && hud.role === 'runner';
  const isHideRunner = hud.mode === 'police' && hud.role === 'runner';
  const u = (v: number) => v * ui;

  // 모바일과 PC 환경에 맞춘 슬롯 & 패널 크기
  const slot = keys ? SLOT_PC : SLOT_TOUCH;
  const panelW = keys ? 260 : 180;
  const panelH = keys ? 250 : 204;
  const pos = (s: { r: number; b: number }): React.CSSProperties => ({ right: u(s.r), bottom: u(s.b) });
  const H = control === 'mouse' ? MOUSE_HINT : KEY_HINT;
  const hint = (t: string) => (keys ? t : undefined);

  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={{ right: 'env(safe-area-inset-right)', bottom: 'env(safe-area-inset-bottom)', width: u(panelW), height: u(panelH) }}
    >
      <div className="relative w-full h-full pointer-events-auto">
        {/* MAIN slot: 던지기 (오재미) · 얼음! (도망자) · 안내 (술래 — 몸이 닿으면 잡아요) */}
        {hud.mode === 'ojaemi' && (
          <ActionBtn label="던지기" icon="🎯" size={u(slot.main.size)} style={pos(slot.main)} color="linear-gradient(180deg,#ffa94d,#e8622a)" disabled={st || !hud.hasBag || hud.throwing} onPress={onPrimary} badge={hud.hasBag ? '1' : '0'} keyHint={hint(H.primary)} />
        )}
        {isRunner && (
          <ActionBtn label="얼음!" icon="❄️" size={u(slot.main.size)} style={pos(slot.main)} color="linear-gradient(180deg,#7fd0ff,#2378d8)" disabled={st || !hud.canFreeze} cooldown={hud.freezeCd} glow={hud.danger && hud.canFreeze && !hud.lastAlive} onPress={onPrimary} keyHint={hint(H.primary)} />
        )}
        {isHideRunner && (
          <ActionBtn
            label={hud.hideTransformed ? '변신 해제' : '숨기'}
            icon={hud.hideTransformed ? '🐾' : '🫥'}
            size={u(slot.main.size)}
            style={pos(slot.main)}
            color="linear-gradient(180deg,#b99cff,#7657d9)"
            disabled={st || !hud.hideCanTransform}
            glow={!hud.hideTransformed && hud.hideCanTransform}
            onPress={onPrimary}
            keyHint={hint(H.primary)}
          />
        )}
        {isTagger && (
          <div
            className="absolute rounded-full flex flex-col items-center justify-center text-center pointer-events-none border-[3px] border-dashed border-white/60 bg-slate-900/35"
            style={{ ...pos(slot.main), width: u(slot.main.size), height: u(slot.main.size) }}
          >
            <span className="leading-none" style={{ fontSize: u(28) }}>👹</span>
            <span className="font-black text-white txt-outline-sm leading-tight mt-0.5" style={{ fontSize: Math.max(10, u(11)) }}>닿으면<br />잡기</span>
          </div>
        )}
        {hud.mode === 'police' && (
          <div
            className="absolute rounded-full flex flex-col items-center justify-center text-center pointer-events-none border-[3px] border-dashed border-white/60 bg-slate-900/35"
            style={{ ...pos(slot.main), width: u(slot.main.size), height: u(slot.main.size) }}
          >
            <span className="leading-none" style={{ fontSize: u(28) }}>{hud.role === 'tagger' ? '🚓' : '🏃'}</span>
            <span className="font-black text-white txt-outline-sm leading-tight mt-0.5" style={{ fontSize: Math.max(10, u(11)) }}>{hud.role === 'tagger' ? <>닿으면<br />체포</> : <>탈출구로<br />도망!</>}</span>
          </div>
        )}
        {/* 땡은 버튼 없이 닿으면 자동 구조. 대시 & 아이템은 모든 모드 / 역할에서 일관된 위치 */}
        <ActionBtn label="대시" icon="💨" size={u(slot.dash.size)} style={pos(slot.dash)} color="linear-gradient(180deg,#7ee8a8,#23a861)" disabled={st || hud.dashCd > 0} cooldown={hud.dashCd} onPress={onDash} keyHint={hint(H.dash)} />
        <ActionBtn
          label={hud.item ? ITEM_INFO[hud.item].name : '아이템'}
          icon={hud.item ? ITEM_INFO[hud.item].emoji : '🎁'}
          size={u(slot.item.size)}
          style={pos(slot.item)}
          color="linear-gradient(180deg,#ff9ee0,#d8479f)"
          disabled={st || !hud.item}
          onPress={onItem}
          keyHint={hint(H.item)}
        />
      </div>
    </div>
  );
}

/** desktop: small keyboard legend in the bottom-left instead of the joystick */
export function KeyLegend({ hud, control = 'keyboard' }: { hud: HudState; control?: PcControl }) {
  const rows = pcRowsFor(hud.mode, hud.role, hud.status, control);
  return (
    <div className="absolute z-20 left-4 bottom-4 pointer-events-none glass-dark rounded-2xl px-3 py-2 text-white" style={{ marginLeft: 'env(safe-area-inset-left)' }}>
      {rows.map(({ keys, action }) => (
        <div key={action} className="flex items-center gap-2 text-[11px] leading-5">
          <span className="min-w-[46px] text-center font-bold bg-white/15 rounded px-1.5 border border-white/25 whitespace-nowrap">{keys}</span>
          <span className="text-white/85 whitespace-nowrap">{action}</span>
        </div>
      ))}
    </div>
  );
}
