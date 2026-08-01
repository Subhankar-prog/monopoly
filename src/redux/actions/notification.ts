import { NOTIFICATION_SHOW, NOTIFICATION_HIDE } from './actionTypes';

export const showNotification = data => {
  return {
    type: NOTIFICATION_SHOW,
    payload: data,
  };
};

export const hideNotification = () => {
  return {
    type: NOTIFICATION_HIDE,
  };
};
