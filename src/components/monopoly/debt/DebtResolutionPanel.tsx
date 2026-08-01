import { useState } from 'react';
import { connect } from 'react-redux';
import style from '../../../assets/css/debt-resolution.module.scss';
import {
  emitMortgageSite,
  emitSellSiteToBank,
  emitDeclareBankruptcy,
} from '../../../network/socket';
import { setShowModal } from '../../../redux/actions/modal';
import { modalTypes } from '../../../utility/constants';

const DebtResolutionPanel = ({ network, players, playersSites, setShowModal }) => {
  const myPlayerId = network.myPlayerId;
  const [busySiteId, setBusySiteId] = useState(null);
  const [confirmingBankruptcy, setConfirmingBankruptcy] = useState(false);
  const [error, setError] = useState('');

  if (!network.isMultiplayer || myPlayerId == null) return null;
  const me = players[myPlayerId];
  if (!me || me.money >= 0 || me.isBankrupt) return null;

  const debtAmount = -me.money;
  const myProperties = (playersSites[myPlayerId] || []).slice().sort((a, b) => a.name.localeCompare(b.name));

  const runAction = async (siteId, fn) => {
    setBusySiteId(siteId);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message || 'That action failed');
    } finally {
      setBusySiteId(null);
    }
  };

  const doMortgage = (siteId) =>
    runAction(siteId, () => emitMortgageSite(network.roomCode, siteId));
  const doSell = (siteId) =>
    runAction(siteId, () => emitSellSiteToBank(network.roomCode, siteId));

  const doBankruptcy = async () => {
    setError('');
    try {
      await emitDeclareBankruptcy(network.roomCode);
    } catch (err) {
      setError(err.message || 'Failed to declare bankruptcy');
    }
  };

  const openTrade = () => setShowModal(true, modalTypes.TRADE);

  return (
    <div className={style.overlay}>
      <div className={style.panel}>
        <div className={style.ribbon}>⚠️ In Debt</div>
        <h2 className={style.title}>You're ${debtAmount} short</h2>
        <p className={style.subtitle}>
          Raise ${debtAmount} to keep playing — mortgage or sell a property, arrange a trade, or
          declare bankruptcy if you're out of options.
        </p>

        {myProperties.length === 0 ? (
          <div className={style.empty}>You have no properties left to sell or mortgage.</div>
        ) : (
          <div className={style.propertyList}>
            {myProperties.map(site => (
              <div key={site.id} className={style.propertyRow}>
                <div className={style.propertyInfo}>
                  <span className={style.propertyName}>
                    {site.name}
                    {site.isMortgaged && <span className={style.mortgagedTag}>Mortgaged</span>}
                    {site.built > 0 && <span className={style.builtTag}>{site.built} built</span>}
                  </span>
                  <span className={style.propertyValue}>
                    Mortgage: ${site.mortgage} · Sell: ${site.sellingPrice}
                  </span>
                </div>
                <div className={style.propertyActions}>
                  <button
                    className={style.mortgageBtn}
                    disabled={site.isMortgaged || site.built > 0 || busySiteId === site.id}
                    onClick={() => doMortgage(site.id)}
                  >
                    Mortgage
                  </button>
                  <button
                    className={style.sellBtn}
                    disabled={site.isMortgaged || site.built > 0 || busySiteId === site.id}
                    onClick={() => doSell(site.id)}
                  >
                    Sell to Bank
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className={style.error}>{error}</p>}

        <div className={style.bottomActions}>
          <button className={style.tradeBtn} onClick={openTrade}>
            🤝 Propose a Trade
          </button>
          {!confirmingBankruptcy ? (
            <button className={style.bankruptBtn} onClick={() => setConfirmingBankruptcy(true)}>
              Declare Bankruptcy
            </button>
          ) : (
            <div className={style.confirmBankruptcy}>
              <span>Are you sure? This ends your game.</span>
              <button className={style.bankruptBtnConfirm} onClick={doBankruptcy}>
                Yes, I'm out
              </button>
              <button className={style.cancelBtn} onClick={() => setConfirmingBankruptcy(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const mapStateToProps = (store) => ({
  network: store.network,
  players: store.playersData.players,
  playersSites: store.siteData.playersSites,
});

const mapDispatchToProps = (dispatch) => ({
  setShowModal: (show, modal) => dispatch(setShowModal(show, modal)),
});

export default connect(mapStateToProps, mapDispatchToProps)(DebtResolutionPanel);
