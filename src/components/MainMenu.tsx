import { useMemo, useState } from 'react';
import { BookOpen, Check, ChevronRight, Crown, Footprints, Glasses, Lock, Map as MapIcon, PawPrint, Play, Settings, Shirt, ShoppingBag, Snowflake, Sparkles, Star, X } from 'lucide-react';
import { Preview3D } from './Preview3D';
import { CharacterViewer } from './CharacterViewer';
import { CostumeIcon, Portrait } from './Portrait';
import { makeDemoCfg } from '../game/config';
import type { SaveData } from '../game/save';
import { totalStars } from '../game/save';
import { COSTUMES, COSTUME_MAP, SLOT_INFO, costumesOf } from '../game/costumes';
import { KEY_HINT } from '../game/keys';
import { ALL_ANIMALS, ANIMAL_INFO, ITEM_INFO, STAGES } from '../game/types';
import type { Animal, CostumeSlot, Outfit } from '../game/types';

type Modal = null | 'char' | 'shop' | 'wardrobe' | 'collection' | 'settings' | 'howto';

// ------------------------------------------------------------ small parts
function Coin({ size = 18 }: { size?: number }) {
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{ width: size, height: size, background: 'radial-gradient(circle at 35% 30%, #fff6c2 0%, #ffd23f 45%, #f0a414 100%)', boxShadow: 'inset 0 0 0 1.5px rgba(210,130,10,0.8)' }}
    />
  );
}

function Avatar({ animal, size = 44, outfit }: { animal: Animal; size?: number; outfit?: Outfit }) {
  return (
    <div className="rounded-full overflow-hidden shrink-0 ring-2 ring-white shadow-md" style={{ width: size, height: size, background: 'linear-gradient(160deg,#cfeaff 0%,#7cc0f5 100%)' }}>
      <Portrait animal={animal} outfit={outfit} className="w-full h-full scale-110" />
    </div>
  );
}

