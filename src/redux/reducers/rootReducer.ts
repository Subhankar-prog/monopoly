import { combineReducers } from 'redux';
import card from './card';
import player from './player';
import dice from './dice';
import board from './board';
import modal from './modal';
import site from './site';
import action from './action';
import network from './network';
import notification from './notification';
import trades from './trades';
import gameMeta from './gameMeta';
import currentAuction from './auction';
import { SYNC_GAME_STATE } from '../actions/actionTypes';

const appReducer = combineReducers({
  card,
  playersData: player,
  dice,
  board,
  modalData: modal,
  siteData: site,
  actionData: action,
  network,
  notification,
  trades,
  gameMeta,
  currentAuction,
});

// Wrap the combined reducer to handle full game state sync from server
const rootReducer = (state: any, action: any) => {
  if (action.type === SYNC_GAME_STATE && action.payload?.gameState) {
    const gs = action.payload.gameState;
    // Note: notification overlays are driven separately by lastEvent in
    // src/network/gameSync.ts (dispatched just before this action), so we
    // simply preserve whatever notification state is already in the store.
    return {
      ...state,
      playersData: {
        activePlayer: gs.activePlayer,
        totalPlayers: gs.totalPlayers,
        players: gs.players,
      },
      dice: {
        dice1: gs.dice.dice1,
        dice2: gs.dice.dice2,
        diceSum: gs.dice.diceSum,
        isDoubles: gs.dice.isDoubles || false,
        setDiceSumCalledCount: (state.dice?.setDiceSumCalledCount || 0) + 1,
      },
      siteData: {
        sites: gs.sites.sites,
        boughtSites: gs.sites.boughtSites,
        boughtBy: gs.sites.boughtBy,
        playersSites: gs.sites.playersSites,
        noOfCardsInCategory: gs.sites.noOfCardsInCategory,
      },
      board: {
        ...state.board,
        isDone: gs.isDone,
      },
      trades: gs.trades || [],
      currentAuction: gs.currentAuction || null,
      gameMeta: {
        mustRollAgain: !!gs.mustRollAgain,
        gameOver: !!gs.gameOver,
        winner: gs.winner ?? null,
      },
      // Preserve modal, action, network, card slices
      modalData: state.modalData,
      actionData: state.actionData,
      network: state.network,
      card: state.card,
      notification: state.notification,
    };
  }
  return appReducer(state, action);
};

export default rootReducer;
