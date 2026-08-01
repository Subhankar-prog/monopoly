import { connect } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import style from '../../../assets/css/actions.module.scss';
import { setAction } from '../../../redux/actions/action';
import { setShowModal } from '../../../redux/actions/modal';
import { actionTypes, modalTypes } from '../../../utility/constants';

const Actions = ({ setAction, setShowModal, active: disabled, network, activePlayer, gameOver, amIBankrupt }) => {
  const navigate = useNavigate();
  const isMultiplayer = network.isMultiplayer;
  const isMyTurn = !isMultiplayer || network.myPlayerId === activePlayer;
  const isDisabled = disabled || !isMyTurn;

  const setActionHelper = e => {
    const el = e.currentTarget;
    const actionType = el.getAttribute('action-type');
    setAction(true, actionType);
  };

  const onMenu = () => {
    if (window.confirm('Leave the table and return to the lobby?')) {
      navigate('/');
    }
  };

  const onTrade = () => {
    setShowModal(true, modalTypes.TRADE);
  };

  if (amIBankrupt) {
    return (
      <div className={style.actions}>
        <button className={`${style.btn} ${style.menu}`} onClick={onMenu} style={{ gridColumn: '1 / -1' }}>
          Leave Table
        </button>
      </div>
    );
  }

  return (
    <div className={style.actions}>
      <button className={`${style.btn} ${style.menu}`} onClick={onMenu}>
        Menu
      </button>
      <button
        disabled={isDisabled}
        className={`${style.btn} ${style.build}`}
        onClick={setActionHelper}
        action-type={actionTypes.BUILD}
      >
        Build
      </button>
      <button
        disabled={isDisabled}
        className={`${style.btn} ${style.mortgage}`}
        onClick={setActionHelper}
        action-type={actionTypes.MORTGAGE}
      >
        Mortgage
      </button>
      <button
        disabled={isDisabled}
        className={`${style.btn} ${style.sell}`}
        onClick={setActionHelper}
        action-type={actionTypes.SELL}
      >
        Sell
      </button>
      <button
        disabled={isDisabled}
        className={`${style.btn} ${style.redeem}`}
        onClick={setActionHelper}
        action-type={actionTypes.REDEEM}
      >
        Redeem
      </button>
      <button
        disabled={!isMultiplayer || gameOver}
        className={`${style.btn} ${style.trade}`}
        onClick={onTrade}
      >
        Trade
      </button>
    </div>
  );
};

const mapDispatchToProps = dispatch => {
  return {
    setAction: (active, currentAction) =>
      dispatch(setAction(active, currentAction)),
    setShowModal: (showModal, currentModal) =>
      dispatch(setShowModal(showModal, currentModal)),
  };
};

const mapStateToProps = store => {
  return {
    active: store.actionData.active,
    network: store.network,
    activePlayer: store.playersData.activePlayer,
    gameOver: store.gameMeta?.gameOver,
    amIBankrupt: store.network.isMultiplayer
      ? store.playersData.players[store.network.myPlayerId]?.isBankrupt || false
      : false,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Actions);
