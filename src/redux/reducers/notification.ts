import {
  NOTIFICATION_SHOW,
  NOTIFICATION_HIDE,
} from '../actions/actionTypes';
import {
  DEBIT_PLAYER_MONEY,
  CREDIT_PLAYER_MONEY,
  BUY_SITE,
  SELL_BUILD,
  MOVE_PLAYER,
} from '../actions/actionTypes';

const initialState = {
  show: false,
  title: null,
  message: null,
  amount: null,
  kind: null,
};

export default function notification(state = initialState, action) {
  switch (action.type) {
    case NOTIFICATION_SHOW:
      return {
        ...state,
        show: true,
        ...action.payload,
      };
    case NOTIFICATION_HIDE:
      return initialState;
    case DEBIT_PLAYER_MONEY: {
      const { playerId, amount, description, suppressNotification } = action.payload || {};
      if (suppressNotification) return state;
      return {
        show: true,
        title: `Player ${playerId + 1} Paid`,
        message: description || `Paid $${amount}`,
        amount,
        kind: 'debit',
      };
    }
    case CREDIT_PLAYER_MONEY: {
      const { playerId, amount, description, suppressNotification } = action.payload || {};
      if (suppressNotification) return state;
      return {
        show: true,
        title: `Player ${playerId + 1} Received`,
        message: description || `Received $${amount}`,
        amount,
        kind: 'credit',
      };
    }
    case BUY_SITE: {
      const { playerId, siteData } = action.payload || {};
      return {
        show: true,
        title: `Player ${playerId + 1} Bought`,
        message: `${siteData?.name || 'Property'} for $${siteData?.sellingPrice || ''}`,
        amount: siteData?.sellingPrice || null,
        kind: 'buy',
      };
    }
    case SELL_BUILD: {
      const { playerId, siteId } = action.payload || {};
      return {
        show: true,
        title: `Player ${playerId + 1} Sold`,
        message: `Sold building on site ${siteId}`,
        amount: null,
        kind: 'sell',
      };
    }
    case MOVE_PLAYER: {
      const { playerId, currentSite, suppressNotification } = action.payload || {};
      if (suppressNotification) return state;
      return {
        show: true,
        title: `Player ${playerId + 1} Moved`,
        message: `Moved to ${currentSite}`,
        amount: null,
        kind: 'move',
      };
    }
    default:
      return state;
  }
}
