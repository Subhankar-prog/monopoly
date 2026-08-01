// import { delay } from "../playerUtility";

import { delay } from '../playerUtility';

export const calculatePlayersOnCurrentSite = (site, players, totalPlayers) => {
  const playersOnCurrentSite = {
    playerIds: [],
    count: 0,
  };
  for (let playerId = 0; playerId < totalPlayers; playerId++) {
    if (players[playerId].site === site) {
      playersOnCurrentSite.count++;
      playersOnCurrentSite.playerIds.push(playerId);
    }
  }
  return playersOnCurrentSite;
};

export const adjustHelper = (playersOnCurrentSite, currentPlayerId) => {
  let { count, playerIds } = playersOnCurrentSite;
  if (count > 0) {
    playerIds = playerIds.sort(function (a, b) {
      return a - b;
    });
    const idx = playerIds.indexOf(currentPlayerId);
    const gap = 10;
    return [idx * gap - ((count - 1) / 2) * gap, idx];
  } else {
    return [0, 1];
  }
};

export const updatePostionDataAccoringToPlayersOnThatSite = (
  positionData,
  players,
  totalPlayers,
  currentPlayerId
) => {
  const site = positionData.site;
  const playersOnCurrentSite = calculatePlayersOnCurrentSite(
    site,
    players,
    totalPlayers
  );
  const [adjust, zIndex] = adjustHelper(playersOnCurrentSite, currentPlayerId);
  positionData.zIndex = zIndex;
  if ((site >= 0 && site <= 9) || (site >= 20 && site <= 29)) {
    positionData.top -= adjust;
    positionData.bottom += adjust;
  } else if ((site >= 10 && site <= 19) || (site >= 30 && site <= 39)) {
    positionData.left -= adjust;
    positionData.right += adjust;
  }
  return positionData;
};

export const playPlayerMoveAudio = (playerMoveAudio, isMounted) => {
  if (isMounted) {
    playerMoveAudio.load();
    playerMoveAudio.play();
  }
};

export const setPlayerPositionHelper = (
  positionData,
  players,
  totalPlayers,
  currentPlayerId,
  playerRef,
  playerMoveAudio,
  isMounted
) => {
  playPlayerMoveAudio(playerMoveAudio, isMounted);
  positionData = updatePostionDataAccoringToPlayersOnThatSite(
    positionData,
    players,
    totalPlayers,
    currentPlayerId
  );
  playerRef.style.zIndex = positionData.zIndex;
  playerRef.style.top =
    positionData.top != null ? positionData.top + 'px' : 'unset';
  playerRef.style.right =
    positionData.right != null ? positionData.right + 'px' : 'unset';
  playerRef.style.bottom =
    positionData.bottom != null ? positionData.bottom + 'px' : 'unset';
  playerRef.style.left =
    positionData.left != null ? positionData.left + 'px' : 'unset';
};

export const setPlayerPosition = (
  site,
  positions,
  players,
  totalPlayers,
  currentPlayerId,
  playerRef,
  playerMoveAudio,
  isMounted
) => {
  const positionData = { ...positions[site] };
  setPlayerPositionHelper(
    positionData,
    players,
    totalPlayers,
    currentPlayerId,
    playerRef,
    playerMoveAudio,
    isMounted
  );
};

// How long a single-tile hop takes to animate. Real board-game movement
// reads as "walking" at this pace; much faster and it looks like teleporting
// (the original bug), much slower and short rolls feel sluggish.
const STEP_DELAY_MS = 220;
// Total animation time is capped so a rare long jump (e.g. a Chance card
// that walks the piece most of the way around the board) doesn't leave the
// player waiting many seconds — steps get proportionally quicker past this.
const MAX_TOTAL_ANIMATION_MS = 2600;

export const setPlayerPositionRecursiveHelper = async (
  path,
  positions,
  players,
  totalPlayers,
  currentPlayerId,
  playerRef,
  playerMoveAudio,
  isMounted,
  setIsMoving
) => {
  if (path.length === 0) {
    if (isMounted) setIsMoving(currentPlayerId, false);
    return;
  }

  const stepDelay = Math.max(
    45,
    Math.min(STEP_DELAY_MS, MAX_TOTAL_ANIMATION_MS / path.length)
  );

  for (let i = 0; i < path.length; i++) {
    if (!isMounted) return;
    setPlayerPosition(
      path[i],
      positions,
      players,
      totalPlayers,
      currentPlayerId,
      playerRef,
      playerMoveAudio,
      isMounted
    );
    await delay(stepDelay);
  }

  if (isMounted) setIsMoving(currentPlayerId, false);
};
