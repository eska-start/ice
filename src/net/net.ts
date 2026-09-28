import Peer, { type DataConnection } from 'peerjs';
import { AI_NAMES, ALL_ANIMALS } from '../game/types';
import type { Animal, Difficulty, GameConfig, MapId, Mode, Outfit, SlotConfig, Team, TeamSize } from '../game/types';
import { matchSize } from '../game/types';
import { randomOutfit, sanitizeOutfit } from '../game/costumes';

export interface Member { id: string; name: string; animal: Animal; seat: number; ready: boolean; host: boolean; outfit?: Outfit }
export interface ChatLine { id: number; name: string; text: string; sys?: boolean }
export interface LobbyState { code: string; mode: Mode; map: MapId; difficulty: Difficulty; teamSize: TeamSize; members: Member[]; chat: ChatLine[]; inGame: boolean }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NetMsg = { t: string; [k: string]: any };

const PREFIX = 'avillage-icetag-v1-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LEN = 5;
export const genCode = () => Array.from({ length: CODE_LEN }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
export const MAX_PLAYERS = 6;

type Status = 'connecting' | 'open' | 'error' | 'closed';

/**
 * Peer-to-peer room (WebRTC via PeerJS public signaling).
 * The host is authoritative: it owns the lobby state and runs the game simulation.
 */
export class NetRoom {
  role: 'host' | 'guest';
  peer: Peer | null = null;
  conns = new Map<string, DataConnection>();
  hostConn: DataConnection | null = null;
  /**
   * Second, *unordered* data channel per guest for high-rate game traffic (snapshots / inputs).
   * On lossy mobile networks an ordered channel stalls every later packet behind one lost packet
   * (head-of-line blocking) which made guests feel slow; unordered + sequence numbers avoids that.
   */
  fastConns = new Map<string, DataConnection>();
  fastConn: DataConnection | null = null;
  myId = '';
  status: Status = 'connecting';
  error = '';
  state: LobbyState;
  private listeners = new Set<() => void>();
  private chatId = 0;
  private timeout = 0;
  /** in-game messages (host: from a guest, guest: from host) */
  onGameMsg: ((from: string, msg: NetMsg) => void) | null = null;
  /** guest: host started the match */
  onStart: ((cfg: GameConfig) => void) | null = null;
  /** guest: host returned everybody to the lobby */
  onLobbyReturn: (() => void) | null = null;

  private constructor(role: 'host' | 'guest', state: LobbyState) {
    this.role = role;
    this.state = state;
  }

  // ------------------------------------------------------------ create / join
  static host(name: string, animal: Animal, mode: Mode, map: MapId, difficulty: Difficulty, outfit?: Outfit, teamSize: TeamSize = 3): NetRoom {
    const r = new NetRoom('host', { code: genCode(), mode, map, difficulty, teamSize, members: [], chat: [], inGame: false });
    r.myOutfit = sanitizeOutfit(outfit);
    r.openHost(name, animal, 0);
    return r;
  }

  static join(code: string, name: string, animal: Animal, outfit?: Outfit): NetRoom {
    const r = new NetRoom('guest', { code: code.toUpperCase(), mode: 'icetag', map: 'plaza', difficulty: 'normal', teamSize: 3, members: [], chat: [], inGame: false });
    r.myOutfit = sanitizeOutfit(outfit);
    r.openGuest(name, animal);
    return r;
  }

  myOutfit: Outfit = {};

  private openHost(name: string, animal: Animal, attempt: number) {
    const peer = new Peer(PREFIX + this.state.code, { debug: 0 });
    this.peer = peer;
    this.armTimeout('시그널링 서버에 연결하지 못했어요. 네트워크를 확인해 주세요.');
    peer.on('open', (id) => {
      clearTimeout(this.timeout);
      this.myId = id;
      this.status = 'open';
      this.state.members = [{ id, name, animal, seat: 0, ready: true, host: true, outfit: this.myOutfit }];
      this.sys(`${name}님이 방을 만들었어요`);
      this.emit();
    });
    peer.on('connection', (conn) => this.acceptGuest(conn));
    peer.on('error', (err: { type?: string }) => {
      if (err.type === 'unavailable-id' && attempt < 4) {
        peer.destroy();
        this.state.code = genCode();
        this.openHost(name, animal, attempt + 1);
        return;
      }
      this.fail(err.type === 'network' || err.type === 'server-error' ? '서버 연결에 실패했어요.' : '연결 오류가 발생했어요.');
    });
    peer.on('disconnected', () => { if (this.status === 'open') peer.reconnect(); });
  }

  private acceptGuest(conn: DataConnection) {
    if ((conn.metadata as { fast?: boolean } | undefined)?.fast) {
      this.fastConns.set(conn.peer, conn);
      conn.on('data', (raw) => {
        if (this.conns.has(conn.peer)) this.handleFromGuest(conn.peer, raw as NetMsg);
      });
      const dropFast = () => { if (this.fastConns.get(conn.peer) === conn) this.fastConns.delete(conn.peer); };
      conn.on('close', dropFast);
      conn.on('error', dropFast);
      return;
    }
    conn.on('data', (raw) => {
      const msg = raw as NetMsg;
      if (msg.t === 'hello') {
        const deny = this.state.inGame ? '게임이 이미 진행 중이에요' : this.state.members.length >= this.capacity ? `방이 가득 찼어요 (최대 ${this.capacity}명)` : '';
        if (deny) {
          conn.send({ t: 'deny', reason: deny });
          setTimeout(() => conn.close(), 400);
          return;
        }
        const seat = this.freeSeat();
        this.conns.set(conn.peer, conn);
        this.state.members.push({ id: conn.peer, name: String(msg.name).slice(0, 8) || '친구', animal: ALL_ANIMALS.includes(msg.animal) ? msg.animal : 'dog', seat, ready: false, host: false, outfit: sanitizeOutfit(msg.outfit) });
        this.sys(`${msg.name}님이 들어왔어요`);
        this.broadcastLobby();
        return;
      }
      this.handleFromGuest(conn.peer, msg);
    });
    const drop = () => {
      if (!this.conns.has(conn.peer)) return;
      this.conns.delete(conn.peer);
      const m = this.state.members.find((x) => x.id === conn.peer);
      this.state.members = this.state.members.filter((x) => x.id !== conn.peer);
      if (m) this.sys(`${m.name}님이 나갔어요`);
      this.onGameMsg?.(conn.peer, { t: 'leave', seat: m?.seat ?? -1 });
      this.broadcastLobby();
    };
    conn.on('close', drop);
    conn.on('error', drop);
  }

  private handleFromGuest(id: string, msg: NetMsg) {
    const m = this.state.members.find((x) => x.id === id);
    if (!m) return;
    switch (msg.t) {
      case 'ready': m.ready = !!msg.ready; this.broadcastLobby(); break;
      case 'seat': if (this.seatFree(msg.seat)) { m.seat = msg.seat; m.ready = false; this.broadcastLobby(); } break;
      case 'chat': this.pushChat(m.name, String(msg.text).slice(0, 40)); this.broadcastLobby(); break;
      case 'profile': m.animal = msg.animal; m.name = String(msg.name).slice(0, 8); this.broadcastLobby(); break;
      default: this.onGameMsg?.(id, msg);
    }
  }

  private openGuest(name: string, animal: Animal) {
    const peer = new Peer({ debug: 0 });
    this.peer = peer;
    this.armTimeout('방에 연결하지 못했어요. 코드를 확인해 주세요.');
    peer.on('open', (id) => {
      this.myId = id;
      const conn = peer.connect(PREFIX + this.state.code, { reliable: true, serialization: 'json' });
      this.hostConn = conn;
      conn.on('open', () => {
        conn.send({ t: 'hello', name, animal, outfit: this.myOutfit });
        // open the unordered game channel once we're accepted
        const fast = peer.connect(PREFIX + this.state.code, { reliable: false, serialization: 'json', metadata: { fast: true } });
        fast.on('open', () => { this.fastConn = fast; });
        fast.on('data', (raw) => this.handleFromHost(raw as NetMsg));
        fast.on('close', () => { if (this.fastConn === fast) this.fastConn = null; });
        fast.on('error', () => { if (this.fastConn === fast) this.fastConn = null; });
      });
      conn.on('data', (raw) => this.handleFromHost(raw as NetMsg));
      conn.on('close', () => { if (this.status !== 'error') this.fail('방장이 방을 닫았어요.', 'closed'); });
    });
    peer.on('error', (err: { type?: string }) => {
      if (err.type === 'peer-unavailable') this.fail('방을 찾을 수 없어요. 코드를 다시 확인해 주세요.');
      else this.fail('연결 오류가 발생했어요.');
    });
  }

  private handleFromHost(msg: NetMsg) {
    switch (msg.t) {
      case 'lobby':
        clearTimeout(this.timeout);
        this.state = msg.state;
        this.status = 'open';
        this.emit();
        break;
      case 'deny': this.fail(msg.reason); break;
      case 'kick': this.fail('방장이 내보냈어요.'); break;
      case 'start': this.onStart?.(msg.cfg as GameConfig); break;
      case 'lobbyReturn': this.onLobbyReturn?.(); break;
      default: this.onGameMsg?.('host', msg);
    }
  }

  // ------------------------------------------------------------ helpers
  private armTimeout(text: string) {
    clearTimeout(this.timeout);
    this.timeout = window.setTimeout(() => { if (this.status === 'connecting') this.fail(text); }, 14000);
  }
  private fail(text: string, status: Status = 'error') {
    clearTimeout(this.timeout);
    this.status = status;
    this.error = text;
    this.emit();
  }
  private emit() { this.listeners.forEach((f) => f()); }
  subscribe(f: () => void) { this.listeners.add(f); return () => { this.listeners.delete(f); }; }

  /** players allowed in the room for the current mode (얼음땡 6 · 오재미 2×teamSize) */
  get capacity() { return matchSize(this.state.mode, this.state.teamSize); }
  /** 오재미 seats: red 0..n-1, blue n..2n-1 */
  teamOfSeat(seat: number): Team | null { return this.state.mode === 'ojaemi' ? (seat < this.state.teamSize ? 'red' : 'blue') : null; }
  private seatFree(seat: number) { return seat >= 0 && seat < this.capacity && !this.state.members.some((m) => m.seat === seat); }
  private seatOrder(): number[] {
    const n = this.state.teamSize;
    if (this.state.mode !== 'ojaemi') return [0, 1, 2, 3, 4, 5];
    // alternate red / blue so teams fill evenly
    const out: number[] = [];
    for (let k = 0; k < n; k++) out.push(k, n + k);
    return out;
  }
  private freeSeat() {
    return this.seatOrder().find((s) => this.seatFree(s)) ?? 0;
  }
  /** keep every member on a valid, unique seat after mode / team-size changes (host keeps priority) */
  private reseat() {
    const taken = new Set<number>();
    const ordered = [...this.state.members].sort((a, b) => Number(b.host) - Number(a.host));
    for (const m of ordered) {
      if (m.seat >= 0 && m.seat < this.capacity && !taken.has(m.seat)) taken.add(m.seat);
      else m.seat = -1;
    }
    for (const m of ordered) {
      if (m.seat >= 0) continue;
      const s = this.seatOrder().find((x) => !taken.has(x));
      m.seat = s ?? 0;
      taken.add(m.seat);
    }
  }
  private pushChat(name: string, text: string, sys = false) {
    this.state.chat = [...this.state.chat.slice(-30), { id: ++this.chatId, name, text, sys }];
  }
  private sys(text: string) { this.pushChat('', text, true); }

  get me(): Member | undefined { return this.state.members.find((m) => m.id === this.myId); }
  get isHost() { return this.role === 'host'; }
  get allReady() { return this.state.members.every((m) => m.ready || m.host); }
  seatOf(id: string) { return this.state.members.find((m) => m.id === id)?.seat ?? -1; }

  private broadcastLobby() {
    this.emit();
    this.broadcast({ t: 'lobby', state: this.state });
  }

  // ------------------------------------------------------------ public actions
  broadcast(msg: NetMsg) { this.conns.forEach((c) => { if (c.open) c.send(msg); }); }

  /**
   * High-rate, loss-tolerant broadcast (snapshots). Uses the unordered channel when available and
   * skips a guest whose send buffer is backed up, so a slow phone never accumulates seconds of lag.
   */
  broadcastFast(msg: NetMsg) {
    this.conns.forEach((c, id) => {
      const f = this.fastConns.get(id);
      const ch = f?.open ? f : c;
      if (!ch.open) return;
      const dc = (ch as unknown as { dataChannel?: RTCDataChannel }).dataChannel;
      if (dc && dc.bufferedAmount > 24 * 1024) return; // congested → drop this snapshot, next one supersedes it
      ch.send(msg);
    });
  }

  /** guest: loss-tolerant send to host (inputs) */
  sendFast(msg: NetMsg) {
    const ch = this.fastConn?.open ? this.fastConn : this.hostConn;
    if (!ch?.open) return;
    const dc = (ch as unknown as { dataChannel?: RTCDataChannel }).dataChannel;
    if (dc && dc.bufferedAmount > 16 * 1024 && msg.t === 'in') return;
    ch.send(msg);
  }
  sendToSeat(seat: number, msg: NetMsg) {
    const m = this.state.members.find((x) => x.seat === seat && !x.host);
    const c = m && this.conns.get(m.id);
    if (c?.open) c.send(msg);
  }
  sendHost(msg: NetMsg) { if (this.hostConn?.open) this.hostConn.send(msg); }

  setReady(ready: boolean) {
    if (this.isHost) return;
    this.sendHost({ t: 'ready', ready });
  }
  moveSeat(seat: number) {
    if (this.isHost) {
      const me = this.me;
      if (me && this.seatFree(seat)) { me.seat = seat; this.broadcastLobby(); }
    } else this.sendHost({ t: 'seat', seat });
  }
  chat(text: string) {
    const t = text.trim();
    if (!t) return;
    if (this.isHost) { this.pushChat(this.me?.name ?? '방장', t.slice(0, 40)); this.broadcastLobby(); }
    else this.sendHost({ t: 'chat', text: t });
  }
  /** can the current members fit into this 오재미 team size? (used to disable smaller formats) */
  fitsTeamSize(n: TeamSize) { return this.state.members.length <= n * 2; }

  setOptions(o: Partial<Pick<LobbyState, 'mode' | 'map' | 'difficulty' | 'teamSize'>>) {
    if (!this.isHost) return;
    const next = { ...o };
    // switching to 오재미: grow the team size so everyone already in the room keeps a seat
    if (next.mode === 'ojaemi' && next.teamSize === undefined) {
      next.teamSize = Math.max(this.state.teamSize, Math.ceil(this.state.members.length / 2)) as TeamSize;
    }
    const mode = next.mode ?? this.state.mode;
    const size = next.teamSize ?? this.state.teamSize;
    if (this.state.members.length > matchSize(mode, size)) return; // would kick someone out
    const layoutChanged = (next.mode !== undefined && next.mode !== this.state.mode) || (next.teamSize !== undefined && next.teamSize !== this.state.teamSize);
    Object.assign(this.state, next);
    if (layoutChanged) {
      this.state.members.forEach((m) => { if (!m.host) m.ready = false; });
      this.reseat();
    }
    this.broadcastLobby();
  }
  kick(id: string) {
    if (!this.isHost) return;
    const c = this.conns.get(id);
    c?.send({ t: 'kick' });
    setTimeout(() => c?.close(), 300);
  }

  buildSlots(): SlotConfig[] {
    const used = new Set(this.state.members.map((m) => m.animal));
    const pool = ALL_ANIMALS.filter((a) => !used.has(a)).sort(() => Math.random() - 0.5);
    let k = 0;
    return Array.from({ length: this.capacity }, (_, seat) => {
      const team: Team = this.teamOfSeat(seat) ?? 'blue';
      const m = this.state.members.find((x) => x.seat === seat);
      if (m) return { team, animal: m.animal, name: m.name, human: true, outfit: m.outfit };
      const a = pool[k++ % pool.length] ?? 'dog';
      return { team, animal: a, name: AI_NAMES[a], human: false, outfit: randomOutfit(0.45) };
    });
  }

  /** host: start the match; returns the host's own config */
  start(quality: GameConfig['quality']): GameConfig {
    const slots = this.buildSlots();
    const base = { mode: this.state.mode, map: this.state.map, slots, difficulty: this.state.difficulty, multiplayer: true, teamSize: this.state.mode === 'ojaemi' ? this.state.teamSize : (3 as TeamSize) };
    this.state.inGame = true;
    this.state.members.forEach((m) => { if (!m.host) m.ready = false; });
    for (const m of this.state.members) {
      if (m.host) continue;
      const c = this.conns.get(m.id);
      c?.send({ t: 'start', cfg: { ...base, playerIndex: m.seat, net: 'client' } });
    }
    this.broadcastLobby();
    return { ...base, playerIndex: this.me?.seat ?? 0, net: 'host', quality };
  }

  returnToLobby() {
    if (!this.isHost) return;
    this.state.inGame = false;
    this.broadcast({ t: 'lobbyReturn' });
    this.broadcastLobby();
  }

  leave() {
    clearTimeout(this.timeout);
    this.status = 'closed';
    this.conns.forEach((c) => c.close());
    this.fastConns.forEach((c) => c.close());
    this.hostConn?.close();
    this.fastConn?.close();
    this.peer?.destroy();
    this.listeners.clear();
  }
}
