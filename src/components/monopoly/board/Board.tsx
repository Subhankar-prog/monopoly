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
import TurnTimer from '../timer/TurnTimer';

import customLogo from '../../../assets/images/custom-logo.jpg';

const Board = ({ side, rowWidth, totalPlayers, sites, active, network }: any) => {
  const calculatedRowWidth = rowWidth || Math.max(65, Math.floor(side * 0.21));

  return (
    <div className={style.tableLayout}>
      <div className={style.boardShell}>
        <div
          className={style.board}
          style={
            {
              width: side + 'px',
              height: side + 'px',
              '--row-width': calculatedRowWidth + 'px',
            } as React.CSSProperties
          }
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
            <div className={style.boardKonarkWheel} aria-hidden="true">
              <svg viewBox="0 0 200 200" className={style.centerWheelSvg}>
                <circle cx="100" cy="100" r="92" fill="none" stroke="#d4af37" strokeWidth="2.5" strokeDasharray="6 3" opacity="0.35" />
                <circle cx="100" cy="100" r="76" fill="none" stroke="#d4af37" strokeWidth="1.5" opacity="0.3" />
                <circle cx="100" cy="100" r="28" fill="none" stroke="#d4af37" strokeWidth="2.5" opacity="0.4" />
                {[...Array(12)].map((_, idx) => (
                  <line
                    key={idx}
                    x1="100"
                    y1="100"
                    x2={100 + 88 * Math.cos((idx * 30 * Math.PI) / 180)}
                    y2={100 + 88 * Math.sin((idx * 30 * Math.PI) / 180)}
                    stroke="#d4af37"
                    strokeWidth="2"
                    opacity="0.3"
                  />
                ))}
              </svg>
            </div>
            <div className={style.boardLogo}>
              <img src={customLogo} alt="Heavy Business Logo" className={style.boardLogoImg} />
              <span className={style.odishaLogoBadge}>🪔 ODISHA EDITION 🪔</span>
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
          <TurnTimer />
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

const mapStateToProps = (store: any) => {
  return {
    side: store.board.side,
    rowWidth: store.board.rowWidth,
    totalPlayers: store.playersData.totalPlayers,
    sites: store.siteData.sites,
    active: store.actionData.active,
    network: store.network,
  };
};

export default connect(mapStateToProps)(Board);
