import boardData from '../src/assets/data/boardData.json';
import chestData from '../src/assets/data/chestData.json';
import chanceData from '../src/assets/data/chanceData.json';

// ── Types ──────────────────────────────────────────────────────────────────
export interface PlayerState {
  playerId: number;
  name: string;
  site: number;
  previousSite: number;
  money: number;
  isMoving: boolean;
  direction: boolean; // true = FORWARD, false = BACKWARD
  inJail: boolean;
  jailTurns: number; // failed attempts to roll doubles while in jail
  getOutOfJailFreeCards: number;
  consecutiveDoubles: number;
  isBankrupt: boolean;
  debtCreditor: number | null; // who this player currently owes money to, if their balance is negative (null = the bank)
}

export interface SiteState {
  sites: any[];
  boughtSites: number[];
  boughtBy: (number | null)[];
  playersSites: Record<number, any[]>;
  noOfCardsInCategory: Record<string, number>;
}

export interface TradeOffer {
  id: string;
  fromPlayerId: number;
  toPlayerId: number;
  offeredSites: number[];
  requestedSites: number[];
  offeredMoney: number;
  requestedMoney: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: number;
}

export interface LastEvent {
  seq: number;
  kind:
    | 'roll'
    | 'doubles'
    | 'speeding_to_jail'
    | 'move'
    | 'pass_go'
    | 'rent_paid'
    | 'tax_paid'
    | 'bought'
    | 'auction_won'
    | 'auction_unsold'
    | 'mortgaged'
    | 'redeemed'
    | 'built'
    | 'sold_build'
    | 'chance_drawn'
    | 'chest_drawn'
    | 'sent_to_jail'
    | 'visited_jail'
    | 'debt_incurred'
    | 'sold_to_bank'
    | 'jail_fine_paid'
    | 'jail_card_used'
    | 'left_jail_doubles'
    | 'still_in_jail'
    | 'bankrupt'
    | 'game_over'
    | 'trade_proposed'
    | 'trade_accepted'
    | 'trade_rejected'
    | 'trade_cancelled';
  playerId: number | null;
  otherPlayerId?: number | null;
  amount?: number | null;
  siteId?: number | null;
  description?: string | null;
}

export interface AuctionState {
  siteId: number;
  activeBidderId: number;
  currentBid: number;
  highBidderId: number | null;
  foldedPlayers: number[];
  history: { playerId: number; action: 'bid' | 'fold'; amount?: number }[];
}

export interface GameState {
  players: Record<number, PlayerState>;
  activePlayer: number;
  totalPlayers: number;
  dice: { dice1: number; dice2: number; diceSum: number | null; isDoubles: boolean };
  sites: SiteState;
  isDone: boolean;
  started: boolean;
  mustRollAgain: boolean; // true after a non-jail double roll — same player goes again
  hasRolledThisTurn: boolean;
  trades: TradeOffer[];
  currentAuction: AuctionState | null;
  winner: number | null;
  gameOver: boolean;
  lastEvent: LastEvent | null;
}

export interface RoomPlayer {
  socketId: string;
  playerId: number;
  name: string;
}

export interface GameRoom {
  code: string;
  hostSocketId: string;
  players: RoomPlayer[];
  maxPlayers: number;
  gameState: GameState | null;
  // Maps playerId -> playerName for disconnected players who can rejoin
  disconnectedPlayers: Map<number, string>;
}

// ── Constants ──────────────────────────────────────────────────────────────
const DIRECTIONS = { FORWARD: true, BACKWARD: false };
const CARD_TYPES = {
  SPECIAL: 'special',
  SITE: 'site',
  CHANCE: 'chance',
  CHEST: 'chest',
  TAX: 'tax',
  REALM_RAILS: 'realm_rails',
  UTILITY: 'utility',
};
const CHEST_OR_CHANCE_ACTION_TYPES = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
  MOVE: 'MOVE',
  LOGICAL: 'LOGICAL',
  JAIL_CARD: 'JAIL_CARD',
};

const GO_SITE_ID = 0;
const JAIL_SITE_ID = 10; // "Just Visiting" tile / jail cell
const GO_TO_JAIL_SITE_ID = 30;
const JAIL_FINE = 50;
const GO_SALARY = 200;
const MAX_JAIL_TURNS = 3;
const REPAIR_COST_PER_HOUSE = 20;
const REPAIR_COST_PER_HOTEL = 20;
const HOTEL_BUILT_LEVEL = 5; // site.built === 5 means hotel (levels 1-4 are houses)
const MAX_BUILT_LEVEL = 5;

// ── Room Store ─────────────────────────────────────────────────────────────
const rooms: Map<string, GameRoom> = new Map();
let eventSeq = 0;

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function createRoom(hostSocketId: string, playerName: string): GameRoom {
  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }
  const room: GameRoom = {
    code,
    hostSocketId,
    players: [{ socketId: hostSocketId, playerId: 0, name: playerName }],
    maxPlayers: 6,
    gameState: null,
    disconnectedPlayers: new Map(),
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): GameRoom | undefined {
  return rooms.get(code);
}

export function joinRoom(
  code: string,
  socketId: string,
  playerName: string
): { room: GameRoom; playerId: number } | null {
  const room = rooms.get(code);
  if (!room) return null;
  if (room.gameState?.started) return null;
  if (room.players.length >= room.maxPlayers) return null;
  if (room.players.find((p) => p.socketId === socketId)) return null;

  const playerId = room.players.length;
  room.players.push({ socketId, playerId, name: playerName });
  return { room, playerId };
}

export function removePlayer(
  code: string,
  socketId: string
): { room: GameRoom; removedPlayerId: number; wasInGame: boolean } | null {
  const room = rooms.get(code);
  if (!room) return null;

  const idx = room.players.findIndex((p) => p.socketId === socketId);
  if (idx === -1) return null;

  const removedPlayer = room.players[idx];
  const removedPlayerId = removedPlayer.playerId;
  const wasInGame = room.gameState?.started === true;

  if (wasInGame) {
    // During an active game, mark as disconnected instead of removing
    room.disconnectedPlayers.set(removedPlayerId, removedPlayer.name);
    // Remove from active players list but keep the slot
    room.players.splice(idx, 1);
  } else {
    // In lobby, just remove
    room.players.splice(idx, 1);
  }

  if (room.players.length === 0 && room.disconnectedPlayers.size === 0) {
    rooms.delete(code);
    return null;
  }

  // If host left, reassign host to first remaining connected player
  if (room.hostSocketId === socketId && room.players.length > 0) {
    room.hostSocketId = room.players[0].socketId;
  }

  return { room, removedPlayerId, wasInGame };
}

