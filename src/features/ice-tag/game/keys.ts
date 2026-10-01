import type { Mode, PcControl, PStatus, Role } from './types';

/** Keyboard bindings shared by gameplay, button labels and the help screen. */
export type GameAction = 'primary' | 'dash' | 'item' | 'spectate' | 'pause';

const BINDINGS: Record<GameAction, string[]> = {
  primary: [' ', 'j'], // freeze / throw
  dash: ['shift', 'l'],
  item: ['e', 'i'],
  spectate: ['tab', 'n'],
  pause: ['escape', 'p'],
};

const KEY_TO_ACTION = new Map<string, GameAction>();
for (const [action, keys] of Object.entries(BINDINGS) as [GameAction, string[]][]) {
  for (const key of keys) KEY_TO_ACTION.set(key, action);
}

export function actionForKey(key: string): GameAction | null {
  return KEY_TO_ACTION.get(key.toLowerCase()) ?? null;
}

export function isSystemKey(key: string) {
  const k = key.toLowerCase();
  return k === ' ' || k === 'tab' || k.startsWith('arrow');
}

export const KEY_HINT: Record<GameAction, string> = {
  primary: 'Space / J',
  dash: 'Shift / L',
  item: 'E / I',
  spectate: 'Tab / N',
  pause: 'Esc / P',
};

export const MOUSE_HINT: Record<GameAction, string> = {
  // In mouse mode left click is reserved for click-to-move; Space/J still fires the main action.
  primary: 'Space / J',
  dash: '우클릭 / Shift',
  item: 'E / 휠클릭',
  spectate: 'Tab / N',
  pause: 'Esc / P',
};

export interface KeyRow { keys: string; action: string }

export function pcRowsFor(mode: Mode, role: Role, status: PStatus, control: PcControl = 'keyboard'): KeyRow[] {
  const mouse = control === 'mouse';
  const rows: KeyRow[] = mouse
    ? [{ keys: '마우스 포인터', action: '바라보기 · 조준' }, { keys: '좌클릭', action: '클릭한 곳으로 이동' }]
    : [{ keys: 'WASD / 방향키', action: '이동' }];

  if (mode === 'icetag' && status === 'out') {
    rows.push({ keys: KEY_HINT.spectate, action: '관전 전환' });
  } else {
    if (mode === 'ojaemi') rows.push({ keys: mouse ? 'Space / J' : KEY_HINT.primary, action: '던지기' });
    else if (mode === 'icetag' && role === 'runner') rows.push({ keys: KEY_HINT.primary, action: '얼음!' });
    if (mouse) rows.push({ keys: '우클릭 / Shift·L', action: '커서 방향 대시' });
    rows.push({ keys: mouse ? '휠클릭 / E' : KEY_HINT.item, action: '아이템' });
    if (mode === 'icetag' && role === 'runner') rows.push({ keys: '접촉', action: '얼음 동료 자동 구조' });
    if (mode === 'police') rows.push(role === 'tagger' ? { keys: '접촉 / Space·J', action: '체포 · 사이렌 플래시' } : { keys: '접근 / Space·J', action: '연막탄 · 감옥 해킹' });
  }
  rows.push({ keys: KEY_HINT.pause, action: '메뉴' });
  return rows;
}