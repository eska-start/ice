import { useEffect, useReducer, useRef, useState } from 'react';
import { Check, ChevronLeft, Copy, Crown, Link2, Loader2, LogIn, Plus, Send, Share2, Users, X } from 'lucide-react';
import { Portrait } from './Portrait';
import { CODE_LEN, MAX_PLAYERS, NetRoom, type Member } from '../net/net';
import { TeamSizePicker, VsDots } from './Setup';
import type { SaveData } from '../game/save';
import { totalStars } from '../game/save';
import { ALL_MAPS, MAP_INFO, MODE_INFO, TEAM_SIZE_INFO, TEAM_SIZES } from '../game/types';
import type { TeamSize } from '../game/types';
import type { Difficulty, MapId, Mode } from '../game/types';

/** options carried from the match setup screen into the multiplayer lobby */
export interface LobbyInit { mode: Mode; map: MapId; difficulty: Difficulty; teamSize?: TeamSize }

const DIFF_LABEL: Record<Difficulty, string> = { easy: '쉬움', normal: '보통', hard: '어려움' };
const QUICK = ['👋 안녕!', '준비 완료!', '빨리 시작해요', '잘 부탁해요 🙏'];

function useRoom(room: NetRoom | null) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => (room ? room.subscribe(force) : undefined), [room]);
}

