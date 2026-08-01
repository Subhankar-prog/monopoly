import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import style from '../../../assets/css/card-modal.module.scss';
import { debitPlayerMoney, creditPlayerMoney, movePlayer } from '../../../redux/actions/player';
import { setIsDone } from '../../../redux/actions/board';
import { setShowModal } from '../../../redux/actions/modal';
import { showNotification } from '../../../redux/actions/notification';
import chestOrChanceLogicalFunctions from '../../../utility/player/chestOrChanceLogicalFunctions';

const ChanceCardModal = ({ card, dispatch, setShowModal, showNotification }) => {
  // card is expected to be { action, playerId }
  useEffect(() => {
    if (!card || !card.action) return;
    const action = card.action;
    const playerId = card.playerId;

    // show card for 1400ms then execute
    showNotification({
      title: action.type === 'MOVE' ? 'Chance Move' : 'Chance Card',
      message: action.description || 'Chance event',
      amount: action.amount != null ? action.amount : null,
      kind: 'chance',
    });

    const t = setTimeout(() => {
      if (action.type === 'DEBIT') {
        dispatch(debitPlayerMoney(playerId, action.amount, action.description));
        dispatch(setIsDone(true));
      } else if (action.type === 'CREDIT') {
        dispatch(creditPlayerMoney(playerId, action.amount, action.description));
        dispatch(setIsDone(true));
      } else if (action.type === 'MOVE') {
        dispatch(movePlayer(playerId, action.to, action.direction));
        // setIsDone will be called when movement finishes
      } else if (action.type === 'LOGICAL') {
        const logicalFunc = chestOrChanceLogicalFunctions[action.logicalId];
        if (logicalFunc) {
          if (action.logicalId === 1)
            logicalFunc(
              { playerId },
              null,
              (p, amt, desc) => dispatch(debitPlayerMoney(p, amt, desc)),
              (v) => dispatch(setIsDone(v))
            );
          else if (action.logicalId === 2)
            logicalFunc(
              { playerId },
              // totalPlayers unknown here; use store players length
              (card.totalPlayers || 2),
              (p, amt, desc) => dispatch(debitPlayerMoney(p, amt, desc)),
              (p, amt, desc) => dispatch(creditPlayerMoney(p, amt, desc)),
              (v) => dispatch(setIsDone(v))
            );
        }
      }
      // close modal immediately after action triggered
      setShowModal(false, null);
    }, 1400);
    return () => clearTimeout(t);
  }, [card, dispatch, setShowModal, showNotification]);

  if (!card || !card.action) return <></>;
  const action = card.action;
  return (
    <div className={style.card}>
      <p className={style.name}>{action.description || 'Chance'}</p>
      {action.amount != null && <p className={style.mortgage}>Amount: ${action.amount}</p>}
    </div>
  );
};

const mapStateToProps = store => ({
  card: store.card.currentCard,
});
const mapDispatchToProps = dispatch => ({
  dispatch,
  setShowModal: (s, m) => dispatch(setShowModal(s, m)),
  showNotification: data => dispatch(showNotification(data)),
});
export default connect(mapStateToProps, mapDispatchToProps)(ChanceCardModal);
