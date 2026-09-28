export type Team = 'red' | 'blue';
export type Role = 'tagger' | 'runner';
export type Mode = 'icetag' | 'ojaemi';
export type MapId = 'plaza' | 'beach' | 'snow' | 'night';
export type Animal = 'dog' | 'cat' | 'rabbit' | 'bear' | 'fox' | 'penguin' | 'deer' | 'hamster' | 'tanuki' | 'panda';
export type ItemType = 'moto' | 'ufo' | 'banana' | 'missile' | 'jelly';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Quality = 'low' | 'high';
export type PStatus = 'alive' | 'frozen' | 'out';
export type Phase = 'countdown' | 'playing' | 'roundEnd' | 'final';

export const ITEM_INFO: Record<ItemType, { name: string; emoji: string; desc: string }> = {
  moto: { name: '오토바이', emoji: '🏍️', desc: '3초 동안 이동속도 대폭 증가' },
  ufo: { name: 'UFO', emoji: '🛸', desc: '상대 1명을 랜덤으로 공중에 붙잡음' },
  banana: { name: '바나나', emoji: '🍌', desc: '내 자리에 껍질 설치, 밟은 상대는 미끄러짐' },
  missile: { name: '미사일', emoji: '🚀', desc: '랜덤 상대를 추적해 잠시 행동 불능' },
  jelly: { name: '젤리슬라임', emoji: '🟢', desc: '가장 가까운 상대에게 달라붙어 느리게 함' },
};

export const ANIMAL_INFO: Record<Animal, { name: string; emoji: string; price: number }> = {
  dog: { name: '강아지', emoji: '🐶', price: 0 },
  cat: { name: '고양이', emoji: '🐱', price: 0 },
  rabbit: { name: '토끼', emoji: '🐰', price: 0 },
  bear: { name: '곰', emoji: '🐻', price: 0 },
  fox: { name: '여우', emoji: '🦊', price: 250 },
  penguin: { name: '펭귄', emoji: '🐧', price: 0 },
  deer: { name: '사슴', emoji: '🦌', price: 300 },
  hamster: { name: '햄스터', emoji: '🐹', price: 250 },
  tanuki: { name: '너구리', emoji: '🦝', price: 0 },
  panda: { name: '판다', emoji: '🐼', price: 400 },
};

export const ALL_ANIMALS: Animal[] = ['dog', 'cat', 'rabbit', 'bear', 'fox', 'penguin', 'deer', 'hamster', 'tanuki', 'panda'];

export const AI_NAMES: Record<Animal, string> = {
  dog: '멍멍이', cat: '냥냥이', rabbit: '토순이', bear: '곰돌이', fox: '여우비',
  penguin: '펭돌이', deer: '사슴이', hamster: '햄찌', tanuki: '너굴이', panda: '판다롱',
};

export const MAP_INFO: Record<MapId, { name: string; sub: string; thumb: string; unlockStars: number; emoji: string }> = {
  plaza: { name: '동물마을 광장', sub: '분수와 꽃밭이 있는 아늑한 마을', thumb: 'images/map-plaza.jpg', unlockStars: 0, emoji: '🏡' },
  beach: { name: '해변마을', sub: '야자수와 부두가 있는 바닷가', thumb: 'images/map-beach.jpg', unlockStars: 1, emoji: '🏖️' },
  snow: { name: '눈 덮인 숲', sub: '눈사람과 얼음 연못의 겨울 숲', thumb: 'images/map-snow.jpg', unlockStars: 3, emoji: '⛄' },
  night: { name: '밤의 섬', sub: '달빛과 등불이 비추는 작은 항구', thumb: 'images/map-night.jpg', unlockStars: 6, emoji: '🌙' },
};
export const ALL_MAPS: MapId[] = ['plaza', 'beach', 'snow', 'night'];

export const MODE_INFO: Record<Mode, { name: string; sub: string; desc: string; color: string }> = {
  icetag: { name: '얼음땡', sub: '1 VS 5', desc: '술래에게서 도망치고, 위험하면 얼음! 친구가 땡으로 구해줘요', color: '#3b9dff' },
  ojaemi: { name: '오재미', sub: '1:1 · 2:2 · 3:3', desc: '오재미를 주워 던지고 피하는 대결! 1대1 · 2대2 · 3대3', color: '#ff7a3b' },
};

export interface StageDef {
  id: number;
  map: MapId;
  title: string;
  goal: string;
  desc: string;
  kind: 'survive' | 'rescue' | 'noloss' | 'items';
  difficulty: Difficulty;
}

