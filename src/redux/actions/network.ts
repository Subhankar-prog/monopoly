import {
  SET_ROOM_CODE,
  SET_MY_PLAYER_ID,
  SET_CONNECTED,
  SET_IS_HOST,
  SET_ROOM_PLAYERS,
  SET_ROOM_HOST,
  SET_IS_MULTIPLAYER,
} from './actionTypes';

export const setRoomCode = (roomCode: string) => ({
  type: SET_ROOM_CODE,
  payload: roomCode,
});

export const setMyPlayerId = (playerId: number) => ({
  type: SET_MY_PLAYER_ID,
  payload: playerId,
});

export const setConnected = (isConnected: boolean) => ({
  type: SET_CONNECTED,
  payload: isConnected,
});

export const setIsHost = (isHost: boolean) => ({
  type: SET_IS_HOST,
  payload: isHost,
});

export const setRoomPlayers = (players: any[]) => ({
  type: SET_ROOM_PLAYERS,
  payload: players,
});

export const setRoomHost = (hostSocketId: string) => ({
  type: SET_ROOM_HOST,
  payload: hostSocketId,
});

export const setIsMultiplayer = (isMultiplayer: boolean) => ({
  type: SET_IS_MULTIPLAYER,
  payload: isMultiplayer,
});
