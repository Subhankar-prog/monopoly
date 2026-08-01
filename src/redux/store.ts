import { createStore } from 'redux';
// import thunk from "redux-thunk";
import rootReducer from './reducers/rootReducer';

// Declare the Redux DevTools extension type
declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION__?: () => any;
  }
}

let storeInstance: any = null;

export default function configureStore() {
  if (!storeInstance) {
    storeInstance = createStore(
      rootReducer,
      process.env.NODE_ENV === 'development' &&
        window.__REDUX_DEVTOOLS_EXTENSION__
        ? window.__REDUX_DEVTOOLS_EXTENSION__()
        : undefined
    );
    if (process.env.NODE_ENV === 'development') {
      (window as any).__store = storeInstance;
    }
  }
  return storeInstance;
}