export const STAGES: StageDef[] = [
  { id: 1, map: 'plaza', title: '동물마을 광장', goal: '90초 생존', desc: '술래에게 잡히지 않고 라운드를 버티세요. 살아남은 라운드 수만큼 별을 받아요.', kind: 'survive', difficulty: 'easy' },
  { id: 2, map: 'beach', title: '해변마을', goal: '친구 3명 이상 구조', desc: '얼음이 된 친구에게 다가가 땡! 3명 ★ · 5명 ★★ · 7명 ★★★', kind: 'rescue', difficulty: 'easy' },
  { id: 3, map: 'snow', title: '눈 덮인 숲', goal: '모든 AI가 탈락하지 않도록 유지', desc: '라운드 동안 도망팀 아무도 탈락하지 않고 버티면 성공! 성공 라운드 수만큼 별.', kind: 'noloss', difficulty: 'normal' },
  { id: 4, map: 'night', title: '밤의 섬', goal: '아이템을 활용하여 생존', desc: '아이템을 2개 이상 사용하고 살아남으세요. 생존 라운드 수만큼 별.', kind: 'items', difficulty: 'normal' },
];

/** players per team in 오재미 (1 VS 1 · 2 VS 2 · 3 VS 3) */
export type TeamSize = 1 | 2 | 3;
export const TEAM_SIZES: TeamSize[] = [1, 2, 3];
export const TEAM_SIZE_INFO: Record<TeamSize, { label: string; short: string; desc: string }> = {
  1: { label: '1 VS 1', short: '1:1', desc: '실력으로 붙는 맞대결' },
  2: { label: '2 VS 2', short: '2:2', desc: '짝꿍과 함께하는 협동전' },
  3: { label: '3 VS 3', short: '3:3', desc: '북적북적 팀 대결' },
};
/** total players in a match */
export const matchSize = (mode: Mode, teamSize: TeamSize = 3) => (mode === 'ojaemi' ? teamSize * 2 : 6);

export type CostumeSlot = 'top' | 'bottom' | 'hat' | 'glasses';
/** equipped costume ids per slot (null / undefined = none) */
export interface Outfit {
  top?: string | null;
  bottom?: string | null;
  hat?: string | null;
  glasses?: string | null;
}

export interface SlotConfig {
  team: Team;
  animal: Animal;
  name: string;
  human: boolean;
  outfit?: Outfit;
}

export interface GameConfig {
  mode: Mode;
  map: MapId;
  slots: SlotConfig[];
  playerIndex: number;
  difficulty: Difficulty;
  stage?: number;
  demo?: boolean;
  /** main-menu background: slow panoramic camera through the village */
  cinematic?: boolean;
  quality?: Quality;
  multiplayer?: boolean;
  /** online match: host simulates, clients render snapshots */
  net?: 'host' | 'client';
  /** 오재미 team size (slots: red 0..n-1, blue n..2n-1) */
  teamSize?: TeamSize;
}

export interface Stats {
  roundsWon: number;
  outs: number;
  freezes: number;
  thaws: number;
  tags: number;
  survive: number;
  items: number;
  dashes: number;
  hits: number;
  hitsTaken: number;
  throws: number;
  dodges: number;
}

export interface PlayerStat extends Stats {
  name: string;
  animal: Animal;
  team: Team;
  role: Role;
  isPlayer: boolean;
  status: PStatus;
  hasBag: boolean;
  stunned: boolean;
}

export interface RoundResult {
  winner: 'tagger' | 'runner' | Team;
  reason: string;
  playerWon: boolean;
  goalMet: boolean;
  survivors: number;
}

export interface Marker {
  x: number;
  y: number;
  angle: number;
  team: Team;
  animal: Animal;
  frozen: boolean;
  tagger: boolean;
}

export interface FinalSummary {
  mode: Mode;
  playerWon: boolean;
  draw: boolean;
  coins: number;
  stars: number;
  stage: number | null;
  roundResults: RoundResult[];
  players: PlayerStat[];
  red: number;
  blue: number;
  goalText: string;
}

export interface HudState {
  mode: Mode;
  teamSize: TeamSize;
  phase: Phase;
  round: number;
  totalRounds: number;
  time: number;
  countdown: number;
  overtime: boolean;
  role: Role;
  status: PStatus;
  team: Team;
  canFreeze: boolean;
  freezeCd: number;
  canThaw: boolean;
  thawName: string;
  hasBag: boolean;
  throwing: boolean;
  dashCd: number;
  item: ItemType | null;
  stunned: boolean;
  danger: boolean;
  lastAlive: boolean;
  spectating: string | null;
  taggerName: string;
  aliveCount: number;
  frozenCount: number;
  outCount: number;
  red: number;
  blue: number;
  roundResults: RoundResult[];
  roundWinner: string | null;
  roundReason: string;
  players: PlayerStat[];
  markers: Marker[];
  stageGoal: string | null;
  stageProgress: string | null;
  final: FinalSummary | null;
}

export interface Toast {
  id: number;
  text: string;
  color: string;
}
