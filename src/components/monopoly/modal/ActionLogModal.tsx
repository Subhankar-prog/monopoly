import React from 'react';
import { connect } from 'react-redux';
import style from '../../../assets/css/action-log.module.scss';

const KIND_ICON: Record<string, string> = {
  debit: '💸',
  credit: '💰',
  buy: '🏆',
  sell: '🏷️',
  move: '🚗',
  info: '🔔',
  jail: '⛓️',
};

const ActionLogModal = ({ notification }: any) => {
  const history = notification?.logHistory || [];

  return (
    <div className={style.actionLogContainer}>
      {history.length === 0 ? (
        <div className={style.emptyLog}>No actions recorded yet in this session.</div>
      ) : (
        <div className={style.logList}>
          {history.map((item: any) => (
            <div key={item.id} className={style.logRow}>
              <span className={style.logTime}>{item.time}</span>
              <span className={style.logIcon}>{KIND_ICON[item.kind] || '📜'}</span>
              <div className={style.logDetails}>
                <span className={style.logTitle}>{item.title}</span>
                <span className={style.logMsg}>{item.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const mapStateToProps = (store: any) => ({
  notification: store.notification,
});

export default connect(mapStateToProps)(ActionLogModal);
