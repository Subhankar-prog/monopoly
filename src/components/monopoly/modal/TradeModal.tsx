import { useState } from 'react';
import { connect } from 'react-redux';
import style from '../../../assets/css/trade-modal.module.scss';
import { emitProposeTrade } from '../../../network/socket';

const TradeModal = ({ hideOnClick, playersData, siteData, network }) => {
  const myId = network.myPlayerId;
  const allPlayers: any[] = Object.values(playersData.players || {});
  const otherPlayers = allPlayers.filter(
    (p: any) => p.playerId !== myId && !p.isBankrupt
  );

  const [toPlayerId, setToPlayerId] = useState(otherPlayers[0]?.playerId ?? null);
  const [offeredSites, setOfferedSites] = useState([]);
  const [requestedSites, setRequestedSites] = useState([]);
  const [offeredMoney, setOfferedMoney] = useState(0);
  const [requestedMoney, setRequestedMoney] = useState(0);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  const mySites = (siteData.playersSites[myId] || []).filter((s) => s.type !== 'special');
  const theirSites =
    toPlayerId != null ? (siteData.playersSites[toPlayerId] || []).filter((s) => s.type !== 'special') : [];

  const toggle = (list, setList, id) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const submit = async () => {
    if (toPlayerId == null) return;
    setError(null);
    setSending(true);
    try {
      await emitProposeTrade(
        network.roomCode,
        toPlayerId,
        offeredSites,
        requestedSites,
        Number(offeredMoney) || 0,
        Number(requestedMoney) || 0
      );
      hideOnClick();
    } catch (err) {
      setError(err.message || 'Trade offer failed');
    } finally {
      setSending(false);
    }
  };

  if (otherPlayers.length === 0) {
    return <div className={style.trade}>No other players to trade with.</div>;
  }

  return (
    <div className={style.trade}>
      <div className={style.partnerRow}>
        <label>Trade with</label>
        <select value={toPlayerId ?? ''} onChange={(e) => setToPlayerId(Number(e.target.value))}>
          {otherPlayers.map((p) => (
            <option key={p.playerId} value={p.playerId}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className={style.columns}>
        <div className={style.column}>
          <h4>You Offer</h4>
          <div className={style.moneyRow}>
            <label>Cash $</label>
            <input
              type="number"
              min="0"
              value={offeredMoney}
              onChange={(e) => setOfferedMoney(Math.max(0, parseInt(e.target.value, 10) || 0))}
            />
          </div>
          <div className={style.siteList}>
            {mySites.length === 0 && <p className={style.empty}>No properties</p>}
            {mySites.map((s) => (
              <label key={s.id} className={style.siteRow}>
                <input
                  type="checkbox"
                  checked={offeredSites.includes(s.id)}
                  onChange={() => toggle(offeredSites, setOfferedSites, s.id)}
                />
                {s.name} {s.isMortgaged ? '(mortgaged)' : ''}
              </label>
            ))}
          </div>
        </div>

        <div className={style.column}>
          <h4>You Request</h4>
          <div className={style.moneyRow}>
            <label>Cash $</label>
            <input
              type="number"
              min="0"
              value={requestedMoney}
              onChange={(e) => setRequestedMoney(Math.max(0, parseInt(e.target.value, 10) || 0))}
            />
          </div>
          <div className={style.siteList}>
            {theirSites.length === 0 && <p className={style.empty}>No properties</p>}
            {theirSites.map((s) => (
              <label key={s.id} className={style.siteRow}>
                <input
                  type="checkbox"
                  checked={requestedSites.includes(s.id)}
                  onChange={() => toggle(requestedSites, setRequestedSites, s.id)}
                />
                {s.name} {s.isMortgaged ? '(mortgaged)' : ''}
              </label>
            ))}
          </div>
        </div>
      </div>

      {error && <p className={style.error}>{error}</p>}

      <button className={style.sendButton} disabled={sending} onClick={submit}>
        {sending ? 'Sending…' : 'Send Trade Offer'}
      </button>
    </div>
  );
};

const mapStateToProps = (store) => ({
  playersData: store.playersData,
  siteData: store.siteData,
  network: store.network,
});

export default connect(mapStateToProps)(TradeModal);