/**
 * Rejoin an active game room after disconnection.
 * Returns the room and restored playerId if successful.
 */
export function rejoinRoom(
  code: string,
  socketId: string,
  playerName: string
): { room: GameRoom; playerId: number } | null {
  const room = rooms.get(code);
  if (!room || !room.gameState?.started) return null;

  // Find a disconnected player slot that matches the name
  let matchedPlayerId: number | null = null;
  for (const [pid, name] of room.disconnectedPlayers.entries()) {
    if (name === playerName) {
      matchedPlayerId = pid;
      break;
    }
  }

  // If no name match, try to find any disconnected slot
  if (matchedPlayerId === null) {
    const firstDisconnected = room.disconnectedPlayers.keys().next();
    if (!firstDisconnected.done) {
      matchedPlayerId = firstDisconnected.value;
    }
  }

  if (matchedPlayerId === null) return null;

  // Restore the player
  room.disconnectedPlayers.delete(matchedPlayerId);
  room.players.push({ socketId, playerId: matchedPlayerId, name: playerName });

  // Reassign host if needed
  if (room.players.length === 1) {
    room.hostSocketId = socketId;
  }

  return { room, playerId: matchedPlayerId };
}

// ── Game State Management ──────────────────────────────────────────────────

function createPlayerData(totalPlayers: number, playersList: RoomPlayer[]): Record<number, PlayerState> {
  const players: Record<number, PlayerState> = {};
  for (let i = 0; i < totalPlayers; i++) {
    const roomPlayer = playersList.find((p) => p.playerId === i);
    players[i] = {
      playerId: i,
      name: roomPlayer ? roomPlayer.name : `Player ${i + 1}`,
      site: 0,
      previousSite: 0,
      money: 1500,
      isMoving: false,
      direction: DIRECTIONS.FORWARD,
      inJail: false,
      jailTurns: 0,
      getOutOfJailFreeCards: 0,
      consecutiveDoubles: 0,
      isBankrupt: false,
      debtCreditor: null,
    };
  }
  return players;
}

function initSiteState(sites: any[]): SiteState {
  const noOfCardsInCategory: Record<string, number> = {};
  for (const site of sites) {
    const subType = site.subType;
    noOfCardsInCategory[subType] = (noOfCardsInCategory[subType] || 0) + 1;
  }

  const playersSites: Record<number, any[]> = {};
  for (let i = 0; i < 8; i++) {
    playersSites[i] = [];
  }

  return {
    sites: JSON.parse(JSON.stringify(sites)),
    boughtSites: [],
    boughtBy: Array(40).fill(null),
    playersSites,
    noOfCardsInCategory,
  };
}

