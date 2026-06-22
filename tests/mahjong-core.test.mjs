import assert from "node:assert/strict";
import {
  MONEY_TILE_TYPES,
  TILE_SPAN,
  buildOccupancyGrid,
  canMatch,
  createMoneyMahjongBoard,
  getAvailableMatches,
  getBlockingTilesAbove,
  getLayoutCoordinates,
  getSelectableTiles,
  getSideState,
  isTileSelectable,
  removeMatchingPair,
  validateCoordinates
} from "../src/mahjong-core.js";

function tile(id, x, y, z, faceKey = "A", reward = 1000) {
  return {
    id,
    x,
    y,
    z,
    faceKey,
    label: faceKey,
    reward,
    removed: false
  };
}

const coordinates = getLayoutCoordinates("turtle");
assert.equal(coordinates.length, 144, "turtle layout should contain 144 tiles");
assert.deepEqual(validateCoordinates(coordinates), { valid: true, errors: [] });

const firstBoard = createMoneyMahjongBoard({ seed: "fixed-seed" });
const secondBoard = createMoneyMahjongBoard({ seed: "fixed-seed" });
assert.equal(firstBoard.tiles.length, 144);
assert.equal(
  firstBoard.tiles.reduce((sum, item) => sum + item.reward, 0) / 2,
  500000,
  "total obtainable reward should be 500,000 won"
);
assert.deepEqual(
  countFaces(firstBoard.tiles),
  {
    KRW_1000: MONEY_TILE_TYPES.find((item) => item.key === "KRW_1000").pairCount * 2,
    KRW_5000: MONEY_TILE_TYPES.find((item) => item.key === "KRW_5000").pairCount * 2,
    KRW_10000: MONEY_TILE_TYPES.find((item) => item.key === "KRW_10000").pairCount * 2,
    KRW_50000: MONEY_TILE_TYPES.find((item) => item.key === "KRW_50000").pairCount * 2
  },
  "money tile distribution should match the configured 500,000 won prize pool"
);
assert.deepEqual(
  firstBoard.tiles.map((item) => item.faceKey),
  secondBoard.tiles.map((item) => item.faceKey),
  "seeded generation should be deterministic"
);

const occupancy = buildOccupancyGrid(firstBoard.tiles);
assert.equal(occupancy.getCell(firstBoard.tiles[0].x, firstBoard.tiles[0].y, firstBoard.tiles[0].z).length, 1);
assert.equal(occupancy.cells.size, firstBoard.tiles.length * TILE_SPAN.width * TILE_SPAN.height);

const sideBlockedTiles = [
  tile("left", 0, 0, 0),
  tile("center", 2, 0, 0),
  tile("right", 4, 0, 0)
];
assert.equal(isTileSelectable("center", sideBlockedTiles), false);
assert.deepEqual(
  pickSideBooleans(getSideState("center", sideBlockedTiles)),
  { leftFree: false, rightFree: false }
);
assert.equal(isTileSelectable("left", sideBlockedTiles), true);
assert.equal(isTileSelectable("right", sideBlockedTiles), true);

const topBlockedTiles = [
  tile("bottom", 0, 0, 0),
  tile("top", 1, 1, 1)
];
assert.equal(getBlockingTilesAbove("bottom", topBlockedTiles).length, 1);
assert.equal(isTileSelectable("bottom", topBlockedTiles), false);
assert.equal(isTileSelectable("top", topBlockedTiles), true);

const matchTiles = [
  tile("a", 0, 0, 0, "KRW_10000", 10000),
  tile("b", 4, 0, 0, "KRW_10000", 10000),
  tile("c", 8, 0, 0, "USD_100", 130000)
];
assert.equal(getSelectableTiles(matchTiles).length, 3);
assert.equal(canMatch("a", "b", matchTiles), true);
assert.equal(canMatch("a", "c", matchTiles), false);
assert.equal(getAvailableMatches(matchTiles).length, 1);

const boardForRemoval = {
  layoutId: "test",
  layoutName: "Test",
  tileSpan: TILE_SPAN,
  tiles: matchTiles,
  rewardTotal: 0,
  moveCount: 0,
  seed: "test"
};
const result = removeMatchingPair(boardForRemoval, "a", "b", 123);
assert.equal(result.matched, true);
assert.equal(result.rewardGained, 10000);
assert.equal(result.board.rewardTotal, 10000);
assert.equal(result.board.moveCount, 1);
assert.equal(result.board.tiles.find((item) => item.id === "a").removed, true);
assert.equal(result.board.tiles.find((item) => item.id === "b").matchedAt, 123);

function pickSideBooleans(sideState) {
  return {
    leftFree: sideState.leftFree,
    rightFree: sideState.rightFree
  };
}

function countFaces(tiles) {
  return tiles.reduce((counts, item) => {
    counts[item.faceKey] = (counts[item.faceKey] ?? 0) + 1;
    return counts;
  }, {});
}

console.log("mahjong-core tests passed");
