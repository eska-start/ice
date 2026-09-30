import { ALL_ANIMALS, STAGES, type Animal, type Outfit, type PcControl, type Quality } from './types';
import { COSTUMES, COSTUME_MAP, sanitizeOutfit } from './costumes';

export interface Records {
  games: number;
  wins: number;
  thaws: number;
  freezes: number;
  tags: number;
  hits: number;
  outs: number;
}

export interface SaveData {
  name: string;
  animal: Animal;
  coins: number;
  owned: Animal[];
  /** owned costume ids */
  costumes: string[];
  /** equipped costumes */
  outfit: Outfit;
  stars: Record<string, number>;
  sound: boolean;
  quality: Quality;
  /** PC 조작 방식 (모바일은 무시) */
  pcControl: PcControl;
  /** 사용한 쿠폰 번호 목록 (소문자) */
  usedCoupons: string[];
  records: Records;
}

const KEY = 'animal-village-icetag-v1';

export function defaultSave(): SaveData {
  const mobile = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700;
  return {
    name: '나',
    animal: 'dog',
    coins: 300,
    owned: ['dog', 'cat', 'rabbit', 'bear', 'penguin', 'tanuki'],
    costumes: [],
    outfit: {},
    stars: {},
    sound: true,
    quality: mobile ? 'low' : 'high',
    pcControl: 'keyboard',
    usedCoupons: [],
    records: { games: 0, wins: 0, thaws: 0, freezes: 0, tags: 0, hits: 0, outs: 0 },
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const d = JSON.parse(raw) as Partial<SaveData>;
    const def = defaultSave();
    // migrate retired frog hat → dino hat (keeps the purchase instead of deleting it)
    const rawCostumes = Array.isArray(d.costumes) ? [...d.costumes] : [];
    const fi = rawCostumes.indexOf('hat_frog');
    if (fi >= 0) rawCostumes[fi] = rawCostumes.includes('hat_dino') ? rawCostumes[fi] : 'hat_dino';
    const rawOutfit = { ...(d.outfit as Record<string, string> | undefined) };
    if (rawOutfit?.hat === 'hat_frog') rawOutfit.hat = 'hat_dino';
    const costumes = rawCostumes.filter((id) => typeof id === 'string' && COSTUME_MAP[id]);
    // only keep equipped items that are actually owned
    const eq = sanitizeOutfit(rawOutfit);
    const outfit: Outfit = {};
    for (const k of ['top', 'bottom', 'hat', 'glasses'] as const) if (eq[k] && costumes.includes(eq[k]!)) outfit[k] = eq[k];
    const usedCoupons = Array.isArray(d.usedCoupons) ? d.usedCoupons.filter((x): x is string => typeof x === 'string') : [];
    const pcControl: PcControl = d.pcControl === 'mouse' ? 'mouse' : 'keyboard';
    return { ...def, ...d, costumes, outfit, pcControl, usedCoupons, records: { ...def.records, ...(d.records ?? {}) }, stars: d.stars ?? {} };
  } catch {
    return defaultSave();
  }
}

export function persistSave(s: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function totalStars(s: SaveData) {
  return Object.values(s.stars).reduce((a, b) => a + b, 0);
}

export interface CouponResult {
  ok: boolean;
  message: string;
  save: SaveData;
}

const MAX_COUPON = 'maxmax';

/** 쿠폰 등록. maxmax → 모든 캐릭터·코스튬·맵(별 3개) 해금 + 코인 지급 */
export function redeemCoupon(s: SaveData, raw: string): CouponResult {
  const code = raw.trim().toLowerCase();
  if (!code) return { ok: false, message: '쿠폰 번호를 입력해주세요.', save: s };
  if (code !== MAX_COUPON) return { ok: false, message: '유효하지 않은 쿠폰 번호예요.', save: s };
  if (s.usedCoupons.includes(MAX_COUPON)) return { ok: false, message: '이미 사용한 쿠폰이에요.', save: s };
  const newAnimals = ALL_ANIMALS.filter((a) => !s.owned.includes(a)).length;
  const newCostumes = COSTUMES.filter((c) => !s.costumes.includes(c.id)).length;
  const stars: Record<string, number> = { ...s.stars };
  for (const st of STAGES) stars[st.id] = 3;
  return {
    ok: true,
    message: `🎉 올인원 해제! 캐릭터 ${newAnimals}종·코스튬 ${newCostumes}종 획득, 전 맵 오픈, +9999코인!`,
    save: {
      ...s,
      owned: [...ALL_ANIMALS],
      costumes: COSTUMES.map((c) => c.id),
      stars,
      coins: s.coins + 9999,
      usedCoupons: [...s.usedCoupons, MAX_COUPON],
    },
  };
}
