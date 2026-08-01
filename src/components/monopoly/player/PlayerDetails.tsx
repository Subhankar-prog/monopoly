import { connect } from 'react-redux';
import style from '../../../assets/css/player-details.module.scss';
import {
  setShowModal,
  setPlayerIdForMyCardsModal,
} from '../../../redux/actions/modal';
import { modalTypes, colors } from '../../../utility/constants';

const TOKEN_EMOJI = {
  red: '🎩',
  yellow: '🐕',
  blue: '🚗',
  green: '⛵',
  orange: '🎯',
  pink: '💎',
};

const PlayerDetails = ({
  playersData,
  playerId,
  setShowModal,
  setPlayerIdForMyCardsModal,
}) => {
  const player = playersData.players[playerId];
  const active = playersData.activePlayer === playerId;
  const color = colors[playerId];
  const initial = (player.name || `P${playerId + 1}`).trim().charAt(0).toUpperCase();

  const viewMyCards = () => {
    setShowModal(true, modalTypes.MY_CARDS);
    setPlayerIdForMyCardsModal(player.playerId);
  };

  return (
    <button
      className={`${style.playerCard} ${style[color]} ${active ? style.active : ''} ${player.isBankrupt ? style.bankrupt : ''}`}
      onClick={viewMyCards}
      title="View my cards"
    >
      <div className={style.avatar}>
        <span className={style.avatarInitial}>{initial}</span>
        <span className={style.avatarToken}>{TOKEN_EMOJI[color] || '🎲'}</span>
      </div>
      <div className={style.info}>
        <div className={style.namePill}>
          {player.name || `Player ${playerId + 1}`}
          {active && <span className={style.turnDot} aria-hidden="true" />}
        </div>
        <div className={style.moneyPill}>
          <span className={style.moneyIcon}>$</span>
          {player.money}
        </div>
        {player.inJail && <div className={style.statusChip}>⛓️ Jail {player.jailTurns + 1}/3</div>}
        {player.getOutOfJailFreeCards > 0 && (
          <div className={style.statusChip}>🎴 x{player.getOutOfJailFreeCards}</div>
        )}
        {player.isBankrupt && <div className={style.statusChip}>💀 Bankrupt</div>}
      </div>
    </button>
  );
};
const mapStateToProps = store => {
  return {
    playersData: store.playersData,
  };
};

const mapDispatchToProps = dispatch => {
  return {
    setShowModal: (showModal, currentModal) =>
      dispatch(setShowModal(showModal, currentModal)),
    setPlayerIdForMyCardsModal: playerId =>
      dispatch(setPlayerIdForMyCardsModal(playerId)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(PlayerDetails);
