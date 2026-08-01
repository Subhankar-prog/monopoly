import assert from 'assert';
import * as GS from '../server/gameState';

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, extra?: any) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra) : '');
  }
}

/** Queue exact dice values; Math.random is patched to produce them. */
function queueDice(...pairs: [number, number][]) {
  const queue = pairs.flatMap(([a, b]) => [a, b]);
  const realRandom = Math.random;
  let i = 0;
  Math.random = () => {
    if (i >= queue.length) throw new Error('Dice queue exhausted — test needs more values queued');
    const v = queue[i++];
    return (v - 1) / 6 + 0.001; // maps back to floor(x*6)+1 === v
  };
  return () => {
    Math.random = realRandom;
  };
}

function fakePlayers(n: number) {
  return Array.from({ length: n }, (_, i) => ({ socketId: `sock-${i}`, playerId: i, name: `P${i + 1}` }));
}

function setup(n = 2) {
  const room = GS.createRoom('sock-0', 'P1');
  for (let i = 1; i < n; i++) {
    GS.joinRoom(room.code, `sock-${i}`, `P${i + 1}`);
  }
  GS.startGame(room.code);
  return room.code;
}

// ── Test 1: Doubles grants another turn ─────────────────────────────────
function testDoublesExtraTurn() {
  console.log('\n[Test] Doubles grants an extra roll, non-doubles ends the turn');
  const code = setup(2);
  const gs0 = GS.getRoom(code)!.gameState!;
  gs0.players[0].money = 5000; // ensure any BUY_CARD prompt can be resolved
  const restore = queueDice([3, 3]); // doubles
  const gs = GS.rollDice(code, 'sock-0')!;
  restore();
  check('isDoubles flag set', gs.dice.isDoubles === true);
  check('mustRollAgain set after doubles', gs.mustRollAgain === true);
  const finishResult = GS.playerFinishedMoving(code, 'sock-0')!;
  if (finishResult.actionRequired === 'BUY_CARD') {
    GS.buySiteAction(code, 'sock-0');
  }
  const afterFinish = GS.getRoom(code)!.gameState!;
  check('isDone true after resolving landing tile', afterFinish.isDone === true);
  const afterEnd = GS.endTurn(code, 'sock-0')!;
  check('same player still active after doubles + endTurn', afterEnd.activePlayer === 0);
  check('isDone reset for the extra roll', afterEnd.isDone === false);

  // Now roll non-doubles and confirm turn actually passes
  const restore2 = queueDice([2, 5]);
  GS.rollDice(code, 'sock-0');
  restore2();
  const finish2 = GS.playerFinishedMoving(code, 'sock-0')!;
  if (finish2.actionRequired === 'BUY_CARD') {
    GS.buySiteAction(code, 'sock-0');
  }
  const finalState = GS.endTurn(code, 'sock-0')!;
  check('turn passes to player 1 after non-doubles', finalState.activePlayer === 1);
}

// ── Test 2: Three doubles in a row sends you to jail ────────────────────
function testTripleDoublesToJail() {
  console.log('\n[Test] Three doubles in a row sends the player to jail');
  const code = setup(2);
  const gs0 = GS.getRoom(code)!.gameState!;
  gs0.players[0].money = 5000;
  for (let i = 0; i < 3; i++) {
    const restore = queueDice([4, 4]);
    GS.rollDice(code, 'sock-0');
    restore();
    if (i < 2) {
      const finish = GS.playerFinishedMoving(code, 'sock-0');
      if (finish?.actionRequired === 'BUY_CARD') {
        GS.buySiteAction(code, 'sock-0');
      }
      GS.endTurn(code, 'sock-0'); // doubles -> stays player 0's turn
    }
  }
  const gs = GS.getRoom(code)!.gameState!;
  const p0 = gs.players[0];
  check('player sent to jail after 3 doubles', p0.inJail === true, p0);
  check('consecutiveDoubles reset', p0.consecutiveDoubles === 0);
  check('turn is done (move forfeited)', gs.isDone === true);
  check('lastEvent records speeding', gs.lastEvent?.kind === 'speeding_to_jail');
}

