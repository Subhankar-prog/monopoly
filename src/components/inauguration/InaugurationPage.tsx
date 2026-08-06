import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import style from '../../assets/css/inauguration.module.scss';

const SECRET_KEY = 'inauguration2025';

// ──────────────────────────────────────────────
// Cinematic slide data
// ──────────────────────────────────────────────
const SLIDES = [
  { main: 'Welcome to', sub: null, voice: 'Welcome  too', duration: 2600 },
  { main: 'The Inaguration of', sub: null, voice: 'The  Inauguration  of', duration: 2800 },
  { main: 'Most Awaited Monopoly Game', sub: 'of Odisha', voice: 'The most awaited  Monopoly game  of  O-dee-sha', duration: 3400, gold: true },
  { main: 'Developed By', sub: 'Subhankar', voice: 'Developed  by  Subhha-ka.', duration: 3400, gold: true },
  { main: 'Special Thanks to', sub: null, voice: 'Special  thanks  to', duration: 2000 },
  { main: 'BHAU · ROCKY · PINTU · BEN10', sub: null, voice: 'Bhaaou...  Roki ...  Pintuu ...  Ben  Ten', duration: 4000, names: true },
  { main: 'Grab your popcorn...', sub: null, voice: 'Grab  your  popcorn', duration: 2800, italic: true },
  { main: 'We are about to start', sub: null, voice: 'We  are  about  to  start', duration: 2600 },
] as const;

const FADE_MS = 700;

// ──────────────────────────────────────────────
// Voice narrator — dead simple, no async, no caching..
// ──────────────────────────────────────────────
function speak(text: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    const ss = window.speechSynthesis;

    // Only cancel if actively speaking (avoids locking Chrome)
    if (ss.speaking) ss.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.85;
    utt.pitch = 1.05;
    utt.volume = 1;

    // Pick voice — browser already has them cached by now
    const voices = ss.getVoices();
    const voice =
      voices.find(v => /heera/i.test(v.name)) ?? // Indian female (Windows)
      voices.find(v => /ravi/i.test(v.name)) ?? // Indian male  (Windows)
      voices.find(v => v.lang === 'en-IN') ?? // Any Indian English
      voices.find(v => /google uk english female/i.test(v.name)) ?? // Google female GB
      voices.find(v => v.lang.startsWith('en') && /female/i.test(v.name)) ??
      voices.find(v => v.lang === 'en-GB') ??
      voices.find(v => v.lang.startsWith('en')) ??
      null;
    if (voice) utt.voice = voice;

    ss.speak(utt);
  } catch (_) { }
}

// ──────────────────────────────────────────────
// Natural applause synthesizer
// ──────────────────────────────────────────────
function playClap() {
  try {
    const actx = new AudioContext();
    const slap = (startSec: number, vol: number) => {
      const sr = actx.sampleRate;
      const len = Math.floor(sr * 0.14);
      const buf = actx.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          const t = i / sr;
          const env = i < sr * 0.003
            ? i / (sr * 0.003)
            : Math.exp(-(t - 0.003) * 28);
          d[i] = (Math.random() * 2 - 1) * env;
        }
      }
      const src = actx.createBufferSource();
      src.buffer = buf;
      const bp1 = actx.createBiquadFilter(); bp1.type = 'bandpass'; bp1.frequency.value = 900 + Math.random() * 200; bp1.Q.value = 0.7;
      const bp2 = actx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 2600 + Math.random() * 400; bp2.Q.value = 0.5;
      const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
      const delay = actx.createDelay(0.4); delay.delayTime.value = 0.06 + Math.random() * 0.04;
      const delGain = actx.createGain(); delGain.gain.value = 0.22;
      const g = actx.createGain();
      g.gain.setValueAtTime(vol, startSec);
      g.gain.exponentialRampToValueAtTime(0.001, startSec + 0.32);
      src.connect(hp); hp.connect(bp1); hp.connect(bp2);
      bp1.connect(g); bp2.connect(g);
      g.connect(actx.destination); g.connect(delay);
      delay.connect(delGain); delGain.connect(actx.destination);
      src.start(startSec);
    };
    const now = actx.currentTime;
    for (let i = 0; i < 18; i++) slap(now + i * (0.06 + Math.random() * 0.05), 0.55 + Math.random() * 0.45);
  } catch (_) { }
}

