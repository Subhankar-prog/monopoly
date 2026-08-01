import { useEffect, useRef } from 'react';
import { connect } from 'react-redux';
import { rollDice } from '../../../redux/actions/dice';
import { setActivePlayer, debitPlayerMoney } from '../../../redux/actions/player';
import { setIsDone } from '../../../redux/actions/board';
import { setShowModal } from '../../../redux/actions/modal';
import { buySite } from '../../../redux/actions/site';
import { modalTypes } from '../../../utility/constants';

const THINK_DELAY = 900; // ms — minimum gap between bot actions, for a visible "thinking" pace
const POLL_INTERVAL = 250; // ms — how often the bot checks whether it's time to act

/**
 * Drives bot-controlled players' turns in local (offline, non-multiplayer)
 * games by dispatching the exact same Redux actions a human clicking the UI
 * would. Only active when it's a bot's turn — human turns are untouched.
 *
 * Built as a single persistent poll loop (mounted once) rather than a
 * dependency-driven one-shot delayed effect: an earlier version re-armed a
 * fresh `setTimeout` on every dependency change and cancelled the in-flight
 * one, which meant a state change arriving mid-delay (landing on a tile,
 * opening a modal, etc.) could cancel the bot's action before it ever fired,
 * repeatedly, with nothing left to reschedule it. Polling on a fixed
 * interval and reading fresh state from a ref every tick sidesteps that
 * whole class of race entirely — there's always another tick coming.
 *
 * Simple heuristic AI: always rolls when able, always buys an offered
 * property if it can afford it (never voluntarily auctions), and always
 * ends its turn once done. It doesn't proactively build, mortgage, or
 * trade — see CHANGES.md for the full list of what this bot does and
 * doesn't do.
 */
const BotController = ({
  isMultiplayer,
  activePlayer,
  players,
  isDone,
  isMoving,
  showModal,
  currentModal,
  sites,
  dispatchRollDice,
  dispatchBuy,
  dispatchEndTurn,
}) => {
  const stateRef = useRef<any>({});
  stateRef.current = {
    isMultiplayer,
    activePlayer,
    players,
    isDone,
    isMoving,
    showModal,
    currentModal,
    sites,
  };

  const lastActionAtRef = useRef(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const s = stateRef.current;
      if (s.isMultiplayer) return;
      if (inFlightRef.current) return;

      const bot = s.players[s.activePlayer];
      if (!bot || !bot.isBot || bot.isBankrupt) return;
      if (s.isMoving) return;
      if (Date.now() - lastActionAtRef.current < THINK_DELAY) return;

      let action = null;
      if (s.showModal && s.currentModal === modalTypes.BUY_CARD) {
        action = () => dispatchBuy(bot.playerId, s.sites[bot.site]);
      } else if (s.showModal && s.currentModal === modalTypes.AUCTION_CARD) {
        // Handled inside AuctionCardModal itself (auto-folds for bots).
      } else if (s.showModal) {
        // Some other modal (Chance/Chest, My Cards, etc.) resolves on its
        // own timer or isn't blocking — nothing for the bot to do.
      } else if (!s.isDone) {
        action = () => dispatchRollDice();
      } else if (s.isDone) {
        action = () => dispatchEndTurn();
      }

      if (action) {
        inFlightRef.current = true;
        lastActionAtRef.current = Date.now();
        action();
        // Release the in-flight guard shortly after — long enough that the
        // dispatch's resulting re-render has definitely landed, short
        // enough that the next legitimate action isn't held up by it.
        setTimeout(() => {
          inFlightRef.current = false;
        }, 60);
      }
    };

    const interval = setInterval(tick, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [dispatchRollDice, dispatchBuy, dispatchEndTurn]);

  return null;
};

const mapStateToProps = (store: any) => ({
  isMultiplayer: store.network.isMultiplayer,
  activePlayer: store.playersData.activePlayer,
  players: store.playersData.players,
  isDone: store.board.isDone,
  isMoving: store.playersData.players[store.playersData.activePlayer]?.isMoving || false,
  showModal: store.modalData.showModal,
  currentModal: store.modalData.currentModal,
  sites: store.siteData.sites,
});

const mapDispatchToProps = (dispatch: any) => ({
  dispatchRollDice: () => {
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    dispatch(rollDice({ dice1, dice2 }));
  },
  dispatchBuy: (playerId: number, site: any) => {
    dispatch(debitPlayerMoney(playerId, site.sellingPrice, null, true));
    dispatch(buySite(playerId, site));
    dispatch(setIsDone(true));
    dispatch(setShowModal(false, null));
  },
  dispatchEndTurn: () => {
    dispatch(setActivePlayer());
    dispatch(setIsDone(false));
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(BotController);