// ── Test 3: Full jail cycle — pay fine, use card, roll out, forced release ──
function testJailPayFine() {
  console.log('\n[Test] Pay $50 to leave jail, then roll normally');
  const code = setup(2);
  const gs = GS.getRoom(code)!.gameState!;
  gs.players[0].inJail = true;
  gs.players[0].money = 1500;

  const before = gs.players[0].money;
  const result = GS.payJailFine(code, 'sock-0')!;
  check('pay fine succeeds', result !== null);
  check('$50 deducted', result.players[0].money === before - 50);
  check('inJail cleared', result.players[0].inJail === false);

  // Should now be able to roll normally this same turn
  const restore = queueDice([2, 3]);
  const rolled = GS.rollDice(code, 'sock-0');
  restore();
  check('can roll normally after paying fine', rolled !== null);
}

function testJailUseCard() {
  console.log('\n[Test] Use Get Out of Jail Free card');
  const code = setup(2);
  const gs = GS.getRoom(code)!.gameState!;
  gs.players[0].inJail = true;
  gs.players[0].getOutOfJailFreeCards = 1;

  const result = GS.useJailCard(code, 'sock-0')!;
  check('card use succeeds', result !== null);
  check('card consumed', result.players[0].getOutOfJailFreeCards === 0);
  check('inJail cleared', result.players[0].inJail === false);

  const resultNoCard = GS.useJailCard(code, 'sock-0');
  check('cannot reuse when no cards left', resultNoCard === null);
}

function testJailRollDoublesOut() {
  console.log('\n[Test] Roll doubles to escape jail (no extra turn granted)');
  const code = setup(2);
  const gs = GS.getRoom(code)!.gameState!;
  gs.players[0].inJail = true;
  gs.players[0].site = 10;

  const restore = queueDice([5, 5]);
  const result = GS.rollForJail(code, 'sock-0')!;
  restore();
  check('left jail on doubles', result.players[0].inJail === false);
  check('moved by the roll', result.players[0].site === 20);
  check('doubles-out-of-jail does NOT grant another turn', result.mustRollAgain === false);
}

function testJailForcedReleaseOnThirdAttempt() {
  console.log('\n[Test] Forced release + $50 fine after 3 failed jail rolls');
  const code = setup(2);
  const gs = GS.getRoom(code)!.gameState!;
  gs.players[0].inJail = true;
  gs.players[0].site = 10;
  gs.players[0].money = 1500;

  let restore = queueDice([1, 2]); // not doubles
  let r = GS.rollForJail(code, 'sock-0')!;
  restore();
  check('attempt 1: still in jail', r.players[0].inJail === true);
  check('attempt 1: jailTurns=1', r.players[0].jailTurns === 1);
  // Simulate the turn cycling back to this player for their next jail attempt
  // (each jail roll is one turn) without needing full multi-player turn machinery.
  r.isDone = false;
  r.hasRolledThisTurn = false;

  restore = queueDice([1, 3]); // not doubles
  r = GS.rollForJail(code, 'sock-0')!;
  restore();
  check('attempt 2: still in jail', r.players[0].inJail === true);
  check('attempt 2: jailTurns=2', r.players[0].jailTurns === 2);
  r.isDone = false;
  r.hasRolledThisTurn = false;

  const moneyBefore = r.players[0].money;
  restore = queueDice([1, 4]); // not doubles, 3rd attempt -> forced release
  r = GS.rollForJail(code, 'sock-0')!;
  restore();
  check('attempt 3: released from jail', r.players[0].inJail === false);
  check('attempt 3: paid $50 fine', r.players[0].money === moneyBefore - 50);
  check('attempt 3: moved by the roll (5)', r.players[0].site === 15);
}

