import { io } from 'socket.io-client';
const URL = 'http://localhost:3001';
function connect() { return new Promise((resolve) => { const s = io(URL, { transports: ['websocket'] }); s.on('connect', () => resolve(s)); }); }
function emit(socket, event, data) { return new Promise((resolve, reject) => { socket.emit(event, data, (res) => { if (res.success) resolve(res); else reject(new Error(`${event} failed: ${res.error}`)); }); }); }
async function main() {
  const p1 = await connect(); const p2 = await connect();
  const room = await emit(p1, 'create-room', { playerName: 'Alice' });
  await emit(p2, 'join-room', { roomCode: room.roomCode, playerName: 'Bob' });
  await emit(p1, 'start-game', { roomCode: room.roomCode });
  let lastState = null;
  p1.on('game-state-update', (d) => (lastState = d.gameState));
  const r1 = await emit(p1, 'roll-dice', { roomCode: room.roomCode });
  console.log('Roll 1 OK:', r1.dice);
  // Regression check: rolling again immediately (before resolving landing tile) must be rejected now
  try {
    await emit(p1, 'roll-dice', { roomCode: room.roomCode });
    console.log('REGRESSION FAIL: double-roll before resolving was allowed');
    process.exit(1);
  } catch (e) {
    console.log('PASS: re-roll correctly blocked until tile is resolved:', e.message);
  }
  await emit(p1, 'player-finished-moving', { roomCode: room.roomCode });
  console.log('Smoke test 2: all good, actionRequired handled, no crash.');
  process.exit(0);
}
main().catch((e) => { console.error('CRASH', e); process.exit(1); });
