import type { Mode, PStatus, Role } from './types';

/**
 * PC 조작 체계 (단일 기준점 — 게임 입력·버튼 힌트·도움말이 모두 이 파일을 참조)
 *
 * 설계 원칙:
 * - 왼손은 WASD에 고정, 자주 쓰는 액션은 손을 떼지 않고 누르는 키로 배치
 * - Space(엄지)=주액션 · Shift(새끼)=대시 · E(검지)=아이템은 PC 표준 관례 유지
 * - 땡은 Q(구하기의 '구' 발음 연상) — 이동 중에도 약지로 즉시 누를 수 있음
 * - 마우스: 좌클릭=주액션 · 우클릭=대시 (PC 액션 게임 관례)
 * - 기존 J/K/L/I/N 키는 대체 키로 계속 지원 (방향키+오른손 플레이용)
 */

export type GameAction = 'primary' | 'thaw' | 'dash' | 'item' | 'spectate' | 'pause';

/** e.key.toLowerCase() 기준 */
const BINDINGS: Record<GameAction, string[]> = {
  // 각 액션 = [주 키, 보조 키] — 버튼 아래 표시(KEY_HINT)와 정확히 일치
  primary: [' ', 'j'], // 얼음! / 던지기
  thaw: ['q', 'k'], // 땡!
  dash: ['shift', 'l'], // Shift 좌/우 모두 'shift'로 들어옴
  item: ['e', 'i'],
  spectate: ['tab', 'n'], // 탈락 후 관전 전환
  pause: ['escape', 'p'],
};

const KEY_TO_ACTION = new Map<string, GameAction>();
for (const [action, keys] of Object.entries(BINDINGS) as [GameAction, string[]][]) {
  for (const k of keys) KEY_TO_ACTION.set(k, action);
}

/** 키 → 액션 (이동키·미지정 키는 null) */
export function actionForKey(key: string): GameAction | null {
  return KEY_TO_ACTION.get(key.toLowerCase()) ?? null;
}

/** 기본 브라우저 동작(스크롤·포커스 이동)을 막아야 하는 키 */
export function isSystemKey(key: string): boolean {
  const k = key.toLowerCase();
  return k === ' ' || k === 'tab' || k.startsWith('arrow');
}

/** 마우스 버튼 → 액션 (0=좌, 1=휠, 2=우) */
export function actionForMouseButton(button: number): GameAction | null {
  if (button === 0) return 'primary';
  if (button === 2) return 'dash';
  if (button === 1) return 'item';
  return null;
}

/**
 * 버튼 아래 작은 키 표시 (주 키 / 보조 키).
 * 모든 모드·역할에서 같은 액션 = 같은 키 = 같은 버튼 위치.
 */
export const KEY_HINT: Record<GameAction, string> = {
  primary: 'Space / J',
  thaw: 'Q / K',
  dash: 'Shift / L',
  item: 'E / I',
  spectate: 'Tab / N',
  pause: 'Esc / P',
};

export interface KeyRow {
  keys: string;
  action: string;
}

/** 인게임 좌하단 키 설명 + 일시정지 메뉴 공용 (버튼 아래 표시와 같은 키, 같은 순서) */
export function pcRowsFor(mode: Mode, role: Role, status: PStatus): KeyRow[] {
  const rows: KeyRow[] = [{ keys: 'WASD / 방향키', action: '이동' }];
  if (mode === 'icetag' && status === 'out') {
    rows.push({ keys: KEY_HINT.spectate, action: '관전 전환' });
  } else {
    if (mode === 'ojaemi') rows.push({ keys: KEY_HINT.primary, action: '던지기' });
    else if (role === 'runner') rows.push({ keys: KEY_HINT.primary, action: '얼음!' }, { keys: KEY_HINT.thaw, action: '땡! (구하기)' });
    // 대시 · 아이템은 모든 모드 · 역할에서 동일
    rows.push({ keys: KEY_HINT.dash, action: '대시' }, { keys: KEY_HINT.item, action: '아이템' });
  }
  rows.push({ keys: KEY_HINT.pause, action: '메뉴' });
  return rows;
}