// ── Test 4: Bankruptcy liquidation + win condition ──────────────────────
function testDebtThenExplicitBankruptcy() {
  console.log('\n[Test] Going negative creates a debt state, not instant bankruptcy — until declared');
  const code = setup(2);
  const gs = GS.getRoom(code)!.gameState!;
  gs.players[0].money = 2;
  gs.players[0].site = 3;
  gs.sites.boughtSites.push(3);
  gs.sites.boughtBy[3] = 1;
  gs.sites.sites[3].isMortgaged = false;
  gs.sites.playersSites[1] = [{ ...gs.sites.sites[3] }];
  gs.sites.boughtSites.push(1);
  gs.sites.boughtBy[1] = 0;
  gs.sites.playersSites[0] = [{ ...gs.sites.sites[1] }];

  gs.dice.diceSum = 6;
  const result = GS.playerFinishedMoving(code, 'sock-0')!;
  const afterRent = result.gameState;
  check('player 0 is in debt (negative money), NOT auto-bankrupted', afterRent.players[0].money < 0 && afterRent.players[0].isBankrupt === false);
  check('debtCreditor recorded as player 1', afterRent.players[0].debtCreditor === 1);
  check('player 0 still owns their property (not yet liquidated)', afterRent.sites.boughtBy[1] === 0);

  // While in debt, rolling and ending the turn must be blocked.
  const rollBlocked = GS.rollDice(code, 'sock-0');
  check('cannot roll while in debt', rollBlocked === null);
  afterRent.isDone = true; // pretend the tile resolution finished, to isolate the endTurn guard
  const endBlocked = GS.endTurn(code, 'sock-0');
  check('cannot end turn while in debt', endBlocked === null);

  // Mortgaging should be usable specifically because they're in debt, even
  // if this weren't their turn (using their own property they still own).
  const moneyBeforeMortgage = afterRent.players[0].money;
  const afterMortgage = GS.mortgageSite(code, 'sock-0', 1)!;
  check('mortgage while in debt succeeds and raises cash', afterMortgage.players[0].money > moneyBeforeMortgage);

  // Now explicitly test declareBankruptcy on a fresh, still-negative scenario.
  const code2 = setup(2);
  const gs2 = GS.getRoom(code2)!.gameState!;
  gs2.players[0].money = -50;
  gs2.players[0].debtCreditor = 1;
  gs2.sites.boughtSites.push(1);
  gs2.sites.boughtBy[1] = 0;
  gs2.sites.playersSites[0] = [{ ...gs2.sites.sites[1] }];

  const cantDeclare = GS.declareBankruptcy(code2, 'sock-1'); // wrong player, not in debt
  check('a solvent player cannot declare bankruptcy', cantDeclare === null);

  const bankrupt = GS.declareBankruptcy(code2, 'sock-0')!;
  check('declaring bankruptcy while in debt succeeds', bankrupt !== null);
  check('player 0 now marked bankrupt', bankrupt.players[0].isBankrupt === true);
  check('property transferred to creditor (player 1)', bankrupt.sites.boughtBy[1] === 1);
  check('game over with 2 players -> 1 remaining', bankrupt.gameOver === true);
  check('winner is player 1', bankrupt.winner === 1);
}

function testSellSiteToBank() {
  console.log('\n[Test] Selling a property back to the bank at its original price');
  const code = setup(2);
  const gs = GS.getRoom(code)!.gameState!;
  gs.players[0].money = -30;
  gs.players[0].debtCreditor = null;
  gs.sites.boughtSites.push(1);
  gs.sites.boughtBy[1] = 0;
  gs.sites.playersSites[0] = [{ ...gs.sites.sites[1] }];
  const originalPrice = gs.sites.sites[1].sellingPrice;

  const cantSellBuilt = (() => {
    gs.sites.sites[1].built = 1;
    const r = GS.sellSiteToBank(code, 'sock-0', 1);
    gs.sites.sites[1].built = 0; // reset for the real attempt below
    return r;
  })();
  check('cannot sell a property with buildings on it', cantSellBuilt === null);

  const result = GS.sellSiteToBank(code, 'sock-0', 1)!;
  check('sale succeeds', result !== null);
  check('credited the full original price', result.players[0].money === -30 + originalPrice);
  check('property returned to the bank (unowned)', result.sites.boughtBy[1] === null);
  check('property removed from boughtSites', !result.sites.boughtSites.includes(1));
  if (result.players[0].money >= 0) {
    check('debt cleared once solvent again', result.players[0].debtCreditor === null);
  }
}

function testDebtRecoveryWithoutBankruptcy() {
  console.log('\n[Test] A player can recover from debt via mortgage/sell without ever going bankrupt');
  const code = setup(2);
  const gs = GS.getRoom(code)!.gameState!;
  gs.players[0].money = -40;
  gs.players[0].debtCreditor = null;
  gs.sites.boughtSites.push(1, 3);
  gs.sites.boughtBy[1] = 0;
  gs.sites.boughtBy[3] = 0;
  gs.sites.playersSites[0] = [{ ...gs.sites.sites[1] }, { ...gs.sites.sites[3] }];

  GS.mortgageSite(code, 'sock-0', 1);
  const after = GS.mortgageSite(code, 'sock-0', 3)!;
  check('player recovered to solvent via two mortgages', after.players[0].money >= 0, after.players[0]);
  check('player never got marked bankrupt', after.players[0].isBankrupt === false);

  // Now that they're solvent again, rolling should work normally.
  const restore = queueDice([2, 3]);
  const rolled = GS.rollDice(code, 'sock-0');
  restore();
  check('can roll again once debt is resolved', rolled !== null);
}

