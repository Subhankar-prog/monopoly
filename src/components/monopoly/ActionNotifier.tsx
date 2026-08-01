import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import style from '../../assets/css/notification.module.scss';
import { hideNotification } from '../../redux/actions/notification';

const ICON_MAP = {
  credit: '💰',
  debit: '💸',
  buy: '🏆',
  sell: '🏷️',
  move: '🚗',
  mortgage: '🏦',
  redeem: '💳',
  build: '🏗️',
  jail: '⛓️',
  chance: '🎴',
  chest: '📦',
  info: '🔔',
};

const HEADER_LABEL = {
  credit: 'Credits Added',
  debit: 'Payment Sent',
  buy: 'Property Won!',
  sell: 'Sale Successful',
  move: 'Player Moved',
  mortgage: 'Mortgage Taken',
  redeem: 'Mortgage Redeemed',
  build: 'Building Added',
  jail: 'Jail!',
  chance: 'Chance Card',
  chest: 'Community Chest',
  info: 'Game Update',
};

const FOOTER_NOTE = {
  credit: 'Added to your balance',
  debit: 'Amount deducted',
  buy: 'Property purchased successfully',
  sell: 'Sale completed',
  build: 'House/hotel built',
  mortgage: 'Property mortgaged',
  redeem: 'Mortgage redeemed',
  jail: 'Jail action',
  chance: 'Chance card revealed',
  chest: 'Community Chest card revealed',
  move: 'Player moved',
};

const ActionNotifier = ({ notification, modalData, hideNotification }) => {
  const tier = notification?.tier === 'toast' ? 'toast' : 'big';
  const duration = tier === 'toast' ? 2600 : 5200;
  const [progressKey, setProgressKey] = useState(0);

  useEffect(() => {
    if (notification && notification.show) {
      setProgressKey((k) => k + 1);
      const t = setTimeout(() => {
        hideNotification();
      }, duration);
      return () => clearTimeout(t);
    }
  }, [notification, hideNotification, duration]);

  if (!notification || !notification.show) return null;
  if (modalData?.showModal) return null; // don't render over a blocking modal; state is preserved so it can reappear once the modal closes

  const kind = notification.kind || 'info';
  const isCardDraw = kind === 'chance' || kind === 'chest';
  const amount = notification.amount != null ? notification.amount : '';
  const hasAmount = notification.amount != null && notification.amount !== 0;
  const isLoss = kind === 'debit' || kind === 'build' || kind === 'jail' || kind === 'redeem';
  const amountPrefix = isLoss ? '-' : hasAmount ? '+' : '';
  const showConfetti = tier === 'big' && (kind === 'buy' || kind === 'credit');
  const showCoins = hasAmount;
  const handleClose = () => hideNotification();

  // ── Compact toast: routine actions (rent, mortgage, build, doubles...) ──
  if (tier === 'toast') {
    return (
      <div className={style.toastLayer}>
        <div
          key={notification.title + notification.message}
          className={`${style.toast} ${style['toast_' + kind] || ''}`}
        >
          <span className={style.toastIcon}>{ICON_MAP[kind] || '🔔'}</span>
          <div className={style.toastBody}>
            <div className={style.toastTitle}>{notification.title}</div>
            {notification.message && <div className={style.toastMessage}>{notification.message}</div>}
          </div>
          {hasAmount && (
            <div className={`${style.toastAmount} ${isLoss ? style.toastAmountLoss : style.toastAmountGain}`}>
              {amountPrefix}${amount}
            </div>
          )}
          <button className={style.toastClose} onClick={handleClose} aria-label="Dismiss">
            ×
          </button>
          <div key={progressKey} className={style.toastProgress} style={{ animationDuration: `${duration}ms` }} />
        </div>
      </div>
    );
  }

  // ── Big reveal: cards, purchases, jail, bankruptcy, trades, game events ──
  return (
    <div className={style.overlay}>
      <div className={style.backdrop} onClick={handleClose} />
      <div className={style.glowRing} aria-hidden="true" />
      <div
        key={notification.title + notification.message}
        className={`${style.card} ${style.pulse} ${style[kind] || style.info} ${kind === 'jail' ? style.shake : ''}`}
      >
        {showConfetti && (
          <div className={style.confetti} aria-hidden="true">
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={i}
                className={i % 3 === 0 ? style.confettiTri : ''}
                style={{
                  left: `${(i * 83) % 100}%`,
                  animationDelay: `${(i % 8) * 60}ms`,
                  background: ['#ffd54f', '#ff8a65', '#4fc3f7', '#81c784', '#ba68c8', '#ff6b9d'][i % 6],
                }}
              />
            ))}
          </div>
        )}
        <div className={style.ribbon}>
          <span className={style.ribbonIcon}>{ICON_MAP[kind]}</span>
          {HEADER_LABEL[kind] || 'Game Update'}
        </div>
        <button className={style.closeButton} onClick={handleClose} aria-label="Close notification">
          ×
        </button>

        {isCardDraw ? (
          <>
            <div className={style.cardIcon} key={notification.title}>
              <span className={style.cardIconCornerTL}>{kind === 'chest' ? '📦' : '🎴'}</span>
              <span className={style.cardIconGlyph}>{ICON_MAP[kind]}</span>
              <span className={style.cardIconLabel}>{kind === 'chest' ? 'COMMUNITY CHEST' : 'CHANCE'}</span>
              <span className={style.cardIconCornerBR}>{kind === 'chest' ? '📦' : '🎴'}</span>
              <div className={style.cardSheen} aria-hidden="true" />
            </div>
            <div className={style.message}>{notification.message}</div>
          </>
        ) : (
          <div className={style.header}>
            <span className={style.badge}>{ICON_MAP[kind]}</span>
            <div className={style.titleGroup}>
              <span className={style.title}>{notification.title || 'Action Complete'}</span>
              {notification.message && <span className={style.subtitle}>{notification.message}</span>}
            </div>
          </div>
        )}

        {hasAmount && (
          <div className={style.amountBlock}>
            <div className={style.amountLabel}>Amount</div>
            <div className={style.amountValueBlock}>
              <span className={style.currency}>$</span>
              <span className={`${style.amountValue} ${isLoss ? style.amountValueLoss : style.amountValueGain}`}>
                {amountPrefix}{amount}
              </span>
            </div>
            {showCoins && (
              <div className={style.coins} aria-hidden="true">
                <span className={`${style.coin} ${isLoss ? style.coinDebit : ''}`} />
                <span className={`${style.coin} ${isLoss ? style.coinDebit : ''}`} />
                <span className={`${style.coin} ${isLoss ? style.coinDebit : ''}`} />
              </div>
            )}
          </div>
        )}

        <div className={style.noteFooter}>
          {FOOTER_NOTE[kind] || 'Action completed'}
        </div>

        <div key={progressKey} className={style.bigProgressTrack}>
          <div className={style.bigProgressFill} style={{ animationDuration: `${duration}ms` }} />
        </div>
      </div>
    </div>
  );
};

const mapStateToProps = store => ({
  notification: store.notification,
  modalData: store.modalData,
});
const mapDispatchToProps = dispatch => ({
  hideNotification: () => dispatch(hideNotification()),
});
export default connect(mapStateToProps, mapDispatchToProps)(ActionNotifier);
