import { connect } from 'react-redux';
import { setCurrentCard } from '../../../redux/actions/card';
import { setShowModal } from '../../../redux/actions/modal';
import { actionTypes, modalTypes } from '../../../utility/constants';
import { useCallback, useEffect, useState } from 'react';
import {
  mortgageSite,
  redeemSite,
  buildOnSite,
  sellBuild,
} from '../../../redux/actions/site';
import {
  creditPlayerMoney,
  debitPlayerMoney,
} from '../../../redux/actions/player';
import { showNotification } from '../../../redux/actions/notification';
import { setAction } from '../../../redux/actions/action';
import Card from './Card/Card';
import { isBuildable, isSellable } from '../../../utility/cardUtilities';
import {
  emitMortgageSite,
  emitRedeemSite,
  emitBuildOnSite,
  emitSellBuild,
} from '../../../network/socket';

const CardWrapper = ({
  data,
  rowNum,
  setShowModal,
  setCurrentCard,
  boughtBy,
  actionData,
  playersSites,
  activePlayer,
  mortgageSite,
  redeemSite,
  creditPlayerMoney,
  debitPlayerMoney,
  noOfCardsInCategory,
  buildOnSite,
  sellBuild,
  showNotification,
  setAction,
  network,
}) => {
  const [isActionable, setIsActionable] = useState(false);
  const isMultiplayer = network?.isMultiplayer;

  const getIsActionable = useCallback(() => {
    const card = (playersSites[activePlayer] || []).filter(item => item.id === data.id);

    switch (actionData.currentAction) {
      case null:
        return true;
      case actionTypes.MORTGAGE:
        return card.length ? !card[0].isMortgaged : false;
      case actionTypes.REDEEM:
        return card.length ? card[0].isMortgaged : false;
      case actionTypes.BUILD:
        return isBuildable(
          playersSites[activePlayer],
          data,
          noOfCardsInCategory
        );
      case actionTypes.SELL:
        return isSellable(
          playersSites[activePlayer],
          data,
          noOfCardsInCategory
        );
      default:
        return false;
    }
  }, [
    activePlayer,
    data,
    playersSites,
    actionData.currentAction,
    noOfCardsInCategory,
  ]);

  const onCardClick = () => {
    if (actionData.active && isActionable) {
      switch (actionData.currentAction) {
        case actionTypes.MORTGAGE:
          mortgageCard();
          break;
        case actionTypes.REDEEM:
          redeemCard();
          break;
        case actionTypes.BUILD:
          build();
          break;
        case actionTypes.SELL:
          sell();
          break;
        default:
          console.log('Invalid Action');
      }
    } else if (!actionData.active) {
      showCardModal();
    }
  };

  const showCardModal = () => {
    setShowModal(true, modalTypes.SHOW_CARD);
    setCurrentCard(data);
  };

  // In multiplayer, every action goes through the server — it re-validates
  // ownership/rules and broadcasts the authoritative result (including the
  // notification overlay via lastEvent) to every player. The `setAction`
  // call afterwards exits "action mode" so a stray board click doesn't
  // accidentally trigger a second action.
  const mortgageCard = async () => {
    if (isMultiplayer && network.roomCode) {
      setAction(false, null);
      try {
        await emitMortgageSite(network.roomCode, data.id);
      } catch (err) {
        console.error('[CardWrapper] mortgage failed:', err);
      }
      return;
    }
    mortgageSite(data.id, activePlayer);
    const amount = (data.sellingPrice * 50) / 100;
    creditPlayerMoney(activePlayer, amount, `Mortgage ${data.name}`);
    showNotification?.({
      title: 'Mortgage',
      message: `Mortgaged ${data.name}`,
      amount,
      kind: 'mortgage',
      tier: 'toast',
    });
    setAction(false, null);
  };

  const redeemCard = async () => {
    if (isMultiplayer && network.roomCode) {
      setAction(false, null);
      try {
        await emitRedeemSite(network.roomCode, data.id);
      } catch (err) {
        console.error('[CardWrapper] redeem failed:', err);
      }
      return;
    }
    redeemSite(data.id, activePlayer);
    const amount = (data.sellingPrice * 55) / 100;
    debitPlayerMoney(activePlayer, amount, `Redeem ${data.name}`);
    showNotification?.({
      title: 'Redeem',
      message: `Redeemed ${data.name}`,
      amount,
      kind: 'redeem',
      tier: 'toast',
    });
    setAction(false, null);
  };

  const build = async () => {
    if (isMultiplayer && network.roomCode) {
      setAction(false, null);
      try {
        await emitBuildOnSite(network.roomCode, data.id);
      } catch (err) {
        console.error('[CardWrapper] build failed:', err);
      }
      return;
    }
    buildOnSite(data.id, activePlayer);
    const amount = data.construction;
    debitPlayerMoney(activePlayer, amount, `Built on ${data.name}`);
    showNotification?.({
      title: 'Build',
      message: `Built on ${data.name}`,
      amount,
      kind: 'build',
      tier: 'toast',
    });
    setAction(false, null);
  };

  const sell = async () => {
    if (isMultiplayer && network.roomCode) {
      setAction(false, null);
      try {
        await emitSellBuild(network.roomCode, data.id);
      } catch (err) {
        console.error('[CardWrapper] sell failed:', err);
      }
      return;
    }
    sellBuild(data.id, activePlayer);
    const amount = data.construction / 2;
    creditPlayerMoney(activePlayer, amount, `Sold on ${data.name}`);
    showNotification?.({
      title: 'Sold',
      message: `Sold building on ${data.name}`,
      amount,
      kind: 'sell',
      tier: 'toast',
    });
    setAction(false, null);
  };

  useEffect(() => {
    const _isActionable = getIsActionable();
    setIsActionable(_isActionable);
  }, [getIsActionable]);

  return (
    <Card
      onCardClick={onCardClick}
      data={data}
      rowNum={rowNum}
      active={isActionable}
      boughtBy={boughtBy}
    />
  );
};

const mapDispatchToProps = dispatch => {
  return {
    setShowModal: (showModal, currentModal) =>
      dispatch(setShowModal(showModal, currentModal)),
    setCurrentCard: cardData => dispatch(setCurrentCard(cardData)),
    mortgageSite: (siteId, playerId) =>
      dispatch(mortgageSite(siteId, playerId)),
    redeemSite: (siteId, playerId) => dispatch(redeemSite(siteId, playerId)),
    buildOnSite: (siteId, playerId) => dispatch(buildOnSite(siteId, playerId)),
    sellBuild: (siteId, playerId) => dispatch(sellBuild(siteId, playerId)),
    creditPlayerMoney: (playerId, amount, description) =>
      dispatch(creditPlayerMoney(playerId, amount, description)),
    debitPlayerMoney: (playerId, amount, description) =>
      dispatch(debitPlayerMoney(playerId, amount, description)),
    showNotification: data => dispatch(showNotification(data)),
    setAction: (active, currentAction) =>
      dispatch(setAction(active, currentAction)),
  };
};
const mapStateToProps = store => {
  return {
    actionData: store.actionData,
    playersSites: store.siteData.playersSites,
    activePlayer: store.playersData.activePlayer,
    noOfCardsInCategory: store.siteData.noOfCardsInCategory,
    network: store.network,
  };
};
export default connect(mapStateToProps, mapDispatchToProps)(CardWrapper);