function Shell({ title, onBack, right, children }: { title: string; onBack: () => void; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg,#bfe4ff 0%,#e8f5ff 42%,#f4fbf2 100%)', paddingTop: 'max(10px, env(safe-area-inset-top))', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
    >
      <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full bg-white/50 blur-2xl pointer-events-none" />
      <div className="relative shrink-0 flex items-center justify-between px-3 h-12 short:h-10 screen-col">
        <button className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-600 press" onClick={onBack}><ChevronLeft size={20} strokeWidth={2.5} /></button>
        <div className="text-slate-900 font-bold text-[17px]">{title}</div>
        <div className="w-10 flex justify-end">{right}</div>
      </div>
      <div className="relative flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}

// ------------------------------------------------------------ entry: create / join
function Entry({ init, save, joinCode, onHost, onJoin, onBack }: { init: LobbyInit | null; save: SaveData; joinCode: string; onHost: (o: LobbyInit) => void; onJoin: (code: string) => void; onBack: () => void }) {
  const [mode, setMode] = useState<Mode>(init?.mode ?? 'icetag');
  const [teamSize, setTeamSize] = useState<TeamSize>(init?.teamSize ?? 3);
  const [map, setMap] = useState<MapId>(init?.map ?? 'plaza');
  const [code, setCode] = useState(joinCode);
  const inputRef = useRef<HTMLInputElement>(null);
  const stars = totalStars(save);
  const valid = code.length === CODE_LEN;
  useEffect(() => { if (joinCode) inputRef.current?.focus(); }, [joinCode]);

  return (
    <Shell title="멀티플레이" onBack={onBack}>
      {/* portrait: join above create · landscape / desktop: join | or | create side by side */}
      <div className="flex-1 overflow-auto px-4 pb-6 space-y-3 landscape:space-y-0 landscape:grid landscape:grid-cols-[1fr_auto_1fr] landscape:gap-3 landscape:items-start landscape:content-start screen-col" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        {/* join */}
        <section className="bg-white rounded-3xl p-4 shadow-[0_10px_30px_-12px_rgba(30,80,140,0.35)]">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center"><LogIn size={17} /></span>
            <div className="text-slate-900 font-bold">코드로 참가</div>
          </div>
          <div className="text-xs text-slate-400 mb-3">친구에게 받은 5자리 방 코드를 입력하세요</div>
          <div className="relative" onClick={() => inputRef.current?.focus()}>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${CODE_LEN}, 1fr)` }}>
              {Array.from({ length: CODE_LEN }, (_, i) => (
                <div key={i} className={`h-14 rounded-2xl flex items-center justify-center text-2xl font-extrabold tracking-wide transition ${code[i] ? 'bg-slate-900 text-white' : i === code.length ? 'bg-sky-50 ring-2 ring-sky-400 text-slate-300' : 'bg-slate-100 text-slate-300'}`}>
                  {code[i] ?? ''}
                </div>
              ))}
            </div>
            <input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN))}
              onKeyDown={(e) => { if (e.key === 'Enter' && valid) onJoin(code); }}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              className="absolute inset-0 opacity-0"
              aria-label="방 코드"
            />
          </div>
          <button disabled={!valid} onClick={() => onJoin(code)} className={`mt-3 w-full h-12 rounded-2xl font-bold press flex items-center justify-center gap-2 ${valid ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg shadow-sky-500/30' : 'bg-slate-100 text-slate-400'}`}>
            참가하기
          </button>
        </section>

        <div className="flex items-center gap-3 px-2 text-xs font-semibold text-slate-400 landscape:flex-col landscape:self-stretch landscape:px-0 landscape:py-6">
          <span className="flex-1 h-px bg-slate-200 landscape:h-auto landscape:w-px" />또는<span className="flex-1 h-px bg-slate-200 landscape:h-auto landscape:w-px" />
        </div>

        {/* create */}
        <section className="bg-white rounded-3xl p-4 shadow-[0_10px_30px_-12px_rgba(30,80,140,0.35)]">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-8 h-8 rounded-xl bg-orange-100 text-orange-500 flex items-center justify-center"><Plus size={18} /></span>
            <div className="text-slate-900 font-bold">방 만들기</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['icetag', 'ojaemi'] as Mode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`rounded-2xl p-3 text-left press transition ${mode === m ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-700'}`}>
                <div className="font-bold">{MODE_INFO[m].name}</div>
                <div className={`text-xs ${mode === m ? 'text-white/60' : 'text-slate-400'}`}>{MODE_INFO[m].sub}</div>
              </button>
            ))}
          </div>
          {mode === 'ojaemi' && (
            <div className="mt-2">
              <TeamSizePicker value={teamSize} onChange={setTeamSize} />
            </div>
          )}
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1 -mx-1 px-1">
            {ALL_MAPS.map((m) => {
              const locked = stars < MAP_INFO[m].unlockStars;
              return (
                <button key={m} disabled={locked} onClick={() => setMap(m)} className={`shrink-0 relative w-28 h-16 rounded-2xl overflow-hidden press ${map === m ? 'ring-2 ring-sky-500 ring-offset-2' : ''} ${locked ? 'opacity-50' : ''}`}>
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${MAP_INFO[m].thumb})`, backgroundColor: '#9fd3ff' }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute left-2 bottom-1 text-white text-[11px] font-bold">{locked ? `⭐${MAP_INFO[m].unlockStars} 필요` : MAP_INFO[m].name}</div>
                </button>
              );
            })}
          </div>
          <button onClick={() => onHost({ mode, map, difficulty: init?.difficulty ?? 'normal', teamSize })} className="mt-3 w-full h-12 rounded-2xl font-bold text-white press bg-gradient-to-r from-amber-400 to-orange-500 shadow-lg shadow-orange-500/30">
            방 만들기{mode === 'ojaemi' ? ` · ${TEAM_SIZE_INFO[teamSize].label}` : ''}
          </button>
        </section>
        <div className="text-[11px] text-slate-400 text-center leading-relaxed px-4 landscape:col-span-3">기기끼리 직접 연결돼요 (WebRTC). 같은 코드를 입력한 친구가 최대 6명까지 함께할 수 있어요.</div>
      </div>
    </Shell>
  );
}

// ------------------------------------------------------------ waiting room
function Seat({ seat, m, room, team }: { seat: number; m?: Member; room: NetRoom; team?: 'red' | 'blue' }) {
  const me = m && m.id === room.myId;
  const accent = team === 'red' ? 'from-rose-50 to-rose-100' : team === 'blue' ? 'from-sky-50 to-sky-100' : 'from-slate-50 to-slate-100';
  if (!m) {
    return (
      <button onClick={() => room.moveSeat(seat)} className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 h-[92px] flex flex-col items-center justify-center gap-1 press">
        <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center"><Users size={16} /></span>
        <span className="text-[11px] font-semibold text-slate-400">빈 자리 · AI</span>
      </button>
    );
  }
  return (
    <div className={`relative rounded-2xl bg-gradient-to-b ${accent} h-[92px] flex flex-col items-center justify-end pb-2 overflow-hidden ${me ? 'ring-2 ring-sky-500' : ''}`}>
      <div className="absolute top-1 left-1/2 -translate-x-1/2 w-14 h-14"><Portrait animal={m.animal} outfit={m.outfit} className="w-full h-full" /></div>
      {m.host && <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-amber-400 text-white flex items-center justify-center shadow"><Crown size={11} strokeWidth={2.6} /></span>}
      {room.isHost && !m.host && (
        <button className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-slate-900/40 text-white flex items-center justify-center" onClick={() => room.kick(m.id)} aria-label="내보내기"><X size={11} strokeWidth={3} /></button>
      )}
      <div className="relative text-[12px] font-bold text-slate-800 truncate max-w-[90%] leading-tight">{m.name}{me && <span className="text-sky-500"> (나)</span>}</div>
      <div className={`relative mt-0.5 text-[10px] font-bold rounded-full px-2 py-0.5 ${m.host ? 'bg-amber-100 text-amber-700' : m.ready ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400'}`}>
        {m.host ? '방장' : m.ready ? '준비 완료' : '대기 중'}
      </div>
    </div>
  );
}

function WaitingRoom({ room, onLeave, onStart }: { room: NetRoom; onLeave: () => void; onStart: () => void }) {
  const s = room.state;
  const [copied, setCopied] = useState('');
  const [text, setText] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);
  const me = room.me;
  const guests = s.members.filter((m) => !m.host);
  const readyCount = guests.filter((m) => m.ready).length;
  const canStart = room.isHost && room.allReady;
  const link = `${location.origin}${location.pathname}?room=${s.code}`;
  useEffect(() => { chatRef.current?.scrollTo({ top: 1e6, behavior: 'smooth' }); }, [s.chat.length]);

  const copy = async (what: 'code' | 'link') => {
    try { await navigator.clipboard.writeText(what === 'code' ? s.code : link); setCopied(what); setTimeout(() => setCopied(''), 1500); } catch { /* ignore */ }
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: '동물마을 얼음땡', text: `같이 해요! 방 코드: ${s.code}`, url: link }); } catch { /* cancelled */ } }
    else copy('link');
  };
  const send = (t: string) => { room.chat(t); setText(''); };
  const seatAt = (seat: number) => s.members.find((m) => m.seat === seat);

  return (
    <Shell title="대기방" onBack={onLeave} right={<span className="text-xs font-bold text-slate-500 bg-white rounded-full px-2 py-1 shadow-sm">{s.members.length}/{room.capacity}</span>}>
      {/* waiting room: 1 column portrait · 2 balanced columns landscape / desktop */}
      <div className="flex-1 min-h-0 overflow-auto px-4 space-y-3 pb-3 landscape:space-y-0 landscape:columns-2 landscape:gap-3 wide:gap-5 [&>section]:break-inside-avoid landscape:[&>section]:mb-3 screen-col">
        {/* code card */}
        <section className="rounded-3xl p-4 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#1e293b 0%,#1e3a8a 100%)' }}>
          <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-sky-400/20 blur-xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-white/60 tracking-widest">ROOM CODE</div>
              <div className="text-[34px] font-extrabold tracking-[0.25em] leading-tight tabular-nums">{s.code}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => copy('code')} className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center press" aria-label="코드 복사">{copied === 'code' ? <Check size={18} /> : <Copy size={18} />}</button>
              <button onClick={share} className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center press" aria-label="공유">{copied === 'link' ? <Check size={18} /> : <Share2 size={18} />}</button>
            </div>
          </div>
          <button onClick={() => copy('link')} className="relative mt-2 flex items-center gap-1.5 text-[11px] text-white/60 truncate max-w-full"><Link2 size={12} className="shrink-0" /><span className="truncate">{link}</span></button>
        </section>

        {/* options */}
        <section className="bg-white rounded-3xl p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[13px] font-bold text-slate-800">게임 설정</span>
            {!room.isHost && <span className="text-[11px] text-slate-400">방장만 변경할 수 있어요</span>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['icetag', 'ojaemi'] as Mode[]).map((m) => (
              <button key={m} disabled={!room.isHost} onClick={() => room.setOptions({ mode: m })} className={`rounded-2xl px-3 py-2 text-left transition ${s.mode === m ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500'} ${room.isHost ? 'press' : ''}`}>
                <div className="text-sm font-bold">{MODE_INFO[m].name}</div>
                <div className={`text-[11px] ${s.mode === m ? 'text-white/60' : 'text-slate-400'}`}>{m === 'ojaemi' && s.mode === 'ojaemi' ? TEAM_SIZE_INFO[s.teamSize].label : MODE_INFO[m].sub}</div>
              </button>
            ))}
          </div>
          {s.mode === 'ojaemi' && (
            room.isHost ? (
              <div className="mt-2">
                <TeamSizePicker value={s.teamSize} onChange={(n) => room.setOptions({ teamSize: n })} isDisabled={(n) => !room.fitsTeamSize(n)} />
                {TEAM_SIZES.some((n) => !room.fitsTeamSize(n)) && <div className="text-[10px] text-slate-400 mt-1 px-1">인원이 많아 작은 대전 방식은 선택할 수 없어요</div>}
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between bg-slate-50 rounded-2xl px-3 h-10">
                <span className="text-[12px] font-semibold text-slate-500">대전 방식</span>
                <span className="flex items-center gap-2 text-[13px] font-extrabold text-slate-800">{TEAM_SIZE_INFO[s.teamSize].label} <VsDots n={s.teamSize} size={7} /></span>
              </div>
            )
          )}
          <div className="flex gap-1.5 mt-2 overflow-x-auto -mx-1 px-1 pb-1">
            {ALL_MAPS.map((m) => (
              <button key={m} disabled={!room.isHost} onClick={() => room.setOptions({ map: m })} className={`shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold transition ${s.map === m ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {MAP_INFO[m].name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-[11px] font-semibold text-slate-400 w-14 pl-1">AI 난이도</span>
            {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
              <button key={d} disabled={!room.isHost} onClick={() => room.setOptions({ difficulty: d })} className={`flex-1 h-8 rounded-full text-[12px] font-semibold ${s.difficulty === d ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>{DIFF_LABEL[d]}</button>
            ))}
          </div>
        </section>

        {/* seats */}
        <section>
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[13px] font-bold text-slate-800">플레이어</span>
            <span className="text-[11px] text-slate-400">빈 자리를 눌러 자리를 옮길 수 있어요</span>
          </div>
          {s.mode === 'ojaemi' ? (
            <div className="grid grid-cols-2 gap-3">
              {(['red', 'blue'] as const).map((team) => (
                <div key={team}>
                  <div className={`text-[11px] font-extrabold tracking-widest mb-1.5 px-1 ${team === 'red' ? 'text-rose-500' : 'text-sky-600'}`}>{team === 'red' ? 'RED TEAM' : 'BLUE TEAM'}</div>
                  <div className="grid gap-2">{Array.from({ length: s.teamSize }, (_, k) => { const seat = team === 'red' ? k : k + s.teamSize; return <Seat key={seat} seat={seat} m={seatAt(seat)} room={room} team={team} />; })}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">{Array.from({ length: MAX_PLAYERS }, (_, seat) => <Seat key={seat} seat={seat} m={seatAt(seat)} room={room} />)}</div>
          )}
          {s.mode === 'icetag' && <div className="text-[11px] text-slate-400 mt-2 px-1">얼음땡은 라운드마다 술래가 바뀌어요 · 플레이어가 먼저 술래를 맡아요</div>}
        </section>

        {/* chat */}
        <section className="bg-white rounded-3xl p-3 shadow-sm">
          <div ref={chatRef} className="h-24 overflow-auto space-y-1 px-1">
            {s.chat.map((c) => (
              <div key={c.id} className={`text-[12px] leading-snug ${c.sys ? 'text-slate-400 text-center' : 'text-slate-700'}`}>
                {c.sys ? c.text : <><b className="text-slate-900">{c.name}</b> <span>{c.text}</span></>}
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 mt-2 overflow-x-auto -mx-1 px-1">
            {QUICK.map((t) => <button key={t} onClick={() => send(t)} className="shrink-0 h-7 px-2.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 press">{t}</button>)}
          </div>
          <form className="flex gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input value={text} maxLength={40} onChange={(e) => setText(e.target.value)} placeholder="메시지 보내기" className="flex-1 h-10 rounded-xl bg-slate-100 px-3 text-[13px] outline-none focus:ring-2 focus:ring-sky-300" />
            <button type="submit" className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center press" aria-label="보내기"><Send size={16} /></button>
          </form>
        </section>
      </div>

      {/* bottom action */}
      <div className="shrink-0 px-4 pt-2 short:pt-1 bg-gradient-to-t from-white via-white/95 to-white/0" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
        <div className="screen-col wide:!max-w-[520px] landscape:max-w-[520px]">
        {room.isHost ? (
          <>
            <button disabled={!canStart} onClick={onStart} className={`w-full h-14 rounded-2xl font-extrabold text-[17px] press ${canStart ? 'cta text-white' : 'bg-slate-200 text-slate-400'}`}>
              {canStart ? '게임 시작' : `준비 대기 중 (${readyCount}/${guests.length})`}
            </button>
            <div className="text-[11px] text-slate-400 text-center mt-1.5">{guests.length === 0 ? '친구가 없어도 시작할 수 있어요 · ' : ''}빈 자리는 AI가 채워요</div>
          </>
        ) : (
          <>
            <button onClick={() => room.setReady(!me?.ready)} className={`w-full h-14 rounded-2xl font-extrabold text-[17px] press ${me?.ready ? 'bg-slate-800 text-white' : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30'}`}>
              {me?.ready ? '준비 취소' : '준비 완료'}
            </button>
            <div className="text-[11px] text-slate-400 text-center mt-1.5 short:hidden">{me?.ready ? '방장이 게임을 시작하길 기다리는 중...' : '준비를 누르면 방장이 시작할 수 있어요'}</div>
          </>
        )}
        </div>
      </div>
    </Shell>
  );
}

// ------------------------------------------------------------ screen
export function Lobby({ save, init, joinCode, room, setRoom, onBack, onStart }: {
  save: SaveData; init: LobbyInit | null; joinCode: string; room: NetRoom | null; setRoom: (r: NetRoom | null) => void; onBack: () => void; onStart: () => void;
}) {
  useRoom(room);
  const leave = () => { room?.leave(); setRoom(null); };

  if (!room) {
    return (
      <Entry
        init={init}
        save={save}
        joinCode={joinCode}
        onBack={onBack}
        onHost={(o) => setRoom(NetRoom.host(save.name, save.animal, o.mode, o.map, o.difficulty, save.outfit, o.teamSize ?? 3))}
        onJoin={(code) => setRoom(NetRoom.join(code, save.name, save.animal, save.outfit))}
      />
    );
  }
  if (room.status === 'connecting') {
    return (
      <Shell title={room.isHost ? '방 만드는 중' : '참가하는 중'} onBack={leave}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="w-20 h-20 rounded-3xl bg-white shadow-lg flex items-center justify-center"><Loader2 size={34} className="text-sky-500 animate-spin" /></div>
          <div>
            <div className="text-slate-900 font-bold text-lg">{room.isHost ? '방을 준비하고 있어요' : `${room.state.code} 방에 연결 중`}</div>
            <div className="text-slate-400 text-sm mt-1">잠시만 기다려 주세요...</div>
          </div>
          <button onClick={leave} className="h-10 px-5 rounded-full bg-white text-slate-500 text-sm font-semibold shadow-sm press">취소</button>
        </div>
      </Shell>
    );
  }
  if (room.status === 'error' || room.status === 'closed') {
    return (
      <Shell title="멀티플레이" onBack={leave}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="w-20 h-20 rounded-3xl bg-white shadow-lg flex items-center justify-center text-4xl">😢</div>
          <div>
            <div className="text-slate-900 font-bold text-lg">연결할 수 없어요</div>
            <div className="text-slate-500 text-sm mt-1">{room.error || '연결이 끊어졌어요.'}</div>
          </div>
          <button onClick={leave} className="h-12 px-8 rounded-2xl bg-slate-900 text-white font-bold press">다시 시도</button>
        </div>
      </Shell>
    );
  }
  return <WaitingRoom room={room} onLeave={leave} onStart={onStart} />;
}
