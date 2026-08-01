import { connect } from 'react-redux';
import style from '../../assets/css/game-over.module.scss';

const GameOverOverlay = ({ gameOver, winner, players }) => {
  if (!gameOver) return null;
  const winnerName = winner != null ? players[winner]?.name : null;

  return (
    <div className={style.overlay}>
      <div className={style.confetti} aria-hidden="true">
        {Array.from({ length: 40 }).map((_, i) => (
          <span
            key={i}
            style={{
              left: `${(i * 53) % 100}%`,
              animationDelay: `${(i % 10) * 90}ms`,
              background: ['#ffd54f', '#ff8a65', '#4fc3f7', '#81c784', '#ba68c8', '#ff6b6b'][i % 6],
            }}
          />
        ))}
      </div>
      <div className={style.card}>
        <div className={style.trophy}>🏆</div>
        <div className={style.title}>Game Over</div>
        <div className={style.subtitle}>
          {winnerName ? `${winnerName} wins the game!` : 'The game has ended.'}
        </div>
      </div>
    </div>
  );
};

const mapStateToProps = (store) => ({
  gameOver: store.gameMeta?.gameOver,
  winner: store.gameMeta?.winner,
  players: store.playersData.players,
});

export default connect(mapStateToProps)(GameOverOverlay);
