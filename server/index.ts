import { createServer } from 'http';
import { Server } from 'socket.io';
import {
  createRoom,
  getRoom,
  joinRoom,
  rejoinRoom,
  removePlayer,
  startGame,
  rollDice,
  rollForJail,
  payJailFine,
  useJailCard,
  playerFinishedMoving,
  buySiteAction,
  placeBid,
  foldAuction,
  endTurn,
  mortgageSite,
  redeemSite,
  buildOnSite,
  sellBuild,
  sellSiteToBank,
  declareBankruptcy,
  proposeTrade,
  respondToTrade,
  cancelTrade,
} from './gameState';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Track which room each socket is in
const socketRooms: Map<string, string> = new Map();

io.on('connection', (socket) => {
  console.log(`[Server] Client connected: ${socket.id}`);

  // ── Room Management ────────────────────────────────────────────────────

  socket.on('create-room', (data: { playerName: string }, callback) => {
    const room = createRoom(socket.id, data.playerName || 'Player 1');
    socket.join(room.code);
    socketRooms.set(socket.id, room.code);
    console.log(`[Server] Room ${room.code} created by ${socket.id}`);
    callback({
      success: true,
      roomCode: room.code,
      playerId: 0,
      players: room.players,
    });
  });

  socket.on(
    'join-room',
    (data: { roomCode: string; playerName: string }, callback) => {
      const result = joinRoom(
        data.roomCode,
        socket.id,
        data.playerName || `Player ${Date.now()}`
      );
      if (!result) {
        callback({ success: false, error: 'Room not found, full, or already started' });
        return;
      }
      socket.join(data.roomCode);
      socketRooms.set(socket.id, data.roomCode);
      console.log(
        `[Server] ${socket.id} joined room ${data.roomCode} as player ${result.playerId}`
      );

      // Notify everyone in the room
      io.to(data.roomCode).emit('room-updated', {
        players: result.room.players,
        hostSocketId: result.room.hostSocketId,
      });

      callback({
        success: true,
        roomCode: data.roomCode,
        playerId: result.playerId,
        players: result.room.players,
        hostSocketId: result.room.hostSocketId,
      });
    }
  );

  // ── Rejoin Room (Reconnection) ─────────────────────────────────────────

  socket.on(
    'rejoin-room',
    (data: { roomCode: string; playerName: string }, callback) => {
      const result = rejoinRoom(data.roomCode, socket.id, data.playerName);
      if (!result) {
        callback({ success: false, error: 'Cannot rejoin: room not found or no disconnected slot' });
        return;
      }
      socket.join(data.roomCode);
      socketRooms.set(socket.id, data.roomCode);
      console.log(
        `[Server] ${socket.id} REJOINED room ${data.roomCode} as player ${result.playerId}`
      );

      // Notify everyone that a player reconnected
      io.to(data.roomCode).emit('player-reconnected', {
        playerId: result.playerId,
        playerName: data.playerName,
        players: result.room.players,
        hostSocketId: result.room.hostSocketId,
      });

      // Send current game state to the rejoining player
      callback({
        success: true,
        roomCode: data.roomCode,
        playerId: result.playerId,
        players: result.room.players,
        hostSocketId: result.room.hostSocketId,
        gameState: result.room.gameState,
      });
    }
  );

  // ── Game Start ─────────────────────────────────────────────────────────

  socket.on('start-game', (data: { roomCode: string }, callback) => {
    const room = getRoom(data.roomCode);
    if (!room || room.hostSocketId !== socket.id) {
      callback({ success: false, error: 'Not host or room not found' });
      return;
    }
    const gameState = startGame(data.roomCode);
    if (!gameState) {
      callback({ success: false, error: 'Need at least 2 players' });
      return;
    }
    console.log(`[Server] Game started in room ${data.roomCode}`);
    io.to(data.roomCode).emit('game-started', { gameState });
    callback({ success: true });
  });

  // ── Dice Roll ──────────────────────────────────────────────────────────

  socket.on('roll-dice', (data: { roomCode: string }, callback) => {
    const gameState = rollDice(data.roomCode, socket.id);
    if (!gameState) {
      callback({ success: false, error: 'Not your turn or invalid state' });
      return;
    }
    console.log(
      `[Server] Dice rolled in ${data.roomCode}: ${gameState.dice.dice1}+${gameState.dice.dice2}=${gameState.dice.diceSum}`
    );
    io.to(data.roomCode).emit('game-state-update', { gameState });
    callback({ success: true, dice: gameState.dice });
  });

  // ── Player Finished Moving ─────────────────────────────────────────────

  socket.on('player-finished-moving', (data: { roomCode: string }, callback) => {
    const result = playerFinishedMoving(data.roomCode, socket.id);
    if (!result) {
      callback({ success: false });
      return;
    }
    io.to(data.roomCode).emit('game-state-update', {
      gameState: result.gameState,
      actionRequired: result.actionRequired,
    });
    callback({ success: true, actionRequired: result.actionRequired });
  });

  // ── Jail Actions ───────────────────────────────────────────────────────

  socket.on('roll-for-jail', (data: { roomCode: string }, callback) => {
    const gameState = rollForJail(data.roomCode, socket.id);
    if (!gameState) {
      callback({ success: false, error: 'Not your turn or not in jail' });
      return;
    }
    io.to(data.roomCode).emit('game-state-update', { gameState });
    callback({ success: true, dice: gameState.dice });
  });

  socket.on('pay-jail-fine', (data: { roomCode: string }, callback) => {
    const gameState = payJailFine(data.roomCode, socket.id);
    if (!gameState) {
      callback({ success: false, error: 'Cannot pay jail fine right now' });
      return;
    }
    io.to(data.roomCode).emit('game-state-update', { gameState });
    callback({ success: true });
  });

  socket.on('use-jail-card', (data: { roomCode: string }, callback) => {
    const gameState = useJailCard(data.roomCode, socket.id);
    if (!gameState) {
      callback({ success: false, error: 'No jail card available' });
      return;
    }
    io.to(data.roomCode).emit('game-state-update', { gameState });
    callback({ success: true });
  });

  // ── Buy Site ───────────────────────────────────────────────────────────

  socket.on('buy-site', (data: { roomCode: string }, callback) => {
    const gameState = buySiteAction(data.roomCode, socket.id);
    if (!gameState) {
      callback({ success: false });
      return;
    }
    io.to(data.roomCode).emit('game-state-update', { gameState });
    callback({ success: true });
  });

  // ── Auction (server-authoritative bidding) ───────────────────────────────

  socket.on(
    'place-bid',
    (data: { roomCode: string; amount: number }, callback) => {
      const gameState = placeBid(data.roomCode, socket.id, data.amount);
      if (!gameState) {
        callback({ success: false, error: 'Invalid bid' });
        return;
      }
      io.to(data.roomCode).emit('game-state-update', { gameState });
      callback({ success: true });
    }
  );

  socket.on('fold-auction', (data: { roomCode: string }, callback) => {
    const gameState = foldAuction(data.roomCode, socket.id);
    if (!gameState) {
      callback({ success: false, error: 'Invalid fold' });
      return;
    }
    io.to(data.roomCode).emit('game-state-update', { gameState });
    callback({ success: true });
  });

  // ── End Turn ───────────────────────────────────────────────────────────

  socket.on('end-turn', (data: { roomCode: string }, callback) => {
    const gameState = endTurn(data.roomCode, socket.id);
    if (!gameState) {
      callback({ success: false });
      return;
    }
    console.log(
      `[Server] Turn ended in ${data.roomCode}, active player: ${gameState.activePlayer}`
    );
    io.to(data.roomCode).emit('game-state-update', { gameState });
    callback({ success: true });
  });

  // ── Property Actions ───────────────────────────────────────────────────

  socket.on(
    'mortgage-site',
    (data: { roomCode: string; siteId: number }, callback) => {
      const gameState = mortgageSite(data.roomCode, socket.id, data.siteId);
      if (!gameState) {
        callback({ success: false });
        return;
      }
      io.to(data.roomCode).emit('game-state-update', { gameState });
      callback({ success: true });
    }
  );

  socket.on(
    'redeem-site',
    (data: { roomCode: string; siteId: number }, callback) => {
      const gameState = redeemSite(data.roomCode, socket.id, data.siteId);
      if (!gameState) {
        callback({ success: false });
        return;
      }
      io.to(data.roomCode).emit('game-state-update', { gameState });
      callback({ success: true });
    }
  );

  socket.on(
    'build-on-site',
    (data: { roomCode: string; siteId: number }, callback) => {
      const gameState = buildOnSite(data.roomCode, socket.id, data.siteId);
      if (!gameState) {
        callback({ success: false });
        return;
      }
      io.to(data.roomCode).emit('game-state-update', { gameState });
      callback({ success: true });
    }
  );

  socket.on(
    'sell-build',
    (data: { roomCode: string; siteId: number }, callback) => {
      const gameState = sellBuild(data.roomCode, socket.id, data.siteId);
      if (!gameState) {
        callback({ success: false });
        return;
      }
      io.to(data.roomCode).emit('game-state-update', { gameState });
      callback({ success: true });
    }
  );

  // ── Debt resolution ──────────────────────────────────────────────────────

  socket.on(
    'sell-site-to-bank',
    (data: { roomCode: string; siteId: number }, callback) => {
      const gameState = sellSiteToBank(data.roomCode, socket.id, data.siteId);
      if (!gameState) {
        callback({ success: false, error: 'Cannot sell that property' });
        return;
      }
      io.to(data.roomCode).emit('game-state-update', { gameState });
      callback({ success: true });
    }
  );

  socket.on('declare-bankruptcy', (data: { roomCode: string }, callback) => {
    const gameState = declareBankruptcy(data.roomCode, socket.id);
    if (!gameState) {
      callback({ success: false, error: 'Cannot declare bankruptcy right now' });
      return;
    }
    io.to(data.roomCode).emit('game-state-update', { gameState });
    callback({ success: true });
  });

  // ── Trading ────────────────────────────────────────────────────────────

  socket.on(
    'propose-trade',
    (
      data: {
        roomCode: string;
        toPlayerId: number;
        offeredSites: number[];
        requestedSites: number[];
        offeredMoney: number;
        requestedMoney: number;
      },
      callback
    ) => {
      const gameState = proposeTrade(
        data.roomCode,
        socket.id,
        data.toPlayerId,
        data.offeredSites || [],
        data.requestedSites || [],
        data.offeredMoney || 0,
        data.requestedMoney || 0
      );
      if (!gameState) {
        callback({ success: false, error: 'Invalid trade offer' });
        return;
      }
      io.to(data.roomCode).emit('game-state-update', { gameState });
      callback({ success: true });
    }
  );

  socket.on(
    'respond-trade',
    (data: { roomCode: string; tradeId: string; accept: boolean }, callback) => {
      const gameState = respondToTrade(data.roomCode, socket.id, data.tradeId, data.accept);
      if (!gameState) {
        callback({ success: false, error: 'Invalid trade response' });
        return;
      }
      io.to(data.roomCode).emit('game-state-update', { gameState });
      callback({ success: true });
    }
  );

  socket.on(
    'cancel-trade',
    (data: { roomCode: string; tradeId: string }, callback) => {
      const gameState = cancelTrade(data.roomCode, socket.id, data.tradeId);
      if (!gameState) {
        callback({ success: false, error: 'Invalid trade cancel' });
        return;
      }
      io.to(data.roomCode).emit('game-state-update', { gameState });
      callback({ success: true });
    }
  );

  // ── Disconnect ─────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    console.log(`[Server] Client disconnected: ${socket.id}`);
    const roomCode = socketRooms.get(socket.id);
    if (roomCode) {
      const result = removePlayer(roomCode, socket.id);
      if (result) {
        if (result.wasInGame) {
          // Game is active — notify others that player disconnected but can rejoin
          io.to(roomCode).emit('player-disconnected', {
            playerId: result.removedPlayerId,
            players: result.room.players,
            hostSocketId: result.room.hostSocketId,
            canRejoin: true,
          });
        } else {
          // Lobby — just update the player list
          io.to(roomCode).emit('room-updated', {
            players: result.room.players,
            hostSocketId: result.room.hostSocketId,
          });
        }
      }
      socketRooms.delete(socket.id);
    }
  });
});

const PORT = parseInt(process.env.PORT || '3001', 10);
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Heavy Business game server running on http://0.0.0.0:${PORT}`);
});
