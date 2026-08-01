// Trades are entirely server-authoritative; this slice just holds whatever
// the last SYNC_GAME_STATE handed us. The actual assignment happens in
// rootReducer's SYNC_GAME_STATE branch — this default keeps the key alive
// across every other action so combineReducers doesn't drop it.
const initialState: any[] = [];

export default function trades(state = initialState, _action: any) {
  return state;
}
