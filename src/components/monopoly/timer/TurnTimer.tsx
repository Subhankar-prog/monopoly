import React, { useEffect, useRef, useState } from 'react';
import { connect } from 'react-redux';
import style from '../../../assets/css/turn-timer.module.scss';
import { setActivePlayer } from '../../../redux/actions/player';
import { setIsDone } from '../../../redux/actions/board';
import { emitEndTurn } from '../../../network/socket';
import { colors } from '../../../utility/constants';

const TURN_DURATION = 60; // seconds per turn

// SVG ring math: r=30, circumference = 2 * π * 30 ≈ 188.5
const RADIUS = 30;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const TurnTimer = ({
  activePlayer,
  playersData,
  network,
  setActivePlayer,
  setIsDone,
}: any) => {
  const [secondsLeft, setSecondsLeft] = useState(TURN_DURATION);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activePlayerRef = useRef(activePlayer);

  // Reset timer whenever the active player changes
  useEffect(() => {
    activePlayerRef.current = activePlayer;
    setSecondsLeft(TURN_DURATION);
  }, [activePlayer]);

  // Count-down tick
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Timer expired — auto end turn
          handleExpire();
          return TURN_DURATION; // reset visually while turn transitions
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlayer]);

  const handleExpire = () => {
    const isMyTurn =
      !network.isMultiplayer ||
      network.myPlayerId === activePlayerRef.current;

    if (!isMyTurn) return; // only the active player's client ends the turn

    if (network.isMultiplayer && network.roomCode) {
      emitEndTurn(network.roomCode).catch(() => {});
    } else {
      setActivePlayer();
      setIsDone(false);
    }
  };

  // Visual state
  const progress = secondsLeft / TURN_DURATION; // 1.0 → 0.0
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  const isCritical = secondsLeft <= 10;
  const isWarning = !isCritical && secondsLeft <= 20;

  const arcClass = isCritical
    ? `${style.timerArc} ${style.timerArcCritical}`
    : isWarning
    ? `${style.timerArc} ${style.timerArcWarning}`
    : style.timerArc;

  const digitClass = isCritical
    ? `${style.timerDigits} ${style.timerDigitsCritical}`
    : isWarning
    ? `${style.timerDigits} ${style.timerDigitsWarning}`
    : style.timerDigits;

  const activePlayerName =
    playersData.players[activePlayer]?.name ||
    `Player ${activePlayer + 1}`;

  return (
    <div className={style.timerWrapper} title={`${activePlayerName}'s turn`}>
      <div className={style.timerLabel}>Turn Timer</div>
      <div className={style.timerRingContainer}>
        <svg className={style.timerRingSvg} viewBox="0 0 76 76">
          {/* Background ring */}
          <circle
            className={style.timerTrack}
            cx="38"
            cy="38"
            r={RADIUS}
          />
          {/* Progress arc */}
          <circle
            className={arcClass}
            cx="38"
            cy="38"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s ease' }}
          />
        </svg>
        <div className={digitClass}>{secondsLeft}</div>
      </div>
      <div className={style.timerPlayerLabel}>
        🎲 {activePlayerName}'s turn
      </div>
    </div>
  );
};

const mapStateToProps = (store: any) => ({
  activePlayer: store.playersData.activePlayer,
  playersData: store.playersData,
  network: store.network,
});

const mapDispatchToProps = (dispatch: any) => ({
  setActivePlayer: () => dispatch(setActivePlayer()),
  setIsDone: (v: any) => dispatch(setIsDone(v)),
});

export default connect(mapStateToProps, mapDispatchToProps)(TurnTimer);
