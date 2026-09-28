import type { Animal, Outfit, Quality } from './types';
import { COSTUME_MAP, sanitizeOutfit } from './costumes';

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
    return { ...def, ...d, costumes, outfit, records: { ...def.records, ...(d.records ?? {}) }, stars: d.stars ?? {} };
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
