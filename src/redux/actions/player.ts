import {
  CREDIT_PLAYER_MONEY,
  DEBIT_PLAYER_MONEY,
  MOVE_PLAYER,
  SET_ACTIVE_PLAYER,
  SET_IS_MOVING,
  SET_TOTAL_PLAYERS,
} from './actionTypes';

export function movePlayer(playerId, currentSite, direction, suppressNotification?) {
  return {
    type: MOVE_PLAYER,
    payload: {
      playerId,
      currentSite,
      direction,
      suppressNotification: suppressNotification === true,
    },
  };
}

export function setTotalPlayers(data, botCount) {
  return {
    type: SET_TOTAL_PLAYERS,
    payload: { totalPlayers: data, botCount: botCount || 0 },
  };
}

export function setActivePlayer() {
  return {
    type: SET_ACTIVE_PLAYER,
    payload: null,
  };
}

export function debitPlayerMoney(playerId, amount, description?, suppressNotification?) {
  return {
    type: DEBIT_PLAYER_MONEY,
    payload: {
      playerId,
      amount,
      description: description === undefined ? null : description,
      suppressNotification: suppressNotification === true,
    },
  };
}
export function creditPlayerMoney(playerId, amount, description?, suppressNotification?) {
  return {
    type: CREDIT_PLAYER_MONEY,
    payload: {
      playerId,
      amount,
      description: description === undefined ? null : description,
      suppressNotification: suppressNotification === true,
    },
  };
}

export function setIsMoving(playerId, isMoving) {
  return {
    type: SET_IS_MOVING,
    payload: {
      playerId: playerId,
      isMoving: isMoving,
    },
  };
}