// ──────────────────────────────────────────────
// Continuous rocket fireworks engine
// ──────────────────────────────────────────────
interface Particle { x: number; y: number; vx: number; vy: number; alpha: number; color: string; radius: number; }
interface Rocket { x: number; y: number; vy: number; color: string; trail: { x: number; y: number; a: number }[]; }

function startContinuousFireworks(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!;
  let W = (canvas.width = window.innerWidth);
  let H = (canvas.height = window.innerHeight);
  const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
  window.addEventListener('resize', onResize);
  const colors = ['#FFD700', '#FF4444', '#FF1493', '#FF8C00', '#FFFFFF', '#00E5FF', '#76FF03', '#FF6B6B', '#DA70D6', '#7FFFD4', '#FFF176', '#FF0080', '#39FF14', '#FF6600', '#BF5FFF'];
  const particles: Particle[] = [];
  const rockets: Rocket[] = [];

  function burst(cx: number, cy: number, baseColor: string) {
    const count = 130 + Math.random() * 90;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = 1.5 + Math.random() * 6.5;
      particles.push({ x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, alpha: 1, color: Math.random() > 0.4 ? baseColor : colors[Math.floor(Math.random() * colors.length)], radius: 1.5 + Math.random() * 3.5 });
    }
  }
  function launchRocket() {
    rockets.push({ x: 80 + Math.random() * (W - 160), y: H + 10, vy: -(7 + Math.random() * 7), color: colors[Math.floor(Math.random() * colors.length)], trail: [] });
  }
  const launchInterval = setInterval(launchRocket, 600);
  launchRocket(); launchRocket(); launchRocket();
  let raf: number;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.trail.push({ x: r.x, y: r.y, a: 1 });
      r.y += r.vy; r.vy += 0.15;
      r.trail.forEach(t => { t.a -= 0.06; if (t.a <= 0) return; ctx.save(); ctx.globalAlpha = t.a * 0.7; ctx.beginPath(); ctx.arc(t.x, t.y, 2.5, 0, Math.PI * 2); ctx.fillStyle = r.color; ctx.shadowColor = r.color; ctx.shadowBlur = 6; ctx.fill(); ctx.restore(); });
      r.trail = r.trail.filter(t => t.a > 0);
      ctx.save(); ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(r.x, r.y, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.shadowColor = r.color; ctx.shadowBlur = 12; ctx.fill(); ctx.restore();
      if (r.vy >= 0) { burst(r.x, r.y, r.color); rockets.splice(i, 1); }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.99; p.alpha -= 0.011;
      if (p.alpha <= 0) { particles.splice(i, 1); continue; }
      ctx.save(); ctx.globalAlpha = p.alpha; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10; ctx.fill(); ctx.restore();
    }
    raf = requestAnimationFrame(draw);
  }
  draw();
  return () => { clearInterval(launchInterval); cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
}

// ──────────────────────────────────────────────
// Balloon SVG
// ──────────────────────────────────────────────
const BALLOON_COLORS = [
  ['#FF6B6B', '#FF3333'], ['#FFD700', '#FFA000'], ['#76FF03', '#43A047'],
  ['#00E5FF', '#0097A7'], ['#DA70D6', '#8E24AA'], ['#FF8C00', '#E65100'],
  ['#FF1493', '#C2185B'], ['#7FFFD4', '#00897B'], ['#FF6600', '#CC4400'],
];