export function startGame(code: string): GameState | null {
  const room = rooms.get(code);
  if (!room) return null;
  if (room.players.length < 2) return null;

  const totalPlayers = room.players.length;
  const gameState: GameState = {
    players: createPlayerData(totalPlayers, room.players),
    activePlayer: 0,
    totalPlayers,
    dice: { dice1: 6, dice2: 6, diceSum: null, isDoubles: false },
    sites: initSiteState(boardData as any[]),
    isDone: false,
    started: true,
    mustRollAgain: false,
    hasRolledThisTurn: false,
    trades: [],
    currentAuction: null,
    winner: null,
    gameOver: false,
    lastEvent: null,
  };

  room.gameState = gameState;
  return gameState;
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function emitEvent(gs: GameState, evt: Omit<LastEvent, 'seq'>): void {
  eventSeq += 1;
  gs.lastEvent = { seq: eventSeq, ...evt };
}

/** Number of players still standing (not bankrupt). */
function activePlayerCount(gs: GameState): number {
  return Object.values(gs.players).filter((p) => !p.isBankrupt).length;
}

/**
 * Deduct money from a player. If they can't cover it, trigger bankruptcy.
 * creditorId === null means the debt is owed to the bank (tax, chance/chest, repairs).
 * Returns true if the player survived solvent, false if they went bankrupt.
 */
function chargePlayer(
  gs: GameState,
  playerId: number,
  amount: number,
  creditorId: number | null
): boolean {
  const player = gs.players[playerId];
  player.money -= amount;
  if (creditorId !== null) {
    gs.players[creditorId].money += amount;
  }
  if (player.money < 0) {
    // Don't auto-bankrupt: remember who this debt traces back to (in case
    // the player ultimately can't recover and declares bankruptcy) and let
    // them try to sell/mortgage/trade their way back to solvent first.
    player.debtCreditor = creditorId;
    emitEvent(gs, {
      kind: 'debt_incurred',
      playerId,
      otherPlayerId: creditorId,
      amount: -player.money,
    });
    return false;
  }
  return true;
}

/**
 * Liquidate a bankrupt player's assets to their creditor (or back to the bank),
 * remove them from the turn rotation, and check the win condition.
 */
function handleBankruptcy(gs: GameState, playerId: number, creditorId: number | null): void {
  const player = gs.players[playerId];
  if (player.isBankrupt) return; // already processed
  player.isBankrupt = true;
  player.money = 0;
  player.debtCreditor = null;

  const ownedSites = gs.sites.playersSites[playerId] || [];
  for (const ownedSite of ownedSites) {
    const siteId = ownedSite.id;
    const boardSite = gs.sites.sites[siteId];
    if (creditorId !== null) {
      // Transfer property (with its mortgage status) directly to the creditor.
      gs.sites.boughtBy[siteId] = creditorId;
      if (!gs.sites.playersSites[creditorId]) gs.sites.playersSites[creditorId] = [];
      gs.sites.playersSites[creditorId].push({ ...boardSite });
      gs.players[creditorId].getOutOfJailFreeCards += 0; // no-op, kept for clarity
    } else {
      // Owed to the bank: property returns to the bank, unowned and unbuilt.
      const idx = gs.sites.boughtSites.indexOf(siteId);
      if (idx !== -1) gs.sites.boughtSites.splice(idx, 1);
      gs.sites.boughtBy[siteId] = null;
      boardSite.built = 0;
      boardSite.isMortgaged = false;
    }
  }
  // Get-out-of-jail-free cards pass to the creditor, or are lost to the bank.
  if (creditorId !== null && player.getOutOfJailFreeCards > 0) {
    gs.players[creditorId].getOutOfJailFreeCards += player.getOutOfJailFreeCards;
  }
  player.getOutOfJailFreeCards = 0;
  gs.sites.playersSites[playerId] = [];

  emitEvent(gs, {
    kind: 'bankrupt',
    playerId,
    otherPlayerId: creditorId,
    description: creditorId !== null ? `Went bankrupt to ${gs.players[creditorId].name}` : 'Went bankrupt to the bank',
  });

  checkWinCondition(gs);
}

function checkWinCondition(gs: GameState): void {
  const remaining = Object.values(gs.players).filter((p) => !p.isBankrupt);
  if (remaining.length <= 1) {
    gs.gameOver = true;
    gs.winner = remaining.length === 1 ? remaining[0].playerId : null;
    gs.isDone = true;
    emitEvent(gs, { kind: 'game_over', playerId: gs.winner });
  }
}

/** Move activePlayer forward to the next non-bankrupt player. */
function advanceToNextPlayer(gs: GameState): void {
  if (gs.gameOver) return;
  let next = gs.activePlayer;
  for (let i = 0; i < gs.totalPlayers; i++) {
    next = (next + 1) % gs.totalPlayers;
    if (!gs.players[next].isBankrupt) {
      gs.activePlayer = next;
      return;
    }
  }
}

function moveDirect(player: PlayerState, toSite: number, direction: boolean): void {
  player.previousSite = player.site;
  player.site = toSite;
  player.isMoving = true;
  player.direction = direction;
}

function sendToJail(gs: GameState, playerId: number): void {
  const player = gs.players[playerId];
  moveDirect(player, JAIL_SITE_ID, DIRECTIONS.BACKWARD);
  player.inJail = true;
  player.jailTurns = 0;
  player.consecutiveDoubles = 0;
  emitEvent(gs, { kind: 'sent_to_jail', playerId });
}

// ── Game Actions ───────────────────────────────────────────────────────────

export function rollDice(code: string, socketId: string): GameState | null {
  const room = rooms.get(code);
  if (!room || !room.gameState) return null;

  const gs = room.gameState;
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player || player.playerId !== gs.activePlayer) return null;
  if (gs.isDone || gs.gameOver) return null;

  const currentPlayer = gs.players[gs.activePlayer];
  if (currentPlayer.inJail) return null; // must use jail-specific actions
  if (currentPlayer.money < 0) return null; // must resolve debt first
  if (gs.hasRolledThisTurn) return null; // can't roll again until this roll is fully resolved

  const dice1 = Math.floor(Math.random() * 6) + 1;
  const dice2 = Math.floor(Math.random() * 6) + 1;
  const diceSum = dice1 + dice2;
  const isDoubles = dice1 === dice2;

  gs.dice = { dice1, dice2, diceSum, isDoubles };
  gs.hasRolledThisTurn = true;

  emitEvent(gs, { kind: 'roll', playerId: currentPlayer.playerId, amount: diceSum });

  if (isDoubles) {
    currentPlayer.consecutiveDoubles += 1;
  } else {
    currentPlayer.consecutiveDoubles = 0;
  }

  // Three doubles in a row: go straight to jail, forfeit this move.
  if (currentPlayer.consecutiveDoubles >= 3) {
    currentPlayer.consecutiveDoubles = 0;
    gs.mustRollAgain = false;
    sendToJail(gs, currentPlayer.playerId);
    emitEvent(gs, { kind: 'speeding_to_jail', playerId: currentPlayer.playerId });
    gs.isDone = true;
    return gs;
  }

  gs.mustRollAgain = isDoubles;
  if (isDoubles) {
    emitEvent(gs, { kind: 'doubles', playerId: currentPlayer.playerId });
  }

  // Move the active player
  const previousSite = currentPlayer.site;
  const raw = previousSite + diceSum;
  const newSite = raw % 40;
  moveDirect(currentPlayer, newSite, DIRECTIONS.FORWARD);

  if (raw >= 40) {
    currentPlayer.money += GO_SALARY;
    emitEvent(gs, { kind: 'pass_go', playerId: currentPlayer.playerId, amount: GO_SALARY });
  }

  return gs;
}

/** Roll to attempt release from jail (pay-or-roll variant: player may also just roll). */
export function rollForJail(code: string, socketId: string): GameState | null {
  const room = rooms.get(code);
  if (!room || !room.gameState) return null;

  const gs = room.gameState;
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player || player.playerId !== gs.activePlayer) return null;
  if (gs.isDone || gs.gameOver) return null;

  const currentPlayer = gs.players[gs.activePlayer];
  if (!currentPlayer.inJail) return null;

  const dice1 = Math.floor(Math.random() * 6) + 1;
  const dice2 = Math.floor(Math.random() * 6) + 1;
  const diceSum = dice1 + dice2;
  const isDoubles = dice1 === dice2;
  gs.dice = { dice1, dice2, diceSum, isDoubles };
  gs.hasRolledThisTurn = true;
  gs.mustRollAgain = false; // doubles out of jail do NOT grant an extra turn

  if (isDoubles) {
    currentPlayer.inJail = false;
    currentPlayer.jailTurns = 0;
    emitEvent(gs, { kind: 'left_jail_doubles', playerId: currentPlayer.playerId, amount: diceSum });

    const previousSite = currentPlayer.site;
    const raw = previousSite + diceSum;
    const newSite = raw % 40;
    moveDirect(currentPlayer, newSite, DIRECTIONS.FORWARD);
    if (raw >= 40) {
      currentPlayer.money += GO_SALARY;
      emitEvent(gs, { kind: 'pass_go', playerId: currentPlayer.playerId, amount: GO_SALARY });
    }
    return gs;
  }

  currentPlayer.jailTurns += 1;
  if (currentPlayer.jailTurns >= MAX_JAIL_TURNS) {
    // Forced out on the third failed attempt: pay the fine and move.
    currentPlayer.inJail = false;
    currentPlayer.jailTurns = 0;
    const solvent = chargePlayer(gs, currentPlayer.playerId, JAIL_FINE, null);
    emitEvent(gs, { kind: 'jail_fine_paid', playerId: currentPlayer.playerId, amount: JAIL_FINE });
    if (!solvent) {
      gs.isDone = true;
      return gs;
    }
    const previousSite = currentPlayer.site;
    const raw = previousSite + diceSum;
    const newSite = raw % 40;
    moveDirect(currentPlayer, newSite, DIRECTIONS.FORWARD);
    if (raw >= 40) {
      currentPlayer.money += GO_SALARY;
      emitEvent(gs, { kind: 'pass_go', playerId: currentPlayer.playerId, amount: GO_SALARY });
    }
    return gs;
  }

  // Still stuck, turn ends.
  emitEvent(gs, { kind: 'still_in_jail', playerId: currentPlayer.playerId });
  gs.isDone = true;
  return gs;
}

