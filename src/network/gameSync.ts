import { getSocket } from './socket';
import store from '../redux/store';
import {
  SYNC_GAME_STATE,
  SET_ROOM_PLAYERS,
  SET_ROOM_HOST,
} from '../redux/actions/actionTypes';
import { showNotification } from '../redux/actions/notification';

// Tracks the last lastEvent.seq we've already turned into an overlay,
// so re-syncs of the same state don't re-trigger the animation.
let lastShownEventSeq = 0;

function playerName(gameState: any, playerId: number | null | undefined): string {
  if (playerId === null || playerId === undefined) return 'Bank';
  return gameState.players?.[playerId]?.name || `Player ${playerId + 1}`;
}

/** Turn a server-emitted lastEvent into an overlay notification, if relevant. */
function notifyFromLastEvent(gameState: any, dispatch: (a: any) => void): void {
  const evt = gameState?.lastEvent;
  if (!evt || evt.seq <= lastShownEventSeq) return;
  lastShownEventSeq = evt.seq;

  const who = playerName(gameState, evt.playerId);
  const other = evt.otherPlayerId !== undefined ? playerName(gameState, evt.otherPlayerId) : null;
  const myPlayerId = store().getState().network?.myPlayerId;
  const isMe = evt.playerId !== null && evt.playerId === myPlayerId;

  const map: Record<string, { title: string; message: string; kind: string; amount?: number | null; tier: 'big' | 'toast' }> = {
    doubles: { title: 'Doubles!', message: `${who} rolled doubles — roll again`, kind: 'info', tier: 'big' },
    speeding_to_jail: { title: 'Speeding!', message: `${who} rolled 3 doubles in a row`, kind: 'jail', tier: 'big' },
    visited_jail: {
      title: 'Just Visiting',
      message: isMe ? "You're just visiting Jail — no charge" : `${who} is just visiting Jail`,
      kind: 'info',
      tier: 'big',
    },
    pass_go: { title: 'Passed GO', message: `${who} collected $${evt.amount}`, kind: 'credit', amount: evt.amount, tier: 'big' },
    rent_paid: {
      title: 'Rent Paid',
      message: `${who} paid ${other} $${evt.amount} for ${evt.description || 'rent'}`,
      kind: 'debit',
      amount: evt.amount,
      tier: 'big',
    },
    tax_paid: { title: 'Tax Paid', message: `${who} paid $${evt.amount} (${evt.description})`, kind: 'debit', amount: evt.amount, tier: 'big' },
    bought: { title: 'Property Bought', message: `${who} bought ${evt.description} for $${evt.amount}`, kind: 'buy', amount: evt.amount, tier: 'big' },
    auction_won: { title: 'Auction Won', message: `${who} won ${evt.description} for $${evt.amount}`, kind: 'buy', amount: evt.amount, tier: 'big' },
    auction_unsold: { title: 'Auction Closed', message: `No one bid on ${evt.description} — it stays with the bank`, kind: 'info', tier: 'big' },
    mortgaged: { title: 'Mortgaged', message: `${who} mortgaged ${evt.description} for $${evt.amount}`, kind: 'mortgage', amount: evt.amount, tier: 'big' },
    redeemed: { title: 'Mortgage Redeemed', message: `${who} redeemed ${evt.description} for $${evt.amount}`, kind: 'redeem', amount: evt.amount, tier: 'big' },
    built: { title: 'Building Built', message: `${who} built on ${evt.description} for $${evt.amount}`, kind: 'build', amount: evt.amount, tier: 'big' },
    sold_build: { title: 'Building Sold', message: `${who} sold a building on ${evt.description} for $${evt.amount}`, kind: 'sell', amount: evt.amount, tier: 'big' },
    chance_drawn: { title: 'Chance', message: evt.description || 'Chance card drawn', kind: 'chance', amount: evt.amount, tier: 'big' },
    chest_drawn: { title: 'Community Chest', message: evt.description || 'Chest card drawn', kind: 'chest', amount: evt.amount, tier: 'big' },
    sent_to_jail: { title: 'Go To Jail!', message: `${who} was sent to jail`, kind: 'jail', tier: 'big' },
    jail_fine_paid: { title: 'Jail Fine Paid', message: `${who} paid $${evt.amount} to leave jail`, kind: 'jail', amount: evt.amount, tier: 'big' },
    jail_card_used: { title: 'Get Out of Jail Free', message: `${who} used a Get Out of Jail Free card`, kind: 'jail', tier: 'big' },
    left_jail_doubles: { title: 'Rolled Out of Jail', message: `${who} rolled doubles and left jail`, kind: 'info', tier: 'big' },
    still_in_jail: { title: 'Still in Jail', message: `${who} failed to roll doubles`, kind: 'jail', tier: 'big' },
    bankrupt: { title: 'Bankrupt!', message: `${who} went bankrupt${other ? ` to ${other}` : ''}`, kind: 'jail', tier: 'big' },
    debt_incurred: {
      title: 'In Debt!',
      message: isMe
        ? `You're $${evt.amount} short — resolve it before you can continue`
        : `${who} is $${evt.amount} in debt`,
      kind: 'jail',
      amount: evt.amount,
      tier: 'big',
    },
    sold_to_bank: { title: 'Property Sold', message: `${who} sold ${evt.description} back to the bank for $${evt.amount}`, kind: 'sell', amount: evt.amount, tier: 'big' },
    game_over: { title: 'Game Over', message: evt.playerId != null ? `${who} wins the game!` : 'Game over', kind: 'info', tier: 'big' },
    trade_proposed: { title: 'Trade Offer', message: `${who} proposed a trade to ${other}`, kind: 'info', tier: 'big' },
    trade_accepted: { title: 'Trade Accepted', message: `${who} accepted a trade with ${other}`, kind: 'credit', tier: 'big' },
    trade_rejected: { title: 'Trade Rejected', message: `${who} rejected a trade`, kind: 'debit', tier: 'big' },
    trade_cancelled: { title: 'Trade Cancelled', message: `${who} cancelled their trade offer`, kind: 'info', tier: 'big' },
  };

  const entry = map[evt.kind];
  if (!entry) return;
  dispatch(
    showNotification({
      title: entry.title,
      message: entry.message,
      amount: entry.amount !== undefined ? entry.amount : evt.amount,
      kind: entry.kind,
      tier: entry.tier,
    })
  );
}