// ── Test 5: Building requires a full monopoly + even build-up ───────────
function testBuildingRules() {
  console.log('\n[Test] Building requires full color group + even build-up');
  const code = setup(2);
  const gs = GS.getRoom(code)!.gameState!;
  // Brown group = sites 1 and 3 (from earlier inspection of boardData.json)
  gs.players[0].money = 5000;

  // Try building before owning the full group -> should fail
  gs.sites.boughtSites.push(1);
  gs.sites.boughtBy[1] = 0;
  gs.sites.playersSites[0] = [{ ...gs.sites.sites[1] }];
  let r = GS.buildOnSite(code, 'sock-0', 1);
  check('cannot build without owning full color group', r === null);

  // Now own both brown sites
  gs.sites.boughtSites.push(3);
  gs.sites.boughtBy[3] = 0;
  gs.sites.playersSites[0].push({ ...gs.sites.sites[3] });

  r = GS.buildOnSite(code, 'sock-0', 1);
  check('can build on site 1 once group is fully owned', r !== null && r.sites.sites[1].built === 1);

  // Try building a 2nd house on site 1 before site 3 has any -> should fail (even build-up)
  const r2 = GS.buildOnSite(code, 'sock-0', 1);
  check('cannot build unevenly (site 1 ahead of site 3)', r2 === null);

  // Build on site 3 to even it up, should succeed
  const r3 = GS.buildOnSite(code, 'sock-0', 3);
  check('can build on the lagging site to even up', r3 !== null && r3.sites.sites[3].built === 1);

  // Selling: must sell from the most-built site first
  gs.sites.sites[1].built = 2;
  gs.sites.playersSites[0].find((s: any) => s.id === 1)!.built = 2;
  const sellWrong = GS.sellBuild(code, 'sock-0', 3); // site 3 has 1, site 1 has 2 -> selling 3 should fail
  check('cannot sell from the site that is behind', sellWrong === null);
  const sellRight = GS.sellBuild(code, 'sock-0', 1);
  check('can sell from the most-built site', sellRight !== null && sellRight.sites.sites[1].built === 1);
}

// ── Test 6: LOGICAL chance/chest cards actually move money ──────────────
function testLogicalCards() {
  console.log('\n[Test] LOGICAL cards (birthday collect, repairs) move real money');
  const code = setup(3);
  const gs = GS.getRoom(code)!.gameState!;
  Object.keys(gs.players).forEach((k: string) => (gs.players[Number(k)].money = 1000));

  // Force player 0 onto the Chance tile with a diceSum that maps to the
  // "birthday" LOGICAL card (logicalId 2, chance dice-sum 2 in the data).
  const chanceTileId = gs.sites.sites.findIndex((s: any) => s.type === 'chance');
  gs.players[0].site = chanceTileId;
  gs.dice.diceSum = 2;
  const before = { p0: gs.players[0].money, p1: gs.players[1].money, p2: gs.players[2].money };
  const result = GS.playerFinishedMoving(code, 'sock-0')!.gameState;
  const after = result.players;
  check(
    'birthday: active player collects from both others',
    after[0].money === before.p0 + 20,
    { before, after: after[0].money }
  );
  check('birthday: player 1 paid $10', after[1].money === before.p1 - 10);
  check('birthday: player 2 paid $10', after[2].money === before.p2 - 10);
}

// ── Test 7: Trading end-to-end with re-validation at accept time ────────
function testTradingRevalidation() {
  console.log('\n[Test] Trade offers re-validate ownership at accept time');
  const code = setup(2);
  const gs = GS.getRoom(code)!.gameState!;
  gs.sites.boughtSites.push(1);
  gs.sites.boughtBy[1] = 0;
  gs.sites.playersSites[0] = [{ ...gs.sites.sites[1] }];
  gs.players[0].money = 1000;
  gs.players[1].money = 1000;

  const proposed = GS.proposeTrade(code, 'sock-0', 1, [1], [], 100, 0);
  check('trade proposed', proposed !== null);
  const tradeId = proposed!.trades[0].id;

  // Player 0 sells the property elsewhere before it's accepted (simulate a stale trade)
  gs.sites.boughtBy[1] = null;
  gs.sites.playersSites[0] = [];

  const accepted = GS.respondToTrade(code, 'sock-1', tradeId, true);
  check('stale trade correctly rejected at accept time (property no longer owned)', accepted === null);
}

