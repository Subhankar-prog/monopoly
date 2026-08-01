import {
  SET_ROOM_CODE,
  SET_MY_PLAYER_ID,
  SET_CONNECTED,
  SET_IS_HOST,
  SET_ROOM_PLAYERS,
  SET_ROOM_HOST,
  SET_IS_MULTIPLAYER,
} from '../actions/actionTypes';

const initialState = {
  roomCode: null as string | null,
  myPlayerId: null as number | null,
  isConnected: false,
  isHost: false,
  isMultiplayer: false,
  roomPlayers: [] as any[],
  hostSocketId: null as string | null,
};

function network(state = initialState, action: any) {
  const { type, payload } = action;
  switch (type) {
    case SET_ROOM_CODE:
      return { ...state, roomCode: payload };
    case SET_MY_PLAYER_ID:
      return { ...state, myPlayerId: payload };
    case SET_CONNECTED:
      return { ...state, isConnected: payload };
    case SET_IS_HOST:
      return { ...state, isHost: payload };
    case SET_IS_MULTIPLAYER:
      return { ...state, isMultiplayer: payload };
    case SET_ROOM_PLAYERS:
      return { ...state, roomPlayers: payload };
    case SET_ROOM_HOST:
      return { ...state, hostSocketId: payload };
    default:
      return state;
  }
}

export default network;
