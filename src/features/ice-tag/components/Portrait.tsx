import { useEffect, useMemo, useReducer } from 'react';
import { costumeIcon, getPortraits, outfitPortrait, subscribePortraits } from '../game/portraits';
import { COSTUME_MAP } from '../game/costumes';
import { ANIMAL_INFO, type Animal, type Outfit } from '../game/types';

function usePortraitUpdates() {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => subscribePortraits(force), []);
}

/** Real 3D-rendered animal portrait (optionally wearing an outfit). Falls back to emoji without WebGL. */
export function Portrait({ animal, outfit, className = '', dim = false }: { animal: Animal; outfit?: Outfit | null; className?: string; dim?: boolean }) {
  usePortraitUpdates();
  const plain = useMemo(() => getPortraits()[animal], [animal]);
  const dressed = outfit && (outfit.top || outfit.bottom || outfit.hat || outfit.glasses) ? outfitPortrait(animal, outfit) : undefined;
  const src = dressed ?? plain;
  if (!src) return <span className={className}>{ANIMAL_INFO[animal].emoji}</span>;
  return <img src={src} alt={ANIMAL_INFO[animal].name} draggable={false} className={`${className} object-contain select-none pointer-events-none ${dim ? 'grayscale opacity-50' : ''}`} />;
}

/** 3D icon of a costume item, rendered on the player's own animal */
export function CostumeIcon({ animal, id, className = '', dim = false }: { animal: Animal; id: string; className?: string; dim?: boolean }) {
  usePortraitUpdates();
  const src = costumeIcon(animal, id);
  const def = COSTUME_MAP[id];
  if (!src) {
    return (
      <span className={`${className} flex items-center justify-center`}>
        <span className="text-3xl animate-pulse">{def?.emoji ?? '✨'}</span>
      </span>
    );
  }
  return <img src={src} alt={def?.name} draggable={false} className={`${className} object-contain select-none pointer-events-none ${dim ? 'grayscale opacity-60' : ''}`} />;
}