function testTradingHappyPath() {
  console.log('\n[Test] Trade happy path swaps property + money correctly');
  const code = setup(2);
  const gs = GS.getRoom(code)!.gameState!;
  gs.sites.boughtSites.push(1);
  gs.sites.boughtBy[1] = 0;
  gs.sites.playersSites[0] = [{ ...gs.sites.sites[1] }];
  gs.players[0].money = 1000;
  gs.players[1].money = 1000;

  GS.proposeTrade(code, 'sock-0', 1, [1], [], 0, 100); // offer the property, request $100 back
  const tradeId = GS.getRoom(code)!.gameState!.trades[0].id;
  const result = GS.respondToTrade(code, 'sock-1', tradeId, true)!;
  check('property transferred to player 1', result.sites.boughtBy[1] === 1);
  check('player 0 lost the property from their list', result.sites.playersSites[0].find((s: any) => s.id === 1) === undefined);
  check('player 0 gained $100', result.players[0].money === 1100);
  check('player 1 paid $100', result.players[1].money === 900);
}

// ── Test 8: Pass-GO salary on wraparound (roll + card-driven) ───────────
function testPassGoSalary() {
  console.log('\n[Test] GO salary triggers correctly on wraparound');
  const code = setup(2);
  const gs = GS.getRoom(code)!.gameState!;
  gs.players[0].site = 38; // near the end of the board
  gs.players[0].money = 1500;

  const restore = queueDice([1, 3]); // sum 4 -> wraps past 40 to site 2
  const result = GS.rollDice(code, 'sock-0')!;
  restore();
  check('wrapped position correct (38+4-40=2)', result.players[0].site === 2);
  check('GO salary awarded on wraparound', result.players[0].money === 1700);
}

function testJailTileNoLongerChargesOnVisit() {
  console.log('\n[Test] Landing on "Just Visiting" costs nothing');
  const code = setup(2);
  const gs = GS.getRoom(code)!.gameState!;
  gs.players[0].site = 10;
  gs.players[0].money = 1500;
  const result = GS.playerFinishedMoving(code, 'sock-0')!.gameState;
  check('no charge for just visiting jail', result.players[0].money === 1500);
  check('not marked inJail from just visiting', result.players[0].inJail === false);
}

// ── Test 9: Server-authoritative auction — full bid/fold cycle ──────────
function testAuctionBidFoldCycle() {
  console.log('\n[Test] Auction: bidding war resolves to the highest real bidder');
  const code = setup(3);
  const gs = GS.getRoom(code)!.gameState!;
  // Force player 0 onto an expensive unbought site with too little cash to
  // buy outright, so landing triggers an auction instead of BUY_CARD.
  const expensiveSiteId = gs.sites.sites.findIndex(
    (s: any) => s.type === 'site' && s.sellingPrice > 300
  );
  gs.players[0].site = expensiveSiteId;
  gs.players[0].money = 50; // can't afford full price
  gs.players[1].money = 500;
  gs.players[2].money = 500;
  gs.dice.diceSum = 6;

  const result = GS.playerFinishedMoving(code, 'sock-0')!;
  check('auction started', result.actionRequired === 'AUCTION_CARD');
  check('currentAuction populated', result.gameState.currentAuction !== null);
  check('active bidder starts as the landing player', result.gameState.currentAuction!.activeBidderId === 0);

  // Player 0 bids $10, then player 1 outbids at $20, player 2 folds, player 0 folds -> player 1 wins.
  let r = GS.placeBid(code, 'sock-0', 10)!;
  check('player 0 bid $10 accepted', r.currentAuction!.currentBid === 10);
  check('turn passes to player 1', r.currentAuction!.activeBidderId === 1);

  r = GS.placeBid(code, 'sock-1', 20)!;
  check('player 1 outbid at $20', r.currentAuction!.currentBid === 20 && r.currentAuction!.highBidderId === 1);
  check('turn passes to player 2', r.currentAuction!.activeBidderId === 2);

  r = GS.foldAuction(code, 'sock-2')!;
  check('player 2 folded, turn passes to player 0', r.currentAuction!.activeBidderId === 0);

  const p1MoneyBefore = r.players[1].money;
  r = GS.foldAuction(code, 'sock-0')!;
  check('auction resolved after player 0 folds (only player 1 left)', r.currentAuction === null);
  check('site awarded to player 1', r.sites.boughtBy[expensiveSiteId] === 1);
  check('player 1 charged the winning bid ($20)', r.players[1].money === p1MoneyBefore - 20);
  check('turn is done after auction resolves', r.isDone === true);
}

