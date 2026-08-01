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
}) {
  const playerRef = useRef(null); // Player <div> reference
  const isMountedRef = useRef(false); // To check if the component has mounted or not
  const playerMoveAudio = useMemo(() => new Audio(audio1), []);
  const siteDataRef = useRef(siteData);
  const positionsRef = useRef(board.positions);
  const playersDataRef = useRef(playersData);
  const currentPlayerRef = useRef(null);
  const diceSumRef = useRef(diceSum);
  const isMoving = playersData.players[currentPlayerId].isMoving;

  // To show appropriate modal or do appropriate action
  const appropriateAction = useCallback(() => {
    const currentSiteId = currentPlayerRef.current.site;
    const currentSite = siteDataRef.current.sites[currentSiteId];
    const { activePlayer, totalPlayers } = playersDataRef.current;

    if (network.isMultiplayer) {
      // In multiplayer, server already handled money changes (rent, tax, jail, chest/chance)
      // via playerFinishedMoving + SYNC_GAME_STATE. We only need to show modals locally.
      if (
        currentSite.type === cardTypes.SITE ||
        currentSite.type === cardTypes.REALM_RAILS ||
        currentSite.type === cardTypes.UTILITY
      ) {
        if (!siteDataRef.current.boughtSites.includes(currentSite.id)) {
          if (currentSite.sellingPrice <= currentPlayerRef.current.money) {
            setShowModal(true, modalTypes.BUY_CARD);
          }
          // If unaffordable, the server starts an auction and every client
          // (including this one) picks it up via AuctionWatcher, which is
          // always mounted and reacts to the synced `currentAuction` state —
          // that way ALL players see the auction, not just whoever landed.
        }
        // If already bought (rent case), server already set isDone via SYNC
      }
      // For special/tax/chest/chance — server already handled everything via SYNC
    } else {
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
        showNotification
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
  ]);

  // To move player when there are multple turns
  const setPlayerPositionRecursive = useCallback(
    async path => {
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

  // Update active players position in redux on dice roll
  // In multiplayer: server already calculated position via SYNC_GAME_STATE, skip local calc
  useEffect(() => {
    if (
      isMountedRef.current &&
      !network.isMultiplayer &&
      playersDataRef.current.activePlayer === currentPlayerId &&
      diceSum !== null &&
      diceSum !== undefined
    ) {
      console.log(
        'useEffect1 ID(Update activePlayer postion in redux) Player' +
          currentPlayerId
      );
      const currentSite = (currentPlayerRef.current.site + diceSum) % 40;
      movePlayer(currentPlayerId, currentSite, directions.FORWARD, true);
    }
  }, [diceSum, currentPlayerId, movePlayer, setDiceSumCalledCount, network.isMultiplayer]); // Adding 'setDiceSumCalledCount' because if previous 'diceSUm' is equal to current 'diceSum' it does not get called

  // To move player(actually move player on board in UI[Brower Window])
  useEffect(() => {
    if (isMoving || isMountedRef.current === false) {
      // In multiplayer, use props directly (refs may be stale since SYNC updates all at once)
      const playerData = network.isMultiplayer
        ? playersData.players[currentPlayerId]
        : playersDataRef.current.players[currentPlayerId];
      currentPlayerRef.current = playerData;
      const path = calcFullPath(
        playerData.previousSite,
        playerData.site,
        playerData.direction
      );
      console.log(`useEffect2(Move Player In UI) Player${currentPlayerId}`,
        'from', playerData.previousSite, 'to', playerData.site, 'path', path);
      setPlayerPositionRecursive(path);
    }
  }, [setPlayerPositionRecursive, currentPlayerId, isMoving, network.isMultiplayer, playersData]);

  const hasMovedRef = useRef(false);

  // Track when movement starts
  useEffect(() => {
    if (isMoving) {
      hasMovedRef.current = true;
    }
  }, [isMoving]);

  // Show Appropriate modal or do appropriate action
  useEffect(() => {
    // In multiplayer, use props for activePlayer check (refs may be stale)
    const activePlayer = network.isMultiplayer
      ? playersData.activePlayer
      : playersDataRef.current.activePlayer;

    if (
      isMountedRef.current &&
      isMoving === false &&
      hasMovedRef.current &&
      activePlayer === currentPlayerId
    ) {
      console.log(`useEffect3(Appropriate action) Player${currentPlayerId}`);
      hasMovedRef.current = false; // Reset hasMovedRef

      if (network.isMultiplayer && network.roomCode) {
        // Only the active player's OWN client should emit & take action
        if (network.myPlayerId === currentPlayerId) {
          emitPlayerFinishedMoving(network.roomCode)
            .then((res) => {
              console.log('[Multiplayer] Finished moving, actionRequired:', res.actionRequired);
              appropriateAction();
            })
            .catch((err) => {
              console.error('[Multiplayer] Failed to emit finished moving:', err);
              appropriateAction();
            });
        }
        // Non-active clients do nothing — server SYNC handles their state
      } else {
        appropriateAction();
      }
    } else if (isMountedRef.current === false) {
      isMountedRef.current = true;
    }
  }, [isMoving, appropriateAction, currentPlayerId, network.isMultiplayer, network.roomCode, network.myPlayerId, playersData.activePlayer]);

  // To update playersDataRef and siteDateRef
  useEffect(() => {
    siteDataRef.current = siteData;
    playersDataRef.current = playersData;
    diceSumRef.current = diceSum;
  }, [playersData, siteData, diceSum]);

  const playerState = playersData.players[currentPlayerId];
  const initial = playerState?.name ? playerState.name.substring(0, 2).toUpperCase() : currentPlayerId;

  return (
    <div className={`${style.player} player-${color}`} ref={playerRef}>
      {initial}
    </div>
  );
}
const mapStateToProps = store => {
  return {
    playersData: store.playersData,
    diceSum: store.dice.diceSum,
    setDiceSumCalledCount: store.dice.setDiceSumCalledCount,
    board: store.board,
    siteData: store.siteData,
    noOfCardsInCategory: store.siteData.noOfCardsInCategory,
    network: store.network,
  };
};

const mapDispatchToProps = dispatch => {
  return {
    movePlayer: (playerId, currentSite, direction, suppressNotification) =>
      dispatch(movePlayer(playerId, currentSite, direction, suppressNotification)),
    setShowModal: (showModal, currentModal) =>
      dispatch(setShowModal(showModal, currentModal)),
    setIsDone: isDone => dispatch(board.setIsDone(isDone)),
    debitPlayerMoney: (playerId, amount) =>
      dispatch(debitPlayerMoney(playerId, amount)),
    creditPlayerMoney: (playerId, amount) =>
      dispatch(creditPlayerMoney(playerId, amount)),
    setIsMoving: (playerId, isMoving) =>
      dispatch(setIsMoving(playerId, isMoving)),
    setCurrentCard: cardData => dispatch(setCurrentCard(cardData)),
    showNotification: data => dispatch(showNotification(data)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Player);