// ------------------------------------------------------------ logo
export function Logo({ small }: { small?: boolean }) {
  return (
    <div className="relative mx-auto text-center select-none">
      <div className="text-white/90 font-semibold tracking-[0.42em] pl-[0.42em]" style={{ fontSize: small ? 10 : 11, textShadow: '0 1px 6px rgba(10,50,100,0.45)' }}>
        ANIMAL VILLAGE
      </div>
      <div className="relative inline-block">
        <h1 className={`font-display title-ice leading-[0.95] ${small ? 'text-[52px]' : 'text-[clamp(64px,20vw,92px)] short:text-[56px] tiny:text-[46px] wide:text-[104px]'}`}>얼음땡</h1>
        <Snowflake className="absolute -right-6 top-1 text-white drop-shadow-[0_2px_6px_rgba(20,80,160,0.5)]" size={small ? 18 : 24} strokeWidth={2.4} />
      </div>
      {!small && (
        <div className="mt-1 inline-flex items-center gap-2 text-white text-[13px] font-medium tiny:hidden" style={{ textShadow: '0 1px 6px rgba(10,50,100,0.5)' }}>
          <span className="h-px w-6 bg-white/70" />
          함께 뛰어놀아요
          <span className="h-px w-6 bg-white/70" />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ modal sheet
/**
 * `fill`: the panel takes a fixed height and the body becomes a non-scrolling flex column,
 * so children can pin a header/preview and scroll only their list (used by the shop).
 */
function ModalFrame({ title, onClose, children, fill = false }: { title: string; onClose: () => void; children: React.ReactNode; fill?: boolean }) {
  return (
    // portrait phone: bottom sheet · landscape / tablet / desktop: centered wide dialog (content goes 2-column)
    <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-end justify-center landscape:items-center landscape:p-3 wide:items-center wide:p-6" onClick={onClose}>
      <div
        className={`modal-panel pop-in w-full max-w-md max-h-[92%] flex flex-col bg-white rounded-t-[28px] shadow-2xl overflow-hidden landscape:max-w-4xl landscape:rounded-[28px] landscape:max-h-full wide:max-w-4xl wide:rounded-[28px] wide:max-h-[88%] ${fill ? 'h-[92%] landscape:h-full wide:h-[88%]' : ''}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 landscape:hidden"><div className="sheet-handle" /></div>
        <div className="flex items-center justify-between px-5 pt-2 pb-3 short:pb-2 landscape:pt-3 shrink-0">
          <div className="text-slate-900 text-lg font-bold">{title}</div>
          <button className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center press" onClick={onClose}><X size={16} strokeWidth={2.5} /></button>
        </div>
        {fill ? (
          <div className="flex-1 min-h-0 flex flex-col px-4 pb-3">{children}</div>
        ) : (
          <div className="px-4 pb-4 overflow-auto">{children}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Shop body layout: preview (+ action) stays fixed, only the item list scrolls.
 * Portrait: preview on top, list below. Landscape / desktop: preview left, list right.
 */
function PinnedSplit({ preview, list, listRef }: { preview: React.ReactNode; list: React.ReactNode; listRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 landscape:flex-row landscape:gap-5 wide:flex-row wide:gap-5">
      <div className="shrink-0 landscape:w-[44%] landscape:flex landscape:flex-col landscape:min-h-0 wide:w-[44%] wide:flex wide:flex-col wide:min-h-0">{preview}</div>
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1 pb-2 scroll-soft"
        style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
      >
        {list}
      </div>
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled, tone = 'green' }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: 'green' | 'amber' }) {
  const bg = disabled ? 'bg-slate-200 text-slate-400' : tone === 'green' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/30';
  return <button disabled={disabled} onClick={onClick} className={`w-full h-12 rounded-2xl font-bold text-[15px] press flex items-center justify-center gap-2 ${bg}`}>{children}</button>;
}

export function CharacterModal({ save, setSave, onClose }: { save: SaveData; setSave: (s: SaveData) => void; onClose: () => void }) {
  const [name, setName] = useState(save.name);
  const [preview, setPreview] = useState<Animal>(save.animal);
  const owned = save.owned.includes(preview);
  const selected = save.animal === preview;
  const price = ANIMAL_INFO[preview].price;
  const nm = name.trim() || '나';
  const close = () => { setSave({ ...save, name: nm }); onClose(); };

  return (
    <ModalFrame title="캐릭터" onClose={close}>
      <div className="split">
      <div className="split-left">
      <div className="split-viewer relative h-[32vh] min-h-[210px] max-h-[320px] rounded-3xl overflow-hidden" style={{ background: 'radial-gradient(120% 90% at 50% 20%, #ffffff 0%, #e6f4ff 45%, #cfe9df 100%)' }}>
        <CharacterViewer animal={preview} outfit={save.outfit} className="absolute inset-0" locked={!owned} />
        <div className="absolute top-3 left-3">
          <div className="text-slate-900 text-xl font-bold leading-none">{ANIMAL_INFO[preview].name}</div>
          <div className="text-slate-500 text-xs font-medium mt-1">{owned ? (selected ? '사용 중' : '보유') : '잠김'}</div>
        </div>
        <div className="absolute top-3 right-3 text-[11px] font-medium text-slate-500 bg-white/80 rounded-full px-2.5 py-1">드래그해서 회전</div>
      </div>

      <div className="mt-3">
        {owned ? (
          <PrimaryBtn disabled={selected} onClick={() => setSave({ ...save, animal: preview, name: nm })}>{selected ? '선택됨' : '이 캐릭터로 선택'}</PrimaryBtn>
        ) : (
          <PrimaryBtn tone="amber" disabled={save.coins < price} onClick={() => setSave({ ...save, coins: save.coins - price, owned: [...save.owned, preview], animal: preview, name: nm })}>
            <Coin size={16} /> {price} 코인으로 해금 {save.coins < price && <span className="text-xs font-medium opacity-80">· 보유 {save.coins}</span>}
          </PrimaryBtn>
        )}
      </div>
      </div>

      <div className="split-right">
      <div className="grid grid-cols-5 gap-2 mt-3">
        {ALL_ANIMALS.map((a) => {
          const own = save.owned.includes(a);
          const sel = save.animal === a;
          const pv = preview === a;
          return (
            <button
              key={a}
              onClick={() => setPreview(a)}
              className={`relative aspect-square rounded-2xl overflow-hidden press transition ${pv ? 'ring-2 ring-sky-500 ring-offset-2' : ''}`}
              style={{ background: own ? 'linear-gradient(180deg,#f2f8ff 0%,#dbeeff 100%)' : '#f1f3f6' }}
            >
              <Portrait animal={a} dim={!own} className="absolute inset-0 w-full h-full" />
              {!own && <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-800/70 text-white flex items-center justify-center"><Lock size={11} strokeWidth={2.6} /></span>}
              {sel && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-white bg-sky-500 rounded-full px-1.5">사용중</span>}
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-3 mt-4 bg-slate-50 rounded-2xl px-4 h-12">
        <span className="text-[13px] font-semibold text-slate-500 w-12">닉네임</span>
        <input value={name} maxLength={6} onChange={(e) => setName(e.target.value)} className="flex-1 bg-transparent text-[15px] font-semibold text-slate-900 outline-none" />
      </label>
      <div className="text-xs text-slate-400 mt-2 text-center">모든 캐릭터의 능력치는 동일해요</div>
      </div>
      </div>
    </ModalFrame>
  );
}

/** shop tabs: costumes first, then characters */
export type ShopTab = 'animal' | CostumeSlot;
const SHOP_TABS: { id: ShopTab; label: string; Icon: typeof PawPrint }[] = [
  { id: 'top', label: '상의', Icon: Shirt },
  { id: 'bottom', label: '하의', Icon: Footprints },
  { id: 'hat', label: '모자', Icon: Crown },
  { id: 'glasses', label: '안경', Icon: Glasses },
  { id: 'animal', label: '캐릭터', Icon: PawPrint },
];

function AnimalShop({ save, setSave }: { save: SaveData; setSave: (s: SaveData) => void }) {
  const locked = ALL_ANIMALS.filter((a) => !save.owned.includes(a));
  const [pv, setPv] = useState<Animal | null>(locked[0] ?? null);
  const buy = (a: Animal) => {
    const price = ANIMAL_INFO[a].price;
    if (save.coins < price) return;
    setSave({ ...save, coins: save.coins - price, owned: [...save.owned, a], animal: a });
    setPv(locked.filter((x) => x !== a)[0] ?? null);
  };
  if (locked.length === 0 || !pv) {
    return <div className="flex-1 flex items-center justify-center text-center text-sm text-slate-500 py-8">모든 캐릭터를 모았어요 🎉</div>;
  }
  return (
    <PinnedSplit
      preview={
        <div className="relative h-[26vh] min-h-[160px] max-h-[260px] landscape:h-auto landscape:max-h-none landscape:flex-1 landscape:min-h-[140px] wide:h-auto wide:max-h-none wide:flex-1 rounded-3xl overflow-hidden" style={{ background: 'radial-gradient(120% 90% at 50% 20%, #ffffff 0%, #fff4e0 55%, #ffe3c2 100%)' }}>
          <CharacterViewer animal={pv} outfit={save.outfit} className="absolute inset-0" />
          <div className="absolute top-3 left-3 text-slate-900 font-bold">{ANIMAL_INFO[pv].name} <span className="text-[10px] font-bold text-white bg-orange-500 rounded-full px-1.5 py-0.5 align-middle">NEW</span></div>
        </div>
      }
      list={
      <div className="flex flex-col gap-2">
        {locked.map((a) => (
          <div key={a} className={`flex items-center gap-3 rounded-2xl p-2 pr-3 transition ${pv === a ? 'bg-sky-50 ring-1 ring-sky-200' : 'bg-slate-50'}`} onClick={() => setPv(a)}>
            <Avatar animal={a} size={48} />
            <div className="flex-1">
              <div className="text-slate-900 font-bold">{ANIMAL_INFO[a].name}</div>
              <div className="text-xs text-slate-400">탭해서 미리보기</div>
            </div>
            <button
              disabled={save.coins < ANIMAL_INFO[a].price}
              onClick={(e) => { e.stopPropagation(); buy(a); }}
              className={`h-9 px-3 rounded-xl text-sm font-bold flex items-center gap-1.5 press ${save.coins >= ANIMAL_INFO[a].price ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-400'}`}
            >
              <Coin size={14} />{ANIMAL_INFO[a].price}
            </button>
          </div>
        ))}
      </div>
      }
    />
  );
}

function CostumeShop({ slot, save, setSave }: { slot: CostumeSlot; save: SaveData; setSave: (s: SaveData) => void }) {
  const items = costumesOf(slot);
  const equipped = save.outfit[slot] ?? null;
  const [sel, setSel] = useState<string | null>(equipped ?? items[0].id);
  const def = sel ? COSTUME_MAP[sel] : null;
  const owned = !!sel && save.costumes.includes(sel);
  const isOn = sel === equipped;
  const tryOn: Outfit = { ...save.outfit, [slot]: sel };

  const equip = (id: string | null) => setSave({ ...save, outfit: { ...save.outfit, [slot]: id } });
  const buy = () => {
    if (!def || owned || save.coins < def.price) return;
    setSave({ ...save, coins: save.coins - def.price, costumes: [...save.costumes, def.id], outfit: { ...save.outfit, [slot]: def.id } });
  };
  const ownedCount = items.filter((i) => save.costumes.includes(i.id)).length;

  return (
    <PinnedSplit
      preview={
      <>
      {/* live try-on — stays fixed while the item grid scrolls */}
      <div className="relative h-[27vh] min-h-[170px] max-h-[290px] short:h-[36vh] short:min-h-[120px] landscape:h-auto landscape:max-h-none landscape:flex-1 landscape:min-h-[140px] wide:h-auto wide:max-h-none wide:flex-1 rounded-3xl overflow-hidden" style={{ background: 'radial-gradient(120% 90% at 50% 20%, #ffffff 0%, #eef6ff 48%, #dcefe2 100%)' }}>
        <CharacterViewer animal={save.animal} outfit={tryOn} className="absolute inset-0" />
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none">
          <div>
            <div className="text-slate-900 text-lg font-bold leading-none">{def ? def.name : `${SLOT_INFO[slot].name} 없음`}</div>
            <div className="text-slate-500 text-xs font-medium mt-1">{def ? def.desc : '기본 팀 복장'}</div>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 bg-white/85 rounded-full px-2.5 py-1 shrink-0">입어보기</span>
        </div>
        {def && owned && <div className="absolute bottom-3 left-3 text-[11px] font-bold text-emerald-600 bg-white/90 rounded-full px-2 py-0.5">보유 중</div>}
      </div>

      {/* action */}
      <div className="mt-3 shrink-0">
        {!def ? (
          <PrimaryBtn disabled={equipped === null} onClick={() => equip(null)}>{equipped === null ? '기본 복장 착용 중' : '벗기 · 기본 복장으로'}</PrimaryBtn>
        ) : !owned ? (
          <PrimaryBtn tone="amber" disabled={save.coins < def.price} onClick={buy}>
            <Coin size={16} /> {def.price} 코인으로 구매하고 입기 {save.coins < def.price && <span className="text-xs font-medium opacity-80">· 보유 {save.coins}</span>}
          </PrimaryBtn>
        ) : isOn ? (
          <PrimaryBtn onClick={() => equip(null)}>✓ 착용 중 · 탭해서 벗기</PrimaryBtn>
        ) : (
          <PrimaryBtn onClick={() => equip(def.id)}>입기</PrimaryBtn>
        )}
      </div>
      </>
      }
      list={
      <>
      {/* grid (scrolls) — its title row sticks to the top of the scroll area */}
      <div className="sticky top-0 z-10 bg-white flex items-baseline justify-between pt-1 pb-2 px-0.5">
        <span className="text-slate-900 font-bold text-[15px]">{SLOT_INFO[slot].name}</span>
        <span className="text-xs font-semibold text-slate-400">{ownedCount}/{items.length} 보유</span>
      </div>
      {/* p-1 keeps the selection ring (ring-offset) from being clipped by the scroll container */}
      <div className="grid grid-cols-4 landscape:grid-cols-4 min-[1100px]:grid-cols-5 gap-2 p-1">
        <button
          onClick={() => setSel(null)}
          className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 press bg-slate-50 ${sel === null ? 'ring-2 ring-sky-500 ring-offset-2' : ''}`}
        >
          <span className="w-9 h-9 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-300"><X size={16} strokeWidth={2.5} /></span>
          <span className="text-[10px] font-semibold text-slate-500">없음</span>
          {equipped === null && <span className="absolute top-1 left-1 text-[9px] font-bold text-white bg-sky-500 rounded-full px-1.5">착용</span>}
        </button>
        {items.map((it) => {
          const own = save.costumes.includes(it.id);
          const on = equipped === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setSel(it.id)}
              className={`relative aspect-square rounded-2xl overflow-hidden press ${sel === it.id ? 'ring-2 ring-sky-500 ring-offset-2' : ''}`}
              style={{ background: own ? 'linear-gradient(180deg,#f3f9ff 0%,#dcecff 100%)' : 'linear-gradient(180deg,#fffaf0 0%,#ffeccc 100%)' }}
            >
              <CostumeIcon animal={save.animal} id={it.id} className="absolute inset-0 w-full h-full" />
              <span className="absolute left-0 right-0 bottom-0 bg-gradient-to-t from-white/95 via-white/80 to-transparent pt-3 pb-1 text-[10px] font-bold text-slate-700 truncate px-1">
                {it.name}
              </span>
              {on ? (
                <span className="absolute top-1 left-1 text-[9px] font-bold text-white bg-sky-500 rounded-full px-1.5">착용</span>
              ) : own ? (
                <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center"><Check size={10} strokeWidth={3.5} /></span>
              ) : (
                <span className="absolute top-1 right-1 flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-white/90 rounded-full pl-0.5 pr-1.5"><Coin size={10} />{it.price}</span>
              )}
            </button>
          );
        })}
      </div>
      </>
      }
    />
  );
}

function ShopModal({ save, setSave, onClose, initialTab = 'top' }: { save: SaveData; setSave: (s: SaveData) => void; onClose: () => void; initialTab?: ShopTab }) {
  const [tab, setTab] = useState<ShopTab>(initialTab);
  return (
    <ModalFrame title="상점" onClose={onClose} fill>
      {/* fixed header: coins + tabs (never scroll away) */}
      <div className="shrink-0 flex items-center gap-2 mb-3 short:mb-2">
        <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 rounded-2xl flex-1 min-w-0">
          {SHOP_TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} title={label} aria-label={label} className={`h-10 short:h-9 rounded-xl flex items-center justify-center gap-1.5 text-[13px] font-bold transition ${tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              <Icon size={15} strokeWidth={2.3} className="shrink-0" /><span className="truncate hidden min-[420px]:inline">{label}</span>
            </button>
          ))}
        </div>
        <div className="shrink-0 flex items-center gap-1.5 bg-amber-50 rounded-2xl px-3 h-12 short:h-11 text-amber-600 text-base font-bold tabular-nums" title="보유 코인">
          <Coin />{save.coins}
        </div>
      </div>
      {tab === 'animal' ? <AnimalShop save={save} setSave={setSave} /> : <CostumeShop key={tab} slot={tab} save={save} setSave={setSave} />}
    </ModalFrame>
  );
}

function CollectionModal({ save, onClose }: { save: SaveData; onClose: () => void }) {
  const r = save.records;
  return (
    <ModalFrame title="컬렉션" onClose={onClose}>
      <div className="flex items-baseline justify-between mb-2"><span className="text-slate-900 font-bold">동물 친구들</span><span className="text-xs font-semibold text-slate-400">{save.owned.length}/{ALL_ANIMALS.length}</span></div>
      <div className="grid grid-cols-5 gap-2 mb-5">
        {ALL_ANIMALS.map((a) => (
          <div key={a} className="aspect-square rounded-2xl overflow-hidden" style={{ background: save.owned.includes(a) ? 'linear-gradient(180deg,#fffaf0,#ffeccc)' : '#f1f3f6' }}>
            <Portrait animal={a} dim={!save.owned.includes(a)} className="w-full h-full" />
          </div>
        ))}
      </div>
      <div className="flex items-baseline justify-between mb-2"><span className="text-slate-900 font-bold">스테이지</span><span className="text-xs font-semibold text-slate-400">★ {totalStars(save)}/12</span></div>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {STAGES.map((s) => (
          <div key={s.id} className="bg-slate-50 rounded-2xl px-3 py-2.5">
            <div className="text-[13px] font-semibold text-slate-700">{s.id}. {s.title}</div>
            <div className="text-amber-400 text-sm tracking-wider">{'★'.repeat(save.stars[s.id] ?? 0)}<span className="text-slate-200">{'★'.repeat(3 - (save.stars[s.id] ?? 0))}</span></div>
          </div>
        ))}
      </div>
      <div className="text-slate-900 font-bold mb-2">기록</div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[['플레이', r.games], ['승리', r.wins], ['땡', r.thaws], ['얼음', r.freezes], ['잡음', r.tags], ['명중', r.hits]].map(([k, v]) => (
          <div key={String(k)} className="bg-slate-50 rounded-2xl py-3"><div className="text-slate-900 text-xl font-bold tabular-nums">{v}</div><div className="text-[11px] font-medium text-slate-400 mt-0.5">{k}</div></div>
        ))}
      </div>
    </ModalFrame>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={`relative inline-block w-11 h-6 rounded-full transition ${on ? 'bg-sky-500' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </span>
  );
}

function SettingsModal({ save, setSave, onClose, onHowto }: { save: SaveData; setSave: (s: SaveData) => void; onClose: () => void; onHowto: () => void }) {
  return (
    <ModalFrame title="설정" onClose={onClose}>
      <div className="bg-slate-50 rounded-2xl divide-y divide-slate-200/70">
        <button className="w-full flex items-center justify-between px-4 h-14" onClick={() => setSave({ ...save, sound: !save.sound })}>
          <span className="text-[15px] font-semibold text-slate-800">효과음</span><Toggle on={save.sound} />
        </button>
        <button className="w-full flex items-center justify-between px-4 h-14" onClick={() => setSave({ ...save, quality: save.quality === 'high' ? 'low' : 'high' })}>
          <span className="text-left"><span className="block text-[15px] font-semibold text-slate-800">고화질 그래픽</span><span className="block text-xs text-slate-400">그림자 · 안티앨리어싱</span></span><Toggle on={save.quality === 'high'} />
        </button>
        <button className="w-full flex items-center justify-between px-4 h-14" onClick={onHowto}>
          <span className="text-[15px] font-semibold text-slate-800">게임 방법</span><ChevronRight size={18} className="text-slate-400" />
        </button>
      </div>
      <button className="w-full mt-3 h-11 rounded-2xl text-sm font-semibold text-rose-500 bg-rose-50" onClick={() => { if (confirm('저장 데이터를 초기화할까요?')) { localStorage.clear(); location.reload(); } }}>데이터 초기화</button>
      <div className="text-[11px] text-slate-400 mt-3 text-center">PC · WASD 이동 · Space/J 얼음·던지기 · Q/K 땡 · Shift/L 대시 · E/I 아이템 · Tab/N 관전 · Esc/P 메뉴</div>
    </ModalFrame>
  );
}

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <span className="justify-self-start font-bold text-[12px] bg-white rounded-lg px-2 py-0.5 border border-slate-200 shadow-sm whitespace-nowrap">{children}</span>
  );
}

export function HowtoModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalFrame title="게임 방법" onClose={onClose}>
      <div className="space-y-3 text-[13px] text-slate-600 leading-relaxed">
        <section className="bg-sky-50 rounded-2xl p-4">
          <div className="text-sky-900 font-bold text-[15px] mb-1.5">얼음땡 <span className="text-sky-500 font-semibold text-xs ml-1">1 VS 5 · 90초 × 3라운드</span></div>
          <ul className="list-disc pl-4 space-y-1">
            <li><b className="text-slate-800">술래</b>는 도망팀에게 직접 닿아야 잡을 수 있고, 잡힌 도망팀은 즉시 탈락해요.</li>
            <li><b className="text-slate-800">얼음!</b> 상태에선 잡히지 않지만 움직일 수 없어요.</li>
            <li>얼음 친구 옆에서 <b className="text-slate-800">땡!</b> 버튼으로 구해주세요. 자동 구조는 없어요.</li>
            <li>전원 탈락 또는 남은 인원이 모두 얼음이면 술래 승리, 90초를 버티면 도망팀 승리.</li>
          </ul>
        </section>
        <section className="bg-orange-50 rounded-2xl p-4">
          <div className="text-orange-900 font-bold text-[15px] mb-1.5">오재미 <span className="text-orange-500 font-semibold text-xs ml-1">1 VS 1 · 2 VS 2 · 3 VS 3</span></div>
          <ul className="list-disc pl-4 space-y-1">
            <li>오재미를 주워(1개) 바라보는 방향으로 던져요. 포물선으로 날아가요.</li>
            <li>명중하면 팀 점수 +1. 장애물과 대시로 피할 수 있어요. 동점이면 연장전!</li>
          </ul>
        </section>
        <section className="bg-indigo-50 rounded-2xl p-4">
          <div className="text-indigo-900 font-bold text-[15px] mb-2">🖱️ PC 조작법</div>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px] items-center">
            <KeyCap>WASD / 방향키</KeyCap><span><b className="text-slate-800">이동</b></span>
            <KeyCap>{KEY_HINT.primary}</KeyCap><span><b className="text-slate-800">얼음!</b> (도망자) / <b className="text-slate-800">던지기</b> (오재미)</span>
            <KeyCap>{KEY_HINT.thaw}</KeyCap><span><b className="text-slate-800">땡!</b> — 친구 구하기</span>
            <KeyCap>{KEY_HINT.dash}</KeyCap><span><b className="text-slate-800">대시</b> · 모든 모드 동일</span>
            <KeyCap>{KEY_HINT.item}</KeyCap><span><b className="text-slate-800">아이템</b> · 모든 모드 동일</span>
            <KeyCap>{KEY_HINT.spectate}</KeyCap><span>탈락 후 <b className="text-slate-800">관전 전환</b></span>
            <KeyCap>{KEY_HINT.pause}</KeyCap><span><b className="text-slate-800">메뉴</b> 열기·닫기</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">왼손(WASD)이나 오른손(방향키 + J·K·L·I) 중 편한 쪽으로 플레이하세요. 게임 화면에서는 버튼 밑에 키가 적혀 있어요.</div>
        </section>
        <section className="bg-slate-50 rounded-2xl p-4">
          <div className="text-slate-900 font-bold text-[15px] mb-2">아이템</div>
          <div className="space-y-1.5">
            {Object.values(ITEM_INFO).map((it) => (
              <div key={it.name} className="flex items-center gap-2"><span className="text-base w-6 text-center">{it.emoji}</span><b className="w-16 text-slate-800">{it.name}</b><span>{it.desc}</span></div>
            ))}
          </div>
          <div className="text-xs text-slate-400 mt-2">아이템으로는 탈락하지 않아요</div>
        </section>
      </div>
    </ModalFrame>
  );
}

// ------------------------------------------------------------ main menu
export function MainMenu({ save, setSave, onPlay, onStages }: { save: SaveData; setSave: (s: SaveData) => void; onPlay: () => void; onStages: () => void }) {
  const [modal, setModal] = useState<Modal>(null);
  const demoCfg = useMemo(() => makeDemoCfg('icetag', 'plaza', { cinematic: true, quality: save.quality }), [save.quality]);
  const stars = totalStars(save);
  const level = 1 + Math.floor(save.records.games / 3);
  const xp = ((save.records.games % 3) / 3) * 100;
  const newShop = ALL_ANIMALS.some((a) => !save.owned.includes(a) && save.coins >= ANIMAL_INFO[a].price)
    || COSTUMES.some((c) => !save.costumes.includes(c.id) && save.coins >= c.price);

  const nav: [Modal, typeof PawPrint, string, boolean][] = [
    ['char', PawPrint, '캐릭터', false],
    ['shop', ShoppingBag, '상점', newShop],
    ['collection', BookOpen, '컬렉션', false],
    ['settings', Settings, '설정', false],
  ];

  return (
    <div className="absolute inset-0 overflow-hidden bg-sky-300">
      <Preview3D cfg={demoCfg} className="absolute inset-0" />
      {/* soft vignette for legibility */}
      <div className="absolute inset-x-0 top-0 h-48 pointer-events-none bg-gradient-to-b from-sky-900/35 via-sky-900/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none bg-gradient-to-t from-slate-900/45 via-slate-900/10 to-transparent" />

      <div
        className="absolute inset-0 flex flex-col short:!pt-2 short:!pb-2"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
      >
        {/* top bar */}
        <div className="shrink-0 flex items-center justify-between px-4 wide:px-10 gap-2">
          <button className="glass rounded-full flex items-center gap-2.5 pl-1 pr-4 py-1 min-w-0 press" onClick={() => setModal('char')}>
            <Avatar animal={save.animal} size={40} outfit={save.outfit} />
            <div className="text-left min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-900 text-[15px] font-bold leading-none truncate max-w-[90px]">{save.name}</span>
                <span className="text-[10px] font-bold text-sky-600 bg-sky-100 rounded-full px-1.5 py-0.5 leading-none">Lv.{level}</span>
              </div>
              <div className="mt-1.5 w-20 h-1 rounded-full bg-slate-900/10 overflow-hidden"><div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.max(8, xp)}%` }} /></div>
            </div>
          </button>
          <div className="flex gap-1.5 shrink-0">
            <div className="glass-dark rounded-full flex items-center gap-1.5 pl-1.5 pr-3 h-8 text-white text-sm font-bold tabular-nums"><Coin />{save.coins}</div>
            <div className="glass-dark rounded-full flex items-center gap-1.5 pl-2 pr-3 h-8 text-white text-sm font-bold tabular-nums"><Star size={15} className="text-amber-300" fill="currentColor" strokeWidth={0} />{stars}</div>
          </div>
        </div>

        {/* body: portrait = stacked column · landscape / desktop = hero on the left, action panel on the right */}
        <div className="flex-1 min-h-0 flex flex-col landscape:flex-row landscape:gap-4 landscape:px-4 wide:px-10 wide:gap-8">
        <div className="flex-1 min-h-0 min-w-0 flex flex-col">
        {/* logo */}
        <div className="shrink-0 mt-5 [@media(max-height:680px)]:mt-2 short:mt-1">
          <Logo />
        </div>

        {/* hero character */}
        <div className="relative flex-1 min-h-[140px] short:min-h-[110px]">
          {modal === null && <CharacterViewer animal={save.animal} outfit={save.outfit} view="menu" className="absolute inset-0" />}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-1 flex items-center gap-1.5">
            <button className="glass rounded-full flex items-center gap-1 pl-3.5 pr-2.5 h-8 text-[13px] font-semibold text-slate-700 whitespace-nowrap press" onClick={() => setModal('char')}>
              {ANIMAL_INFO[save.animal].name} <span className="text-slate-300 mx-0.5">|</span> 캐릭터 <ChevronRight size={15} className="text-slate-400" />
            </button>
            <button className="glass rounded-full flex items-center gap-1 pl-3 pr-3.5 h-8 text-[13px] font-semibold text-slate-700 whitespace-nowrap press" onClick={() => setModal('wardrobe')}>
              <Sparkles size={14} className="text-amber-500" /> 꾸미기
            </button>
          </div>
        </div>

        </div>

        {/* action panel: bottom sheet in portrait, right-hand column in landscape */}
        <div className="shrink-0 px-3 mt-3 landscape:mt-0 landscape:px-0 landscape:w-[min(420px,44vw)] landscape:flex landscape:flex-col landscape:justify-center wide:w-[min(440px,36vw)]">
          <div className="glass rounded-[28px] p-3 max-w-md mx-auto w-full landscape:max-w-none short:p-2.5 short:rounded-[24px]">
            <button className="cta w-full rounded-[20px] h-[68px] [@media(max-height:680px)]:h-14 short:!h-[52px] wide:h-[76px] flex items-center px-4 gap-3 text-left" onClick={onPlay}>
              <span className="w-11 h-11 rounded-full bg-white/25 flex items-center justify-center shrink-0 ring-1 ring-white/40">
                <Play size={20} className="text-white translate-x-[1px]" fill="currentColor" strokeWidth={0} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-white text-[22px] font-extrabold leading-tight tracking-tight">게임 시작</span>
                <span className="block text-white/85 text-xs font-medium [@media(max-height:620px)]:hidden">얼음땡 1 VS 5 · 오재미 1:1 · 2:2 · 3:3</span>
              </span>
              <ChevronRight size={22} className="text-white/90 shrink-0" strokeWidth={2.6} />
            </button>

            <button className="mt-2 w-full h-12 short:h-11 rounded-2xl bg-white/90 flex items-center px-3 gap-3 press shadow-sm" onClick={onStages}>
              <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center"><MapIcon size={17} strokeWidth={2.3} /></span>
              <span className="flex-1 text-left text-[15px] font-bold text-slate-800">스테이지 모드</span>
              <span className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-50 rounded-full px-2 py-1"><Star size={12} fill="currentColor" strokeWidth={0} />{stars}/12</span>
              <ChevronRight size={18} className="text-slate-300" />
            </button>

            <div className="grid grid-cols-4 mt-2 pt-2 border-t border-slate-900/5 short:mt-1.5 short:pt-1.5">
              {nav.map(([m, Icon, label, dot]) => (
                <button key={label} className="relative flex flex-col items-center gap-1 py-1 short:py-0.5 press" onClick={() => setModal(m)}>
                  <span className="w-10 h-10 short:w-9 short:h-9 rounded-2xl bg-slate-900/[0.05] flex items-center justify-center text-slate-700">
                    <Icon size={20} strokeWidth={2.1} />
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600">{label}</span>
                  {dot && <span className="absolute top-0.5 right-[22%] w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        </div>
      </div>

      {modal === 'char' && <CharacterModal save={save} setSave={setSave} onClose={() => setModal(null)} />}
      {modal === 'shop' && <ShopModal save={save} setSave={setSave} onClose={() => setModal(null)} />}
      {modal === 'wardrobe' && <ShopModal save={save} setSave={setSave} onClose={() => setModal(null)} initialTab="top" />}
      {modal === 'collection' && <CollectionModal save={save} onClose={() => setModal(null)} />}
      {modal === 'settings' && <SettingsModal save={save} setSave={setSave} onClose={() => setModal(null)} onHowto={() => setModal('howto')} />}
      {modal === 'howto' && <HowtoModal onClose={() => setModal(null)} />}
    </div>
  );
}
