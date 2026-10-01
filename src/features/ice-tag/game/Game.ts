import * as THREE from 'three';
import { buildBag, buildCharacter, lam, type CharModel } from './character';
import { buildWorld, lineOfSight, pointBlocked, resolveCircle, THEMES, type ThemeDef, type WorldData } from './world';
import { Effects } from './effects';
import { skyTexture } from './textures';
import { setupRenderer } from './env';
import { ToonPost } from './post';
import { TOON_TIME } from './toon';
import { NavGrid } from './nav';
import { actionForKey, isSystemKey } from './keys';
import type { NetMsg } from '../net/net';
import type { Sfx } from './sfx';
import { STAGES } from './types';
import { buildPoliceField, COP_DASH_CD, COP_HOLD, POLICE_TIME, RESCUE_R, RESCUE_TIME, ROBBER_SPEED, type PoliceField } from './police';
import type { Difficulty, FinalSummary, GameConfig, HudState, ItemType, Marker, Mode, PcControl, Phase, PlayerStat, PoliceHud, PStatus, Role, RoundResult, StageDef, Stats, Team, TeamSize } from './types';

const ROUND_TIME = 90;
const OVERTIME = 30;
const G = 14;
const THROW_SPEED = 17;
/** 오재미 on the field for a full 3:3 (scaled down for 1:1 / 2:2) */
const MAX_PICKUPS = 14;
const CHAR_R = 0.45;
const WALK_SPEED = 5.3;
const TAGGER_SPEED = 5.75;
const DASH_SPEED = 17;
const DASH_TIME = 0.22;
const DASH_CD = 2.2;
const TAGGER_DASH_CD = 1.8;
const HIT_STUN = 1.25;
const THROW_RELEASE = 0.16;
const THROW_END = 0.42;
const TAG_DIST = 1.15;
// auto-thaw only on close physical contact (no button, no proximity aura)
const THAW_DIST = 1.18;
const FREEZE_CD = 1.2;
const MOTO_TIME = 3;
const ITEMS: ItemType[] = ['moto', 'ufo', 'banana', 'missile', 'jelly'];
const ITEM_NAMES: Record<ItemType, string> = { moto: '🏍️ 오토바이', ufo: '🛸 UFO', banana: '🍌 바나나', missile: '🚀 미사일', jelly: '🟢 젤리슬라임' };

type StunType = 'hit' | 'slip' | 'missile' | 'ufo' | 'bump' | null;

interface Diff {
  react: number; aimErr: number; throwMin: number; throwMax: number; dodgeProb: number; lead: number; think: number; dist: number;
  freezeDist: number; dangerDist: number; fleeDist: number; rescueSafe: number; tagLead: number; tagDashProb: number; hesitate: number;
  /** base freeze decisions per second once the alarm fills (scaled up by closeness + danger) */
  freezeRate: number;
  /** inside this distance the runner freezes instantly (no dice roll) */
  freezeClose: number;
}
const DIFF: Record<Difficulty, Diff> = {
  easy: { react: 0.4, aimErr: 1.6, throwMin: 1.7, throwMax: 2.7, dodgeProb: 0.4, lead: 0.45, think: 0.3, dist: 10.5, freezeDist: 3.0, dangerDist: 4.5, fleeDist: 8, rescueSafe: 5.5, tagLead: 0.35, tagDashProb: 0.35, hesitate: 0.25, freezeRate: 5, freezeClose: 1.9 },
  normal: { react: 0.25, aimErr: 1.0, throwMin: 1.15, throwMax: 1.9, dodgeProb: 0.62, lead: 0.75, think: 0.22, dist: 9.5, freezeDist: 3.5, dangerDist: 5.5, fleeDist: 9.5, rescueSafe: 7, tagLead: 0.6, tagDashProb: 0.6, hesitate: 0.1, freezeRate: 7, freezeClose: 2.0 },
  hard: { react: 0.15, aimErr: 0.62, throwMin: 0.8, throwMax: 1.35, dodgeProb: 0.8, lead: 0.92, think: 0.16, dist: 8.5, freezeDist: 3.8, dangerDist: 6.5, fleeDist: 11, rescueSafe: 8.5, tagLead: 0.8, tagDashProb: 0.85, hesitate: 0.03, freezeRate: 9, freezeClose: 2.1 },
};

interface AIState {
  think: number; goal: THREE.Vector3 | null; target: Char | null; throwCd: number; strafe: number; seen: WeakSet<Projectile>;
  itemCd: number; dodgeT: number; dodgeDir: THREE.Vector3; steerSide: number; fleeDir: THREE.Vector3; rescue: Char | null;
  panic: number; hesitate: number; wanderT: number; alarm: number;
  /** A* waypoints toward `pathGoal` */
  path: THREE.Vector2[]; pathGoal: THREE.Vector3; pathT: number;
  /** stuck detection */
  lastPos: THREE.Vector3; stuckT: number; unstickT: number; unstickDir: THREE.Vector3; stuckCount: number;
}
interface RoundStats { thaws: number; items: number; out: boolean }

interface Char {
  id: number; name: string; team: Team; role: Role; animal: PlayerStat['animal']; isPlayer: boolean; m: CharModel;
  pos: THREE.Vector3; vel: THREE.Vector3; facing: number; move: THREE.Vector3;
  status: PStatus; bag: boolean;
  stun: number; stunMax: number; stunEl: number; stunType: StunType; lift: number; recover: number; invuln: number; knock: THREE.Vector3;
  dashT: number; dashCd: number; dashDir: THREE.Vector3;
  throwT: number; throwTarget: THREE.Vector3; throwReleased: boolean; pickT: number;
  item: ItemType | null; motoT: number; jellyT: number; bumpCd: number; bananaActive: boolean;
  freezeCd: number; iceT: number; thawT: number; grace: number; outT: number; blinkT: number; tagAnim: number; stepT: number;
  roundWon: boolean; finalWon: boolean;
  walkPhase: number; spawnTimer: number;
  st: Stats; rs: RoundStats; label: THREE.Sprite | null; ai: AIState;
  remote: boolean; netPos: THREE.Vector3; netFacing: number;
  /** host: a fresh position report from this guest exists for the current round */
  hasNet: boolean;
}

interface Projectile { mesh: THREE.Object3D; pos: THREE.Vector3; vel: THREE.Vector3; owner: Char; age: number; alive: boolean; nearC: Char | null; nearD: number; hit: boolean }
interface Pickup { mesh: THREE.Group; x: number; z: number; age: number }
interface FlyBag { mesh: THREE.Object3D; from: THREE.Vector3; char: Char; t: number }
interface ItemBox { mesh: THREE.Group; x: number; z: number; respawn: number; active: boolean }
interface Banana { mesh: THREE.Mesh; x: number; z: number; owner: Char; life: number }
interface Homing { kind: 'missile' | 'slime'; mesh: THREE.Object3D; pos: THREE.Vector3; vel: THREE.Vector3; owner: Char; target: Char; life: number }

export interface GameCallbacks {
  onHud?: (h: HudState) => void;
  onToast?: (text: string, color: string) => void;
  onFinal?: (f: FinalSummary) => void;
  /** host → clients (snapshots/toasts), client → host (inputs) */
  onNet?: (msg: NetMsg) => void;
  /** PC: Esc/P 키로 메뉴 열기·닫기 요청 */
  onPauseKey?: () => void;
}

