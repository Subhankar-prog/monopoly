import { useState } from 'react';
import { connect } from 'react-redux';
import style from '../../../assets/css/jail-controls.module.scss';
import { emitRollForJail, emitPayJailFine, emitUseJailCard } from '../../../network/socket';
import Dice from '../dice/Dice';

const ROLL_ANIMATION_MS = 650; // keep in sync with DiceContainer's own roll pacing

const JailControls = ({ network, activePlayer, players, isDone }) => {
  const [busy, setBusy] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [diceShown, setDiceShown] = useState(null); // {dice1, dice2} once a roll has happened this visit
  const isMultiplayer = network.isMultiplayer;
  const isMyTurn = !isMultiplayer || network.myPlayerId === activePlayer;
  const player = players[activePlayer];

  if (!player?.inJail || !isMyTurn || isDone) return null;

  const canPayFine = player.money >= 50;
  const canUseCard = player.getOutOfJailFreeCards > 0;

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn(network.roomCode);
    } catch (err) {
      console.error('[JailControls]', err);
    } finally {
      setBusy(false);
    }
  };

  const rollForDoubles = async () => {
    if (busy || rolling) return;
    setBusy(true);
    setRolling(true);
    setDiceShown({ dice1: Math.ceil(Math.random() * 6), dice2: Math.ceil(Math.random() * 6) });

    const shuffleInterval = setInterval(() => {
      setDiceShown({ dice1: Math.ceil(Math.random() * 6), dice2: Math.ceil(Math.random() * 6) });
    }, 90);
    const minDuration = new Promise(resolve => setTimeout(resolve, ROLL_ANIMATION_MS));

    try {
      const [realDice] = await Promise.all([emitRollForJail(network.roomCode), minDuration]);
      clearInterval(shuffleInterval);
      setDiceShown({ dice1: realDice.dice1, dice2: realDice.dice2 });
    } catch (err) {
      clearInterval(shuffleInterval);
      console.error('[JailControls]', err);
    } finally {
      setRolling(false);
      setBusy(false);
    }
  };

  return (
    <div className={style.jailControls}>
      <div className={style.header}>⛓️ In Jail — attempt {player.jailTurns + 1} of 3</div>
      {diceShown && (
        <div className={style.diceRow}>
          <Dice number={diceShown.dice1} />
          <Dice number={diceShown.dice2} />
        </div>
      )}
      <div className={style.buttons}>
        <button disabled={busy} onClick={rollForDoubles}>
          🎲 {rolling ? 'Rolling…' : 'Roll for Doubles'}
        </button>
        <button disabled={busy || !canPayFine} onClick={() => run(emitPayJailFine)}>
          💵 Pay $50 Fine
        </button>
        <button disabled={busy || !canUseCard} onClick={() => run(emitUseJailCard)}>
          🎴 Use Jail Card {canUseCard ? `(${player.getOutOfJailFreeCards})` : ''}
        </button>
      </div>
    </div>
  );
};

const mapStateToProps = (store) => ({
  network: store.network,
  activePlayer: store.playersData.activePlayer,
  players: store.playersData.players,
  isDone: store.board.isDone,
});

export default connect(mapStateToProps)(JailControls);