export function payJailFine(code: string, socketId: string): GameState | null {
  const room = rooms.get(code);
  if (!room || !room.gameState) return null;

  const gs = room.gameState;
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player || player.playerId !== gs.activePlayer) return null;
  if (gs.isDone || gs.gameOver) return null;

  const currentPlayer = gs.players[gs.activePlayer];
  if (!currentPlayer.inJail) return null;
  if (currentPlayer.money < JAIL_FINE) return null;
  if (gs.hasRolledThisTurn) return null; // must pay before rolling this turn

  currentPlayer.money -= JAIL_FINE;
  currentPlayer.inJail = false;
  currentPlayer.jailTurns = 0;
  emitEvent(gs, { kind: 'jail_fine_paid', playerId: currentPlayer.playerId, amount: JAIL_FINE });
  // Player is now free and can roll normally this same turn.
  return gs;
}

export function useJailCard(code: string, socketId: string): GameState | null {
  const room = rooms.get(code);
  if (!room || !room.gameState) return null;

  const gs = room.gameState;
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player || player.playerId !== gs.activePlayer) return null;
  if (gs.isDone || gs.gameOver) return null;

  const currentPlayer = gs.players[gs.activePlayer];
  if (!currentPlayer.inJail) return null;
  if (currentPlayer.getOutOfJailFreeCards < 1) return null;
  if (gs.hasRolledThisTurn) return null;

  currentPlayer.getOutOfJailFreeCards -= 1;
  currentPlayer.inJail = false;
  currentPlayer.jailTurns = 0;
  emitEvent(gs, { kind: 'jail_card_used', playerId: currentPlayer.playerId });
  return gs;
}

export function playerFinishedMoving(
  code: string,
  socketId: string
): { gameState: GameState; actionRequired: string | null } | null {
  const room = rooms.get(code);
  if (!room || !room.gameState) return null;

  const gs = room.gameState;
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player || player.playerId !== gs.activePlayer) return null;

  const currentPlayer = gs.players[gs.activePlayer];
  currentPlayer.isMoving = false;

  const currentSite = gs.sites.sites[currentPlayer.site];

  // Determine what action is required
  let actionRequired: string | null = null;

  if (
    currentSite.type === CARD_TYPES.SITE ||
    currentSite.type === CARD_TYPES.REALM_RAILS ||
    currentSite.type === CARD_TYPES.UTILITY
  ) {
    if (gs.sites.boughtSites.includes(currentSite.id)) {
      const boughtBy = gs.sites.boughtBy[currentSite.id];
      if (!currentSite.isMortgaged && boughtBy !== currentPlayer.playerId) {
        // Pay rent
        const rent = calcRentServer(currentSite, gs.sites, boughtBy!, gs.dice.diceSum!);
        const solvent = chargePlayer(gs, currentPlayer.playerId, rent, boughtBy!);
        emitEvent(gs, {
          kind: 'rent_paid',
          playerId: currentPlayer.playerId,
          otherPlayerId: boughtBy,
          amount: rent,
          siteId: currentSite.id,
          description: currentSite.name,
        });
        if (!solvent) {
          gs.isDone = true;
          return { gameState: gs, actionRequired: null };
        }
      }
      gs.isDone = true;
    } else {
      if (currentSite.sellingPrice <= currentPlayer.money) {
        actionRequired = 'BUY_CARD';
      } else {
        actionRequired = 'AUCTION_CARD';
        gs.currentAuction = {
          siteId: currentSite.id,
          activeBidderId: currentPlayer.playerId,
          currentBid: 0,
          highBidderId: null,
          foldedPlayers: [],
          history: [],
        };
        // If it's already impossible for anyone (or all but one player) to
        // bid, resolve immediately instead of opening a bid box nobody can
        // use.
        const initialEligible = eligibleBidders(gs, gs.currentAuction);
        if (initialEligible.length === 0) {
          resolveAuction(gs, null, 0);
          actionRequired = null;
        } else {
          gs.currentAuction.activeBidderId = initialEligible[0];
        }
      }
    }
  } else if (currentSite.type === CARD_TYPES.SPECIAL) {
    if (currentSite.id === JAIL_SITE_ID) {
      // Just visiting — no charge, nothing happens. ONLY emit event if player is not actually in jail.
      if (!currentPlayer.inJail) {
        emitEvent(gs, { kind: 'visited_jail', playerId: currentPlayer.playerId });
      }
      gs.isDone = true;
    } else if (currentSite.id === GO_TO_JAIL_SITE_ID) {
      sendToJail(gs, currentPlayer.playerId);
      gs.mustRollAgain = false;
      actionRequired = 'MOVING_TO_JAIL';
    } else {
      gs.isDone = true;
    }
  } else if (currentSite.type === CARD_TYPES.TAX) {
    const solvent = chargePlayer(gs, currentPlayer.playerId, currentSite.debit, null);
    emitEvent(gs, {
      kind: 'tax_paid',
      playerId: currentPlayer.playerId,
      amount: currentSite.debit,
      description: currentSite.name,
    });
    gs.isDone = true;
    if (!solvent) return { gameState: gs, actionRequired: null };
  } else if (
    currentSite.type === CARD_TYPES.CHEST ||
    currentSite.type === CARD_TYPES.CHANCE
  ) {
    const isChance = currentSite.type === CARD_TYPES.CHANCE;
    const data = isChance
      ? (chanceData as any)[gs.dice.diceSum!]
      : (chestData as any)[gs.dice.diceSum!];

    if (data) {
      emitEvent(gs, {
        kind: isChance ? 'chance_drawn' : 'chest_drawn',
        playerId: currentPlayer.playerId,
        amount: data.amount ?? null,
        description: data.description,
      });

      if (data.type === CHEST_OR_CHANCE_ACTION_TYPES.DEBIT) {
        const solvent = chargePlayer(gs, currentPlayer.playerId, data.amount, null);
        gs.isDone = true;
        if (!solvent) return { gameState: gs, actionRequired: null };
      } else if (data.type === CHEST_OR_CHANCE_ACTION_TYPES.CREDIT) {
        currentPlayer.money += data.amount;
        gs.isDone = true;
      } else if (data.type === CHEST_OR_CHANCE_ACTION_TYPES.MOVE) {
        const goingToJail = data.to === JAIL_SITE_ID && data.direction === false;
        if (goingToJail) {
          sendToJail(gs, currentPlayer.playerId);
          gs.mustRollAgain = false;
          actionRequired = 'MOVING_TO_JAIL';
        } else {
          const prevSite = currentPlayer.site;
          const passesGo = data.direction === true && data.to < prevSite;
          moveDirect(currentPlayer, data.to, data.direction);
          if (passesGo) {
            currentPlayer.money += GO_SALARY;
            emitEvent(gs, { kind: 'pass_go', playerId: currentPlayer.playerId, amount: GO_SALARY });
          }
          actionRequired = 'CHEST_CHANCE_MOVE';
        }
      } else if (data.type === CHEST_OR_CHANCE_ACTION_TYPES.LOGICAL) {
        resolveLogicalCard(gs, currentPlayer.playerId, data.logicalId);
        gs.isDone = true;
      } else if (data.type === CHEST_OR_CHANCE_ACTION_TYPES.JAIL_CARD) {
        currentPlayer.getOutOfJailFreeCards += 1;
        gs.isDone = true;
      } else {
        gs.isDone = true;
      }
    } else {
      gs.isDone = true;
    }
  }

  return { gameState: gs, actionRequired };
}

