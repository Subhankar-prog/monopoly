import Dice from './Dice';
import style from '../../../assets/css/dice.module.scss';
import { useState } from 'react';
import rollDiceAudio from '../../../assets/audio/rolldice2.wav';
import { connect } from 'react-redux';
import { rollDice } from '../../../redux/actions/dice';
import { emitRollDice } from '../../../network/socket';

const ROLL_ANIMATION_MS = 650; // minimum time the dice visibly "roll" before settling on the real result

const DiceContainer = ({ rollDice, isDone, network, activePlayer, isActivePlayerMoving, isActivePlayerInJail, activePlayerName, amIBankrupt }) => {
  const [disabled, setDisabled] = useState(false);
  const audioElement = new Audio(rollDiceAudio);
  const [number, setNumber] = useState({
    dice1: 6,
    dice2: 6,
  });

  const isMultiplayer = network.isMultiplayer;
  const isMyTurn = !isMultiplayer || network.myPlayerId === activePlayer;

  const genNumber = () => {
    return Math.floor(Math.random() * 6) + 1;
  };
  const rollDiceHelper = () => {
    const num1 = genNumber();
    const num2 = genNumber();
    const diceData = {
      dice1: num1,
      dice2: num2,
    };
    setNumber(diceData);
    return diceData;
  };
  const onClick = async () => {
    if (!disabled && !isDone && !isActivePlayerMoving && isMyTurn && !isActivePlayerInJail) {
      setDisabled(true);
      const interval = setInterval(rollDiceHelper, 90);
      audioElement.play();
      const minDuration = new Promise(resolve => setTimeout(resolve, ROLL_ANIMATION_MS));

      if (isMultiplayer && network.roomCode) {
        try {
          // Wait for BOTH the server's real result AND the minimum shuffle
          // duration — on a fast/local connection the server can reply in a
          // handful of milliseconds, which without this would cut the roll
          // animation short and make it look like the dice just snapped to
          // an answer instead of actually rolling.
          const [serverDice] = await Promise.all([emitRollDice(network.roomCode), minDuration]);
          clearInterval(interval);
          setNumber({ dice1: serverDice.dice1, dice2: serverDice.dice2 });
          // Server state update comes via SYNC_GAME_STATE
        } catch (err) {
          clearInterval(interval);
          console.error('Failed to roll dice:', err);
        } finally {
          setDisabled(false);
        }
      } else {
        await minDuration;
        clearInterval(interval);
        const diceData = rollDiceHelper();
        rollDice(diceData);
        setDisabled(false);
      }
    }
  };
  const canRoll = !disabled && !isDone && !isActivePlayerMoving && isMyTurn && !isActivePlayerInJail;

  return (
    <div className={style.diceZoneInner}>
      {amIBankrupt && (
        <p className={style.spectatorPrompt}>💀 You're bankrupt — spectating the rest of the game</p>
      )}
      {!amIBankrupt && isMyTurn && !isActivePlayerInJail && (
        <p className={style.rollPrompt}>{isDone ? 'Take an action or end your turn' : 'Roll the dice'}</p>
      )}
      {!amIBankrupt && !isMyTurn && (
        <p className={style.waitingPrompt}>Waiting for {activePlayerName}...</p>
      )}
      <div
        className={`${style.diceContainer} ${canRoll ? style.canRoll : ''} ${
          isDone || !isMyTurn || isActivePlayerMoving || isActivePlayerInJail ? style.inactive : ''
        }`}
        onClick={onClick}
        data-testid="dice-container"
        style={isActivePlayerInJail || amIBankrupt ? { visibility: 'hidden', height: 0 } : undefined}
      >
        <Dice number={number.dice1} />
        <Dice number={number.dice2} />
      </div>
    </div>
  );
};

const mapStateToProps = store => {
  return {
    isDone: store.board.isDone,
    network: store.network,
    activePlayer: store.playersData.activePlayer,
    activePlayerName: store.playersData.players[store.playersData.activePlayer]?.name || 'the other player',
    isActivePlayerMoving:
      store.playersData.players[store.playersData.activePlayer]?.isMoving || false,
    isActivePlayerInJail:
      store.playersData.players[store.playersData.activePlayer]?.inJail || false,
    amIBankrupt: store.network.isMultiplayer
      ? store.playersData.players[store.network.myPlayerId]?.isBankrupt || false
      : false,
  };
};

const mapDispatchToProps = dispatch => {
  return {
    rollDice: diceData => dispatch(rollDice(diceData)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(DiceContainer);

