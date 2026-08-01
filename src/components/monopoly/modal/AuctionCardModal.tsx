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
  const [playersFoldStatus, setPlayersFoldStatus] = useState(
    Array(totalPlayers).fill(false)
  );
  const [biddingHistory, setBiddingHistory] = useState([]);
  const [activeBidder, setActiveBidder] = useState(activePlayer);
  const [lastBid, setLastBid] = useState({
    playerId: null,
    bidAmount: 0,
  });
  const [currentBidAmount, setCurrentBidAmount] = useState(1);

  const genBiddingHistory = (playerId, action) => {
    let statement = '';
    if (action === BID)
      statement = `${players[playerId]?.name || `Player ${playerId + 1}`} bids $${currentBidAmount}`;
    else if (action === FOLD) statement = `${players[playerId]?.name || `Player ${playerId + 1}`} folded`;
    setBiddingHistory(previousHistory => {
      return [...previousHistory, statement];
    });
  };
  const onBid = () => {
    const isValid = validateBid();
    if (isValid) {
      setLastBid({
        playerId: activeBidder,
        bidAmount: currentBidAmount,
      });
      genBiddingHistory(activeBidder, BID);
      setCurrentBidAmountHelper(currentBidAmount + 1);
      const playersWhoCanBid = getPlayersWhoCanBid(activeBidder, BID);
      setActiveBidderHelper(playersWhoCanBid);
    }
  };

  const onFold = () => {
    genBiddingHistory(activeBidder, FOLD);
    const playersWhoCanBid = getPlayersWhoCanBid(activeBidder, FOLD);
    setActiveBidderHelper(playersWhoCanBid);
  };

  // Called When Bid Amount Changes
  const onBidAmountChange = e => {
    setCurrentBidAmountHelper(e.target.value);
  };

  // To Validate bid amount e.g., to ensure bid amount is greater than existing bid and less than the money user currenly have
  const validateBid = () => {
    if (
      currentBidAmount > lastBid.bidAmount &&
      currentBidAmount <= players[activeBidder].money
    )
      return true;
    else {
      setCurrentBidAmount(lastBid.bidAmount + 1);
      return false;
    }
  };

  // To ensure bid amount is of int type
  const setCurrentBidAmountHelper = bidAmount => {
    setCurrentBidAmount(parseInt(bidAmount));
  };

  // Set active bidder helper
  const setActiveBidderHelper = playersWhoCanBid => {
    if (playersWhoCanBid.length === 1) {
      wonAuctionLocal(playersWhoCanBid[0], currentBidAmount);
    } else if (playersWhoCanBid.length === 0) {
      if (lastBid.playerId !== null) {
        wonAuctionLocal(lastBid.playerId, lastBid.bidAmount);
      } else {
        closeAuctionUnsold();
      }
    } else {
      const nextBidder = getNextBidder(playersWhoCanBid);
      setActiveBidder(nextBidder);
    }
  };

  const getNextBidder = playersWhoCanBid => {
    for (let i = 1; i < totalPlayers; i++) {
      const next = (activeBidder + i) % totalPlayers;
      if (playersWhoCanBid.indexOf(next) !== -1) return next;
    }
  };

  const getPlayersWhoCanBid = (playerId, action) => {
    const _playersFoldStatus = [...playersFoldStatus];
    const playersWhoCanBid = [];

    if (action === FOLD) _playersFoldStatus[playerId] = true;

    for (let playerId = 0; playerId < totalPlayers; playerId++) {
      if (!checkIfPlayerCanBid(playerId, _playersFoldStatus)) {
        _playersFoldStatus[playerId] = true;
      } else {
        playersWhoCanBid.push(playerId);
      }
    }
    setPlayersFoldStatus(_playersFoldStatus);
    return playersWhoCanBid;
  };
  const checkIfPlayerCanBid = (playerId, _playersFoldStatus) => {
    if (
      _playersFoldStatus[playerId] === false &&
      players[playerId].money > currentBidAmount
    )
      return true;
    else return false;
  };
  const wonAuctionLocal = (playerId, amount) => {
    debitPlayerMoney(playerId, amount);
    buySite(playerId, sites[card]);
    setIsDone(true);
    setShowModal(false, null);
  };

  const closeAuctionUnsold = () => {
    setIsDone(true);
    setShowModal(false, null);
  };

  // If it's a bot's turn to act in this local hotseat auction, fold for
  // them automatically after a short delay — bots never win auctions, but
  // this keeps the auction from freezing waiting on a click that never
  // comes. (Real bidding logic only matters between humans; a bot always
  // folding is a deliberate, honest simplification, not a hidden strategy.)
  const botFoldTimerRef = useRef(null);
  useEffect(() => {
    if (isMultiplayer) return;
    if (!players[activeBidder]?.isBot) return;
    botFoldTimerRef.current = setTimeout(() => {
      onFold();
    }, 700);
    return () => clearTimeout(botFoldTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBidder, isMultiplayer]);

  // ── Multiplayer bid/fold — validated server-side, just emit and wait ────
  const [mpBidAmount, setMpBidAmount] = useState(1);
  const [busy, setBusy] = useState(false);

  const doPlaceBid = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await emitPlaceBid(network.roomCode, mpBidAmount);
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
              {currentAuction.history.slice(-totalPlayers).map((item, index) => (
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