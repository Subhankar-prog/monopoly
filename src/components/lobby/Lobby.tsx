import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { connect } from 'react-redux';
import style from '../../assets/css/lobby.module.scss';
import {
  connectToServer,
  createRoom as createRoomSocket,
  joinRoom as joinRoomSocket,
  rejoinRoom as rejoinRoomSocket,
  startGame as startGameSocket,
  getSocket,
} from '../../network/socket';
import { setupGameSync } from '../../network/gameSync';
import { SYNC_GAME_STATE } from '../../redux/actions/actionTypes';
import {
  setRoomCode,
  setMyPlayerId,
  setConnected,
  setIsHost,
  setRoomPlayers,
  setIsMultiplayer,
} from '../../redux/actions/network';
import { colors } from '../../utility/constants';

import customLogo from '../../assets/images/custom-logo.jpg';

type LobbyMode = 'select' | 'create' | 'join' | 'rejoin' | 'waiting' | 'bots';

const PLAYER_COLORS = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#e67e22', '#e91e90'];

const Lobby = ({
  network,
  setRoomCode: dispatchRoomCode,
  setMyPlayerId: dispatchPlayerId,
  setConnected: dispatchConnected,
  setIsHost: dispatchIsHost,
  setRoomPlayers: dispatchRoomPlayers,
  setIsMultiplayer: dispatchIsMultiplayer,
}) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<LobbyMode>('select');
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [botCount, setBotCount] = useState(2);

  // Listen for game start
  useEffect(() => {
    if (network.isConnected && network.roomCode) {
      const socket = getSocket();
      const handleGameStarted = () => {
        dispatchIsMultiplayer(true);
        navigate(`/monopoly/${network.roomCode}`);
      };
      socket.on('game-started', handleGameStarted);
      return () => {
        socket.off('game-started', handleGameStarted);
      };
    }
  }, [network.isConnected, network.roomCode, navigate, dispatchIsMultiplayer]);

  // Listen for room updates
  useEffect(() => {
    if (network.isConnected) {
      const socket = getSocket();
      const handleRoomUpdated = (data: { players: any[]; hostSocketId: string }) => {
        dispatchRoomPlayers(data.players);
      };
      socket.on('room-updated', handleRoomUpdated);
      return () => {
        socket.off('room-updated', handleRoomUpdated);
      };
    }
  }, [network.isConnected, dispatchRoomPlayers]);

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      await connectToServer();
      dispatchConnected(true);
      setupGameSync();
      const name = playerName || 'Player 1';
      const result = await createRoomSocket(name);
      sessionStorage.setItem('playerName', name);
      sessionStorage.setItem('roomCode', result.roomCode);
      dispatchRoomCode(result.roomCode);
      dispatchPlayerId(result.playerId);
      dispatchIsHost(true);
      dispatchRoomPlayers(result.players);
      setMode('waiting');
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    setError('');
    if (!joinCode.trim()) {
      setError('Please enter a room code');
      return;
    }
    setLoading(true);
    try {
      await connectToServer();
      dispatchConnected(true);
      setupGameSync();
      const name = playerName || `Player ${Date.now() % 1000}`;
      const result = await joinRoomSocket(
        joinCode.toUpperCase().trim(),
        name
      );
      sessionStorage.setItem('playerName', name);
      sessionStorage.setItem('roomCode', result.roomCode);
      dispatchRoomCode(result.roomCode);
      dispatchPlayerId(result.playerId);
      dispatchIsHost(false);
      dispatchRoomPlayers(result.players);
      setMode('waiting');
    } catch (err: any) {
      setError(err.message || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    setError('');
    setLoading(true);
    try {
      await startGameSocket(network.roomCode!);
      // Game started event will navigate us
    } catch (err: any) {
      setError(err.message || 'Failed to start game');
    } finally {
      setLoading(false);
    }
  };

  const handleRejoin = async () => {
    setError('');
    if (!joinCode.trim()) {
      setError('Please enter a room code');
      return;
    }
    if (!playerName.trim()) {
      setError('Please enter your name (must match your original name)');
      return;
    }
    setLoading(true);
    try {
      await connectToServer();
      dispatchConnected(true);
      setupGameSync();
      const result = await rejoinRoomSocket(
        joinCode.toUpperCase().trim(),
        playerName
      );
      sessionStorage.setItem('playerName', playerName);
      sessionStorage.setItem('roomCode', result.roomCode);
      dispatchRoomCode(result.roomCode);
      dispatchPlayerId(result.playerId);
      dispatchIsHost(false);
      dispatchRoomPlayers(result.players);
      dispatchIsMultiplayer(true);

      // Hydrate Redux with server game state
      if (result.gameState) {
        const store = (await import('../../redux/store')).default;
        store().dispatch({
          type: SYNC_GAME_STATE,
          payload: { gameState: result.gameState, actionRequired: null },
        });
      }

      navigate(`/monopoly/${result.roomCode}`);
    } catch (err: any) {
      setError(err.message || 'Failed to rejoin room');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'waiting') {
    return (
      <div className={style.lobby}>
        <div className={style.lobbyCard}>
          <h1 className={style.title}>🎲 Game Lobby</h1>
          <div className={style.waitingRoom}>
            <div className={style.roomCodeDisplay}>
              <p className={style.roomCodeLabel}>Room Code</p>
              <p className={style.roomCode}>{network.roomCode}</p>
              <p className={style.copyHint}>Share this code with friends</p>
            </div>

            <div className={style.seatsGrid}>
              {Array.from({ length: 6 }).map((_, i) => {
                const p: any = network.roomPlayers[i];
                if (p) {
                  return (
                    <div className={style.seat} key={p.socketId}>
                      <div
                        className={style.seatAvatar}
                        style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
                      >
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <span className={style.seatName}>{p.name}</span>
                      <div className={style.seatBadges}>
                        {i === 0 && <span className={style.hostBadge}>Host</span>}
                        {p.playerId === network.myPlayerId && (
                          <span className={style.youBadge}>You</span>
                        )}
                      </div>
                    </div>
                  );
                }
                return (
                  <div className={style.seatEmpty} key={`empty-${i}`}>
                    <div className={style.seatAvatarEmpty}>+</div>
                    <span className={style.seatNameEmpty}>Open seat</span>
                  </div>
                );
              })}
            </div>
            <p className={style.playersTitle}>
              {network.roomPlayers.length} of 6 seated
            </p>

            {network.isHost ? (
              <button
                className={style.actionBtn}
                onClick={handleStart}
                disabled={loading || network.roomPlayers.length < 2}
              >
                {network.roomPlayers.length < 2
                  ? 'Waiting for players...'
                  : `Start Game (${network.roomPlayers.length} players)`}
              </button>
            ) : (
              <p className={style.waitingText}>Waiting for host to start the game...</p>
            )}
            {error && <p className={style.error}>{error}</p>}
            <button className={style.backBtn} onClick={() => setMode('select')}>
              ← Leave Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={style.lobby}>
      <div className={style.lobbyCard}>
        <div className={style.lobbyLogoWrap}>
          <img src={customLogo} alt="Monopoly Logo" className={style.lobbyLogoImg} />
        </div>
        <div className={style.odishaCrown}>🪔 ODISHA HERITAGE 🪔</div>
        <h1 className={style.title}>Heavy Business</h1>
        <p className={style.subtitle}>Real-Time Property Trading</p>

        <div className={style.modeSelector}>
          <button
            className={`${style.modeBtn} ${mode === 'create' ? style.modeBtnActive : ''}`}
            onClick={() => { setMode('create'); setError(''); }}
          >
            Create Game
          </button>
          <button
            className={`${style.modeBtn} ${mode === 'join' ? style.modeBtnActive : ''}`}
            onClick={() => { setMode('join'); setError(''); }}
          >
            Join Game
          </button>
          <button
            className={`${style.modeBtn} ${mode === 'rejoin' ? style.modeBtnActive : ''}`}
            onClick={() => { setMode('rejoin'); setError(''); }}
          >
            Rejoin
          </button>
          <button
            className={`${style.modeBtn} ${mode === 'bots' ? style.modeBtnActive : ''}`}
            onClick={() => { setMode('bots'); setError(''); }}
          >
            🤖 Play vs Bots
          </button>
        </div>

        {mode === 'bots' && (
          <>
            <div className={style.inputGroup}>
              <label className={style.label}>Number of Bots</label>
              <div className={style.modeSelector}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    className={`${style.modeBtn} ${botCount === n ? style.modeBtnActive : ''}`}
                    onClick={() => setBotCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button
              className={style.actionBtn}
              onClick={() => navigate(`/monopoly?bots=${botCount}`)}
            >
              Start Offline Game
            </button>
            <p className={style.copyHint} style={{ marginTop: 12, textAlign: 'center' }}>
              You'll play against {botCount} computer-controlled opponent{botCount > 1 ? 's' : ''} on this
              device — no internet connection needed.
            </p>
          </>
        )}

        {(mode === 'create' || mode === 'join') && (
          <>
            <div className={style.inputGroup}>
              <label className={style.label}>Your Name</label>
              <input
                className={style.input}
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
              />
            </div>

            {mode === 'join' && (
              <div className={style.inputGroup}>
                <label className={style.label}>Room Code</label>
                <input
                  className={`${style.input} ${style.roomCodeInput}`}
                  type="text"
                  placeholder="ABCDEF"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
              </div>
            )}

            <button
              className={style.actionBtn}
              onClick={mode === 'create' ? handleCreate : handleJoin}
              disabled={loading}
            >
              {loading
                ? 'Connecting...'
                : mode === 'create'
                  ? 'Create Room'
                  : 'Join Room'}
            </button>

            {error && <p className={style.error}>{error}</p>}
          </>
        )}

        {mode === 'rejoin' && (
          <>
            <div className={style.inputGroup}>
              <label className={style.label}>Your Name (must match original)</label>
              <input
                className={style.input}
                type="text"
                placeholder="Enter the name you used"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
              />
            </div>
            <div className={style.inputGroup}>
              <label className={style.label}>Room Code</label>
              <input
                className={`${style.input} ${style.roomCodeInput}`}
                type="text"
                placeholder="ABCDEF"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
              />
            </div>
            <button
              className={style.actionBtn}
              onClick={handleRejoin}
              disabled={loading}
            >
              {loading ? 'Reconnecting...' : 'Rejoin Game'}
            </button>
            {error && <p className={style.error}>{error}</p>}
          </>
        )}

        {mode === 'select' && (
          <p className={style.subtitle}>
            Choose "Create Game" to host or "Join Game" to enter a friend's room
          </p>
        )}
      </div>
    </div>
  );
};

const mapStateToProps = (store: any) => ({
  network: store.network,
});

const mapDispatchToProps = (dispatch: any) => ({
  setRoomCode: (code: string) => dispatch(setRoomCode(code)),
  setMyPlayerId: (id: number) => dispatch(setMyPlayerId(id)),
  setConnected: (v: boolean) => dispatch(setConnected(v)),
  setIsHost: (v: boolean) => dispatch(setIsHost(v)),
  setRoomPlayers: (p: any[]) => dispatch(setRoomPlayers(p)),
  setIsMultiplayer: (v: boolean) => dispatch(setIsMultiplayer(v)),
});

export default connect(mapStateToProps, mapDispatchToProps)(Lobby);
