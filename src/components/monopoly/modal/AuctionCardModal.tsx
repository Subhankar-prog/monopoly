import style from '../../../assets/css/auction-card-modal.module.scss';
import CardModal from './CardModal';
import { connect } from 'react-redux';
import { useEffect, useRef, useState } from 'react';
import { debitPlayerMoney } from '../../../redux/actions/player';
import { setIsDone } from '../../../redux/actions/board';
import { setShowModal } from '../../../redux/actions/modal';
import { buySite } from '../../../redux/actions/site';
import { emitPlaceBid, emitFoldAuction } from '../../../network/socket';

const BID = 'BID';
const FOLD = 'FOLD';

const playerLabel = (players, id) => players[id]?.name || `Player ${id + 1}`;

const AuctionCardModal = ({
  sites,
  card,
  totalPlayers,
  activePlayer,
  players,
  debitPlayerMoney,
  setShowModal,
  buySite,
  setIsDone,
  network,
  currentAuction,
}) => {
  const isMultiplayer = network.isMultiplayer;

  // ── Local (single-player / vs bots) auction state ────────────────────────
  const [playersFoldStatus, setPlayersFoldStatus] = useState<boolean[]>(
    Array(totalPlayers).fill(false)
  );
  const [biddingHistory, setBiddingHistory] = useState<string[]>([]);
  const [activeBidder, setActiveBidder] = useState<number>(activePlayer);
  const [lastBid, setLastBid] = useState<{ playerId: number | null; bidAmount: number }>({
    playerId: null,
    bidAmount: 0,
  });
  const [currentBidAmount, setCurrentBidAmount] = useState<number>(1);

  // Sync input value whenever high bid changes or active bidder changes
  useEffect(() => {
    if (!isMultiplayer) {
      setCurrentBidAmount(lastBid.bidAmount + 1);
    }
  }, [activeBidder, lastBid.bidAmount, isMultiplayer]);

  const addBiddingHistory = (playerId: number, action: string, amount?: number) => {
    const name = players[playerId]?.name || `Player ${playerId + 1}`;
    const statement = action === BID ? `${name} bids $${amount}` : `${name} folded`;
    setBiddingHistory(prev => [...prev, statement]);
  };

  const getUnfoldedPlayers = (folds = playersFoldStatus) => {
    const list: number[] = [];
    for (let i = 0; i < totalPlayers; i++) {
      if (!folds[i] && players[i] && players[i].money > 0) {
        list.push(i);
      }
    }
    return list;
  };

  const advanceLocalAuction = (nextFolds: boolean[], newLastBid: { playerId: number | null; bidAmount: number }) => {
    const activeList = getUnfoldedPlayers(nextFolds);

    if (activeList.length === 0) {
      if (newLastBid.playerId !== null) {
        wonAuctionLocal(newLastBid.playerId, newLastBid.bidAmount);
      } else {
        closeAuctionUnsold();
      }
    } else if (activeList.length === 1) {
      // If only 1 player remains and they are already the high bidder, they win!
      if (newLastBid.playerId === activeList[0]) {
        wonAuctionLocal(newLastBid.playerId, newLastBid.bidAmount);
      } else {
        // High bidder hasn't been established yet (e.g. everyone folded before them)
        // Give them a turn to bid or fold
        setActiveBidder(activeList[0]);
      }
    } else {
      // Move to next player in activeList after current activeBidder
      let nextIndex = activeList.find(id => id > activeBidder);
      if (nextIndex === undefined) nextIndex = activeList[0];
      setActiveBidder(nextIndex);
    }
  };

  const onBid = () => {
    const bidVal = Number(currentBidAmount);
    if (!bidVal || bidVal <= lastBid.bidAmount || bidVal > (players[activeBidder]?.money || 0)) {
      setCurrentBidAmount(lastBid.bidAmount + 1);
      return;
    }

    const newLastBid = { playerId: activeBidder, bidAmount: bidVal };
    setLastBid(newLastBid);
    addBiddingHistory(activeBidder, BID, bidVal);
    advanceLocalAuction(playersFoldStatus, newLastBid);
  };

  const onFold = () => {
    const nextFolds = [...playersFoldStatus];
    nextFolds[activeBidder] = true;
    setPlayersFoldStatus(nextFolds);
    addBiddingHistory(activeBidder, FOLD);
    advanceLocalAuction(nextFolds, lastBid);
  };

  const onBidAmountChange = (e: any) => {
    const val = parseInt(e.target.value, 10);
    setCurrentBidAmount(isNaN(val) ? lastBid.bidAmount + 1 : val);
  };

  const wonAuctionLocal = (playerId: number, amount: number) => {
    debitPlayerMoney(playerId, amount);
    buySite(playerId, sites[card]);
    setIsDone(true);
    setShowModal(false, null);
  };

  const closeAuctionUnsold = () => {
    setIsDone(true);
    setShowModal(false, null);
  };

  // Bot auto-fold timer for local auction
  const botFoldTimerRef = useRef<any>(null);
  useEffect(() => {
    if (isMultiplayer) return;
    if (!players[activeBidder]?.isBot) return;
    botFoldTimerRef.current = setTimeout(() => {
      onFold();
    }, 700);
    return () => clearTimeout(botFoldTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBidder, isMultiplayer, playersFoldStatus]);

  // ── Multiplayer bid/fold ─────────────────────────────────────────────────
  const [mpBidAmount, setMpBidAmount] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isMultiplayer && currentAuction) {
      setMpBidAmount(currentAuction.currentBid + 1);
    }
  }, [currentAuction?.currentBid, isMultiplayer, currentAuction]);

  const doPlaceBid = async () => {
    if (busy || !currentAuction) return;
    setBusy(true);
    const targetBid = Math.max(mpBidAmount, currentAuction.currentBid + 1);
    try {
      await emitPlaceBid(network.roomCode, targetBid);
    } catch (err) {
      console.error('[Auction] bid failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const doFold = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await emitFoldAuction(network.roomCode);
    } catch (err) {
      console.error('[Auction] fold failed:', err);
    } finally {
      setBusy(false);
    }
  };

  if (isMultiplayer) {
    if (!currentAuction) return null; // resolved / closing
    const siteId = currentAuction.siteId;
    const isMyTurn = network.myPlayerId === currentAuction.activeBidderId;
    const activeBidderPlayer = players[currentAuction.activeBidderId];
    const minBid = currentAuction.currentBid + 1;

    return (
      <div className={`${style.auction} ${style.row}`}>
        <CardModal card={sites[siteId]} />
        <div className={`${style.auctionDetails}`}>
          <div>
            <p className={style.heading}>Action</p>
            <ul className={style.biddingHistory}>
              {currentAuction.history.slice(-totalPlayers).map((item: any, index: number) => (
                <li key={index}>
                  {playerLabel(players, item.playerId)}{' '}
                  {item.action === 'bid' ? `bids $${item.amount}` : 'folded'}
                </li>
              ))}
              <li>
                {isMyTurn
                  ? "It's your turn to bid"
                  : `Waiting for ${playerLabel(players, currentAuction.activeBidderId)} to bid...`}
              </li>
            </ul>
          </div>
          <div>
            <p className={style.bidAmount}>
              <label htmlFor="mpBidAmount">Bid Amount:</label>
              <span className={style.bgWhite}>$</span>
              <input
                id="mpBidAmount"
                type="number"
                min={minBid}
                value={mpBidAmount < minBid ? minBid : mpBidAmount}
                onChange={e => setMpBidAmount(parseInt(e.target.value, 10) || minBid)}
                disabled={!isMyTurn || busy}
              />
            </p>
            <p className={style.playerMoney}>
              Current bid: <b>${currentAuction.currentBid}</b>
              {currentAuction.highBidderId !== null && (
                <> — high bidder: {playerLabel(players, currentAuction.highBidderId)}</>
              )}
            </p>
            <p className={style.playerMoney}>
              {activeBidderPlayer && `${activeBidderPlayer.name}'s money: $${activeBidderPlayer.money}`}
            </p>
            <div className={`${style.btnContainer} ${style.row}`}>
              <button
                className={`${style.btn} ${style.bid}`}
                onClick={doPlaceBid}
                disabled={!isMyTurn || busy}
              >
                Bid
              </button>
              <button
                className={`${style.btn} ${style.fold}`}
                onClick={doFold}
                disabled={!isMyTurn || busy}
              >
                Fold
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Single-player / vs bots: local hotseat auction (unchanged) ──────────
  return (
    <div className={`${style.auction} ${style.row}`}>
      <CardModal card={sites[card]} />

      <div className={`${style.auctionDetails}`}>
        <div>
          <p className={`${style.heading}`}>Action</p>
          <ul className={`${style.biddingHistory}`}>
            {biddingHistory.length < totalPlayers
              ? biddingHistory.map((item, index) => <li key={index}>{item}</li>)
              : biddingHistory
                .slice(-totalPlayers)
                .map((item, index) => <li key={index}>{item}</li>)}
            <li>{players[activeBidder]?.name || `Player ${activeBidder + 1}`} is bidding...</li>
          </ul>
        </div>
        <div>
          <p className={style.bidAmount}>
            <label htmlFor="currentBidAmount">Bid Amount:</label>
            <span className={style.bgWhite}>$</span>
            <input
              id="currentBidAmount"
              type="number"
              value={currentBidAmount}
              onChange={onBidAmountChange}
            />
          </p>
          <p className={style.playerMoney}>
            Money:{' '}
            <del className={style.actualMoney}>
              ${players[activeBidder].money}
            </del>
            <ins className={style.moneyAfterBidDeuction}>
              $
              {players[activeBidder].money -
                (currentBidAmount ? currentBidAmount : 0)}
            </ins>
          </p>
          <div className={`${style.btnContainer} ${style.row}`}>
            <button className={`${style.btn} ${style.bid}`} onClick={onBid}>
              Bid
            </button>
            <button className={`${style.btn} ${style.fold}`} onClick={onFold}>
              Fold
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const mapStateToProps = store => {
  return {
    sites: store.siteData.sites,
    totalPlayers: store.playersData.totalPlayers,
    activePlayer: store.playersData.activePlayer,
    players: store.playersData.players,
    network: store.network,
    currentAuction: store.currentAuction,
  };
};

const mapDispatchToProps = dispatch => {
  return {
    debitPlayerMoney: (playerId, amount) =>
      dispatch(debitPlayerMoney(playerId, amount)),
    setShowModal: (showModal, currentModal) =>
      dispatch(setShowModal(showModal, currentModal)),
    buySite: (playerId, siteData) => dispatch(buySite(playerId, siteData)),
    setIsDone: isDone => dispatch(setIsDone(isDone)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(AuctionCardModal);