/** Resolve LOGICAL-type Chance/Community Chest cards. */
function resolveLogicalCard(gs: GameState, playerId: number, logicalId: number): void {
  if (logicalId === 1) {
    // General repairs: pay per house / hotel owned.
    const ownedSites = gs.sites.playersSites[playerId] || [];
    let houses = 0;
    let hotels = 0;
    for (const s of ownedSites) {
      const built = gs.sites.sites[s.id]?.built ?? 0;
      if (built === HOTEL_BUILT_LEVEL) hotels += 1;
      else if (built > 0) houses += built;
    }
    const amount = houses * REPAIR_COST_PER_HOUSE + hotels * REPAIR_COST_PER_HOTEL;
    if (amount > 0) chargePlayer(gs, playerId, amount, null);
  } else if (logicalId === 2) {
    // Birthday: collect a fixed amount from every other (non-bankrupt) player.
    const PER_PLAYER = 10;
    for (let i = 0; i < gs.totalPlayers; i++) {
      if (i === playerId) continue;
      if (gs.players[i].isBankrupt) continue;
      chargePlayer(gs, i, PER_PLAYER, playerId);
    }
  }
}

function calcRentServer(
  currentSite: any,
  siteData: SiteState,
  boughtBy: number,
  diceSum: number
): number {
  const ownerSites = siteData.playersSites[boughtBy];

  if (currentSite.type === CARD_TYPES.SITE) {
    if (currentSite.built > 0) return currentSite.rentWithHouse[currentSite.built - 1];
    const totalSites = ownerSites.filter((s: any) => s.subType === currentSite.subType);
    let isDouble = false;
    if (totalSites.length === siteData.noOfCardsInCategory[currentSite.subType]) {
      isDouble = totalSites.every((s: any) => !s.isMortgaged);
    }
    return isDouble ? 2 * currentSite.rent : currentSite.rent;
  } else if (currentSite.type === CARD_TYPES.REALM_RAILS) {
    const rails = ownerSites.filter((s: any) => s.type === CARD_TYPES.REALM_RAILS);
    return Math.pow(2, rails.length - 1) * 25;
  } else if (currentSite.type === CARD_TYPES.UTILITY) {
    const utils = ownerSites.filter((s: any) => s.type === CARD_TYPES.UTILITY);
    return utils.length === 1 ? 4 * diceSum : 10 * diceSum;
  }
  return 0;
}

export function buySiteAction(code: string, socketId: string): GameState | null {
  const room = rooms.get(code);
  if (!room || !room.gameState) return null;

  const gs = room.gameState;
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player || player.playerId !== gs.activePlayer) return null;

  const currentPlayer = gs.players[gs.activePlayer];
  const currentSite = gs.sites.sites[currentPlayer.site];

  if (gs.sites.boughtSites.includes(currentSite.id)) return null;
  if (currentPlayer.money < currentSite.sellingPrice) return null;

  currentPlayer.money -= currentSite.sellingPrice;
  gs.sites.boughtSites.push(currentSite.id);
  gs.sites.boughtBy[currentSite.id] = currentPlayer.playerId;
  if (!gs.sites.playersSites[currentPlayer.playerId]) {
    gs.sites.playersSites[currentPlayer.playerId] = [];
  }
  gs.sites.playersSites[currentPlayer.playerId].push({ ...currentSite });
  gs.isDone = true;
  emitEvent(gs, {
    kind: 'bought',
    playerId: currentPlayer.playerId,
    amount: currentSite.sellingPrice,
    siteId: currentSite.id,
    description: currentSite.name,
  });

  return gs;
}

