import { useState } from 'react';
import { connect } from 'react-redux';
import style from '../../../assets/css/trade-offers-banner.module.scss';
import { emitRespondTrade, emitCancelTrade } from '../../../network/socket';

const siteName = (siteData, id) => siteData.sites[id]?.name || `Site ${id}`;

const TradeOffersBanner = ({ trades, network, players, siteData }) => {
  const [busyId, setBusyId] = useState(null);
  const myId = network.myPlayerId;
  if (myId == null) return null;

  const pending = (trades || []).filter((t) => t.status === 'pending');
  const incoming = pending.filter((t) => t.toPlayerId === myId);
  const outgoing = pending.filter((t) => t.fromPlayerId === myId);

  if (incoming.length === 0 && outgoing.length === 0) return null;

  const respond = async (tradeId, accept) => {
    setBusyId(tradeId);
    try {
      await emitRespondTrade(network.roomCode, tradeId, accept);
    } catch (err) {
      console.error('[TradeOffersBanner] respond failed', err);
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (tradeId) => {
    setBusyId(tradeId);
    try {
      await emitCancelTrade(network.roomCode, tradeId);
    } catch (err) {
      console.error('[TradeOffersBanner] cancel failed', err);
    } finally {
      setBusyId(null);
    }
  };

  const describeSites = (ids) =>
    ids.length === 0 ? 'nothing' : ids.map((id) => siteName(siteData, id)).join(', ');

  return (
    <div className={style.banner}>
      {incoming.map((t) => (
        <div key={t.id} className={style.card}>
          <div className={style.title}>💼 Trade offer from {players[t.fromPlayerId]?.name}</div>
          <div className={style.details}>
            <span className={style.give}>
              They offer: {describeSites(t.offeredSites)}
              {t.offeredMoney > 0 ? ` + $${t.offeredMoney}` : ''}
            </span>
            <span className={style.get}>
              They want: {describeSites(t.requestedSites)}
              {t.requestedMoney > 0 ? ` + $${t.requestedMoney}` : ''}
            </span>
          </div>
          <div className={style.buttons}>
            <button
              className={style.accept}
              disabled={busyId === t.id}
              onClick={() => respond(t.id, true)}
            >
              ✅ Accept
            </button>
            <button
              className={style.reject}
              disabled={busyId === t.id}
              onClick={() => respond(t.id, false)}
            >
              ❌ Reject
            </button>
          </div>
        </div>
      ))}
      {outgoing.map((t) => (
        <div key={t.id} className={style.card}>
          <div className={style.title}>⏳ Waiting on {players[t.toPlayerId]?.name}</div>
          <div className={style.buttons}>
            <button className={style.reject} disabled={busyId === t.id} onClick={() => cancel(t.id)}>
              Cancel Offer
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const mapStateToProps = (store) => ({
  trades: store.trades,
  network: store.network,
  players: store.playersData.players,
  siteData: store.siteData,
});

export default connect(mapStateToProps)(TradeOffersBanner);
