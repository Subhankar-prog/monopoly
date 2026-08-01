// Same pattern as trades.ts — server-authoritative, assigned in rootReducer's
// SYNC_GAME_STATE branch, this default just keeps the key alive otherwise.
const initialState = {
  mustRollAgain: false,
  gameOver: false,
  winner: null as number | null,
};

export default function gameMeta(state = initialState, _action: any) {
  return state;
}
