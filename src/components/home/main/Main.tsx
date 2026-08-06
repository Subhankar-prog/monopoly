import style from '../../../assets/css/home/main.module.scss';

const FLOATING_TILES = [
  { top: '14%', left: '7%', rotate: -14, color: '#c1483f', delay: '0s' },
  { top: '68%', left: '4%', rotate: 10, color: '#226042', delay: '1.1s' },
  { top: '20%', right: '6%', rotate: 12, color: '#d9a94f', delay: '0.6s' },
  { top: '62%', right: '9%', rotate: -9, color: '#29618f', delay: '1.7s' },
  { top: '85%', left: '22%', rotate: 6, color: '#8a4fbf', delay: '2.2s' },
];

const STEPS = [
  {
    n: '01',
    title: 'Roll & move',
    body: 'Two dice, real-time, no waiting around — the board updates live for everyone at the table.',
  },
  {
    n: '02',
    title: 'Buy & build',
    body: 'Claim property as you land on it, corner a color group, then put up houses and hotels.',
  },
  {
    n: '03',
    title: 'Bankrupt rivals',
    body: 'Collect rent, strike trades, and force the table into debt — last player solvent wins.',
  },
];

const Main = () => {
  return (
    <div className={style.main}>
      <section className={style.hero}>
        {/* Odisha Heritage Konark Sun Wheel Watermark */}
        <div className={style.konarkWatermark} aria-hidden="true">
          <svg viewBox="0 0 200 200" className={style.konarkWheelSvg}>
            <circle cx="100" cy="100" r="90" fill="none" stroke="#d4af37" strokeWidth="2" strokeDasharray="6 3" opacity="0.25" />
            <circle cx="100" cy="100" r="75" fill="none" stroke="#d4af37" strokeWidth="1.5" opacity="0.2" />
            <circle cx="100" cy="100" r="25" fill="none" stroke="#d4af37" strokeWidth="2" opacity="0.3" />
            {[...Array(12)].map((_, idx) => (
              <line
                key={idx}
                x1="100"
                y1="100"
                x2={100 + 88 * Math.cos((idx * 30 * Math.PI) / 180)}
                y2={100 + 88 * Math.sin((idx * 30 * Math.PI) / 180)}
                stroke="#d4af37"
                strokeWidth="1.8"
                opacity="0.22"
              />
            ))}
          </svg>
        </div>

        <div className={style.tileField} aria-hidden="true">
          {FLOATING_TILES.map((t, i) => (
            <div
              key={i}
              className={style.floatingTile}
              style={{
                top: t.top,
                left: t.left,
                right: t.right,
                transform: `rotate(${t.rotate}deg)`,
                animationDelay: t.delay,
              }}
            >
              <span className={style.floatingTileBand} style={{ background: t.color }} />
              <span className={style.floatingTileLine} />
              <span className={style.floatingTileLineShort} />
            </div>
          ))}
        </div>

        <div className={style.heroContent}>
          <span className={style.eyebrow}>
            <span className={style.odishaDot}>🪔</span> Odisha Heritage Edition · Real-Time Monopoly
          </span>
          <h1 className={style.headline}>
            Own the board.
            <br />
            Bankrupt the table.
          </h1>
          <p className={style.subhead}>
            Heavy Business is property trading at full speed — roll, buy, build, and
            negotiate with 2–6 players in real time. No download, no signup, no ads.
          </p>
          <div className={style.ctaRow}>
            <a href="/lobby" className={style.btnPrimary}>
              Play Now
            </a>
            <a href="#how-it-works" className={style.btnGhost}>
              How it works
            </a>
          </div>
          <div className={style.statRow}>
            <div className={style.stat}>
              <span className={style.statValue}>2–6</span>
              <span className={style.statLabel}>Players</span>
            </div>
            <div className={style.statDivider} />
            <div className={style.stat}>
              <span className={style.statValue}>Live</span>
              <span className={style.statLabel}>Real-time board</span>
            </div>
            <div className={style.statDivider} />
            <div className={style.stat}>
              <span className={style.statValue}>$0</span>
              <span className={style.statLabel}>To play</span>
            </div>
          </div>
        </div>
      </section>

      <section className={style.howItWorks} id="how-it-works">
        <p className={style.sectionEyebrow}>How a game plays out</p>
        <div className={style.stepsRow}>
          {STEPS.map(step => (
            <div className={style.step} key={step.n}>
              <span className={style.stepNumber}>{step.n}</span>
              <h3 className={style.stepTitle}>{step.title}</h3>
              <p className={style.stepBody}>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={style.closing}>
        <h2 className={style.closingTitle}>Pull up a seat.</h2>
        <p className={style.closingBody}>
          Start a table with friends or drop into a room with a code — the board's
          waiting.
        </p>
        <a href="/lobby" className={style.btnPrimary}>
          Play Now
        </a>
      </section>
    </div>
  );
};

export default Main;
