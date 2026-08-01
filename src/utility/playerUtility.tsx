import { cardTypes, directions } from './constants';

export const createPlayerData = (totalPlayers, botCount = 0) => {
  const players = {};
  const firstBotIndex = totalPlayers - botCount;
  for (let player = 0; player < totalPlayers; player++) {
    const isBot = botCount > 0 && player >= firstBotIndex;
    const botNumber = player - firstBotIndex + 1;
    players[player] = {
      site: 0,
      previousSite: 0,
      playerId: player,
      name: isBot ? `Bot ${botNumber}` : `Player ${player + 1}`,
      money: 1000,
      isMoving: false,
      direction: directions.FORWARD,
      isBot,
    };
  }
  return players;
};

export const calcTurningPoints = (ps, cs) => {
  const points = [0, 10, 20, 30];
  const turningPoints = [];
  for (let i = 0; i < points.length; i++) {
    if (ps < points[i] && cs > points[i]) turningPoints.push(points[i]);
  }
  return turningPoints;
};

/**
 * Every tile the piece actually passes over on its way from `ps` to `cs`,
 * in order, one entry per hop (excludes the starting tile, includes the
 * final one) — this is what makes the piece visibly step tile-by-tile
 * instead of jumping straight to its destination. `calcTurningPoints`
 * above only returns board *corners*, which is why the old animation only
 * paused at 0/10/20/30 and teleported everywhere in between.
 */
export const calcFullPath = (ps, cs, direction) => {
  const path = [];
  let cur = ps;
  if (direction === directions.BACKWARD) {
    while (cur !== cs) {
      cur = (cur - 1 + 40) % 40;
      path.push(cur);
    }
  } else {
    while (cur !== cs) {
      cur = (cur + 1) % 40;
      path.push(cur);
    }
  }
  return path;
};

export const getAllTurningPoints = (ps, cs, direction) => {
  if (direction === directions.BACKWARD) {
    const temp = ps;
    ps = cs;
    cs = temp;
  }
  const turningPoints = [];
  if (ps < cs) {
    turningPoints.push(...calcTurningPoints(ps, cs));
  } else if (ps > cs) {
    turningPoints.push(...calcTurningPoints(ps, 39));
    if (cs !== 0) turningPoints.push(0);
    turningPoints.push(...calcTurningPoints(0, cs));
  }
  if (direction === directions.BACKWARD) turningPoints.reverse();
  return turningPoints;
};

export const delay = (millis: number) =>
  new Promise<void>((resolve, reject) => {
    setTimeout(() => resolve(), millis);
  });

export const calcRentForSite = (cs, sites, noOfCardsInCategory) => {
  // check if built
  if (cs.built > 0) return cs.rentWithHouse[cs.built - 1];
  // check if all
  const totalSites = sites.filter(site => site.subType === cs.subType);
  let isDouble = false;
  if (totalSites.length === noOfCardsInCategory[cs.subType]) {
    // If none of the site is morgaged then take double rent else take single rent
    let i = 0;
    for (; i < totalSites.length; i++) {
      if (totalSites[i].isMortgaged) {
        isDouble = false;
        break;
      }
    }
    if (i === noOfCardsInCategory[cs.subType]) isDouble = true;
  }
  return isDouble ? 2 * cs.rent : cs.rent;
};

export const calcRentForRealmRails = sites => {
  const realRails = sites.filter(site => site.type === cardTypes.REALM_RAILS);
  return Math.pow(2, realRails.length - 1) * 25;
};

export const calcRentForUtility = (sites, diceSum) => {
  const utility = sites.filter(site => site.type === cardTypes.UTILITY);
  if (utility.length === 1) return 4 * diceSum;
  else if (utility.length === 2) return 10 * diceSum;
};

export const calcRent = (
  cs,
  otherPlayerSites,
  diceSum,
  noOfCardsInCategory
) => {
  if (cs.type === cardTypes.SITE)
    return calcRentForSite(cs, otherPlayerSites, noOfCardsInCategory);
  else if (cs.type === cardTypes.REALM_RAILS)
    return calcRentForRealmRails(otherPlayerSites);
  else if (cs.type === cardTypes.UTILITY)
    return calcRentForUtility(otherPlayerSites, diceSum);
};
