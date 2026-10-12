import type { CSSProperties } from 'react';
import type { ItemType } from '../game/types';

const ICONS = {
  ice: 0, bag: 1, play: 2, friends: 3, paw: 4, shop: 5, book: 6, settings: 7,
  map: 8, coin: 9, star: 10, dash: 11, gift: 12, pause: 13, left: 14, right: 15,
} as const;
export type RasterIconName = keyof typeof ICONS;

/** Decorative sprites retain native button labels and never intercept input. */
export function RasterIcon({ name, size = 32, className = '' }: { name: RasterIconName; size?: number; className?: string }) {
  const index = ICONS[name];
  const style: CSSProperties = {
    width: size, height: size,
    backgroundImage: 'url(/ui/icon-atlas.png)', backgroundSize: '400% 400%',
    backgroundPosition: `${(index % 4) * 100 / 3}% ${Math.floor(index / 4) * 100 / 3}%`,
  };
  return <span aria-hidden="true" className={`raster-icon ${className}`} style={style} />;
}

const ITEM_INDEX: Record<ItemType, number> = { moto: 0, ufo: 1, banana: 2, missile: 3, jelly: 4 };
export function ItemIcon({ item, size = 28, className = '' }: { item: ItemType; size?: number; className?: string }) {
  const index = ITEM_INDEX[item];
  return <span aria-hidden="true" className={`raster-icon ${className}`} style={{
    width: size * 2.25, height: size,
    backgroundImage: 'url(/ui/item-atlas.png)', backgroundSize: '200% 300%',
    backgroundPosition: `${(index % 2) * 100}% ${Math.floor(index / 2) * 50}%`,
  }} />;
}
