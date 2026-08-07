import {
  NOTIFICATION_SHOW,
  NOTIFICATION_HIDE,
  DEBIT_PLAYER_MONEY,
  CREDIT_PLAYER_MONEY,
  BUY_SITE,
  SELL_BUILD,
  MOVE_PLAYER,
} from '../actions/actionTypes';

const initialState: any = {
  show: false,
  title: null,
  message: null,
  amount: null,
  kind: null,
  logHistory: [],
};

const formatTime = () => {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export default function notification(state = initialState, action: any) {
  switch (action.type) {
    case NOTIFICATION_SHOW: {
      const newEntry = {
        id: Date.now() + Math.random(),
        time: formatTime(),
        title: action.payload?.title || 'Game Update',
        message: action.payload?.message || '',
        kind: action.payload?.kind || 'info',
      };
      return {
        ...state,
        show: true,
        ...action.payload,
        logHistory: [newEntry, ...(state.logHistory || [])].slice(0, 100),
      };
    }
    case NOTIFICATION_HIDE:
      return {
        ...state,
        show: false,
      };
    case DEBIT_PLAYER_MONEY: {
      const { playerId, amount, description, suppressNotification } = action.payload || {};
      if (suppressNotification) return state;
      const title = `Player ${playerId + 1} Paid`;
      const message = description || `Paid $${amount}`;
      const entry = { id: Date.now() + Math.random(), time: formatTime(), title, message, kind: 'debit' };
      return {
        ...state,
        show: true,
        title,
        message,
        amount,
        kind: 'debit',
        tier: 'big',
        logHistory: [entry, ...(state.logHistory || [])].slice(0, 100),
      };
    }
    case CREDIT_PLAYER_MONEY: {
      const { playerId, amount, description, suppressNotification } = action.payload || {};
      if (suppressNotification) return state;
      const title = `Player ${playerId + 1} Received`;
      const message = description || `Received $${amount}`;
      const entry = { id: Date.now() + Math.random(), time: formatTime(), title, message, kind: 'credit' };
      return {
        ...state,
        show: true,
        title,
        message,
        amount,
        kind: 'credit',
        tier: 'big',
        logHistory: [entry, ...(state.logHistory || [])].slice(0, 100),
      };
    }
    case BUY_SITE: {
      const { playerId, siteData } = action.payload || {};
      const title = `Player ${playerId + 1} Bought`;
      const message = `${siteData?.name || 'Property'} for $${siteData?.sellingPrice || ''}`;
      const entry = { id: Date.now() + Math.random(), time: formatTime(), title, message, kind: 'buy' };
      return {
        ...state,
        show: true,
        title,
        message,
        amount: siteData?.sellingPrice || null,
        kind: 'buy',
        tier: 'big',
        logHistory: [entry, ...(state.logHistory || [])].slice(0, 100),
      };
    }
    case SELL_BUILD: {
      const { playerId, siteId } = action.payload || {};
      const title = `Player ${playerId + 1} Sold`;
      const message = `Sold building on site ${siteId}`;
      const entry = { id: Date.now() + Math.random(), time: formatTime(), title, message, kind: 'sell' };
      return {
        ...state,
        show: true,
        title,
        message,
        amount: null,
        kind: 'sell',
        tier: 'big',
        logHistory: [entry, ...(state.logHistory || [])].slice(0, 100),
      };
    }
    case MOVE_PLAYER: {
      const { playerId, currentSite, suppressNotification } = action.payload || {};
      if (suppressNotification) return state;
      const title = `Player ${playerId + 1} Moved`;
      const message = `Moved to space ${currentSite}`;
      const entry = { id: Date.now() + Math.random(), time: formatTime(), title, message, kind: 'move' };
      return {
        ...state,
        show: true,
        title,
        message,
        amount: null,
        kind: 'move',
        tier: 'big',
        logHistory: [entry, ...(state.logHistory || [])].slice(0, 100),
      };
    }
    default:
      return state;
  }
}
