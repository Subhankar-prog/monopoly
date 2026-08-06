import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { useParams, useSearchParams } from 'react-router-dom';
import CardModal from './modal/CardModal';
import ModalContainer from './modal/ModalCotainer';
import Board from './board/Board';
import style from '../../assets/css/monopoly.module.scss';
import Footer from '../home/footer/Footer';
import BuyCardModal from './modal/BuyCardModal';
import ChanceCardModal from './modal/ChanceCardModal';
import ActionNotifier from './ActionNotifier';
import { showNotification } from '../../redux/actions/notification';
import { modalTypes } from '../../utility/constants';
import AuctionCardModal from './modal/AuctionCardModal';
import TradeModal from './modal/TradeModal';
import GameOverOverlay from './GameOverOverlay';
import {
  calculateSitePositions,
  setBoardSize,
} from '../../redux/actions/board';
import { setTotalPlayers } from '../../redux/actions/player';
import { setSites } from '../../redux/actions/site';
import sites from '../../assets/data/boardData.json';
import MyCards from './modal/MyCards';
import ActionLogModal from './modal/ActionLogModal';
import {
  connectToServer,
  rejoinRoom as rejoinRoomSocket,
} from '../../network/socket';
import { setupGameSync, setEventOverlayBaseline } from '../../network/gameSync';
import { SYNC_GAME_STATE } from '../../redux/actions/actionTypes';
import {
  setRoomCode,
  setMyPlayerId,
  setConnected,
  setIsHost,
  setRoomPlayers,
  setIsMultiplayer,
} from '../../redux/actions/network';

const Monopoly = ({
  modalData,
  currentCard,
  playersData,
  setBoardSize,
  calculateSitePositions,
  setTotalPlayers,
  setSites,
  network,
  dispatchRoomCode,
  dispatchPlayerId,
  dispatchConnected,
  dispatchIsHost,
  dispatchRoomPlayers,
  dispatchIsMultiplayer,
  dispatchSyncGameState,
  showNotification,
}: any) => {
  const { roomCode } = useParams();
  const [searchParams] = useSearchParams();
  const botCount = Math.max(0, Math.min(5, parseInt(searchParams.get('bots') || '0', 10) || 0));
  const isMultiplayer = !!roomCode && network.isMultiplayer;
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const updateSize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const side = Math.max(340, Math.min(w - 20, h - 40, 720));
      const boardData = {
        side: side,
        rowWidth: Math.max(65, Math.floor(side * 0.21)),
      };
      setBoardSize(boardData);
      calculateSitePositions(boardData);
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    const checkAutoReconnect = async () => {
      if (roomCode && !network.isMultiplayer) {
        const savedName = sessionStorage.getItem('playerName');
        const savedCode = sessionStorage.getItem('roomCode');
        if (savedName && savedCode === roomCode) {
          try {
            await connectToServer();
            dispatchConnected(true);
            setupGameSync();
            const result = await rejoinRoomSocket(roomCode, savedName);
            dispatchRoomCode(result.roomCode);
            dispatchPlayerId(result.playerId);
            dispatchIsHost(false);
            dispatchRoomPlayers(result.players);
            dispatchIsMultiplayer(true);

            if (result.gameState) {
              setEventOverlayBaseline(result.gameState);
              dispatchSyncGameState(result.gameState);
            }
            setIsMounted(true);
            return;
          } catch (err) {
            console.error('[Auto-Reconnect] Failed:', err);
          }
        }
      }

      if (!isMultiplayer) {
        const totalPlayers = botCount > 0 ? botCount + 1 : 2;
        setTotalPlayers(totalPlayers, botCount);
        setSites([...sites]);
      } else {
        if (!playersData.totalPlayers) {
          setSites([...sites]);
        }
      }
      setIsMounted(true);
    };

    checkAutoReconnect();
    return () => window.removeEventListener('resize', updateSize);
  }, [setBoardSize, calculateSitePositions, setTotalPlayers, setSites, isMultiplayer, roomCode, network.isMultiplayer, botCount]);

  return (
    <>
      {isMounted && (
        <div className={style.monopoly}>
          {isMultiplayer && network.myPlayerId !== null && (
            <div style={{
              textAlign: 'center',
              padding: '6px 12px',
              background: 'rgba(74, 12, 10, 0.9)',
              color: '#ffd700',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderBottom: '1px solid rgba(212,175,55,0.4)',
            }}>
              Room: {roomCode} • You are {playersData.players[network.myPlayerId]?.name || `Player ${network.myPlayerId + 1}`}
              {playersData.activePlayer === network.myPlayerId
                ? ' • 🎲 Your Turn!'
                : ` • Waiting for ${playersData.players[playersData.activePlayer]?.name || `Player ${playersData.activePlayer + 1}`}...`}
            </div>
          )}
          <Board />
          <ActionNotifier />
          <GameOverOverlay />
          {modalData.showModal && (
            <>
              {modalData.currentModal === modalTypes.SHOW_CARD && (
                <ModalContainer component={CardModal} card={currentCard} />
              )}
              {modalData.currentModal === modalTypes.CHANCE_CARD && (
                <ModalContainer component={ChanceCardModal} />
              )}
              {modalData.currentModal === modalTypes.BUY_CARD && (
                <ModalContainer
                  component={BuyCardModal}
                  card={playersData.players[playersData.activePlayer]?.site}
                  disableHideOnOuterClick={true}
                />
              )}
              {modalData.currentModal === modalTypes.AUCTION_CARD && (
                <ModalContainer
                  component={AuctionCardModal}
                  card={playersData.players[playersData.activePlayer]?.site}
                  disableHideOnOuterClick={true}
                />
              )}
              {modalData.currentModal === modalTypes.MY_CARDS && (
                <ModalContainer component={MyCards} title={'My Cards'} />
              )}
              {modalData.currentModal === modalTypes.TRADE && (
                <ModalContainer component={TradeModal} title={'Propose a Trade'} />
              )}
              {modalData.currentModal === 'ACTION_LOG' && (
                <ModalContainer component={ActionLogModal} title={'📜 Game Action Log'} />
              )}
            </>
          )}
          <Footer />
        </div>
      )}
    </>
  );
};

const mapDispatchToProps = (dispatch: any) => {
  return {
    setBoardSize: (data: any) => dispatch(setBoardSize(data)),
    calculateSitePositions: (data: any) => dispatch(calculateSitePositions(data)),
    setTotalPlayers: (totalPlayers: any, botCount: any) => dispatch(setTotalPlayers(totalPlayers, botCount)),
    setSites: (data: any) => dispatch(setSites(data)),
    dispatchRoomCode: (code: any) => dispatch(setRoomCode(code)),
    dispatchPlayerId: (id: any) => dispatch(setMyPlayerId(id)),
    dispatchConnected: (v: any) => dispatch(setConnected(v)),
    dispatchIsHost: (v: any) => dispatch(setIsHost(v)),
    dispatchRoomPlayers: (p: any) => dispatch(setRoomPlayers(p)),
    dispatchIsMultiplayer: (v: any) => dispatch(setIsMultiplayer(v)),
    dispatchSyncGameState: (gs: any) => dispatch({
      type: SYNC_GAME_STATE,
      payload: { gameState: gs, actionRequired: null },
    }),
    showNotification: (data: any) => dispatch(showNotification(data)),
  };
};

const mapStateToProps = (store: any) => {
  return {
    modalData: store.modalData,
    currentCard: store.card.currentCard,
    playersData: store.playersData,
    network: store.network,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Monopoly);
