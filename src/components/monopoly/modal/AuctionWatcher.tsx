import { useEffect } from 'react';
import { connect } from 'react-redux';
import { setShowModal } from '../../../redux/actions/modal';
import { modalTypes } from '../../../utility/constants';

/**
 * Multiplayer auctions are server-authoritative: `store.currentAuction` is
 * synced to every connected client identically. This component makes sure
 * ALL players see the auction modal open the moment it starts and close the
 * moment it resolves — not just the player who happened to land on the
 * property (which was the bug: only their local client ever showed it).
 */
const AuctionWatcher = ({ currentAuction, showModal, currentModal, setShowModal, isMultiplayer }) => {
  useEffect(() => {
    if (!isMultiplayer) return;
    if (currentAuction && !(showModal && currentModal === modalTypes.AUCTION_CARD)) {
      setShowModal(true, modalTypes.AUCTION_CARD);
    } else if (!currentAuction && showModal && currentModal === modalTypes.AUCTION_CARD) {
      setShowModal(false, null);
    }
  }, [currentAuction, showModal, currentModal, setShowModal, isMultiplayer]);

  return null;
};

const mapStateToProps = (store: any) => ({
  currentAuction: store.currentAuction,
  showModal: store.modalData.showModal,
  currentModal: store.modalData.currentModal,
  isMultiplayer: store.network.isMultiplayer,
});

const mapDispatchToProps = (dispatch: any) => ({
  setShowModal: (show: boolean, modal: string | null) => dispatch(setShowModal(show, modal)),
});

export default connect(mapStateToProps, mapDispatchToProps)(AuctionWatcher);