/**
 * Sets up listeners on the Socket.IO connection to sync server
 * game state broadcasts into the local Redux store.
 * Call this once after connecting to the server.
 */
export function setupGameSync(): void {
  const socket = getSocket();

  // Full game state sync from server
  socket.on('game-state-update', (data: { gameState: any; actionRequired?: string | null }) => {
    console.info('[GameSync] received game-state-update, actionRequired=', data.actionRequired);
    const reduxStore = store();
    notifyFromLastEvent(data.gameState, reduxStore.dispatch);
    reduxStore.dispatch({
      type: SYNC_GAME_STATE,
      payload: {
        gameState: data.gameState,
        actionRequired: data.actionRequired || null,
      },
    });
  });

  // Game started
  socket.on('game-started', (data: { gameState: any }) => {
    lastShownEventSeq = 0; // fresh game — reset the overlay dedupe cursor
    const reduxStore = store();
    reduxStore.dispatch({
      type: SYNC_GAME_STATE,
      payload: {
        gameState: data.gameState,
        actionRequired: null,
      },
    });
  });

  // Room player list updated
  socket.on('room-updated', (data: { players: any[]; hostSocketId: string }) => {
    const reduxStore = store();
    reduxStore.dispatch({
      type: SET_ROOM_PLAYERS,
      payload: data.players,
    });
    reduxStore.dispatch({
      type: SET_ROOM_HOST,
      payload: data.hostSocketId,
    });
  });

  // Player disconnected
  socket.on(
    'player-disconnected',
    (data: { playerId: number; players: any[]; hostSocketId: string }) => {
      const reduxStore = store();
      reduxStore.dispatch({
        type: SET_ROOM_PLAYERS,
        payload: data.players,
      });
      reduxStore.dispatch({
        type: SET_ROOM_HOST,
        payload: data.hostSocketId,
      });
    }
  );
}

/** Call after a rejoin/reconnect sync so we don't replay old event overlays. */
export function setEventOverlayBaseline(gameState: any): void {
  lastShownEventSeq = gameState?.lastEvent?.seq || 0;
}

export function cleanupGameSync(): void {
  const socket = getSocket();
  socket.off('game-state-update');
  socket.off('game-started');
  socket.off('room-updated');
  socket.off('player-disconnected');
}