function testAuctionRejectsWrongTurn() {
  console.log('\n[Test] Auction: only the active bidder can act');
  const code = setup(2);
  const gs = GS.getRoom(code)!.gameState!;
  const siteId = gs.sites.sites.findIndex((s: any) => s.type === 'site' && s.sellingPrice > 300);
  gs.players[0].site = siteId;
  gs.players[0].money = 50;
  gs.dice.diceSum = 6;
  GS.playerFinishedMoving(code, 'sock-0');

  const wrongTurnBid = GS.placeBid(code, 'sock-1', 10);
  check('non-active player cannot bid out of turn', wrongTurnBid === null);
}

function testAuctionUnsoldWhenNoValidBids() {
  console.log('\n[Test] Auction: property stays with the bank if nobody can afford even $1');
  const code = setup(2);
  const gs = GS.getRoom(code)!.gameState!;
  const siteId = gs.sites.sites.findIndex((s: any) => s.type === 'site' && s.sellingPrice > 300);
  gs.players[0].site = siteId;
  gs.players[0].money = 0;
  gs.players[1].money = 0;
  gs.dice.diceSum = 6;
  const result = GS.playerFinishedMoving(code, 'sock-0')!;
  check(
    'auction resolves immediately as unsold when nobody can bid at all',
    result.gameState.currentAuction === null && result.gameState.sites.boughtBy[siteId] === null
  );
}

function testRedeemSite() {
  console.log('\n[Test] Redeeming a mortgaged property');
  const code = setup(2);
  const gs = GS.getRoom(code)!.gameState!;
  gs.players[0].money = 500;
  gs.sites.boughtSites.push(1);
  gs.sites.boughtBy[1] = 0;
  gs.sites.playersSites[0] = [{ ...gs.sites.sites[1] }];

  const afterMortgage = GS.mortgageSite(code, 'sock-0', 1)!;
  check('mortgage succeeds', afterMortgage.sites.sites[1].isMortgaged === true);
  const moneyAfterMortgage = afterMortgage.players[0].money;

  const afterRedeem = GS.redeemSite(code, 'sock-0', 1);
  check('redeem succeeds while mortgaged', afterRedeem !== null);
  check('redeem clears the mortgage flag', afterRedeem!.sites.sites[1].isMortgaged === false);
  check(
    'redeem costs 110% of the mortgage value',
    afterRedeem!.players[0].money === moneyAfterMortgage - Math.floor(gs.sites.sites[1].mortgage * 1.1)
  );

  const redeemAgain = GS.redeemSite(code, 'sock-0', 1);
  check('cannot redeem a property that is not mortgaged', redeemAgain === null);

  const poorPlayerCode = setup(2);
  const gs2 = GS.getRoom(poorPlayerCode)!.gameState!;
  gs2.players[0].money = 5;
  gs2.sites.boughtSites.push(1);
  gs2.sites.boughtBy[1] = 0;
  gs2.sites.sites[1].isMortgaged = true;
  gs2.sites.playersSites[0] = [{ ...gs2.sites.sites[1] }];
  const cantAffordRedeem = GS.redeemSite(poorPlayerCode, 'sock-0', 1);
  check('cannot redeem without enough cash', cantAffordRedeem === null);
}

function testTradeMortgagedPropertyKeepsStatus() {
  console.log('\n[Test] Trading a mortgaged property carries the mortgage over to the new owner');
  const code = setup(2);
  const gs = GS.getRoom(code)!.gameState!;
  gs.players[0].money = 500;
  gs.players[1].money = 500;
  gs.sites.boughtSites.push(1);
  gs.sites.boughtBy[1] = 0;
  gs.sites.sites[1].isMortgaged = true; // already mortgaged before the trade
  gs.sites.playersSites[0] = [{ ...gs.sites.sites[1] }];

  GS.proposeTrade(code, 'sock-0', 1, [1], [], 0, 50);
  const tradeId = GS.getRoom(code)!.gameState!.trades[0].id;
  const result = GS.respondToTrade(code, 'sock-1', tradeId, true)!;
  check('property ownership transferred', result.sites.boughtBy[1] === 1);
  check('mortgage status carried over to the new owner', result.sites.playersSites[1].find((s: any) => s.id === 1)?.isMortgaged === true);
}

