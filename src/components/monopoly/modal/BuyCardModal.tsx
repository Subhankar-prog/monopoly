import style from '../../../assets/css/buy-card-modal.module.scss';
import CardModal from './CardModal';
import { connect } from 'react-redux';
import { setShowModal } from '../../../redux/actions/modal';
import { modalTypes } from '../../../utility/constants';
import { buySite } from '../../../redux/actions/site';
import { debitPlayerMoney } from '../../../redux/actions/player';
import { showNotification } from '../../../redux/actions/notification';
import { setIsDone } from '../../../redux/actions/board';
import { emitBuySite } from '../../../network/socket';

const BuyCardModal = ({
  card,
  setShowModal,
  buySite,
  activePlayer,
  sites,
  debitPlayerMoney,
  setIsDone,
  network,
  showNotification,
}) => {
  const isMultiplayer = network.isMultiplayer;

  const onBuy = async () => {
    if (isMultiplayer && network.roomCode) {
      // Close immediately: the server is authoritative and will broadcast
      // the real result (including the buy overlay) via game-state-update.
      // Waiting for the ack before closing left a window where the modal
      // was still open when that overlay arrived, and the overlay gets
      // suppressed while any modal is showing — so the animation silently
      // never appeared.
      setShowModal(false, null);
      try {
        await emitBuySite(network.roomCode);
      } catch (err) {
        console.error('Failed to buy:', err);
      }
    } else {
      debitPlayerMoney(activePlayer, sites[card].sellingPrice, null, true);
      buySite(activePlayer, sites[card]);
      setShowModal(false, null);
      setIsDone(true);
    }
  };
  const onAuction = () => {
    setShowModal(true, modalTypes.AUCTION_CARD);
  };
  return (
    <div>
      <CardModal card={sites[card]} />
      <div className={style.btnContainer}>
        <button className={`${style.btn} ${style.buy}`} onClick={onBuy}>
          Buy
        </button>
        <button className={`${style.btn} ${style.auction}`} onClick={onAuction}>
          Auction
        </button>
      </div>
    </div>
  );
};

const mapStateToProps = store => {
  return {
    activePlayer: store.playersData.activePlayer,
    sites: store.siteData.sites,
    network: store.network,
  };
};
const mapDispatchToProps = dispatch => {
  return {
    setShowModal: (showModal, currentModal) =>
      dispatch(setShowModal(showModal, currentModal)),
    buySite: (playerId, siteData) => dispatch(buySite(playerId, siteData)),
    debitPlayerMoney: (playerId, amount, description, suppressNotification) =>
      dispatch(debitPlayerMoney(playerId, amount, description, suppressNotification)),
    showNotification: data => dispatch(showNotification(data)),
    setIsDone: isDone => dispatch(setIsDone(isDone)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(BuyCardModal);

