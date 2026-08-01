import style from '../../../assets/css/dice.module.scss';

// Standard 3x3 pip layouts per face, matching a real die.
const PIP_LAYOUTS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const Dice = ({ number }) => {
  const activeCells = PIP_LAYOUTS[number] || PIP_LAYOUTS[1];
  return (
    <div className={style.dice}>
      <div className={style.pipGrid}>
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className={`${style.pip} ${activeCells.includes(i) ? style.pipOn : ''}`} />
        ))}
      </div>
    </div>
  );
};
export default Dice;
