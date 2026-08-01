import { connect } from 'react-redux';
import style from '../../../assets/css/done-button.module.scss';
import { setActivePlayer } from '../../../redux/actions/player';
import { setIsDone } from '../../../redux/actions/board';
import { emitEndTurn } from '../../../network/socket';

const DoneButton = ({ isDone, setActivePlayer, setIsDone, network, activePlayer }) => {
  const isMultiplayer = network.isMultiplayer;
  const isMyTurn = !isMultiplayer || network.myPlayerId === activePlayer;

  const done = async () => {
    if (isDone && isMyTurn) {
      if (isMultiplayer && network.roomCode) {
        try {
          await emitEndTurn(network.roomCode);
          // Server broadcasts updated state via SYNC_GAME_STATE
        } catch (err) {
          console.error('Failed to end turn:', err);
        }
      } else {
        setActivePlayer();
        setIsDone(false);
      }
    }
  };
  return (
    <button
      onClick={done}
      className={`${style.doneButton} ${!isDone || !isMyTurn ? style.inactive : ''}`}
    >
      Done{isMyTurn && isDone ? ' — End Turn' : ''}
    </button>
  );
};

const mapStateToProps = store => {
  return {
    isDone: store.board.isDone,
    network: store.network,
    activePlayer: store.playersData.activePlayer,
  };
};

const mapDispatchToProps = dispatch => {
  return {
    setActivePlayer: () => dispatch(setActivePlayer()),
    setIsDone: isDone => dispatch(setIsDone(isDone)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(DoneButton);