function testFuzzRandomPlayback() {
  console.log('\n[Test] Randomized multi-turn playthrough — no crashes across many interleaved actions');
  const code = setup(4);
  let crashed = false;
  let crashDetail = '';

  for (let turn = 0; turn < 250 && !crashed; turn++) {
    const gs = GS.getRoom(code)!.gameState!;
    if (gs.gameOver) break;
    const activeId = gs.activePlayer;
    const socketId = `sock-${activeId}`;
    const player = gs.players[activeId];

    try {
      if (player.isBankrupt) {
        crashed = true;
        crashDetail = `bankrupt player ${activeId} is somehow active`;
        break;
      }

      if (player.money < 0) {
        const mine = gs.sites.playersSites[activeId] || [];
        const target = mine.find((s: any) => !s.isMortgaged && s.built === 0);
        if (target) {
          GS.mortgageSite(code, socketId, target.id);
        } else {
          GS.declareBankruptcy(code, socketId);
        }
        continue;
      }

      if (player.inJail) {
        const roll = Math.random();
        if (roll < 0.4) GS.payJailFine(code, socketId);
        else if (roll < 0.6) GS.useJailCard(code, socketId);
        else GS.rollForJail(code, socketId);
        continue;
      }

      if (gs.currentAuction) {
        if (gs.currentAuction.activeBidderId === activeId) {
          if (Math.random() < 0.5) {
            GS.placeBid(code, socketId, gs.currentAuction.currentBid + 1 + Math.floor(Math.random() * 20));
          } else {
            GS.foldAuction(code, socketId);
          }
        }
        continue;
      }

      if (!gs.isDone) {
        GS.rollDice(code, socketId);
        continue;
      }

      const site = gs.sites.sites[player.site];
      if (
        (site.type === 'site' || site.type === 'realm_rails' || site.type === 'utility') &&
        !gs.sites.boughtSites.includes(site.id)
      ) {
        GS.buySiteAction(code, socketId);
        continue;
      }

      const mine = gs.sites.playersSites[activeId] || [];
      if (mine.length > 0 && Math.random() < 0.3) {
        const randomSite = mine[Math.floor(Math.random() * mine.length)];
        const action = Math.random();
        if (action < 0.4) GS.buildOnSite(code, socketId, randomSite.id);
        else if (action < 0.7) GS.mortgageSite(code, socketId, randomSite.id);
        else GS.sellBuild(code, socketId, randomSite.id);
      }

      GS.endTurn(code, socketId);
    } catch (err: any) {
      crashed = true;
      crashDetail = `Exception on turn ${turn} (player ${activeId}): ${err?.message || err}`;
    }
  }

  check('250-turn randomized playthrough completed with no exceptions', !crashed, crashDetail);

  const finalGs = GS.getRoom(code)!.gameState!;
  const allFinite = Object.values(finalGs.players).every((p: any) => Number.isFinite(p.money));
  check('every player has a finite, well-formed money value after the fuzz run', allFinite);
}

// ── Run everything ────────────────────────────────────────────────────
testDoublesExtraTurn();
testTripleDoublesToJail();
testJailPayFine();
testJailUseCard();
testJailRollDoublesOut();
testJailForcedReleaseOnThirdAttempt();
testDebtThenExplicitBankruptcy();
testSellSiteToBank();
testDebtRecoveryWithoutBankruptcy();
testBuildingRules();
testLogicalCards();
testTradingRevalidation();
testTradingHappyPath();
testPassGoSalary();
testJailTileNoLongerChargesOnVisit();
testAuctionBidFoldCycle();
testAuctionRejectsWrongTurn();
testAuctionUnsoldWhenNoValidBids();
testRedeemSite();
testTradeMortgagedPropertyKeepsStatus();
testFuzzRandomPlayback();

console.log(`\n${'='.repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));
if (failed > 0) process.exit(1);
