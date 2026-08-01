import React from 'react';
import { connect } from 'react-redux';
import style from '../../assets/css/notification.module.scss';

const NotificationDebugPanel = ({ notification }) => {
  return (
    <div style={{position: 'fixed', right: 10, bottom: 10, zIndex: 9999, background: 'rgba(0,0,0,0.6)', color:'#fff', padding:8, borderRadius:6, fontSize:12}}>
      <div><strong>Notification:</strong></div>
      <div>{notification && notification.show ? 'Shown' : 'Hidden'}</div>
      <div>{notification ? JSON.stringify(notification) : 'null'}</div>
    </div>
  );
};

const mapStateToProps = store => ({ notification: store.notification });

export default connect(mapStateToProps)(NotificationDebugPanel);
