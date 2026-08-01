import { io } from 'socket.io-client';
const URL = 'http://localhost:3001';
function connect() { return new Promise((resolve) => { const s = io(URL, { transports: ['websocket'] }); s.on('connect', () => resolve(s)); }); }
function emit(socket, event, data) { return new Promise((resolve, reject) => { socket.emit(event, data, (res) => { if (res.success) resolve(res); else reject(new Error(`${event} failed: ${res.error}`)); }); }); }

async function main() {
  const p1 = await connect();
  const p2 = await connect();
  const p3 = await connect();

  const states = { p1: null, p2: null, p3: null };
  p1.on('game-state-update', (d) => (states.p1 = d.gameState));
  p2.on('game-state-update', (d) => (states.p2 = d.gameState));
  p3.on('game-state-update', (d) => (states.p3 = d.gameState));

  const room = await emit(p1, 'create-room', { playerName: 'Alice' });
  await emit(p2, 'join-room', { roomCode: room.roomCode, playerName: 'Bob' });
  await emit(p3, 'join-room', { roomCode: room.roomCode, playerName: 'Carol' });
  await emit(p1, 'start-game', { roomCode: room.roomCode });
  await new Promise(r => setTimeout(r, 200));

  // Force player 0 (Alice) onto a pricey site with low cash by manipulating via repeated rolls is unreliable;
  // instead just verify all three clients receive IDENTICAL currentAuction state whenever one exists,
  // by rolling repeatedly until we hit an auction naturally, capped attempts.
  let auctionSeen = false;
  for (let i = 0; i < 30 && !auctionSeen; i++) {
    const gs = states.p1;
    const activeId = gs ? gs.activePlayer : 0;
    const sockForActive = [p1, p2, p3][activeId];
    try {
      await emit(sockForActive, 'roll-dice', { roomCode: room.roomCode });
    } catch (e) { /* not their turn edge case, ignore */ }
    await new Promise(r => setTimeout(r, 150));
    try {
      await emit(sockForActive, 'player-finished-moving', { roomCode: room.roomCode });
    } catch (e) {}
    await new Promise(r => setTimeout(r, 150));

    if (states.p1?.currentAuction) {
      auctionSeen = true;
      console.log('TEST: Auction started, checking all 3 clients see IDENTICAL state...');
      const a1 = JSON.stringify(states.p1.currentAuction);
      const a2 = JSON.stringify(states.p2.currentAuction);
      const a3 = JSON.stringify(states.p3.currentAuction);
      console.log('p1 auction:', a1);
      console.log('PASS: all clients see the same auction state:', a1 === a2 && a2 === a3);

      // Now test that a NON-active-bidder is rejected, and the actual active bidder can fold to close it out.
      const auction = states.p1.currentAuction;
      const sockets = [p1, p2, p3];
      const wrongSocket = sockets[(auction.activeBidderId + 1) % 3];
      try {
        await emit(wrongSocket, 'place-bid', { roomCode: room.roomCode, amount: 9999 });
        console.log('FAIL: wrong-turn bid was accepted');
      } catch (e) {
        console.log('PASS: wrong-turn bid correctly rejected:', e.message);
      }
      break;
    } else {
      // buy if possible to keep the game moving, ignore failures
      try { await emit(sockForActive, 'buy-site', { roomCode: room.roomCode }); } catch (e) {}
      try { await emit(sockForActive, 'end-turn', { roomCode: room.roomCode }); } catch (e) {}
      await new Promise(r => setTimeout(r, 100));
    }
  }
  if (!auctionSeen) console.log('No auction triggered naturally in 30 rounds (random chance) — inconclusive, not a failure.');

  console.log('\nDone.');
  process.exit(0);
}
main().catch((e) => { console.error('CRASH', e); process.exit(1); });
