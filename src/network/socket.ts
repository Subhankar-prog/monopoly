import { io, Socket } from 'socket.io-client';

// Use VITE_SERVER_URL env var for production hosting, fallback to localhost
const SERVER_URL = (import.meta as any).env?.VITE_SERVER_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function connectToServer(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    if (s.connected) {
      resolve(s);
      return;
    }

    // Clean up any stale listeners
    s.off('connect');
    s.off('connect_error');

    const timeout = setTimeout(() => {
      s.off('connect', onConnect);
      s.off('connect_error', onError);
      reject(new Error('Connection timeout — is the game server running on port 3001?'));
    }, 5000);

    const onConnect = () => {
      clearTimeout(timeout);
      s.off('connect_error', onError);
      console.log('[Socket] Connected to server:', s.id);
      resolve(s);
    };

    const onError = (err: Error) => {
      clearTimeout(timeout);
      s.off('connect', onConnect);
      console.error('[Socket] Connection error:', err);
      reject(err);
    };

    s.on('connect', onConnect);
    s.on('connect_error', onError);
    s.connect();
  });
}

export function disconnectFromServer(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function rejoinRoom(
  roomCode: string,
  playerName: string
): Promise<{
  roomCode: string;
  playerId: number;
  players: any[];
  hostSocketId: string;
  gameState: any;
}> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('rejoin-room', { roomCode, playerName }, (response: any) => {
      if (response.success) {
        resolve(response);
      } else {
        reject(new Error(response.error || 'Failed to rejoin room'));
      }
    });
  });
}

export function createRoom(
  playerName: string
): Promise<{ roomCode: string; playerId: number; players: any[] }> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('create-room', { playerName }, (response: any) => {
      if (response.success) {
        resolve(response);
      } else {
        reject(new Error(response.error || 'Failed to create room'));
      }
    });
  });
}

export function joinRoom(
  roomCode: string,
  playerName: string
): Promise<{
  roomCode: string;
  playerId: number;
  players: any[];
  hostSocketId: string;
}> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('join-room', { roomCode, playerName }, (response: any) => {
      if (response.success) {
        resolve(response);
      } else {
        reject(new Error(response.error || 'Failed to join room'));
      }
    });
  });
}

export function startGame(roomCode: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('start-game', { roomCode }, (response: any) => {
      if (response.success) {
        resolve();
      } else {
        reject(new Error(response.error || 'Failed to start game'));
      }
    });
  });
}

export function emitRollDice(roomCode: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('roll-dice', { roomCode }, (response: any) => {
      if (response.success) {
        resolve(response.dice);
      } else {
        reject(new Error(response.error || 'Failed to roll dice'));
      }
    });
  });
}

export function emitPlayerFinishedMoving(roomCode: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('player-finished-moving', { roomCode }, (response: any) => {
      if (response.success) {
        resolve(response);
      } else {
        reject(new Error('Failed'));
      }
    });
  });
}

export function emitBuySite(roomCode: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('buy-site', { roomCode }, (response: any) => {
      if (response.success) resolve();
      else reject(new Error('Failed to buy'));
    });
  });
}

export function emitEndTurn(roomCode: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('end-turn', { roomCode }, (response: any) => {
      if (response.success) resolve();
      else reject(new Error('Failed to end turn'));
    });
  });
}

export function emitMortgageSite(
  roomCode: string,
  siteId: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('mortgage-site', { roomCode, siteId }, (response: any) => {
      if (response.success) resolve();
      else reject(new Error('Failed'));
    });
  });
}

export function emitRedeemSite(
  roomCode: string,
  siteId: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('redeem-site', { roomCode, siteId }, (response: any) => {
      if (response.success) resolve();
      else reject(new Error('Failed'));
    });
  });
}

export function emitBuildOnSite(
  roomCode: string,
  siteId: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('build-on-site', { roomCode, siteId }, (response: any) => {
      if (response.success) resolve();
      else reject(new Error('Failed'));
    });
  });
}

export function emitSellBuild(
  roomCode: string,
  siteId: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('sell-build', { roomCode, siteId }, (response: any) => {
      if (response.success) resolve();
      else reject(new Error('Failed'));
    });
  });
}

// ── Auction ─────────────────────────────────────────────────────────────

export function emitPlaceBid(roomCode: string, amount: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('place-bid', { roomCode, amount }, (response: any) => {
      if (response.success) resolve();
      else reject(new Error(response.error || 'Failed to place bid'));
    });
  });
}

export function emitFoldAuction(roomCode: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('fold-auction', { roomCode }, (response: any) => {
      if (response.success) resolve();
      else reject(new Error(response.error || 'Failed to fold'));
    });
  });
}

// ── Debt Resolution ─────────────────────────────────────────────────────

export function emitSellSiteToBank(roomCode: string, siteId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('sell-site-to-bank', { roomCode, siteId }, (response: any) => {
      if (response.success) resolve();
      else reject(new Error(response.error || 'Failed to sell'));
    });
  });
}

export function emitDeclareBankruptcy(roomCode: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('declare-bankruptcy', { roomCode }, (response: any) => {
      if (response.success) resolve();
      else reject(new Error(response.error || 'Failed to declare bankruptcy'));
    });
  });
}

// ── Jail Actions ─────────────────────────────────────────────────────────

export function emitRollForJail(roomCode: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('roll-for-jail', { roomCode }, (response: any) => {
      if (response.success) resolve(response.dice);
      else reject(new Error(response.error || 'Failed to roll'));
    });
  });
}

export function emitPayJailFine(roomCode: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('pay-jail-fine', { roomCode }, (response: any) => {
      if (response.success) resolve();
      else reject(new Error(response.error || 'Failed to pay fine'));
    });
  });
}

export function emitUseJailCard(roomCode: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('use-jail-card', { roomCode }, (response: any) => {
      if (response.success) resolve();
      else reject(new Error(response.error || 'Failed to use card'));
    });
  });
}

// ── Trading ─────────────────────────────────────────────────────────────

export function emitProposeTrade(
  roomCode: string,
  toPlayerId: number,
  offeredSites: number[],
  requestedSites: number[],
  offeredMoney: number,
  requestedMoney: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit(
      'propose-trade',
      { roomCode, toPlayerId, offeredSites, requestedSites, offeredMoney, requestedMoney },
      (response: any) => {
        if (response.success) resolve();
        else reject(new Error(response.error || 'Failed to propose trade'));
      }
    );
  });
}

export function emitRespondTrade(
  roomCode: string,
  tradeId: string,
  accept: boolean
): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('respond-trade', { roomCode, tradeId, accept }, (response: any) => {
      if (response.success) resolve();
      else reject(new Error(response.error || 'Failed to respond to trade'));
    });
  });
}

export function emitCancelTrade(roomCode: string, tradeId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('cancel-trade', { roomCode, tradeId }, (response: any) => {
      if (response.success) resolve();
      else reject(new Error(response.error || 'Failed to cancel trade'));
    });
  });
}
