import React from 'react';
import style from '../../../assets/css/board.module.scss';
import Row from '../row/Row';
import DiceContainer from '../dice/DiceContainer';
import PlayerContainer from '../player/PlayerContainer';
import { connect } from 'react-redux';
import PlayerDetailsContainer from '../player/PlayerDetailsContainer';
import Actions from '../modal/Actions';
import ActionInfo from '../action/ActionInfo';
import DoneButton from '../donebutton/DoneButton';
import JailControls from '../jail/JailControls';
import TradeOffersBanner from '../trade/TradeOffersBanner';
import MenuButton from './MenuButton';
import AuctionWatcher from '../modal/AuctionWatcher';
import BotController from '../bot/BotController';
import DebtResolutionPanel from '../debt/DebtResolutionPanel';

const Board = ({ side, totalPlayers, sites, active, network }) => {
  return (
    <div className={style.tableLayout}>
      <div className={style.boardShell}>
        <div
          className={style.board}
          style={{ width: side + 'px', height: side + 'px' }}
        >
          {[
            sites.slice(0, 10).reverse(),
            sites.slice(10, 20).reverse(),
            sites.slice(20, 30),
            sites.slice(30, 40),
          ].map((data, index) => (
            <Row key={index} data={data} rowNum={index + 1} />
          ))}
          <div className={style.boardCenter}>
            <div className={style.boardLogo}>
              <span className={style.boardLogoLine1}>HEAVY</span>
              <span className={style.boardLogoLine2}>BUSINESS</span>
            </div>
          </div>
          <PlayerContainer totalPlayers={totalPlayers} />
          {active && (
            <div className={style.actionInfoWrap}>
              <ActionInfo />
            </div>
          )}
        </div>
      </div>

      <div className={style.sidePanel}>
        <div className={style.sideTopBar}>
          <MenuButton />
        </div>

        <PlayerDetailsContainer />

        <div className={style.diceZone}>
          <DiceContainer />
          <JailControls />
          <DoneButton />
        </div>

        <Actions />
      </div>

      {network.isMultiplayer && <TradeOffersBanner />}
      {network.isMultiplayer && <AuctionWatcher />}
      {network.isMultiplayer && <DebtResolutionPanel />}
      <BotController />
    </div>
  );
};

const mapDispatchToProps = dispatch => {
  return {};
};

const mapStateToProps = store => {
  return {
    side: store.board.side,
    totalPlayers: store.playersData.totalPlayers,
    sites: store.siteData.sites,
    active: store.actionData.active,
    network: store.network,
  };
};
export default connect(mapStateToProps, mapDispatchToProps)(Board);
