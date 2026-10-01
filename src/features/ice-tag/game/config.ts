import { AI_NAMES, ALL_ANIMALS, STAGES, matchSize } from './types';
import type { Animal, Difficulty, GameConfig, MapId, Mode, Outfit, Quality, SlotConfig, Team, TeamSize } from './types';
import { randomOutfit } from './costumes';

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/**
 * Slot layout: 얼음땡 = 6 players, 오재미 = 2×teamSize players
 * (red seats 0..n-1, blue seats n..2n-1 — slot index == seat index).
 */
export function buildSlots(mode: Mode, animal: Animal, name: string, seat = 0, outfit?: Outfit, teamSize: TeamSize = 3): { slots: SlotConfig[]; playerIndex: number } {
  const total = matchSize(mode, teamSize);
  const me = Math.min(seat, total - 1);
  const pool = shuffle(ALL_ANIMALS.filter((a) => a !== animal));
  const slots: SlotConfig[] = [];
  for (let i = 0; i < total; i++) {
    const team: Team = mode === 'ojaemi' ? (i < teamSize ? 'red' : 'blue') : 'blue';
    if (i === me) slots.push({ team, animal, name, human: true, outfit });
    else {
      const a = pool[(i > me ? i - 1 : i) % pool.length];
      // AI villagers dress up too
      slots.push({ team, animal: a, name: AI_NAMES[a], human: false, outfit: randomOutfit(0.45) });
    }
  }
  return { slots, playerIndex: me };
}

export function makeDemoCfg(mode: Mode, map: MapId, opts: { cinematic?: boolean; quality?: Quality } = {}): GameConfig {
  const { slots } = buildSlots(mode, 'dog', '데모', 0, randomOutfit(0.6));
  return { mode, map, slots, playerIndex: 0, difficulty: 'normal', demo: true, quality: opts.quality ?? 'low', cinematic: opts.cinematic, teamSize: 3 };
}

export function makeMatchCfg(mode: Mode, map: MapId, animal: Animal, name: string, difficulty: Difficulty, quality: Quality, seat = 0, multiplayer = false, outfit?: Outfit, teamSize: TeamSize = 3): GameConfig {
  const n: TeamSize = mode === 'ojaemi' || mode === 'police' ? teamSize : 3;
  const { slots, playerIndex } = buildSlots(mode, animal, name, seat, outfit, n);
  return { mode, map, slots, playerIndex, difficulty, quality, multiplayer, teamSize: n };
}

export function makeStageCfg(stageId: number, animal: Animal, name: string, quality: Quality, outfit?: Outfit): GameConfig {
  const st = STAGES[stageId - 1];
  const { slots, playerIndex } = buildSlots('icetag', animal, name, 0, outfit);
  return { mode: 'icetag', map: st.map, slots, playerIndex, difficulty: st.difficulty, quality, stage: stageId };
}