/** Resolve a finished auction: assign the property, charge the winner, clear state. */
function resolveAuction(gs: GameState, winnerId: number | null, amount: number): void {
  const auction = gs.currentAuction;
  if (!auction) return;
  const siteId = auction.siteId;
  const currentSite = gs.sites.sites[siteId];

  if (winnerId === null) {
    // Nobody ever placed a valid bid — the property stays unowned.
    emitEvent(gs, {
      kind: 'auction_unsold',
      playerId: null,
      siteId,
      description: currentSite.name,
    });
  } else {
    gs.players[winnerId].money -= amount;
    gs.sites.boughtSites.push(siteId);
    gs.sites.boughtBy[siteId] = winnerId;
    if (!gs.sites.playersSites[winnerId]) gs.sites.playersSites[winnerId] = [];
    gs.sites.playersSites[winnerId].push({ ...currentSite });
    emitEvent(gs, {
      kind: 'auction_won',
      playerId: winnerId,
      amount,
      siteId,
      description: currentSite.name,
    });
    if (gs.players[winnerId].money < 0) {
      gs.players[winnerId].debtCreditor = null; // owed to the bank
      emitEvent(gs, {
        kind: 'debt_incurred',
        playerId: winnerId,
        otherPlayerId: null,
        amount: -gs.players[winnerId].money,
      });
    }
  }

  gs.currentAuction = null;
  gs.isDone = true;
}

/** Which players are still eligible to keep bidding (not folded, can afford one more dollar). */
function eligibleBidders(gs: GameState, auction: AuctionState): number[] {
  const eligible: number[] = [];
  for (let playerId = 0; playerId < gs.totalPlayers; playerId++) {
    if (gs.players[playerId].isBankrupt) continue;
    if (auction.foldedPlayers.includes(playerId)) continue;
    if (gs.players[playerId].money <= auction.currentBid) continue; // can't outbid even by $1
    eligible.push(playerId);
  }
  return eligible;
}

function nextBidder(gs: GameState, auction: AuctionState, eligible: number[]): number {
  for (let i = 1; i <= gs.totalPlayers; i++) {
    const candidate = (auction.activeBidderId + i) % gs.totalPlayers;
    if (eligible.includes(candidate)) return candidate;
  }
  return auction.activeBidderId;
}

/** Advance the auction after a bid/fold: either move to the next bidder or resolve it. */
function advanceAuction(gs: GameState): void {
  const auction = gs.currentAuction;
  if (!auction) return;
  const eligible = eligibleBidders(gs, auction);

  if (eligible.length === 1) {
    if (auction.highBidderId !== null) {
      // High bidder wins for their current bid!
      resolveAuction(gs, auction.highBidderId, auction.currentBid);
    } else {
      // No bid placed yet. Single remaining player gets turn to bid or fold.
      auction.activeBidderId = eligible[0];
    }
  } else if (eligible.length === 0) {
    if (auction.highBidderId !== null) {
      resolveAuction(gs, auction.highBidderId, auction.currentBid);
    } else {
      resolveAuction(gs, null, 0);
    }
  } else {
    auction.activeBidderId = nextBidder(gs, auction, eligible);
  }
}

export function placeBid(
  code: string,
  socketId: string,
  amount: number
): GameState | null {
  const room = rooms.get(code);
  if (!room || !room.gameState) return null;
  const gs = room.gameState;
  const auction = gs.currentAuction;
  if (!auction) return null;

  const player = room.players.find((p) => p.socketId === socketId);
  if (!player || player.playerId !== auction.activeBidderId) return null;
  if (!Number.isFinite(amount)) return null;
  const bid = Math.floor(amount);
  if (bid <= auction.currentBid) return null;
  if (bid > gs.players[player.playerId].money) return null;

  auction.currentBid = bid;
  auction.highBidderId = player.playerId;
  auction.history.push({ playerId: player.playerId, action: 'bid', amount: bid });

  advanceAuction(gs);
  return gs;
}

export function foldAuction(code: string, socketId: string): GameState | null {
  const room = rooms.get(code);
  if (!room || !room.gameState) return null;
  const gs = room.gameState;
  const auction = gs.currentAuction;
  if (!auction) return null;

  const player = room.players.find((p) => p.socketId === socketId);
  if (!player || player.playerId !== auction.activeBidderId) return null;

  auction.foldedPlayers.push(player.playerId);
  auction.history.push({ playerId: player.playerId, action: 'fold' });

  advanceAuction(gs);
  return gs;
}

export function endTurn(code: string, socketId: string): GameState | null {
  const room = rooms.get(code);
  if (!room || !room.gameState) return null;

  const gs = room.gameState;
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player || player.playerId !== gs.activePlayer) return null;
  if (!gs.isDone || gs.gameOver) return null;
  if (gs.players[gs.activePlayer].money < 0) return null; // must resolve debt (sell/mortgage/trade) or declare bankruptcy first

  const rollAgain = gs.mustRollAgain && !gs.players[gs.activePlayer].inJail;

  gs.mustRollAgain = false;
  gs.hasRolledThisTurn = false;
  gs.isDone = false;
  gs.dice = { dice1: 0, dice2: 0, diceSum: null, isDoubles: false };

  if (!rollAgain) {
    advanceToNextPlayer(gs);
  }

  return gs;
}

export function mortgageSite(
  code: string,
  socketId: string,
  siteId: number
): GameState | null {
  const room = rooms.get(code);
  if (!room || !room.gameState) return null;

  const gs = room.gameState;
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return null;
  const isMyTurn = player.playerId === gs.activePlayer;
  const isResolvingDebt = gs.players[player.playerId].money < 0;
  if (!isMyTurn && !isResolvingDebt) return null;
  if (gs.sites.boughtBy[siteId] !== player.playerId) return null;

  const site = gs.sites.sites[siteId];
  if (site.isMortgaged) return null;
  if (site.built > 0) return null; // must sell buildings first

  site.isMortgaged = true;
  gs.players[player.playerId].money += site.mortgage;
  if (gs.players[player.playerId].money >= 0) {
    gs.players[player.playerId].debtCreditor = null;
  }

  // Update playersSites
  const pSites = gs.sites.playersSites[player.playerId];
  for (const s of pSites) {
    if (s.id === siteId) s.isMortgaged = true;
  }
  emitEvent(gs, {
    kind: 'mortgaged',
    playerId: player.playerId,
    amount: site.mortgage,
    siteId,
    description: site.name,
  });

  return gs;
}