function BalloonSvg({ colors, size, swayDir }: { colors: string[]; size: number; swayDir: number }) {
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 60 82">
      <ellipse cx="30" cy="28" rx="26" ry="28" fill={colors[0]} stroke={colors[1]} strokeWidth="1.5" />
      <ellipse cx="20" cy="15" rx="8" ry="6" fill="rgba(255,255,255,0.38)" />
      <path d="M28 56 Q30 61 32 56" fill={colors[1]} />
      <path d={`M30 57 Q${24 + swayDir * 5} 67 ${30 - swayDir * 5} 80`} stroke={colors[1]} strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Balloons() {
  const left = Array.from({ length: 6 }, (_, i) => ({ id: `l${i}`, colors: BALLOON_COLORS[i % BALLOON_COLORS.length], xPct: 0.5 + (i % 3) * 3.5, bottomPct: 5 + i * 14, delay: i * 0.9, duration: 8 + (i * 1.2) % 4, size: 36 + (i * 8) % 22, swayDir: i % 2 === 0 ? 1 : -1 }));
  const right = Array.from({ length: 6 }, (_, i) => ({ id: `r${i}`, colors: BALLOON_COLORS[(i + 4) % BALLOON_COLORS.length], xPct: 0.5 + (i % 3) * 3.5, bottomPct: 5 + i * 14, delay: 0.5 + i * 0.85, duration: 9 + (i * 1.1) % 4, size: 34 + (i * 9) % 24, swayDir: i % 2 === 0 ? -1 : 1 }));
  const bottom = Array.from({ length: 7 }, (_, i) => ({ id: `b${i}`, colors: BALLOON_COLORS[(i + 2) % BALLOON_COLORS.length], leftPct: 15 + i * 10.5, delay: i * 0.6, duration: 6 + (i * 1.4) % 5, size: 32 + (i * 6) % 20, swayDir: i % 2 === 0 ? 1 : -1 }));
  return (
    <>
      {left.map(b => <div key={b.id} className={style.balloonSide} style={{ left: `${b.xPct}%`, bottom: `${b.bottomPct}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s`, '--sway': `${b.swayDir * 12}px` } as React.CSSProperties}><BalloonSvg colors={b.colors} size={b.size} swayDir={b.swayDir} /></div>)}
      {right.map(b => <div key={b.id} className={style.balloonSide} style={{ right: `${b.xPct}%`, bottom: `${b.bottomPct}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s`, '--sway': `${b.swayDir * 12}px` } as React.CSSProperties}><BalloonSvg colors={b.colors} size={b.size} swayDir={b.swayDir} /></div>)}
      {bottom.map(b => <div key={b.id} className={style.balloonBottom} style={{ left: `${b.leftPct}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s`, '--sway': `${b.swayDir * 14}px` } as React.CSSProperties}><BalloonSvg colors={b.colors} size={b.size} swayDir={b.swayDir} /></div>)}
    </>
  );
}

// ──────────────────────────────────────────────
// Custom Scissor Cursor
// ──────────────────────────────────────────────
function ScissorCursor({ snipping }: { snipping: boolean }) {
  const [pos, setPos] = useState({ x: -200, y: -200 });
  useEffect(() => {
    const move = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);
  return (
    <div className={`${style.customCursor} ${snipping ? style.cursorSnip : ''}`} style={{ left: pos.x, top: pos.y }} aria-hidden>
      <svg viewBox="0 0 48 48" width="44" height="44">
        <g style={{ transformOrigin: '20px 24px', transform: snipping ? 'rotate(-22deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
          <ellipse cx="30" cy="20" rx="14" ry="4.5" fill="#D0D0D0" stroke="#888" strokeWidth="1.2" transform="rotate(-20 30 20)" />
          <circle cx="18" cy="16" r="5" fill="none" stroke="#C0C0C0" strokeWidth="2" />
        </g>
        <g style={{ transformOrigin: '20px 24px', transform: snipping ? 'rotate(22deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
          <ellipse cx="30" cy="28" rx="14" ry="4.5" fill="#D0D0D0" stroke="#888" strokeWidth="1.2" transform="rotate(20 30 28)" />
          <circle cx="18" cy="32" r="5" fill="none" stroke="#C0C0C0" strokeWidth="2" />
        </g>
        <circle cx="20" cy="24" r="2.5" fill="#FFD700" stroke="#B8860B" strokeWidth="1" />
        <line x1="20" y1="24" x2="4" y2="24" stroke="#C0C0C0" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// ──────────────────────────────────────────────
// Cinematic Intro Slides
// ──────────────────────────────────────────────
function IntroSlides({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [vis, setVis] = useState<'in' | 'hold' | 'out'>('in');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  useEffect(() => {
    // Prime the voice engine on mount — Chrome loads voices lazily
    // Calling getVoices() + a dummy utterance ensures the list is ready
    window.speechSynthesis?.getVoices();
    // Also speak a silent/empty utterance to unlock audio context on some browsers
  }, []);

  useEffect(() => {
    clear();
    if (idx >= SLIDES.length) { onDone(); return; }
    const slide = SLIDES[idx];

    // Speak after small delay so voice aligns with text appear
    const tSpeak = setTimeout(() => speak(slide.voice), 120);

    // hold after fade-in
    const tHold = setTimeout(() => setVis('hold'), FADE_MS);
    // start fade-out
    const tOut = setTimeout(() => setVis('out'), slide.duration - FADE_MS);
    // advance slide
    const tNext = setTimeout(() => { setIdx(i => i + 1); setVis('in'); }, slide.duration);

    timers.current = [tSpeak, tHold, tOut, tNext];
    return clear;
  }, [idx]);// eslint-disable-line

  if (idx >= SLIDES.length) return null;
  const slide = SLIDES[idx];

  return (
    <div className={style.introWrap}>
      {/* Star field background */}
      <div className={style.starField} />

      {/* Thin horizontal bar accent */}
      <div className={`${style.introAccent} ${style['introAccent_' + vis]}`} />

      <div className={`${style.introSlide} ${style['slide_' + vis]}`}>
        <p className={`${style.introMain} ${'gold' in slide && slide.gold ? style.introGold : ''} ${'italic' in slide && slide.italic ? style.introItalic : ''} ${'names' in slide && slide.names ? style.introNames : ''}`}>
          {slide.main}
        </p>
        {slide.sub && (
          <p className={style.introSub}>{slide.sub}</p>
        )}
      </div>

      {/* Slide counter dots */}
      <div className={style.introDots}>
        {SLIDES.map((_, i) => (
          <span key={i} className={`${style.introDot} ${i === idx ? style.introDotActive : i < idx ? style.introDotDone : ''}`} />
        ))}
      </div>

      {/* Skip button */}
      <button className={style.skipBtn} onClick={() => { window.speechSynthesis?.cancel(); clear(); onDone(); }}>
        Skip Intro ›
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
type Phase = 'ready' | 'intro' | 'curtain' | 'cutting' | 'open' | 'welcome';

export default function InaugurationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopFireworksRef = useRef<(() => void) | null>(null);

  const [phase, setPhase] = useState<Phase>('ready');
  const [snipping, setSnipping] = useState(false);

  useEffect(() => {
    if (searchParams.get('key') !== SECRET_KEY) navigate('/', { replace: true });
  }, [searchParams, navigate]);

  useEffect(() => () => { stopFireworksRef.current?.(); }, []);

  // After intro → play clap then show curtain
  const handleIntroDone = useCallback(() => {
    window.speechSynthesis?.cancel();
    playClap();
    setPhase('curtain');
  }, []);

  const handleCut = useCallback(() => {
    if (phase !== 'curtain') return;
    setSnipping(true);
    setPhase('cutting');
    playClap();
    setTimeout(() => setPhase('open'), 800);
    setTimeout(() => {
      if (canvasRef.current) {
        const stop = startContinuousFireworks(canvasRef.current);
        stopFireworksRef.current = stop;
      }
    }, 900);
    setTimeout(() => setPhase('welcome'), 2100);
  }, [phase]);

  if (searchParams.get('key') !== SECRET_KEY) return null;

  const isCut = phase === 'cutting' || phase === 'open' || phase === 'welcome';
  const showCurtain = phase === 'curtain' || isCut;

  return (
    <div className={style.inaugWrap}>

      {/* ── READY screen ── */}
      {phase === 'ready' && (
        <div className={style.readyScreen}>
          <div className={style.readyGlow} />
          <div className={style.readyLogo}>🎭</div>
          <h2 className={style.readyTitle}>Heavy Business</h2>
          <p className={style.readySubtitle}>Monopoly · Odisha Edition</p>
          <button
            className={style.readyBtn}
            onClick={() => setPhase('intro')}
          >
            ▶ &nbsp;Begin Experience
          </button>
          <p className={style.readyHint}>🔊 Turn your volume up for the best experience</p>
        </div>
      )}

      {/* ── INTRO slides ── */}
      {phase === 'intro' && <IntroSlides onDone={handleIntroDone} />}

      {/* ── CURTAIN + RIBBON + WELCOME ── */}
      {showCurtain && (
        <>
          {/* Scissor cursor */}
          {!isCut && <ScissorCursor snipping={snipping} />}

          {/* Fireworks canvas */}
          <canvas ref={canvasRef} className={style.fireworkCanvas} />

          {/* Balloons */}
          {!isCut && <Balloons />}

          {/* Curtain panels */}
          <div className={`${style.curtainLeft}  ${isCut ? style.slideLeft : ''}`}>
            {!isCut && <div className={style.windRipples} />}
          </div>
          <div className={`${style.curtainRight} ${isCut ? style.slideRight : ''}`}>
            {!isCut && <div className={style.windRipples} />}
          </div>

          {/* Floating hint */}
          {!isCut && (
            <div className={style.floatingScreen}>
              <div className={style.screenInner}>
                <span className={style.screenText}>✂ Click the ribbon to begin</span>
              </div>
            </div>
          )}

          {/* Ribbon */}
          <div
            className={`${style.ribbon} ${isCut ? style.ribbonCut : ''}`}
            onClick={!isCut ? handleCut : undefined}
          >
            <div className={`${style.ribbonHalf} ${style.ribbonLeft} ${isCut ? style.ribbonHalfCutLeft : ''}`}>
              <div className={style.ribbonStitch} />
            </div>

            {!isCut && (
              <div className={style.ribbonRosette}>
                <svg viewBox="0 0 100 100" width="88" height="88">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <ellipse key={i} cx="50" cy="22" rx="7" ry="14"
                      fill={i % 2 === 0 ? '#FFD700' : '#FFA000'} stroke="#B8860B" strokeWidth="0.6"
                      transform={`rotate(${i * 22.5} 50 50)`} opacity="0.92" />
                  ))}
                  <circle cx="50" cy="50" r="18" fill="#C0392B" stroke="#FFD700" strokeWidth="2.5" />
                  <circle cx="50" cy="50" r="11" fill="#FFD700" stroke="#B8860B" strokeWidth="1.5" />
                  <circle cx="50" cy="50" r="4" fill="#fff" />
                </svg>
              </div>
            )}

            <div className={`${style.ribbonHalf} ${style.ribbonRight} ${isCut ? style.ribbonHalfCutRight : ''}`}>
              <div className={style.ribbonStitch} />
            </div>
          </div>

          {/* Welcome reveal */}
          {(phase === 'open' || phase === 'welcome') && (
            <div className={`${style.welcomeStage} ${phase === 'welcome' ? style.welcomeVisible : ''}`}>
              <div className={style.crownIcon}>👑</div>
              <h1 className={style.welcomeTitle}>Welcome to the Grand<br /><span className={style.gameName}>Inauguration</span></h1>
              <div className={style.dividerLine} />
              <h2 className={style.gameSubtitle}>🎉&nbsp;<span className={style.heavyBusiness}>HEAVY BUSINESS</span>&nbsp;🎉</h2>
              <p className={style.tagline}>The board game experience you've been waiting for is finally here.</p>
              <button className={style.playBtn} onClick={() => navigate('/')}>Enter the Game →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
