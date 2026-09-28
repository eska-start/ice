import { useEffect, useMemo, useRef, useState } from 'react';
import { MainMenu } from './components/MainMenu';
import { ModeSelect } from './components/ModeSelect';
import { Setup } from './components/Setup';
import { Stages } from './components/Stages';
import { GameScreen } from './components/GameScreen';
import { Lobby, type LobbyInit } from './components/Lobby';
import { Sfx } from './game/sfx';
import { loadSave, persistSave, type SaveData } from './game/save';
import { makeStageCfg } from './game/config';
import type { FinalSummary, GameConfig, Mode } from './game/types';
import type { NetRoom } from './net/net';

type Screen = 'menu' | 'mode' | 'setup' | 'stages' | 'lobby' | 'game';

function readInviteCode() {
  try {
    const c = new URLSearchParams(location.search).get('room');
    return c ? c.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) : '';
  } catch {
    return '';
  }
}

export default function App() {
  const sfx = useMemo(() => new Sfx(), []);
  const [save, setSaveState] = useState<SaveData>(() => loadSave());
  const saveRef = useRef(save);
  saveRef.current = save;
  const setSave = (s: SaveData) => { setSaveState(s); persistSave(s); };
  useEffect(() => { sfx.setMuted(!save.sound); }, [save.sound, sfx]);

  const invite = useMemo(readInviteCode, []);
  const [screen, setScreen] = useState<Screen>(invite ? 'lobby' : 'menu');
  const [mode, setMode] = useState<Mode>('icetag');
  const [cfg, setCfg] = useState<GameConfig | null>(null);
  const [runId, setRunId] = useState(0);
  const [room, setRoomState] = useState<NetRoom | null>(null);
  const [lobbyInit, setLobbyInit] = useState<LobbyInit | null>(null);
  const roomRef = useRef<NetRoom | null>(null);

  const setRoom = (r: NetRoom | null) => {
    if (roomRef.current && roomRef.current !== r) roomRef.current.leave();
    roomRef.current = r;
    setRoomState(r);
    if (invite && !r) history.replaceState(null, '', location.pathname);
  };

  const startGame = (c: GameConfig) => { sfx.init(); setCfg(c); setRunId((r) => r + 1); setScreen('game'); };

  // guest: follow the host into the match / back to the lobby
  useEffect(() => {
    if (!room) return;
    room.onStart = (c) => startGame({ ...c, quality: saveRef.current.quality });
    room.onLobbyReturn = () => setScreen((s) => (s === 'game' ? 'lobby' : s));
    return () => { room.onStart = null; room.onLobbyReturn = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  useEffect(() => () => roomRef.current?.leave(), []);

  const leaveToMenu = () => { setRoom(null); setCfg(null); setScreen('menu'); };

  const onFinal = (f: FinalSummary) => {
    const s0 = saveRef.current;
    const me = f.players.find((p) => p.isPlayer);
    const s: SaveData = {
      ...s0,
      coins: s0.coins + f.coins,
      records: {
        games: s0.records.games + 1,
        wins: s0.records.wins + (f.playerWon ? 1 : 0),
        thaws: s0.records.thaws + (me?.thaws ?? 0),
        freezes: s0.records.freezes + (me?.freezes ?? 0),
        tags: s0.records.tags + (me?.tags ?? 0),
        hits: s0.records.hits + (me?.hits ?? 0),
        outs: s0.records.outs + (me?.outs ?? 0),
      },
    };
    if (f.stage) s.stars = { ...s0.stars, [f.stage]: Math.max(s0.stars[f.stage] ?? 0, f.stars) };
    setSave(s);
  };

  const online = !!cfg?.net && !!room;

  return (
    <div className="fixed inset-0 bg-[#0f2740]">
      {/* full-bleed on every device; each screen handles its own portrait / landscape / desktop layout */}
      <div className="relative w-full h-full overflow-hidden bg-sky-200">
        {screen === 'menu' && <MainMenu save={save} setSave={setSave} onPlay={() => { sfx.init(); sfx.click(); setScreen('mode'); }} onStages={() => { sfx.init(); sfx.click(); setScreen('stages'); }} />}
        {screen === 'mode' && <ModeSelect onSelect={(m) => { sfx.click(); setMode(m); setScreen('setup'); }} onBack={() => setScreen('menu')} />}
        {screen === 'setup' && <Setup mode={mode} save={save} onStart={startGame} onMulti={(o) => { sfx.init(); setLobbyInit(o); setScreen('lobby'); }} onBack={() => setScreen('mode')} />}
        {screen === 'stages' && <Stages save={save} onStart={startGame} onBack={() => setScreen('menu')} />}
        {screen === 'lobby' && (
          <Lobby
            save={save}
            init={lobbyInit}
            joinCode={invite}
            room={room}
            setRoom={(r) => { sfx.init(); setRoom(r); }}
            onBack={() => { setRoom(null); setScreen(lobbyInit ? 'setup' : 'menu'); }}
            onStart={() => { if (room) startGame(room.start(save.quality)); }}
          />
        )}
        {screen === 'game' && cfg && (
          <GameScreen
            key={runId}
            cfg={cfg}
            sfx={sfx}
            room={room}
            onMenu={leaveToMenu}
            onRestart={() => {
              if (online) { if (room!.isHost) room!.returnToLobby(); setScreen('lobby'); }
              else startGame({ ...cfg });
            }}
            onFinal={onFinal}
            onNextStage={cfg.stage ? () => startGame(makeStageCfg(cfg.stage! + 1, save.animal, save.name, save.quality, save.outfit)) : undefined}
          />
        )}
      </div>
    </div>
  );
}