export function redeemSite(
  code: string,
  socketId: string,
  siteId: number
): GameState | null {
  const room = rooms.get(code);
  if (!room || !room.gameState) return null;

  const gs = room.gameState;
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player || player.playerId !== gs.activePlayer) return null;
  if (gs.sites.boughtBy[siteId] !== player.playerId) return null;

  const site = gs.sites.sites[siteId];
  if (!site.isMortgaged) return null;

  const redeemCost = Math.floor(site.mortgage * 1.1);
  if (gs.players[player.playerId].money < redeemCost) return null;

  site.isMortgaged = false;
  gs.players[player.playerId].money -= redeemCost;

  const pSites = gs.sites.playersSites[player.playerId];
  for (const s of pSites) {
    if (s.id === siteId) s.isMortgaged = false;
  }
  emitEvent(gs, {
    kind: 'redeemed',
    playerId: player.playerId,
    amount: redeemCost,
    siteId,
    description: site.name,
  });

  return gs;
}

/** All sites of the same colour group as `site`. */
function colorGroupSites(gs: GameState, subType: string): any[] {
  return gs.sites.sites.filter((s: any) => s.type === CARD_TYPES.SITE && s.subType === subType);
}

/** Does `playerId` own every site in this colour group (a monopoly)? */
function ownsFullGroup(gs: GameState, playerId: number, subType: string): boolean {
  const group = colorGroupSites(gs, subType);
  return group.every((s: any) => gs.sites.boughtBy[s.id] === playerId);
}

export function buildOnSite(
  code: string,
  socketId: string,
  siteId: number
): GameState | null {
  const room = rooms.get(code);
  if (!room || !room.gameState) return null;

  const gs = room.gameState;
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player || player.playerId !== gs.activePlayer) return null;
  if (gs.players[player.playerId].money < 0) return null; // can't spend on building while in debt
  if (gs.sites.boughtBy[siteId] !== player.playerId) return null;

  const site = gs.sites.sites[siteId];
  if (site.type !== CARD_TYPES.SITE) return null; // only colour sites can be built on
  if (site.built >= MAX_BUILT_LEVEL || site.isMortgaged) return null;
  if (gs.players[player.playerId].money < site.construction) return null;

  // Must own the full colour group (a monopoly) before building.
  if (!ownsFullGroup(gs, player.playerId, site.subType)) return null;

  // Even-building rule: can't build here if another site in the group is behind.
  const group = colorGroupSites(gs, site.subType);
  const minBuilt = Math.min(...group.map((s: any) => gs.sites.sites[s.id].built));
  if (site.built > minBuilt) return null;
  // Any group member still mortgaged blocks building on the whole set.
  if (group.some((s: any) => gs.sites.sites[s.id].isMortgaged)) return null;

  site.built += 1;
  gs.players[player.playerId].money -= site.construction;

  const pSites = gs.sites.playersSites[player.playerId];
  for (const s of pSites) {
    if (s.id === siteId) s.built = site.built;
  }
  emitEvent(gs, {
    kind: 'built',
    playerId: player.playerId,
    amount: site.construction,
    siteId,
    description: site.name,
  });

  return gs;
}

export function sellBuild(
  code: string,
  socketId: string,
  siteId: number
): GameState | null {
  const room = rooms.get(code);
  if (!room || !room.gameState) return null;

  const gs = room.gameState;
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return null;
  const isMyTurn = player.playerId === gs.activePlayer;
  const isResolvingDebt = gs.players[player.playerId].money < 0;
  if (!isMyTurn && !isResolvingDebt) return null;
  if (gs.sites.boughtBy[siteId] !== player.playerId) return null;

  const site = gs.sites.sites[siteId];
  if (site.built <= 0) return null;

  // Even-selling rule: must sell from the most-built site in the group first.
  const group = colorGroupSites(gs, site.subType);
  const maxBuilt = Math.max(...group.map((s: any) => gs.sites.sites[s.id].built));
  if (site.built < maxBuilt) return null;

  site.built -= 1;
  gs.players[player.playerId].money += Math.floor(site.construction / 2);
  if (gs.players[player.playerId].money >= 0) {
    gs.players[player.playerId].debtCreditor = null;
  }

  const pSites = gs.sites.playersSites[player.playerId];
  for (const s of pSites) {
    if (s.id === siteId) s.built = site.built;
  }
  emitEvent(gs, {
    kind: 'sold_build',
    playerId: player.playerId,
    amount: Math.floor(site.construction / 2),
    siteId,
    description: site.name,
  });

  return gs;
}

// ── Debt resolution ──────────────────────────────────────────────────────

/**
 * Sell an unimproved, unmortgaged property straight back to the bank at the
 * exact price the player originally paid for it — distinct from mortgaging
 * (which keeps the property, just encumbered) and from a house/hotel sale
 * (which is only ever worth half). This is one of the ways a player in debt
 * can raise cash; the property becomes unowned and available to buy again.
 */
export function sellSiteToBank(
  code: string,
  socketId: string,
  siteId: number
): GameState | null {
  const room = rooms.get(code);
  if (!room || !room.gameState) return null;

  const gs = room.gameState;
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return null;
  const isMyTurn = player.playerId === gs.activePlayer;
  const isResolvingDebt = gs.players[player.playerId].money < 0;
  if (!isMyTurn && !isResolvingDebt) return null;
  if (gs.sites.boughtBy[siteId] !== player.playerId) return null;

  const site = gs.sites.sites[siteId];
  if (site.built > 0) return null; // must sell any buildings first
  if (site.isMortgaged) return null; // must redeem (or just keep it mortgaged) rather than sell encumbered

  const amount = site.sellingPrice;
  gs.players[player.playerId].money += amount;
  if (gs.players[player.playerId].money >= 0) {
    gs.players[player.playerId].debtCreditor = null;
  }

  const idx = gs.sites.boughtSites.indexOf(siteId);
  if (idx !== -1) gs.sites.boughtSites.splice(idx, 1);
  gs.sites.boughtBy[siteId] = null;
  gs.sites.playersSites[player.playerId] = gs.sites.playersSites[player.playerId].filter(
    (s: any) => s.id !== siteId
  );

  emitEvent(gs, {
    kind: 'sold_to_bank',
    playerId: player.playerId,
    amount,
    siteId,
    description: site.name,
  });

  return gs;
}

