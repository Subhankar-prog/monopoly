// Server-authoritative, like trades.ts and gameMeta.ts — assigned directly
// in rootReducer's SYNC_GAME_STATE branch. This default keeps the key alive
// across every other action so combineReducers doesn't drop it.
const initialState: any = null;

export default function currentAuction(state = initialState, _action: any) {
  return state;
}
