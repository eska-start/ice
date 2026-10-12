import type { ItemType } from '../game/types';
import { ICON_RECTS, ITEM_RECTS, type SpriteRect } from './ui-atlas';

const ICONS = {
  ice: 0, bag: 1, play: 2, friends: 3, paw: 4, shop: 5, book: 6, settings: 7,
  map: 8, coin: 9, star: 10, dash: 11, gift: 12, pause: 13, left: 14, right: 15,
} as const;
export type RasterIconName = keyof typeof ICONS;

function Sprite({ rect, source, atlasWidth, atlasHeight, size, className }: {
  rect: SpriteRect; source: string; atlasWidth: number; atlasHeight: number; size: number; className: string;
}) {
  const [x, y, width, height] = rect;
  const scale = size * 0.94 / Math.max(width, height);
  return <span aria-hidden="true" className={`raster-icon ${className}`} style={{ width: size, height: size }}>
    <span className="raster-icon-image" style={{
      width: width * scale, height: height * scale,
      backgroundImage: `url(${source})`,
      backgroundSize: `${atlasWidth * scale}px ${atlasHeight * scale}px`,
      backgroundPosition: `${-x * scale}px ${-y * scale}px`,
    }} />
  </span>;
}

/** Decorative sprites retain native button labels and never intercept input. */
export function RasterIcon({ name, size = 32, className = '' }: { name: RasterIconName; size?: number; className?: string }) {
  return <Sprite rect={ICON_RECTS[ICONS[name]]} source="/ui/icon-atlas.png" atlasWidth={768} atlasHeight={768} size={size} className={className} />;
}

const ITEM_INDEX: Record<ItemType, number> = { moto: 0, ufo: 1, banana: 2, missile: 3, jelly: 4 };
export function ItemIcon({ item, size = 28, className = '' }: { item: ItemType; size?: number; className?: string }) {
  return <Sprite rect={ITEM_RECTS[ITEM_INDEX[item]]} source="/ui/item-atlas.png" atlasWidth={960} atlasHeight={640} size={size} className={className} />;
}
