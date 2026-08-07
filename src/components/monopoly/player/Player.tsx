import { useEffect, useRef, useMemo, useCallback } from 'react';
import style from '../../../assets/css/player.module.scss';
import { connect } from 'react-redux';
import {
  creditPlayerMoney,
  debitPlayerMoney,
  movePlayer,
  setIsMoving,
} from '../../../redux/actions/player';
import { showNotification } from '../../../redux/actions/notification';
import audio1 from '../../../assets/audio/playermove.wav';
import { setShowModal } from '../../../redux/actions/modal';
import { directions, cardTypes, modalTypes } from '../../../utility/constants';
import * as board from '../../../redux/actions/board';
import { calcFullPath } from '../../../utility/playerUtility';
import { setPlayerPositionRecursiveHelper } from '../../../utility/player/playerPositionUtility';
import { appropriateActionHelper } from '../../../utility/player/playerAppropriateActionUtils';
import { emitPlayerFinishedMoving } from '../../../network/socket';
import { setCurrentCard } from '../../../redux/actions/card';

function Player({
  playersData,
  diceSum,
  movePlayer,
  board,
  setDiceSumCalledCount,
  color,
  currentPlayerId,
  setShowModal,
  siteData,
  setIsDone,
  debitPlayerMoney,
  creditPlayerMoney,
  setIsMoving,
  noOfCardsInCategory,
  network,
  setCurrentCard,
  showNotification,
  notification,
}: any) {
  const playerRef = useRef(null);
  const isMountedRef = useRef(false);
  const playerMoveAudio = useMemo(() => new Audio(audio1), []);
  const siteDataRef = useRef(siteData);
  const positionsRef = useRef(board.positions);
  const playersDataRef = useRef(playersData);
  const currentPlayerRef = useRef<any>(null);
  const diceSumRef = useRef(diceSum);
  const isMoving = playersData.players[currentPlayerId].isMoving;

  // ── Pending move queue ──────────────────────────────────────────────────
  // pendingMoveRef holds the next move that should only execute after the
  // overlay we explicitly showed (via showNotification) is dismissed.
  // waitingForOwnNotifRef is set TRUE only when THIS component called
  // showNotification for a pending move, and is cleared after the first
  // true→false transition.  This prevents ANY other notification closing
  // (e.g. Player 1's BUY_SITE auto-dismiss firing during Player 2's turn)
  // from accidentally triggering the wrong player's token movement.
  const pendingMoveRef = useRef<{ playerId: number; site: number; direction: any } | null>(null);
  const waitingForOwnNotifRef = useRef(false);
  const notifWasShowingRef = useRef(false);

  // ── appropriateAction ───────────────────────────────────────────────────
  const appropriateAction = useCallback(() => {
    const currentSiteId = currentPlayerRef.current.site;
    const currentSite = siteDataRef.current.sites[currentSiteId];
    const { activePlayer, totalPlayers } = playersDataRef.current;

    if (network.isMultiplayer) {
      if (
        currentSite.type === cardTypes.SITE ||
        currentSite.type === cardTypes.REALM_RAILS ||
        currentSite.type === cardTypes.UTILITY
      ) {
        if (!siteDataRef.current.boughtSites.includes(currentSite.id)) {
          if (currentSite.sellingPrice <= currentPlayerRef.current.money) {
            setShowModal(true, modalTypes.BUY_CARD);
          }
        }
      }
    } else {
      // setPendingMove: queues a jail move and arms the watcher.
      // Called by ifCurrentSiteIsOfTypeIsSpecial AFTER showing jail notification.
      const setPendingMove = (pid: number, site: number, dir: string) => {
        pendingMoveRef.current = { playerId: pid, site, direction: dir };
        waitingForOwnNotifRef.current = true;
      };

      appropriateActionHelper(
        currentSite,
        currentPlayerRef.current,
        activePlayer,
        totalPlayers,
        siteDataRef.current,
        diceSumRef.current,
        noOfCardsInCategory,
        debitPlayerMoney,
        creditPlayerMoney,
        setIsDone,
        setShowModal,
        movePlayer,
        setCurrentCard,
        showNotification,
        setPendingMove
      );
    }
  }, [
    creditPlayerMoney,
    debitPlayerMoney,
    movePlayer,
    noOfCardsInCategory,
    setIsDone,
    setShowModal,
    network.isMultiplayer,
    showNotification,
    setCurrentCard,
  ]);

  const setPlayerPositionRecursive = useCallback(
    async (path: any) => {
      setPlayerPositionRecursiveHelper(
        path,
        positionsRef.current,
        playersDataRef.current.players,
        playersDataRef.current.totalPlayers,
        currentPlayerId,
        playerRef.current,
        playerMoveAudio,
        isMountedRef.current,
        setIsMoving
      );
    },
    [setIsMoving, currentPlayerId, playerMoveAudio]
  );

  // ── Dice roll effect ────────────────────────────────────────────────────
  // Store the move in pendingMoveRef and show the overlay first.
  // The token only moves after the overlay is explicitly dismissed.
  useEffect(() => {
    if (
      isMountedRef.current &&
      !network.isMultiplayer &&
      playersDataRef.current.activePlayer === currentPlayerId &&
      diceSum !== null &&
      diceSum !== undefined
    ) {
      const targetSite = (currentPlayerRef.current.site + diceSum) % 40;
      pendingMoveRef.current = {
        playerId: currentPlayerId,
        site: targetSite,
        direction: directions.FORWARD,
      };
      // Mark that THIS component is waiting for its own notification to close
      waitingForOwnNotifRef.current = true;
      showNotification({
        title: `Player ${currentPlayerId + 1} Moves`,
        message: `Rolling ${diceSum} — moving to position ${targetSite}`,
        kind: 'move',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diceSum, currentPlayerId, network.isMultiplayer, setDiceSumCalledCount]);

  // ── Notification-close watcher ─────────────────────────────────────────
  // Only fires the pending move when:
  //   1. The overlay just closed (true → false transition)
  //   2. waitingForOwnNotifRef is true  ← set only by THIS player's dice roll
  //   3. There IS a pending move queued
  // This prevents stale closes (e.g. Player 1's BUY_SITE auto-dismissing
  // during Player 2's turn) from firing the wrong player's token movement.
  useEffect(() => {
    const notifShowing = !!notification?.show;
    const justClosed = !notifShowing && notifWasShowingRef.current;

    if (
      isMountedRef.current &&
      justClosed &&
      waitingForOwnNotifRef.current &&
      pendingMoveRef.current !== null
    ) {
      const { playerId, site, direction } = pendingMoveRef.current;
      pendingMoveRef.current = null;
      waitingForOwnNotifRef.current = false;
      movePlayer(playerId, site, direction, true);
    }

    notifWasShowingRef.current = notifShowing;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification?.show]);

  // ── Token position animation ────────────────────────────────────────────
  useEffect(() => {
    if (isMoving || isMountedRef.current === false) {
      const playerData = network.isMultiplayer
        ? playersData.players[currentPlayerId]
        : playersDataRef.current.players[currentPlayerId];
      currentPlayerRef.current = playerData;
      const path = calcFullPath(
        playerData.previousSite,
        playerData.site,
        playerData.direction
      );
      setPlayerPositionRecursive(path);
    }
  }, [setPlayerPositionRecursive, currentPlayerId, isMoving, network.isMultiplayer, playersData]);

  const hasMovedRef = useRef(false);

  useEffect(() => {
    if (isMoving) {
      hasMovedRef.current = true;
    }
  }, [isMoving]);

  // ── Post-move actions (rent, buy modal, jail, etc.) ─────────────────────
  useEffect(() => {
    const activePlayer = network.isMultiplayer
      ? playersData.activePlayer
      : playersDataRef.current.activePlayer;

    if (
      isMountedRef.current &&
      isMoving === false &&
      hasMovedRef.current &&
      activePlayer === currentPlayerId
    ) {
      hasMovedRef.current = false;

      if (network.isMultiplayer && network.roomCode) {
        if (network.myPlayerId === currentPlayerId) {
          emitPlayerFinishedMoving(network.roomCode)
            .then(() => appropriateAction())
            .catch(() => appropriateAction());
        }
      } else {
        appropriateAction();
      }
    } else if (isMountedRef.current === false) {
      isMountedRef.current = true;
    }
  }, [isMoving, appropriateAction, currentPlayerId, network.isMultiplayer, network.roomCode, network.myPlayerId, playersData.activePlayer]);

  useEffect(() => {
    siteDataRef.current = siteData;
    playersDataRef.current = playersData;
    diceSumRef.current = diceSum;
  }, [playersData, siteData, diceSum]);

  const playerState = playersData.players[currentPlayerId];
  const initial = playerState?.name ? playerState.name.substring(0, 2).toUpperCase() : `${currentPlayerId + 1}`;
  const isActive = playersData.activePlayer === currentPlayerId;

  return (
    <div className={`${style.player} player-${color} ${isActive ? style.activeToken : ''}`} ref={playerRef}>
      <RenderTokenShape playerId={currentPlayerId} initial={initial} colorName={color} isActive={isActive} />
    </div>
  );
}

const COLOR_MAP: Record<string, string> = {
  red: '#C13828',
  yellow: '#D4AF37',
  blue: '#1F618D',
  green: '#1E8449',
  orange: '#D35400',
  pink: '#8E44AD',
};

function RenderTokenShape({ playerId, initial, colorName, isActive }: { playerId: number; initial: string; colorName: string; isActive: boolean }) {
  const mainColor = COLOR_MAP[colorName] || '#C13828';

  return (
    <svg viewBox="0 0 40 50" className={style.tokenSvg}>
      <defs>
        <linearGradient id={`manGrad-${playerId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF4CC" />
          <stop offset="30%" stopColor={mainColor} />
          <stop offset="100%" stopColor="#240302" />
        </linearGradient>
        <linearGradient id={`goldTrim-${playerId}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFE89C" />
          <stop offset="50%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#8A5A10" />
        </linearGradient>
        <filter id={`shadow-${playerId}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#000" floodOpacity="0.6" />
        </filter>
      </defs>

      {/* Pedestal Base */}
      <ellipse cx="20" cy="45" rx="16" ry="4.5" fill={`url(#goldTrim-${playerId})`} />
      <ellipse cx="20" cy="43" rx="14" ry="3.8" fill={`url(#manGrad-${playerId})`} stroke="#FFE89C" strokeWidth="0.8" />

      {/* Standing Legs */}
      <path d="M14,31 L15,42 L18,42 L18,31 Z" fill={`url(#manGrad-${playerId})`} stroke="#8A5A10" strokeWidth="0.5" />
      <path d="M22,31 L22,42 L25,42 L26,31 Z" fill={`url(#manGrad-${playerId})`} stroke="#8A5A10" strokeWidth="0.5" />

      {/* Torso / Kurta Coat */}
      <path
        d="M11,18 C11,14 15,12 20,12 C25,12 29,14 29,18 L27,32 L13,32 Z"
        fill={`url(#manGrad-${playerId})`}
        stroke={`url(#goldTrim-${playerId})`}
        strokeWidth="1.5"
        filter={`url(#shadow-${playerId})`}
      />

      {/* Sambalpuri Sash / Shoulder Collar */}
      <path d="M11,18 C14,16 26,16 29,18 C28,21 12,21 11,18 Z" fill={`url(#goldTrim-${playerId})`} />

      {/* Head / Turban Cap */}
      <circle cx="20" cy="7.5" r="5.8" fill={`url(#manGrad-${playerId})`} stroke={`url(#goldTrim-${playerId})`} strokeWidth="1.4" />
      <path d="M15,6.5 C17,4.5 23,4.5 25,6.5" stroke="#FFE89C" strokeWidth="1" fill="none" />

      {/* Initial Badge on Torso */}
      <circle cx="20" cy="24" r="5.2" fill="#180302" stroke="#FFD700" strokeWidth="1" />
      <text x="20" y="24.8" className={style.tokenLabel}>
        {initial}
      </text>
    </svg>
  );
}

const mapStateToProps = (store: any) => {
  return {
    playersData: store.playersData,
    diceSum: store.dice.diceSum,
    setDiceSumCalledCount: store.dice.setDiceSumCalledCount,
    board: store.board,
    siteData: store.siteData,
    noOfCardsInCategory: store.siteData.noOfCardsInCategory,
    network: store.network,
    notification: store.notification,  // needed to watch overlay open/close
  };
};

const mapDispatchToProps = (dispatch: any) => {
  return {
    movePlayer: (playerId: any, currentSite: any, direction: any, suppressNotification: any) =>
      dispatch(movePlayer(playerId, currentSite, direction, suppressNotification)),
    setShowModal: (showModal: any, currentModal: any) =>
      dispatch(setShowModal(showModal, currentModal)),
    setIsDone: (isDone: any) => dispatch(board.setIsDone(isDone)),
    debitPlayerMoney: (playerId: any, amount: any) =>
      dispatch(debitPlayerMoney(playerId, amount)),
    creditPlayerMoney: (playerId: any, amount: any) =>
      dispatch(creditPlayerMoney(playerId, amount)),
    setIsMoving: (playerId: any, isMoving: any) =>
      dispatch(setIsMoving(playerId, isMoving)),
    setCurrentCard: (cardData: any) => dispatch(setCurrentCard(cardData)),
    showNotification: (data: any) => dispatch(showNotification(data)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Player);