/**
 * A player who is negative on cash explicitly chooses to give up rather
 * than keep selling/mortgaging/trading to recover. Unlike the old
 * behaviour, bankruptcy is never automatic — the player always gets the
 * chance to resolve their debt first.
 */
export function declareBankruptcy(code: string, socketId: string): GameState | null {
  const room = rooms.get(code);
  if (!room || !room.gameState) return null;

  const gs = room.gameState;
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return null;
  const playerId = player.playerId;
  if (gs.players[playerId].money >= 0) return null; // nothing to declare — not in debt
  if (gs.players[playerId].isBankrupt) return null;

  const creditor = gs.players[playerId].debtCreditor;
  const wasActivePlayer = gs.activePlayer === playerId;
  handleBankruptcy(gs, playerId, creditor);

  // If the bankrupt player was mid-turn, they can no longer act — hand the
  // turn to the next (non-bankrupt) player instead of leaving it stuck.
  if (!gs.gameOver && wasActivePlayer) {
    gs.mustRollAgain = false;
    gs.hasRolledThisTurn = false;
    gs.isDone = false;
    gs.dice = { dice1: 0, dice2: 0, diceSum: null, isDoubles: false };
    advanceToNextPlayer(gs);
  }

  return gs;
}



let tradeSeq = 0;

export function proposeTrade(
  code: string,
  socketId: string,
  toPlayerId: number,
  offeredSites: number[],
  requestedSites: number[],
  offeredMoney: number,
  requestedMoney: number
): GameState | null {
  const room = rooms.get(code);
  if (!room || !room.gameState) return null;

  const gs = room.gameState;
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return null;
  const fromPlayerId = player.playerId;
  if (fromPlayerId === toPlayerId) return null;
  if (!gs.players[toPlayerId] || gs.players[toPlayerId].isBankrupt) return null;
  if (gs.players[fromPlayerId].isBankrupt) return null;

  // Validate ownership up front.
  for (const siteId of offeredSites) {
    if (gs.sites.boughtBy[siteId] !== fromPlayerId) return null;
  }
  for (const siteId of requestedSites) {
    if (gs.sites.boughtBy[siteId] !== toPlayerId) return null;
  }
  if (offeredMoney < 0 || requestedMoney < 0) return null;
  if (offeredMoney > gs.players[fromPlayerId].money) return null;

  tradeSeq += 1;
  const trade: TradeOffer = {
    id: `trade-${tradeSeq}`,
    fromPlayerId,
    toPlayerId,
    offeredSites,
    requestedSites,
    offeredMoney,
    requestedMoney,
    status: 'pending',
    createdAt: Date.now(),
  };
  gs.trades.push(trade);
  emitEvent(gs, {
    kind: 'trade_proposed',
    playerId: fromPlayerId,
    otherPlayerId: toPlayerId,
    description: trade.id,
  });

  return gs;
}

export function respondToTrade(
  code: string,
  socketId: string,
  tradeId: string,
  accept: boolean
): GameState | null {
  const room = rooms.get(code);
  if (!room || !room.gameState) return null;

  const gs = room.gameState;
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return null;

  const trade = gs.trades.find((t) => t.id === tradeId);
  if (!trade || trade.status !== 'pending') return null;
  if (trade.toPlayerId !== player.playerId) return null;

  if (!accept) {
    trade.status = 'rejected';
    emitEvent(gs, {
      kind: 'trade_rejected',
      playerId: trade.toPlayerId,
      otherPlayerId: trade.fromPlayerId,
    });
    return gs;
  }

  // Re-validate everything still holds true at acceptance time.
  const { fromPlayerId, toPlayerId, offeredSites, requestedSites, offeredMoney, requestedMoney } = trade;
  for (const siteId of offeredSites) {
    if (gs.sites.boughtBy[siteId] !== fromPlayerId) return null;
  }
  for (const siteId of requestedSites) {
    if (gs.sites.boughtBy[siteId] !== toPlayerId) return null;
  }
  if (gs.players[fromPlayerId].money < offeredMoney) return null;
  if (gs.players[toPlayerId].money < requestedMoney) return null;

  // Swap money.
  gs.players[fromPlayerId].money -= offeredMoney;
  gs.players[toPlayerId].money += offeredMoney;
  gs.players[toPlayerId].money -= requestedMoney;
  gs.players[fromPlayerId].money += requestedMoney;

  // Swap properties (mortgage status travels with the property).
  transferSite(gs, offeredSites, fromPlayerId, toPlayerId);
  transferSite(gs, requestedSites, toPlayerId, fromPlayerId);

  trade.status = 'accepted';
  emitEvent(gs, {
    kind: 'trade_accepted',
    playerId: trade.toPlayerId,
    otherPlayerId: trade.fromPlayerId,
  });

  return gs;
}

export function cancelTrade(code: string, socketId: string, tradeId: string): GameState | null {
  const room = rooms.get(code);
  if (!room || !room.gameState) return null;

  const gs = room.gameState;
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return null;

  const trade = gs.trades.find((t) => t.id === tradeId);
  if (!trade || trade.status !== 'pending') return null;
  if (trade.fromPlayerId !== player.playerId) return null;

  trade.status = 'cancelled';
  emitEvent(gs, { kind: 'trade_cancelled', playerId: player.playerId });
  return gs;
}

function transferSite(gs: GameState, siteIds: number[], fromId: number, toId: number): void {
  for (const siteId of siteIds) {
    gs.sites.boughtBy[siteId] = toId;
    gs.sites.playersSites[fromId] = gs.sites.playersSites[fromId].filter((s: any) => s.id !== siteId);
    if (!gs.sites.playersSites[toId]) gs.sites.playersSites[toId] = [];
    gs.sites.playersSites[toId].push({ ...gs.sites.sites[siteId] });
  }
}