const STATUS_CODES: PStatus[] = ['alive', 'frozen', 'out'];
const STUN_CODES: StunType[] = [null, 'hit', 'slip', 'missile', 'ufo', 'bump'];
const q2 = (n: number) => Math.round(n * 100) / 100;
const STAT_KEYS: (keyof Stats)[] = ['roundsWon', 'outs', 'freezes', 'thaws', 'tags', 'survive', 'items', 'dashes', 'hits', 'hitsTaken', 'throws', 'dodges'];

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const ZERO = new THREE.Vector3();

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
function angleDiff(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
const emptyStats = (): Stats => ({ roundsWon: 0, outs: 0, freezes: 0, thaws: 0, tags: 0, survive: 0, items: 0, dashes: 0, hits: 0, hitsTaken: 0, throws: 0, dodges: 0 });

export class Game {
  cfg: GameConfig; cb: GameCallbacks; sfx: Sfx; mode: Mode; demo: boolean; diff: Diff; totalRounds: number; stage: StageDef | null; theme: ThemeDef;
  container: HTMLElement; renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; world: WorldData; fx: Effects; ro: ResizeObserver;
  nav!: NavGrid;
  /** 경찰과 도둑: 감옥 · 탈출구 구조물과 규칙 상태 (다른 모드에서는 사용하지 않음) */
  police: PoliceField | null = null;
  policeStarts: { cops: THREE.Vector2[]; robbers: THREE.Vector2[] } = { cops: [], robbers: [] };
  policeT = 0; rescueT = 0; exitOpen = false; rescuer: Char | null = null;
  policeLabels: THREE.Sprite[] = []; exitLabels: THREE.Sprite[] = [];
  /** players per team (오재미 1 / 2 / 3; 얼음땡 keeps 3 for layout purposes) */
  teamSize: TeamSize = 3;
  /** field 오재미 cap: 14 for 3:3, ~11 for 2:2, ~8 for 1:1 */
  get maxPickups() { return Math.round(MAX_PICKUPS * (0.45 + this.chars.length / 11)); }
  chars: Char[] = []; player!: Char;
  projectiles: Projectile[] = []; pickups: Pickup[] = []; flyBags: FlyBag[] = []; items: ItemBox[] = []; bananas: Banana[] = []; homings: Homing[] = [];
  phase: Phase = 'countdown'; phaseT = 0; round = 1; time = ROUND_TIME; overtime = false;
  scores = { red: 0, blue: 0 }; roundResults: RoundResult[] = []; roundWinner: 'tagger' | 'runner' | Team | null = null; roundReason = '';
  taggerOrder: number[] = []; hero: Char | null = null; spectateIdx = 0; finalSummary: FinalSummary | null = null;
  startFlash = 0; lastCountdown = -1; countdownLen: number;
  netRole: 'off' | 'host' | 'client' = 'off'; netT = 0; inT = 0; lastIn = '';
  /** bumps on every round reset so stale guest position reports are dropped (host) */
  netEpoch = 0; netSeq = 0; lastSeq = -1; netEp = -1;
  pendingSnap: ReturnType<Game['makeSnapshot']> | null = null;
  netProj: THREE.Object3D[] = []; netBananas: THREE.Mesh[] = []; netHoming: THREE.Object3D[] = [];
  elapsed = 0; lastDt = 0.016; hudTimer = 0; spawnTimer = 0; shake = 0; keys = new Set<string>(); joy = { x: 0, y: 0 };
  /** PC 조작 방식 (모바일 터치는 무시) */
  controlMode: PcControl = 'keyboard';
  mouseClient = { x: 0, y: 0 };
  mouseOnScreen = false;
  mouseMoveTarget = new THREE.Vector3();
  mouseMoveTargetValid = false;
  mouseMoveMarker!: THREE.Mesh;
  mouseAim = new THREE.Vector3();
  mouseAimValid = false;
  mouseRay = new THREE.Raycaster();
  mousePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  mouseMarker!: THREE.Mesh;
  raf = 0; disposed = false; paused = false; lastTime = 0;
  aimArrow: THREE.Mesh; reticle: THREE.Mesh; snowPts: THREE.Points | null = null;
  camPos = new THREE.Vector3(); camLook = new THREE.Vector3(); camSign = 1; demoFocus: Char | null = null; demoT = 0;
  boxGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  boxMat = new THREE.MeshLambertMaterial({ color: 0xff7ac8, emissive: 0x552244 });
  ribMat = lam(0xffe14a, { emissive: 0x554400 });
  bananaGeo = new THREE.TorusGeometry(0.26, 0.08, 6, 12, Math.PI * 1.1);
  moundGeo = new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  pickRingGeo = new THREE.RingGeometry(0.36, 0.48, 20);
  pickRingMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
  slimeMat = new THREE.MeshLambertMaterial({ color: 0x5ee67a, emissive: 0x1f7a33, transparent: true, opacity: 0.85 });

  constructor(container: HTMLElement, cfg: GameConfig, cb: GameCallbacks, sfx: Sfx) {
    this.container = container; this.cfg = cfg; this.cb = cb; this.sfx = sfx;
    this.mode = cfg.mode; this.demo = !!cfg.demo; this.diff = DIFF[cfg.difficulty];
    this.netRole = cfg.net ?? 'off';
    this.controlMode = cfg.pcControl ?? 'keyboard';
    if (cfg.mode === 'ojaemi') {
      const reds = cfg.slots.filter((s) => s.team === 'red').length;
      this.teamSize = (cfg.teamSize ?? Math.min(3, Math.max(1, reds))) as TeamSize;
    }
    this.totalRounds = cfg.mode === 'icetag' ? 3 : 1;
    this.stage = cfg.stage ? STAGES[cfg.stage - 1] : null;
    this.countdownLen = this.demo ? 1.2 : 3;
    const quality = cfg.quality ?? 'high';
    const cine = !!cfg.cinematic;
    const mobile = Math.min(window.innerWidth, window.innerHeight) < 700 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const shadows = quality === 'high' && (!this.demo || cine);

    this.renderer = new THREE.WebGLRenderer({ antialias: quality === 'high' && (!this.demo || cine), powerPreference: 'high-performance' });
    // phones render a lot of pixels; cap resolution (low quality / online guests get the lightest path)
    const maxPr = this.demo ? (cine ? 1.5 : 1.25) : quality === 'low' ? (mobile ? 1.25 : 1.5) : mobile ? 1.75 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPr));
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    const theme = THEMES[cfg.map];
    this.theme = theme;
    this.scene = new THREE.Scene();
    this.scene.background = skyTexture(theme.skyTop, theme.sky, theme.fog);
    this.scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
    setupRenderer(this.renderer, this.scene, theme.env);
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200);

    // Toon lighting (Genshin-style): ONE key sun for a clean 2-tone ramp + sky ambient that
    // lights the tinted shadow side. Rim light is done in the shader, so no extra fill lights.
    this.scene.add(new THREE.HemisphereLight(theme.hemi[0], theme.hemi[1], theme.hemi[2] * 1.05));
    const sun = new THREE.DirectionalLight(theme.sun[0], theme.sun[1] * 1.2);
    sun.position.set(9, 18, 11);
    sun.castShadow = shadows;
    if (shadows) {
      const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
      this.renderer.shadowMap.type = THREE.PCFShadowMap; // crisper cel-style cast shadows
      sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
      const sc = sun.shadow.camera;
      sc.left = -24; sc.right = 24; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 70;
      sun.shadow.bias = -0.0006;
      sun.shadow.normalBias = 0.025;
      sun.shadow.radius = 1.5;
    }
    this.scene.add(sun);

    // bloom + color grade on high quality (skip tiny background previews to save GPU)
    if (quality === 'high' && (!this.demo || cine) && !(mobile && this.netRole === 'client')) {
      try { this.post = new ToonPost(this.renderer, this.scene, this.camera, theme.night); } catch { this.post = null; }
    }

    this.world = buildWorld(this.scene, cfg.map);
    // 경찰과 도둑: 감옥 창살 충돌체를 길찾기 격자(NavGrid)보다 먼저 추가한다
    if (this.mode === 'police') this.police = buildPoliceField(this.scene, this.world);
    // walkability grid for AI path finding (obstacles inflated by body radius + margin)
    this.nav = new NavGrid(this.world.colliders, CHAR_R + 0.1);
    if (theme.night) {
      for (const lp of this.world.lampPositions.slice(0, 4)) {
        const pl = new THREE.PointLight(0xffc27a, 14, 15, 2);
        pl.position.copy(lp);
        this.scene.add(pl);
      }
    }
    this.fx = new Effects(this.scene);
    if (this.police) this.initPolice();

    cfg.slots.forEach((s, i) => {
      const isPlayer = i === cfg.playerIndex && !this.demo;
      const m = buildCharacter(s.animal, s.team, isPlayer, s.outfit);
      m.root.scale.setScalar(1.15);
      this.scene.add(m.root);
      const c: Char = {
        id: i, name: s.name, team: s.team, role: 'runner', animal: s.animal, isPlayer, m,
        pos: new THREE.Vector3(), vel: new THREE.Vector3(), facing: 0, move: new THREE.Vector3(),
        status: 'alive', bag: false,
        stun: 0, stunMax: 1, stunEl: 0, stunType: null, lift: 0, recover: 0, invuln: 0, knock: new THREE.Vector3(),
        dashT: 0, dashCd: 0, dashDir: new THREE.Vector3(),
        throwT: -1, throwTarget: new THREE.Vector3(), throwReleased: false, pickT: 0,
        item: null, motoT: 0, jellyT: 0, bumpCd: 0, bananaActive: false,
        freezeCd: 0, iceT: 0, thawT: 0, grace: 0, outT: 0, blinkT: rand(1, 3), tagAnim: 0, stepT: 0,
        roundWon: false, finalWon: false, walkPhase: Math.random() * 6, spawnTimer: rand(0.5, 1.5),
        st: emptyStats(), rs: { thaws: 0, items: 0, out: false }, label: null,
        remote: cfg.net === 'host' && s.human && i !== cfg.playerIndex, netPos: new THREE.Vector3(), netFacing: 0, hasNet: false,
        ai: { think: Math.random() * 0.3, goal: null, target: null, throwCd: rand(0.6, 1.4), strafe: Math.random() < 0.5 ? 1 : -1, seen: new WeakSet(), itemCd: 0, dodgeT: 0, dodgeDir: new THREE.Vector3(), steerSide: 1, fleeDir: new THREE.Vector3(1, 0, 0), rescue: null, panic: rand(0.85, 1.25), hesitate: 0, wanderT: 0, alarm: 0,
          path: [], pathGoal: new THREE.Vector3(1e9, 0, 1e9), pathT: 0, lastPos: new THREE.Vector3(), stuckT: 0, unstickT: 0, unstickDir: new THREE.Vector3(), stuckCount: 0 },
      };
      this.chars.push(c);
    });
    this.player = this.chars[Math.max(0, cfg.playerIndex)];
    this.camSign = this.mode === 'ojaemi' ? (this.player.team === 'red' ? 1 : -1) : 1;

    // aim helpers (오재미)
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 1.9); arrowShape.lineTo(0.38, 1.3); arrowShape.lineTo(0.14, 1.3); arrowShape.lineTo(0.14, 0.8);
    arrowShape.lineTo(-0.14, 0.8); arrowShape.lineTo(-0.14, 1.3); arrowShape.lineTo(-0.38, 1.3); arrowShape.closePath();
    const ag = new THREE.ShapeGeometry(arrowShape);
    ag.rotateX(Math.PI / 2); ag.scale(1, 1, -1); ag.rotateY(Math.PI);
    this.aimArrow = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    this.aimArrow.position.y = 0.05;
    this.aimArrow.visible = false;
    this.scene.add(this.aimArrow);
    this.reticle = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.82, 4, 1), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    this.reticle.rotation.x = -Math.PI / 2;
    this.reticle.visible = false;
    this.scene.add(this.reticle);
    // 마우스 조작 모드의 바닥 조준점
    this.mouseMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.46, 32),
      new THREE.MeshBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.mouseMarker.rotation.x = -Math.PI / 2;
    this.mouseMarker.visible = false;
    this.mouseMarker.renderOrder = 5;
    this.scene.add(this.mouseMarker);
    // Click-to-move destination ring (separate from the continuously-following aim marker).
    this.mouseMoveMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.52, 32),
      new THREE.MeshBasicMaterial({ color: 0x7df0aa, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.mouseMoveMarker.rotation.x = -Math.PI / 2;
    this.mouseMoveMarker.visible = false;
    this.mouseMoveMarker.renderOrder = 4;
    this.scene.add(this.mouseMoveMarker);

    if (cfg.map === 'snow') {
      const N = 600;
      const arr = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { arr[i * 3] = rand(-22, 22); arr[i * 3 + 1] = rand(0, 18); arr[i * 3 + 2] = rand(-26, 26); }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      this.snowPts = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.13, transparent: true, opacity: 0.9, depthWrite: false }));
      this.scene.add(this.snowPts);
    }

    this.spawnItemBoxes(4);
    this.taggerOrder = this.makeTaggerOrder();
    this.resetRound();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    if (!this.demo) {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('blur', this.onBlur);
      window.addEventListener('mousemove', this.onMouseMove);
      window.addEventListener('mouseup', this.onMouseUp);
      this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
      this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    }
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------ lifecycle
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    this.post?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.post?.setSize(w, h, this.renderer.getPixelRatio());
    this.camera.aspect = w / h;
    const a = w / h;
    // keep a consistent HORIZONTAL field of view (~44°) so the playfield width feels the same on
    // phones, tablets and monitors; clamp so portrait isn't fish-eyed and ultrawide isn't zoomed in
    const hFov = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(46, 70, THREE.MathUtils.smoothstep(a, 0.8, 1.3)));
    const vFov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hFov / 2) / a));
    this.camera.fov = THREE.MathUtils.clamp(vFov, 40, 70);
    this.camera.updateProjectionMatrix();
  }

  onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    // Space/Tab/방향키는 브라우저 기본 동작(스크롤·포커스 이동)을 항상 차단
    if (isSystemKey(k)) e.preventDefault();
    if (this.keys.has(k)) return; // 꾹 누름 반복 입력 무시 (액션은 한 번만)
    this.keys.add(k);
    const action = actionForKey(k);
    if (action === 'pause') { this.cb.onPauseKey?.(); return; }
    if (this.demo || this.paused || !action) return;
    if (action === 'primary') this.pressPrimary();
    else if (action === 'dash') this.pressDash();
    else if (action === 'item') this.pressItem();
    else if (action === 'spectate') this.pressSpectateNext();
  };
  onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()); };
  /** 창 포커스를 잃으면 눌림 상태 초기화 (키가 계속 눌린 채로 멈추는 현상 방지) */
  onBlur = () => { this.keys.clear(); this.mouseMoveTargetValid = false; this.mouseOnScreen = false; this.mouseAimValid = false; };
  /**
   * PC 마우스
   * - 키보드 모드: 마우스 입력은 게임 조작에 사용하지 않음 (선택한 키보드 모드 그대로)
   * - 마우스 모드: 좌클릭=해당 위치로 이동 · 커서=바라보기/조준 · 우클릭=커서 방향 대시 · 휠클릭=아이템
   *   주액션(던지기/얼음)은 Space/J. 좌클릭 이동과 던지기를 겹치지 않게 의도적으로 분리.
   */
  onMouseDown = (e: MouseEvent) => {
    if (this.demo || this.paused || this.controlMode !== 'mouse') return;
    this.trackMouse(e);
    this.updateMouseAim();
    if (e.button === 0) {
      // 좌클릭한 지점으로 자동 이동. WASD를 입력하면 키보드 이동이 우선.
      if (this.mouseAimValid) {
        this.mouseMoveTarget.copy(this.mouseAim);
        this.mouseMoveTargetValid = true;
        this.mouseMoveMarker.position.set(this.mouseAim.x, 0.055, this.mouseAim.z);
        this.mouseMoveMarker.visible = true;
        this.fx.ring(tmpV.set(this.mouseAim.x, 0.06, this.mouseAim.z), 0x7df0aa, 1.3, 0.28);
      }
    } else if (e.button === 2) {
      // 우클릭으로 커서 방향 대시.
      const p = this.player;
      const dir = tmpV.set(this.mouseAim.x - p.pos.x, 0, this.mouseAim.z - p.pos.z);
      if (this.mouseAimValid && dir.lengthSq() > 0.01) this.pressDashDir(dir.normalize());
      else this.pressDash();
    } else if (e.button === 1) {
      // 가운데 클릭은 아이템 단축 조작.
      this.pressItem();
    }
  };
  onMouseMove = (e: MouseEvent) => { this.trackMouse(e); };
  onMouseUp = (_e: MouseEvent) => { /* click-to-move persists until the target is reached */ };
  onContextMenu = (e: Event) => { e.preventDefault(); };

  trackMouse(e: MouseEvent) {
    this.mouseClient.x = e.clientX;
    this.mouseClient.y = e.clientY;
    const r = this.container.getBoundingClientRect();
    this.mouseOnScreen =
      e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }

  setControlMode(m: PcControl) {
    this.controlMode = m;
    this.mouseMoveTargetValid = false;
    this.mouseAimValid = false;
    this.mouseMarker.visible = false;
    this.mouseMoveMarker.visible = false;
  }

  /** 마우스 커서가 가리키는 바닥 지점 (캐릭터 바라보기 / 던지기 조준 / 클릭 이동 목표) */
  updateMouseAim() {
    this.mouseAimValid = false;
    if (this.demo || this.controlMode !== 'mouse' || !this.mouseOnScreen) return;
    const r = this.container.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const nx = ((this.mouseClient.x - r.left) / r.width) * 2 - 1;
    const ny = -(((this.mouseClient.y - r.top) / r.height) * 2 - 1);
    this.mouseRay.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    if (this.mouseRay.ray.intersectPlane(this.mousePlane, this.mouseAim)) this.mouseAimValid = true;
  }
  setJoystick(x: number, y: number) { this.joy.x = x; this.joy.y = y; }

  toast(text: string, color: string) { if (!this.demo) this.cb.onToast?.(text, color); }
  toastFor(c: Char, text: string, color: string) {
    if (c.isPlayer) this.toast(text, color);
    else if (c.remote) this.cb.onNet?.({ t: 'toast', to: c.id, text, color });
  }
  near(c: Char) { return this.demo ? false : c.pos.distanceToSquared(this.player.pos) < 400; }

  // ------------------------------------------------------------ helpers
  get tagger(): Char { return this.chars.find((c) => c.role === 'tagger') ?? this.chars[0]; }
  /**
   * 술래가 더 빠르고 대시 재사용이 짧은 모드 (얼음땡 전용 — 원래 동작 그대로).
   * 경찰과 도둑은 도망자에게 '얼음' 같은 방어 수단이 없으므로 경찰/도둑의 이동속도와 대시 성능을 같게 둔다.
   */
  get chaseMode() { return this.mode === 'icetag'; }
  get runners(): Char[] { return this.chars.filter((c) => c.role === 'runner'); }
  isEnemy(a: Char, b: Char) { return a !== b && (this.mode === 'icetag' ? a.role !== b.role : a.team !== b.team); }
  enemyList(c: Char) { return this.chars.filter((e) => this.isEnemy(c, e) && e.status === 'alive'); }
  nearestEnemy(c: Char, maxD = Infinity, filter?: (e: Char) => boolean) {
    let best: Char | null = null, bd = maxD;
    for (const e of this.enemyList(c)) {
      if (filter && !filter(e)) continue;
      const d = e.pos.distanceTo(c.pos);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  makeTaggerOrder(): number[] {
    const ids = this.chars.map((c) => c.id);
    if (this.mode !== 'icetag') return [];
    if (this.stage || this.demo) return shuffle(ids.filter((id) => this.stage ? id !== this.player.id : true)).slice(0, 3);
    if (this.netRole === 'host') {
      // online: human players get to be tagger first
      const humans = shuffle(this.chars.filter((c) => c.isPlayer || c.remote).map((c) => c.id));
      const ai = shuffle(ids.filter((id) => !humans.includes(id)));
      return [...humans, ...ai].slice(0, 3);
    }
    const others = shuffle(ids.filter((id) => id !== this.player.id)).slice(0, 2);
    return shuffle([this.player.id, ...others]);
  }

  setLabel(c: Char, text: string | null, color = '#ffffff', scale = 0.9) {
    if (c.label) { this.fx.removeLabel(c.label); c.label = null; }
    if (text) c.label = this.fx.label(text, color, scale);
  }

  // ------------------------------------------------------------ round flow
  resetRound() {
    this.netEpoch++;
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const p of this.pickups) this.scene.remove(p.mesh);
    for (const f of this.flyBags) this.scene.remove(f.mesh);
    for (const b of this.bananas) this.scene.remove(b.mesh);
    for (const h of this.homings) this.scene.remove(h.mesh);
    this.projectiles = []; this.pickups = []; this.flyBags = []; this.bananas = []; this.homings = [];
    this.fx.clearTexts();
    const taggerId = this.mode === 'icetag' ? this.taggerOrder[(this.round - 1) % 3] : -1;
    const policeStart = this.mode === 'police' ? this.assignPoliceRoles() : null;
    let ri = 0;
    const idx = { red: 0, blue: 0 };
    for (const c of this.chars) {
      if (this.mode === 'icetag') {
        c.role = c.id === taggerId ? 'tagger' : 'runner';
        c.team = c.role === 'tagger' ? 'red' : 'blue';
        c.m.setTeam(c.team);
        const s = c.role === 'tagger' ? this.world.startTagger : this.world.startRunners[ri++ % 5];
        c.pos.set(s.x, 0, s.y);
        c.facing = Math.atan2(-s.x, -s.y);
      } else if (policeStart) {
        const s = policeStart.get(c.id)!;
        c.pos.set(s.x, 0, s.y);
        c.facing = Math.atan2(-s.x, -s.y);
      } else {
        c.role = 'runner';
        const list = c.team === 'red' ? this.world.startRed : this.world.startBlue;
        // 1:1 → center spot, 2:2 → the two flank spots, 3:3 → all three
        const order = this.teamSize === 1 ? [1] : this.teamSize === 2 ? [0, 2] : [0, 1, 2];
        const s = list[order[idx[c.team]++ % order.length]];
        c.pos.set(s.x, 0, s.y);
        c.facing = c.team === 'red' ? Math.PI : 0;
      }
      c.vel.set(0, 0, 0); c.knock.set(0, 0, 0); c.move.set(0, 0, 0);
      c.status = 'alive'; c.bag = false;
      c.stun = 0; c.stunType = null; c.lift = 0; c.recover = 0; c.invuln = 0;
      c.dashT = 0; c.dashCd = 0; c.throwT = -1; c.pickT = 0;
      c.item = null; c.motoT = 0; c.jellyT = 0; c.bananaActive = false;
      c.hasNet = false; c.netPos.copy(c.pos); c.netFacing = c.facing;
      c.freezeCd = 0; c.iceT = 0; c.thawT = 0; c.grace = 0; c.outT = 0; c.tagAnim = 0;
      c.roundWon = false; c.rs = { thaws: 0, items: 0, out: false };
      c.m.root.visible = true; c.m.root.scale.setScalar(1.15);
      c.m.ufoBeam.visible = false; c.m.moto.visible = false; c.m.jellyBlob.visible = false; c.m.stars.visible = false; c.m.ice.visible = false;
      c.ai.goal = null; c.ai.target = null; c.ai.rescue = null; c.ai.dodgeT = 0; c.ai.throwCd = rand(0.4, 1.4); c.ai.wanderT = 0;
      c.ai.path.length = 0; c.ai.pathT = 0; c.ai.stuckT = 0; c.ai.stuckCount = 0; c.ai.unstickT = 0; c.ai.lastPos.copy(c.pos);
      this.setLabel(c, this.mode === 'icetag' && c.role === 'tagger' ? '술래' : null, '#ff6b6b', 1.0);
      if (policeStart) this.setLabel(c, c.role === 'tagger' ? '🚓 경찰' : '🏃 도둑', c.role === 'tagger' ? '#8fbcff' : '#ffa0a0', 0.8);
    }
    for (const it of this.items) { it.active = true; it.respawn = 0; it.mesh.visible = true; }
    if (this.mode === 'ojaemi') {
      // opening 오재미 scale with the head count (6 players → 8, 2 players → 4)
      for (let i = 0; i < 2 + this.chars.length; i++) this.spawnAtPoint();
      for (const c of this.chars) this.spawnAround(c.pos.x, c.pos.z, 1.8, 3.2);
    }
    this.phase = 'countdown'; this.phaseT = 0; this.time = this.mode === 'police' ? POLICE_TIME : ROUND_TIME; this.overtime = false; this.lastCountdown = -1;
    this.hero = null; this.spectateIdx = 0;
    if (this.mode === 'police') {
      this.resetPolice();
      if (!this.demo) { const pp = this.player; this.toast(pp.role === 'tagger' ? '🚓 당신은 경찰! 도둑을 잡아 감옥에 가두세요!' : '🏃 당신은 도둑! 경찰을 피해 탈출구로 도망치세요!', pp.role === 'tagger' ? '#8fbcff' : '#ffb3b3'); }
    }
    if (this.mode === 'icetag' && !this.demo && this.netRole !== 'client') {
      const p = this.player;
      this.toast(p.role === 'tagger' ? '👹 이번 라운드 당신이 술래! 도망팀을 잡아라!' : `🏃 술래는 ${this.tagger.name}! 도망치세요!`, p.role === 'tagger' ? '#ff8a8a' : '#9fdcff');
    }
  }

  restart() {
    this.round = 1; this.scores = { red: 0, blue: 0 }; this.roundResults = []; this.overtime = false; this.finalSummary = null;
    for (const c of this.chars) c.st = emptyStats();
    this.taggerOrder = this.makeTaggerOrder();
    this.resetRound();
  }

  checkIceTagEnd() {
    const rs = this.runners;
    let out = 0, alive = 0;
    for (const r of rs) { if (r.status === 'out') out++; else if (r.status === 'alive') alive++; }
    if (out === rs.length) this.endRound('tagger', 'all_out');
    else if (alive === 0) this.endRound('tagger', 'all_frozen');
    else if (this.time <= 0) this.endRound('runner', 'timeout');
  }

  endRound(winner: 'tagger' | 'runner' | Team, reason: string) {
    this.phase = 'roundEnd'; this.phaseT = 0; this.time = Math.max(0, this.time);
    this.roundWinner = winner; this.roundReason = reason;
    const p = this.player;
    let playerWon = false, goalMet = false, survivors = 0;
    for (const c of this.chars) { c.throwT = -1; c.dashT = 0; c.move.set(0, 0, 0); c.ai.goal = null; }
    if (this.mode === 'icetag') {
      survivors = this.runners.filter((r) => r.status !== 'out').length;
      for (const c of this.chars) {
        c.roundWon = (c.role === 'tagger') === (winner === 'tagger');
        if (c.roundWon) c.st.roundsWon++;
      }
      playerWon = p.roundWon;
      if (this.stage) goalMet = this.evalGoal(winner);
      this.hero = winner === 'tagger' ? this.tagger : (p.role === 'runner' && p.status !== 'out' ? p : this.runners.find((r) => r.status !== 'out') ?? p);
      this.toast(winner === 'tagger' ? '👹 술래 승리!' : '🏃 도망팀 승리!', winner === 'tagger' ? '#ff8a8a' : '#9fdcff');
    } else if (this.mode === 'police') {
      survivors = this.runners.filter((r) => r.status !== 'frozen').length;
      for (const c of this.chars) {
        c.roundWon = (c.role === 'tagger') === (winner === 'tagger');
        if (c.roundWon) c.st.roundsWon++;
      }
      playerWon = p.roundWon;
      const cop = p.role === 'tagger' ? p : this.chars.find((c) => c.role === 'tagger') ?? p;
      const free = p.role === 'runner' && p.status === 'alive' ? p : this.runners.find((r) => r.status === 'alive');
      this.hero = winner === 'tagger' ? cop : free ?? p;
      if (winner === 'tagger') this.toast('🚓 경찰 승리! 도둑을 모두 체포!', '#8fbcff');
      else this.toast(reason === 'escaped' ? '🚪 도둑 탈출 성공! 도둑팀 승리!' : '⏰ 시간 종료! 도둑팀 승리!', '#ffb3b3');
    } else {
      for (const c of this.chars) c.roundWon = c.team === winner;
      playerWon = p.team === winner;
      this.hero = p;
    }
    this.roundResults.push({ winner, reason, playerWon, goalMet, survivors });
    if (!this.demo) { this.sfx.whistle(); if (playerWon) this.sfx.win(); else this.sfx.lose(); }
  }

  evalGoal(winner: 'tagger' | 'runner' | Team): boolean {
    const p = this.player;
    switch (this.stage!.kind) {
      case 'survive': case 'items': return winner === 'runner' && p.status !== 'out';
      case 'rescue': return p.rs.thaws >= 1;
      case 'noloss': return winner === 'runner' && this.runners.every((r) => r.status !== 'out');
    }
  }

  stageStars(): number {
    if (!this.stage) return 0;
    const p = this.player;
    const met = this.roundResults.filter((r) => r.goalMet).length;
    switch (this.stage.kind) {
      case 'survive': case 'noloss': return met;
      case 'rescue': { const t = p.st.thaws; return t >= 7 ? 3 : t >= 5 ? 2 : t >= 3 ? 1 : 0; }
      case 'items': return p.st.items >= 2 ? met : 0;
    }
  }

  enterFinal() {
    this.phase = 'final'; this.phaseT = 0;
    for (const c of this.chars) {
      if (c.status === 'out') { c.status = 'alive'; c.m.root.visible = true; c.m.root.scale.setScalar(1.15); c.outT = 0; }
      c.stun = 0; c.stunType = null; c.lift = 0; c.m.ice.visible = false; c.m.ufoBeam.visible = false;
      this.setLabel(c, null);
      c.finalWon = this.mode === 'icetag' ? c.st.roundsWon >= 2 : this.mode === 'police' ? c.roundWon : (this.scores.red === this.scores.blue ? true : this.scores[c.team] > this.scores[c.team === 'red' ? 'blue' : 'red']);
    }
    this.hero = this.player;
    this.finalSummary = this.computeFinal();
    if (!this.demo) {
      this.cb.onFinal?.(this.finalSummary);
      if (this.finalSummary.playerWon) this.sfx.win(); else this.sfx.lose();
    }
  }

  computeFinal(): FinalSummary {
    const p = this.player;
    let playerWon = false, draw = false;
    if (this.mode === 'icetag') playerWon = p.st.roundsWon >= 2;
    else if (this.mode === 'police') playerWon = p.roundWon;
    else {
      draw = this.scores.red === this.scores.blue;
      playerWon = !draw && this.scores[p.team] > this.scores[p.team === 'red' ? 'blue' : 'red'];
    }
    const stars = this.stageStars();
    const coins = 60 + (this.mode === 'icetag' ? 30 * p.st.roundsWon : playerWon ? 100 : draw ? 50 : 0) + 5 * (p.st.thaws + p.st.hits + p.st.tags) + 40 * stars;
    return {
      mode: this.mode, playerWon, draw, coins, stars, stage: this.stage ? this.stage.id : null,
      roundResults: this.roundResults.map((r) => ({ ...r })), players: this.playerStats(), red: this.scores.red, blue: this.scores.blue,
      goalText: this.stage ? this.stage.goal : '',
    };
  }

  playerStats(): PlayerStat[] {
    return this.chars.map((c) => ({ ...c.st, name: c.name, animal: c.animal, team: c.team, role: c.role, isPlayer: c.isPlayer, status: c.status, hasBag: c.bag, stunned: c.stun > 0 }));
  }

  // ------------------------------------------------------------ player input
  canAct(c: Char) { return this.phase === 'playing' && c.stun <= 0 && c.status === 'alive' && !this.copHeld(c); }
  /** 경찰과 도둑: 시작 직후 경찰은 잠시 출동 대기 (이동 · 대시 · 체포 불가) */
  copHeld(c: Char) { return this.mode === 'police' && c.role === 'tagger' && this.policeT < COP_HOLD; }
  playerMoveVec() {
    let x = this.joy.x, y = this.joy.y;
    const k = this.keys;
    if (k.has('w') || k.has('arrowup')) y += 1;
    if (k.has('s') || k.has('arrowdown')) y -= 1;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    // 마우스 조작: 우클릭을 누른 채로 커서 쪽으로 이동 (키는 그대로도 사용 가능, 키 입력이 우선)
    if (x === 0 && y === 0 && this.controlMode === 'mouse' && this.mouseMoveTargetValid && !this.demo) {
      const dx = this.mouseMoveTarget.x - this.player.pos.x, dz = this.mouseMoveTarget.z - this.player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.42) {
        const s = Math.min(1, d / 1.4); // 목적지 가까이서 부드럽게 감속
        return new THREE.Vector3((dx / d) * s, 0, (dz / d) * s);
      }
      this.mouseMoveTargetValid = false;
      this.mouseMoveMarker.visible = false;
      return new THREE.Vector3();
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return new THREE.Vector3(x * this.camSign, 0, -y * this.camSign);
  }
  // ---- local input (routes to host when this is an online client)
  sendAct(a: string) { this.cb.onNet?.({ t: 'act', a }); }
  pressPrimary() {
    if (this.demo) return;
    if (this.netRole === 'client') { this.sendAct('primary'); return; }
    this.actPrimary(this.player);
  }
  pressDash() {
    if (this.demo) return;
    const mv = this.playerMoveVec();
    const dir = mv.lengthSq() > 0.01 ? mv.clone().normalize() : new THREE.Vector3(Math.sin(this.player.facing), 0, Math.cos(this.player.facing));
    this.pressDashDir(dir);
  }
  /** dash toward an explicit direction (mouse right-click uses the cursor vector) */
  pressDashDir(dir: THREE.Vector3) {
    if (this.demo) return;
    if (this.netRole === 'client') {
      // predict the dash locally so it fires instantly on the guest's screen
      const p = this.player;
      if (this.phase === 'playing' && p.status === 'alive' && p.stun <= 0 && p.dashCd <= 0) {
        p.dashT = DASH_TIME;
        p.dashDir.copy(dir);
        p.dashCd = this.mode === 'icetag' && p.role === 'tagger' ? TAGGER_DASH_CD : DASH_CD;
        p.facing = Math.atan2(dir.x, dir.z);
        this.fx.emit(this.theme.snowy ? 'snow' : 'spark', tmpV.set(p.pos.x, 0.2, p.pos.z), 10, 3, 0.4, 5, 0.9);
        this.sfx.dash();
      }
      this.cb.onNet?.({ t: 'act', a: 'dash', x: q2(dir.x), z: q2(dir.z) });
      return;
    }
    this.actDash(this.player, dir);
  }
  pressItem() {
    if (this.demo) return;
    if (this.netRole === 'client') { this.sendAct('item'); return; }
    this.actItem(this.player);
  }
  pressSpectateNext() { this.spectateIdx++; }

  // ---- actions usable for any character (local player or remote human on the host)
  actPrimary(c: Char) {
    if (this.mode === 'police') return; // 경찰과 도둑: 주 행동 버튼 없음 (닿으면 체포 · 접근하면 구출)
    if (this.mode === 'ojaemi') this.actThrow(c);
    else if (c.role === 'runner') {
      if (!this.canAct(c)) return;
      if (c.freezeCd > 0) { this.toastFor(c, '❄️ 얼음 준비 중...', '#c8d8ff'); return; }
      this.freeze(c);
    }
  }
  actDash(c: Char, mv: THREE.Vector3) {
    if (!this.canAct(c)) return;
    const dir = mv.lengthSq() > 0.01 ? mv.clone().normalize() : new THREE.Vector3(Math.sin(c.facing), 0, Math.cos(c.facing));
    this.startDash(c, dir);
  }
  actItem(c: Char) {
    if (!this.canAct(c) || !c.item) return;
    this.useItem(c);
  }

  // ---- host: inputs from remote humans
  remoteInput(seat: number, x: number, z: number, px?: number, pz?: number, f?: number, ep?: number) {
    const c = this.chars[seat];
    if (!c || !c.remote) return;
    const len = Math.hypot(x, z);
    c.move.set(len > 1 ? x / len : x, 0, len > 1 ? z / len : z);
    // guest-owned position (ignored from a previous round / while stunned / if implausible)
    if (px === undefined || pz === undefined || ep !== this.netEpoch) return;
    if (c.stun > 0 || c.status !== 'alive') return;
    if (!Number.isFinite(px) || !Number.isFinite(pz)) return;
    const jump = Math.hypot(px - c.pos.x, pz - c.pos.z);
    if (c.hasNet && jump > 7) return;
    c.netPos.set(px, 0, pz);
    if (f !== undefined && Number.isFinite(f)) c.netFacing = f;
    c.hasNet = true;
  }
  remoteAction(seat: number, a: string, x = 0, z = 0) {
    const c = this.chars[seat];
    if (!c || !c.remote) return;
    if (a === 'primary') this.actPrimary(c);
    else if (a === 'dash') this.actDash(c, new THREE.Vector3(x, 0, z));
    else if (a === 'item') this.actItem(c);
  }
  dropRemote(seat: number) {
    const c = this.chars[seat];
    if (!c || !c.remote) return;
    c.remote = false;
    c.move.set(0, 0, 0);
    this.toast(`📡 ${c.name}님의 연결이 끊겨 AI가 대신해요`, '#c8d8ff');
  }

  actThrow(c: Char) {
    if (!this.canAct(c) || !c.bag || c.throwT >= 0) return;
    const fwd = tmpV.set(Math.sin(c.facing), 0, Math.cos(c.facing));
    const target = this.findAssistTarget(c, fwd);
    let tp: THREE.Vector3;
    if (target) { tp = new THREE.Vector3(target.pos.x, target.lift + 0.85, target.pos.z); }
    else tp = new THREE.Vector3(c.pos.x + fwd.x * 14, 0.7, c.pos.z + fwd.z * 14);
    this.startThrow(c, tp);
  }

  thawTargetFor(c: Char): Char | null {
    let best: Char | null = null, bd = THAW_DIST;
    for (const f of this.runners) {
      if (f === c || f.status !== 'frozen') continue;
      const d = f.pos.distanceTo(c.pos);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  findAssistTarget(c: Char, fwd: THREE.Vector3): Char | null {
    let best: Char | null = null, bestScore = Infinity;
    for (const e of this.enemyList(c)) {
      const dx = e.pos.x - c.pos.x, dz = e.pos.z - c.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.5 || d > 22) continue;
      const cos = (dx * fwd.x + dz * fwd.z) / d;
      const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
      if (ang > 0.22) continue;
      const s = ang + d * 0.005;
      if (s < bestScore) { bestScore = s; best = e; }
    }
    return best;
  }

  // ------------------------------------------------------------ 얼음땡 actions
  freeze(c: Char) {
    if (c.status !== 'alive' || c.freezeCd > 0 || c.stun > 0) return false;
    c.status = 'frozen'; c.iceT = 0; c.vel.set(0, 0, 0); c.move.set(0, 0, 0); c.dashT = 0; c.throwT = -1;
    c.st.freezes++;
    this.fx.emit('blue', tmpV.set(c.pos.x, 1.2, c.pos.z), 16, 3.5, 0.6, 3, 1.1);
    this.fx.emit('snow', tmpV.set(c.pos.x, 0.6, c.pos.z), 10, 2.5, 0.5, 5, 0.9);
    this.fx.ring(tmpV.set(c.pos.x, 0.08, c.pos.z), 0x9fdcff, 4, 0.4);
    this.fx.floatText('얼음!', '#bfe9ff', tmpV.set(c.pos.x, 2.8, c.pos.z), 1.5);
    this.setLabel(c, '얼음', '#bfe9ff', 0.85);
    if (this.near(c)) this.sfx.freeze();
    this.toastFor(c, '❄️ 얼음! 친구의 땡을 기다려요', '#bfe9ff');
    return true;
  }

  thaw(r: Char, f: Char) {
    if (f.status !== 'frozen') return false;
    f.status = 'alive'; f.thawT = 0.5; f.grace = 0.6; f.freezeCd = FREEZE_CD; f.iceT = 0;
    r.st.thaws++; r.rs.thaws++;
    this.fx.emit('ice', tmpV.set(f.pos.x, 1.2, f.pos.z), 22, 4.5, 0.7, 8, 1.2);
    this.fx.emit('spark', tmpV.set(f.pos.x, 1.4, f.pos.z), 14, 4, 0.6, 1, 1.1);
    this.fx.emit('star', tmpV.set(f.pos.x, 1.8, f.pos.z), 5, 3, 0.7, 4, 1.1);
    this.fx.ring(tmpV.set(f.pos.x, 0.1, f.pos.z), 0xffe14a, 5, 0.45);
    this.fx.floatText('땡!', '#ffe14a', tmpV.set(f.pos.x, 2.9, f.pos.z), 1.7);
    this.setLabel(f, null);
    if (this.near(f)) this.sfx.thaw();
    if (r.isPlayer) this.toast(`✋ 땡! ${f.name} 구조 성공!`, '#ffe14a');
    else if (f.isPlayer) this.toast(`✋ ${r.name}이(가) 땡! 다시 도망쳐요!`, '#ffe14a');
    else this.toast(`${r.name} → ${f.name} 땡!`, '#fff3a0');
    f.ai.think = 0; f.ai.goal = null;
    return true;
  }

  eliminate(r: Char, tg: Char) {
    r.status = 'out'; r.outT = 0; r.st.outs++; r.rs.out = true;
    r.stun = 0; r.stunType = null; r.lift = 0; r.item = null; r.bag = false; r.motoT = 0; r.jellyT = 0; r.vel.set(0, 0, 0);
    r.m.ufoBeam.visible = false; r.m.moto.visible = false; r.m.jellyBlob.visible = false;
    r.ai.goal = null;
    tg.st.tags++;
    this.fx.emit('star', tmpV.set(r.pos.x, 1.6, r.pos.z), 10, 4.5, 0.9, 4, 1.3);
    this.fx.emit('spark', tmpV.set(r.pos.x, 1.2, r.pos.z), 16, 5, 0.6, 3, 1.1);
    this.fx.ring(tmpV.set(r.pos.x, 0.1, r.pos.z), 0xff8a8a, 5, 0.45);
    this.fx.floatText('탈락!', '#ff8a8a', tmpV.set(r.pos.x, 2.8, r.pos.z), 1.6);
    this.setLabel(r, null);
    if (this.near(r)) { this.sfx.tag(); this.sfx.out(); }
    if (r.isPlayer) { this.toast('💥 술래에게 잡혔다! 탈락...', '#ff8a8a'); this.shake = 0.5; this.spectateIdx = 0; }
    else if (tg.isPlayer) this.toast(`🎯 ${r.name} 잡았다!`, '#ffe14a');
    else this.toast(`${r.name} 탈락!`, '#ffb3b3');
  }

  tagCheck() {
    const tg = this.tagger;
    if (tg.stun > 0 || tg.status !== 'alive') return;
    for (const r of this.runners) {
      if (r.status !== 'alive' || r.grace > 0 || r.lift > 0.8) continue;
      const dx = r.pos.x - tg.pos.x, dz = r.pos.z - tg.pos.z;
      if (dx * dx + dz * dz < TAG_DIST * TAG_DIST) {
        this.eliminate(r, tg);
        tg.tagAnim = 0.45;
        tg.facing = Math.atan2(dx, dz);
      }
    }
  }

  /**
   * 땡 자동 구조: 살아있는 도망자가 얼음 동료에게 닿으면(버튼 없이) 즉시 구조.
   * tagCheck 다음에 호출되므로, 술래와 얼음 동료에게 동시에 닿으면 잡힌 것이 우선한다.
   */
  autoThawCheck() {
    for (const r of this.runners) {
      if (!this.canAct(r) || r.role !== 'runner') continue;
      const f = this.thawTargetFor(r);
      if (f) this.thaw(r, f);
    }
  }

  // ------------------------------------------------------------ 경찰과 도둑
  /** 경찰(role 'tagger' · 파란팀) / 도둑(role 'runner' · 빨간팀)을 무작위로 나누고 시작 위치를 돌려준다. */
  assignPoliceRoles(): Map<number, THREE.Vector2> {
    const copN = Math.max(1, Math.floor(this.chars.length / 3));
    const cops = new Set(shuffle(this.chars.map((c) => c.id)).slice(0, copN));
    const copSpots = shuffle(this.policeStarts.cops);
    const robSpots = shuffle(this.policeStarts.robbers);
    const out = new Map<number, THREE.Vector2>();
    let ci = 0, ri = 0;
    for (const c of this.chars) {
      const cop = cops.has(c.id);
      c.role = cop ? 'tagger' : 'runner';
      c.team = cop ? 'blue' : 'red';
      c.m.setTeam(c.team);
      out.set(c.id, cop ? copSpots[ci++ % copSpots.length] : robSpots[ri++ % robSpots.length]);
    }
    return out;
  }

  initPolice() {
    const f = this.police!;
    const spot = (x: number, z: number) => (this.nav.isFree(x, z) ? new THREE.Vector2(x, z) : this.nav.snap(x, z) ?? new THREE.Vector2(x, z));
    this.policeStarts = {
      cops: [spot(-3.6, 0), spot(3.6, 1.2), spot(0, -4.2)],
      robbers: [spot(8, -18.5), spot(-8, 18.5), spot(13.5, -0.5)],
    };
    const jl = this.fx.label('🚔 감옥', '#ffd27a', 1.1);
    jl.position.set(f.jail.x, 3.7, f.jail.z);
    this.policeLabels = [jl];
    this.refreshExitLabels(false);
  }

  refreshExitLabels(open: boolean) {
    for (const s of this.exitLabels) this.fx.removeLabel(s);
    this.exitLabels = (this.police?.exits ?? []).map((e) => {
      const s = this.fx.label(open ? '🚪 탈출구 OPEN' : '🔒 탈출구', open ? '#9dffb0' : '#ff9a9a', 1.0);
      s.position.set(e.x, 4, e.z);
      return s;
    });
  }

  resetPolice() {
    this.policeT = 0; this.rescueT = 0; this.exitOpen = false; this.rescuer = null;
    this.refreshExitLabels(false);
    this.police?.reset();
  }

  /** 살아있는(도망 중인) 도둑 p 근처에 활동 가능한 경찰이 있는가 */
  copNear(p: Char, d: number) {
    if (p.role !== 'runner' || p.status !== 'alive') return false;
    return this.chars.some((c) => c.role === 'tagger' && c.status === 'alive' && c.stun <= 0 && c.pos.distanceTo(p.pos) < d);
  }

  /** 경찰이 도둑에게 닿으면 체포 → 감옥 안으로 이동 (status 'frozen' = 수감 중) */
  arrest(r: Char, cop: Char) {
    const f = this.police!;
    const heard = this.near(r);
    const jailed = this.runners.filter((x) => x.status === 'frozen').length;
    const slot = f.jail.slots[jailed % f.jail.slots.length];
    const fromX = r.pos.x, fromZ = r.pos.z;
    this.fx.emit('star', tmpV.set(fromX, 1.6, fromZ), 12, 4.5, 0.9, 4, 1.3);
    this.fx.emit('spark', tmpV.set(fromX, 1.2, fromZ), 16, 5, 0.6, 3, 1.1);
    this.fx.ring(tmpV.set(fromX, 0.1, fromZ), 0xffd27a, 5, 0.45);
    this.fx.floatText('체포!', '#ffe14a', tmpV.set(fromX, 2.8, fromZ), 1.6);
    r.status = 'frozen'; r.iceT = 0; r.outT = 0;
    r.stun = 0; r.stunType = null; r.lift = 0; r.recover = 0;
    r.vel.set(0, 0, 0); r.move.set(0, 0, 0); r.knock.set(0, 0, 0);
    r.dashT = 0; r.throwT = -1; r.item = null; r.motoT = 0; r.jellyT = 0; r.bag = false;
    r.m.ufoBeam.visible = false; r.m.moto.visible = false; r.m.jellyBlob.visible = false; r.m.stars.visible = false;
    r.pos.set(f.jail.x + slot.x, 0, f.jail.z + slot.y);
    r.facing = 0;
    r.ai.goal = null; r.ai.path.length = 0;
    cop.st.tags++; r.st.outs++;
    this.setLabel(r, '🔒 감옥', '#ffd27a', 0.85);
    this.fx.ring(tmpV.set(r.pos.x, 0.1, r.pos.z), 0xffd27a, 4, 0.4);
    if (heard) { this.sfx.tag(); this.sfx.out(); }
    if (r.isPlayer) { this.toast('🚔 체포됐다! 동료 도둑이 구출해주길 기다려요', '#ffd27a'); this.shake = 0.5; }
    else if (cop.isPlayer) this.toast(`🚓 ${r.name} 체포! 감옥으로!`, '#ffe14a');
    else this.toast(`${cop.name} → ${r.name} 체포!`, '#ffe9a8');
  }

  /** 도둑이 감옥 근처에 머물러 구출 게이지가 차면 갇힌 도둑이 모두 풀려난다 */
  releasePrisoners(by: Char, list: Char[]) {
    const f = this.police!;
    const base = Math.atan2(by.pos.x - f.jail.x, by.pos.z - f.jail.z);
    const offs = [0, 0.8, -0.8, 1.6, -1.6];
    list.forEach((r, i) => {
      const a = base + offs[i % offs.length];
      const tx = f.jail.x + Math.sin(a) * 3.3, tz = f.jail.z + Math.cos(a) * 3.3;
      const s = this.nav.isFree(tx, tz) ? null : this.nav.snap(tx, tz);
      const px = s ? s.x : tx, pz = s ? s.y : tz;
      r.status = 'alive'; r.iceT = 0; r.thawT = 0.5; r.grace = 1.8; r.freezeCd = 0;
      r.pos.set(px, 0, pz); r.vel.set(0, 0, 0); r.facing = a;
      r.ai.think = 0; r.ai.goal = null; r.ai.path.length = 0;
      this.setLabel(r, '🏃 도둑', '#ffa0a0', 0.8);
      this.fx.emit('star', tmpV.set(px, 1.6, pz), 10, 4, 0.8, 4, 1.2);
      this.fx.emit('spark', tmpV.set(px, 1.2, pz), 14, 4, 0.6, 2, 1.1);
      this.fx.ring(tmpV.set(px, 0.1, pz), 0x5dff8a, 5, 0.5);
      this.fx.floatText('탈옥!', '#9dffb0', tmpV.set(px, 2.9, pz), 1.6);
      if (r.isPlayer) this.toast('🔓 구출됐다! 다시 도망쳐요!', '#9dffb0');
    });
    by.st.thaws += list.length; by.rs.thaws += list.length;
    if (by.isPlayer) this.toast(`🔓 구출 성공! 동료 ${list.length}명 탈옥!`, '#9dffb0');
    else if (!list.some((x) => x.isPlayer)) this.toast(`🔓 ${by.name}이(가) 동료를 구출했다!`, '#c9ffd6');
    if (this.near(by)) this.sfx.thaw();
  }

  /** 경찰과 도둑 한 프레임: 탈출구 개방 → 체포 → 구출 → 탈출 → 승패 판정 */
  updatePolice(dt: number) {
    const f = this.police!;
    // 1) 체포: 경찰이 도둑에게 닿으면 감옥으로
    for (const cop of this.chars) {
      if (cop.role !== 'tagger' || cop.status !== 'alive' || cop.stun > 0 || this.copHeld(cop)) continue;
      for (const r of this.runners) {
        if (r.status !== 'alive' || r.grace > 0 || r.lift > 0.8) continue;
        const dx = r.pos.x - cop.pos.x, dz = r.pos.z - cop.pos.z;
        if (dx * dx + dz * dz < TAG_DIST * TAG_DIST) {
          this.arrest(r, cop);
          cop.tagAnim = 0.45; cop.facing = Math.atan2(dx, dz);
        }
      }
    }
    // 2) 구출: 자유로운 도둑이 감옥에 접근해 잠시 머물면 갇힌 도둑이 모두 풀려난다
    const prisoners = this.runners.filter((r) => r.status === 'frozen');
    let rescuer: Char | null = null, bd = RESCUE_R;
    if (prisoners.length) {
      for (const r of this.runners) {
        if (!this.canAct(r)) continue;
        const d = Math.hypot(r.pos.x - f.jail.x, r.pos.z - f.jail.z);
        if (d < bd) { bd = d; rescuer = r; }
      }
    }
    this.rescuer = rescuer;
    if (rescuer) {
      this.rescueT = Math.min(RESCUE_TIME, this.rescueT + dt);
      if (this.rescueT >= RESCUE_TIME) { this.releasePrisoners(rescuer, prisoners); this.rescueT = 0; this.rescuer = null; }
    } else this.rescueT = Math.max(0, this.rescueT - dt * 1.5);
    this.checkPoliceEnd();
  }

  /** 모든 도둑이 감옥에 있으면 경찰팀 승리 · 제한시간이 끝나면 도둑팀 승리 */
  checkPoliceEnd() {
    const rs = this.runners;
    if (rs.every((r) => r.status === 'frozen')) this.endRound('tagger', 'all_jailed');
    else if (this.time <= 0) this.endRound('runner', 'timeout');
  }

  updatePoliceVisuals() {
    const prisoners = this.runners.filter((r) => r.status === 'frozen').length;
    this.police?.update(this.elapsed, this.exitOpen, this.rescueT / RESCUE_TIME, prisoners);
  }

  policeHud(): PoliceHud {
    const rs = this.runners;
    return {
      free: rs.filter((r) => r.status === 'alive').length,
      jailed: rs.filter((r) => r.status === 'frozen').length,
      escaped: rs.filter((r) => r.status === 'out').length,
      total: rs.length,
      rescue: this.rescueT / RESCUE_TIME,
      rescuing: this.rescuer === this.player,
      exitsOpen: false,
      exitIn: 0,
      holdIn: this.phase === 'playing' ? Math.max(0, Math.ceil(COP_HOLD - this.policeT)) : 0,
    };
  }

  /** 화면 밖 경찰/도둑 + 감옥 · 열린 탈출구 안내 화살표 */
  buildPoliceMarkers(): Marker[] {
    const p = this.player, f = this.police!;
    const out: Marker[] = [];
    const edge = (x: number, y: number, z: number, extra: Pick<Marker, 'team' | 'animal'> & Partial<Marker>) => {
      const v = tmpV.set(x, y, z).project(this.camera);
      const behind = v.z > 1;
      if (!behind && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95) return;
      let mx = behind ? -v.x : v.x, my = behind ? -v.y : v.y;
      const angle = Math.atan2(-my, mx);
      const m = Math.max(Math.abs(mx) / 0.88, my > 0 ? my / 0.5 : -my / 0.38, 1);
      mx /= m; my /= m;
      out.push({ x: (mx + 1) / 2, y: (1 - my) / 2, angle, frozen: false, tagger: false, ...extra });
    };
    const list = p.role === 'tagger' ? this.runners.filter((r) => r.status === 'alive') : this.chars.filter((c) => c.role === 'tagger' && c.status === 'alive');
    for (const e of list) edge(e.pos.x, e.lift + 1, e.pos.z, { team: e.team, animal: e.animal });
    if (this.runners.some((r) => r.status === 'frozen')) edge(f.jail.x, 1.5, f.jail.z, { team: 'red', animal: 'dog', kind: 'jail' });
    return out;
  }

  // ------------------------------------------------------------ shared actions
  startThrow(c: Char, target: THREE.Vector3) {
    if (!c.bag || c.throwT >= 0 || c.stun > 0 || c.status !== 'alive') return false;
    c.throwT = 0; c.throwReleased = false; c.throwTarget.copy(target);
    c.facing = Math.atan2(target.x - c.pos.x, target.z - c.pos.z);
    return true;
  }

  releaseThrow(c: Char) {
    c.bag = false; c.st.throws++;
    const f = c.facing;
    const from = new THREE.Vector3(c.pos.x + Math.sin(f) * 0.5 - Math.cos(f) * 0.3, c.lift + 1.5, c.pos.z + Math.cos(f) * 0.5 + Math.sin(f) * 0.3);
    const vel = this.solveLaunch(from, c.throwTarget, THROW_SPEED);
    const mesh = buildBag();
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.projectiles.push({ mesh, pos: from, vel, owner: c, age: 0, alive: true, nearC: null, nearD: Infinity, hit: false });
    this.fx.emit('spark', from, 4, 1.5, 0.3, 4, 0.6);
    if (this.near(c)) this.sfx.throw();
  }

  solveLaunch(from: THREE.Vector3, target: THREE.Vector3, speed: number) {
    const dx = target.x - from.x, dz = target.z - from.z;
    let d = Math.hypot(dx, dz);
    let tx = dx, tz = dz;
    if (d > 23) { tx = (dx / d) * 23; tz = (dz / d) * 23; d = 23; }
    const t = Math.max(0.2, Math.min(1.4, d / speed));
    const vy = (target.y - from.y + 0.5 * G * t * t) / t;
    return new THREE.Vector3(tx / t, vy, tz / t);
  }

  startDash(c: Char, dir: THREE.Vector3) {
    if (c.dashCd > 0 || c.stun > 0 || c.status !== 'alive') return false;
    c.dashT = DASH_TIME;
    c.dashCd = this.chaseMode && c.role === 'tagger' ? TAGGER_DASH_CD : this.mode === 'police' && c.role === 'tagger' ? COP_DASH_CD : DASH_CD;
    c.dashDir.copy(dir).setY(0).normalize();
    c.facing = Math.atan2(c.dashDir.x, c.dashDir.z);
    c.st.dashes++;
    this.fx.emit(this.theme.snowy ? 'snow' : 'spark', tmpV.set(c.pos.x, 0.2, c.pos.z), 10, 3, 0.4, 5, 0.9);
    if (this.near(c)) this.sfx.dash();
    return true;
  }

  applyStun(c: Char, type: StunType, dur: number, knockDir?: THREE.Vector3, pow = 0) {
    if (c.status !== 'alive') return;
    if (c.stunType === 'ufo' && type !== 'ufo') c.m.ufoBeam.visible = false;
    c.stun = dur; c.stunMax = dur; c.stunEl = 0; c.stunType = type;
    c.throwT = -1; c.dashT = 0; c.tagAnim = 0;
    if (knockDir) c.knock.copy(knockDir).setY(0).normalize().multiplyScalar(pow);
    if (type === 'ufo') c.m.ufoBeam.visible = true;
    if (type === 'missile') c.motoT = 0;
  }

  useItem(c: Char) {
    const it = c.item;
    if (!it) return false;
    let ok = true;
    if (it === 'moto') {
      c.motoT = MOTO_TIME;
      this.fx.emit('spark', tmpV.set(c.pos.x, 0.6, c.pos.z), 12, 4, 0.5, 3);
      this.toastFor(c, '🏍️ 오토바이! 3초 질주', '#ff6b6b');
    } else if (it === 'ufo') {
      const list = this.enemyList(c).filter((e) => e.stunType !== 'ufo' && e.lift < 0.3);
      if (!list.length) ok = false;
      else {
        const t = pick(list);
        this.applyStun(t, 'ufo', 2.6);
        this.fx.emit('spark', tmpV.set(t.pos.x, 3, t.pos.z), 16, 4, 0.7, 2);
        this.fx.floatText('UFO!', '#8fffd0', tmpV.set(t.pos.x, 3.4, t.pos.z));
        this.toastFor(c, `🛸 UFO가 ${t.name}을(를) 붙잡았다!`, '#8fffd0');
        this.toastFor(t, '🛸 UFO에 붙잡혔다!', '#8fffd0');
        if (this.near(t)) this.sfx.ufo();
      }
    } else if (it === 'banana') {
      // multiple peels can be placed; only a soft cap per owner keeps the map readable (oldest disappears)
      const mine = this.bananas.filter((b) => b.owner === c);
      if (mine.length >= 6) {
        const oldest = mine[0];
        this.scene.remove(oldest.mesh);
        this.bananas.splice(this.bananas.indexOf(oldest), 1);
      }
      const mesh = new THREE.Mesh(this.bananaGeo, lam(0xffd83b, { emissive: 0x332200 }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = Math.random() * Math.PI * 2;
      mesh.position.set(c.pos.x, 0.09, c.pos.z);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.bananas.push({ mesh, x: c.pos.x, z: c.pos.z, owner: c, life: 25 });
      c.bananaActive = true;
      this.toastFor(c, mine.length > 0 ? `🍌 바나나 추가 설치! (${Math.min(mine.length + 1, 6)}개)` : '🍌 바나나 껍질 설치!', '#ffd83b');
    } else if (it === 'missile') {
      const list = this.enemyList(c);
      if (!list.length) ok = false;
      else {
        const t = pick(list);
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 10), lam(0xeeeeee));
        body.rotation.x = Math.PI / 2;
        g.add(body);
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 10), lam(0xe8413c));
        nose.rotation.x = Math.PI / 2; nose.position.z = 0.5;
        g.add(nose);
        for (let i = 0; i < 4; i++) {
          const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.2), lam(0xe8413c));
          fin.position.set(Math.sin((i * Math.PI) / 2) * 0.12, Math.cos((i * Math.PI) / 2) * 0.12, -0.3);
          fin.rotation.z = (i * Math.PI) / 2;
          g.add(fin);
        }
        const fwd = new THREE.Vector3(Math.sin(c.facing), 0, Math.cos(c.facing));
        const pos = new THREE.Vector3(c.pos.x, 1.6, c.pos.z);
        g.position.copy(pos);
        this.scene.add(g);
        this.homings.push({ kind: 'missile', mesh: g, pos, vel: new THREE.Vector3(fwd.x * 6, 7, fwd.z * 6), owner: c, target: t, life: 5 });
        this.toastFor(c, `🚀 미사일 발사! → ${t.name}`, '#ff9a3b');
        this.toastFor(t, '🚀 미사일이 날아온다! 대시로 피해!', '#ff9a3b');
        if (this.near(c)) this.sfx.missile();
      }
    } else if (it === 'jelly') {
      const t = this.nearestEnemy(c);
      if (!t) ok = false;
      else {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), this.slimeMat);
        const pos = new THREE.Vector3(c.pos.x, 1.4, c.pos.z);
        mesh.position.copy(pos);
        this.scene.add(mesh);
        const dir = tmpV.set(t.pos.x - c.pos.x, 0, t.pos.z - c.pos.z).normalize();
        this.homings.push({ kind: 'slime', mesh, pos, vel: new THREE.Vector3(dir.x * 10, 5, dir.z * 10), owner: c, target: t, life: 4 });
        this.toastFor(c, `🟢 젤리슬라임! → ${t.name}`, '#6af08a');
      }
    }
    if (ok) {
      c.item = null; c.st.items++; c.rs.items++;
      if (this.near(c)) this.sfx.item();
    } else if (c.isPlayer && it !== 'banana') this.toast('대상이 없어요!', '#c8d8ff');
    return ok;
  }

  // ------------------------------------------------------------ item boxes
  makeItemBox(): THREE.Group {
    const g = new THREE.Group();
    const box = new THREE.Mesh(this.boxGeo, this.boxMat);
    box.castShadow = true;
    g.add(box);
    const rib1 = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.74, 0.16), this.ribMat);
    const rib2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.74, 0.74), this.ribMat);
    g.add(rib1, rib2);
    const q = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.fx.textTexture('?', '#ffffff'), depthTest: true, transparent: true }));
    q.scale.set(2.2, 0.83, 1);
    q.position.y = 0.95;
    g.add(q);
    return g;
  }

  freeItemPoint(): THREE.Vector2 | null {
    const cands = shuffle(this.world.itemPoints).filter((p) => !this.items.some((it) => it.active && Math.hypot(it.x - p.x, it.z - p.y) < 2));
    return cands[0] ?? null;
  }

  spawnItemBoxes(n: number) {
    for (let i = 0; i < n; i++) {
      const p = this.freeItemPoint();
      if (!p) break;
      const g = this.makeItemBox();
      g.position.set(p.x, 0.8, p.y);
      this.scene.add(g);
      this.items.push({ mesh: g, x: p.x, z: p.y, respawn: 0, active: true });
    }
  }

  updateItems(dt: number) {
    const playing = this.phase === 'playing';
    for (const it of this.items) {
      if (!it.active) {
        it.respawn -= dt;
        if (it.respawn <= 0) {
          const p = this.freeItemPoint();
          if (p) { it.x = p.x; it.z = p.y; it.mesh.position.set(p.x, 0.8, p.y); }
          it.active = true; it.mesh.visible = true;
          this.fx.emit('spark', tmpV.set(it.x, 0.8, it.z), 10, 3, 0.5, 2);
        }
        continue;
      }
      it.mesh.rotation.y += dt * 1.8;
      it.mesh.position.y = 0.8 + Math.sin(this.elapsed * 2.5 + it.x) * 0.15;
      if (!playing) continue;
      for (const c of this.chars) {
        if (c.item || c.stun > 0 || c.status !== 'alive') continue;
        if ((c.pos.x - it.x) ** 2 + (c.pos.z - it.z) ** 2 < 1.2 * 1.2) {
          c.item = pick(ITEMS);
          c.ai.itemCd = rand(0.5, 1.4);
          it.active = false; it.respawn = rand(6, 9); it.mesh.visible = false;
          this.fx.emit('spark', tmpV.set(it.x, 0.9, it.z), 16, 4, 0.5, 3);
          this.fx.ring(tmpV.set(it.x, 0.1, it.z), 0xff7ac8, 4);
          this.toastFor(c, `${ITEM_NAMES[c.item]} 획득!`, '#ff9ee0');
          if (c.isPlayer) this.sfx.item();
          break;
        }
      }
    }
    // bananas
    for (let i = this.bananas.length - 1; i >= 0; i--) {
      const b = this.bananas[i];
      b.life -= dt;
      let remove = b.life <= 0;
      if (!remove && playing) {
        for (const c of this.chars) {
          if (!this.isEnemy(b.owner, c) || c.status !== 'alive' || c.stun > 0 || c.lift > 0.3) continue;
          if ((c.pos.x - b.x) ** 2 + (c.pos.z - b.z) ** 2 < 0.75 * 0.75) {
            this.applyStun(c, 'slip', 1.5, c.vel.lengthSq() > 0.1 ? c.vel.clone() : undefined, 3);
            this.fx.floatText('미끌!', '#ffd83b', tmpV.set(c.pos.x, 2.4, c.pos.z), 1.3);
            this.fx.emit('star', tmpV.set(c.pos.x, 1.5, c.pos.z), 5, 3, 0.6, 4);
            this.toastFor(c, '🍌 바나나에 미끄러졌다!', '#ffd83b');
            this.toastFor(b.owner, `🍌 ${c.name}이(가) 미끄러졌다!`, '#ffd83b');
            if (this.near(c)) this.sfx.slip();
            remove = true;
            break;
          }
        }
      }
      if (remove) {
        this.scene.remove(b.mesh);
        this.bananas.splice(i, 1);
        b.owner.bananaActive = this.bananas.some((x) => x.owner === b.owner);
      }
    }
    // homing (missile / slime)
    for (let i = this.homings.length - 1; i >= 0; i--) {
      const m = this.homings[i];
      m.life -= dt;
      const t = m.target;
      const tp = tmpV.set(t.pos.x, t.lift + 0.8, t.pos.z);
      const speed = m.kind === 'missile' ? 13 : 16;
      const desired = tmpV2.copy(tp).sub(m.pos).normalize().multiplyScalar(speed);
      m.vel.lerp(desired, Math.min(1, dt * (m.kind === 'missile' ? 2.6 : 5)));
      m.pos.addScaledVector(m.vel, dt);
      m.mesh.position.copy(m.pos);
      if (m.kind === 'missile') {
        m.mesh.lookAt(tmpV2.copy(m.pos).add(m.vel));
        if (Math.random() < 0.8) this.fx.emit(Math.random() < 0.5 ? 'fire' : 'snow', m.pos, 1, 0.6, 0.35, -1, 0.9);
      } else {
        const w = Math.sin(this.elapsed * 20) * 0.15;
        m.mesh.scale.set(1 + w, 1 - w, 1 + w);
        if (Math.random() < 0.5) this.fx.emit('jelly', m.pos, 1, 0.5, 0.3, 2, 0.6);
      }
      let end = m.life <= 0 || m.pos.y < 0.1 || pointBlocked(this.world.colliders, m.pos.x, m.pos.z, 0.1, m.pos.y);
      let hit = false;
      if (m.pos.distanceTo(tp) < 0.85 || (t.status !== 'alive' && m.life < 3.5)) { end = true; hit = t.status === 'alive'; }
      if (end) {
        if (m.kind === 'missile') {
          this.fx.emit('fire', m.pos, 14, 5, 0.5, 4, 1.4);
          this.fx.emit('snow', m.pos, 20, 6, 0.7, 8, 1.2);
          this.fx.ring(tmpV.set(m.pos.x, 0.1, m.pos.z), 0xff8a3b, 6);
          if (this.near(t)) this.sfx.boom();
          if (hit && playing) {
            this.applyStun(t, 'missile', 1.6, tmpV2.copy(m.vel), 5);
            this.fx.floatText('펑!', '#ff9a3b', tmpV.set(t.pos.x, 2.6, t.pos.z), 1.4);
            if (t.isPlayer) this.shake = 0.5;
          }
        } else {
          this.fx.emit('jelly', m.pos, 16, 4, 0.6, 6, 1.2);
          if (hit && playing) {
            t.jellyT = 4;
            this.fx.floatText('끈적!', '#6af08a', tmpV.set(t.pos.x, 2.6, t.pos.z), 1.3);
            this.toastFor(t, '🟢 젤리에 뒤덮였다! 느려짐...', '#6af08a');
            if (this.near(t)) this.sfx.splat();
          }
        }
        this.scene.remove(m.mesh);
        this.homings.splice(i, 1);
      }
    }
  }

  // ------------------------------------------------------------ 오재미 pickups
  makePickup(x: number, z: number) {
    const g = new THREE.Group();
    const bag = buildBag();
    bag.scale.setScalar(1.25);
    bag.position.y = 0.28;
    g.add(bag);
    const mound = new THREE.Mesh(this.moundGeo, lam(this.theme.snowy ? 0xe8f2ff : 0xd8c9a8));
    mound.scale.y = 0.3;
    g.add(mound);
    const ring = new THREE.Mesh(this.pickRingGeo, this.pickRingMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    g.add(ring);
    g.position.set(x, 0, z);
    g.scale.setScalar(0.01);
    this.scene.add(g);
    this.pickups.push({ mesh: g, x, z, age: 0 });
    this.fx.emit('spark', tmpV.set(x, 0.3, z), 4, 1.5, 0.4, 3, 0.7);
  }

  validSpawn(x: number, z: number) {
    if (pointBlocked(this.world.colliders, x, z, 0.55)) return false;
    // never spawn 오재미 in a spot nobody can reach
    if (!this.nav.isFree(x, z)) return false;
    for (const c of this.chars) if ((c.pos.x - x) ** 2 + (c.pos.z - z) ** 2 < 1.5 * 1.5) return false;
    for (const p of this.pickups) if ((p.x - x) ** 2 + (p.z - z) ** 2 < 0.95) return false;
    return true;
  }

  spawnAtPoint() {
    const sp = this.world.spawnPoints;
    for (let tries = 0; tries < 6; tries++) {
      const p = pick(sp);
      const x = p.x + rand(-0.9, 0.9), z = p.y + rand(-0.9, 0.9);
      if (this.validSpawn(x, z)) { this.makePickup(x, z); return; }
    }
  }

  spawnAround(cx: number, cz: number, rmin: number, rmax: number) {
    for (let tries = 0; tries < 10; tries++) {
      const a = Math.random() * Math.PI * 2, r = rand(rmin, rmax);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (this.validSpawn(x, z)) { this.makePickup(x, z); return true; }
    }
    return false;
  }

  pickupsNear(x: number, z: number, r: number) {
    let n = 0;
    for (const p of this.pickups) if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) n++;
    return n;
  }

  updateSpawns(dt: number) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.6;
      if (this.pickups.length < this.maxPickups) this.spawnAtPoint();
    }
    for (const c of this.chars) {
      c.spawnTimer -= dt;
      if (c.spawnTimer > 0) continue;
      c.spawnTimer = c.isPlayer ? rand(1.2, 1.8) : rand(1.8, 2.6);
      if (c.bag || c.status !== 'alive') continue;
      if (this.pickupsNear(c.pos.x, c.pos.z, 6) < 1 && this.pickups.length < this.maxPickups + this.chars.length) this.spawnAround(c.pos.x, c.pos.z, 2, 6);
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (p.age < 25) continue;
      let far = true;
      for (const c of this.chars) if ((c.pos.x - p.x) ** 2 + (c.pos.z - p.z) ** 2 < 100) { far = false; break; }
      if (far) { this.scene.remove(p.mesh); this.pickups.splice(i, 1); }
    }
  }

  updatePickups(dt: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.age += dt;
      const s = Math.min(1, p.age * 4);
      p.mesh.scale.setScalar(s < 1 ? s * (1.25 - 0.25 * s) : 1);
      p.mesh.children[0].position.y = 0.28 + Math.sin(this.elapsed * 3 + p.x) * 0.06;
      p.mesh.children[0].rotation.y = this.elapsed * 1.5;
      p.mesh.children[2].scale.setScalar(1 + Math.sin(this.elapsed * 4 + p.z) * 0.12);
      if (this.phase !== 'playing' || this.netRole === 'client') continue;
      for (const c of this.chars) {
        if (c.bag || c.stun > 0 || c.status !== 'alive') continue;
        const dx = c.pos.x - p.x, dz = c.pos.z - p.z;
        if (dx * dx + dz * dz < 1.1 * 1.1) {
          c.bag = true; c.pickT = 0.35;
          const fm = buildBag();
          fm.position.set(p.x, 0.3, p.z);
          this.scene.add(fm);
          this.flyBags.push({ mesh: fm, from: new THREE.Vector3(p.x, 0.3, p.z), char: c, t: 0 });
          this.fx.emit('spark', tmpV.set(p.x, 0.35, p.z), 8, 2, 0.4, 5, 0.8);
          this.scene.remove(p.mesh);
          this.pickups.splice(i, 1);
          if (c.isPlayer) this.sfx.pickup();
          break;
        }
      }
    }
    for (let i = this.flyBags.length - 1; i >= 0; i--) {
      const f = this.flyBags[i];
      f.t += dt / 0.2;
      const c = f.char;
      const hx = c.pos.x - Math.cos(c.facing) * 0.42, hz = c.pos.z + Math.sin(c.facing) * 0.42;
      const k = Math.min(1, f.t);
      f.mesh.position.set(f.from.x + (hx - f.from.x) * k, f.from.y + (c.lift + 0.9 - f.from.y) * k + Math.sin(k * Math.PI) * 0.6, f.from.z + (hz - f.from.z) * k);
      if (f.t >= 1) { this.scene.remove(f.mesh); this.flyBags.splice(i, 1); }
    }
  }

  // ------------------------------------------------------------ projectiles (오재미)
  threatTime(c: Char, p: Projectile) {
    const rx = c.pos.x - p.pos.x, rz = c.pos.z - p.pos.z;
    const vx = p.vel.x, vz = p.vel.z;
    const v2 = vx * vx + vz * vz;
    if (v2 < 1) return Infinity;
    const tca = (rx * vx + rz * vz) / v2;
    if (tca < 0 || tca > 1.6) return Infinity;
    const cx = rx - vx * tca, cz = rz - vz * tca;
    if (Math.hypot(cx, cz) > 1.05) return Infinity;
    const y = p.pos.y + p.vel.y * tca - 0.5 * G * tca * tca;
    if (y < c.lift - 0.1 || y > c.lift + 2.2) return Infinity;
    return tca;
  }

  splat(pos: THREE.Vector3, big = false) {
    this.fx.emit('spark', pos, big ? 10 : 5, big ? 4 : 2.4, 0.45, 8, big ? 1.2 : 0.9);
    this.fx.emit(this.theme.snowy ? 'snow' : 'star', pos, big ? 8 : 3, 3, 0.5, 7, 1);
  }

  updateProjectiles(dt: number) {
    const sub = 3, h = dt / sub;
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.age += dt;
      for (const e of this.chars) {
        if (!this.isEnemy(p.owner, e) || e.status !== 'alive') continue;
        const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
        if (d < p.nearD) { p.nearD = d; p.nearC = e; }
      }
      for (let s = 0; s < sub && p.alive; s++) {
        p.vel.y -= G * h;
        p.pos.addScaledVector(p.vel, h);
        if (p.pos.y < 0.12) { p.alive = false; this.splat(tmpV.set(p.pos.x, 0.15, p.pos.z)); break; }
        if (pointBlocked(this.world.colliders, p.pos.x, p.pos.z, 0.15, p.pos.y) || Math.abs(p.pos.x) > 30 || Math.abs(p.pos.z) > 35) { p.alive = false; this.splat(p.pos); break; }
        for (const c of this.chars) {
          if (!this.isEnemy(p.owner, c) || c.status !== 'alive') continue;
          const dx = c.pos.x - p.pos.x, dz = c.pos.z - p.pos.z;
          if (dx * dx + dz * dz > 0.58 * 0.58) continue;
          if (p.pos.y < c.lift + 0.05 || p.pos.y > c.lift + 1.85) continue;
          p.alive = false;
          if (this.phase !== 'playing') this.splat(p.pos);
          else { p.hit = true; this.onHit(p, c); }
          break;
        }
      }
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.x += dt * 9;
      p.mesh.rotation.z += dt * 5;
      if (p.alive && Math.random() < 0.5) this.fx.emit('spark', p.pos, 1, 0.3, 0.2, 0, 0.45);
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.alive) continue;
      if (!p.hit && p.nearC && p.nearD < 1.7 && p.nearC.stun <= 0 && p.nearC.status === 'alive') {
        p.nearC.st.dodges++;
        if (p.nearC.isPlayer) this.fx.floatText('회피!', '#c8f0ff', tmpV.set(p.nearC.pos.x, 2.5, p.nearC.pos.z), 1.1);
      }
      this.scene.remove(p.mesh);
      this.projectiles.splice(i, 1);
    }
  }

  addScore(team: Team) {
    this.scores[team]++;
    if (this.overtime) this.endRound(team, 'golden');
  }

  onHit(p: Projectile, c: Char) {
    if (c.invuln > 0) { this.splat(p.pos); return; }
    const o = p.owner;
    o.st.hits++; c.st.hitsTaken++;
    this.addScore(o.team);
    this.applyStun(c, 'hit', HIT_STUN, tmpV2.copy(p.vel), 4.5);
    c.invuln = HIT_STUN + 0.7;
    this.splat(p.pos, true);
    this.fx.emit('star', tmpV.set(c.pos.x, c.lift + 1.6, c.pos.z), 6, 3.5, 0.7, 4, 1.2);
    this.fx.ring(tmpV.set(c.pos.x, c.lift + 0.1, c.pos.z), 0xffffff, 4, 0.35);
    this.fx.floatText('+1', o.team === 'red' ? '#ff6b66' : '#6fb2ff', tmpV.set(c.pos.x, c.lift + 2.4, c.pos.z));
    if (this.near(c)) this.sfx.hit();
    if (o.isPlayer) this.toast('🎯 명중! +1', '#ffe14a');
    else if (c.isPlayer) { this.toast('💥 오재미에 맞았다!', '#ff8a8a'); this.shake = 0.4; }
    else if (o.team === this.player.team) this.toast(`${o.name} 명중! +1`, o.team === 'red' ? '#ff9a96' : '#9ccaff');
    for (const t of this.chars) if (t.team === c.team && t !== c && !t.isPlayer) { t.ai.target = o; t.ai.throwCd = Math.min(t.ai.throwCd, 0.5); }
  }

  // ------------------------------------------------------------ AI
  updateAI(c: Char, dt: number) {
    const ai = c.ai;
    ai.think -= dt; ai.throwCd -= dt; ai.itemCd -= dt; ai.dodgeT -= dt; ai.hesitate -= dt;
    ai.pathT -= dt; ai.unstickT -= dt;
    c.move.set(0, 0, 0);
    if (this.phase !== 'playing' || c.stun > 0 || c.status !== 'alive') {
      ai.stuckT = 0;
      ai.lastPos.copy(c.pos);
      return;
    }
    if (this.mode === 'police') { if (c.role === 'tagger') this.aiCop(c); else this.aiRobber(c); }
    else if (this.mode === 'ojaemi') this.aiOjaemi(c);
    else if (c.role === 'tagger') this.aiTagger(c);
    else this.aiRunner(c);
    this.checkStuck(c, dt);
  }

  /**
   * Walk toward ai.goal. Straight line when the lane is open, otherwise follow an A* path
   * (re-planned when the goal moves, periodically, or after getting stuck).
   */
  moveToGoal(c: Char) {
    const ai = c.ai;
    const g = ai.goal;
    if (!g) { ai.path.length = 0; return; }
    if (ai.unstickT > 0) { c.move.copy(ai.unstickDir); return; }
    // goals inside obstacles (item behind a crate, point inside a bush...) snap to the nearest walkable spot
    if (!this.nav.isFree(g.x, g.z)) {
      const s = this.nav.snap(g.x, g.z);
      if (s) g.set(s.x, 0, s.y);
    }
    const len = Math.hypot(g.x - c.pos.x, g.z - c.pos.z);
    if (len < 0.3) return;
    let tx = g.x, tz = g.z, onPath = false;
    if (!this.nav.segmentClear(c.pos.x, c.pos.z, g.x, g.z)) {
      const replan = ai.path.length === 0 || ai.pathT <= 0 || ai.pathGoal.distanceToSquared(g) > 1.2;
      if (replan) {
        ai.path = this.nav.findPath(c.pos.x, c.pos.z, g.x, g.z) ?? [];
        ai.pathGoal.copy(g);
        ai.pathT = 0.7 + Math.random() * 0.5;
      }
      // skip waypoints we've reached or can already see past
      while (ai.path.length > 1) {
        const a = ai.path[0], b = ai.path[1];
        if (Math.hypot(a.x - c.pos.x, a.y - c.pos.z) < 0.5 || this.nav.segmentClear(c.pos.x, c.pos.z, b.x, b.y)) ai.path.shift();
        else break;
      }
      if (ai.path.length) { tx = ai.path[0].x; tz = ai.path[0].y; onPath = true; }
    } else if (ai.path.length) ai.path.length = 0;
    const dir = tmpV.set(tx - c.pos.x, 0, tz - c.pos.z);
    const dl = dir.length();
    if (dl < 1e-4) return;
    dir.divideScalar(dl);
    // waypoints are already clear → only light local avoidance while on a path
    this.steer(c, dir, onPath ? 0.75 : 1.3);
    c.move.copy(dir).multiplyScalar(Math.min(1, len / 1.2 + 0.3));
  }

  /** stuck detection: wants to move but barely moves → sidestep burst + re-plan; repeated → new goal */
  checkStuck(c: Char, dt: number) {
    const ai = c.ai;
    const moved = Math.hypot(c.pos.x - ai.lastPos.x, c.pos.z - ai.lastPos.z);
    ai.lastPos.copy(c.pos);
    const intent = Math.sqrt(c.move.lengthSq());
    const want = intent > 0.3 && c.dashT <= 0 && c.throwT < 0;
    const expected = WALK_SPEED * (c.jellyT > 0 ? 0.45 : 1) * intent * dt;
    if (want && moved < expected * 0.3) ai.stuckT += dt;
    else {
      ai.stuckT = Math.max(0, ai.stuckT - dt * 1.5);
      if (moved > expected * 0.6) ai.stuckCount = Math.max(0, ai.stuckCount - dt * 0.4);
    }
    if (ai.stuckT < 0.45) return;
    ai.stuckT = 0;
    ai.stuckCount += 1;
    ai.path.length = 0;
    ai.pathT = 0;
    ai.steerSide = -ai.steerSide;
    ai.unstickDir.copy(this.openDir(c));
    ai.unstickT = 0.32;
    if (ai.stuckCount >= 3) {
      // this goal keeps failing → pick a fresh open destination
      ai.stuckCount = 0;
      ai.goal = this.wanderPoint(c, this.mode === 'icetag' && c.role === 'runner' ? this.tagger : null);
      ai.wanderT = rand(2, 3.5);
      ai.think = Math.max(ai.think, 0.45);
    }
  }

  /** most open walkable direction around a character (used to escape snags) */
  openDir(c: Char): THREE.Vector3 {
    const best = new THREE.Vector3(Math.sin(c.facing + Math.PI), 0, Math.cos(c.facing + Math.PI));
    let bs = -Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = Math.sin(a), z = Math.cos(a);
      let free = 0;
      for (let s = 1; s <= 6; s++) {
        if (!this.nav.isFree(c.pos.x + x * s * 0.5, c.pos.z + z * s * 0.5)) break;
        free = s;
      }
      const ex = c.pos.x + x * free * 0.5, ez = c.pos.z + z * free * 0.5;
      const score = free + this.nav.clearance(ex, ez) * 0.8 + Math.random() * 0.6;
      if (score > bs) { bs = score; best.set(x, 0, z); }
    }
    return best;
  }

  steer(c: Char, dir: THREE.Vector3, probe = 1.3) {
    if (!pointBlocked(this.world.colliders, c.pos.x + dir.x * probe, c.pos.z + dir.z * probe, CHAR_R)) return;
    const base = Math.atan2(dir.x, dir.z);
    for (const off of [0.6, 1.1, 1.6, 2.2]) {
      for (const sgn of [c.ai.steerSide, -c.ai.steerSide]) {
        const a = base + off * sgn;
        const x = Math.sin(a), z = Math.cos(a);
        if (!pointBlocked(this.world.colliders, c.pos.x + x * probe, c.pos.z + z * probe, CHAR_R)) {
          dir.set(x, 0, z);
          c.ai.steerSide = sgn;
          return;
        }
      }
    }
  }

  /**
   * Escape direction for runners: far from the tagger, long free run, and ending in OPEN space
   * (low-clearance endpoints = corners / dead ends are penalised so runners don't trap themselves).
   */
  fleeDir(c: Char, tg: Char): THREE.Vector3 {
    const ax = c.pos.x - tg.pos.x, az = c.pos.z - tg.pos.z;
    const al = Math.hypot(ax, az) || 1;
    const best = new THREE.Vector3(ax / al, 0, az / al);
    let bs = -Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = Math.sin(a), z = Math.cos(a);
      let run = 0;
      for (let s = 1; s <= 10; s++) {
        if (!this.nav.isFree(c.pos.x + x * s * 0.6, c.pos.z + z * s * 0.6)) break;
        run = s;
      }
      const ex = c.pos.x + x * run * 0.6, ez = c.pos.z + z * run * 0.6;
      const open = Math.min(this.nav.clearance(ex, ez), 3);
      const away = (x * ax + z * az) / al;
      const edge = Math.max(Math.abs(ex) / 15, Math.abs(ez) / 21);
      // never run past the tagger
      const passT = (ex - tg.pos.x) * ax + (ez - tg.pos.z) * az < 0 ? -2 : 0;
      const score = away * 3 + run * 0.32 + open * 0.7 - edge * 1.4 + passT
        + (x * c.ai.fleeDir.x + z * c.ai.fleeDir.z) * 0.5 + Math.random() * 0.35;
      if (score > bs) { bs = score; best.set(x, 0, z); }
    }
    return best;
  }

  /** point along `dir` that is actually reachable in a straight line (≤ maxDist) */
  fleeGoal(c: Char, dir: THREE.Vector3, maxDist = 4): THREE.Vector3 {
    let d = 0;
    for (let s = 0.5; s <= maxDist; s += 0.5) {
      if (!this.nav.isFree(c.pos.x + dir.x * s, c.pos.z + dir.z * s)) break;
      d = s;
    }
    return c.pos.clone().addScaledVector(dir, Math.max(d, 0.8));
  }

  /** open, reachable roaming destination (prefers far from the tagger) */
  wanderPoint(c: Char, tg: Char | null): THREE.Vector3 {
    let best: THREE.Vector3 | null = null, bs = -Infinity;
    for (let i = 0; i < 10; i++) {
      const p = this.nav.randomOpenPoint(c.pos.x, c.pos.z, 5, 10, 1.25, 6);
      if (!p) continue;
      const dtg = tg ? Math.hypot(p.x - tg.pos.x, p.y - tg.pos.z) : 10;
      const s = Math.min(dtg, 16) + Math.min(this.nav.clearance(p.x, p.y), 3) + Math.random() * 3;
      if (s > bs) { bs = s; best = new THREE.Vector3(p.x, 0, p.y); }
    }
    if (best) return best;
    const fallback = this.nav.randomOpenPoint(0, 0, 3, 14, 1.5, 30);
    return fallback ? new THREE.Vector3(fallback.x, 0, fallback.y) : new THREE.Vector3(0, 0, 6);
  }

  aiRunner(c: Char) {
    const ai = c.ai, D = this.diff, tg = this.tagger;
    const dx = c.pos.x - tg.pos.x, dz = c.pos.z - tg.pos.z;
    const dT = Math.hypot(dx, dz);
    const tgActive = tg.stun <= 0;
    const closing = (tg.vel.x * -dx + tg.vel.z * -dz) / (dT || 1) > 1.5 || dT < 3;
    const othersAlive = this.runners.some((r) => r !== c && r.status === 'alive');

    // (rescue itself is automatic for everyone — see autoThawCheck; the AI only needs to walk close)
    // freeze is the runner's main survival tool: generous range, urgency-scaled rate.
    // Danger (dashing tagger / cornered / slowed) widens the trigger zone; closeness raises the rate.
    // A short reaction delay remains so a well-timed tagger dash can still catch a runner.
    const tgFast = tg.dashT > 0 || tg.motoT > 0;
    const awayX = dx / (dT || 1), awayZ = dz / (dT || 1);
    const corneredNow = pointBlocked(this.world.colliders, c.pos.x + awayX * 2.2, c.pos.z + awayZ * 2.2, CHAR_R);
    const effDist = D.freezeDist * ai.panic + (tgFast ? 0.9 : 0) + (corneredNow ? 0.5 : 0) + (c.jellyT > 0 ? 0.4 : 0);
    const threat = closing || dT < D.freezeClose; // don't freeze when the tagger is running away
    if (tgActive && othersAlive && threat && c.freezeCd <= 0 && dT < effDist && tg.lift < 0.5) {
      ai.alarm += this.lastDt;
      if (ai.alarm >= D.react * ai.panic * 0.7) {
        const closeness = Math.min(1, Math.max(0, 1 - dT / effDist));
        let rate = D.freezeRate * (0.35 + closeness * 1.6);
        if (c.dashCd > 0) rate += 6;
        if (corneredNow) rate += 7;
        if (tgFast) rate += 7;
        if (c.jellyT > 0) rate += 5;
        if (dT < D.freezeClose || Math.random() < rate * this.lastDt) { ai.alarm = 0; this.freeze(c); return; }
      }
    } else ai.alarm = Math.max(0, ai.alarm - this.lastDt * 2);
    // emergency dash
    if (tgActive && closing && dT < D.dangerDist && c.dashCd <= 0 && ai.dodgeT <= 0) {
      const dir = this.fleeDir(c, tg);
      this.startDash(c, dir);
      ai.fleeDir.copy(dir);
      ai.dodgeT = 0.4;
    }
    // items
    if (c.item && ai.itemCd <= 0 && tgActive) {
      let use = false;
      switch (c.item) {
        case 'moto': use = dT < 7; break;
        case 'banana': use = dT < 5 && closing; break;
        default: use = dT < 11;
      }
      if (use) { this.useItem(c); ai.itemCd = 1; }
    }
    if (ai.think <= 0) {
      ai.think = D.think * rand(0.8, 1.3);
      ai.rescue = null;
      if (tgActive && dT < D.fleeDist) {
        const dir = this.fleeDir(c, tg);
        ai.fleeDir.copy(dir);
        ai.goal = this.fleeGoal(c, dir, 4);
      } else {
        let best: Char | null = null, bd = Infinity;
        for (const f of this.runners) {
          if (f === c || f.status !== 'frozen') continue;
          if (f.pos.distanceTo(tg.pos) < D.rescueSafe) continue;
          const d = f.pos.distanceTo(c.pos);
          if (d < bd) { bd = d; best = f; }
        }
        if (best) { ai.rescue = best; ai.goal = best.pos.clone(); }
        else {
          let box: ItemBox | null = null, bxd = 11;
          if (!c.item) {
            for (const it of this.items) {
              if (!it.active) continue;
              const d = Math.hypot(it.x - c.pos.x, it.z - c.pos.z);
              const dtg = Math.hypot(it.x - tg.pos.x, it.z - tg.pos.z);
              if (d < bxd && dtg > 8) { bxd = d; box = it; }
            }
          }
          if (box) ai.goal = new THREE.Vector3(box.x, 0, box.z);
          else {
            ai.wanderT -= D.think;
            if (!ai.goal || ai.wanderT <= 0 || c.pos.distanceTo(ai.goal) < 1.2) { ai.wanderT = rand(2, 4); ai.goal = this.wanderPoint(c, tg); }
          }
        }
      }
    }
    if (ai.dodgeT > 0) { c.move.copy(ai.fleeDir); return; }
    this.moveToGoal(c);
  }

  aiTagger(c: Char) {
    const ai = c.ai, D = this.diff;
    if (ai.hesitate > 0) return;
    if (ai.think <= 0) {
      ai.think = D.think * rand(0.7, 1.2);
      if (Math.random() < D.hesitate) { ai.hesitate = 0.35; return; }
      const alive = this.runners.filter((r) => r.status === 'alive');
      if (!alive.length) { ai.goal = null; ai.target = null; return; }
      const frozen = this.runners.filter((r) => r.status === 'frozen');
      let best: Char | null = null, bs = Infinity;
      for (const e of alive) {
        let s = e.pos.distanceTo(c.pos);
        if (e.stun > 0 || e.lift > 0.3) s -= 6;
        if (e.jellyT > 0) s -= 3;
        if (e.motoT > 0) s += 5;
        if (e === ai.target) s -= 1.5;
        for (const f of frozen) if (e.pos.distanceTo(f.pos) < 5) { s -= 3; break; }
        if (!lineOfSight(this.world.colliders, c.pos.x, c.pos.z, e.pos.x, e.pos.z)) s += 3;
        if (s < bs) { bs = s; best = e; }
      }
      ai.target = best;
      const t = best!;
      const d = t.pos.distanceTo(c.pos);
      if (d > 14 && frozen.length > 0) {
        let g = frozen[0], gd = Infinity;
        for (const f of frozen) {
          const dd = Math.min(...alive.map((a) => a.pos.distanceTo(f.pos)));
          if (dd < gd) { gd = dd; g = f; }
        }
        const to = tmpV.set(t.pos.x - g.pos.x, 0, t.pos.z - g.pos.z).normalize();
        ai.goal = g.pos.clone().addScaledVector(to, 2.5);
        if (c.item === 'banana' && ai.itemCd <= 0 && c.pos.distanceTo(g.pos) < 3.5) { this.useItem(c); ai.itemCd = 2; }
      } else {
        const lead = Math.min(1, d / 8) * D.tagLead;
        ai.goal = new THREE.Vector3(t.pos.x + t.vel.x * lead, 0, t.pos.z + t.vel.z * lead);
        if (pointBlocked(this.world.colliders, ai.goal.x, ai.goal.z, 0.3)) ai.goal.set(t.pos.x, 0, t.pos.z);
      }
      if (c.item && c.item !== 'banana' && ai.itemCd <= 0 && d < 13) { this.useItem(c); ai.itemCd = 1.5; }
      else if (c.item === 'banana' && ai.itemCd <= 0 && frozen.length === 0 && Math.random() < 0.05) { this.useItem(c); ai.itemCd = 3; }
      if (c.dashCd <= 0 && d > 1.8 && d < 6.5 && Math.random() < D.tagDashProb && ai.goal) {
        const dir = tmpV.set(ai.goal.x - c.pos.x, 0, ai.goal.z - c.pos.z).normalize();
        const want = Math.atan2(dir.x, dir.z);
        if (Math.abs(angleDiff(c.facing, want)) < 0.6 && !pointBlocked(this.world.colliders, c.pos.x + dir.x * 2, c.pos.z + dir.z * 2, CHAR_R)) this.startDash(c, dir);
      }
    }
    this.moveToGoal(c);
  }

  /**
   * 경찰 AI: 얼음땡 술래 AI(목표 선정 · 선읽기 · 대시)를 바탕으로
   * 동료와 같은 도둑을 겹쳐 쫓지 않고, 갇힌 도둑이 있으면 한 명이 감옥을 지키며, 열린 탈출구를 막는다.
   */
  aiCop(c: Char) {
    const ai = c.ai, D = this.diff, f = this.police!;
    if (this.copHeld(c) || ai.hesitate > 0) return;
    if (ai.think <= 0) {
      ai.think = D.think * rand(0.7, 1.2);
      if (Math.random() < D.hesitate) { ai.hesitate = 0.35; return; }
      const free = this.runners.filter((r) => r.status === 'alive');
      if (!free.length) { ai.goal = null; ai.target = null; return; }
      const mates = this.chars.filter((o) => o !== c && o.role === 'tagger' && o.status === 'alive');
      const jailed = this.runners.filter((r) => r.status === 'frozen').length;
      const jx = f.jail.x, jz = f.jail.z;
      // 갇힌 도둑이 있을 때 번호가 가장 낮은 경찰이 감옥 지킴이
      const guard = jailed > 0 && !mates.some((o) => o.id < c.id);
      let best: Char | null = null, bs = Infinity;
      for (const e of free) {
        let s = e.pos.distanceTo(c.pos);
        if (e.stun > 0 || e.lift > 0.3) s -= 6;
        if (e.jellyT > 0) s -= 3;
        if (e.motoT > 0) s += 5;
        if (e === ai.target) s -= 1.5;
        if (!lineOfSight(this.world.colliders, c.pos.x, c.pos.z, e.pos.x, e.pos.z)) s += 3;
        for (const o of mates) if (o.ai.target === e && o.pos.distanceTo(e.pos) < e.pos.distanceTo(c.pos)) { s += 5; break; }
        if (jailed > 0 && Math.hypot(e.pos.x - jx, e.pos.z - jz) < 7) s -= 5;
            if (s < bs) { bs = s; best = e; }
      }
      ai.target = best;
      const t = best!;
      const d = t.pos.distanceTo(c.pos);
      const dJ = Math.hypot(t.pos.x - jx, t.pos.z - jz);
      let chasing = true;
      if (guard && dJ > 8) {
        // 감옥 앞 구출 범위 바로 바깥에서 가장 가까운 도둑 쪽을 막는다
        const dir = tmpV.set(t.pos.x - jx, 0, t.pos.z - jz).normalize();
        ai.goal = new THREE.Vector3(jx + dir.x * (RESCUE_R + 0.6), 0, jz + dir.z * (RESCUE_R + 0.6));
        chasing = false;
      } else if (d > 14) {
        // 멀리 있는 도둑은 그쪽에서 가장 가까운 탈출구를 먼저 막는다
        let ex = f.exits[0], ed = Infinity;
        for (const x of f.exits) { const dd = Math.hypot(t.pos.x - x.x, t.pos.z - x.z); if (dd < ed) { ed = dd; ex = x; } }
        ai.goal = new THREE.Vector3(ex.x, 0, ex.z);
        chasing = false;
      } else {
        // 경찰은 도둑의 움직임을 절반만 예측한다 (완벽한 요격이면 도둑이 버틸 수 없다)
        const lead = Math.min(1, d / 8) * D.tagLead * 0.5;
        ai.goal = new THREE.Vector3(t.pos.x + t.vel.x * lead, 0, t.pos.z + t.vel.z * lead);
        if (pointBlocked(this.world.colliders, ai.goal.x, ai.goal.z, 0.3)) ai.goal.set(t.pos.x, 0, t.pos.z);
      }
      if (c.item && c.item !== 'banana' && ai.itemCd <= 0 && d < 13) { this.useItem(c); ai.itemCd = 1.5; }
      else if (c.item === 'banana' && ai.itemCd <= 0 && (dJ < 6 || Math.random() < 0.05)) { this.useItem(c); ai.itemCd = 3; }
      if (chasing && c.dashCd <= 0 && d > 1.8 && d < 6.5 && Math.random() < D.tagDashProb * 0.6 && ai.goal) {
        const dir = tmpV.set(ai.goal.x - c.pos.x, 0, ai.goal.z - c.pos.z).normalize();
        const want = Math.atan2(dir.x, dir.z);
        if (Math.abs(angleDiff(c.facing, want)) < 0.6 && !pointBlocked(this.world.colliders, c.pos.x + dir.x * 2, c.pos.z + dir.z * 2, CHAR_R)) this.startDash(c, dir);
      }
    }
    this.moveToGoal(c);
  }

  /**
   * 도둑 도주 목표: 경찰보다 먼저 도착할 수 있고(여유 거리), 열려 있고, 맵 가장자리(막다른 곳)가 아닌 지점.
   * 경찰 쪽으로 가로질러 지나가는 경로는 감점하고, 직전 목표는 가점을 줘 떨림 없이 이어간다.
   */
  safeGoal(c: Char, cops: Char[]): THREE.Vector3 | null {
    if (!cops.length) return null;
    const segDist = (o: Char, bx: number, bz: number) => {
      const ax = c.pos.x, az = c.pos.z, dx = bx - ax, dz = bz - az;
      const l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((o.pos.x - ax) * dx + (o.pos.z - az) * dz) / l2));
      return Math.hypot(o.pos.x - (ax + dx * t), o.pos.z - (az + dz * t));
    };
    const cands: { x: number; z: number; bonus: number }[] = [];
    const cur = c.ai.goal;
    if (cur) cands.push({ x: cur.x, z: cur.z, bonus: 2.5 });
    for (let i = 0; i < 14; i++) {
      const p = this.nav.randomOpenPoint(c.pos.x, c.pos.z, 3, 11, 1.2, 6);
      if (p) cands.push({ x: p.x, z: p.y, bonus: 0 });
    }
    let best: THREE.Vector3 | null = null, bs = -Infinity;
    for (const k of cands) {
      const myD = Math.hypot(k.x - c.pos.x, k.z - c.pos.z);
      if (myD < 1.5) continue;
      let margin = Infinity, cross = 0;
      for (const o of cops) {
        margin = Math.min(margin, Math.hypot(k.x - o.pos.x, k.z - o.pos.z) - myD * 1.05);
        if (segDist(o, k.x, k.z) < 2.5) cross = 1;
      }
      const edge = Math.max(Math.abs(k.x) / 15, Math.abs(k.z) / 21);
      const score = Math.min(margin, 10) + Math.min(this.nav.clearance(k.x, k.z), 3) * 1.2 - edge * edge * 9 - cross * 6 + k.bonus + Math.random() * 1.2;
      if (score > bs) { bs = score; best = new THREE.Vector3(k.x, 0, k.z); }
    }
    return best;
  }

  /**
   * 도둑 AI: 얼음땡 도망자 AI(도주 방향 · 비상 대시 · 아이템)를 바탕으로
   * 경찰이 가까우면 도망, 안전하면 갇힌 동료 구출 / 열린 탈출구로 이동 / 아이템 획득.
   */
  aiRobber(c: Char) {
    const ai = c.ai, D = this.diff, f = this.police!;
    let cop: Char | null = null, dC = Infinity;
    for (const o of this.chars) {
      if (o.role !== 'tagger' || o.status !== 'alive') continue;
      const d = o.pos.distanceTo(c.pos);
      if (d < dC) { dC = d; cop = o; }
    }
    const active = !!cop && cop.stun <= 0 && cop.lift < 0.5;
    let closing = false;
    if (cop) {
      const dx = c.pos.x - cop.pos.x, dz = c.pos.z - cop.pos.z;
      closing = (cop.vel.x * -dx + cop.vel.z * -dz) / (dC || 1) > 1.5 || dC < 3;
    }
    if (cop && active && closing && dC < D.dangerDist && c.dashCd <= 0 && ai.dodgeT <= 0) {
      let dir = this.fleeDir(c, cop);
      if (ai.goal) {
        const gx = ai.goal.x - c.pos.x, gz = ai.goal.z - c.pos.z, gl = Math.hypot(gx, gz);
        if (gl > 1 && (gx * (c.pos.x - cop.pos.x) + gz * (c.pos.z - cop.pos.z)) / gl > 0) dir = new THREE.Vector3(gx / gl, 0, gz / gl);
      }
      this.startDash(c, dir);
      ai.fleeDir.copy(dir);
      ai.dodgeT = 0.4;
    }
    if (c.item && ai.itemCd <= 0 && cop && active) {
      let use = false;
      switch (c.item) {
        case 'moto': use = dC < 7; break;
        case 'banana': use = dC < 5 && closing; break;
        default: use = dC < 11;
      }
      if (use) { this.useItem(c); ai.itemCd = 1; }
    }
    if (ai.think <= 0) {
      ai.think = D.think * rand(0.8, 1.3);
      const cops = this.chars.filter((o) => o.role === 'tagger' && o.status === 'alive');
      const copDist = (x: number, z: number) => cops.reduce((m, o) => Math.min(m, Math.hypot(o.pos.x - x, o.pos.z - z)), Infinity);
      const prisoners = this.runners.filter((r) => r.status === 'frozen').length;
      if (cop && active && dC < D.fleeDist * 0.85) {
        const dir = this.fleeDir(c, cop);
        ai.fleeDir.copy(dir);
        ai.goal = this.safeGoal(c, cops.filter((o) => o.stun <= 0)) ?? this.fleeGoal(c, dir, 4);
      } else {
        const jailSafe = copDist(f.jail.x, f.jail.z) > D.rescueSafe;
        const wantRescue = prisoners > 0 && jailSafe && (c.id % 2 === 1 || !this.exitOpen);
        if (wantRescue) {
          // 감옥 구출 범위 안쪽 (내가 오는 방향)으로
          const a = Math.atan2(c.pos.x - f.jail.x, c.pos.z - f.jail.z);
          ai.goal = new THREE.Vector3(f.jail.x + Math.sin(a) * 2.5, 0, f.jail.z + Math.cos(a) * 2.5);
        } else {
          // 탈출구 없이 맵을 돌아다니며 경찰을 피한다
          ai.goal = this.safeGoal(c, cops.filter((o) => o.stun <= 0)) ?? this.fleeGoal(c, new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5), 8);
        }
      }
    }
    if (ai.dodgeT > 0) { c.move.copy(ai.fleeDir); return; }
    this.moveToGoal(c);
  }

  aiOjaemi(c: Char) {
    const ai = c.ai, D = this.diff;
    for (const p of this.projectiles) {
      if (!p.alive || !this.isEnemy(c, p.owner) || ai.seen.has(p) || p.age < D.react) continue;
      const tca = this.threatTime(c, p);
      if (tca === Infinity || tca > 1.1) continue;
      ai.seen.add(p);
      if (Math.random() < D.dodgeProb) {
        const vx = p.vel.x, vz = p.vel.z;
        const v2 = vx * vx + vz * vz;
        const rx = c.pos.x - p.pos.x, rz = c.pos.z - p.pos.z;
        const t = (rx * vx + rz * vz) / v2;
        const ox = rx - vx * t, oz = rz - vz * t;
        const perp = new THREE.Vector3(-vz, 0, vx).normalize();
        let side = Math.sign(ox * perp.x + oz * perp.z) || (Math.random() < 0.5 ? 1 : -1);
        if (pointBlocked(this.world.colliders, c.pos.x + perp.x * side * 1.5, c.pos.z + perp.z * side * 1.5, CHAR_R)) side = -side;
        ai.dodgeDir.copy(perp).multiplyScalar(side);
        ai.dodgeT = 0.45;
        if (c.dashCd <= 0 && tca < 0.55 && Math.random() < 0.75) this.startDash(c, ai.dodgeDir);
      }
    }
    if (ai.dodgeT > 0) { c.move.copy(ai.dodgeDir); return; }
    if (ai.think <= 0) { ai.think = D.think * rand(0.8, 1.25); this.ojaemiThink(c); }
    const t = ai.target;
    if (t && c.bag && ai.throwCd <= 0 && c.throwT < 0 && t.status === 'alive') {
      const d = t.pos.distanceTo(c.pos);
      if (d < 17 && t.invuln <= 0.3 && lineOfSight(this.world.colliders, c.pos.x, c.pos.z, t.pos.x, t.pos.z)) {
        const ft = d / THROW_SPEED + THROW_RELEASE;
        const lead = t.stun > 0 ? 0 : D.lead;
        const err = D.aimErr * (0.4 + d / 16);
        this.startThrow(c, new THREE.Vector3(t.pos.x + t.vel.x * ft * lead + rand(-err, err), t.lift + 0.85, t.pos.z + t.vel.z * ft * lead + rand(-err, err)));
        ai.throwCd = rand(D.throwMin, D.throwMax);
      } else if (d >= 17) ai.throwCd = 0.3;
    }
    this.moveToGoal(c);
  }

  ojaemiThink(c: Char) {
    const ai = c.ai, D = this.diff;
    let best: Char | null = null, bs = Infinity;
    for (const e of this.enemyList(c)) {
      const d = e.pos.distanceTo(c.pos);
      let s = d;
      if (e.stun > 0 && e.invuln <= 0) s -= 7;
      if (e.invuln > 0.4) s += 10;
      if (e === ai.target) s -= 2;
      if (!lineOfSight(this.world.colliders, c.pos.x, c.pos.z, e.pos.x, e.pos.z)) s += 5;
      if (s < bs) { bs = s; best = e; }
    }
    ai.target = best;
    let goal: THREE.Vector3 | null = null;
    if (!c.bag) {
      let bp: Pickup | null = null, bd = Infinity;
      for (const p of this.pickups) {
        const d = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
        if (d < bd) { bd = d; bp = p; }
      }
      if (bp) {
        goal = new THREE.Vector3(bp.x, 0, bp.z);
        if (bd > 5 && c.dashCd <= 0 && Math.random() < 0.3) this.startDash(c, tmpV.set(bp.x - c.pos.x, 0, bp.z - c.pos.z));
      } else goal = this.wanderPoint(c, null);
    } else if (best) {
      const to = tmpV.set(best.pos.x - c.pos.x, 0, best.pos.z - c.pos.z);
      const d = to.length();
      to.divideScalar(d || 1);
      const want = D.dist + ((c.id % 3) - 1) * 1.2;
      if (Math.random() < 0.12) ai.strafe = -ai.strafe;
      const perp = new THREE.Vector3(-to.z, 0, to.x).multiplyScalar(ai.strafe);
      if (!lineOfSight(this.world.colliders, c.pos.x, c.pos.z, best.pos.x, best.pos.z)) goal = new THREE.Vector3(best.pos.x, 0, best.pos.z).addScaledVector(perp, 3);
      else if (d > want + 2) goal = c.pos.clone().addScaledVector(to, Math.min(4, d - want)).addScaledVector(perp, 1.5);
      else if (d < want - 3) goal = c.pos.clone().addScaledVector(to, -3).addScaledVector(perp, 1.5);
      else goal = c.pos.clone().addScaledVector(perp, 3);
      for (const m of this.chars) {
        if (m === c || m.team !== c.team) continue;
        if (m.pos.distanceTo(c.pos) < 3.5) goal.add(tmpV2.copy(c.pos).sub(m.pos).setY(0).normalize().multiplyScalar(2));
      }
    }
    ai.goal = goal;
    if (c.item && ai.itemCd <= 0 && best) {
      const d = best.pos.distanceTo(c.pos);
      let use = false;
      switch (c.item) {
        case 'moto': use = d > 11 || (!c.bag && Math.random() < 0.5); break;
        case 'ufo': use = d < 14 && c.bag; break;
        case 'missile': use = d < 20 && Math.random() < 0.5; break;
        case 'banana': use = d < 5; break;
        case 'jelly': use = d < 12 && Math.random() < 0.6; break;
      }
      if (use) {
        if (c.item === 'ufo') ai.throwCd = Math.min(ai.throwCd, 0.5);
        this.useItem(c);
        ai.itemCd = 1.5;
      }
    }
  }

  // ------------------------------------------------------------ char update
  updateChar(c: Char, dt: number) {
    const m0 = (v: number) => Math.max(0, v - dt);
    c.dashCd = m0(c.dashCd); c.pickT = m0(c.pickT); c.invuln = m0(c.invuln); c.recover = m0(c.recover); c.jellyT = m0(c.jellyT);
    c.bumpCd = m0(c.bumpCd); c.grace = m0(c.grace); c.freezeCd = m0(c.freezeCd); c.thawT = m0(c.thawT); c.tagAnim = m0(c.tagAnim);
    if (c.motoT > 0) c.motoT = m0(c.motoT);
    c.blinkT -= dt;
    if (c.blinkT < -0.12) c.blinkT = rand(1.5, 3.5);

    if (c.status === 'out') {
      c.outT += dt;
      if (c.outT > 1.3 && c.m.root.visible) c.m.root.visible = false;
      c.vel.set(0, 0, 0);
      return;
    }
    const playing = this.phase === 'playing';
    if (playing && this.mode === 'icetag' && c.role === 'runner') c.st.survive += dt;
    if (c.status === 'frozen') {
      c.iceT += dt;
      c.vel.set(0, 0, 0); c.knock.set(0, 0, 0);
      return;
    }
    if (c.stun > 0) {
      c.stun -= dt; c.stunEl += dt;
      if (c.stun <= 0) {
        c.stun = 0;
        const wasUfo = c.stunType === 'ufo';
        if (wasUfo) { c.m.ufoBeam.visible = false; this.fx.emit('spark', tmpV.set(c.pos.x, 3.5, c.pos.z), 10, 3, 0.5, 1); }
        c.stunType = null; c.recover = 0.35;
        if (wasUfo) { this.applyStun(c, 'bump', 0.7); c.recover = 0; }
      }
    }
    if (c.throwT >= 0) {
      c.throwT += dt;
      if (!c.throwReleased && c.throwT >= THROW_RELEASE) { c.throwReleased = true; this.releaseThrow(c); }
      if (c.throwT >= THROW_END) c.throwT = -1;
    }
    // movement — online guests own their position while free to move (no input round-trip lag);
    // the host takes over during stuns / knockbacks so item effects stay authoritative
    if (this.netRole === 'host' && c.remote && c.hasNet && playing && c.stun <= 0) {
      const px = c.pos.x, pz = c.pos.z;
      c.pos.lerp(c.netPos, Math.min(1, dt * 18));
      resolveCircle(this.world.colliders, c.pos, CHAR_R);
      const inv = dt > 0 ? 1 / dt : 0;
      tmpV.set((c.pos.x - px) * inv, 0, (c.pos.z - pz) * inv);
      c.vel.lerp(tmpV, Math.min(1, dt * 14));
      if (c.dashT > 0) {
        c.dashT -= dt;
        if (Math.random() < 0.6) this.fx.emit(this.theme.snowy ? 'snow' : 'spark', tmpV2.set(c.pos.x, 0.15, c.pos.z), 1, 1, 0.3, 2, 0.7);
      }
      c.knock.set(0, 0, 0);
      if (c.throwT < 0) c.facing += angleDiff(c.facing, c.netFacing) * Math.min(1, dt * 16);
    } else {
    if (c.stun > 0 || !playing) c.vel.lerp(ZERO, Math.min(1, dt * 10));
    else if (c.dashT > 0) {
      c.dashT -= dt;
      c.vel.copy(c.dashDir).multiplyScalar(DASH_SPEED);
      if (Math.random() < 0.6) this.fx.emit(this.theme.snowy ? 'snow' : 'spark', tmpV2.set(c.pos.x, 0.15, c.pos.z), 1, 1, 0.3, 2, 0.7);
    } else {
      let sp = this.chaseMode && c.role === 'tagger' ? TAGGER_SPEED : this.mode === 'police' && c.role === 'runner' ? ROBBER_SPEED : WALK_SPEED;
      if (c.motoT > 0) sp *= 1.8;
      if (c.jellyT > 0) sp *= 0.45;
      if (c.throwT >= 0) sp *= 0.7;
      if (c.thawT > 0) sp *= 0.5;
      tmpV.copy(c.move).multiplyScalar(sp);
      c.vel.lerp(tmpV, Math.min(1, dt * (c.motoT > 0 ? 8 : 16)));
      if (c.motoT > 0 && Math.random() < 0.5) this.fx.emit('snow', tmpV2.set(c.pos.x, 0.1, c.pos.z), 1, 1.2, 0.35, 1, 0.8);
    }
    c.pos.addScaledVector(c.vel, dt);
    c.pos.addScaledVector(c.knock, dt);
    c.knock.multiplyScalar(Math.max(0, 1 - dt * 5));
    resolveCircle(this.world.colliders, c.pos, CHAR_R);
    // facing (마우스 조작: 내 캐릭터는 항상 커서를 바라봄 — 오재미 조준이 쉬워짐)
    if (playing && c.stun <= 0 && c.throwT < 0) {
      const hv = Math.hypot(c.vel.x, c.vel.z);
      if (c.isPlayer && this.controlMode === 'mouse' && this.mouseAimValid && c.dashT <= 0) {
        c.facing += angleDiff(c.facing, Math.atan2(this.mouseAim.x - c.pos.x, this.mouseAim.z - c.pos.z)) * Math.min(1, dt * 18);
      } else if (hv > 0.6 && c.move.lengthSq() > 0.01) {
        const want = Math.atan2(c.move.x, c.move.z);
        c.facing += angleDiff(c.facing, want) * Math.min(1, dt * 14);
      } else if (c.dashT > 0) c.facing = Math.atan2(c.dashDir.x, c.dashDir.z);
    } else if (this.phase === 'final' || this.phase === 'roundEnd') {
      const want = this.camSign > 0 ? 0 : Math.PI;
      c.facing += angleDiff(c.facing, want) * Math.min(1, dt * 4);
    }
    }
    // lift
    if (c.stunType === 'ufo') c.lift += (2.3 - c.lift) * Math.min(1, dt * 3);
    else if (c.stunType === 'missile' && c.stunEl < 0.9) c.lift = Math.sin((c.stunEl / 0.9) * Math.PI) * 2.6;
    else c.lift = Math.max(0, c.lift - dt * 6);
    // footsteps
    if (c.isPlayer && playing) {
      const hv = Math.hypot(c.vel.x, c.vel.z);
      if (hv > 2 && c.lift < 0.1) {
        c.stepT -= dt * (hv / 5);
        if (c.stepT <= 0) { c.stepT = 0.32; this.sfx.step(); }
      }
    }
    // moto bump
    if (c.motoT > 0 && playing) {
      for (const e of this.chars) {
        if (!this.isEnemy(c, e) || e.status !== 'alive' || e.stun > 0 || e.bumpCd > 0) continue;
        if (e.pos.distanceTo(c.pos) < 1.05) {
          this.applyStun(e, 'bump', 0.7, tmpV2.copy(e.pos).sub(c.pos), 7);
          e.bumpCd = 1.2;
          this.fx.emit('star', tmpV2.set(e.pos.x, 1.5, e.pos.z), 4, 3, 0.5, 4);
          if (this.near(e)) this.sfx.bump();
        }
      }
    }
  }

  separateChars() {
    const cs = this.chars;
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        const a = cs[i], b = cs[j];
        if (a.status === 'out' || b.status === 'out') continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const min = CHAR_R * 2;
        if (d < min && d > 0.0001) {
          const push = min - d;
          const af = a.status === 'frozen', bf = b.status === 'frozen';
          if (af && bf) continue;
          if (af) { b.pos.x += (dx / d) * push; b.pos.z += (dz / d) * push; }
          else if (bf) { a.pos.x -= (dx / d) * push; a.pos.z -= (dz / d) * push; }
          else { a.pos.x -= (dx / d) * push / 2; a.pos.z -= (dz / d) * push / 2; b.pos.x += (dx / d) * push / 2; b.pos.z += (dz / d) * push / 2; }
        }
      }
    }
  }

  // ------------------------------------------------------------ animation
  animate(c: Char, dt: number) {
    const m = c.m, t = this.elapsed;
    if (c.status === 'out') {
      if (!m.root.visible) return;
      const k = Math.min(1, c.outT / 1.3);
      m.root.position.set(c.pos.x, Math.sin(k * Math.PI) * 2.2, c.pos.z);
      m.root.rotation.y = c.facing + c.outT * 16;
      m.root.scale.setScalar(Math.max(0.03, 1.15 * (1 - k * 0.9)));
      m.ring.visible = false;
      m.ice.visible = false;
      return;
    }
    m.ring.visible = true;
    m.root.position.set(c.pos.x, c.lift, c.pos.z);
    m.root.rotation.y = c.facing;
    m.ring.position.y = 0.03 - c.lift + 0.001;
    const b = m.body;
    b.position.set(0, 0, 0); b.rotation.set(0, 0, 0); b.scale.set(1, 1, 1);
    m.head.rotation.set(0, 0, 0);
    m.armL.rotation.set(0, 0, 0.25); m.armR.rotation.set(0, 0, -0.25);
    m.legL.rotation.set(0, 0, 0); m.legR.rotation.set(0, 0, 0);
    const blink = c.blinkT < 0;
    for (const e of m.eyes) e.scale.y = blink ? 0.15 : 1.25;
    if (c.label) { c.label.visible = true; c.label.position.set(c.pos.x, c.lift + (c.role === 'tagger' && this.mode === 'icetag' ? 3.75 : 2.95), c.pos.z); }
    m.taggerMark.visible = this.mode === 'icetag' && c.role === 'tagger';
    if (m.taggerMark.visible) { m.taggerMark.position.y = 2.75 + Math.sin(t * 4) * 0.1; m.taggerMark.rotation.y = t * 2; }
    m.handBag.visible = this.mode === 'ojaemi' && c.bag && !(c.throwT >= 0 && c.throwReleased);

    const hv = Math.hypot(c.vel.x, c.vel.z);
    c.walkPhase += dt * Math.min(hv, 9) * 2.3;
    m.stars.visible = c.stun > 0 && c.stunType !== 'ufo';
    if (m.stars.visible) { m.stars.rotation.y = t * 6; m.stars.position.y = 2.05 + (c.stunType === 'slip' ? -0.5 : 0); }
    m.moto.visible = c.motoT > 0;
    if (m.moto.visible) m.moto.children.forEach((w) => { if (w.name === 'wheel') w.rotation.x += dt * 25; });
    m.jellyBlob.visible = c.jellyT > 0;
    if (m.jellyBlob.visible) { const w = Math.sin(t * 9) * 0.08; m.jellyBlob.scale.set(1 + w, 0.7 - w, 1 + w); }
    if (m.ufoBeam.visible) { m.ufoBeam.position.y = 4.4 - c.lift; m.ufoBeam.rotation.y = t * 3; }

    // frozen
    m.ice.visible = c.status === 'frozen' && this.mode !== 'police';
    if (c.status === 'frozen' && this.mode === 'police') {
      // 감옥에 갇힌 도둑: 창살을 붙잡고 풀죽은 자세
      m.armL.rotation.z = 2.3; m.armR.rotation.z = -2.3;
      m.armL.rotation.x = -0.35; m.armR.rotation.x = -0.35;
      m.head.rotation.x = 0.25; m.head.rotation.y = Math.sin(t * 0.9 + c.id) * 0.3;
      b.rotation.x = 0.08; b.position.y = Math.abs(Math.sin(t * 2.4 + c.id)) * 0.04;
      return;
    }
    if (c.status === 'frozen') {
      const k = Math.min(1, c.iceT / 0.3);
      const s = k < 0.7 ? (k / 0.7) * 1.15 : 1.15 - ((k - 0.7) / 0.3) * 0.15;
      m.ice.scale.setScalar(Math.max(0.01, s));
      m.armL.rotation.z = 1.4; m.armR.rotation.z = -1.4;
      m.armL.rotation.x = -0.6; m.armR.rotation.x = -0.6;
      m.legL.rotation.x = 0.6; m.legR.rotation.x = -0.4;
      m.head.rotation.z = 0.12;
      m.head.rotation.y = Math.sin(t * 0.7 + c.id) * 0.06;
      b.rotation.x = -0.1;
      return;
    }

    // results
    if (this.phase === 'final' || this.phase === 'roundEnd') {
      const won = this.phase === 'final' ? c.finalWon : c.roundWon;
      if (won) {
        const j = Math.abs(Math.sin(t * 5 + c.id));
        b.position.y = j * 0.55;
        m.armL.rotation.z = 2.6 + Math.sin(t * 10) * 0.2;
        m.armR.rotation.z = -2.6 - Math.sin(t * 10) * 0.2;
        m.legL.rotation.x = -j * 0.5; m.legR.rotation.x = -j * 0.5;
        m.head.rotation.z = Math.sin(t * 5) * 0.15;
      } else {
        b.rotation.x = 0.35;
        m.head.rotation.x = 0.45;
        m.armL.rotation.z = 0.1; m.armR.rotation.z = -0.1;
        b.position.y = -0.05 + Math.sin(t * 2) * 0.02;
        m.head.rotation.y = Math.sin(t * 1.5) * 0.25;
      }
      return;
    }

    if (c.stun > 0) {
      const k = c.stun / c.stunMax;
      switch (c.stunType) {
        case 'hit': case 'bump': {
          b.rotation.x = -0.45 * Math.min(1, k * 2) + Math.sin(c.stunEl * 22) * 0.12 * k;
          b.rotation.z = Math.sin(c.stunEl * 9) * 0.18 * k;
          m.armL.rotation.z = 1.9 + Math.sin(t * 20) * 0.5; m.armR.rotation.z = -1.9 - Math.cos(t * 20) * 0.5;
          m.head.rotation.z = Math.sin(t * 14) * 0.25;
          m.legL.rotation.x = 0.4; m.legR.rotation.x = -0.2;
          break;
        }
        case 'slip': {
          b.rotation.y = c.stunEl * 16 * Math.max(0, 1 - c.stunEl / 0.8);
          b.rotation.x = -Math.min(1.2, c.stunEl * 3);
          b.position.y = Math.min(0.3, c.stunEl) * 0.4;
          m.legL.rotation.x = -1.3; m.legR.rotation.x = -1.0;
          m.armL.rotation.z = 1.5; m.armR.rotation.z = -1.5;
          break;
        }
        case 'missile': {
          b.rotation.x = -c.stunEl * 9 * Math.max(0, 1 - c.stunEl / 1.0);
          m.armL.rotation.z = 2.4; m.armR.rotation.z = -2.4;
          m.legL.rotation.x = -0.6; m.legR.rotation.x = 0.6;
          break;
        }
        case 'ufo': {
          b.rotation.z = Math.sin(t * 4) * 0.25; b.rotation.y = Math.sin(t * 2) * 0.5;
          m.armL.rotation.z = 2.3 + Math.sin(t * 16) * 0.5; m.armR.rotation.z = -2.3 + Math.sin(t * 16) * 0.5;
          m.legL.rotation.x = Math.sin(t * 14) * 0.9; m.legR.rotation.x = -Math.sin(t * 14) * 0.9;
          break;
        }
      }
      return;
    }

    // locomotion
    if (c.motoT > 0) {
      b.position.y = 0.32 + Math.sin(t * 30) * 0.015;
      b.rotation.x = 0.25;
      m.legL.rotation.x = -1.3; m.legR.rotation.x = -1.3;
      m.legL.rotation.z = -0.3; m.legR.rotation.z = 0.3;
      m.armL.rotation.x = -1.2; m.armR.rotation.x = -1.2;
    } else {
      const amp = Math.min(1, hv / 5);
      const s = Math.sin(c.walkPhase);
      m.legL.rotation.x = s * 0.9 * amp; m.legR.rotation.x = -s * 0.9 * amp;
      m.armL.rotation.x = -s * 0.7 * amp; m.armR.rotation.x = s * 0.7 * amp;
      b.position.y = Math.abs(Math.cos(c.walkPhase)) * 0.08 * amp;
      b.rotation.x = amp * 0.14;
      if (amp < 0.1) {
        const br = Math.sin(t * 2.4 + c.id);
        b.scale.set(1 + br * 0.012, 1 - br * 0.018, 1);
        m.head.rotation.z = Math.sin(t * 1.2 + c.id) * 0.05;
        m.head.rotation.y = Math.sin(t * 0.8 + c.id * 2) * 0.12;
      }
    }
    if (c.dashT > 0) {
      b.rotation.x = 0.55;
      m.armL.rotation.x = 1.3; m.armR.rotation.x = 1.3;
      m.legL.rotation.x = -0.9; m.legR.rotation.x = 0.7;
    }
    if (this.mode === 'ojaemi' && c.bag && c.throwT < 0 && c.motoT <= 0) m.armR.rotation.x = Math.min(m.armR.rotation.x, -0.55);
    if (c.pickT > 0) {
      const k = Math.sin((1 - c.pickT / 0.35) * Math.PI);
      b.rotation.x += k * 0.55;
      m.armR.rotation.x = -k * 1.1; m.armL.rotation.x = -k * 0.9;
      b.position.y -= k * 0.12;
    }
    if (c.throwT >= 0) {
      const tt = c.throwT;
      if (tt < THROW_RELEASE) {
        const k = tt / THROW_RELEASE;
        m.armR.rotation.x = 2.5 * k; m.armR.rotation.z = -0.25 - 0.3 * k;
        b.rotation.y = -0.45 * k; m.armL.rotation.x = -0.9 * k; b.rotation.x = -0.12 * k;
      } else if (tt < THROW_RELEASE + 0.1) {
        const k = (tt - THROW_RELEASE) / 0.1;
        m.armR.rotation.x = 2.5 - 4.1 * k; b.rotation.y = -0.45 + 0.8 * k; b.rotation.x = -0.12 + 0.35 * k; m.armL.rotation.x = -0.9 + 1.3 * k;
      } else {
        const k = (tt - THROW_RELEASE - 0.1) / (THROW_END - THROW_RELEASE - 0.1);
        m.armR.rotation.x = -1.6 * (1 - k); b.rotation.y = 0.35 * (1 - k); b.rotation.x = 0.23 * (1 - k);
      }
    }
    if (c.tagAnim > 0) {
      const k = c.tagAnim / 0.45;
      b.rotation.x = 0.4 * k;
      m.armL.rotation.x = -1.6 * k; m.armR.rotation.x = -1.6 * k;
    }
    if (c.thawT > 0) {
      const k = c.thawT / 0.5;
      b.position.y += Math.sin((1 - k) * Math.PI) * 0.3;
      m.armL.rotation.z = 2.4; m.armR.rotation.z = -2.4;
      m.head.rotation.z = Math.sin(t * 30) * 0.1 * k;
    }
    if (c.jellyT > 0) {
      const w = Math.sin(t * 12) * 0.08;
      b.scale.set(1 + w, 1 - w, 1 + w);
      b.rotation.z = Math.sin(t * 6) * 0.15;
    }
    if (c.recover > 0) m.head.rotation.z = Math.sin(t * 35) * 0.25 * (c.recover / 0.35);
    b.visible = !(c.invuln > 0 && c.stun <= 0 && Math.floor(t * 14) % 2 === 0);
  }

  // ------------------------------------------------------------ camera
  spectateTarget(): Char {
    const alive = this.runners.filter((r) => r !== this.player && r.status === 'alive');
    const frozen = this.runners.filter((r) => r !== this.player && r.status === 'frozen');
    const cands = [...alive, ...frozen, this.tagger];
    return cands[this.spectateIdx % cands.length] ?? this.player;
  }

  updateCamera(dt: number) {
    // 0 = tall phone portrait … 1 = landscape / desktop (continuous, so tablets & odd ratios blend)
    const wide = THREE.MathUtils.smoothstep(this.camera.aspect, 0.62, 1.45);
    const s = this.camSign;
    let focus = this.player;
    let kind: 'play' | 'result' | 'demo' = 'play';
    if (this.phase === 'roundEnd' || this.phase === 'final') { focus = this.hero ?? this.player; kind = 'result'; }
    else if (this.demo) {
      this.demoT -= dt;
      if (this.demoT <= 0 || !this.demoFocus || this.demoFocus.status === 'out') {
        this.demoT = 6;
        if (this.mode === 'icetag') { const tg = this.tagger; this.demoFocus = tg.ai.target && tg.ai.target.status === 'alive' && Math.random() < 0.6 ? tg.ai.target : tg; }
        else this.demoFocus = pick(this.chars);
      }
      focus = this.demoFocus; kind = 'demo';
    } else if (this.mode === 'icetag' && this.player.status === 'out') focus = this.spectateTarget();
    const fp = focus.pos;
    let px: number, py: number, pz: number, lx: number, ly: number, lz: number;
    if (kind === 'result') {
      px = fp.x + 0.5; py = 4.2 + focus.lift; pz = fp.z + 7 * s; lx = fp.x; ly = 1.1 + focus.lift; lz = fp.z;
      if (!lineOfSight(this.world.colliders, px, pz, fp.x, fp.z, 2.5)) { py = 8; pz = fp.z + 4.5 * s; }
    } else if (kind === 'demo') {
      px = fp.x * 0.9; py = 12.5; pz = fp.z + 10 * s; lx = fp.x * 0.9; ly = 0.8; lz = fp.z + 1.5 * s;
    } else {
      // portrait: higher & looks further ahead (narrow view needs more depth);
      // landscape: lower, closer chase cam that also drifts toward map center on wide screens
      const ch = THREE.MathUtils.lerp(15.5, 11.2, wide);
      const cz = THREE.MathUtils.lerp(10.5, 9.8, wide);
      const ahead = THREE.MathUtils.lerp(4.6, 2.9, wide);
      const ultra = THREE.MathUtils.smoothstep(this.camera.aspect, 1.9, 2.4); // 21:9 monitors
      px = fp.x * THREE.MathUtils.lerp(1, 0.85, wide); py = ch - ultra * 0.8; pz = fp.z + (cz - ultra * 0.6) * s; lx = px; ly = 0.5; lz = fp.z - ahead * s;
    }
    if (this.cfg.cinematic) {
      // slow panorama from just beside the fountain, looking out over houses, trees and paths
      const a = -Math.PI / 2 + this.elapsed * 0.045;
      const cx = Math.cos(a) * 3.4, cz = Math.sin(a) * 3.4 + 7.5;
      px = cx; py = 4.6; pz = cz;
      lx = cx + Math.cos(a + 0.35) * 12; ly = 2.4; lz = cz + Math.sin(a + 0.35) * 12;
    }
    const k = this.elapsed < 0.1 || this.cfg.cinematic ? 1 : Math.min(1, dt * (kind === 'result' ? 2.5 : 5));
    this.camPos.lerp(tmpV2.set(px, py, pz), k);
    this.camLook.lerp(tmpV.set(lx, ly, lz), Math.min(1, k * 1.2));
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake -= dt;
      const sk = this.shake * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * sk;
      this.camera.position.y += (Math.random() - 0.5) * sk;
    }
    this.camera.lookAt(this.camLook);
  }

  // ------------------------------------------------------------ main loop
  loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.05) dt = 0.05;
    if (this.paused) { this.draw(); return; }
    this.update(dt);
    this.draw();
  };

  post: ToonPost | null = null;
  /** render through the toon post stack when available */
  draw() {
    if (this.post) this.post.render();
    else this.renderer.render(this.scene, this.camera);
  }

  update(dt: number) {
    this.elapsed += dt; this.phaseT += dt; this.lastDt = dt;
    if (this.startFlash > 0) this.startFlash -= dt;
    if (this.netRole === 'client') { this.clientUpdate(dt); return; }

    if (this.phase === 'countdown') {
      const cd = Math.ceil(this.countdownLen - this.phaseT);
      if (cd !== this.lastCountdown && cd > 0) { this.lastCountdown = cd; if (!this.demo) this.sfx.count(); }
      if (this.phaseT >= this.countdownLen) { this.phase = 'playing'; this.phaseT = 0; this.startFlash = 0.9; if (!this.demo) this.sfx.start(); }
    } else if (this.phase === 'playing') {
      this.time -= dt;
      if (this.mode === 'icetag') this.checkIceTagEnd();
      else if (this.mode === 'police') this.policeT += dt;
      else {
        if (this.time <= 0) {
          if (this.scores.red === this.scores.blue) {
            this.overtime = true; this.time = OVERTIME;
            this.toast('⏰ 동점! 연장전 — 먼저 명중하는 팀 승리!', '#ffe14a');
            if (!this.demo) this.sfx.whistle();
          } else this.endRound(this.scores.red > this.scores.blue ? 'red' : 'blue', 'time');
        }
        if (this.phase === 'playing') this.updateSpawns(dt);
      }
    } else if (this.phase === 'roundEnd') {
      if (this.phaseT > (this.demo ? 3 : 4.5)) {
        if (this.round < this.totalRounds) { this.round++; this.resetRound(); }
        else this.enterFinal();
      }
    } else if (this.phase === 'final') {
      if (this.demo && this.phaseT > 3) this.restart();
    }

    const p = this.player;
    this.updateMouseAim();
    if (!this.demo) p.move.copy(p.status === 'alive' ? this.playerMoveVec() : ZERO);
    if (this.copHeld(p)) p.move.set(0, 0, 0);
    for (const c of this.chars) if (!c.isPlayer && !c.remote) this.updateAI(c, dt);
    for (const c of this.chars) this.updateChar(c, dt);
    this.separateChars();
    if (this.mode === 'icetag' && this.phase === 'playing') { this.tagCheck(); this.autoThawCheck(); }
    if (this.mode === 'police' && this.phase === 'playing') this.updatePolice(dt);
    if (this.mode === 'ojaemi') { this.updateProjectiles(dt); this.updatePickups(dt); }
    this.updateItems(dt);
    if (this.netRole === 'host') {
      this.netT -= dt;
      // ~20Hz snapshots; guests interpolate other players and own their own movement
      if (this.netT <= 0) { this.netT = 0.05; this.cb.onNet?.({ t: 'snap', s: this.makeSnapshot() }); }
    }
    this.visualUpdate(dt);
  }

  // ------------------------------------------------------------ shared visuals (host, offline, client)
  visualUpdate(dt: number) {
    TOON_TIME.value = this.elapsed;
    const p = this.player;
    for (const c of this.chars) this.animate(c, dt);
    if (this.police) this.updatePoliceVisuals();
    this.fx.update(dt);

    for (const a of this.world.animated) {
      if (a.kind === 'water') {
        a.obj.children.forEach((d) => {
          const ang = (d.userData.a as number) + this.elapsed * 0.5;
          const ph = (this.elapsed * 1.5 + (d.userData.a as number)) % 1;
          d.position.set(Math.cos(ang) * ph * 1.4, Math.sin(ph * Math.PI) * 0.7 - ph * 0.9, Math.sin(ang) * ph * 1.4);
        });
      } else if (a.kind === 'smoke') {
        a.obj.children.forEach((s) => {
          const ph = (this.elapsed * 0.4 + (s.userData.o as number)) % 1;
          s.position.set(Math.sin(ph * 5) * 0.2, ph * 1.8, 0);
          s.scale.setScalar(0.6 + ph * 1.4);
          ((s as THREE.Mesh).material as THREE.MeshLambertMaterial).opacity = 0.7 * (1 - ph);
        });
      } else if (a.kind === 'sea') {
        a.obj.position.y = Math.sin(this.elapsed * 1.2) * 0.06;
        // scrolling Wind-Waker style foam pattern
        const map = ((a.obj as THREE.Mesh).material as THREE.MeshToonMaterial).map;
        if (map) map.offset.set(this.elapsed * 0.012, Math.sin(this.elapsed * 0.3) * 0.02);
      }
      else if (a.kind === 'cloud') {
        const o = a.obj;
        o.position.x += dt * (o.userData.speed as number);
        if (o.position.x > 60) o.position.x = -60;
      } else a.obj.position.x = 16.9 + Math.sin(this.elapsed * 1.2) * 0.5;
    }

    if (this.snowPts) {
      const arr = (this.snowPts.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= dt * (1.2 + (i % 7) * 0.12);
        arr[i] += Math.sin(this.elapsed + i) * dt * 0.3;
        if (arr[i + 1] < 0) arr[i + 1] = 18;
      }
      this.snowPts.geometry.attributes.position.needsUpdate = true;
      this.snowPts.position.set(this.camLook.x, 0, this.camLook.z);
    }

    // 마우스 조작 모드: 커서 조준점 + 클릭 이동 목표 표시
    const markOn = !this.demo && this.controlMode === 'mouse' && this.mouseAimValid && this.phase === 'playing' && p.status === 'alive';
    this.mouseMarker.visible = markOn;
    if (markOn) {
      this.mouseMarker.position.set(this.mouseAim.x, 0.06, this.mouseAim.z);
      const s = 1 + Math.sin(this.elapsed * 5) * 0.06;
      this.mouseMarker.scale.set(s, s, s);
      (this.mouseMarker.material as THREE.MeshBasicMaterial).opacity = this.mode === 'ojaemi' ? 0.8 : 0.45;
    }
    if (this.controlMode === 'mouse' && this.mouseMoveTargetValid && this.phase === 'playing') {
      this.mouseMoveMarker.visible = true;
      this.mouseMoveMarker.position.set(this.mouseMoveTarget.x, 0.055, this.mouseMoveTarget.z);
      const s = 1 + Math.sin(this.elapsed * 7) * 0.1;
      this.mouseMoveMarker.scale.set(s, s, s);
    } else this.mouseMoveMarker.visible = false;

    // aim helpers (오재미, player)
    const aimOn = this.mode === 'ojaemi' && !this.demo && this.phase === 'playing' && p.stun <= 0;
    this.aimArrow.visible = aimOn;
    if (aimOn) {
      this.aimArrow.position.set(p.pos.x, 0.06, p.pos.z);
      this.aimArrow.rotation.y = p.facing;
      (this.aimArrow.material as THREE.MeshBasicMaterial).opacity = p.bag ? 0.85 : 0.3;
      const fwd = tmpV.set(Math.sin(p.facing), 0, Math.cos(p.facing));
      const at = p.bag ? this.findAssistTarget(p, fwd) : null;
      this.reticle.visible = !!at;
      if (at) {
        this.reticle.position.set(at.pos.x, 0.07 + at.lift, at.pos.z);
        this.reticle.rotation.z = this.elapsed * 2;
        const sc = 1 + Math.sin(this.elapsed * 8) * 0.08;
        this.reticle.scale.set(sc, sc, sc);
      }
    } else this.reticle.visible = false;

    this.updateCamera(dt);

    this.hudTimer -= dt;
    if (this.hudTimer <= 0 && this.cb.onHud) { this.hudTimer = 0.08; this.emitHud(); }
  }

  // ------------------------------------------------------------ networking (host snapshot → client, ~15Hz)
  makeSnapshot() {
    return {
      sq: ++this.netSeq, ep: this.netEpoch,
      ph: this.phase, pt: q2(this.phaseT), r: this.round, tm: q2(this.time), ot: this.overtime ? 1 : 0,
      sc: [this.scores.red, this.scores.blue], rw: this.roundWinner, rr: this.roundReason,
      ch: this.chars.map((c) => [
        q2(c.pos.x), q2(c.pos.z), q2(c.vel.x), q2(c.vel.z), q2(c.facing), q2(c.lift),
        STATUS_CODES.indexOf(c.status), q2(c.stun), q2(c.stunMax), Math.max(0, STUN_CODES.indexOf(c.stunType)),
        (c.bag ? 1 : 0) | (c.motoT > 0 ? 2 : 0) | (c.jellyT > 0 ? 4 : 0) | (c.dashT > 0 ? 8 : 0) | (c.invuln > 0 ? 16 : 0) | (c.role === 'tagger' ? 32 : 0) | (c.team === 'blue' ? 64 : 0),
        q2(c.throwT), c.item ? ITEMS.indexOf(c.item) : -1, q2(c.dashCd), q2(c.freezeCd), c.tagAnim > 0 ? 1 : 0,
      ]),
      // stats change rarely → send them every 5th snapshot (smaller packets on mobile data)
      ss: this.netSeq % 5 === 0 || this.phase !== 'playing' ? this.chars.map((c) => STAT_KEYS.map((k) => (k === 'survive' ? Math.round(c.st[k]) : c.st[k]))) : null,
      pj: this.projectiles.filter((p) => p.alive).map((p) => [q2(p.pos.x), q2(p.pos.y), q2(p.pos.z)]),
      pk: this.pickups.map((p) => [q2(p.x), q2(p.z)]),
      it: this.items.map((i) => [q2(i.x), q2(i.z), i.active ? 1 : 0]),
      bn: this.bananas.map((b) => [q2(b.x), q2(b.z)]),
      hm: this.homings.map((h) => [h.kind === 'missile' ? 0 : 1, q2(h.pos.x), q2(h.pos.y), q2(h.pos.z)]),
    };
  }

  /** client: handle a message from the host */
  applyNet(msg: NetMsg) {
    if (msg.t === 'snap') {
      // keep only the newest snapshot; applied once per rendered frame (no backlog on slow phones)
      const s = msg.s as ReturnType<Game['makeSnapshot']>;
      if (s.sq <= this.lastSeq) return;
      this.lastSeq = s.sq;
      this.pendingSnap = s;
    } else if (msg.t === 'toast') this.toast(msg.text, msg.color);
  }

  netRoundShown = -1;
  applySnapshot(s: ReturnType<Game['makeSnapshot']>) {
    const prev = this.phase;
    const newRound = s.r !== this.round || (s.ph === 'countdown' && prev !== 'countdown');
    this.phase = s.ph; this.phaseT = s.pt; this.round = s.r; this.time = s.tm; this.overtime = !!s.ot;
    this.scores.red = s.sc[0]; this.scores.blue = s.sc[1];
    const p = this.player;
    const before = { hits: p.st.hits, tags: p.st.tags, thaws: p.st.thaws };
    s.ch.forEach((a, i) => {
      const c = this.chars[i];
      if (!c) return;
      const flags = a[10];
      const role: Role = flags & 32 ? 'tagger' : 'runner';
      const team: Team = flags & 64 ? 'blue' : 'red';
      if (role !== c.role || team !== c.team || newRound) {
        c.role = role; c.team = team; c.m.setTeam(team);
        this.setLabel(c, this.mode === 'icetag' && role === 'tagger' ? '술래' : null, '#ff6b6b', 1.0);
      }
      const local = c === p;
      c.netPos.set(a[0], 0, a[1]);
      if (newRound || s.ep !== this.netEp) {
        c.pos.copy(c.netPos);
        if (local) { c.facing = a[4]; c.dashT = 0; }
      } else if (!local && c.pos.distanceTo(c.netPos) > 4) c.pos.copy(c.netPos);
      // the local player's own velocity comes from local input (prediction), never from the lagged host copy
      if (!local) c.vel.set(a[2], 0, a[3]);
      c.netFacing = a[4];
      c.lift = a[5];
      const status = STATUS_CODES[a[6]] ?? 'alive';
      if (status !== c.status) this.netStatusFx(c, c.status, status, newRound || s.ph === 'final');
      c.status = status;
      const stunType = a[7] > 0 ? STUN_CODES[a[9]] ?? null : null;
      if (a[7] > 0 && (c.stun <= 0 || stunType !== c.stunType)) { c.stunEl = 0; this.netStunFx(c, stunType); }
      c.stun = a[7]; c.stunMax = a[8] || 1; c.stunType = stunType;
      c.m.ufoBeam.visible = stunType === 'ufo' && status === 'alive';
      const bag = !!(flags & 1);
      if (bag && !c.bag) c.pickT = 0.35;
      c.bag = bag; c.motoT = flags & 2 ? 1 : 0; c.jellyT = flags & 4 ? 1 : 0; c.invuln = flags & 16 ? 1 : 0;
      if (!local) c.dashT = flags & 8 ? 0.1 : 0;
      c.throwT = a[11]; c.throwReleased = a[11] >= THROW_RELEASE;
      c.item = a[12] >= 0 ? ITEMS[a[12]] : null;
      // local dash cooldown is predicted; never let a lagged snapshot shorten it
      c.dashCd = local ? Math.max(a[13], c.dashCd) : a[13];
      c.freezeCd = a[14];
      if (a[15]) c.tagAnim = 0.3;
      const st = s.ss?.[i];
      if (st) STAT_KEYS.forEach((k, j) => { c.st[k] = st[j]; });
    });
    this.netEp = s.ep;
    if (p.st.hits > before.hits) this.toast('🎯 명중! +1', '#ffe14a');
    if (p.st.tags > before.tags) this.toast('🎯 잡았다!', '#ffe14a');
    if (p.st.thaws > before.thaws) this.toast('✋ 땡! 구조 성공!', '#ffe14a');

    if (s.ph === 'countdown' && s.r !== this.netRoundShown) {
      this.netRoundShown = s.r;
      this.fx.clearTexts();
      this.lastCountdown = -1;
      this.hero = null;
      if (this.mode === 'icetag') this.toast(p.role === 'tagger' ? '👹 이번 라운드 당신이 술래! 도망팀을 잡아라!' : `🏃 술래는 ${this.tagger.name}! 도망치세요!`, p.role === 'tagger' ? '#ff8a8a' : '#9fdcff');
    }
    if (prev === 'countdown' && s.ph === 'playing') { this.startFlash = 0.9; this.sfx.start(); }
    if (s.ph === 'roundEnd' && prev === 'playing') {
      const w = s.rw ?? 'runner';
      this.roundWinner = w; this.roundReason = s.rr;
      for (const c of this.chars) c.roundWon = this.mode === 'icetag' ? (c.role === 'tagger') === (w === 'tagger') : c.team === w;
      const survivors = this.runners.filter((r) => r.status !== 'out').length;
      this.roundResults.push({ winner: w, reason: s.rr, playerWon: p.roundWon, goalMet: false, survivors });
      this.hero = this.mode === 'ojaemi' ? p : w === 'tagger' ? this.tagger : (p.role === 'runner' && p.status !== 'out' ? p : this.runners.find((r) => r.status !== 'out') ?? p);
      this.sfx.whistle();
      if (p.roundWon) this.sfx.win(); else this.sfx.lose();
    }
    if (s.ph === 'final' && prev !== 'final') {
      const draw = this.scores.red === this.scores.blue;
      for (const c of this.chars) {
        this.setLabel(c, null);
        c.finalWon = this.mode === 'icetag' ? c.st.roundsWon >= 2 : draw || this.scores[c.team] > this.scores[c.team === 'red' ? 'blue' : 'red'];
      }
      this.hero = p;
      this.finalSummary = this.computeFinal();
      this.cb.onFinal?.(this.finalSummary);
      if (this.finalSummary.playerWon) this.sfx.win(); else this.sfx.lose();
    }
    this.syncNetObjects(s);
  }

  netStatusFx(c: Char, from: PStatus, to: PStatus, silent: boolean) {
    const at = (y: number) => tmpV.set(c.pos.x, y, c.pos.z);
    if (from === 'out') { c.m.root.visible = true; c.m.root.scale.setScalar(1.15); c.outT = 0; }
    if (from === 'frozen') this.setLabel(c, null);
    if (silent) { if (to === 'out') { c.outT = 2; c.m.root.visible = false; } return; }
    if (to === 'frozen') {
      c.iceT = 0;
      this.fx.emit('blue', at(1.2), 16, 3.5, 0.6, 3, 1.1);
      this.fx.ring(at(0.08), 0x9fdcff, 4, 0.4);
      this.fx.floatText('얼음!', '#bfe9ff', at(2.8), 1.5);
      this.setLabel(c, '얼음', '#bfe9ff', 0.85);
      if (this.near(c)) this.sfx.freeze();
    } else if (from === 'frozen' && to === 'alive') {
      c.thawT = 0.5;
      this.fx.emit('ice', at(1.2), 22, 4.5, 0.7, 8, 1.2);
      this.fx.emit('star', at(1.8), 5, 3, 0.7, 4, 1.1);
      this.fx.floatText('땡!', '#ffe14a', at(2.9), 1.7);
      if (this.near(c)) this.sfx.thaw();
      if (c.isPlayer) this.toast('✋ 땡! 다시 도망쳐요!', '#ffe14a');
    } else if (to === 'out') {
      c.outT = 0;
      this.fx.emit('star', at(1.6), 10, 4.5, 0.9, 4, 1.3);
      this.fx.ring(at(0.1), 0xff8a8a, 5, 0.45);
      this.fx.floatText('탈락!', '#ff8a8a', at(2.8), 1.6);
      this.setLabel(c, null);
      if (this.near(c)) { this.sfx.tag(); this.sfx.out(); }
      if (c.isPlayer) { this.toast('💥 술래에게 잡혔다! 탈락...', '#ff8a8a'); this.shake = 0.5; this.spectateIdx = 0; }
      else this.toast(`${c.name} 탈락!`, '#ffb3b3');
    }
  }

  netStunFx(c: Char, type: StunType) {
    const at = (y: number) => tmpV.set(c.pos.x, y, c.pos.z);
    if (type === 'hit') {
      this.splat(at(1.1), true);
      this.fx.emit('star', at(1.6), 6, 3.5, 0.7, 4, 1.2);
      if (this.near(c)) this.sfx.hit();
      if (c.isPlayer) { this.toast('💥 오재미에 맞았다!', '#ff8a8a'); this.shake = 0.4; }
    } else if (type === 'slip') { this.fx.floatText('미끌!', '#ffd83b', at(2.4), 1.3); if (this.near(c)) this.sfx.slip(); }
    else if (type === 'missile') { this.fx.emit('fire', at(1), 14, 5, 0.5, 4, 1.4); this.fx.floatText('펑!', '#ff9a3b', at(2.6), 1.4); if (this.near(c)) this.sfx.boom(); if (c.isPlayer) this.shake = 0.5; }
    else if (type === 'ufo') { this.fx.emit('spark', at(3), 16, 4, 0.7, 2); if (this.near(c)) this.sfx.ufo(); }
    else if (type === 'bump') { this.fx.emit('star', at(1.5), 4, 3, 0.5, 4); if (this.near(c)) this.sfx.bump(); }
  }

  syncNetObjects(s: ReturnType<Game['makeSnapshot']>) {
    // 오재미 in flight
    s.pj.forEach((a, i) => {
      let m = this.netProj[i];
      if (!m) { m = buildBag(); this.scene.add(m); this.netProj.push(m); }
      m.visible = true;
      m.position.set(a[0], a[1], a[2]);
    });
    for (let i = s.pj.length; i < this.netProj.length; i++) this.netProj[i].visible = false;
    // pickups
    const keep = new Set(s.pk.map(([x, z]) => `${x},${z}`));
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      if (!keep.has(`${pk.x},${pk.z}`)) { this.scene.remove(pk.mesh); this.pickups.splice(i, 1); }
    }
    const have = new Set(this.pickups.map((pk) => `${pk.x},${pk.z}`));
    for (const [x, z] of s.pk) if (!have.has(`${x},${z}`)) this.makePickup(x, z);
    // item boxes
    s.it.forEach(([x, z, a], i) => {
      const it = this.items[i];
      if (!it) return;
      if (a && !it.active) this.fx.emit('spark', tmpV.set(x, 0.8, z), 10, 3, 0.5, 2);
      it.x = x; it.z = z; it.active = !!a; it.mesh.visible = !!a;
      it.mesh.position.x = x; it.mesh.position.z = z;
    });
    // bananas
    s.bn.forEach(([x, z], i) => {
      let m = this.netBananas[i];
      if (!m) { m = new THREE.Mesh(this.bananaGeo, lam(0xffd83b, { emissive: 0x332200 })); m.rotation.x = -Math.PI / 2; this.scene.add(m); this.netBananas.push(m); }
      m.visible = true;
      m.position.set(x, 0.09, z);
    });
    for (let i = s.bn.length; i < this.netBananas.length; i++) this.netBananas[i].visible = false;
    // missiles / slime
    s.hm.forEach(([k, x, y, z], i) => {
      let m = this.netHoming[i];
      if (m && m.userData.kind !== k) { this.scene.remove(m); m = undefined as unknown as THREE.Object3D; }
      if (!m) {
        m = k === 0
          ? new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 4, 10), lam(0xe8413c))
          : new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), this.slimeMat);
        m.userData.kind = k;
        this.scene.add(m);
        this.netHoming[i] = m;
      }
      const prevPos = m.position.clone();
      m.visible = true;
      m.position.set(x, y, z);
      if (k === 0) { m.lookAt(tmpV.copy(m.position).add(m.position).sub(prevPos)); m.rotateX(Math.PI / 2); this.fx.emit('fire', m.position, 2, 0.6, 0.35, -1, 0.9); }
    });
    for (let i = s.hm.length; i < this.netHoming.length; i++) if (this.netHoming[i]) this.netHoming[i].visible = false;
  }

  /** client frame: apply newest snapshot, predict own movement, report position, interpolate others */
  clientUpdate(dt: number) {
    if (this.pendingSnap) {
      const s = this.pendingSnap;
      this.pendingSnap = null;
      this.applySnapshot(s);
    }
    if (this.phase === 'countdown') {
      const cd = Math.ceil(this.countdownLen - this.phaseT);
      if (cd !== this.lastCountdown && cd > 0) { this.lastCountdown = cd; this.sfx.count(); }
    }
    // host clock keeps running between snapshots so timers/HUD stay smooth
    if (this.phase === 'playing') this.time = Math.max(0, this.time - dt);
    this.updateMouseAim();
    const p = this.player;
    const canMove = this.phase === 'playing' && p.status === 'alive' && p.stun <= 0;
    const mv = canMove ? this.playerMoveVec() : ZERO.clone();
    p.dashCd = Math.max(0, p.dashCd - dt);

    // ---- local player: fully client-side movement (host accepts our position)
    if (p.status !== 'out') {
      if (canMove) {
        const prevX = p.pos.x, prevZ = p.pos.z;
        if (p.dashT > 0) {
          p.dashT -= dt;
          p.pos.addScaledVector(p.dashDir, DASH_SPEED * dt);
          if (Math.random() < 0.6) this.fx.emit(this.theme.snowy ? 'snow' : 'spark', tmpV2.set(p.pos.x, 0.15, p.pos.z), 1, 1, 0.3, 2, 0.7);
        } else {
          let sp = this.mode === 'icetag' && p.role === 'tagger' ? TAGGER_SPEED : WALK_SPEED;
          if (p.motoT > 0) sp *= 1.8;
          if (p.jellyT > 0) sp *= 0.45;
          if (p.throwT >= 0) sp *= 0.7;
          if (p.thawT > 0) sp *= 0.5;
          p.pos.addScaledVector(mv, sp * dt);
        }
        resolveCircle(this.world.colliders, p.pos, CHAR_R);
        const inv = dt > 0 ? 1 / dt : 0;
        tmpV.set((p.pos.x - prevX) * inv, 0, (p.pos.z - prevZ) * inv);
        p.vel.lerp(tmpV, Math.min(1, dt * 20));
        if (p.dashT > 0) p.facing = Math.atan2(p.dashDir.x, p.dashDir.z);
        else if (this.controlMode === 'mouse' && this.mouseAimValid && p.throwT < 0) p.facing += angleDiff(p.facing, Math.atan2(this.mouseAim.x - p.pos.x, this.mouseAim.z - p.pos.z)) * Math.min(1, dt * 18);
        else if (mv.lengthSq() > 0.01 && p.throwT < 0) p.facing += angleDiff(p.facing, Math.atan2(mv.x, mv.z)) * Math.min(1, dt * 14);
        // only snap if we're wildly out of sync (e.g. host rejected us)
        if (p.pos.distanceTo(p.netPos) > 6) p.pos.copy(p.netPos);
      } else {
        // stunned / frozen / between phases: the host is authoritative
        const prevX = p.pos.x, prevZ = p.pos.z;
        p.pos.lerp(p.netPos, Math.min(1, dt * 12));
        const inv = dt > 0 ? 1 / dt : 0;
        p.vel.set((p.pos.x - prevX) * inv, 0, (p.pos.z - prevZ) * inv);
        p.facing += angleDiff(p.facing, p.netFacing) * Math.min(1, dt * 10);
        p.dashT = 0;
      }
    }

    // ---- report input + position (20Hz while moving, 4Hz idle)
    const moving = mv.lengthSq() > 0.001 || p.dashT > 0;
    const key = `${q2(mv.x)},${q2(mv.z)},${q2(p.pos.x)},${q2(p.pos.z)}`;
    this.inT -= dt;
    if (this.inT <= 0 && (key !== this.lastIn || this.inT < -0.25)) {
      this.cb.onNet?.({ t: 'in', x: q2(mv.x), z: q2(mv.z), px: q2(p.pos.x), pz: q2(p.pos.z), f: q2(p.facing), ep: this.netEp });
      this.lastIn = key;
      this.inT = moving ? 0.05 : 0.2;
    }

    for (const c of this.chars) {
      c.blinkT -= dt;
      if (c.blinkT < -0.12) c.blinkT = rand(1.5, 3.5);
      c.stunEl += dt;
      c.pickT = Math.max(0, c.pickT - dt);
      c.thawT = Math.max(0, c.thawT - dt);
      c.tagAnim = Math.max(0, c.tagAnim - dt);
      if (c.status === 'frozen') c.iceT += dt;
      if (c.status === 'out') { c.outT += dt; if (c.outT > 1.3) c.m.root.visible = false; continue; }
      if (c === p) continue; // handled above
      // remote players: extrapolate slightly ahead with their velocity, then ease in
      tmpV.copy(c.netPos).addScaledVector(c.vel, 0.06);
      c.pos.lerp(tmpV, Math.min(1, dt * 12));
      c.facing += angleDiff(c.facing, c.netFacing) * Math.min(1, dt * 14);
    }
    if (this.mode === 'ojaemi') {
      this.updatePickups(dt);
      for (const m of this.netProj) if (m.visible) { m.rotation.x += dt * 9; m.rotation.z += dt * 5; }
    }
    for (const it of this.items) {
      if (!it.active) continue;
      it.mesh.rotation.y += dt * 1.8;
      it.mesh.position.y = 0.8 + Math.sin(this.elapsed * 2.5 + it.x) * 0.15;
    }
    this.visualUpdate(dt);
  }

  buildMarkers(): Marker[] {
    if (this.mode === 'police') return this.buildPoliceMarkers();
    const p = this.player;
    const list: Char[] = [];
    if (this.mode === 'ojaemi') list.push(...this.chars.filter((e) => e.team !== p.team));
    else if (p.role === 'tagger') list.push(...this.runners.filter((r) => r.status !== 'out'));
    else { list.push(this.tagger); list.push(...this.runners.filter((r) => r !== p && r.status === 'frozen')); }
    const out: Marker[] = [];
    for (const e of list) {
      const v = tmpV.set(e.pos.x, e.lift + 1, e.pos.z).project(this.camera);
      const behind = v.z > 1;
      if (!behind && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95) continue;
      let x = behind ? -v.x : v.x, y = behind ? -v.y : v.y;
      const angle = Math.atan2(-y, x);
      // keep markers clear of the top HUD and bottom controls
      const m = Math.max(Math.abs(x) / 0.88, y > 0 ? y / 0.5 : -y / 0.38, 1);
      x /= m; y /= m;
      out.push({ x: (x + 1) / 2, y: (1 - y) / 2, angle, team: e.team, animal: e.animal, frozen: e.status === 'frozen', tagger: this.mode === 'icetag' && e.role === 'tagger' });
    }
    return out;
  }

  emitHud() {
    const p = this.player;
    let countdown = -1;
    if (this.phase === 'countdown') countdown = Math.max(1, Math.ceil(this.countdownLen - this.phaseT));
    else if (this.phase === 'playing' && this.startFlash > 0) countdown = 0;
    const isIce = this.mode === 'icetag';
    const isPolice = this.mode === 'police';
    const runners = isIce || isPolice ? this.runners : [];
    const tg = isIce ? this.tagger : null;
    const dT = tg ? tg.pos.distanceTo(p.pos) : Infinity;
    let stageProgress: string | null = null;
    if (this.stage) {
      switch (this.stage.kind) {
        case 'survive': stageProgress = `생존 라운드 ${this.roundResults.filter((r) => r.goalMet).length}/3`; break;
        case 'rescue': stageProgress = `구조 ${p.st.thaws}명 / 3명`; break;
        case 'noloss': stageProgress = `탈락 ${runners.filter((r) => r.status === 'out').length}명 (0명 유지!)`; break;
        case 'items': stageProgress = `아이템 사용 ${p.st.items}/2`; break;
      }
    }
    this.cb.onHud?.({
      mode: this.mode, teamSize: this.teamSize, phase: this.phase, round: this.round, totalRounds: this.totalRounds, time: this.time, countdown, overtime: this.overtime,
      role: p.role, status: p.status, team: p.team,
      canFreeze: isIce && p.role === 'runner' && this.canAct(p) && p.freezeCd <= 0, freezeCd: p.freezeCd / FREEZE_CD,
      hasBag: p.bag, throwing: p.throwT >= 0, dashCd: p.dashCd / (this.chaseMode && p.role === 'tagger' ? TAGGER_DASH_CD : isPolice && p.role === 'tagger' ? COP_DASH_CD : DASH_CD),
      item: p.item, stunned: p.stun > 0,
      danger: (isIce && p.role === 'runner' && p.status === 'alive' && !!tg && tg.stun <= 0 && dT < 6.5) || (isPolice && this.copNear(p, 6.5)),
      lastAlive: isIce && p.role === 'runner' && p.status === 'alive' && !runners.some((r) => r !== p && r.status === 'alive'),
      spectating: isIce && p.status === 'out' && this.phase === 'playing' ? this.spectateTarget().name : null,
      taggerName: tg ? tg.name : '', aliveCount: runners.filter((r) => r.status === 'alive').length, frozenCount: runners.filter((r) => r.status === 'frozen').length, outCount: runners.filter((r) => r.status === 'out').length,
      red: this.scores.red, blue: this.scores.blue,
      roundResults: this.roundResults.map((r) => ({ ...r })), roundWinner: this.roundWinner, roundReason: this.roundReason,
      players: this.playerStats(), markers: this.phase === 'playing' || this.phase === 'countdown' ? this.buildMarkers() : [],
      stageGoal: this.stage ? this.stage.goal : null, stageProgress, final: this.finalSummary,
      police: isPolice ? this.policeHud() : null,
    });
  }
}
